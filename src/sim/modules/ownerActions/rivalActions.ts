import type { SimContext } from '../../core/context'
import { spendCoin } from '../stock/ledger'
import {
  clearRivalIntent,
  competitorStandingForGroup,
  getPrimaryRival,
  openRivalSetback,
  rivalIntent,
  underTruce,
  writeRival,
} from '../rival/index'
import {
  scheduleRivalPactReview,
  scheduleRivalRetaliation,
} from '../rival/rivalEvents'

import { TIME_COST_QUICK, TIME_COST_SHORT, TIME_COST_STANDARD } from './stateHelpers'
import type {
  ActionTarget,
  ActionValidationResult,
  OwnerActionApplied,
  OwnerActionDefinition,
} from './types'

// Expansion Phase 9 §9.1 — the player's half of the competition.
//
// §9.1 gives the rival eight things it can do. A competitor the player can
// only respond to by improving their own numbers is weather with a name on
// it, so these four are the moves on the other side of the road, and every
// one of them is a real transaction against the rival's own record:
//
//   scout_the_competition  go and look — what they have, and what they mean
//                          to do about it
//   win_back_group         spend on a crowd they are courting, and take it
//                          back off them
//   poach_rival_staff      hire out from under them — cheap, effective, and
//                          they will remember it
//   settle_with_rival      buy an arrangement, with a date on it
//
// Each can FAIL, and two of them can rebound: poaching schedules a
// retaliation the rival chooses for itself, and a settlement schedules the
// review at which they decide whether it is still worth keeping. That is
// what stops the counterplay being a purchase.

const SOURCE = 'ownerActions'

const OK: ActionValidationResult = { ok: true }

function reject(code: string, reason: string): ActionValidationResult {
  return { ok: false, code, reason }
}

/** Crowds the rival is actually working. Nothing else is worth buying back. */
function courtedGroups(ctx: SimContext): ActionTarget[] {
  const rival = getPrimaryRival(ctx.state)
  if (!rival) return []
  return Object.values(rival.courting)
    .filter((entry) => entry.effort >= 10)
    .sort((a, b) => b.effort - a.effort || a.groupId.localeCompare(b.groupId))
    .map((entry) => {
      const group = ctx.state.customerGroups[entry.groupId]
      const standing = competitorStandingForGroup(ctx.state, entry.groupId)
      return {
        id: entry.groupId,
        label: group?.label ?? entry.groupId,
        hint: standing
          ? `${entry.poaching ? 'being poached' : 'being courted'} — ${standing.readable}`
          : `${entry.poaching ? 'being poached' : 'being courted'} (effort ${entry.effort})`,
      }
    })
}

function theRival(ctx: SimContext): ActionTarget[] {
  const rival = getPrimaryRival(ctx.state)
  if (!rival) return []
  const intent = rivalIntent(ctx.state)
  return [
    {
      id: rival.id,
      label: rival.name,
      hint: intent
        ? intent.readable
        : rival.position === 'unknown'
          ? 'nobody is sure what they mean to be yet'
          : `running a ${rival.position} house`,
    },
  ]
}

/** What buying a crowd back costs — bigger crowds cost more. */
export function winBackCost(ctx: SimContext, groupId: string): number {
  const group = ctx.state.customerGroups[groupId]
  const rival = getPrimaryRival(ctx.state)
  const effort = rival?.courting[groupId]?.effort ?? 0
  return Math.max(12, Math.round(((group?.patronage ?? 40) / 8) + effort / 2))
}

/** What an arrangement costs. A rival that is winning wants more for it. */
export function settlementCost(ctx: SimContext): number {
  const rival = getPrimaryRival(ctx.state)
  if (!rival) return 0
  const reach = rival.capability.reach
  return Math.max(30, Math.round(40 + reach * 0.6 + rival.backingFactionIds.length * 15))
}

// ---------- scout_the_competition ----------

const scoutTheCompetition: OwnerActionDefinition = {
  id: 'scout_the_competition',
  label: 'Scout The Competition',
  category: 'immediate',
  tags: ['rival', 'information'],
  effectsPreview: 'An hour across the road: what they have, and what they are planning',
  pressureAffinity: ['rival_tavern_pressure'],
  targetType: 'global',
  timeCost: TIME_COST_QUICK,
  getValidTargets: theRival,
  canApply: (ctx) => {
    const rival = getPrimaryRival(ctx.state)
    if (!rival) return reject('no_rival', 'There is no other house to look at.')
    const today = ctx.state.calendar.totalDaysElapsed
    if (rival.scoutedOnDay !== undefined && today - rival.scoutedOnDay < 3) {
      return reject(
        'recently_scouted',
        `Somebody looked in on ${rival.name} on day ${rival.scoutedOnDay}; nothing will have changed yet.`,
      )
    }
    return OK
  },
  apply: (ctx): OwnerActionApplied => {
    const rival = getPrimaryRival(ctx.state)!
    const today = ctx.state.calendar.totalDaysElapsed
    writeRival(ctx, rival.id, (current) => ({ ...current, scoutedOnDay: today }), 'scouted')
    const intent = rivalIntent(ctx.state)
    const effects = [
      `${rival.name}: staffing ${rival.capability.staffing}, quality ${rival.capability.quality}, prices ${rival.capability.priceLevel}, reach ${rival.capability.reach}.`,
    ]
    if (intent) effects.push(intent.readable)
    else effects.push(`${rival.name} have nothing planned that anybody would say.`)
    return {
      actionId: 'scout_the_competition',
      label: 'Scout The Competition',
      targetId: rival.id,
      targetLabel: rival.name,
      timeCost: TIME_COST_QUICK,
      effects,
      data: {
        rivalId: rival.id,
        capability: { ...rival.capability },
        announced: intent?.actionId ?? null,
      },
    }
  },
}

