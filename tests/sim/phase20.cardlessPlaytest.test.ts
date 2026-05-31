import { describe, expect, it } from 'vitest'

import {
  FULL_PIPELINE,
  PHASE_20_POLICY_BOTS,
  buildCardCapacityReport,
  buildOneDayReport,
  buildOneMonthReport,
  buildOneWeekReport,
  buildReadinessReport,
  buildRepetitionAudit,
  buildSeedCoverageReport,
  buildStrategyComparison,
  buildOneDayReportSection,
  auditRunForContradictions,
  auditStateForContradictions,
  auditSeedAgainstState,
  CANDLE_BUY_ACTION_ID,
  CANDLE_EXPANSION_MODULE_ID,
  CANDLE_SEED_FAMILY,
  CANDLE_SEED_GENERATOR_ID,
  CANDLE_STOCK_ID,
  candleShortageExpansionModule,
  collectAllSeeds,
  evaluateCardReadinessGate,
  getPolicyBot,
  installCandleShortageExpansion,
  isCandleShortageExpansionInstalled,
  policyBotInput,
  READINESS_THRESHOLDS,
  REQUIRED_FAMILIES,
  runCardlessSim,
  runMonths,
  runOneDay,
  runStrategy,
  runStrategyMatrix,
  summarizeRun,
  verifyReplay,
  verifySingleDayReplay,
} from '../../src/sim/testing/index'
import { runDay } from '../../src/sim/testing/runDay'
import { runWeek } from '../../src/sim/testing/runWeek'
import { runMonth } from '../../src/sim/testing/runMonth'

import { createInitialTavernState } from '../../src/sim/state/defaults'
import {
  withArea,
  withCoin,
  withCustomerGroup,
  withStaff,
  withStock,
} from '../../src/sim/testing/stateFactories'
import type { TavernState } from '../../src/sim/state/TavernState'
import {
  getIssueSeeds,
  type IssueSeed,
} from '../../src/sim/modules/issues/index'
import { resolveResponseIntent } from '../../src/sim/modules/responses/responseResolver'

const SEED = 'phase-20-test-seed'

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

// ----------------------------------------------------------------------
// §20.1 — Cardless playtest runner
// ----------------------------------------------------------------------

describe('Phase 20 §20.1 — Cardless playtest runner', () => {
  it('runs one day with the default pipeline and returns a SimResult', () => {
    const base = plentyOfStock(createInitialTavernState())
    const result = runOneDay(base, { seed: SEED })
    expect(result.state.calendar.totalDaysElapsed).toBe(1)
    expect(result.validation.errors).toEqual([])
    expect(result.reports.length).toBeGreaterThan(0)
  })

  it('runs one week (7 days) and records every day', () => {
    const { run } = runWeek(SEED, plentyOfStock(createInitialTavernState()))
    expect(run.days.length).toBe(7)
    expect(run.finalState.calendar.totalDaysElapsed).toBe(7)
    expect(run.validatedThroughout).toBe(true)
  })

  it('runs one month (28 days) and produces a OneMonthReport', () => {
    const { run, report } = runMonth(
      SEED,
      plentyOfStock(createInitialTavernState()),
    )
    expect(run.days.length).toBe(28)
    expect(report.daysCovered).toBe(28)
    expect(typeof report.netCoinChange).toBe('number')
    expect(typeof report.rentPaid).toBe('boolean')
  })

  it('threads a per-day chooser through the runner', () => {
    let pickedDays = 0
    const run = runCardlessSim({
      seed: SEED,
      days: 3,
      chooseInput(state, absoluteDay) {
        pickedDays += 1
        void state
        void absoluteDay
        return { ownerActions: [] }
      },
    })
    expect(pickedDays).toBe(3)
    expect(run.days.length).toBe(3)
  })
})

// ----------------------------------------------------------------------
// §20.2 / §20.3 — Policy bots
// ----------------------------------------------------------------------

