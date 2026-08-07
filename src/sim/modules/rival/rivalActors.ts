import type { SimContext } from '../../core/context'
import type {
  CustomerGroupState,
  EntityRef,
  SocialRumourState,
  TavernState,
} from '../../state/TavernState'
import {
  decideActorAction,
  declareActorIntent,
  orderActorState,
  performActorAction,
  type ActorActionDefinition,
  type ActorGoal,
  type ActorPerception,
  type ActorState,
} from '../../contracts/actors/index'
import { openStance } from '../factions/stances'
import { activeStances } from '../factions/factionState'
import { correctRumour } from '../rumours/belief'
import { getEconomyModuleState } from '../economy/state'

import {
  competitorStandings,
  houseAppealForGroup,
  rivalAppealForGroup,
} from './appeal'
import {
  PRIMARY_RIVAL_ID,
  RIVAL_GOALS,
  bumpRivalTotal,
  createRivalRecord,
  getRivalModuleState,
  liveSetbacks,
  pickRivalName,
  recordRivalMove,
  recordedRivalAppeal,
  recordedRivalPosition,
  rivalCapabilityFromRecordedAppeal,
  setbackDrag,
  rivalRef,
  underTruce,
  writeRivalSlice,
} from './rivalState'
import type { RivalMarketPosition, RivalRecord } from './types'

// Expansion Phase 9 §9.1 — the rival decides, announces, and acts.
//
// WHY THROUGH THE SHARED ACTOR CONTRACT (Phase 1 §1.6). Factions were the
// second consumer; the rival is the third, and it earns the contract's keep
// for the same two reasons. Commitment windows stop the rival choosing a
// position, hiring a cook, cutting its prices and starting a rumour on the
// same evening — a competitor that does four things a night is noise. And
// visible intent is what makes the whole system fair: the rival announces
// two days before it moves, which is exactly long enough for
// `scout_the_competition`, `win_back_group`, `poach_rival_staff` or
// `settle_with_rival` to be on the board while it still matters.
//
// PURSE IS THE RESOURCE, BUDGET IS THE TEMPO. The actor budget says how
// OFTEN they can move (two moves a week, three when they are winning); the
// purse says what they can AFFORD when they do. A rival losing money cannot
// buy a cook, which is why poaching its staff and then leaving it to stew is
// a real strategy rather than a delay.
//
// NOTHING HERE POKES A METER ON THE HOUSE. Every move changes the RIVAL —
// its position, its capability, its courting, its backing, its talk — and
// the house feels it through `appeal.ts`, where the two houses are actually
// compared. That is the §5 rule about systems whose only consequence is a
// direct meter adjustment, honoured by construction: there is no line in
// this file that moves a customer group's meters at all.

const SOURCE = 'rival.actors'

/** Days between the rival deciding and it acting. Two, as with factions. */
export const RIVAL_INTENT_LEAD_DAYS = 2

/** Days a courting campaign takes to fade if it is not pushed again. */
export const COURTING_DECAY_PER_DAY = 3

/** How much worse an unaddressed trouble gets each week. */
export const SETBACK_WEEKLY_WORSENING = 4

/**
 * How bad an unaddressed trouble can get.
 *
 * Compounding without a ceiling would make a single poached cook a
 * permanent condition rather than a problem: the worsening would outrun any
 * cadence of recovery moves the rival can afford, and `recover_setback`
 * would only ever be partial. The ceiling is what makes digging out
 * possible for a house that keeps working at it, and still leaves ignoring
 * it expensive.
 */
export const MAX_WORSENED_SEVERITY = 70

type RivalTarget = EntityRef

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Math.round(value * 100) / 100))
}

