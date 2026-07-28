// Phase 206 / gameplay-audit Wave 7 prep — the balance harness's own gate.
//
// Wave 7 has no findings. Its whole deliverable is a set of NUMBERS and a
// verdict drawn from them, which makes the measuring instrument the thing
// that can be wrong. Every other wave's regression tests protect the
// simulation; this one protects the harness, so a balance conclusion can
// never rest on a probe that quietly stopped measuring what it claims.
//
// The load-bearing assertion is the cross-validation against the Wave 6
// `DC-06` gate evidence: the same route, the same seed, the same numbers.
// If the harness ever drifts from the ceiling gate, that test fails before
// anyone reads a balance table.
//
// Runs are kept short (7 days) except where a published figure needs the
// full 28, so the file stays in the fast tier.

import { beforeAll, describe, expect, it } from 'vitest'

import {
  coreStateInvariantFailures,
  measureBalanceScenario,
  runBalanceScenario,
  type BalanceRunMetrics,
} from '../../src/sim/testing/balanceHarness'
import {
  ALL_BALANCE_VARIANT_IDS,
  ALL_DIFFICULTIES,
  BALANCE_STRATEGY_BOT_IDS,
  BALANCE_VARIANTS,
  METRIC_DIRECTION,
  OUTCOME_METRICS,
  aggregateBalanceCells,
  analyzeBalanceSlice,
  balanceMatrixSize,
  checkDifficultyMonotonicity,
  compareVariants,
  runBalanceMatrix,
} from '../../src/sim/testing/balanceMatrix'
import { PHASE_20_POLICY_BOTS } from '../../src/sim/testing/policyBots'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import { FULL_DAY_CARD_CEILING } from '../../src/sim/modules/issues/handBudget'

const SHORT = 7
const BOT = 'auto_clean_focused' as const

describe('Wave 7 harness — determinism', () => {
  it('produces byte-identical metrics for the same spec', () => {
    const spec = {
      botId: BOT,
      days: SHORT,
      seed: 'phase206-determinism',
      difficulty: 'standard' as const,
    }
    expect(JSON.stringify(measureBalanceScenario(spec))).toBe(
      JSON.stringify(measureBalanceScenario(spec)),
    )
  })

  it('produces different outcomes for different seeds', () => {
    const base = { botId: BOT, days: SHORT, difficulty: 'standard' as const }
    const a = measureBalanceScenario({ ...base, seed: 'phase206-seed-a' })
    const b = measureBalanceScenario({ ...base, seed: 'phase206-seed-b' })
    // Not a balance claim — just proof the seed is actually threaded, so a
    // multi-seed spread measures something.
    expect(a.cellId).not.toBe(b.cellId)
    expect(
      a.totalPatrons !== b.totalPatrons || a.finalCoin !== b.finalCoin,
    ).toBe(true)
  })
})

describe('Wave 7 harness — the levers it claims to control', () => {
  let none: BalanceRunMetrics
  let all: BalanceRunMetrics
  let partial: BalanceRunMetrics
  let passive: BalanceRunMetrics

  beforeAll(() => {
    const base = {
      botId: BOT,
      days: SHORT,
      seed: 'phase206-levers',
      difficulty: 'standard' as const,
    }
    none = measureBalanceScenario({ ...base, responses: 'none' })
    all = measureBalanceScenario({ ...base, responses: 'all' })
    partial = measureBalanceScenario({ ...base, responses: 'partial' })
    passive = measureBalanceScenario({
      ...base,
      ownerActions: 'none',
      responses: 'none',
    })
  })

  it('the response policy really changes how many cards are answered', () => {
    expect(none.totalResponsesResolved).toBe(0)
    expect(all.totalResponsesResolved).toBeGreaterThan(0)
    // The audit's Phase 7 fixture found bot intents carry a slot but no
    // target, and a targetless intent is dropped. A response variant that
    // resolved nothing would read as "answering changes nothing".
    expect(partial.totalResponsesResolved).toBeGreaterThan(0)
    expect(partial.totalResponsesResolved).toBeLessThan(
      all.totalResponsesResolved,
    )
  })

  it('the owner-action policy really changes what is queued', () => {
    expect(passive.totalOwnerActionsApplied).toBe(0)
    expect(passive.meanOwnerTimeUtilisation).toBe(0)
    expect(none.totalOwnerActionsApplied).toBeGreaterThan(0)
  })

  it('cards are still offered on a route that answers none of them', () => {
    // `responsesOffered` counts what was resolvable, not what was picked —
    // otherwise a no-response variant could not be told apart from a day
    // with no cards at all.
    expect(none.totalResponsesOffered).toBeGreaterThan(0)
  })

  it('the difficulty preset reaches the run', () => {
    const base = { botId: BOT, days: 3, seed: 'phase206-difficulty' }
    const easy = measureBalanceScenario({ ...base, difficulty: 'easy' })
    const hard = measureBalanceScenario({ ...base, difficulty: 'hard' })
    // `applyDifficultyToBase` sets starting coin 150 / 100 / 75 and shifts
    // three pressures; if the preset were dropped these would be equal.
    expect(easy.maxCoin).toBeGreaterThan(hard.maxCoin)
  })
})

