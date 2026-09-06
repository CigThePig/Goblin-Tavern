import { identityTrafficModifier } from '../tavernIdentity/evidence'
import { ventureTrafficBonus } from '../ventures/ambitionEffects'
import type { SimContext } from '../../core/context'
import type {
  CustomerGroupState,
  StockState,
  TavernState,
} from '../../state/TavernState'
import type { DayType } from '../calendar/types'
import { getCultureForecastModifier } from '../cultures/customerInfluence'
import { getFactionForecastModifier } from '../factions/stances'
import { getBeliefForecastModifier } from './beliefInfluence'
import {
  getCompetitorChoiceFactorForGroup,
  getDemandFactorForGroup,
} from '../economy/dynamics'

import type { CustomerForecast } from './types'

// Phase 10 §10.3 — Traffic forecast.
//
// `forecastTraffic(ctx)` produces a deterministic per-group projection of
// the day's traffic. Day type, satisfaction, cleanliness vs filth
// tolerance, price vs price sensitivity, and stock preference all
// contribute. All randomness comes from `ctx.rng` (Phase 4); the function
// never reaches for the unseeded global PRNG.
//
// The shape (`CustomerForecast`) is the public contract Phase 12 reads —
// see the §10.3 forward note. Phase 10 also uses it immediately to resolve
// simple turnout in `customerModule`'s service hook.

const DAY_TYPE_MODIFIERS: Record<string, Partial<Record<DayType, number>>> = {
  local_goblins: {
    supplier_day: -3,
    quiet_day: -8,
    market_day: 0,
    local_night: 12,
    payday: 4,
    brawl_night: 2,
    maintenance_day: -10,
  },
  miners: {
    supplier_day: -2,
    quiet_day: -10,
    market_day: 2,
    local_night: 4,
    payday: 25,
    brawl_night: 6,
    maintenance_day: -12,
  },
  merchants: {
    supplier_day: 6,
    quiet_day: -6,
    market_day: 18,
    local_night: -4,
    payday: -3,
    brawl_night: -10,
    maintenance_day: -8,
  },
  ogres: {
    supplier_day: -4,
    quiet_day: -8,
    market_day: -2,
    local_night: 2,
    payday: 4,
    brawl_night: 18,
    maintenance_day: -10,
  },
  adventurers: {
    supplier_day: -2,
    quiet_day: -6,
    market_day: 2,
    local_night: 0,
    payday: 4,
    brawl_night: 12,
    maintenance_day: -8,
  },
}

function dayTypeModifier(groupId: string, dayType: DayType): number {
  const table = DAY_TYPE_MODIFIERS[groupId]
  if (!table) return 0
  return table[dayType] ?? 0
}

function customerFacingArea(state: TavernState) {
  return state.areas['main_room']
}

function cleanlinessPenalty(
  group: CustomerGroupState,
  state: TavernState,
): number {
  const room = customerFacingArea(state)
  if (!room) return 0
  if (room.cleanliness >= group.filthTolerance) return 0
  // Below tolerance: subtract proportional to the gap, scaled by how
  // strongly the group dislikes filth. Squaring the sensitivity factor
  // means tolerant groups (high filthTolerance, e.g. local goblins) take a
  // much smaller hit than sensitive groups (low filthTolerance, e.g.
  // merchants) even when their gap-below-tolerance is larger.
  const gap = group.filthTolerance - room.cleanliness
  const sensitivity = 1 - group.filthTolerance / 100 // 0..1
  return Math.round(gap * Math.pow(sensitivity, 2) * 0.6)
}

// Phase 79 / ISSUE-039 — groups whose preferredStockTags signal an
// appetite for rare/legendary fare are more forgiving on price when
// the tavern's culinary renown is high. Returns a multiplier in
// [0.85, 1.0] — renown 0 → 1.0 (no softening); renown 100 → ~0.85
// (15% softer price penalty). Other groups always get 1.0.
function priceToleranceMultiplier(
  group: CustomerGroupState,
  state: TavernState,
): number {
  if (!groupCaresAboutRarity(group)) return 1
  const renown = state.reputation.culinary_renown
  return Math.max(0.85, 1 - renown * 0.0015)
}

// Tags that signal a group with appetite for high-quality / rare fare.
// Matches the vocabulary used across customerRegistry — the niche
// groups in `customerRegistry.ts:300-370` use `prized`, `mythic`,
// `exotic`; the `merchants` group at line 150 carries
// `quality_sensitive`. All four (plus literal `rare`/`legendary` for
// future-proofing) get the renown softening + attraction lift.
const RARITY_PREFERENCE_TAGS = new Set<string>([
  'rare',
  'legendary',
  'prized',
  'mythic',
  'exotic',
  'quality_sensitive',
])

