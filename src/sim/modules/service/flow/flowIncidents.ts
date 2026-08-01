import type { SimContext } from '../../../core/context'
import type { RegularWorldState } from '../../../state/TavernState'
import { recipeRegistry } from '../../../registries/recipeRegistry'
import { getCustomerFacingSeating } from '../../areas/capacity'
import type { ServiceQualityModifiers } from '../../staff/types'
import type { ServiceIncidentSummary } from '../types'
import { getWeaponsPolicySecurityBonus } from '../../economy/policies'

import { SERVICE_WAVES, type ServiceFlowResult, type ServiceParty } from './types'

// Expansion Phase 4 §4.4 — incidents that come out of interactions.
//
// WHAT THE OLD RULE WAS. Four incidents, three of which read a number and one
// of which read a note string: a brawl fired when the DAY TYPE was
// `brawl_night` and the group was rowdy; damage was re-read out of a note the
// customers module had written; a shortage was a shortage; and unpaid tabs
// crossed a threshold. None of them could be caused by anything happening
// between people, because nothing was happening between people.
//
// EVERY TRIGGER BELOW IS A REAL SERVICE STATE. The plan is explicit that
// "authored content can describe the result, but the trigger must be a real
// service state", so each of these reads the flow: who waited, who sat next to
// whom, what was actually carried to a table, and how many hands were on the
// floor. The card layer can dress them; it cannot invent them.

/** Parties held up this long before anyone snapped. */
const IMPATIENCE_WAVES = 2

/** Below this relationship score, two groups should not share a room. */
const HOSTILE_RELATIONSHIP = -20

/** Rowdy patrons in one room before trouble is even possible. */
const MIN_ROWDY_FOR_TROUBLE = 5

/** What an ordinary busy night absorbs without a fight breaking out. */
const BRAWL_BASELINE = 60

export type FlowIncidentInput = {
  flow: ServiceFlowResult
  quality: ServiceQualityModifiers
  regularsById: Record<string, RegularWorldState>
  dayType: string
}

export function generateFlowIncidents(
  ctx: SimContext,
  input: FlowIncidentInput,
): ServiceIncidentSummary[] {
  const incidents: ServiceIncidentSummary[] = []
  if (!input.flow.ran) return incidents

  incidents.push(...impatienceIncidents(input))
  incidents.push(...seatingConflicts(ctx, input))
  incidents.push(...understaffingIncidents(ctx, input))
  incidents.push(...servedDishIncidents(ctx, input))
  incidents.push(...brawlIncidents(ctx, input))
  incidents.push(...blockedCapacityIncidents(ctx, input))
  incidents.push(...shortageIncidents(input))
  incidents.push(...tabIncidents(input))

  // Stable order so the report, the scene builder and the issue pipeline all
  // see the same evening in the same sequence on a replay.
  return incidents.sort((a, b) =>
    a.id === b.id
      ? (a.actorGroup ?? '').localeCompare(b.actorGroup ?? '')
      : a.id.localeCompare(b.id),
  )
}

/** §4.4 "crowding plus slow service can produce impatience". */
function impatienceIncidents(input: FlowIncidentInput): ServiceIncidentSummary[] {
  const out: ServiceIncidentSummary[] = []
  const byGroup = new Map<string, { waited: number; lost: number }>()
  for (const party of input.flow.parties) {
    if (party.wavesWaited < IMPATIENCE_WAVES) continue
    const row = byGroup.get(party.groupId) ?? { waited: 0, lost: 0 }
    row.waited += party.size
    if (party.outcome !== 'served') row.lost += party.size
    byGroup.set(party.groupId, row)
  }
  for (const groupId of [...byGroup.keys()].sort((a, b) => a.localeCompare(b))) {
    const row = byGroup.get(groupId)!
    if (row.lost <= 0) continue
    out.push({
      id: 'impatient_crowd',
      severity: Math.min(100, 20 + row.lost * 4 + row.waited),
      actorGroup: groupId,
      effects: [
        `service.waited ${row.waited}`,
        `service.left_unserved ${row.lost}`,
        `bottleneck ${input.flow.bottleneck?.reason ?? 'unknown'}`,
      ],
    })
  }
  return out
}

/**
 * §4.4 "incompatible parties placed together can produce conflict".
 *
 * Reads `relationshipToOtherGroups`, which has existed on every customer group
 * since Phase 30 and until now decided nothing. Two hostile crowds in the same
 * room at the same time is the interaction; the seating allocation is what
 * created it, and a player with more rooms (or a `privacy_screen`) has a way to
 * avoid it.
 */
