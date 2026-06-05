import { describe, expect, it } from 'vitest'

import { simulateDay } from '../../src/sim/core/engine'
import type { SimInput } from '../../src/sim/core/context'

import { areasModule } from '../../src/sim/modules/areas/index'
import { attributionModule } from '../../src/sim/modules/attribution/index'
import { causesModule } from '../../src/sim/modules/causes/index'
import { cultureModule } from '../../src/sim/modules/cultures/index'
import { customersModule } from '../../src/sim/modules/customers/index'
import { factionModule } from '../../src/sim/modules/factions/index'
import { feedbackModule } from '../../src/sim/modules/feedback/index'
import { historyModule } from '../../src/sim/modules/history/index'
import { issueSeedsModule } from '../../src/sim/modules/issues/index'
import { localArcsModule } from '../../src/sim/modules/localArcs/index'
import { memoriesModule } from '../../src/sim/modules/memories/index'
import { monthlyModule } from '../../src/sim/modules/monthly/index'
import { ownerActionsModule } from '../../src/sim/modules/ownerActions/index'
import { pressuresModule } from '../../src/sim/modules/pressures/index'
import { regularModule } from '../../src/sim/modules/regulars/index'
import { serviceModule } from '../../src/sim/modules/service/index'
import { staffModule } from '../../src/sim/modules/staff/index'
import { stockModule } from '../../src/sim/modules/stock/index'
import { supplierModule } from '../../src/sim/modules/suppliers/index'
import { weeklyModule } from '../../src/sim/modules/weekly/index'
import { worldModule } from '../../src/sim/modules/world/index'

import { createInitialTavernState } from '../../src/sim/state/defaults'
import { validateState } from '../../src/sim/state/validation'
import {
  cultureRegistry,
  ensureRequiredCulturesRegistered,
} from '../../src/sim/content/cultures/cultureRegistry'
import { getPressureModuleState } from '../../src/sim/modules/pressures/pressureModule'
import type {
  CustomerGroupState,
  StockState,
  TavernState,
} from '../../src/sim/state/TavernState'

// Phase 50 — ISSUE-010. Cultures + tag alignment.
//
// Three cross-cutting cultures (`shrine_devotees`, `traveling_outsiders`,
// `guild_artisans`) get registered and seeded into world state. Starter
// regulars and the `brewers_guild` faction adopt them so each new
// culture has members at day 0. Three memory definitions cover the
// dead-read tags (`seating_conflict`, `food_taboo`,
// `cultural_misunderstanding`) and the `cultureModule.closing` hook
// emits them when matching conditions hold.

const SEED = 'phase-50-cultures-tag-alignment-test'

const MODULE_SLICE = [
  areasModule,
  stockModule,
  staffModule,
  customersModule,
  worldModule,
  cultureModule,
  factionModule,
  supplierModule,
  regularModule,
  ownerActionsModule,
  serviceModule,
  weeklyModule,
  monthlyModule,
  localArcsModule,
  memoriesModule,
  historyModule,
  causesModule,
  attributionModule,
  pressuresModule,
  feedbackModule,
  issueSeedsModule,
]

function input(overrides: Partial<SimInput> = {}): SimInput {
  return { seed: SEED, ...overrides }
}

function withCustomerGroup(
  state: TavernState,
  id: string,
  overrides: Partial<CustomerGroupState>,
): TavernState {
  const group = state.customerGroups[id]!
  return {
    ...state,
    customerGroups: {
      ...state.customerGroups,
      [id]: { ...group, ...overrides },
    },
  }
}

function withStock(
  state: TavernState,
  id: string,
  overrides: Partial<StockState>,
): TavernState {
  const stock = state.stock[id]!
  return { ...state, stock: { ...state.stock, [id]: { ...stock, ...overrides } } }
}

function withCalendarTag(state: TavernState, tag: string): TavernState {
  if ((state.calendar.tags as readonly string[]).includes(tag)) return state
  return {
    ...state,
    calendar: {
      ...state.calendar,
      tags: [...state.calendar.tags, tag] as typeof state.calendar.tags,
    },
  }
}

const NEW_CULTURES = [
  'shrine_devotees',
  'traveling_outsiders',
  'guild_artisans',
] as const

describe('Phase 50 §ISSUE-010 — Cross-cutting culture registry', () => {
  it('1. cultureRegistry contains the three new cross-cutting cultures', () => {
    ensureRequiredCulturesRegistered()
    for (const id of NEW_CULTURES) {
      expect(cultureRegistry.has(id), `culture '${id}'`).toBe(true)
    }
  })

  it('2. createInitialTavernState seeds each new culture into state.world.cultures', () => {
    const state = createInitialTavernState()
    for (const id of NEW_CULTURES) {
      const culture = state.world.cultures[id]
      expect(culture, `expected culture '${id}' in state`).toBeDefined()
      expect(culture!.id).toBe(id)
      expect(culture!.label.length).toBeGreaterThan(0)
    }
  })

  it('3. shrine_devotees has regulars across at least 2 customer-group bases', () => {
    const state = createInitialTavernState()
    const groupsForShrine = new Set<string>()
    for (const regular of Object.values(state.world.regulars)) {
      if (regular.cultureId === 'shrine_devotees') {
        groupsForShrine.add(regular.customerGroupId)
      }
    }
    expect(groupsForShrine.size).toBeGreaterThanOrEqual(2)
  })

  it('3b. traveling_outsiders has regulars across at least 2 customer-group bases', () => {
    const state = createInitialTavernState()
    const groupsForOutsiders = new Set<string>()
    for (const regular of Object.values(state.world.regulars)) {
      if (regular.cultureId === 'traveling_outsiders') {
        groupsForOutsiders.add(regular.customerGroupId)
      }
    }
    expect(groupsForOutsiders.size).toBeGreaterThanOrEqual(2)
  })

  it('4. brewers_guild faction adopts guild_artisans culture', () => {
    const state = createInitialTavernState()
    const brewers = state.world.factions['brewers_guild']
    expect(brewers).toBeDefined()
    expect(brewers!.cultureId).toBe('guild_artisans')
  })

  it('5. validateState passes for the default starting state', () => {
    const state = createInitialTavernState()
    expect(() =>
      validateState(state, { modules: MODULE_SLICE }),
    ).not.toThrow()
  })
})

