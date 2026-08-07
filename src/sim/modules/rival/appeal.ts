import type { CustomerGroupState, TavernState } from '../../state/TavernState'
import { getFactionRivalBacking } from '../factions/stances'

import {
  activeCourting,
  courtingFor,
  getPrimaryRival,
  setbackDrag,
} from './rivalState'
import type { RivalRecord } from './types'

// Expansion Phase 9 §9.1 — "Customers should be able to choose the rival
// based on actual relative appeal."
//
// The old competitor rule read ONE number — `monthly.rivalTavern.appeal` —
// subtracted a constant from it and scaled the result by how price-sensitive
// and disloyal the group was. Two things were wrong with that, and they are
// the same thing twice: the number was not produced by anything the rival
// had done, and it was the same number for every group. A rival running a
// cheap, loud house is a catastrophe for miners and an irrelevance to
// merchants; one appeal meter cannot say so.
//
// So appeal is DERIVED, per group, on both sides of the comparison:
//
//   `houseAppealForGroup`  — what this group thinks of drinking here, from
//                            its own satisfaction and loyalty, the house's
//                            reputation on the axes this group cares about,
//                            and what the house is charging.
//   `rivalAppealForGroup`  — what the rival has actually built: its
//                            capability, the position it chose, what it
//                            charges, how hard it is courting THIS group,
//                            who is backing it, minus whatever is currently
//                            going wrong for it.
//
// The competitor factor is the gap between them. Everything downstream —
// the customers' own forecast rule, the rival pressure summary, the monthly
// projection — reads this one comparison, so there is exactly one answer to
// "who is winning, and with whom".
//
// PURE, and deliberately so: a report may ask what the rival's pull on the
// miners is without the act of asking changing it.

const HOUSE_BASE = 42
const RIVAL_BASE = 24

/** The most the whole competition may move one group's turnout. */
const MAX_COMPETITOR_SWING = 0.2

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function clamp100(value: number): number {
  return clamp(Math.round(value * 10) / 10, 0, 100)
}

/** The priciest thing actually on offer — the same proxy the forecast uses. */
function houseTopPrice(state: TavernState): number {
  let maxPrice = 0
  for (const item of Object.values(state.stock)) {
    if (item.quantity <= 0) continue
    if (item.salePrice > maxPrice) maxPrice = item.salePrice
  }
  return maxPrice
}

/**
 * What this group thinks of drinking HERE, 0..100.
 *
 * Every term is live state the player has moved by playing: how the group
 * has actually been served, how loyal it has become, what the house is
 * known for on the axes this group weighs, and what it is being charged.
 */
export function houseAppealForGroup(
  state: TavernState,
  group: CustomerGroupState,
): number {
  const rep = state.reputation
  let appeal = HOUSE_BASE

  appeal += (group.satisfaction - 50) * 0.28
  appeal += (group.loyalty - 50) * 0.16

  // Reputation, weighted by what this group can put up with. A filthy room
  // costs nothing with a group that does not mind filth.
  appeal += (rep.cozy - 50) * 0.08
  appeal += (rep.tasty - 50) * 0.08
  appeal += (rep.reliable - 50) * 0.06
  appeal -= ((rep.filthy - 30) * (100 - group.filthTolerance)) / 700
  appeal -= ((rep.dangerous - 30) * (100 - group.dangerTolerance)) / 700

  // Price, on the same proxy the forecast uses, so the two agree.
  const topPrice = houseTopPrice(state)
  if (topPrice > 0) {
    appeal -= ((topPrice - 6) * group.priceSensitivity) / 90
  }

  return clamp100(appeal)
}

/** How well the rival's chosen position suits this particular group. */
export function positionFitForGroup(
  rival: RivalRecord,
  group: CustomerGroupState,
): number {
  switch (rival.position) {
    case 'cheap':
      return (group.priceSensitivity - 45) * 0.16
    case 'fancy':
      return (group.wealth - 45) * 0.16
    case 'rowdy':
      return (group.rowdiness - 45) * 0.16
    case 'clean':
      return ((100 - group.filthTolerance) - 45) * 0.16
    default:
      return 0
  }
}

/**
 * What this group thinks of drinking THERE, 0..100.
 *
 * Nothing here is a meter somebody nudged: every term traces to a move the
 * rival actually made and paid for.
 */
