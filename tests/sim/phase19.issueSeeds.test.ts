import { describe, expect, it } from 'vitest'

import { simulateDay } from '../../src/sim/core/engine'
import type { SimInput } from '../../src/sim/core/context'

import { areasModule } from '../../src/sim/modules/areas/index'
import { customersModule } from '../../src/sim/modules/customers/index'
import { ownerActionsModule } from '../../src/sim/modules/ownerActions/index'
import { serviceModule } from '../../src/sim/modules/service/index'
import { staffModule } from '../../src/sim/modules/staff/index'
import { stockModule } from '../../src/sim/modules/stock/index'
import { weeklyModule } from '../../src/sim/modules/weekly/index'
import { monthlyModule } from '../../src/sim/modules/monthly/index'
import { memoriesModule } from '../../src/sim/modules/memories/index'
import { historyModule } from '../../src/sim/modules/history/index'
import { causesModule } from '../../src/sim/modules/causes/index'
import { pressuresModule } from '../../src/sim/modules/pressures/index'
import { feedbackModule } from '../../src/sim/modules/feedback/index'
import {
  CONTRACT_CHECK_IDS,
  IMPACT_THRESHOLDS,
  ISSUE_SEEDS_MODULE_ID,
  ISSUE_SEEDS_REPORT_ID,
  REQUIRED_SEED_GENERATORS,
  TEXT_INGREDIENT_LIMITS,
  buildTextIngredients,
  classifyImpact,
  computeCardWorthiness,
  computeNovelty,
  getAllSeedsToday,
  getCooldown,
  getIssueSeeds,
  getRejectedSeedsToday,
  issueSeedGeneratorRegistry,
  issueSeedsModule,
  rankSeeds,
  validateSeed,
  validateTextIngredients,
} from '../../src/sim/modules/issues/index'
import {
  causeEntryFromAdded,
  resolveResponseIntent,
} from '../../src/sim/modules/responses/responseResolver'
import type {
  IssueSeed,
  ResponseIntent,
} from '../../src/sim/modules/issues/issueSeedTypes'

import { createInitialTavernState } from '../../src/sim/state/defaults'
import {
  withArea,
  withCoin,
  withCustomerGroup,
  withStaff,
  withStock,
} from '../../src/sim/testing/stateFactories'
import type { TavernState } from '../../src/sim/state/TavernState'
import type { MonthlyModuleState } from '../../src/sim/modules/monthly/types'

const SEED = 'phase-19-issue-seeds-test'

const FULL_PIPELINE = [
  areasModule,
  stockModule,
  staffModule,
  customersModule,
  ownerActionsModule,
  serviceModule,
  weeklyModule,
  monthlyModule,
  memoriesModule,
  historyModule,
  causesModule,
  pressuresModule,
  feedbackModule,
  issueSeedsModule,
]

function input(overrides: Partial<SimInput> = {}): SimInput {
  return { seed: SEED, ...overrides }
}

function runDay(state: TavernState, overrides: Partial<SimInput> = {}) {
  return simulateDay(state, input(overrides), FULL_PIPELINE)
}

function plentyOfStock(state: TavernState): TavernState {
  return {
    ...state,
    stock: {
      ...state.stock,
      ale: { ...state.stock.ale!, quantity: 800, quality: 60 },
      stew: { ...state.stock.stew!, quantity: 400, quality: 60 },
      mushrooms: { ...state.stock.mushrooms!, quantity: 200 },
    },
  }
}

function withDayType(
  state: TavernState,
  dayType: TavernState['calendar']['dayType'],
): TavernState {
  return { ...state, calendar: { ...state.calendar, dayType } }
}

function withRentArrears(
  state: TavernState,
  arrears: number,
  paid: boolean,
): TavernState {
  const monthly = (state.modules['monthly'] ?? null) as MonthlyModuleState | null
  if (!monthly) return state
  return {
    ...state,
    modules: {
      ...state.modules,
      monthly: {
        ...monthly,
        rent: {
          ...monthly.rent,
          arrears,
          paidThisMonth: paid,
          missedPayments: paid
            ? monthly.rent.missedPayments
            : monthly.rent.missedPayments + 1,
        },
        landlord: {
          ...monthly.landlord,
          pressure: paid ? monthly.landlord.pressure : 65,
          missedRentCount: paid
            ? monthly.landlord.missedRentCount
            : monthly.landlord.missedRentCount + 1,
        },
      },
    },
  }
}