describe('Wave 7 harness — agreement with the Wave 6 DC-06 gate', () => {
  // `docs/audits/2026-07-26-gameplay-audit/REMEDIATION_QUEUE.md`, Wave 6
  // gate evidence: the audit's own passive 28-day route on
  // `phase7-integrated-shared` measured 3.46 cards/day, peaking at 5.
  //
  // This is the harness's calibration point. It reads the SAME
  // `surfacedToday` ledger the ceiling gate reads, so a change to what
  // counts as "exposed" fails here rather than silently re-scaling every
  // Wave 7 decision-load number.
  let audit: BalanceRunMetrics

  beforeAll(() => {
    audit = measureBalanceScenario({
      botId: 'auto_no_owner_actions',
      days: 28,
      seed: 'phase7-integrated-shared',
      difficulty: 'standard',
      ownerActions: 'none',
      responses: 'none',
    })
  })

  it('reproduces the published card load exactly', () => {
    expect(audit.meanCardsPerDay).toBe(3.46)
    expect(audit.maxCardsPerDay).toBe(5)
    expect(audit.maxCardsPerDay).toBeLessThanOrEqual(FULL_DAY_CARD_CEILING)
  })

  it('reproduces the published run outcome exactly', () => {
    // Phase 7 §5.1, no-action row: 1,043 coin and 828 patrons over 28
    // standard days. Unchanged since the audit, so the harness is driving
    // the same route the audit drove.
    expect(audit.finalCoin).toBe(1043)
    expect(audit.totalPatrons).toBe(828)
  })

  it('prices choices as an upper bound on the real render', () => {
    // Wave 6 measured 15.68 choices/day and 439 over 28 days with the real
    // card renderer. The sim-side `renderedChoiceCost` is deliberately an
    // upper bound, so the harness's default must sit at or above that and
    // must never be quoted against the 24-button ceiling without
    // `--render`.
    expect(audit.meanChoicesPerDay).toBeGreaterThanOrEqual(15.68)
    expect(audit.totalChoicesRendered).toBeGreaterThanOrEqual(439)
  })

  it('reproduces the published family-streak figure', () => {
    // Wave 6 cut the passive route's longest streaks to 3/2/3/2.
    expect(audit.longestFamilyStreak).toBeLessThanOrEqual(3)
  })
})

describe('Wave 7 harness — invariants', () => {
  it('shares one invariant contract with the Wave 1 gate', () => {
    const clean = createInitialTavernState()
    expect(coreStateInvariantFailures(clean, 'clean')).toEqual([])

    const broke = createInitialTavernState()
    broke.coin = -1
    expect(coreStateInvariantFailures(broke, 'broke')).toEqual([
      'broke: coin -1 < 0',
    ])
  })

  it('records invariant failures per day rather than only at the end', () => {
    const run = runBalanceScenario({
      botId: BOT,
      days: 3,
      seed: 'phase206-invariants',
      difficulty: 'standard',
    })
    for (const day of run.days) {
      expect(day.invariantFailures).toEqual([])
      expect(day.validationErrorCount).toBe(0)
    }
  })
})

