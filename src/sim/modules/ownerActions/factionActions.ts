import type { SimContext } from '../../core/context'
import { clampPercent } from '../../state/normalize'
import { closeStance, contestableStances } from '../factions/stances'
import {
  bumpFactionTotal,
  getFactionModuleState,
  openDemandFor,
  owedFavourFor,
  writeFactionSlice,
} from '../factions/factionState'
import { noteStanding, standingNet } from '../factions/standing'
import {
  clearFactionIntent,
  listFactionIntents,
} from '../factions/factionActors'
import { scheduleRetaliation } from '../factions/factionEvents'

import { spendCoin } from '../stock/ledger'

import { TIME_COST_QUICK, TIME_COST_SHORT, TIME_COST_STANDARD } from './stateHelpers'
import type {
  ActionTarget,
  ActionValidationResult,
  OwnerActionApplied,
  OwnerActionDefinition,
} from './types'

// Expansion Phase 8 §8.1 — the player's half of the faction conversation.
//
// §8.1's last requirement is "outcomes that can succeed, fail, or be
// opposed". Opposition is not a property of an outcome table; it is a set
// of moves that are on the board while the faction's intent is visible.
// These four are that set:
//
//   grant_faction_demand   pay or back what they asked for
//   refuse_faction_demand  say no, on the record, and take the grievance
//   appeal_to_faction      argue a hostile move down, or off
//   repay_faction_favour   settle a sponsorship before it is called in
//
// Every one of them is a real transaction — coin leaves the till, a stance
// actually shortens, a grievance is actually recorded — and every one can
// FAIL. `appeal_to_faction` in particular is a contest the player can lose,
// scored against the faction's influence and the size of the grievance,
// because an appeal that always worked would make the whole faction layer
// decorative.

const SOURCE = 'ownerActions'

const OK: ActionValidationResult = { ok: true }

function reject(code: string, reason: string): ActionValidationResult {
  return { ok: false, code, reason }
}

function factionsWithOpenDemand(ctx: SimContext): ActionTarget[] {
  return Object.values(getFactionModuleState(ctx.state).demands)
    .filter((demand) => demand.status === 'open')
    .sort((a, b) => a.dueOnDay - b.dueOnDay || a.id.localeCompare(b.id))
    .map((demand) => {
      const faction = ctx.state.world.factions[demand.factionId]
      return {
        id: demand.factionId,
        label: faction?.label ?? demand.factionId,
        hint:
          demand.kind === 'coin_contribution'
            ? `wants ${demand.askCoin} coin by day ${demand.dueOnDay}`
            : `wants ${demand.readable} by day ${demand.dueOnDay}`,
      }
    })
}

function factionsWithContestableMove(ctx: SimContext): ActionTarget[] {
  const byIntent = listFactionIntents(ctx.state).map((intent) => intent.factionId)
  const byStance = contestableStances(ctx.state).map((stance) => stance.factionId)
  const ids = [...new Set([...byStance, ...byIntent])].sort()
  return ids.map((id) => {
    const faction = ctx.state.world.factions[id]
    const stance = contestableStances(ctx.state).find((s) => s.factionId === id)
    return {
      id,
      label: faction?.label ?? id,
      hint: stance
        ? `${stance.kind.replace('_', ' ')} until day ${stance.endsOnDay}`
        : 'has announced a move',
    }
  })
}

function factionsOwedAFavour(ctx: SimContext): ActionTarget[] {
  return Object.values(getFactionModuleState(ctx.state).favours)
    .filter((favour) => favour.status === 'owed')
    .sort((a, b) => a.dueOnDay - b.dueOnDay || a.id.localeCompare(b.id))
    .map((favour) => {
      const faction = ctx.state.world.factions[favour.factionId]
      return {
        id: favour.factionId,
        label: faction?.label ?? favour.factionId,
        hint: `owed ${favour.grantedValue} coin, due day ${favour.dueOnDay}`,
      }
    })
}