function seatingConflicts(
  ctx: SimContext,
  input: FlowIncidentInput,
): ServiceIncidentSummary[] {
  const out: ServiceIncidentSummary[] = []
  const seen = new Set<string>()
  const seatedParties = input.flow.parties.filter(
    (party) => party.areaId && party.seatedWave !== undefined,
  )
  for (const a of seatedParties) {
    for (const b of seatedParties) {
      if (a.groupId >= b.groupId) continue
      if (a.areaId !== b.areaId) continue
      if (!overlapInTime(a, b)) continue
      const key = `${a.areaId}:${a.groupId}:${b.groupId}`
      if (seen.has(key)) continue
      const groupA = ctx.state.customerGroups[a.groupId]
      const groupB = ctx.state.customerGroups[b.groupId]
      if (!groupA || !groupB) continue
      const score = Math.min(
        groupA.relationshipToOtherGroups[b.groupId] ?? 0,
        groupB.relationshipToOtherGroups[a.groupId] ?? 0,
      )
      if (score > HOSTILE_RELATIONSHIP) continue
      seen.add(key)
      // Security on the floor keeps a bad pairing from becoming a scene.
      const damped = Math.max(0, 1 - input.flow.capacity.securityCover / 2)
      const severity = Math.round(
        Math.min(100, (25 + Math.abs(score)) * damped),
      )
      if (severity <= 0) continue
      out.push({
        id: 'seating_conflict',
        severity,
        actorGroup: a.groupId,
        ...(a.areaId ? { areaId: a.areaId } : {}),
        effects: [
          `parties ${a.id}+${b.id}`,
          `groups ${a.groupId}+${b.groupId}`,
          `relationship ${score}`,
          `security ${input.flow.capacity.securityCover}`,
        ],
      })
    }
  }
  return out
}

function overlapInTime(a: ServiceParty, b: ServiceParty): boolean {
  const aStart = a.seatedWave ?? 0
  const aEnd = a.leftWave ?? Number.POSITIVE_INFINITY
  const bStart = b.seatedWave ?? 0
  const bEnd = b.leftWave ?? Number.POSITIVE_INFINITY
  return aStart <= bEnd && bStart <= aEnd
}

/** §4.4 "understaffing can cause errors or unpaid tabs". */
function understaffingIncidents(
  ctx: SimContext,
  input: FlowIncidentInput,
): ServiceIncidentSummary[] {
  const drivers = input.flow.capacity.drivers
  // A floor with nobody on it and a room full of people is the error condition.
  const served = Object.values(input.flow.servedByGroup).reduce(
    (sum, value) => sum + value,
    0,
  )
  if (served <= 0) return []
  if (drivers.service >= 0.75 && drivers.kitchen >= 0.75) return []
  const shortfall = Math.max(0, 1.5 - drivers.service - drivers.kitchen)
  if (shortfall <= 0) return []
  return [
    {
      id: 'understaffed_errors',
      severity: Math.min(100, Math.round(20 + shortfall * 40 + served / 4)),
      effects: [
        `roster.service ${drivers.service}`,
        `roster.kitchen ${drivers.kitchen}`,
        `served ${served}`,
      ],
    },
  ]
}

/**
 * §4.4 "actual recipe service can trigger a taboo or delight".
 *
 * Keyed off what was DELIVERED, not what was on the menu. The taboo case is a
 * culture-level dislike the group itself does not carry — the group ordered it
 * happily, and their culture minds on their behalf, which is exactly the kind
 * of consequence that needs the served dish to be a real record.
 */