// ---------- win_back_group ----------

const winBackGroup: OwnerActionDefinition = {
  id: 'win_back_group',
  label: 'Win Back A Crowd',
  category: 'social',
  tags: ['rival', 'customers', 'competition'],
  effectsPreview: 'Spends coin and an afternoon taking a courted crowd back',
  pressureAffinity: ['rival_tavern_pressure', 'regular_customer_loss'],
  targetType: 'customer_group',
  timeCost: TIME_COST_STANDARD,
  getValidTargets: courtedGroups,
  canApply: (ctx, input) => {
    if (!input.targetId) {
      return reject('missing_target', 'win_back_group requires targetId')
    }
    const group = ctx.state.customerGroups[input.targetId]
    if (!group) return reject('unknown_target', `Unknown group '${input.targetId}'`)
    const rival = getPrimaryRival(ctx.state)
    const courting = rival?.courting[input.targetId]
    if (!courting || courting.effort < 10) {
      return reject(
        'not_courted',
        `Nobody is working the ${group.label} — there is nothing to win back.`,
      )
    }
    const cost = winBackCost(ctx, input.targetId)
    if (cost > ctx.state.coin) {
      return reject(
        'insufficient_coin',
        `${cost} coin needed, ${ctx.state.coin} in the till.`,
      )
    }
    return OK
  },
  apply: (ctx, input): OwnerActionApplied => {
    const group = ctx.state.customerGroups[input.targetId!]!
    const rival = getPrimaryRival(ctx.state)!
    const courting = rival.courting[group.id]!
    const cost = winBackCost(ctx, group.id)
    spendCoin(ctx, cost, {
      category: 'other',
      source: `${SOURCE}.win_back_group`,
      sourceType: 'owner_action',
      target: 'coin',
      targetType: 'coin',
      amount: -cost,
      readable: `Free rounds and a word with the ${group.label} to hold them.`,
      tags: ['rival', 'customers'],
      relatedSystems: ['rival', 'customers'],
    })

    // A poaching campaign is harder to break than ordinary courting: they
    // went at this crowd for a reason, and the reason is still true.
    const knocked = courting.poaching ? 30 : 45
    const nextEffort = Math.max(0, courting.effort - knocked)
    writeRival(
      ctx,
      rival.id,
      (current) => ({
        ...current,
        courting: {
          ...current.courting,
          [group.id]: { ...courting, effort: nextEffort },
        },
      }),
      'win_back',
    )

    const effects = [
      nextEffort <= 0
        ? `${rival.name} have stopped working the ${group.label}.`
        : `${rival.name}'s hold on the ${group.label} is weaker (effort ${courting.effort} → ${nextEffort}).`,
      `Spent ${cost} coin.`,
    ]
    if (courting.poaching) {
      effects.push(`They went at this crowd because ${courting.reason} — that is still true.`)
    }
    return {
      actionId: 'win_back_group',
      label: 'Win Back A Crowd',
      targetId: group.id,
      targetLabel: group.label,
      timeCost: TIME_COST_STANDARD,
      effects,
      data: {
        groupId: group.id,
        coinSpent: cost,
        effortBefore: courting.effort,
        effortAfter: nextEffort,
        wasPoaching: courting.poaching,
      },
    }
  },
}

// ---------- poach_rival_staff ----------