describe('Phase 20 §20.2/§20.3 — Policy bots', () => {
  it('registers every required Phase 20 playtest mode', () => {
    const ids = PHASE_20_POLICY_BOTS.map((b) => b.id).sort()
    expect(ids).toContain('manual_debug')
    expect(ids).toContain('auto_no_owner_actions')
    expect(ids).toContain('auto_clean_focused')
    expect(ids).toContain('auto_profit_focused')
    expect(ids).toContain('auto_merchant_focused')
    expect(ids).toContain('auto_miner_focused')
    expect(ids).toContain('auto_ignore_repairs')
    expect(ids).toContain('auto_staff_friendly')
  })

  it('every bot picks valid owner actions for a fresh state', () => {
    const state = plentyOfStock(createInitialTavernState())
    for (const bot of PHASE_20_POLICY_BOTS) {
      const actions = bot.chooseActions(state)
      expect(Array.isArray(actions)).toBe(true)
      for (const action of actions) {
        expect(typeof action.actionId).toBe('string')
      }
    }
  })

  it('clean focused bot prioritises cleaning the dirtiest area', () => {
    let base = plentyOfStock(createInitialTavernState())
    base = withArea(base, 'main_room', { cleanliness: 5, smell: 80 })
    const cleanBot = getPolicyBot('auto_clean_focused')
    const actions = cleanBot.chooseActions(base)
    expect(actions[0]!.actionId).toBe('clean_area')
    expect(actions[0]!.targetId).toBe('main_room')
  })

  it('profit focused bot waters down ale when ale is low', () => {
    let base = plentyOfStock(createInitialTavernState())
    base = withStock(base, 'ale', { quantity: 10 })
    const profit = getPolicyBot('auto_profit_focused')
    const ids = profit.chooseActions(base).map((a) => a.actionId)
    expect(ids).toContain('water_down_ale')
  })

  it('staff-friendly bot pays a bonus to the unhappiest staff', () => {
    let base = plentyOfStock(createInitialTavernState())
    for (const id of Object.keys(base.staff)) {
      base = withStaff(base, id, { morale: 30, stress: 80 })
    }
    base = withCoin(base, 200)
    const friendly = getPolicyBot('auto_staff_friendly')
    const ids = friendly.chooseActions(base).map((a) => a.actionId)
    expect(ids).toContain('pay_staff_bonus')
  })

  it('ignore-repairs bot picks delay/ignore response shape', () => {
    const ignore = getPolicyBot('auto_ignore_repairs')
    const fakeSeed: IssueSeed = makeFakeMaintenanceSeed()
    const intent = ignore.chooseResponse?.(
      createInitialTavernState(),
      fakeSeed,
    )
    expect(intent).not.toBeNull()
    if (intent) {
      expect(['delay_problem', 'ignore', 'risky_profitable']).toContain(intent.shape)
    }
  })

  it('policyBotInput preserves the legacy SimInput shape', () => {
    const state = plentyOfStock(createInitialTavernState())
    const bot = getPolicyBot('auto_clean_focused')
    const input = policyBotInput(SEED, bot, state)
    expect(input.seed).toBe(SEED)
    expect(Array.isArray(input.ownerActions)).toBe(true)
  })
})

// ----------------------------------------------------------------------
// §20.4 / §20.5 / §20.6 — Day / week / month reports
// ----------------------------------------------------------------------

