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
  metricSpreadOf,
  runBalanceMatrix,
  type BalanceCellAggregate,
  type BalanceMetricKey,
  type MetricSpread,
} from '../../src/sim/testing/balanceMatrix'
import { scoreBalanceSlice } from '../../src/sim/testing/balanceScoring'
import {
  PHASE_20_POLICY_BOTS,
  type PolicyBotId,
} from '../../src/sim/testing/policyBots'
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

describe('Wave 7 harness — agreement with the published calibration route', () => {
  // The harness's calibration point: the audit's own passive 28-day
  // route on `phase7-integrated-shared`. It reads the SAME
  // `surfacedToday` ledger the Wave 6 ceiling gate reads, so a change to
  // what counts as "exposed" fails here rather than silently re-scaling
  // every Wave 7 decision-load number.
  //
  // Wave 7's tuning pass moved the card-load figures on this route and
  // re-pinned them here, with the movement recorded in the queue's Wave 7
  // section: rumour decay and the attribution narrative merge changed
  // which seeds fire on the passive route, so 3.46 cards/day (Wave 6
  // gate) became 3.36. The ECONOMY figures did not move — Wave 7 tuned no
  // economic lever, and 1,043 coin / 828 patrons matching Phase 7 §5.1
  // exactly is the proof.
  //
  // Expansion Phase 3 (ISSUE-173) moved them again, and re-pinned them again for
  // the same reason: the route is passive, so every figure below is the
  // simulation's own behaviour rather than a bot's decisions, and this phase
  // changed that behaviour on purpose. Staff fatigue and stress now move by one
  // rule owned by the staff module rather than by the service module's copy of it,
  // absence is a real state a worn-out crew reaches, and the day's roster scales
  // what each hand contributes. So 3.36 cards/day became 3.21 and 828 patrons
  // became 823 — a passive tavern whose crew occasionally has a bad week serves
  // marginally fewer people and produces marginally fewer staff cards.
  //
  // `finalCoin` did NOT move: 1,043 still matches Phase 7 §5.1, which is the
  // evidence that this phase changed how the crew works and not what the tavern
  // earns per patron. Phase 5 owns the economy and Phase 13 re-baselines the
  // long-run matrix; this is a re-pin with the movement recorded, not a
  // re-tuning.
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
    // Wave 6 gate: 3.46 · 5. Post-Wave-7 tuning: 3.36 · 5. Post-Phase-3: 3.21 · 5.
    // Post-Phase-4: 3.18 · 5 — marginally fewer cards because a night that is
    // served in full raises fewer problems than one measured only in aggregate.
    expect(audit.meanCardsPerDay).toBe(3.18)
    expect(audit.maxCardsPerDay).toBe(5)
    expect(audit.maxCardsPerDay).toBeLessThanOrEqual(FULL_DAY_CARD_CEILING)
  })

  it('reproduces the published run outcome exactly', () => {
    // Phase 7 §5.1, no-action row: 1,043 coin and 828 patrons over 28
    // standard days. The coin was unchanged through both the Wave 7 tuning and
    // Expansion Phase 3, which was the evidence that neither touched an economic
    // lever. Patrons moved to 823 in Phase 3 because a worn-out crew is
    // occasionally a body short.
    //
    // EXPANSION PHASE 4 MOVES BOTH, AND THIS IS THE FINAL MOVEMENT: 1,078 coin
    // and 803 patrons. Coin is up 3.4% because a party now CHOOSES what it orders
    // and orders a little more of it (`SERVINGS_PER_PATRON`, calibrated against
    // the till rather than the plate count — see the note there). Patrons are
    // down 20 because the final flow preserves FIFO stock allocation and lets
    // real shortages and service outcomes affect later turnout. Re-pinned with
    // the movement recorded, not re-tuned; Phase 5 owns the economy and Phase
    // 13 re-baselines the long-run matrix.
    expect(audit.finalCoin).toBe(1078)
    expect(audit.totalPatrons).toBe(803)
  })

  it('prices choices as an upper bound on the real render', () => {
    // The sim-side `renderedChoiceCost` is deliberately an upper bound on
    // the real card render (Wave 6 measured the render at 15.68/day —
    // never quote a default-priced figure against the 24-button `DC-06`
    // ceiling; that comparison needs `--render`). Post-Wave-7 tuning the
    // upper bound read 15.71/day, 440 over 28 days; after Expansion Phase 3's
    // card-load movement it read 15.25/day, and after Phase 4's it reads
    // 14.86/day.
    expect(audit.meanChoicesPerDay).toBe(14.86)
    expect(audit.totalChoicesRendered).toBe(416)
  })

  it('reproduces the published family-streak figure', () => {
    // Wave 6 cut the passive route's longest streaks to 3/2/3/2, and the
    // Wave 7 exemption cap does not touch the passive route (nothing is
    // answered, so the exemption is never reached).
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

// ----------------------------------------------------------------------
// Codex review of PR #242 — the instrument fixes, pinned.
// ----------------------------------------------------------------------

describe('Wave 7 analysis — Codex review fixes', () => {
  // Build a synthetic slice: every metric identical across strategies
  // except the ones a test overrides, so leads come only from the
  // overridden axes.
  const makeCell = (
    botId: PolicyBotId,
    overrides: Partial<Record<BalanceMetricKey, number[]>>,
    seeds: string[] = ['s1', 's2'],
  ): BalanceCellAggregate => {
    const metrics = {} as Record<BalanceMetricKey, MetricSpread>
    for (const metric of Object.keys(METRIC_DIRECTION) as BalanceMetricKey[]) {
      metrics[metric] = metricSpreadOf(
        metric,
        overrides[metric] ?? seeds.map(() => 50),
      )
    }
    return {
      botId,
      botLabel: botId,
      difficulty: 'standard',
      variant: 'full',
      seeds,
      metrics,
      identityKeys: [`${botId}-identity`],
      dominantCustomerGroups: ['local_goblins'],
      trustworthy: true,
      untrustworthyReason: undefined,
    }
  }

  it('a shared environmental shift across seeds is not noise', () => {
    // Seed s2 is better for everyone by ~100 — a common shift. The
    // strategy gap is a consistent 20 on every seed, so the metric is
    // rankable even though the absolute spread (100) dwarfs the gap.
    const cells = [
      makeCell('auto_clean_focused', { finalCoin: [100, 200] }),
      makeCell('auto_profit_focused', { finalCoin: [120, 220] }),
    ]
    const analysis = analyzeBalanceSlice(cells, 'standard', 'full')
    expect(analysis.noisyMetrics).not.toContain('finalCoin')
    expect(
      analysis.leadership.find((row) => row.botId === 'auto_profit_focused')
        ?.leadsOn,
    ).toContain('finalCoin')
  })

  it('a seed-unstable ranking is noise and hands out no leadership', () => {
    // The leader flips between seeds: clean wins s1, profit wins s2.
    const cells = [
      makeCell('auto_clean_focused', { finalCoin: [200, 100] }),
      makeCell('auto_profit_focused', { finalCoin: [100, 210] }),
    ]
    const analysis = analyzeBalanceSlice(cells, 'standard', 'full')
    expect(analysis.noisyMetrics).toContain('finalCoin')
    for (const row of analysis.leadership) {
      expect(row.leadsOn).not.toContain('finalCoin')
      expect(row.trailsOn).not.toContain('finalCoin')
    }
  })

  it('a balanced compromise that leads nowhere is not dead', () => {
    // profit wins coin, clean wins satisfaction, merchant is second on
    // both — Pareto-nondominated, optimal under a mixed objective, and
    // the pre-fix "leads on nothing = dead" rule would have killed it.
    const cells = [
      makeCell('auto_profit_focused', {
        finalCoin: [300, 300],
        meanSatisfaction: [10, 10],
      }),
      makeCell('auto_clean_focused', {
        finalCoin: [100, 100],
        meanSatisfaction: [60, 60],
      }),
      makeCell('auto_merchant_focused', {
        finalCoin: [200, 200],
        meanSatisfaction: [40, 40],
      }),
    ]
    const analysis = analyzeBalanceSlice(cells, 'standard', 'full')
    expect(analysis.deadStrategies).not.toContain('auto_merchant_focused')
    expect(analysis.allStrategiesTied).toBe(false)
  })

  it('a strictly worse strategy is dead, and shared bests are not a tie', () => {
    // ignore_repairs is beaten by both others everywhere it differs and
    // better nowhere — Pareto-dominated. clean and profit tie on coin at
    // the top (a shared best), which must NOT read as "all strategies
    // tied" — and a tie on one axis with a real trade-off on another
    // (profit trails satisfaction but is not beaten on coin) is not
    // domination either.
    const cells = [
      makeCell('auto_clean_focused', {
        finalCoin: [300, 300],
        meanSatisfaction: [60, 60],
      }),
      makeCell('auto_profit_focused', {
        finalCoin: [300, 300],
        meanSatisfaction: [40, 40],
        meanMorale: [70, 70],
      }),
      makeCell('auto_ignore_repairs', {
        finalCoin: [100, 100],
        meanSatisfaction: [20, 20],
      }),
    ]
    const analysis = analyzeBalanceSlice(cells, 'standard', 'full')
    expect(analysis.allStrategiesTied).toBe(false)
    expect(analysis.deadStrategies).toContain('auto_ignore_repairs')
    expect(analysis.deadStrategies).not.toContain('auto_profit_focused')
  })

  it('untrustworthy cells are excluded from agency and difficulty checks', () => {
    const broken: BalanceCellAggregate = {
      ...makeCell('auto_clean_focused', { finalCoin: [999, 999] }),
      variant: 'no_action',
      trustworthy: false,
      untrustworthyReason: 'synthetic failure',
    }
    const compared = makeCell('auto_clean_focused', { finalCoin: [100, 100] })
    expect(compareVariants([broken, compared], 'no_action', 'full')).toEqual([])

    const easy = { ...makeCell('auto_clean_focused', {}), difficulty: 'easy' as const }
    const standard = makeCell('auto_clean_focused', {})
    const hard = {
      ...makeCell('auto_clean_focused', {}),
      difficulty: 'hard' as const,
      trustworthy: false,
      untrustworthyReason: 'synthetic failure',
    }
    expect(checkDifficultyMonotonicity([easy, standard, hard])).toEqual([])
  })

  it('labels each observation with the day it simulated, not the next', () => {
    const run = runBalanceScenario({
      botId: BOT,
      days: 2,
      seed: 'phase206-daytype',
      difficulty: 'standard',
    })
    // The initial calendar opens on a supplier day; pre-fix the first
    // observation read the day-2 type because Segment C had already
    // advanced the calendar.
    expect(run.days[0]?.dayType).toBe('supplier_day')
  })
})

describe('Wave 7 scoring layer — DC-03 identity through viability', () => {
  it('scores a healthy slice balanced and a dominated intended strategy as a problem', () => {
    const healthy = [
      cellWithOutcomes('auto_clean_focused', 300, 60),
      cellWithOutcomes('auto_profit_focused', 900, 20),
    ]
    const verdict = scoreBalanceSlice(healthy, 'standard', 'full')
    expect(verdict.balanced).toBe(true)
    expect(verdict.scores.every((score) => score.viable)).toBe(true)

    // merchant_focused strictly worse than clean on both axes → dominated,
    // and NOT a foil → a balance problem.
    const withDominated = [
      ...healthy,
      cellWithOutcomes('auto_merchant_focused', 200, 40),
    ]
    const worse = scoreBalanceSlice(withDominated, 'standard', 'full')
    expect(worse.balanced).toBe(false)
    expect(
      worse.problems.some((problem) =>
        problem.includes('auto_merchant_focused'),
      ),
    ).toBe(true)

    // The same domination on a listed foil is expected and not a problem.
    const withFoil = [
      ...healthy,
      cellWithOutcomes('auto_ignore_repairs', 200, 40),
    ]
    expect(scoreBalanceSlice(withFoil, 'standard', 'full').balanced).toBe(true)
  })

  it('fails viability on the DC-04 floors', () => {
    const cells = [
      cellWithOutcomes('auto_clean_focused', 300, 60),
      cellWithOutcomes('auto_profit_focused', 900, 20, {
        endingRentArrears: [120, 120],
        totalPatrons: [200, 200],
      }),
    ]
    const verdict = scoreBalanceSlice(cells, 'standard', 'full')
    expect(verdict.balanced).toBe(false)
    const profit = verdict.scores.find(
      (score) => score.botId === 'auto_profit_focused',
    )
    expect(profit?.viable).toBe(false)
    expect(profit?.viabilityFailures.length).toBeGreaterThan(0)
  })

  function cellWithOutcomes(
    botId: PolicyBotId,
    coin: number,
    satisfaction: number,
    overrides: Partial<Record<BalanceMetricKey, number[]>> = {},
  ): BalanceCellAggregate {
    const metrics = {} as Record<BalanceMetricKey, MetricSpread>
    for (const metric of Object.keys(METRIC_DIRECTION) as BalanceMetricKey[]) {
      const defaults: number[] =
        metric === 'finalCoin'
          ? [coin, coin]
          : metric === 'meanSatisfaction'
            ? [satisfaction, satisfaction]
            : metric === 'totalPatrons'
              ? [800, 800]
              : metric === 'meanMorale'
                ? [60, 60]
                : metric === 'endingRentArrears'
                  ? [0, 0]
                  : [50, 50]
      metrics[metric] = metricSpreadOf(metric, overrides[metric] ?? defaults)
    }
    return {
      botId,
      botLabel: botId,
      difficulty: 'standard',
      variant: 'full',
      seeds: ['s1', 's2'],
      metrics,
      identityKeys: [`${botId}-identity`],
      dominantCustomerGroups: ['local_goblins'],
      trustworthy: true,
      untrustworthyReason: undefined,
    }
  }
})