function closeDemand(
  ctx: SimContext,
  demandId: string,
  status: 'granted' | 'refused',
): void {
  const today = ctx.state.calendar.totalDaysElapsed
  writeFactionSlice(
    ctx,
    (current) => {
      const demand = current.demands[demandId]
      if (!demand) return current
      return {
        ...current,
        demands: {
          ...current.demands,
          [demandId]: { ...demand, status, closedOnDay: today },
        },
      }
    },
    `demand_${status}`,
  )
}

// ---------- grant_faction_demand ----------

const grantFactionDemand: OwnerActionDefinition = {
  id: 'grant_faction_demand',
  label: 'Grant Faction Request',
  category: 'social',
  tags: ['social', 'faction', 'demand'],
  effectsPreview: 'Pays or backs what a faction asked for',
  pressureAffinity: ['faction_anger'],
  targetType: 'faction',
  timeCost: TIME_COST_SHORT,
  getValidTargets: factionsWithOpenDemand,
  canApply: (ctx, input) => {
    if (!input.targetId) {
      return reject('missing_target', 'grant_faction_demand requires targetId')
    }
    const faction = ctx.state.world.factions[input.targetId]
    if (!faction) {
      return reject('unknown_target', `Unknown faction '${input.targetId}'`)
    }
    const demand = openDemandFor(ctx.state, input.targetId)
    if (!demand) {
      return reject('no_open_demand', `${faction.label} have not asked for anything.`)
    }
    if (demand.askCoin > ctx.state.coin) {
      return reject(
        'insufficient_coin',
        `${demand.askCoin} coin needed, ${ctx.state.coin} in the till.`,
      )
    }
    return OK
  },
  apply: (ctx, input): OwnerActionApplied => {
    const faction = ctx.state.world.factions[input.targetId!]!
    const demand = openDemandFor(ctx.state, faction.id)!
    const effects: string[] = []

    if (demand.askCoin > 0) {
      // Through `spendCoin`, not `ctx.modifyCoin`: every coin movement has
      // to reach the coin ledger or the day's accounting will not reconcile
      // (Phase 9 §9.3, enforced by the economy module's daily record).
      spendCoin(ctx, demand.askCoin, {
        category: 'other',
        source: `${SOURCE}.grant_faction_demand`,
        sourceType: 'owner_action',
        target: 'coin',
        targetType: 'coin',
        amount: -demand.askCoin,
        readable: `Paid ${faction.label} the ${demand.askCoin} coin they asked for.`,
        tags: ['owner_action', 'faction', 'demand', faction.id],
        relatedActors: [{ kind: 'faction', id: faction.id }],
        relatedSystems: ['factions', 'economy'],
      })
      effects.push(`coin -${demand.askCoin}`)
    } else {
      effects.push('backed them publicly')
    }

    closeDemand(ctx, demand.id, 'granted')
    bumpFactionTotal(ctx, 'demandsGranted')

    // Granting is a favour on the ledger, and the trust it buys is real:
    // a faction that has been answered once believes it will be answered
    // again, which is what its next decision reads.
    noteStanding(ctx, {
      factionId: faction.id,
      id: `demand_granted_${demand.id}`,
      kind: 'favour',
      weight: demand.askCoin > 0 ? Math.min(30, 12 + Math.round(demand.askCoin / 8)) : 14,
      readable: `The house answered ${faction.label} about ${demand.readable}.`,
      tags: ['demand', 'granted'],
    })
    const nextTrust = clampPercent(faction.trust + 6)
    ctx.modifyFaction(
      faction.id,
      { trust: nextTrust },
      {
        source: `${SOURCE}.grant_faction_demand`,
        sourceType: 'owner_action',
        target: faction.id,
        targetType: 'faction',
        amount: nextTrust - faction.trust,
        readable: `${faction.label} trust the house a little more.`,
        tags: ['owner_action', 'faction', 'trust', faction.id],
        relatedActors: [{ kind: 'faction', id: faction.id }],
        relatedSystems: ['factions'],
      },
    )
    effects.push(`trust ${faction.trust} → ${nextTrust}`)

    ctx.addHistory({
      category: 'owner_action',
      summary: `The house granted ${faction.label}'s request.`,
      tags: ['owner_action', 'faction', 'demand', faction.id],
      relatedActors: [{ kind: 'faction', id: faction.id }],
      relatedSystems: ['ownerActions', 'factions'],
      mechanicalRefs: ['grant_faction_demand', demand.id],
    })

    return {
      actionId: grantFactionDemand.id,
      label: `Granted ${faction.label}'s Request`,
      targetId: faction.id,
      timeCost: TIME_COST_SHORT,
      effects,
      data: { factionId: faction.id, demandId: demand.id, paid: demand.askCoin },
    }
  },
}