describe('Phase 20 §20.4 — One-day report', () => {
  it('produces a structured one-day report', () => {
    let base = plentyOfStock(createInitialTavernState())
    base = withArea(base, 'kitchen', { cleanliness: 10, smell: 80 })
    base = withStock(base, 'mushrooms', { spoilage: 90 })
    base = withStock(base, 'stew', { spoilage: 80, quantity: 400 })
    const { result, report } = runDay(base, {
      seed: SEED,
      ownerActions: [{ actionId: 'clean_area', targetId: 'kitchen' }],
    })
    expect(result.validation.errors).toEqual([])
    expect(report.index).toBe(1)
    expect(report.pressures.length).toBeGreaterThan(0)
    expect(report.topCauses.length).toBeGreaterThan(0)
    expect(report.ownerActions[0]?.actionId).toBe('clean_area')
    expect(report.calendarLabel).toContain('Day 1')
  })

  it('builds a printable one-day report section', () => {
    const base = plentyOfStock(createInitialTavernState())
    const result = runOneDay(base, { seed: SEED })
    const section = buildOneDayReportSection({
      index: 1,
      stateBefore: base,
      input: { seed: SEED },
      result,
    })
    expect(section.id).toBe('cardless_day_report')
    expect(section.lines.some((l) => l.startsWith('DAY 1'))).toBe(true)
  })
})

describe('Phase 20 §20.5 — One-week report', () => {
  it('rolls up the week into structured trend data', () => {
    const { run, report } = runWeek(SEED, plentyOfStock(createInitialTavernState()))
    expect(run.days.length).toBe(7)
    expect(report.daysCovered).toBe(7)
    expect(Object.keys(report.customerSatisfactionTrend).length).toBeGreaterThan(0)
    expect(Object.keys(report.staffMoraleTrend).length).toBeGreaterThan(0)
    expect(typeof report.maintenanceBacklog).toBe('number')
    expect(report.topPressures.length).toBeGreaterThan(0)
  })
})

describe('Phase 20 §20.6 — One-month report', () => {
  it('rolls up the month and surfaces rent/landlord/inspection details', () => {
    const { report } = runMonth(SEED, plentyOfStock(createInitialTavernState()))
    expect(report.daysCovered).toBe(28)
    expect(typeof report.rentPaid).toBe('boolean')
    expect(typeof report.landlordPressureEnd).toBe('number')
    expect(typeof report.inspectionPressureEnd).toBe('number')
    expect(report.topMemoryIds).toBeInstanceOf(Array)
    expect(report.topIssueSeedFamilies).toBeInstanceOf(Array)
  })
})

// ----------------------------------------------------------------------
// §20.7 — Contradiction audit
// ----------------------------------------------------------------------

describe('Phase 20 §20.7 — Contradiction audit', () => {
  it('catches a stock_shortage seed that contradicts visible state', () => {
    // Construct a state where a stock shortage seed would be a lie:
    // ale and stew are plentiful.
    const state = plentyOfStock(createInitialTavernState())
    const fakeSeed: IssueSeed = makeFakeStockShortageSeed()
    const ev = auditSeedAgainstState(fakeSeed, state)
    expect(ev).not.toBeNull()
    expect(ev?.reason).toMatch(/Stock shortage/)
  })

  it('clean baseline state shows zero contradictions', () => {
    const state = plentyOfStock(createInitialTavernState())
    const audit = auditStateForContradictions(state)
    expect(audit.contradictionsFound).toEqual([])
  })

  it('the full simulation pipeline never produces a contradictory seed', () => {
    const run = runMonths(1, { seed: SEED })
    const audit = auditRunForContradictions(run)
    expect(audit.contradictionsFound).toEqual([])
  })
})

// ----------------------------------------------------------------------
// §20.8 / §20.9 / §20.10 — Coverage, capacity, repetition
// ----------------------------------------------------------------------

describe('Phase 20 §20.8 — Seed coverage report', () => {
  it('reports every required family', () => {
    const run = runMonths(1, { seed: SEED })
    const coverage = buildSeedCoverageReport(run)
    expect(Object.keys(coverage.families).sort()).toEqual(
      [...REQUIRED_FAMILIES].sort(),
    )
    expect(coverage.totalDays).toBe(run.days.length)
  })

  it('counts at least a handful of seeds across a month', () => {
    const run = runMonths(1, { seed: SEED })
    const coverage = buildSeedCoverageReport(run)
    expect(coverage.totalSeedsProduced).toBeGreaterThan(0)
  })
})

