import { describe, expect, it } from 'vitest'

import { createInitialTavernState } from '../../src/sim/state/defaults'
import { forecastTrafficForGroup } from '../../src/sim/modules/customers/forecast'
import type { SimContext } from '../../src/sim/core/context'
import type { CustomerGroupState, TavernState } from '../../src/sim/state/TavernState'

// Phase 79 — ISSUE-039: broaden the culinary_renown consumer set.
//
// Before this phase, renown only fed niche-group activation
// (customerModule.evaluateNicheThresholds) and the hireable
// adventurer soft-cap (adventurersModule). A player who built renown
// to 70+ got two effects and nothing on the day-to-day satisfaction
// or pricing loop.
//
// Phase 79 wires renown into the daily forecast:
//   - groups whose preferredStockTags include rarity-adjacent tags
//     (rare, legendary, prized, mythic, exotic, quality_sensitive)
//     get a small attraction bonus per renown point;
//   - the same groups get a soft price-tolerance bump (high renown
//     reduces the pricePenalty by up to 15%).

function withRenown(state: TavernState, value: number): TavernState {
  return {
    ...state,
    reputation: { ...state.reputation, culinary_renown: value },
  }
}

// Minimal SimContext stub — forecastTrafficForGroup uses `getDayType`
// and `rng.int` only. We freeze both so the test is deterministic
// without booting a full engine cycle.
function stubCtx(state: TavernState): SimContext {
  return {
    state,
    rng: {
      int: () => 0,
      float: () => 0,
      chance: () => false,
      pick: <T>(arr: ReadonlyArray<T>) => arr[0]!,
    },
    getDayType: () => 'weekday',
  } as unknown as SimContext
}

function findRarityGroup(state: TavernState): CustomerGroupState {
  // `food_critic` has minRenownThreshold 50, prefers ['dish', 'prized',
  // 'mythic'] — once activated it's a representative rarity-loving
  // group for these tests.
  return { ...state.customerGroups['food_critic']!, patronage: 20 }
}

function findCommonGroup(state: TavernState): CustomerGroupState {
  // `local_goblins` is the canonical common group — preferredStockTags
  // are ['drink', 'goblin_favourite', 'food'] which does not match the
  // rarity-tag set, so it should be unaffected by renown.
  return state.customerGroups['local_goblins']!
}

describe('Phase 79 / ISSUE-039 — culinary_renown broadens to forecast consumers', () => {
  it('rarity-preferring group sees a higher forecast at high renown', () => {
    const base = createInitialTavernState()
    const low = withRenown(base, 10)
    const high = withRenown(base, 80)
    const group = findRarityGroup(base)
    // Make the group "active" in both worlds so the niche-gate doesn't
    // zero the forecast at low renown.
    const lowCtx = stubCtx({
      ...low,
      customerGroups: { ...low.customerGroups, [group.id]: group },
    })
    const highCtx = stubCtx({
      ...high,
      customerGroups: { ...high.customerGroups, [group.id]: group },
    })
    const fLow = forecastTrafficForGroup(group, lowCtx.state, lowCtx)
    const fHigh = forecastTrafficForGroup(group, highCtx.state, highCtx)
    expect(fHigh.expected).toBeGreaterThan(fLow.expected)
  })

  it('common (non-rarity) group forecast is unaffected by renown', () => {
    const base = createInitialTavernState()
    const low = withRenown(base, 10)
    const high = withRenown(base, 80)
    const group = findCommonGroup(base)
    const lowCtx = stubCtx(low)
    const highCtx = stubCtx(high)
    const fLow = forecastTrafficForGroup(group, lowCtx.state, lowCtx)
    const fHigh = forecastTrafficForGroup(group, highCtx.state, highCtx)
    expect(fHigh.expected).toBe(fLow.expected)
  })

  it('rarity group at low renown is more price-sensitive than at high renown', () => {
    // Force a high `maxPrice` in stock so the pricePenalty calc is
    // nonzero. Then check that high renown reduces the penalty.
    const base = createInitialTavernState()
    const expensive = {
      ...base,
      stock: {
        ...base.stock,
        ale: { ...base.stock['ale']!, salePrice: 50, quantity: 10 },
      },
    }
    const low = withRenown(expensive, 10)
    const high = withRenown(expensive, 100)
    const group = { ...base.customerGroups['food_critic']!, patronage: 20 }
    const fLow = forecastTrafficForGroup(group, low, stubCtx(low))
    const fHigh = forecastTrafficForGroup(group, high, stubCtx(high))
    // High renown softens the price penalty.
    expect(fHigh.pricePenalty).toBeLessThan(fLow.pricePenalty)
  })

  it('forecast notes mention the renown lift when active', () => {
    const base = createInitialTavernState()
    const high = withRenown(base, 80)
    const group = { ...base.customerGroups['food_critic']!, patronage: 20 }
    const ctx = stubCtx({
      ...high,
      customerGroups: { ...high.customerGroups, [group.id]: group },
    })
    const f = forecastTrafficForGroup(group, ctx.state, ctx)
    expect(f.notes.join(' ')).toMatch(/culinary renown/i)
  })

  it('renown 0 produces no attraction or softening', () => {
    // Sanity floor — the new modifier should not negatively bias the
    // forecast at zero renown.
    const base = createInitialTavernState()
    const zero = withRenown(base, 0)
    const group = { ...base.customerGroups['food_critic']!, patronage: 20 }
    const ctx = stubCtx({
      ...zero,
      customerGroups: { ...zero.customerGroups, [group.id]: group },
    })
    const f = forecastTrafficForGroup(group, ctx.state, ctx)
    expect(f.notes.join(' ')).not.toMatch(/culinary renown/i)
  })
})