// ---------- refuse_faction_demand ----------

const refuseFactionDemand: OwnerActionDefinition = {
  id: 'refuse_faction_demand',
  label: 'Refuse Faction Request',
  category: 'social',
  tags: ['social', 'faction', 'demand'],
  effectsPreview: 'Says no on the record — and they will remember',
  pressureAffinity: ['faction_anger'],
  targetType: 'faction',
  timeCost: TIME_COST_QUICK,
  getValidTargets: factionsWithOpenDemand,
  canApply: (ctx, input) => {
    if (!input.targetId) {
      return reject('missing_target', 'refuse_faction_demand requires targetId')
    }
    const faction = ctx.state.world.factions[input.targetId]
    if (!faction) {
      return reject('unknown_target', `Unknown faction '${input.targetId}'`)
    }
    if (!openDemandFor(ctx.state, input.targetId)) {
      return reject('no_open_demand', `${faction.label} have not asked for anything.`)
    }
    return OK
  },
  apply: (ctx, input): OwnerActionApplied => {
    const faction = ctx.state.world.factions[input.targetId!]!
    const demand = openDemandFor(ctx.state, faction.id)!

    closeDemand(ctx, demand.id, 'refused')
    bumpFactionTotal(ctx, 'demandsRefused')

    // Refusing to their face costs less than ignoring them — the grievance
    // is smaller than the one `faction_demand_deadline` records for silence.
    // Being straight with people is worth something.
    noteStanding(ctx, {
      factionId: faction.id,
      id: `demand_refused_${demand.id}`,
      kind: 'grievance',
      weight: demand.askCoin > 0 ? 12 : 9,
      readable: `The house told ${faction.label} no about ${demand.readable}.`,
      tags: ['demand', 'refused'],
    })

    // A refusal on top of a bad relationship is what makes them decide it is
    // worth doing something about. The retaliation event is the faction
    // going away to think, with a warning window the player can still use.
    const net = standingNet(ctx.state, faction.id)
    let scheduled = false
    if (net <= -25 || faction.relationship <= 35) {
      scheduled = scheduleRetaliation(ctx, faction.id, {
        provocation: 'grudge',
        source: `${SOURCE}.refuse_faction_demand`,
        readable: `${faction.label} were refused and are deciding what to do about it.`,
      })
    }

    ctx.addHistory({
      category: 'owner_action',
      summary: `The house refused ${faction.label}'s request.`,
      tags: ['owner_action', 'faction', 'demand', 'refused', faction.id],
      relatedActors: [{ kind: 'faction', id: faction.id }],
      relatedSystems: ['ownerActions', 'factions'],
      mechanicalRefs: ['refuse_faction_demand', demand.id],
    })

    return {
      actionId: refuseFactionDemand.id,
      label: `Refused ${faction.label}`,
      targetId: faction.id,
      timeCost: TIME_COST_QUICK,
      effects: [
        'request refused',
        ...(scheduled ? [`${faction.label} are deciding what to do about it`] : []),
      ],
      data: { factionId: faction.id, demandId: demand.id, retaliationScheduled: scheduled },
    }
  },
}

// ---------- appeal_to_faction ----------

/**
 * How likely the appeal is to land, 0..1.
 *
 * Deterministic on state, like every other decision in this arc: the same
 * relationship, trust and grievance always produce the same answer, so a
 * reload cannot re-roll it. The grievance is the weight against you, so the
 * appeal that matters most is the one that is hardest to win — which is the
 * right way round.
 */