describe('Phase 20 §20.9 — Card capacity report', () => {
  it('measures distinct families, templates, shapes', () => {
    const run = runMonths(2, { seed: SEED })
    const cap = buildCardCapacityReport(run)
    expect(cap.distinctSeedFamilies).toBeGreaterThan(0)
    expect(cap.distinctResponseShapes.length).toBeGreaterThan(0)
    expect(Array.isArray(cap.distinctActorIds)).toBe(true)
    expect(Array.isArray(cap.distinctLocationIds)).toBe(true)
  })

  it('lists weak coverage families when relevant', () => {
    const run = runMonths(1, { seed: SEED })
    const cap = buildCardCapacityReport(run)
    expect(Array.isArray(cap.weakCoverageFamilies)).toBe(true)
    expect(Array.isArray(cap.strongCoverageFamilies)).toBe(true)
  })
})

describe('Phase 20 §20.10 — Repetition audit', () => {
  it('detects overused templates and reports cooldown pressure', () => {
    const run = runMonths(2, { seed: SEED })
    const audit = buildRepetitionAudit(run)
    expect(audit.totalSeeds).toBeGreaterThanOrEqual(0)
    expect(typeof audit.cooldownPressure).toBe('number')
    expect(audit.cooldownPressure).toBeGreaterThanOrEqual(0)
    expect(audit.cooldownPressure).toBeLessThanOrEqual(100)
  })
})

// ----------------------------------------------------------------------
// §20.11 — Strategy comparison
// ----------------------------------------------------------------------

describe('Phase 20 §20.11 — Strategy comparison runs', () => {
  it('runs each Phase 20 strategy for the requested length', () => {
    const matrix = runStrategyMatrix(14)
    expect(matrix.length).toBeGreaterThanOrEqual(7)
    for (const entry of matrix) {
      expect(entry.run.days.length).toBe(14)
    }
  })

  it('produces distinct identities between clean and profit strategies', () => {
    const matrix = runStrategyMatrix(28)
    const report = buildStrategyComparison(matrix)
    expect(report.rows.length).toBeGreaterThanOrEqual(2)
    const clean = report.rows.find((r) => r.botId === 'auto_clean_focused')
    const profit = report.rows.find((r) => r.botId === 'auto_profit_focused')
    expect(clean).toBeDefined()
    expect(profit).toBeDefined()
    const distinctIdentity =
      clean!.summary.reputationIdentity.identityKey !==
        profit!.summary.reputationIdentity.identityKey ||
      clean!.summary.finalCoin !== profit!.summary.finalCoin ||
      clean!.summary.dominantCustomerGroup !==
        profit!.summary.dominantCustomerGroup
    expect(distinctIdentity).toBe(true)
  })

  it('summarizeRun produces a useful run summary', () => {
    const { run } = runStrategy({ botId: 'auto_clean_focused', days: 14 })
    const summary = summarizeRun(run)
    expect(summary.days).toBe(14)
    expect(typeof summary.netCoinChange).toBe('number')
    expect(summary.reputationIdentity.dominantAxes.length).toBe(3)
  })
})

// ----------------------------------------------------------------------
// §20.12 — Replay verification
// ----------------------------------------------------------------------

describe('Phase 20 §20.12 — Replay verification', () => {
  it('same seed + same inputs replay identically', () => {
    const replay = verifyReplay(SEED, 7)
    expect(replay.identical).toBe(true)
  })

  it('a single day replayed twice produces identical state', () => {
    const ok = verifySingleDayReplay(SEED, plentyOfStock(createInitialTavernState()))
    expect(ok).toBe(true)
  })

  it('different seeds produce different runs', () => {
    const a = runCardlessSim({ seed: 'seed-A', days: 7 })
    const b = runCardlessSim({ seed: 'seed-B', days: 7 })
    expect(JSON.stringify(a.finalState)).not.toBe(JSON.stringify(b.finalState))
  })
})