describe('Phase 50 §ISSUE-010 — Memory producers wire dead-read tags', () => {
  function primeSeatingConflict(state: TavernState): TavernState {
    // local_goblins ↔ merchants have relationship -15 by default. Force
    // it well below -30 and pin both to high patronage so the closing
    // hook detects the pair.
    let s = withCustomerGroup(state, 'local_goblins', {
      patronage: 70,
      relationshipToOtherGroups: {
        ...state.customerGroups['local_goblins']!.relationshipToOtherGroups,
        merchants: -40,
      },
    })
    s = withCustomerGroup(s, 'merchants', {
      patronage: 70,
      relationshipToOtherGroups: {
        ...state.customerGroups['merchants']!.relationshipToOtherGroups,
        local_goblins: -40,
      },
    })
    return s
  }

  it('6. seating_conflict memory fires when two groups with hostile relationship are both highly patronised', () => {
    const base = primeSeatingConflict(createInitialTavernState())
    const result = simulateDay(base, input(), MODULE_SLICE)
    const seatingMems = result.state.memories.filter((m) =>
      m.tags.includes('seating_conflict'),
    )
    expect(seatingMems.length).toBeGreaterThan(0)
  })

  it('7. food_taboo memory fires when a group has high patronage and stock carries a disliked tag', () => {
    // merchants' culture (merchant_roadfolk) dislikes 'filth', 'danger',
    // 'risky'. The traveling_outsiders culture dislikes 'filth' and
    // 'goblin_favourite'. The default ale stock carries 'goblin_favourite'
    // (and the default mushroom/stew lines vary), so picking the merchant
    // group with a tagged stock item should fire the producer.
    let base = withCustomerGroup(createInitialTavernState(), 'merchants', {
      patronage: 60,
    })
    // Reassure: make sure at least one available stock item carries one
    // of merchants' disliked tags. The default goblin_local culture is
    // already on merchants but the merchants group itself dislikes
    // 'filth', 'danger', 'risky'. We tag the ale stock with 'risky' to
    // guarantee an overlap with the merchants' culture dislikedTags.
    base = withStock(base, 'ale', {
      quantity: 800,
      tags: [...new Set([...(base.stock['ale']?.tags ?? []), 'risky'])],
    })
    const result = simulateDay(base, input(), MODULE_SLICE)
    const tabooMems = result.state.memories.filter((m) =>
      m.tags.includes('food_taboo'),
    )
    expect(tabooMems.length).toBeGreaterThan(0)
  })

  it('8. cultural_misunderstanding memory fires when a culture has an active calendar tag and no friction-relief policy', () => {
    // Force `market_day` onto the calendar so the merchant_roadfolk
    // and traveling_outsiders cultures (both watch market_day) get
    // detected. No friction-relief policy is enabled in default state.
    const base = withCalendarTag(createInitialTavernState(), 'market_day')
    const result = simulateDay(base, input(), MODULE_SLICE)
    const mems = result.state.memories.filter((m) =>
      m.tags.includes('cultural_misunderstanding'),
    )
    expect(mems.length).toBeGreaterThan(0)
  })

  it('9. accumulated taboo memories drive culturalTension to fire its taboo_memory cause', () => {
    // Combine seating-conflict + food-taboo conditions and tick a few
    // days so the timed memories compound past the 25-strength gate.
    let base = createInitialTavernState()
    base = withCustomerGroup(base, 'local_goblins', {
      patronage: 70,
      relationshipToOtherGroups: {
        ...base.customerGroups['local_goblins']!.relationshipToOtherGroups,
        merchants: -50,
      },
    })
    base = withCustomerGroup(base, 'merchants', {
      patronage: 70,
      relationshipToOtherGroups: {
        ...base.customerGroups['merchants']!.relationshipToOtherGroups,
        local_goblins: -50,
      },
    })
    base = withStock(base, 'ale', {
      quantity: 800,
      tags: [...new Set([...(base.stock['ale']?.tags ?? []), 'risky'])],
    })
    base = withCalendarTag(base, 'market_day')

    let state = base
    for (let i = 0; i < 3; i += 1) {
      const result = simulateDay(state, input(), MODULE_SLICE)
      state = result.state
    }
    const snapshot = getPressureModuleState(state).snapshots['cultural_tension']
    expect(snapshot, 'cultural_tension snapshot missing').toBeDefined()
    const tabooCauses = snapshot!.causes.filter((c) => c.id === 'taboo_memory')
    expect(tabooCauses.length).toBeGreaterThan(0)
  })
})