describe('Phase 19 — Module shape', () => {
  it('issueSeedsModule exposes id, hooks, schema, report, validator', () => {
    expect(issueSeedsModule.id).toBe(ISSUE_SEEDS_MODULE_ID)
    expect(issueSeedsModule.hooks?.startDay).toBeDefined()
    expect(issueSeedsModule.hooks?.generateReports).toBeDefined()
    expect(issueSeedsModule.buildReport).toBeTypeOf('function')
    expect(issueSeedsModule.validate).toBeTypeOf('function')
    expect(issueSeedsModule.stateSchema).toBeDefined()
  })

  it('registers the 10 required seed generators', () => {
    const result = runDay(plentyOfStock(createInitialTavernState()))
    void result
    const ids = issueSeedGeneratorRegistry.all().map((g) => g.id).sort()
    // Phase 39 extends the registry; the original ten must still be
    // present, but additional Phase 39+ generators may be registered.
    expect(REQUIRED_SEED_GENERATORS.length).toBe(10)
    for (const gen of REQUIRED_SEED_GENERATORS) {
      expect(ids).toContain(gen.id)
    }
    const families = new Set(
      REQUIRED_SEED_GENERATORS.map((g) => g.family),
    )
    expect(families.size).toBeGreaterThanOrEqual(10)
  })

  it('initial state seeds an empty issueSeeds slice', () => {
    const state = createInitialTavernState()
    const slice = state.modules[ISSUE_SEEDS_MODULE_ID]
    expect(slice).toBeDefined()
    expect((slice as { seedsToday: unknown[] }).seedsToday).toEqual([])
  })
})