describe('Wave 7 matrix — shape and analysis', () => {
  it('covers every strategy, difficulty and variant the audit names', () => {
    // Phase 8 §7 asks for the eight strategies plus Easy and Hard.
    expect(BALANCE_STRATEGY_BOT_IDS.length).toBe(8)
    expect(BALANCE_STRATEGY_BOT_IDS).not.toContain('manual_debug')
    expect([...BALANCE_STRATEGY_BOT_IDS].sort()).toEqual(
      PHASE_20_POLICY_BOTS.filter((bot) => bot.id !== 'manual_debug')
        .map((bot) => bot.id)
        .sort(),
    )
    expect([...ALL_DIFFICULTIES].sort()).toEqual(['easy', 'hard', 'standard'])
    expect(ALL_BALANCE_VARIANT_IDS.length).toBe(5)
    for (const id of ALL_BALANCE_VARIANT_IDS) {
      expect(BALANCE_VARIANTS[id].id).toBe(id)
    }
  })

  it('gives every rankable metric a direction', () => {
    for (const metric of OUTCOME_METRICS) {
      expect(METRIC_DIRECTION[metric]).toBeDefined()
    }
  })

  it('sizes a sweep without running it', () => {
    expect(
      balanceMatrixSize({
        botIds: BALANCE_STRATEGY_BOT_IDS,
        difficulties: ALL_DIFFICULTIES,
        variants: ALL_BALANCE_VARIANT_IDS,
        seeds: ['a', 'b', 'c'],
        days: 28,
      }),
    ).toBe(360)
  })

  it('aggregates across seeds and refuses to rank a tie as a lead', () => {
    const matrix = runBalanceMatrix({
      botIds: ['auto_clean_focused', 'auto_profit_focused'],
      difficulties: ['standard'],
      variants: ['full', 'no_action'],
      seeds: ['phase206-matrix'],
      days: SHORT,
    })
    expect(matrix.rows.length).toBe(4)

    const cells = aggregateBalanceCells(matrix.rows)
    expect(cells.length).toBe(4)
    expect(cells.every((cell) => cell.trustworthy)).toBe(true)

    // `no_action` pulls no lever the bot controls, so both strategies must
    // produce the identical run — and the analysis must call that a tie,
    // not crown whichever bot happens to be listed first.
    const idle = analyzeBalanceSlice(cells, 'standard', 'no_action')
    expect(idle.allStrategiesTied).toBe(true)
    expect(idle.dominantStrategy).toBeUndefined()
    expect(idle.deadStrategies).toEqual([])
    for (const row of idle.leadership) expect(row.leadsOn).toEqual([])

    // The active slice must differentiate, which is what the Phase 20
    // strategy-comparison contract has always required.
    const active = analyzeBalanceSlice(cells, 'standard', 'full')
    expect(active.leadership.some((row) => row.leadsOn.length > 0)).toBe(true)
    expect(active.excludedCells).toEqual([])
  })

  it('compares variants against a baseline variant', () => {
    const matrix = runBalanceMatrix({
      botIds: ['auto_clean_focused'],
      difficulties: ['standard'],
      variants: ['full', 'no_action'],
      seeds: ['phase206-agency'],
      days: SHORT,
    })
    const cells = aggregateBalanceCells(matrix.rows)
    const comparisons = compareVariants(cells, 'no_action', 'full')
    expect(comparisons.length).toBe(OUTCOME_METRICS.length)
    for (const row of comparisons) {
      expect(row.baseline.variant).toBe('no_action')
      expect(row.compared.variant).toBe('full')
    }
  })

  it('reports nothing when a difficulty is missing from the matrix', () => {
    const matrix = runBalanceMatrix({
      botIds: ['auto_clean_focused'],
      difficulties: ['standard'],
      variants: ['full'],
      seeds: ['phase206-monotonic'],
      days: 3,
    })
    // The ordering check needs all three difficulties; a partial sweep must
    // produce no rows rather than an ordering built on a missing arm.
    expect(
      checkDifficultyMonotonicity(aggregateBalanceCells(matrix.rows)),
    ).toEqual([])
  })
})