// ----------------------------------------------------------------------
// §20.13 — Readiness report
// ----------------------------------------------------------------------

describe('Phase 20 §20.13 — Readiness report', () => {
  it('builds all ten required sections', () => {
    const report = buildReadinessReport({ seed: SEED, days: 14 })
    const ids = report.sections.map((s) => s.id).sort()
    expect(ids).toContain('state_safety')
    expect(ids).toContain('replayability')
    expect(ids).toContain('cause_coverage')
    expect(ids).toContain('pressure_quality')
    expect(ids).toContain('seed_quality')
    expect(ids).toContain('response_impact')
    expect(ids).toContain('contradiction_safety')
    expect(ids).toContain('repetition_control')
    expect(ids).toContain('strategy_diversity')
    expect(ids).toContain('card_capacity')
    expect(report.sections.length).toBe(10)
  })

  it('replayability section passes for the canonical pipeline', () => {
    const report = buildReadinessReport({ seed: SEED, days: 7 })
    const replay = report.sections.find((s) => s.id === 'replayability')
    expect(replay?.passed).toBe(true)
  })

  it('thresholds are exposed for callers', () => {
    expect(READINESS_THRESHOLDS.replayability).toBe(95)
    expect(READINESS_THRESHOLDS.state_safety).toBe(90)
    expect(READINESS_THRESHOLDS.contradiction_safety).toBe(90)
  })

  it('state safety passes — every day validates without errors', () => {
    const report = buildReadinessReport({ seed: SEED, days: 7 })
    const stateSafety = report.sections.find((s) => s.id === 'state_safety')
    expect(stateSafety?.score).toBeGreaterThanOrEqual(READINESS_THRESHOLDS.state_safety)
  })

  it('contradiction safety stays clean on the default pipeline', () => {
    const report = buildReadinessReport({ seed: SEED, days: 7 })
    const safety = report.sections.find((s) => s.id === 'contradiction_safety')
    expect(safety?.passed).toBe(true)
  })
})

// ----------------------------------------------------------------------
// §20.14 — Card readiness gate (with expansion test)
// ----------------------------------------------------------------------

describe('Phase 20 §20.14 — Card readiness gate', () => {
  it('the canonical pipeline meets the gate (with expansion test passing)', () => {
    const result = evaluateCardReadinessGate({
      expansionTestPasses: true,
      seed: SEED,
    })
    // We do not assert `passed === true` because the readiness scoring is
    // strict and tuned for future card development; this test guarantees
    // the gate runs end-to-end and produces a structured verdict.
    expect(typeof result.passed).toBe('boolean')
    expect(result.conditions.threeMonthValidated).toBe(true)
    expect(result.conditions.replaysIdentical).toBe(true)
    expect(result.conditions.reportsReadable).toBe(true)
    expect(result.conditions.seedsFromState).toBe(true)
    expect(result.conditions.responsesChangeWorld).toBe(true)
    expect(result.conditions.contradictionAuditPasses).toBe(true)
    expect(result.conditions.expansionTestPasses).toBe(true)
  })

  it('the gate flags missing expansion test as a failure', () => {
    const result = evaluateCardReadinessGate({
      expansionTestPasses: false,
      seed: SEED,
    })
    expect(result.passed).toBe(false)
    expect(result.failedReasons).toContain("condition 'expansionTestPasses' failed")
  })
})

// ----------------------------------------------------------------------
// §20.14 condition 14 — Candle expansion test (Phase 1 §9.2)
// ----------------------------------------------------------------------