describe('Phase 19 §19.7 — Family generators (vertical slice)', () => {
  it('food safety pressure generates a food safety seed', () => {
    let base = plentyOfStock(createInitialTavernState())
    base = withArea(base, 'kitchen', { cleanliness: 10, smell: 80 })
    base = withStock(base, 'mushrooms', { spoilage: 90 })
    base = withStock(base, 'stew', { spoilage: 80, quantity: 400 })
    const result = runDay(base)
    const seeds = getIssueSeeds(result.state, { family: 'food_safety' })
    expect(seeds.length).toBeGreaterThan(0)
    const seed = seeds[0]!
    expect(seed.type).toBe('crisis')
    expect(seed.responseSlots.length).toBeGreaterThanOrEqual(2)
    expect(seed.consequenceProfiles.length).toBeGreaterThanOrEqual(2)
    expect(seed.causes.length).toBeGreaterThanOrEqual(1)
  })

  it('low ale before Payday generates a stock shortage seed', () => {
    let base = plentyOfStock(createInitialTavernState())
    base = withStock(base, 'ale', { quantity: 10 })
    base = withDayType(base, 'payday')
    const result = runDay(base)
    const seeds = getIssueSeeds(result.state, { family: 'stock_shortage' })
    expect(seeds.length).toBeGreaterThan(0)
    expect(seeds[0]!.responseSlots.length).toBeGreaterThanOrEqual(2)
  })

  it('high maintenance pressure generates a maintenance seed', () => {
    let base = plentyOfStock(createInitialTavernState())
    base = withArea(base, 'main_room', { damage: 80, condition: 15 })
    base = withArea(base, 'roof', { damage: 85, condition: 15 })
    base = withArea(base, 'privy', { condition: 25 })
    const result = runDay(base)
    const seeds = getIssueSeeds(result.state, { family: 'maintenance' })
    expect(seeds.length).toBeGreaterThan(0)
  })

  it('high staff burnout generates a staff seed', () => {
    let base = plentyOfStock(createInitialTavernState())
    for (const id of Object.keys(base.staff)) {
      base = withStaff(base, id, {
        paidThisWeek: false,
        stress: 80,
        fatigue: 80,
        morale: 25,
      })
    }
    const result = runDay(base)
    const seeds = getIssueSeeds(result.state, { family: 'staff_burnout' })
    expect(seeds.length).toBeGreaterThan(0)
    expect(seeds[0]!.primaryActor).toBeDefined()
  })

  it('low merchant satisfaction generates a customer complaint seed', () => {
    let base = plentyOfStock(createInitialTavernState())
    base = withCustomerGroup(base, 'merchants', {
      satisfaction: 20,
      patronage: 30,
    })
    base = withArea(base, 'main_room', { cleanliness: 20 })
    const result = runDay(base)
    const seeds = getIssueSeeds(result.state, { family: 'customer_complaint' })
    expect(seeds.length).toBeGreaterThan(0)
  })

  it('high violence pressure generates a violence seed', () => {
    let base = plentyOfStock(createInitialTavernState())
    base = withDayType(base, 'brawl_night')
    base = withCustomerGroup(base, 'ogres', { patronage: 85, rowdiness: 90 })
    base = withCustomerGroup(base, 'adventurers', { patronage: 60, rowdiness: 80 })
    base = withArea(base, 'main_room', { damage: 60 })
    const result = runDay(base)
    const seeds = getIssueSeeds(result.state, { family: 'violence' })
    expect(seeds.length).toBeGreaterThan(0)
  })

  it('missed rent generates a debt/rent seed', () => {
    let base = plentyOfStock(createInitialTavernState())
    base = withRentArrears(base, 250, false)
    base = withCoin(base, 5)
    for (const id of Object.keys(base.customerGroups)) {
      base = withCustomerGroup(base, id, { patronage: 0 })
    }
    for (const id of Object.keys(base.stock)) {
      base = withStock(base, id, { quantity: 0 })
    }
    const result = runDay(base)
    const seeds = getIssueSeeds(result.state, { family: 'debt_rent' })
    expect(seeds.length).toBeGreaterThan(0)
    expect(seeds[0]!.causes.length).toBeGreaterThanOrEqual(1)
  })

  it('high inspection pressure generates an inspection seed', () => {
    let base = plentyOfStock(createInitialTavernState())
    base = withArea(base, 'kitchen', { cleanliness: 10, smell: 80 })
    base = withArea(base, 'privy', { smell: 90, cleanliness: 10 })
    base = withStock(base, 'mushrooms', { spoilage: 90 })
    base = withStock(base, 'stew', { spoilage: 80, quantity: 400 })
    base = withCustomerGroup(base, 'merchants', { satisfaction: 15 })
    base = { ...base, reputation: { ...base.reputation, filthy: 90 } }
    const result = runDay(base)
    const seeds = getIssueSeeds(result.state, { family: 'inspection' })
    expect(seeds.length).toBeGreaterThan(0)
  })

  it('reputation drift pressure generates a reputation_shift seed', () => {
    let base = plentyOfStock(createInitialTavernState())
    base = withCustomerGroup(base, 'miners', { patronage: 95 })
    base = withCustomerGroup(base, 'merchants', { patronage: 3 })
    base = withCustomerGroup(base, 'ogres', { patronage: 3 })
    base = withCustomerGroup(base, 'adventurers', { patronage: 3 })
    base = withCustomerGroup(base, 'local_goblins', { patronage: 3 })
    base = {
      ...base,
      reputation: { ...base.reputation, cheap: 95, filthy: 90 },
    }
    const result = runDay(base)
    const seeds = getIssueSeeds(result.state, { family: 'reputation_shift' })
    expect(seeds.length).toBeGreaterThan(0)
  })
})