function servedDishIncidents(
  ctx: SimContext,
  input: FlowIncidentInput,
): ServiceIncidentSummary[] {
  const out: ServiceIncidentSummary[] = []
  for (const party of input.flow.parties) {
    for (const line of party.order) {
      if (line.delivered <= 0) continue
      const recipe = ctx.state.recipes[line.recipeId]
      if (!recipe) continue
      const group = ctx.state.customerGroups[party.groupId]
      if (!group) continue
      const culture = group.cultureId ? ctx.getCulture(group.cultureId) : undefined
      if (culture && culture.dislikedTags.some((tag) => recipe.tags.includes(tag))) {
        out.push({
          id: 'taboo_served',
          severity: Math.min(100, 30 + line.delivered * 5),
          actorGroup: party.groupId,
          ...(party.areaId ? { areaId: party.areaId } : {}),
          effects: [
            `party ${party.id}`,
            `recipe ${line.recipeId}`,
            `culture ${culture.id}`,
            `servings ${line.delivered}`,
          ],
        })
      }
      const regular = party.regularId ? input.regularsById[party.regularId] : undefined
      if (
        regular &&
        (regular.favoriteRecipeId === line.recipeId ||
          (regular.favoriteStockId !== undefined &&
            recipeRegistry.has(line.recipeId) &&
            recipeRegistry
              .get(line.recipeId)
              .inputs.some((i) => i.ingredientId === regular.favoriteStockId)))
      ) {
        out.push({
          id: 'favourite_served',
          severity: Math.min(100, 10 + line.delivered * 3),
          disposition: 'positive',
          actorGroup: party.groupId,
          ...(party.areaId ? { areaId: party.areaId } : {}),
          effects: [
            `party ${party.id}`,
            `regular ${regular.id}`,
            `recipe ${line.recipeId}`,
          ],
        })
      }
    }
  }
  return out
}

/**
 * §4.4 "security coverage changes escalation".
 *
 * A brawl is no longer a property of the calendar. It needs a rowdy crowd, a
 * room that is actually packed, drink that actually reached them, and nobody
 * on the door — and any one of those the player can change.
 */
function brawlIncidents(
  ctx: SimContext,
  input: FlowIncidentInput,
): ServiceIncidentSummary[] {
  const out: ServiceIncidentSummary[] = []
  for (const areaId of areasWithCrowd(input)) {
    const risk = assessBrawlRisk(ctx, input, areaId)
    if (!risk) continue
    out.push({
      id: 'minor_brawl',
      severity: Math.min(100, risk.severity),
      ...(risk.actorGroup ? { actorGroup: risk.actorGroup } : {}),
      areaId,
      effects: [
        `parties ${risk.partyIds.join('+')}`,
        `rowdy_patrons ${risk.rowdy}`,
        `drinks_served ${risk.drink}`,
        `security ${Math.round(risk.security * 100) / 100}`,
        `${areaId}.damage +1`,
      ],
    })
  }
  return out
}

export type BrawlRiskAssessment = {
  areaId: string
  actorGroup?: string
  rowdy: number
  drink: number
  patrons: number
  peakOccupancy: number
  partyIds: string[]
  packed: number
  security: number
  severity: number
}

/**
 * One authoritative brawl predicate, shared by immediate flow incidents and
 * delayed `brawl_possible` warnings. A delayed warning must still find the
 * genuinely rowdy, crowded, drinking room it warned about; otherwise thinning
 * or calming the room would not be counterplay.
 */
export function assessBrawlRisk(
  ctx: SimContext,
  input: FlowIncidentInput,
  areaId: string,
): BrawlRiskAssessment | undefined {
  const occupants = input.flow.parties.filter(
    (party) => party.areaId === areaId && party.seatedWave !== undefined,
  )
  const seats =
    input.flow.capacity.seatsByArea.find((row) => row.areaId === areaId)?.seats ?? 0
  if (seats <= 0) return undefined

  const peakCrowd = crowdAtPeak(occupants)
  const peak = peakCrowd.occupancy
  const packed = peak / seats
  let rowdy = 0
  let drink = 0
  const rowdyByGroup = new Map<string, number>()
  for (const party of occupants) {
    const group = ctx.state.customerGroups[party.groupId]
    if (!group) continue
    if (group.rowdiness >= 70) {
      rowdy += party.size
      rowdyByGroup.set(
        party.groupId,
        (rowdyByGroup.get(party.groupId) ?? 0) + party.size,
      )
    }
    for (const line of party.order) {
      const recipe = ctx.state.recipes[line.recipeId]
      if (recipe?.tags.includes('alcohol')) drink += line.delivered
    }
  }
  const patrons = occupants.reduce((sum, party) => sum + party.size, 0)
  if (rowdy < MIN_ROWDY_FOR_TROUBLE || drink < 3 || patrons <= 0) {
    return undefined
  }

  // PEAK CONCURRENT occupancy, not the night's headcount. Every heat term is
  // a ratio, so a big quiet night and a small ugly one remain distinct.
  const security =
    input.flow.capacity.securityCover +
    input.quality.fightControl / 2 +
    getWeaponsPolicySecurityBonus(ctx.state)
  const rowdyShare = Math.min(1, rowdy / patrons)
  const drinkPerPatron = Math.min(3, drink / patrons)
  const heat =
    rowdyShare * 40 +
    Math.min(1, packed) * 40 +
    drinkPerPatron * 10 +
    (input.dayType === 'brawl_night' ? 30 : 0)
  const severity = Math.round(
    Math.max(0, heat - BRAWL_BASELINE - security * 30),
  )
  if (severity < 25) return undefined

  const actorGroup = [...rowdyByGroup.entries()].sort((a, b) =>
    b[1] === a[1] ? a[0].localeCompare(b[0]) : b[1] - a[1],
  )[0]?.[0]
  return {
    areaId,
    ...(actorGroup ? { actorGroup } : {}),
    rowdy,
    drink,
    patrons,
    peakOccupancy: peak,
    partyIds: peakCrowd.partyIds,
    packed,
    security,
    severity,
  }
}