function groupCaresAboutRarity(group: CustomerGroupState): boolean {
  return group.preferredStockTags.some((tag) =>
    RARITY_PREFERENCE_TAGS.has(tag),
  )
}

function pricePenalty(group: CustomerGroupState, state: TavernState): number {
  // Use the priciest service item as a proxy for "how expensive is this
  // tavern". Higher salePrice + higher priceSensitivity → bigger penalty.
  //
  // Phase 66 / ISSUE-026 — only items the tavern actually holds count.
  // The grown ingredient catalog includes rare/legendary stock types
  // with high `salePrice` defaults but quantity 0 on day zero; the
  // customer-facing price perception should reflect what's on the menu.
  let maxPrice = 0
  for (const item of Object.values(state.stock)) {
    if (item.quantity <= 0) continue
    if (item.salePrice > maxPrice) maxPrice = item.salePrice
  }
  const sensitivity = group.priceSensitivity / 100
  const renownSoftener = priceToleranceMultiplier(group, state)
  // Each coin of sale price contributes a small amount, scaled by how
  // price-sensitive the group is, and softened by culinary renown for
  // rarity-loving groups.
  return Math.round(maxPrice * sensitivity * 0.4 * renownSoftener)
}

// Phase 79 / ISSUE-039 — for groups whose preferredStockTags include
// 'rare' or 'legendary', high culinary renown lifts the forecast by a
// few visitors per day. Renown 100 → +5. Renown 0 → 0. Capped to
// avoid a runaway loop on top of the producer side's existing
// idle-decay safety valve in service/recipesDaily.ts.
function renownAttractionModifier(
  group: CustomerGroupState,
  state: TavernState,
): number {
  if (!groupCaresAboutRarity(group)) return 0
  const renown = state.reputation.culinary_renown
  return Math.round(renown * 0.05)
}

function stockModifier(group: CustomerGroupState, state: TavernState): number {
  let bonus = 0
  let penalty = 0
  const items = Object.values(state.stock)

  for (const tag of group.preferredStockTags) {
    const matches = items.filter((item) => item.tags.includes(tag))
    if (matches.length === 0) continue
    const hasStock = matches.some((item) => item.quantity > 0)
    if (hasStock) {
      bonus += 2
    } else {
      // Preferred but out of stock — small forecast penalty.
      penalty += 3
    }
  }

  for (const tag of group.dislikedTags) {
    const matches = items.filter((item) => item.tags.includes(tag))
    if (matches.length > 0 && matches.some((item) => item.quantity > 0)) {
      penalty += 1
    }
  }

  return bonus - penalty
}

function satisfactionModifier(group: CustomerGroupState): number {
  // 50 satisfaction is neutral. Up to ±8 swing.
  //
  // `+ 0` is not decoration: `Math.round` of a small negative returns NEGATIVE
  // ZERO, which survives `structuredClone` but not `JSON.stringify` — so a
  // group sitting one or two points below neutral made the save envelope stop
  // round-tripping, and the Wave 0 durable-progress gate caught it. `-0 + 0` is
  // `0`; every other value is unchanged.
  return Math.round((group.satisfaction - 50) / 6) + 0
}

function clampForecastVisitors(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.round(value))
}