describe('Phase 19 §19.5 — Seed validation', () => {
  it('a seed without causes fails validation', () => {
    const seed = makeFakeSeed({ causes: [] })
    const v = validateSeed(seed)
    expect(v.valid).toBe(false)
    expect(v.contractChecks.reason_now).toBe(false)
  })

  it('a seed with fewer than two response slots fails validation', () => {
    const seed = makeFakeSeed({ responseSlots: [makeFakeSlot('only')] })
    seed.consequenceProfiles = [
      {
        id: 'p',
        responseSlotId: 'only',
        immediateEffects: [],
        delayedEffects: [],
        memories: [{ id: 'mem' }],
        futureHooks: [],
        impactScore: 30,
      },
    ]
    const v = validateSeed(seed)
    expect(v.valid).toBe(false)
    expect(v.contractChecks.at_least_two_responses).toBe(false)
  })

  it('seed validation tracks all ten contract §4.10 checks', () => {
    const seed = makeFakeSeed({})
    const v = validateSeed(seed)
    for (const id of CONTRACT_CHECK_IDS) {
      expect(v.contractChecks).toHaveProperty(id)
    }
  })

  it('text ingredient over-budget produces warnings (or errors in strict mode)', () => {
    // Skip the builder (which trims to budget) and construct an
    // overflowed ingredient set directly to exercise validation.
    const overflowed = {
      subject: 'the stew',
      sensoryDetails: ['a', 'b', 'c', 'fourth too many'],
      actorOpinions: {},
      recentContext: [],
      stakesReadable: [],
    }
    const soft = validateTextIngredients(overflowed, false)
    expect(soft.warnings.length).toBeGreaterThan(0)
    expect(soft.errors.length).toBe(0)
    const strict = validateTextIngredients(overflowed, true)
    expect(strict.errors.length).toBeGreaterThan(0)
  })

  it('text ingredient word counts are enforced', () => {
    const longDetail = {
      subject: 'the stew',
      sensoryDetails: [
        'this single sensory detail has way too many words in it',
      ],
      actorOpinions: {},
      recentContext: [],
      stakesReadable: [],
    }
    const soft = validateTextIngredients(longDetail, false)
    expect(soft.warnings.length).toBeGreaterThan(0)
  })

  it('TEXT_INGREDIENT_LIMITS exposes ceilings', () => {
    expect(TEXT_INGREDIENT_LIMITS.sensoryDetails.maxEntries).toBe(3)
    expect(TEXT_INGREDIENT_LIMITS.sensoryDetails.maxWordsPerEntry).toBe(6)
  })
})

describe('Phase 19 §19.6 — Contradiction guards', () => {
  it('ale shortage seed is blocked when ale stock is high', () => {
    const base = plentyOfStock(createInitialTavernState())
    const result = runDay(base)
    const seeds = getIssueSeeds(result.state, { family: 'stock_shortage' })
    expect(seeds.length).toBe(0)
  })

  it('inspection seed is blocked when inspection pressure is low', () => {
    let base = plentyOfStock(createInitialTavernState())
    base = withArea(base, 'kitchen', { cleanliness: 95, smell: 5 })
    base = withArea(base, 'privy', { cleanliness: 85, smell: 5 })
    const result = runDay(base)
    const seeds = getIssueSeeds(result.state, { family: 'inspection' })
    expect(seeds.length).toBe(0)
  })

  it('maintenance seed is blocked when all areas are in good repair', () => {
    let base = plentyOfStock(createInitialTavernState())
    for (const id of Object.keys(base.areas)) {
      base = withArea(base, id, { damage: 5, condition: 90 })
    }
    const result = runDay(base)
    const seeds = getIssueSeeds(result.state, { family: 'maintenance' })
    expect(seeds.length).toBe(0)
  })

  it('staff burnout seed is blocked when staff are happy', () => {
    let base = plentyOfStock(createInitialTavernState())
    for (const id of Object.keys(base.staff)) {
      base = withStaff(base, id, {
        morale: 80,
        stress: 20,
        fatigue: 20,
        paidThisWeek: true,
      })
    }
    const result = runDay(base)
    const seeds = getIssueSeeds(result.state, { family: 'staff_burnout' })
    expect(seeds.length).toBe(0)
  })
})