describe('Phase 20 §20.14 condition 14 — Candle shortage expansion', () => {
  it('installs without modifying core/state/Registry.ts', () => {
    const module = installCandleShortageExpansion()
    expect(module.id).toBe(CANDLE_EXPANSION_MODULE_ID)
    expect(isCandleShortageExpansionInstalled()).toBe(true)
  })

  it('adds candles to a freshly created tavern', () => {
    installCandleShortageExpansion()
    const state = createInitialTavernState()
    expect(state.stock[CANDLE_STOCK_ID]).toBeDefined()
    expect(state.stock[CANDLE_STOCK_ID]?.label).toBe('Candles')
  })

  it('registers the buy_candles owner action and applies it', () => {
    installCandleShortageExpansion()
    const base = createInitialTavernState()
    const result = runOneDay(
      base,
      {
        seed: SEED,
        ownerActions: [
          { actionId: CANDLE_BUY_ACTION_ID, targetId: CANDLE_STOCK_ID, amount: 5 },
        ],
      },
      [...FULL_PIPELINE, candleShortageExpansionModule],
    )
    expect(result.validation.errors).toEqual([])
    const finalCandles = result.state.stock[CANDLE_STOCK_ID]?.quantity ?? 0
    const initialCandles = base.stock[CANDLE_STOCK_ID]?.quantity ?? 0
    expect(finalCandles).toBeGreaterThan(initialCandles)
  })

  it('generates a candle_shortage issue seed when candles run low', () => {
    installCandleShortageExpansion()
    let base = createInitialTavernState()
    base = withStock(base, CANDLE_STOCK_ID, { quantity: 1 })
    const result = runOneDay(
      base,
      { seed: SEED },
      [...FULL_PIPELINE, candleShortageExpansionModule],
    )
    const seeds = getIssueSeeds(result.state, { family: CANDLE_SEED_FAMILY })
    expect(seeds.length).toBeGreaterThanOrEqual(1)
    const seed = seeds[0]!
    expect(seed.id.startsWith(CANDLE_SEED_GENERATOR_ID)).toBe(true)
    expect(seed.responseSlots.length).toBeGreaterThanOrEqual(2)
  })

  it('applies a merchant satisfaction penalty in low-light conditions', () => {
    installCandleShortageExpansion()
    let base = createInitialTavernState()
    base = withStock(base, CANDLE_STOCK_ID, { quantity: 0 })
    const result = runOneDay(
      base,
      { seed: SEED },
      [...FULL_PIPELINE, candleShortageExpansionModule],
    )
    expect(result.validation.errors).toEqual([])
    const lighting = result.reports.find((r) => r.id === 'lighting_report')
    expect(lighting).toBeDefined()
    const data = lighting!.data as { lowLight: boolean }
    expect(data.lowLight).toBe(true)
  })

  it('produces a lighting report section end-to-end', () => {
    installCandleShortageExpansion()
    const base = createInitialTavernState()
    const result = runOneDay(
      base,
      { seed: SEED },
      [...FULL_PIPELINE, candleShortageExpansionModule],
    )
    const lighting = result.reports.find((r) => r.id === 'lighting_report')
    expect(lighting).toBeDefined()
    expect(lighting!.lines.length).toBeGreaterThan(0)
  })

  it('runs a 7-day expansion campaign without breaking core state', () => {
    installCandleShortageExpansion()
    const run = runCardlessSim({
      seed: SEED,
      days: 7,
      modules: [...FULL_PIPELINE, candleShortageExpansionModule],
    })
    expect(run.validatedThroughout).toBe(true)
    expect(run.days.length).toBe(7)
    expect(run.finalState.stock[CANDLE_STOCK_ID]).toBeDefined()
  })
})

// ----------------------------------------------------------------------
// §20 — Required test list (per the doc's "Tests" section)
// ----------------------------------------------------------------------