function clamp100(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

// ---------------------------------------------------------------------------
// What the rival can see
// ---------------------------------------------------------------------------

/**
 * The group the house is serving worst, by evidence the SIMULATION produced.
 *
 * Not "the group with the lowest meter": a group counts as failed when its
 * satisfaction has actually fallen away, or when its regulars have strung
 * together bad visits. Both are outcomes of service that was actually run,
 * which is what stops `exploit_weakness` firing on day one against a group
 * nobody has served yet.
 */
export function worstServedGroup(
  state: TavernState,
): { group: CustomerGroupState; evidence: string } | undefined {
  let worst: { group: CustomerGroupState; evidence: string; score: number } | undefined
  for (const groupId of Object.keys(state.customerGroups).sort()) {
    const group = state.customerGroups[groupId]!
    const badRegulars = Object.values(state.world.regulars).filter(
      (regular) =>
        regular.customerGroupId === group.id && (regular.consecutiveBadVisits ?? 0) >= 2,
    )
    // A crowd that does not come cannot have been failed. The niche groups
    // sit at `patronage: 0` until culinary renown activates them, and their
    // satisfaction drifts like anybody else's — so without this gate the
    // rival would "poach" a clientele that has never once walked in.
    const satisfactionFailure = group.patronage >= 10 && group.satisfaction <= 40
    if (!satisfactionFailure && badRegulars.length === 0) continue
    const score =
      (satisfactionFailure ? 50 - group.satisfaction : 0) + badRegulars.length * 12
    if (worst && score <= worst.score) continue
    worst = {
      group,
      score,
      evidence: satisfactionFailure
        ? `${group.label} satisfaction has fallen to ${group.satisfaction}`
        : `${badRegulars.length} of the ${group.label} regulars have had a run of bad nights`,
    }
  }
  return worst ? { group: worst.group, evidence: worst.evidence } : undefined
}

/** A live rumour that damages the RIVAL and has not been put right yet. */
export function rumourAgainstRival(
  state: TavernState,
  rival: RivalRecord,
): SocialRumourState | undefined {
  return Object.values(state.world.socialRumours)
    .filter(
      (rumour) =>
        rumour.correctedOnDay === undefined &&
        rumour.strength > 10 &&
        (rumour.subject?.id === rival.id ||
          rumour.targetEntityId === rival.id ||
          (rumour.involvedRefs ?? []).some((ref) => ref.id === rival.id)),
    )
    .sort((a, b) => b.strength - a.strength || a.id.localeCompare(b.id))[0]
}

/**
 * A failing of the house that is public enough to talk about.
 *
 * The rival does not invent stories out of nothing — the core design rule
 * applies to it as much as to a card. It repeats something the simulation
 * already understands, which is why the accuracy of what it puts about is
 * `partial` rather than `false`: the grain of truth is real, the telling is
 * theirs.
 */
export function housesWorstFailing(
  state: TavernState,
): { id: string; readable: string; value: number } | undefined {
  const candidates: Array<{ id: string; readable: string; value: number }> = []
  for (const [pressureId, pressure] of Object.entries(state.pressures)) {
    if (pressure.value < 45) continue
    if (pressureId === 'rival_tavern_pressure') continue
    candidates.push({
      id: pressureId,
      readable: `talk about ${pressureId.replace(/_/g, ' ')} at the other house`,
      value: pressure.value,
    })
  }
  if (state.reputation.filthy >= 55) {
    candidates.push({
      id: 'filthy',
      readable: 'talk about the state of the place',
      value: state.reputation.filthy,
    })
  }
  if (state.reputation.dangerous >= 55) {
    candidates.push({
      id: 'dangerous',
      readable: 'talk about who drinks there and what happens to them',
      value: state.reputation.dangerous,
    })
  }
  return candidates.sort(
    (a, b) => b.value - a.value || a.id.localeCompare(b.id),
  )[0]
}

/**
 * What the rival wants right now, weighted 0..1.
 *
 * Traceable to live state on both sides of the road: how the head-to-head
 * is actually going, whether the house has left an opening, what the rival
 * has coming in, and what is currently going wrong for it.
 */
export function deriveRivalGoals(
  state: TavernState,
  rival: RivalRecord,
): ActorGoal[] {
  const standings = competitorStandings(state)
  const meanAdvantage =
    standings.length > 0
      ? standings.reduce((sum, standing) => sum + standing.advantage, 0) /
        standings.length
      : 0
  const behind = meanAdvantage < 0
  const weakness = worstServedGroup(state)
  const setbacks = liveSetbacks(rival)
  const today = state.calendar.totalDaysElapsed

  const tradeWeight = clamp01(
    0.35 + (behind ? 0.25 : 0) + (rival.position === 'unknown' ? 0.2 : 0),
  )
  const exploitWeight = clamp01(
    (weakness ? 0.4 : 0) +
      (weakness && meanAdvantage > 0 ? 0.2 : 0) +
      (state.reputation.reliable <= 35 ? 0.12 : 0),
  )
  const standingWeight = clamp01(
    0.2 + (rival.capability.reach < 45 ? 0.2 : 0) + (meanAdvantage > 0.1 ? 0.15 : 0),
  )
  // A house with something actually wrong with it wants that fixed, and
  // wants it more than it wants a marginal gain across the road. Keyed off
  // the WORST setback rather than a sum, so two small troubles do not add up
  // to a crisis.
  const orderWeight = clamp01(
    setbacks.length === 0 ? 0 : 0.3 + (setbacks[0]!.severity ?? 0) / 90,
  )
  // A pact does not merely block hostile moves: while it holds, keeping it
  // is something the rival actually wants, so it spends its moves on its
  // own house instead of standing idle.
  const peaceWeight = underTruce(rival, today) ? 0.9 : 0

  return [
    {
      id: RIVAL_GOALS.WIN_THE_TRADE,
      weight: tradeWeight,
      readable: 'Take the trade off them.',
    },
    {
      id: RIVAL_GOALS.EXPLOIT_WEAKNESS,
      weight: peaceWeight > 0 ? 0 : exploitWeight,
      readable: 'Hit them where it is already broken.',
    },
    {
      id: RIVAL_GOALS.BUILD_STANDING,
      weight: standingWeight,
      readable: 'Be the house people name.',
    },
    {
      id: RIVAL_GOALS.PUT_OUR_HOUSE_IN_ORDER,
      weight: orderWeight,
      readable: 'Get our own house in order.',
    },
    {
      id: RIVAL_GOALS.KEEP_THE_PEACE,
      weight: peaceWeight,
      readable: 'Keep to the arrangement.',
    },
  ]
}

export function buildRivalPerception(
  state: TavernState,
  rival: RivalRecord,
): ActorPerception {
  const standings = competitorStandings(state)
  const meanAdvantage =
    standings.length > 0
      ? standings.reduce((sum, standing) => sum + standing.advantage, 0) /
        standings.length
      : 0
  const weakness = worstServedGroup(state)
  const failing = housesWorstFailing(state)
  const setbacks = liveSetbacks(rival)
  const today = state.calendar.totalDaysElapsed

  const visibleTargets: EntityRef[] = [
    rivalRef(rival.id),
    ...Object.keys(state.customerGroups)
      .sort()
      .map((id) => ({ kind: 'customer_group' as const, id })),
    ...Object.keys(state.world.factions)
      .sort()
      .map((id) => ({ kind: 'faction' as const, id })),
  ]

  return {
    readings: {
      meanAdvantage: Math.round(meanAdvantage * 100),
      purse: rival.purse,
      staffing: rival.capability.staffing,
      quality: rival.capability.quality,
      priceLevel: rival.capability.priceLevel,
      reach: rival.capability.reach,
      hasPosition: rival.position === 'unknown' ? 0 : 1,
      positionAgeDays: today - rival.positionSinceDay,
      houseWeakness: weakness ? 1 : 0,
      housePublicFailing: failing ? failing.value : 0,
      liveSetbacks: setbacks.length,
      worstSetback: setbacks[0]?.severity ?? 0,
      backers: rival.backingFactionIds.length,
      underTruce: underTruce(rival, today) ? 1 : 0,
      houseInDistress:
        getEconomyModuleState(state).financial.status === 'stable' ? 0 : 1,
      rumourAgainstUs: rumourAgainstRival(state, rival) ? 1 : 0,
    },
    beliefs: {
      ...(weakness ? { houseWeakness: weakness.evidence } : {}),
      ...(failing ? { housePublicFailing: failing.readable } : {}),
    },
    visibleTargets,
  }
}

// ---------------------------------------------------------------------------
// The action set
// ---------------------------------------------------------------------------

function self(perception: ActorPerception): EntityRef[] {
  const ref = perception.visibleTargets[0]
  return ref ? [ref] : []
}

function actingRival(state: TavernState, ref: EntityRef): RivalRecord | undefined {
  return getRivalModuleState(state).rivals[ref.id]
}

function groupTargets(perception: ActorPerception): EntityRef[] {
  return perception.visibleTargets.filter((ref) => ref.kind === 'customer_group')
}

function costs(rival: RivalRecord | undefined, amount: number): boolean {
  return (rival?.purse ?? 0) >= amount
}

/** Spend from the rival's own purse. Its money, not the tavern's. */
function spendPurse(ctx: SimContext, rivalId: string, amount: number): void {
  writeRivalSlice(
    ctx,
    (current) => {
      const rival = current.rivals[rivalId]
      if (!rival) return current
      return {
        ...current,
        rivals: {
          ...current.rivals,
          [rivalId]: { ...rival, purse: Math.max(0, Math.round(rival.purse - amount)) },
        },
      }
    },
    'purse',
  )
}

function patchCapability(
  ctx: SimContext,
  rivalId: string,
  changes: Partial<RivalRecord['capability']>,
): void {
  writeRivalSlice(
    ctx,
    (current) => {
      const rival = current.rivals[rivalId]
      if (!rival) return current
      const capability = { ...rival.capability }
      for (const [key, value] of Object.entries(changes)) {
        capability[key as keyof RivalRecord['capability']] = clamp100(value as number)
      }
      return { ...current, rivals: { ...current.rivals, [rivalId]: { ...rival, capability } } }
    },
    'capability',
  )
}

/**
 * Which house the rival should be, given the one across the road.
 *
 * A competitor differentiates: it goes where the house is NOT. So the pick
 * is the position whose group fit is worst served by the house today —
 * the largest gap between what a group wants and what it is getting.
 */
export function bestPositionFor(state: TavernState): RivalMarketPosition {
  const options: RivalMarketPosition[] = ['cheap', 'clean', 'rowdy', 'fancy']
  let best: { position: RivalMarketPosition; score: number } | undefined
  for (const position of options) {
    let score = 0
    for (const group of Object.values(state.customerGroups)) {
      // A crowd that does not come is not a market. Weighting by patronage
      // is what stops the read being decided by however many niche groups
      // the registry happens to carry.
      if (group.patronage <= 0) continue
      const want =
        position === 'cheap'
          ? group.priceSensitivity
          : position === 'fancy'
            ? group.wealth
            : position === 'rowdy'
              ? group.rowdiness
              : 100 - group.filthTolerance
      // How badly the house is currently meeting that want, and how much
      // trade there is in meeting it.
      const met = houseAppealForGroup(state, group)
      score += (group.patronage / 100) * (want / 100) * (100 - met)
    }
    if (!best || score > best.score) best = { position, score }
  }
  return best?.position ?? 'cheap'
}

/** 1. Decide what kind of house to be. */
const choosePosition: ActorActionDefinition<RivalTarget> = {
  id: 'choose_position',
  readable: 'settle on what kind of house to be',
  cost: 1,
  cooldownDays: 24,
  commitmentDays: 2,
  servesGoals: [RIVAL_GOALS.WIN_THE_TRADE, RIVAL_GOALS.BUILD_STANDING],
  eligibleTargets: (perception, state) => {
    const ref = self(perception)[0]
    if (!ref) return []
    const rival = actingRival(state, ref)
    if (!rival) return []
    // Repositioning is expensive and slow; a house that just picked one does
    // not pick again until the market has genuinely moved past it.
    if (rival.position !== 'unknown' && bestPositionFor(state) === rival.position) {
      return []
    }
    return [ref]
  },
  score: ({ perception }) => {
    const r = perception.readings
    if ((r['hasPosition'] ?? 0) === 0) return 0.9
    if ((r['positionAgeDays'] ?? 0) < 30) return 0
    return 0.35 + ((r['meanAdvantage'] ?? 0) < 0 ? 0.25 : 0)
  },
  perform: (ctx, { target }) => {
    const rival = actingRival(ctx.state, target)
    if (!rival) return { result: 'failed', readable: 'There is no such house.' }
    const position = bestPositionFor(ctx.state)
    const today = ctx.state.calendar.totalDaysElapsed
    const menuFocus =
      position === 'cheap'
        ? 'rounds'
        : position === 'fancy'
          ? 'food'
          : position === 'rowdy'
            ? 'spectacle'
            : 'comfort'
    writeRivalSlice(
      ctx,
      (current) => {
        const record = current.rivals[rival.id]
        if (!record) return current
        return {
          ...current,
          rivals: {
            ...current.rivals,
            [rival.id]: {
              ...record,
              position,
              positionSinceDay: today,
              menuFocus,
              // Repositioning costs what was built for the old one.
              capability: {
                ...record.capability,
                reach: clamp100(record.capability.reach - (record.position === 'unknown' ? 0 : 10)),
              },
            },
          },
        }
      },
      'position',
    )
    bumpRivalTotal(ctx, 'positionsChosen')
    return {
      result: 'succeeded',
      readable: `${rival.name} has settled into a ${position} house, leading with ${menuFocus}.`,
      learned: { position, position_chosen_on_day: String(today) },
    }
  },
}

/** 2. Hire. */
const recruitStaff: ActorActionDefinition<RivalTarget> = {
  id: 'recruit_staff',
  readable: 'take on more hands',
  cost: 1,
  cooldownDays: 14,
  commitmentDays: 3,
  servesGoals: [RIVAL_GOALS.WIN_THE_TRADE, RIVAL_GOALS.PUT_OUR_HOUSE_IN_ORDER],
  eligibleTargets: (perception, state) => {
    const ref = self(perception)[0]
    if (!ref) return []
    const rival = actingRival(state, ref)
    if (!rival || !costs(rival, 25)) return []
    if (rival.capability.staffing >= 85) return []
    return [ref]
  },
  score: ({ perception }) => {
    const r = perception.readings
    const staffing = r['staffing'] ?? 50
    if (staffing >= 85) return 0
    // Short-handed is urgent; comfortably staffed is a nice-to-have.
    return clamp01(0.2 + (85 - staffing) / 120)
  },
  perform: (ctx, { actor, target }) => {
    const rival = actingRival(ctx.state, target)
    if (!rival) return { result: 'failed', readable: 'There is no such house.' }
    // Wages are cheaper to beat when the house across the road is behind on
    // its own. That is not a poke at the player's staff — it is the rival
    // reading a real fact and paying less for the same hire.
    const houseInDistress = getEconomyModuleState(ctx.state).financial.status !== 'stable'
    const price = houseInDistress ? 18 : 25
    spendPurse(ctx, rival.id, price)
    patchCapability(ctx, rival.id, {
      staffing: rival.capability.staffing + (houseInDistress ? 14 : 10),
    })
    void actor
    return {
      result: 'succeeded',
      readable: houseInDistress
        ? `${rival.name} took on hands cheaply while this house was struggling to pay its own.`
        : `${rival.name} took on more hands.`,
      learned: { hiring_is_cheap: houseInDistress ? 'yes' : 'no' },
    }
  },
}

/** 3. Move on price and menu focus. */
const shiftPrices: ActorActionDefinition<RivalTarget> = {
  id: 'shift_prices',
  readable: 'move on price',
  cost: 1,
  cooldownDays: 10,
  commitmentDays: 1,
  servesGoals: [RIVAL_GOALS.WIN_THE_TRADE, RIVAL_GOALS.EXPLOIT_WEAKNESS],
  eligibleTargets: (perception, state) => {
    const ref = self(perception)[0]
    if (!ref) return []
    const rival = actingRival(state, ref)
    if (!rival) return []
    // Undercutting on an empty purse is how a house closes.
    if (rival.capability.priceLevel <= 25 && rival.purse < 60) return []
    return [ref]
  },
  score: ({ perception }) => {
    const r = perception.readings
    const advantage = (r['meanAdvantage'] ?? 0) / 100
    // Cut when behind, and take the margin back when comfortably ahead.
    if (advantage < -0.02) return clamp01(0.35 + Math.abs(advantage))
    if (advantage > 0.12 && (r['priceLevel'] ?? 50) < 55) return 0.3
    return 0
  },
  perform: (ctx, { target }) => {
    const rival = actingRival(ctx.state, target)
    if (!rival) return { result: 'failed', readable: 'There is no such house.' }
    const standings = competitorStandings(ctx.state)
    const mean =
      standings.length > 0
        ? standings.reduce((sum, s) => sum + s.advantage, 0) / standings.length
        : 0
    const cutting = mean < 0
    const next = clamp100(rival.capability.priceLevel + (cutting ? -12 : 8))
    patchCapability(ctx, rival.id, { priceLevel: next })
    // Undercutting is bought with margin, not with nothing.
    if (cutting) spendPurse(ctx, rival.id, 10)
    bumpRivalTotal(ctx, 'priceShifts')
    return {
      result: 'succeeded',
      readable: cutting
        ? `${rival.name} cut its prices to pull trade across the road.`
        : `${rival.name} put its prices back up now it has the custom.`,
      learned: { price_level: String(next) },
    }
  },
}

/** 4. Work a customer group. */
const courtGroup: ActorActionDefinition<RivalTarget> = {
  id: 'court_group',
  readable: 'court a crowd',
  cost: 1,
  cooldownDays: 7,
  commitmentDays: 2,
  servesGoals: [RIVAL_GOALS.WIN_THE_TRADE, RIVAL_GOALS.BUILD_STANDING],
  eligibleTargets: (perception, state) => {
    const ref = self(perception)[0]
    if (!ref) return []
    const rival = actingRival(state, ref)
    if (!rival || !costs(rival, 12)) return []
    return groupTargets(perception).filter(
      (group) => (rival.courting[group.id]?.effort ?? 0) < 70,
    )
  },
  score: ({ target, state }) => {
    const group = state.customerGroups[target.id]
    if (!group) return 0
    const rival = getRivalModuleState(state).rivals[PRIMARY_RIVAL_ID]
    if (!rival) return 0
    // Work the crowd this house is closest to losing, and that is worth
    // having: a big, disloyal group beats a small, devoted one.
    const gap = rivalAppealForGroup(state, rival, group) - houseAppealForGroup(state, group)
    const worth = group.patronage / 100
    return clamp01(0.15 + worth * 0.35 + Math.max(0, gap) / 120 + (100 - group.loyalty) / 400)
  },
  perform: (ctx, { target }) => {
    const rival = getRivalModuleState(ctx.state).rivals[PRIMARY_RIVAL_ID]
    const group = ctx.state.customerGroups[target.id]
    if (!rival || !group) return { result: 'failed', readable: 'Nobody to court.' }
    const today = ctx.state.calendar.totalDaysElapsed
    spendPurse(ctx, rival.id, 12)
    const existing = rival.courting[group.id]
    writeRivalSlice(
      ctx,
      (current) => {
        const record = current.rivals[rival.id]
        if (!record) return current
        return {
          ...current,
          rivals: {
            ...current.rivals,
            [rival.id]: {
              ...record,
              courting: {
                ...record.courting,
                [group.id]: {
                  groupId: group.id,
                  effort: clamp100((existing?.effort ?? 0) + 25),
                  startedOnDay: existing?.startedOnDay ?? today,
                  lastPushedDay: today,
                  poaching: existing?.poaching ?? false,
                  reason: `${record.name} are working the ${group.label}.`,
                },
              },
            },
          },
        }
      },
      'courting',
    )
    bumpRivalTotal(ctx, 'groupsCourted')
    return {
      result: 'succeeded',
      readable: `${rival.name} is working the ${group.label} — free rounds, a word with the right people.`,
      learned: { courting: group.id },
    }
  },
}

/** 5. Get somebody influential on side. */
const seekFactionBacking: ActorActionDefinition<RivalTarget> = {
  id: 'seek_faction_backing',
  readable: 'get a faction on side',
  cost: 2,
  cooldownDays: 20,
  commitmentDays: 3,
  servesGoals: [RIVAL_GOALS.BUILD_STANDING, RIVAL_GOALS.EXPLOIT_WEAKNESS],
  eligibleTargets: (perception, state) => {
    const ref = self(perception)[0]
    if (!ref) return []
    const rival = actingRival(state, ref)
    if (!rival || !costs(rival, 30)) return []
    // A faction only backs the competition if it has a reason to: the house
    // has to have actually lost it. Buying a friendly faction is not on the
    // menu, which is what keeps this a consequence rather than a purchase.
    return perception.visibleTargets.filter((candidate) => {
      if (candidate.kind !== 'faction') return false
      const faction = state.world.factions[candidate.id]
      if (!faction) return false
      if (rival.backingFactionIds.includes(candidate.id)) return false
      return faction.relationship <= 40 && faction.influence >= 30
    })
  },
  score: ({ target, state }) => {
    const faction = state.world.factions[target.id]
    if (!faction) return 0
    return clamp01(0.2 + (50 - faction.relationship) / 120 + faction.influence / 300)
  },
  perform: (ctx, { target }) => {
    const rival = getRivalModuleState(ctx.state).rivals[PRIMARY_RIVAL_ID]
    const faction = ctx.state.world.factions[target.id]
    if (!rival || !faction) return { result: 'failed', readable: 'Nobody would hear them.' }
    spendPurse(ctx, rival.id, 30)
    const stance = openStance(ctx, {
      factionId: faction.id,
      kind: 'rival_backing',
      strength: Math.min(85, 30 + (50 - faction.relationship)),
      reason: `${rival.name} came to ${faction.label} while this house had nothing to say to them.`,
      goalId: RIVAL_GOALS.BUILD_STANDING,
    })
    if (!stance) {
      return { result: 'failed', readable: `${faction.label} would not hear them out.` }
    }
    writeRivalSlice(
      ctx,
      (current) => {
        const record = current.rivals[rival.id]
        if (!record) return current
        return {
          ...current,
          rivals: {
            ...current.rivals,
            [rival.id]: {
              ...record,
              backingFactionIds: [
                ...new Set([...record.backingFactionIds, faction.id]),
              ].sort(),
            },
          },
        }
      },
      'backing',
    )
    bumpRivalTotal(ctx, 'backingsSought')
    return {
      result: 'succeeded',
      readable: `${faction.label} have thrown in behind ${rival.name}.`,
      learned: { backer: faction.id },
    }
  },
}

/** 6. Put a word about. */
const spreadRumour: ActorActionDefinition<RivalTarget> = {
  id: 'spread_rumour',
  readable: 'put a word about this house',
  cost: 1,
  cooldownDays: 12,
  commitmentDays: 2,
  servesGoals: [RIVAL_GOALS.EXPLOIT_WEAKNESS],
  eligibleTargets: (perception, state) => {
    const ref = self(perception)[0]
    if (!ref) return []
    const rival = actingRival(state, ref)
    if (!rival) return []
    // Nothing to repeat means nothing to say. The core design rule binds the
    // rival too: it escalates a failing the simulation already has, it does
    // not invent one.
    if (!housesWorstFailing(state)) return []
    return [ref]
  },
  score: ({ perception }) => {
    const failing = perception.readings['housePublicFailing'] ?? 0
    if (failing <= 0) return 0
    return clamp01(0.2 + failing / 200)
  },
  perform: (ctx, { target }) => {
    const rival = actingRival(ctx.state, target)
    const failing = housesWorstFailing(ctx.state)
    if (!rival || !failing) return { result: 'failed', readable: 'Nothing to repeat.' }
    const today = ctx.state.calendar.totalDaysElapsed
    const rumourId = `rival_word_${failing.id}`
    const existing = ctx.state.world.socialRumours[rumourId]
    if (existing) {
      ctx.modifySocialRumour(
        rumourId,
        {
          strength: Math.min(100, existing.strength + 12),
          lastSpreadDay: today,
        },
        {
          source: `${SOURCE}.rumour_pushed`,
          sourceType: 'system',
          target: rumourId,
          targetType: 'rumour',
          amount: 12,
          readable: `${rival.name} kept the word going.`,
          tags: ['rival', 'rumour', 'competition'],
          relatedSystems: ['rumours', 'rival'],
        },
      )
    } else {
      const rumour: SocialRumourState = {
        id: rumourId,
        label: `${rival.name} are making sure everybody hears the ${failing.readable}.`,
        strength: Math.min(60, 25 + Math.round(failing.value / 4)),
        // PARTIAL, not false: the failing is real, the telling is theirs.
        accuracy: 'partial',
        firstHeardDay: today,
        lastSpreadDay: today,
        tags: ['rival', 'competition', 'rumour'],
        reach: 'public',
        originRef: rivalRef(rival.id),
        involvedRefs: [rivalRef(rival.id)],
      }
      ctx.addSocialRumour(rumour, {
        source: `${SOURCE}.rumour_started`,
        sourceType: 'system',
        target: rumourId,
        targetType: 'rumour',
        amount: rumour.strength,
        readable: `${rival.name} started a word about this house.`,
        tags: ['rival', 'rumour', 'competition'],
        relatedActors: [rivalRef(rival.id)],
        relatedSystems: ['rumours', 'rival'],
      })
    }
    patchCapability(ctx, rival.id, { reach: rival.capability.reach + 6 })
    bumpRivalTotal(ctx, 'rumoursSpread')
    return {
      result: 'succeeded',
      readable: `${rival.name} made sure everybody heard about the ${failing.readable}.`,
      learned: { last_word_about: failing.id },
    }
  },
}

/** 7. Answer what is being said about them. */
const answerRumour: ActorActionDefinition<RivalTarget> = {
  id: 'answer_rumour',
  readable: 'answer what is being said about them',
  cost: 1,
  cooldownDays: 10,
  commitmentDays: 2,
  servesGoals: [RIVAL_GOALS.PUT_OUR_HOUSE_IN_ORDER, RIVAL_GOALS.BUILD_STANDING],
  eligibleTargets: (perception, state) => {
    const ref = self(perception)[0]
    if (!ref) return []
    const rival = actingRival(state, ref)
    if (!rival) return []
    return rumourAgainstRival(state, rival) ? [ref] : []
  },
  score: ({ perception }) => ((perception.readings['rumourAgainstUs'] ?? 0) > 0 ? 0.5 : 0),
  perform: (ctx, { target }) => {
    const rival = actingRival(ctx.state, target)
    if (!rival) return { result: 'failed', readable: 'There is no such house.' }
    const rumour = rumourAgainstRival(ctx.state, rival)
    if (!rumour) return { result: 'failed', readable: 'Nothing left to answer.' }
    // A house can only talk down what is not true. A true word about them
    // stands, and answering it is what makes it louder.
    if (rumour.accuracy === 'true') {
      patchCapability(ctx, rival.id, { reach: rival.capability.reach - 4 })
      return {
        result: 'failed',
        readable: `${rival.name} denied something that turned out to be so, and made it worse.`,
        learned: { denied_a_true_word: rumour.id },
      }
    }
    const corrected = correctRumour(
      ctx,
      rumour.id,
      `${rival.name} put the story straight.`,
    )
    bumpRivalTotal(ctx, 'rumoursAnswered')
    return {
      result: corrected ? 'succeeded' : 'partial',
      readable: corrected
        ? `${rival.name} put straight what was being said about them.`
        : `${rival.name} tried to answer the talk, and it had already moved on.`,
      learned: { answered: rumour.id },
    }
  },
}

/** 8. Go hard at a crowd this house has actually failed. */
const exploitWeakness: ActorActionDefinition<RivalTarget> = {
  id: 'exploit_weakness',
  readable: 'go hard at a crowd this house has let down',
  cost: 2,
  cooldownDays: 16,
  commitmentDays: 3,
  servesGoals: [RIVAL_GOALS.EXPLOIT_WEAKNESS],
  eligibleTargets: (perception, state) => {
    const ref = self(perception)[0]
    if (!ref) return []
    const rival = actingRival(state, ref)
    if (!rival || !costs(rival, 35)) return []
    const weakness = worstServedGroup(state)
    if (!weakness) return []
    return [{ kind: 'customer_group' as const, id: weakness.group.id }]
  },
  score: ({ target, state }) => {
    const weakness = worstServedGroup(state)
    if (!weakness || weakness.group.id !== target.id) return 0
    return clamp01(0.55 + (60 - weakness.group.satisfaction) / 200)
  },
  perform: (ctx, { target }) => {
    const rival = getRivalModuleState(ctx.state).rivals[PRIMARY_RIVAL_ID]
    const weakness = worstServedGroup(ctx.state)
    if (!rival || !weakness || weakness.group.id !== target.id) {
      return { result: 'failed', readable: 'The opening closed before they took it.' }
    }
    const today = ctx.state.calendar.totalDaysElapsed
    spendPurse(ctx, rival.id, 35)
    const existing = rival.courting[weakness.group.id]
    writeRivalSlice(
      ctx,
      (current) => {
        const record = current.rivals[rival.id]
        if (!record) return current
        return {
          ...current,
          rivals: {
            ...current.rivals,
            [rival.id]: {
              ...record,
              courting: {
                ...record.courting,
                [weakness.group.id]: {
                  groupId: weakness.group.id,
                  effort: clamp100((existing?.effort ?? 0) + 45),
                  startedOnDay: existing?.startedOnDay ?? today,
                  lastPushedDay: today,
                  poaching: true,
                  reason: weakness.evidence,
                },
              },
            },
          },
        }
      },
      'poaching',
    )
    bumpRivalTotal(ctx, 'weaknessesExploited')
    return {
      result: 'succeeded',
      readable: `${rival.name} went straight at the ${weakness.group.label} — ${weakness.evidence}.`,
      learned: { poaching: weakness.group.id, because: weakness.evidence },
    }
  },
}

/** 9. Dig out of its own hole. */
const recoverSetback: ActorActionDefinition<RivalTarget> = {
  id: 'recover_setback',
  readable: 'put its own house back in order',
  cost: 1,
  cooldownDays: 5,
  commitmentDays: 2,
  servesGoals: [RIVAL_GOALS.PUT_OUR_HOUSE_IN_ORDER, RIVAL_GOALS.KEEP_THE_PEACE],
  eligibleTargets: (perception, state) => {
    const ref = self(perception)[0]
    if (!ref) return []
    const rival = actingRival(state, ref)
    if (!rival) return []
    return liveSetbacks(rival).length > 0 ? [ref] : []
  },
  score: ({ perception }) => {
    const worst = perception.readings['worstSetback'] ?? 0
    if (worst <= 0) return 0
    return clamp01(0.25 + worst / 130)
  },
  perform: (ctx, { target }) => {
    const rival = actingRival(ctx.state, target)
    if (!rival) return { result: 'failed', readable: 'There is no such house.' }
    const worst = liveSetbacks(rival)[0]
    if (!worst) return { result: 'failed', readable: 'Nothing left to put right.' }
    const today = ctx.state.calendar.totalDaysElapsed
    // Money helps, but time is what actually closes it. A poor house digs
    // out more slowly rather than not at all.
    const canPay = costs(rival, 20)
    if (canPay) spendPurse(ctx, rival.id, 20)
    const repaired = canPay ? 40 : 22
    const nextSeverity = worst.severity - repaired
    writeRivalSlice(
      ctx,
      (current) => {
        const record = current.rivals[rival.id]
        if (!record) return current
        return {
          ...current,
          rivals: {
            ...current.rivals,
            [rival.id]: {
              ...record,
              setbacks: record.setbacks.map((setback) =>
                setback.id !== worst.id
                  ? setback
                  : nextSeverity <= 0
                    ? { ...setback, severity: 0, recoveredOnDay: today }
                    : { ...setback, severity: nextSeverity },
              ),
            },
          },
        }
      },
      'recover',
    )
    if (nextSeverity <= 0) bumpRivalTotal(ctx, 'setbacksRecovered')
    return {
      result: nextSeverity <= 0 ? 'succeeded' : 'partial',
      readable:
        nextSeverity <= 0
          ? `${rival.name} has put right the ${worst.kind.replace(/_/g, ' ')}.`
          : `${rival.name} is still digging out of the ${worst.kind.replace(/_/g, ' ')}.`,
      learned: { recovering: worst.kind },
    }
  },
}

export const RIVAL_ACTOR_ACTION_LIST: ReadonlyArray<
  ActorActionDefinition<RivalTarget>
> = [
  choosePosition,
  recruitStaff,
  shiftPrices,
  courtGroup,
  seekFactionBacking,
  spreadRumour,
  answerRumour,
  exploitWeakness,
  recoverSetback,
]

/**
 * The hostile moves. `rival_retaliation` picks from this list rather than
 * inventing a consequence of its own.
 */
export const HOSTILE_RIVAL_ACTIONS: ReadonlyArray<string> = [
  'exploit_weakness',
  'spread_rumour',
  'court_group',
  'shift_prices',
]

export function rivalActionById(
  actionId: string,
): ActorActionDefinition<RivalTarget> | undefined {
  return RIVAL_ACTOR_ACTION_LIST.find((action) => action.id === actionId)
}

// ---------------------------------------------------------------------------
// The daily pass
// ---------------------------------------------------------------------------

/** How much the rival's trade brings in each week, from how it is doing. */
export function weeklyTakeFor(state: TavernState, rival: RivalRecord): number {
  const standings = competitorStandings(state)
  const mean =
    standings.length > 0
      ? standings.reduce((sum, s) => sum + s.advantage, 0) / standings.length
      : 0
  const priceMargin = rival.capability.priceLevel / 50
  return Math.max(
    6,
    Math.round((30 + mean * 60) * priceMargin * (1 - setbackDrag(rival))),
  )
}

/** Moves a week the rival can make, from how the competition is going. */
export function weeklyBudgetForRival(state: TavernState, rival: RivalRecord): number {
  const standings = competitorStandings(state)
  const mean =
    standings.length > 0
      ? standings.reduce((sum, s) => sum + s.advantage, 0) / standings.length
      : 0
  return mean > 0.1 ? 3 : mean < -0.15 ? 1 : 2
}

/** Ensure the world has a rival, generating its name once (rule 8). */
export function ensureRival(ctx: SimContext): RivalRecord {
  const existing = getRivalModuleState(ctx.state).rivals[PRIMARY_RIVAL_ID]
  if (existing) return existing
  const today = ctx.state.calendar.totalDaysElapsed
  // A save written before this phase has already been living with a rival —
  // an appeal and a strategy in the monthly slice. Open the record at the
  // standing the save recorded rather than as an unknown newcomer; on a
  // brand-new game those readers return the pre-Phase-9 neutral, which is
  // exactly `BASELINE_CAPABILITY`.
  const recordedAppeal = recordedRivalAppeal(ctx.state)
  const record = createRivalRecord({
    id: PRIMARY_RIVAL_ID,
    name: pickRivalName(ctx, PRIMARY_RIVAL_ID),
    today,
    position: recordedRivalPosition(ctx.state),
    capability: rivalCapabilityFromRecordedAppeal(recordedAppeal),
  })
  writeRivalSlice(
    ctx,
    (current) => ({
      ...current,
      rivals: { ...current.rivals, [PRIMARY_RIVAL_ID]: record },
    }),
    'open_rival',
  )
  ctx.addLog(
    {
      message: `There is another house across the road: ${record.name}.`,
      level: 'info',
      data: { rivalId: record.id },
    },
    'rival',
  )
  return record
}

/**
 * Courting fades if it is not renewed, and the rival's takings come in.
 *
 * Both are here rather than inside an action because both happen whether or
 * not the rival moves — a campaign nobody is pushing dies of its own accord,
 * which is what makes `win_back_group` worth playing and what stops the
 * rival accumulating permanent claims on every crowd in town.
 */
function tickRivalUpkeep(ctx: SimContext, rival: RivalRecord): void {
  const today = ctx.state.calendar.totalDaysElapsed
  const weekly = ctx.state.calendar.dayOfWeek === 1
  const take = weekly ? weeklyTakeFor(ctx.state, rival) : 0
  // A trouble nobody deals with compounds. This is what makes
  // `recover_setback` a move the rival actually has to spend a turn on
  // rather than a tidy-up it can put off forever while it works the
  // customers — and it is what makes poaching their staff and then leaving
  // them to stew a real strategy for the player, because the hole gets
  // deeper for as long as they are busy elsewhere.
  const worsened = weekly
    ? rival.setbacks.map((setback) =>
        setback.recoveredOnDay === undefined
          ? {
              ...setback,
              severity: Math.min(
                MAX_WORSENED_SEVERITY,
                Math.max(setback.severity, setback.severity + SETBACK_WEEKLY_WORSENING),
              ),
            }
          : setback,
      )
    : rival.setbacks
  const decayed: RivalRecord['courting'] = {}
  let changed = weekly
  for (const [groupId, entry] of Object.entries(rival.courting)) {
    if (entry.lastPushedDay === today) {
      decayed[groupId] = entry
      continue
    }
    const effort = Math.max(0, entry.effort - COURTING_DECAY_PER_DAY)
    if (effort !== entry.effort) changed = true
    decayed[groupId] = { ...entry, effort }
  }
  if (!changed) return
  writeRivalSlice(
    ctx,
    (current) => {
      const record = current.rivals[rival.id]
      if (!record) return current
      return {
        ...current,
        rivals: {
          ...current.rivals,
          [rival.id]: {
            ...record,
            courting: decayed,
            setbacks: weekly ? worsened : record.setbacks,
            purse: Math.max(0, Math.round(record.purse + take)),
          },
        },
      }
    },
    'upkeep',
  )
}

/**
 * Faction backing is the faction's to give and to withdraw. Mirror it.
 *
 * The stance lives in the factions slice and stays there — this is a
 * read-through so the rival's own record can name its backers without the
 * two drifting. A faction that lets its stance lapse withdraws its backing
 * here on the same day, which the player can earn by winning that faction
 * back rather than by doing anything to the rival.
 */
function syncBacking(ctx: SimContext, rival: RivalRecord): void {
  const backing = activeStances(ctx.state)
    .filter((stance) => stance.kind === 'rival_backing')
    .map((stance) => stance.factionId)
    .sort()
  const same =
    backing.length === rival.backingFactionIds.length &&
    backing.every((id, index) => id === rival.backingFactionIds[index])
  if (same) return
  const lost = rival.backingFactionIds.filter((id) => !backing.includes(id))
  writeRivalSlice(
    ctx,
    (current) => {
      const record = current.rivals[rival.id]
      if (!record) return current
      return {
        ...current,
        rivals: { ...current.rivals, [rival.id]: { ...record, backingFactionIds: backing } },
      }
    },
    'backing_sync',
  )
  if (lost.length > 0) {
    ctx.addLog(
      {
        message: `${rival.name} lost the backing of ${lost.join(', ')}.`,
        level: 'info',
        data: { rivalId: rival.id, lost },
      },
      'rival',
    )
  }
}

/**
 * Decide, announce, and carry out.
 *
 * Runs at `localEventUpdate`, which sits after the faction and rumour passes
 * (so backing given this morning is already on the books) and before
 * `forecastTraffic` (so a crowd courted today is felt in tonight's turnout
 * rather than tomorrow's). The two-day intent lead is the counterplay
 * window, exactly as it is for factions.
 */
export function runRivalActor(ctx: SimContext): void {
  const today = ctx.state.calendar.totalDaysElapsed
  let rival = ensureRival(ctx)
  syncBacking(ctx, rival)
  rival = getRivalModuleState(ctx.state).rivals[rival.id] ?? rival
  tickRivalUpkeep(ctx, rival)
  rival = getRivalModuleState(ctx.state).rivals[rival.id] ?? rival

  let actor: ActorState = {
    ...rival.actor,
    goals: deriveRivalGoals(ctx.state, rival),
  }

  if (ctx.state.calendar.dayOfWeek === 1) {
    actor = { ...actor, budget: weeklyBudgetForRival(ctx.state, rival) }
  }

  const intent = actor.intent
  if (intent && today - intent.decidedOnDay >= RIVAL_INTENT_LEAD_DAYS) {
    const action = rivalActionById(intent.actionId)
    const target = intent.targetRef
    const perception = buildRivalPerception(ctx.state, rival)
    // Re-check on the day it lands, not the day it was decided: a house that
    // has won its crowd back, settled with them, or fixed the failing they
    // meant to talk about has removed the reason, and the move is dropped.
    const stillEligible =
      action !== undefined &&
      target !== undefined &&
      !underTruce(rival, today) &&
      action
        .eligibleTargets(perception, ctx.state)
        .some((candidate) => candidate.kind === target.kind && candidate.id === target.id) &&
      action.score({
        target,
        goal: actor.goals.find((g) => g.id === intent.goalId) ?? actor.goals[0]!,
        perception,
        state: ctx.state,
      }) > 0

    if (action && target && stillEligible) {
      const performed = performActorAction<RivalTarget>(ctx, {
        actor,
        action,
        target,
        goalId: intent.goalId,
      })
      recordRivalMove(ctx, {
        onDay: today,
        rivalId: rival.id,
        actionId: action.id,
        goalId: intent.goalId,
        ...(target.kind === 'customer_group' || target.kind === 'faction'
          ? { targetId: target.id }
          : {}),
        result: performed.outcome.result,
        readable: performed.outcome.readable,
      })
      ctx.addLog(
        {
          message: performed.outcome.readable,
          level: 'info',
          data: { rivalId: rival.id, actionId: action.id },
        },
        'rival',
      )
      persistRivalActor(ctx, rival.id, performed.actor)
      return
    }
    const { intent: _dropped, ...withoutIntent } = actor
    actor = orderActorState(withoutIntent)
  } else if (intent) {
    // Announced but not yet due. Leave it alone — re-deciding would rewrite
    // `decidedOnDay` and the move would never age into being made.
    persistRivalActor(ctx, rival.id, actor)
    return
  }

  const { decision } = decideActorAction({
    actor,
    perception: buildRivalPerception(ctx.state, rival),
    actions: RIVAL_ACTOR_ACTION_LIST,
    state: ctx.state,
    today,
  })
  if (decision.status === 'decided') {
    const action = rivalActionById(decision.actionId)!
    actor = declareActorIntent(
      actor,
      decision,
      `${rival.name} mean to ${action.readable}.`,
      today,
    )
  } else if (actor.intent) {
    const { intent: _cleared, ...withoutIntent } = actor
    actor = orderActorState(withoutIntent)
  }
  persistRivalActor(ctx, rival.id, actor)
}

/** Write an actor record back to its rival. Exported for the event resolvers. */
export function persistRivalActor(
  ctx: SimContext,
  rivalId: string,
  actor: ActorState,
): void {
  writeRivalSlice(
    ctx,
    (current) => {
      const record = current.rivals[rivalId]
      if (!record) return current
      return {
        ...current,
        rivals: { ...current.rivals, [rivalId]: { ...record, actor: orderActorState(actor) } },
      }
    },
    'rival_actor',
  )
}

/** The rival's announced-but-not-yet-taken move. Read by the report. */
export function rivalIntent(state: {
  modules: Record<string, unknown>
}): { rivalId: string; actionId: string; readable: string; decidedOnDay: number } | undefined {
  for (const rival of Object.values(getRivalModuleState(state).rivals)) {
    const intent = rival.actor.intent
    if (!intent) continue
    return {
      rivalId: rival.id,
      actionId: intent.actionId,
      readable: intent.readable,
      decidedOnDay: intent.decidedOnDay,
    }
  }
  return undefined
}

/** Withdraw an announced move — what settling with them buys. */
export function clearRivalIntent(ctx: SimContext, rivalId: string): void {
  writeRivalSlice(
    ctx,
    (current) => {
      const rival = current.rivals[rivalId]
      if (!rival?.actor.intent) return current
      const { intent: _dropped, ...rest } = rival.actor
      return {
        ...current,
        rivals: {
          ...current.rivals,
          [rivalId]: { ...rival, actor: orderActorState(rest) },
        },
      }
    },
    'clear_intent',
  )
}