export function appealStrength(
  ctx: SimContext,
  factionId: string,
): { score: number; grievanceWeight: number } {
  const faction = ctx.state.world.factions[factionId]
  if (!faction) return { score: 0, grievanceWeight: 0 }
  const net = standingNet(ctx.state, factionId)
  const grievanceWeight = Math.abs(Math.min(0, net))
  const raw =
    faction.relationship / 200 +
    faction.trust / 250 +
    0.2 -
    grievanceWeight / 160 -
    faction.influence / 500
  return {
    score: Math.max(0, Math.min(1, Math.round(raw * 100) / 100)),
    grievanceWeight,
  }
}

const APPEAL_WIN_THRESHOLD = 0.45
const APPEAL_SOFTEN_THRESHOLD = 0.2

const appealToFaction: OwnerActionDefinition = {
  id: 'appeal_to_faction',
  label: 'Appeal to Faction',
  category: 'social',
  tags: ['social', 'faction', 'appeal'],
  effectsPreview: 'Argues a faction out of a move — if they will hear it',
  pressureAffinity: ['faction_anger'],
  targetType: 'faction',
  timeCost: TIME_COST_STANDARD,
  getValidTargets: factionsWithContestableMove,
  canApply: (ctx, input) => {
    if (!input.targetId) {
      return reject('missing_target', 'appeal_to_faction requires targetId')
    }
    const faction = ctx.state.world.factions[input.targetId]
    if (!faction) {
      return reject('unknown_target', `Unknown faction '${input.targetId}'`)
    }
    const stance = contestableStances(ctx.state).find(
      (s) => s.factionId === input.targetId,
    )
    const intent = listFactionIntents(ctx.state).find(
      (i) => i.factionId === input.targetId,
    )
    if (!stance && !intent) {
      return reject('nothing_to_appeal', `${faction.label} have made no move to answer.`)
    }
    if (stance?.contestedOnDay !== undefined) {
      return reject(
        'already_contested',
        `${faction.label} have already heard the house out about this.`,
      )
    }
    return OK
  },
  apply: (ctx, input): OwnerActionApplied => {
    const faction = ctx.state.world.factions[input.targetId!]!
    const stance = contestableStances(ctx.state).find((s) => s.factionId === faction.id)
    const intent = listFactionIntents(ctx.state).find((i) => i.factionId === faction.id)
    const { score, grievanceWeight } = appealStrength(ctx, faction.id)
    const effects: string[] = []
    let outcome: 'withdrawn' | 'softened' | 'refused' = 'refused'

    if (score >= APPEAL_WIN_THRESHOLD) {
      outcome = 'withdrawn'
      if (stance) {
        closeStance(ctx, faction.id, stance.kind, 'end')
        effects.push(`${stance.kind.replace('_', ' ')} called off`)
      }
      if (intent) {
        clearFactionIntent(ctx, faction.id)
        effects.push('announced move withdrawn')
      }
      noteStanding(ctx, {
        factionId: faction.id,
        id: `appeal_heard_${faction.id}`,
        kind: 'favour',
        weight: 8,
        readable: `${faction.label} heard the house out and called it off.`,
        tags: ['appeal', 'heard'],
      })
    } else if (score >= APPEAL_SOFTEN_THRESHOLD && stance) {
      outcome = 'softened'
      const next = closeStance(ctx, faction.id, stance.kind, 'soften')
      effects.push(
        `${stance.kind.replace('_', ' ')} eased to ${next?.strength ?? stance.strength}, ends day ${next?.endsOnDay ?? stance.endsOnDay}`,
      )
    } else {
      effects.push(`${faction.label} would not hear it`)
      // Being argued at while you are already angry is itself an
      // irritation — a small one, so appealing is never a trap, but enough
      // that spamming it is not free.
      noteStanding(ctx, {
        factionId: faction.id,
        id: `appeal_rebuffed_${faction.id}`,
        kind: 'grievance',
        weight: 3,
        readable: `${faction.label} did not want to be talked at about it.`,
        tags: ['appeal', 'rebuffed'],
      })
    }

    if (outcome !== 'refused') bumpFactionTotal(ctx, 'stancesContested')

    ctx.addHistory({
      category: 'owner_action',
      summary: `The house appealed to ${faction.label} — ${outcome}.`,
      tags: ['owner_action', 'faction', 'appeal', outcome, faction.id],
      relatedActors: [{ kind: 'faction', id: faction.id }],
      relatedSystems: ['ownerActions', 'factions'],
      mechanicalRefs: ['appeal_to_faction', faction.id],
    })

    return {
      actionId: appealToFaction.id,
      label: `Appealed to ${faction.label}`,
      targetId: faction.id,
      timeCost: TIME_COST_STANDARD,
      effects,
      data: { factionId: faction.id, outcome, score, grievanceWeight },
    }
  },
}