/** The most patrons this room held at once, and the parties present then. */
function crowdAtPeak(
  parties: ReadonlyArray<ServiceParty>,
): { occupancy: number; partyIds: string[] } {
  let peak = 0
  let partyIds: string[] = []
  for (let wave = 0; wave < SERVICE_WAVES; wave++) {
    const present: ServiceParty[] = []
    for (const party of parties) {
      const from = party.seatedWave
      if (from === undefined || from > wave) continue
      const until = party.leftWave ?? SERVICE_WAVES
      if (until < wave) continue
      present.push(party)
    }
    const concurrent = present.reduce((sum, party) => sum + party.size, 0)
    if (concurrent > peak) {
      peak = concurrent
      partyIds = present.map((party) => party.id).sort((a, b) => a.localeCompare(b))
    }
  }
  return { occupancy: peak, partyIds }
}

function areasWithCrowd(input: FlowIncidentInput): string[] {
  const ids = new Set<string>()
  for (const party of input.flow.parties) {
    if (party.areaId && party.seatedWave !== undefined) ids.add(party.areaId)
  }
  return [...ids].sort((a, b) => a.localeCompare(b))
}

/**
 * §4.4 "area damage blocks capacity and feeds later service".
 *
 * The blockage is already real — `getAreaBlockedFraction` takes it out of the
 * seat count the flow ran on. This surfaces it as an incident so the player is
 * told WHY the room was short, rather than only that it was.
 */
function blockedCapacityIncidents(
  ctx: SimContext,
  input: FlowIncidentInput,
): ServiceIncidentSummary[] {
  if (input.flow.bottleneck?.reason !== 'seats') return []
  const seating = getCustomerFacingSeating(ctx.state)
  if (seating.blockedSeats <= 0) return []
  const worst = seating.byArea
    .filter((row) => row.seats > row.usableSeats)
    .sort((a, b) => b.seats - b.usableSeats - (a.seats - a.usableSeats))[0]
  return [
    {
      id: 'capacity_blocked',
      severity: Math.min(100, 15 + seating.blockedSeats * 3),
      ...(worst ? { areaId: worst.areaId } : {}),
      effects: [
        `seats.blocked ${seating.blockedSeats}`,
        `seats.usable ${seating.usableSeats}`,
      ],
    },
  ]
}

function shortageIncidents(input: FlowIncidentInput): ServiceIncidentSummary[] {
  const out: ServiceIncidentSummary[] = []
  for (const groupId of Object.keys(input.flow.shortagesByGroup).sort((a, b) =>
    a.localeCompare(b),
  )) {
    for (const shortage of input.flow.shortagesByGroup[groupId] ?? []) {
      out.push({
        id: 'stock_shortage',
        severity: Math.min(
          100,
          20 + Math.round((shortage.requested - shortage.available) * 2),
        ),
        actorGroup: groupId,
        effects: [`stock.${shortage.stockId}.shortfall`],
      })
    }
  }
  return out
}

function tabIncidents(input: FlowIncidentInput): ServiceIncidentSummary[] {
  const out: ServiceIncidentSummary[] = []
  for (const groupId of Object.keys(input.flow.tabByGroup).sort((a, b) =>
    a.localeCompare(b),
  )) {
    const tab = input.flow.tabByGroup[groupId] ?? 0
    const served = input.flow.servedByGroup[groupId] ?? 0
    if (tab <= 0) continue
    if (tab < Math.max(2, Math.round(served / 2))) continue
    out.push({
      id: 'unpaid_tabs',
      severity: Math.min(100, 15 + tab * 3),
      actorGroup: groupId,
      effects: [`coin -${tab}`],
    })
  }
  return out
}