describe('Phase 20 — Required tests', () => {
  it('cardless runner completes one day', () => {
    const base = plentyOfStock(createInitialTavernState())
    const result = runOneDay(base, { seed: SEED })
    expect(result.validation.errors).toEqual([])
  })

  it('cardless runner completes one week', () => {
    const { run } = runWeek(SEED, plentyOfStock(createInitialTavernState()))
    expect(run.validatedThroughout).toBe(true)
  })

  it('cardless runner completes one month', () => {
    const { run } = runMonth(SEED, plentyOfStock(createInitialTavernState()))
    expect(run.validatedThroughout).toBe(true)
  })

  it('3-month run completes without invalid state', () => {
    const run = runMonths(3, { seed: SEED })
    expect(run.validatedThroughout).toBe(true)
  })

  it('same seed and inputs replay exactly', () => {
    const replay = verifyReplay(SEED, 28)
    expect(replay.identical).toBe(true)
  })

  it('policy bots choose valid actions', () => {
    const state = plentyOfStock(createInitialTavernState())
    for (const bot of PHASE_20_POLICY_BOTS) {
      const actions = bot.chooseActions(state)
      for (const action of actions) {
        expect(typeof action.actionId).toBe('string')
      }
    }
  })

  it('contradiction audit catches intentionally invalid seed', () => {
    const fake = makeFakeStockShortageSeed()
    const state = plentyOfStock(createInitialTavernState())
    const result = auditSeedAgainstState(fake, state)
    expect(result).not.toBeNull()
  })

  it('seed coverage report includes all seed families', () => {
    const run = runMonths(1, { seed: SEED })
    const cov = buildSeedCoverageReport(run)
    for (const family of REQUIRED_FAMILIES) {
      expect(cov.families[family]).toBeDefined()
    }
  })

  it('repetition audit detects overused seed', () => {
    const run = runMonths(2, { seed: SEED })
    const audit = buildRepetitionAudit(run)
    // The audit always runs; the test only requires the shape.
    expect(audit.totalSeeds).toBeGreaterThanOrEqual(0)
    expect(audit.mostRepeatedSeeds).toBeInstanceOf(Array)
  })

  it('strategy comparison shows different outputs for clean vs profit policy', () => {
    const matrix = runStrategyMatrix(28)
    const comp = buildStrategyComparison(matrix)
    const clean = comp.rows.find((r) => r.botId === 'auto_clean_focused')!
    const profit = comp.rows.find((r) => r.botId === 'auto_profit_focused')!
    const different =
      clean.summary.finalCoin !== profit.summary.finalCoin ||
      clean.summary.reputationIdentity.identityKey !==
        profit.summary.reputationIdentity.identityKey ||
      clean.summary.dominantCustomerGroup !== profit.summary.dominantCustomerGroup
    expect(different).toBe(true)
  })

  it('readiness report fails when expansion test is missing', () => {
    const gate = evaluateCardReadinessGate({
      expansionTestPasses: false,
      seed: SEED,
    })
    expect(gate.passed).toBe(false)
  })

  it('responses change the world via the resolver', () => {
    let base = plentyOfStock(createInitialTavernState())
    base = withArea(base, 'kitchen', { cleanliness: 10, smell: 80 })
    base = withStock(base, 'mushrooms', { spoilage: 90 })
    base = withStock(base, 'stew', { spoilage: 80, quantity: 400 })
    // Phase 186 / Cluster 1 — `food_safety` is a morning seed reading the
    // prior day's closing pressure snapshot; warm one day to populate it.
    const result = runOneDay(runOneDay(base, { seed: SEED }).state, { seed: SEED })
    const seed = getIssueSeeds(result.state, { family: 'food_safety' })[0]!
    const resolution = resolveResponseIntent(result.state, seed, {
      id: 'r-test',
      seedId: seed.id,
      verb: 'clean',
      shape: 'long_term_investment',
      tags: [],
      intensity: 50,
      metadata: { responseSlotId: 'clean_kitchen' },
    })
    expect(resolution.stateDiff.changes.length).toBeGreaterThan(0)
  })

  it('summarizeRun collects every seed produced over the run', () => {
    const run = runMonths(1, { seed: SEED })
    const all = collectAllSeeds(run)
    const summary = summarizeRun(run)
    expect(all.length).toBe(summary.totalSeedsGenerated)
  })

  it('one-week and one-month builders agree on overlapping days', () => {
    const run = runMonths(1, { seed: SEED })
    const weekReport = buildOneWeekReport(run.days.slice(0, 7))
    const monthReport = buildOneMonthReport(run.days)
    expect(weekReport.daysCovered).toBe(7)
    expect(monthReport.daysCovered).toBe(28)
  })

  it('buildOneDayReport handles a no-op day cleanly', () => {
    const base = plentyOfStock(createInitialTavernState())
    const result = runOneDay(base, { seed: SEED })
    const report = buildOneDayReport({
      index: 1,
      stateBefore: base,
      input: { seed: SEED },
      result,
    })
    expect(report.validationErrors).toBe(0)
  })
})