export function rivalAppealForGroup(
  state: TavernState,
  rival: RivalRecord,
  group: CustomerGroupState,
): number {
  let appeal = RIVAL_BASE

  appeal += (rival.capability.quality - 45) * 0.24
  appeal += (rival.capability.staffing - 45) * 0.18
  appeal += rival.capability.reach * 0.12

  appeal += positionFitForGroup(rival, group)

  // What it charges, felt in proportion to how much this group cares.
  appeal += ((50 - rival.capability.priceLevel) * group.priceSensitivity) / 320

  // Courting is the rival spending its purse on THIS group specifically.
  const courting = courtingFor(rival, group.id)
  if (courting) {
    appeal += courting.effort * (courting.poaching ? 0.22 : 0.14)
  }

  // A faction telling its people to drink over there.
  appeal += getFactionRivalBacking(state).appealDelta * 40

  // Whatever is currently going wrong for them.
  appeal -= setbackDrag(rival) * 45

  return clamp100(appeal)
}

export type CompetitorStanding = {
  groupId: string
  houseAppeal: number
  rivalAppeal: number
  /** −1..1. Positive means the rival is winning this group. */
  advantage: number
  courted: boolean
  readable: string
}

/** The head-to-head for one group. */
export function competitorStandingForGroup(
  state: TavernState,
  groupId: string,
): CompetitorStanding | undefined {
  const group = state.customerGroups[groupId]
  if (!group) return undefined
  const rival = getPrimaryRival(state)
  if (!rival) return undefined
  const houseAppeal = houseAppealForGroup(state, group)
  const rivalAppeal = rivalAppealForGroup(state, rival, group)
  const advantage = clamp((rivalAppeal - houseAppeal) / 100, -1, 1)
  const courting = courtingFor(rival, group.id)
  return {
    groupId,
    houseAppeal,
    rivalAppeal,
    advantage: Math.round(advantage * 1000) / 1000,
    courted: courting !== undefined,
    readable:
      advantage > 0.05
        ? `${group.label} rate ${rival.name} above this house (${rivalAppeal} to ${houseAppeal}).`
        : advantage < -0.05
          ? `${group.label} still rate this house above ${rival.name} (${houseAppeal} to ${rivalAppeal}).`
          : `${group.label} are split between this house and ${rival.name}.`,
  }
}

/** Every group's head-to-head, strongest rival advantage first. */
export function competitorStandings(state: TavernState): CompetitorStanding[] {
  const out: CompetitorStanding[] = []
  for (const groupId of Object.keys(state.customerGroups).sort()) {
    const standing = competitorStandingForGroup(state, groupId)
    if (standing) out.push(standing)
  }
  return out.sort(
    (a, b) => b.advantage - a.advantage || a.groupId.localeCompare(b.groupId),
  )
}

/**
 * The traffic multiplier for one group, from the head-to-head.
 *
 * Same shape and same bounds as the rule it replaces (a ±20% swing scaled
 * by how susceptible the group is), so a rival that has done nothing leaves
 * turnout exactly where it was. What changed is where the number comes
 * from: a real comparison rather than one global meter.
 */
export function competitorChoiceFactorForGroup(
  state: TavernState,
  groupId: string,
): number | undefined {
  const standing = competitorStandingForGroup(state, groupId)
  if (!standing) return undefined
  const group = state.customerGroups[groupId]!
  const susceptibility = clamp(
    0.55 + group.priceSensitivity / 200 - group.loyalty / 150,
    0.35,
    1.15,
  )
  const factor = 1 - standing.advantage * MAX_COMPETITOR_SWING * susceptibility
  return Math.round(clamp(factor, 0.75, 1.08) * 100) / 100
}

/** The whole competition in one line. Read by the pressure summary. */
export type CompetitionSummary = {
  rivalId: string
  name: string
  position: RivalRecord['position']
  /** Mean rival advantage across every group, −1..1. */
  meanAdvantage: number
  /** Groups where the rival is ahead. */
  groupsLosing: string[]
  courtedGroupIds: string[]
  liveSetbackCount: number
  underTruce: boolean
}

export function competitionSummary(
  state: TavernState,
): CompetitionSummary | undefined {
  const rival = getPrimaryRival(state)
  if (!rival) return undefined
  const standings = competitorStandings(state)
  if (standings.length === 0) return undefined
  const mean =
    standings.reduce((sum, standing) => sum + standing.advantage, 0) /
    standings.length
  const today = state.calendar.totalDaysElapsed
  return {
    rivalId: rival.id,
    name: rival.name,
    position: rival.position,
    meanAdvantage: Math.round(mean * 1000) / 1000,
    groupsLosing: standings
      .filter((standing) => standing.advantage > 0.05)
      .map((standing) => standing.groupId),
    courtedGroupIds: activeCourting(rival).map((entry) => entry.groupId),
    liveSetbackCount: rival.setbacks.filter(
      (setback) => setback.recoveredOnDay === undefined,
    ).length,
    underTruce: rival.truceUntilDay !== undefined && today <= rival.truceUntilDay,
  }
}