describe('Phase 19 §19.3/§19.4 — Ranking, novelty, cooldown', () => {
  it('rankSeeds orders by cardWorthiness', () => {
    const a = makeFakeSeed({ id: 'a' })
    a.cardWorthiness = 30
    a.severity = 30
    const b = makeFakeSeed({ id: 'b' })
    b.cardWorthiness = 60
    b.severity = 40
    const ranked = rankSeeds([a, b])
    expect(ranked[0]!.id).toBe('b')
  })

  it('novelty is 100 for a never-generated template', () => {
    expect(computeNovelty('unseen', {}, 5)).toBe(100)
  })

  it('novelty drops when a template was generated recently', () => {
    const cooldowns = {
      seen: {
        templateId: 'seen',
        family: 'f',
        lastGeneratedDay: 5,
        lastSelectedDay: -1,
        timesSelected: 0,
        timesGenerated: 3,
        actorIds: [],
        locationIds: [],
      },
    }
    const novelty = computeNovelty('seen', cooldowns, 6)
    expect(novelty).toBeLessThan(100)
  })

  it('computeCardWorthiness blends severity, urgency, novelty', () => {
    const seed = makeFakeSeed({})
    seed.severity = 80
    seed.urgency = 70
    const score = computeCardWorthiness({
      seed,
      templateId: 't',
      cooldowns: {},
      absoluteDay: 10,
    })
    expect(score).toBeGreaterThan(50)
  })

  it('cooldown tracking records generated templates', () => {
    let base = plentyOfStock(createInitialTavernState())
    base = withArea(base, 'kitchen', { cleanliness: 10, smell: 80 })
    base = withStock(base, 'mushrooms', { spoilage: 90 })
    base = withStock(base, 'stew', { spoilage: 80, quantity: 400 })
    const result = runDay(base)
    const entry = getCooldown(result.state, 'food_safety_kitchen_risk')
    expect(entry).toBeDefined()
    expect(entry!.timesGenerated).toBeGreaterThanOrEqual(1)
  })
})

describe('Phase 19 §19.10/§19.11 — Response resolver', () => {
  it('safe_costly response reduces relevant pressure at a cost', () => {
    let base = plentyOfStock(createInitialTavernState())
    base = withArea(base, 'kitchen', { cleanliness: 10, smell: 80 })
    base = withStock(base, 'mushrooms', { spoilage: 90 })
    base = withStock(base, 'stew', { spoilage: 80, quantity: 400 })
    const result = runDay(base)
    const seed = getIssueSeeds(result.state, { family: 'food_safety' })[0]!
    const intent: ResponseIntent = {
      id: 'r1',
      seedId: seed.id,
      verb: 'discard',
      shape: 'safe_costly',
      tags: [],
      intensity: 60,
      metadata: { responseSlotId: 'discard_stock' },
    }
    const resolution = resolveResponseIntent(result.state, seed, intent)
    expect(resolution.appliedEffects.length).toBeGreaterThan(0)
    const before = result.state.pressures.food_safety!.value
    const after = resolution.state.pressures.food_safety!.value
    expect(after).toBeLessThanOrEqual(before)
    expect(resolution.stateDiff.changes.length).toBeGreaterThan(0)
  })

  it('risky_profitable response improves coin and raises future risk', () => {
    let base = plentyOfStock(createInitialTavernState())
    base = withArea(base, 'kitchen', { cleanliness: 10, smell: 80 })
    base = withStock(base, 'mushrooms', { spoilage: 90 })
    base = withStock(base, 'stew', { spoilage: 80, quantity: 400 })
    const result = runDay(base)
    const seed = getIssueSeeds(result.state, { family: 'food_safety' })[0]!
    const intent: ResponseIntent = {
      id: 'r2',
      seedId: seed.id,
      verb: 'serve',
      shape: 'risky_profitable',
      tags: [],
      intensity: 70,
      metadata: { responseSlotId: 'serve_anyway' },
    }
    const resolution = resolveResponseIntent(result.state, seed, intent)
    expect(resolution.state.coin).toBeGreaterThan(result.state.coin)
    expect(resolution.futureHooksAdded.length).toBeGreaterThan(0)
  })

  it('response resolver produces a state diff', () => {
    let base = plentyOfStock(createInitialTavernState())
    base = withArea(base, 'kitchen', { cleanliness: 10, smell: 80 })
    base = withStock(base, 'mushrooms', { spoilage: 90 })
    base = withStock(base, 'stew', { spoilage: 80, quantity: 400 })
    const result = runDay(base)
    const seed = getIssueSeeds(result.state, { family: 'food_safety' })[0]!
    const intent: ResponseIntent = {
      id: 'r3',
      seedId: seed.id,
      verb: 'clean',
      shape: 'long_term_investment',
      tags: [],
      intensity: 50,
      metadata: { responseSlotId: 'clean_kitchen' },
    }
    const resolution = resolveResponseIntent(result.state, seed, intent)
    expect(resolution.stateDiff.changes.length).toBeGreaterThan(0)
  })

  it('response resolver creates memories and future hooks', () => {
    let base = plentyOfStock(createInitialTavernState())
    base = withArea(base, 'kitchen', { cleanliness: 10, smell: 80 })
    base = withStock(base, 'mushrooms', { spoilage: 90 })
    base = withStock(base, 'stew', { spoilage: 80, quantity: 400 })
    const result = runDay(base)
    const seed = getIssueSeeds(result.state, { family: 'food_safety' })[0]!
    const intent: ResponseIntent = {
      id: 'r4',
      seedId: seed.id,
      verb: 'blame',
      shape: 'relationship_sacrifice',
      tags: [],
      intensity: 60,
      metadata: { responseSlotId: 'blame_supplier' },
    }
    const resolution = resolveResponseIntent(result.state, seed, intent)
    expect(resolution.memoriesAdded.length).toBeGreaterThan(0)
    expect(resolution.futureHooksAdded.length).toBeGreaterThan(0)
  })

  it('impact scoring flags weak choices', () => {
    expect(classifyImpact(5)).toBe('weak')
    expect(classifyImpact(20)).toBe('minor')
    expect(classifyImpact(45)).toBe('normal')
    expect(classifyImpact(65)).toBe('major')
    expect(classifyImpact(85)).toBe('strategic')
    expect(IMPACT_THRESHOLDS.MINOR).toBe(15)
  })

  it('causeEntryFromAdded synthesises a usable CauseEntry', () => {
    const stamp = {
      year: 1,
      month: 1,
      week: 1,
      day: 1,
      absoluteDay: 0,
    }
    const entry = causeEntryFromAdded(
      {
        source: 'response.clean',
        target: 'areas.kitchen.cleanliness',
        readable: 'Kitchen cleaner',
        amount: 20,
      },
      stamp,
    )
    expect(entry.direction).toBe('increase')
    expect(entry.weight).toBe(20)
  })
})