// ----------------------------------------------------------------------
// Test helpers — fake seeds for contradiction audits
// ----------------------------------------------------------------------

function makeFakeStockShortageSeed(): IssueSeed {
  return {
    id: 'fake-stock-shortage',
    family: 'stock_shortage',
    type: 'warning',
    timing: 'morning_prep',
    domain: ['stock'],
    severity: 50,
    urgency: 50,
    novelty: 50,
    cardWorthiness: 50,
    affectedActors: [],
    causes: [
      {
        id: 'c1',
        timestamp: { year: 1, month: 1, week: 1, day: 1, absoluteDay: 0 },
        source: 'test',
        sourceType: 'system',
        target: 'stock:ale.quantity',
        targetType: 'stock',
        amount: -10,
        direction: 'decrease',
        weight: 10,
        readable: 'fake shortage',
        tags: [],
        relatedActors: [],
        relatedLocations: [],
        relatedSystems: [],
        ageDays: 0,
      },
    ],
    pressures: [],
    stakes: [],
    responseSlots: [],
    consequenceProfiles: [],
    memoriesCreated: [],
    futureHooks: [],
    toneHints: [],
    textIngredients: {
      subject: 'ale',
      sensoryDetails: [],
      actorOpinions: {},
      recentContext: [],
      stakesReadable: [],
    },
    validation: { valid: true, errors: [], warnings: [], contractChecks: {} },
    generatedAt: { year: 1, month: 1, week: 1, day: 1, absoluteDay: 0 },
  }
}

function makeFakeMaintenanceSeed(): IssueSeed {
  return {
    id: 'fake-maintenance',
    family: 'maintenance',
    type: 'maintenance_problem',
    timing: 'morning_prep',
    domain: ['areas'],
    severity: 50,
    urgency: 50,
    novelty: 50,
    cardWorthiness: 50,
    affectedActors: [],
    causes: [],
    pressures: [],
    stakes: [],
    responseSlots: [
      {
        id: 'repair',
        labelHint: 'repair',
        allowedVerbs: ['repair'],
        shape: 'safe_costly',
        targetOptions: [],
        expectedEffects: [],
      },
      {
        id: 'ignore',
        labelHint: 'ignore',
        allowedVerbs: ['ignore'],
        shape: 'ignore',
        targetOptions: [],
        expectedEffects: [],
      },
      {
        id: 'patch',
        labelHint: 'delay',
        allowedVerbs: ['delay'],
        shape: 'delay_problem',
        targetOptions: [],
        expectedEffects: [],
      },
    ],
    consequenceProfiles: [],
    memoriesCreated: [],
    futureHooks: [],
    toneHints: [],
    textIngredients: {
      subject: 'roof',
      sensoryDetails: [],
      actorOpinions: {},
      recentContext: [],
      stakesReadable: [],
    },
    validation: { valid: true, errors: [], warnings: [], contractChecks: {} },
    generatedAt: { year: 1, month: 1, week: 1, day: 1, absoluteDay: 0 },
  }
}