export function forecastTrafficForGroup(
  group: CustomerGroupState,
  state: TavernState,
  ctx: SimContext,
): CustomerForecast {
  // Phase 72 / ISSUE-032 §4.7 — inactive niche groups produce zero
  // visitors regardless of other modifiers. A group is "inactive"
  // when it carries a renown threshold AND `patronage` is 0 (the
  // customer module flips patronage upward when the threshold is
  // crossed). This keeps stockMod / cultureInfluence bonuses from
  // pulling phantom visitors before the player has earned the
  // group's attention.
  if (
    typeof group.minRenownThreshold === 'number' &&
    group.minRenownThreshold > 0 &&
    group.patronage <= 0
  ) {
    return {
      groupId: group.id,
      expected: 0,
      dayTypeModifier: 0,
      satisfactionModifier: 0,
      cleanlinessPenalty: 0,
      pricePenalty: 0,
      stockModifier: 0,
      notes: ['Niche group — culinary renown threshold not yet met.'],
    }
  }

  const dayType = ctx.getDayType()
  const dayMod = dayTypeModifier(group.id, dayType)
  const satMod = satisfactionModifier(group)
  const filthPenalty = cleanlinessPenalty(group, state)
  const priceHit = pricePenalty(group, state)
  const stockMod = stockModifier(group, state)
  // Phase 30 §30.8 — culture influence. The helper is pure and lives in
  // the cultures module so forecasting does not own culture logic.
  const cultureInfluence = getCultureForecastModifier(state, group)
  // Expansion Phase 8 §8.1 — a faction that speaks for this group can keep
  // its people at home or send them here. The stance is the factions
  // module's; what it does to turnout is decided here, in the group's own
  // forecast rule, capped like every other term.
  const factionInfluence = getFactionForecastModifier(state, group)
  // Expansion Phase 8 §8.5 — what this group has come to BELIEVE about the
  // house. The belief layer supplies a bounded weight; the size of it in
  // bodies is decided here, in the group's own forecast rule.
  const beliefInfluence = getBeliefForecastModifier(state, group)
  // Phase 79 / ISSUE-039 — culinary_renown lifts attraction for groups
  // that explicitly prefer rare/legendary fare.
  const renownPull = renownAttractionModifier(group, state)
  const ambitionPull = ventureTrafficBonus(state, group)
  const identityPull = identityTrafficModifier(state, group)

  // Small deterministic jitter so identical inputs still feel like
  // distinct days when reports are read in sequence. Pulled from
  // `ctx.rng` so seeds remain reproducible.
  const jitter = ctx.rng.int(-2, 2)

  const base = (group.patronage * 0.4)
  const economyFactor = getDemandFactorForGroup(state, group.id)
  const competitorFactor = getCompetitorChoiceFactorForGroup(state, group.id)
  const unconstrained =
    base +
      dayMod +
      satMod +
      stockMod +
      cultureInfluence.modifier +
      factionInfluence.modifier +
      beliefInfluence.modifier +
      renownPull + ambitionPull.amount + identityPull.amount -
      filthPenalty -
      priceHit +
      jitter
  const expected = clampForecastVisitors(
    unconstrained * economyFactor * competitorFactor,
  )

  const notes: string[] = []
  if (dayMod >= 8) notes.push(`Day type (${dayType}) drew this group.`)
  if (dayMod <= -6) notes.push(`Day type (${dayType}) kept this group away.`)
  if (filthPenalty > 0) {
    notes.push(`Main room cleanliness below tolerance (-${filthPenalty}).`)
  }
  if (priceHit > 0) {
    notes.push(`Prices nudged price-sensitive visitors away (-${priceHit}).`)
  }
  if (stockMod > 0) notes.push('Preferred stock was available.')
  if (stockMod < 0) notes.push('Preferred stock was missing or disliked stock was prominent.')
  if (renownPull > 0) {
    notes.push(`Culinary renown drew rarity-minded patrons (+${renownPull}).`)
  }
  notes.push(...ambitionPull.notes, ...identityPull.notes)
  for (const note of cultureInfluence.notes) notes.push(note)
  for (const note of factionInfluence.notes) notes.push(note)
  for (const note of beliefInfluence.notes) notes.push(note)
  if (economyFactor < 0.98) {
    notes.push(
      `Persistent service/economic trust reduced this group's traffic (×${economyFactor.toFixed(2)}).`,
    )
  }
  if (competitorFactor < 0.98) {
    notes.push(
      `The rival tavern's appeal diverted part of this group's traffic (×${competitorFactor.toFixed(2)}).`,
    )
  }

  return {
    groupId: group.id,
    expected,
    dayTypeModifier: dayMod,
    satisfactionModifier: satMod,
    cleanlinessPenalty: filthPenalty,
    pricePenalty: priceHit,
    stockModifier: stockMod,
    notes,
  }
}

export function forecastTraffic(ctx: SimContext): CustomerForecast[] {
  const forecasts: CustomerForecast[] = []
  for (const group of Object.values(ctx.state.customerGroups)) {
    forecasts.push(forecastTrafficForGroup(group, ctx.state, ctx))
  }
  return forecasts
}

// Convenience helper used by reports and tests to find the priciest
// service item without re-walking stock state.
//
// Phase 66 / ISSUE-026 — only items the tavern actually holds count.
// The grown ingredient catalog includes rare/legendary stock types
// with high `salePrice` defaults but quantity 0 on day zero; the
// customer-facing "max price" should reflect what's actually on the
// menu, not the theoretical ceiling of every registered type.
export function highestStockPrice(state: TavernState): number {
  let max = 0
  for (const item of Object.values(state.stock) as StockState[]) {
    if (item.quantity <= 0) continue
    if (item.salePrice > max) max = item.salePrice
  }
  return max
}