const poachRivalStaff: OwnerActionDefinition = {
  id: 'poach_rival_staff',
  label: 'Hire Out From Under Them',
  category: 'social',
  tags: ['rival', 'staff', 'competition', 'aggressive'],
  effectsPreview: 'Buys their people away — effective, and they will answer for it',
  pressureAffinity: ['rival_tavern_pressure'],
  targetType: 'global',
  timeCost: TIME_COST_SHORT,
  getValidTargets: theRival,
  canApply: (ctx) => {
    const rival = getPrimaryRival(ctx.state)
    if (!rival) return reject('no_rival', 'There is no other house to hire from.')
    if (rival.capability.staffing < 25) {
      return reject(
        'nobody_left',
        `${rival.name} have nobody left worth taking.`,
      )
    }
    const cost = 45
    if (cost > ctx.state.coin) {
      return reject(
        'insufficient_coin',
        `${cost} coin needed, ${ctx.state.coin} in the till.`,
      )
    }
    return OK
  },
  apply: (ctx): OwnerActionApplied => {
    const rival = getPrimaryRival(ctx.state)!
    const cost = 45
    spendCoin(ctx, cost, {
      category: 'other',
      source: `${SOURCE}.poach_rival_staff`,
      sourceType: 'owner_action',
      target: 'coin',
      targetType: 'coin',
      amount: -cost,
      readable: `Bought a hand away from ${rival.name}.`,
      tags: ['rival', 'staff'],
      relatedSystems: ['rival', 'staff'],
    })
    const before = rival.capability.staffing
    writeRival(
      ctx,
      rival.id,
      (current) => ({
        ...current,
        capability: {
          ...current.capability,
          staffing: Math.max(0, current.capability.staffing - 18),
        },
      }),
      'poached',
    )
    openRivalSetback(ctx, {
      rivalId: rival.id,
      kind: 'staff_poached',
      severity: 30,
      readable: `${rival.name} lost a hand to the house across the road.`,
    })
    // They will answer for it — and they choose the answer themselves.
    const scheduled = scheduleRivalRetaliation(ctx, {
      rivalId: rival.id,
      provocation: 'poached',
      source: `${SOURCE}.poach_rival_staff`,
      readable: `${rival.name} know where their hand went.`,
      offsetDays: 6,
    })
    const effects = [
      `${rival.name} are short-handed (staffing ${before} → ${Math.max(0, before - 18)}).`,
      `Spent ${cost} coin.`,
    ]
    effects.push(
      scheduled
        ? `${rival.name} are deciding what to do about it.`
        : `${rival.name} already had something in hand for this house.`,
    )
    return {
      actionId: 'poach_rival_staff',
      label: 'Hire Out From Under Them',
      targetId: rival.id,
      targetLabel: rival.name,
      timeCost: TIME_COST_SHORT,
      effects,
      data: {
        rivalId: rival.id,
        coinSpent: cost,
        staffingBefore: before,
        retaliationScheduled: scheduled,
      },
    }
  },
}

// ---------- settle_with_rival ----------

/** How long an arrangement holds before it comes up for review. */
export const SETTLEMENT_DAYS = 21

const settleWithRival: OwnerActionDefinition = {
  id: 'settle_with_rival',
  label: 'Settle With The Other House',
  category: 'social',
  tags: ['rival', 'competition', 'compromise'],
  effectsPreview: 'Buys three weeks of peace — and a date when they reconsider it',
  pressureAffinity: ['rival_tavern_pressure'],
  targetType: 'global',
  timeCost: TIME_COST_STANDARD,
  getValidTargets: theRival,
  canApply: (ctx) => {
    const rival = getPrimaryRival(ctx.state)
    if (!rival) return reject('no_rival', 'There is no other house to settle with.')
    const today = ctx.state.calendar.totalDaysElapsed
    if (underTruce(rival, today)) {
      return reject(
        'already_settled',
        `There is already an arrangement with ${rival.name} until day ${rival.truceUntilDay}.`,
      )
    }
    const cost = settlementCost(ctx)
    if (cost > ctx.state.coin) {
      return reject(
        'insufficient_coin',
        `${rival.name} want ${cost} coin for an arrangement; ${ctx.state.coin} in the till.`,
      )
    }
    return OK
  },
  apply: (ctx): OwnerActionApplied => {
    const rival = getPrimaryRival(ctx.state)!
    const today = ctx.state.calendar.totalDaysElapsed
    const cost = settlementCost(ctx)
    spendCoin(ctx, cost, {
      category: 'other',
      source: `${SOURCE}.settle_with_rival`,
      sourceType: 'owner_action',
      target: 'coin',
      targetType: 'coin',
      amount: -cost,
      readable: `Bought an arrangement with ${rival.name}.`,
      tags: ['rival', 'settlement'],
      relatedSystems: ['rival'],
    })
    writeRival(
      ctx,
      rival.id,
      (current) => ({ ...current, truceUntilDay: today + SETTLEMENT_DAYS }),
      'settled',
    )
    // An announced hostile move is off the table — that is what was bought.
    clearRivalIntent(ctx, rival.id)
    const scheduled = scheduleRivalPactReview(ctx, {
      rivalId: rival.id,
      source: `${SOURCE}.settle_with_rival`,
      readable: `${rival.name} will want to look at the arrangement again.`,
      offsetDays: SETTLEMENT_DAYS,
    })
    return {
      actionId: 'settle_with_rival',
      label: 'Settle With The Other House',
      targetId: rival.id,
      targetLabel: rival.name,
      timeCost: TIME_COST_STANDARD,
      effects: [
        `An arrangement with ${rival.name} holds until day ${today + SETTLEMENT_DAYS}.`,
        `Spent ${cost} coin.`,
        scheduled
          ? `They will reconsider it on day ${today + SETTLEMENT_DAYS}.`
          : 'A review was already on the books.',
      ],
      data: {
        rivalId: rival.id,
        coinSpent: cost,
        truceUntilDay: today + SETTLEMENT_DAYS,
        reviewScheduled: scheduled,
      },
    }
  },
}

export const RIVAL_ACTIONS: ReadonlyArray<OwnerActionDefinition> = [
  scoutTheCompetition,
  winBackGroup,
  poachRivalStaff,
  settleWithRival,
]
