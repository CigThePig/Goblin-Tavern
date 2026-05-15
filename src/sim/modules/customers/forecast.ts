import type { SimContext } from '../../core/context'
import type {
  CustomerGroupState,
  StockState,
  TavernState,
} from '../../state/TavernState'
import type { DayType } from '../calendar/types'
import { getCultureForecastModifier } from '../cultures/customerInfluence'

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
  // Each coin of sale price contributes a small amount, scaled by how
  // price-sensitive the group is.
  return Math.round(maxPrice * sensitivity * 0.4)
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
  return Math.round((group.satisfaction - 50) / 6)
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
  const dayType = ctx.getDayType()
  const dayMod = dayTypeModifier(group.id, dayType)
  const satMod = satisfactionModifier(group)
  const filthPenalty = cleanlinessPenalty(group, state)
  const priceHit = pricePenalty(group, state)
  const stockMod = stockModifier(group, state)
  // Phase 30 §30.8 — culture influence. The helper is pure and lives in
  // the cultures module so forecasting does not own culture logic.
  const cultureInfluence = getCultureForecastModifier(state, group)

  // Small deterministic jitter so identical inputs still feel like
  // distinct days when reports are read in sequence. Pulled from
  // `ctx.rng` so seeds remain reproducible.
  const jitter = ctx.rng.int(-2, 2)

  const base = (group.patronage * 0.4)
  const expected = clampForecastVisitors(
    base +
      dayMod +
      satMod +
      stockMod +
      cultureInfluence.modifier -
      filthPenalty -
      priceHit +
      jitter,
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
  for (const note of cultureInfluence.notes) notes.push(note)

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