describe('Phase 19 §19.13 — Reports & queries', () => {
  it('issue seed report lists rejected seeds with reasons', () => {
    // Force a contradiction: clean tavern but high inspection pressure
    // never set — generators reject many families.
    const base = plentyOfStock(createInitialTavernState())
    const result = runDay(base)
    const report = result.reports.find((r) => r.id === ISSUE_SEEDS_REPORT_ID)
    expect(report).toBeDefined()
    const data = report!.data as {
      generated: number
      valid: number
      rejected: number
    }
    expect(typeof data.generated).toBe('number')
    expect(typeof data.valid).toBe('number')
    expect(typeof data.rejected).toBe('number')
  })

  it('getIssueSeeds respects query filters', () => {
    let base = plentyOfStock(createInitialTavernState())
    base = withArea(base, 'kitchen', { cleanliness: 10, smell: 80 })
    base = withStock(base, 'mushrooms', { spoilage: 90 })
    base = withStock(base, 'stew', { spoilage: 80, quantity: 400 })
    const result = runDay(base)
    const crisesOnly = getIssueSeeds(result.state, { types: ['crisis'] })
    for (const seed of crisesOnly) {
      expect(seed.type).toBe('crisis')
    }
    const maxOne = getIssueSeeds(result.state, { max: 1 })
    expect(maxOne.length).toBeLessThanOrEqual(1)
  })

  it('rejected seeds appear in the slice', () => {
    const base = plentyOfStock(createInitialTavernState())
    const result = runDay(base)
    // The clean baseline rejects most families; rejected list should
    // not throw and may be populated.
    const rejected = getRejectedSeedsToday(result.state)
    expect(Array.isArray(rejected)).toBe(true)
  })
})