// ---------- repay_faction_favour ----------

const repayFactionFavour: OwnerActionDefinition = {
  id: 'repay_faction_favour',
  label: 'Repay Faction Favour',
  category: 'social',
  tags: ['social', 'faction', 'favour'],
  effectsPreview: 'Settles a sponsorship before it is called in',
  pressureAffinity: ['faction_anger'],
  targetType: 'faction',
  timeCost: TIME_COST_SHORT,
  getValidTargets: factionsOwedAFavour,
  canApply: (ctx, input) => {
    if (!input.targetId) {
      return reject('missing_target', 'repay_faction_favour requires targetId')
    }
    const faction = ctx.state.world.factions[input.targetId]
    if (!faction) {
      return reject('unknown_target', `Unknown faction '${input.targetId}'`)
    }
    const favour = owedFavourFor(ctx.state, input.targetId)
    if (!favour) {
      return reject('nothing_owed', `The house owes ${faction.label} nothing.`)
    }
    if (favour.grantedValue > ctx.state.coin) {
      return reject(
        'insufficient_coin',
        `${favour.grantedValue} coin needed, ${ctx.state.coin} in the till.`,
      )
    }
    return OK
  },
  apply: (ctx, input): OwnerActionApplied => {
    const faction = ctx.state.world.factions[input.targetId!]!
    const favour = owedFavourFor(ctx.state, faction.id)!
    const today = ctx.state.calendar.totalDaysElapsed

    spendCoin(ctx, favour.grantedValue, {
      category: 'other',
      source: `${SOURCE}.repay_faction_favour`,
      sourceType: 'owner_action',
      target: 'coin',
      targetType: 'coin',
      amount: -favour.grantedValue,
      readable: `Paid ${faction.label} back the ${favour.grantedValue} coin they put in.`,
      tags: ['owner_action', 'faction', 'favour', faction.id],
      relatedActors: [{ kind: 'faction', id: faction.id }],
      relatedSystems: ['factions', 'economy'],
    })

    writeFactionSlice(
      ctx,
      (current) => {
        const live = current.favours[favour.id]
        if (!live) return current
        return {
          ...current,
          favours: {
            ...current.favours,
            [favour.id]: { ...live, status: 'repaid', closedOnDay: today },
          },
        }
      },
      'favour_repaid',
    )
    bumpFactionTotal(ctx, 'favoursRepaid')

    noteStanding(ctx, {
      factionId: faction.id,
      id: `favour_repaid_${favour.id}`,
      kind: 'favour',
      weight: Math.min(30, 10 + Math.round(favour.grantedValue / 8)),
      readable: `The house settled up with ${faction.label} without being asked.`,
      tags: ['favour', 'repaid'],
    })

    ctx.addHistory({
      category: 'owner_action',
      summary: `The house repaid ${faction.label}'s favour.`,
      tags: ['owner_action', 'faction', 'favour', faction.id],
      relatedActors: [{ kind: 'faction', id: faction.id }],
      relatedSystems: ['ownerActions', 'factions'],
      mechanicalRefs: ['repay_faction_favour', favour.id],
    })

    return {
      actionId: repayFactionFavour.id,
      label: `Repaid ${faction.label}`,
      targetId: faction.id,
      timeCost: TIME_COST_SHORT,
      effects: [`coin -${favour.grantedValue}`, 'favour settled'],
      data: { factionId: faction.id, favourId: favour.id, paid: favour.grantedValue },
    }
  },
}

export const FACTION_ACTIONS: OwnerActionDefinition[] = [
  grantFactionDemand,
  refuseFactionDemand,
  appealToFaction,
  repayFactionFavour,
]

export {
  grantFactionDemand,
  refuseFactionDemand,
  appealToFaction,
  repayFactionFavour,
}