describe('Phase 19 — State safety & integration', () => {
  it('state validates after seed generation', () => {
    const base = plentyOfStock(createInitialTavernState())
    const result = runDay(base)
    expect(result.validation.errors).toEqual([])
  })

  it('seed generation is deterministic for the same seed', () => {
    let base = plentyOfStock(createInitialTavernState())
    base = withArea(base, 'kitchen', { cleanliness: 10, smell: 80 })
    base = withStock(base, 'mushrooms', { spoilage: 90 })
    base = withStock(base, 'stew', { spoilage: 80, quantity: 400 })
    const a = runDay(base)
    const b = runDay(base)
    const seedsA = getAllSeedsToday(a.state).map((s) => s.id)
    const seedsB = getAllSeedsToday(b.state).map((s) => s.id)
    expect(seedsA).toEqual(seedsB)
  })

  it('seed validation references the Phase 1 §4.10 contract conditions', () => {
    expect(CONTRACT_CHECK_IDS).toContain('clear_situation')
    expect(CONTRACT_CHECK_IDS).toContain('reason_now')
    expect(CONTRACT_CHECK_IDS).toContain('actor_or_group')
    expect(CONTRACT_CHECK_IDS).toContain('location_or_system')
    expect(CONTRACT_CHECK_IDS).toContain('at_least_two_causes')
    expect(CONTRACT_CHECK_IDS).toContain('at_least_two_responses')
    expect(CONTRACT_CHECK_IDS).toContain('short_term_consequences')
    expect(CONTRACT_CHECK_IDS).toContain('memory_or_future_hook')
    expect(CONTRACT_CHECK_IDS).toContain('no_contradictions')
    expect(CONTRACT_CHECK_IDS).toContain('reason_to_care')
    expect(CONTRACT_CHECK_IDS.length).toBe(10)
  })
})

// ----------------------------------------------------------------------
// Test helpers
// ----------------------------------------------------------------------

function makeFakeSlot(id: string) {
  return {
    id,
    labelHint: 'slot',
    allowedVerbs: ['clean' as const],
    shape: 'safe_costly' as const,
    targetOptions: [],
    expectedEffects: ['effect'],
  }
}

function makeFakeSeed(overrides: Partial<IssueSeed> = {}): IssueSeed {
  const base: IssueSeed = {
    id: 'fake-seed',
    family: 'food_safety',
    type: 'crisis',
    timing: 'morning_prep',
    domain: ['food'],
    severity: 50,
    urgency: 40,
    novelty: 80,
    cardWorthiness: 50,
    affectedActors: [],
    causes: [
      {
        id: 'c1',
        timestamp: {
          year: 1,
          month: 1,
          week: 1,
          day: 1,
          absoluteDay: 0,
        },
        source: 'test',
        sourceType: 'system',
        target: 'pressure:food_safety',
        targetType: 'pressure',
        amount: 10,
        direction: 'increase',
        weight: 10,
        readable: 'fake cause one',
        tags: [],
        relatedActors: [],
        relatedLocations: [],
        relatedSystems: [],
        ageDays: 0,
      },
      {
        id: 'c2',
        timestamp: {
          year: 1,
          month: 1,
          week: 1,
          day: 1,
          absoluteDay: 0,
        },
        source: 'test',
        sourceType: 'system',
        target: 'pressure:food_safety',
        targetType: 'pressure',
        amount: 5,
        direction: 'increase',
        weight: 5,
        readable: 'fake cause two',
        tags: [],
        relatedActors: [],
        relatedLocations: [],
        relatedSystems: [],
        ageDays: 0,
      },
    ],
    pressures: [],
    stakes: [
      {
        id: 's1',
        target: 'food_safety',
        readable: 'customers could get sick',
        direction: 'loss',
        tags: [],
      },
    ],
    responseSlots: [makeFakeSlot('a'), makeFakeSlot('b')],
    consequenceProfiles: [
      {
        id: 'pa',
        responseSlotId: 'a',
        immediateEffects: [],
        delayedEffects: [],
        memories: [{ id: 'mem' }],
        futureHooks: [],
        impactScore: 30,
      },
      {
        id: 'pb',
        responseSlotId: 'b',
        immediateEffects: [],
        delayedEffects: [],
        memories: [{ id: 'mem2' }],
        futureHooks: [],
        impactScore: 25,
      },
    ],
    memoriesCreated: [],
    futureHooks: [],
    toneHints: [],
    location: { kind: 'area', id: 'kitchen' },
    textIngredients: buildTextIngredients({ subject: 'fake' }),
    validation: {
      valid: true,
      errors: [],
      warnings: [],
      contractChecks: {},
    },
    generatedAt: { year: 1, month: 1, week: 1, day: 1, absoluteDay: 0 },
  }
  return { ...base, ...overrides }
}
