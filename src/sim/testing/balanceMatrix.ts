import type { DifficultyId } from '../state/difficulty'
import { PHASE_20_POLICY_BOTS, type PolicyBotId } from './policyBots'
import {
  measureBalanceScenario,
  type BalanceRunMetrics,
  type BalanceScenarioSpec,
  type OwnerActionPolicy,
  type ResponsePolicy,
} from './balanceHarness'

// Phase 206 / gameplay-audit Wave 7 — the balance matrix and its
// objective-agnostic analysis.
//
// Phase 7 §5.2 could not deliver a balance verdict for two reasons, and
// both are addressed here rather than in the harness:
//
//   1. Two strategies went schema-invalid mid-run, so their results were
//      defect traces rather than outcomes. Wave 1 fixed the cause; this
//      module still refuses to rank a cell that failed an invariant, so a
//      broken cell can never be read as a balance signal again.
//   2. Every row came from ONE seed. A single seed cannot separate "this
//      strategy is stronger" from "this seed favoured this strategy".
//      Every analysis here aggregates across seeds and reports the spread
//      alongside the centre, so seed noise is visible instead of implied.
//
// What this module deliberately does not do is decide whether the numbers
// are GOOD. That needs `DC-03` (the long-term objective) and `DC-04` (the
// failure contract), which are unanswered. So the analysis answers only
// questions that hold under every candidate objective:
//
//   - does any strategy lead on every axis (dominance)?
//   - does any strategy lead on none (a dead strategy)?
//   - does acting beat not acting, and does answering cards beat ignoring
//     them (agency value)?
//   - do Easy / Standard / Hard order correctly (difficulty monotonicity)?
//   - is the seed-to-seed spread small enough for any of the above to
//     mean anything?
//
// When `DC-03`/`DC-04` are answered, add a scoring layer on top; do not
// fold the objective into these primitives.

// ----------------------------------------------------------------------
// Variants
// ----------------------------------------------------------------------

/** The action/response variants Phase 8 §7 requires Wave 7 to compare. */
export type BalanceVariantId =
  /** Both levers: the bot's owner actions and every card answered. */
  | 'full'
  /** Neither lever. The calendar runs; the player does nothing. */
  | 'no_action'
  /** Proactive only — plan the day, never answer a card. */
  | 'actions_only'
  /** Reactive only — answer every card, queue nothing. */
  | 'responses_only'
  /** Both levers, but only every other card is answered. */
  | 'partial_responses'

export type BalanceVariant = {
  id: BalanceVariantId
  label: string
  ownerActions: OwnerActionPolicy
  responses: ResponsePolicy
}

export const BALANCE_VARIANTS: Record<BalanceVariantId, BalanceVariant> = {
  full: {
    id: 'full',
    label: 'Actions + all responses',
    ownerActions: 'bot',
    responses: 'all',
  },
  no_action: {
    id: 'no_action',
    label: 'No action at all',
    ownerActions: 'none',
    responses: 'none',
  },
  actions_only: {
    id: 'actions_only',
    label: 'Owner actions only',
    ownerActions: 'bot',
    responses: 'none',
  },
  responses_only: {
    id: 'responses_only',
    label: 'Card responses only',
    ownerActions: 'none',
    responses: 'all',
  },
  partial_responses: {
    id: 'partial_responses',
    label: 'Actions + every other response',
    ownerActions: 'bot',
    responses: 'partial',
  },
}

export const ALL_BALANCE_VARIANT_IDS: ReadonlyArray<BalanceVariantId> = [
  'full',
  'no_action',
  'actions_only',
  'responses_only',
  'partial_responses',
]

/** The eight strategies the audit ran. `manual_debug` is a no-op mode, not
 *  a strategy, and is excluded exactly as the Wave 1 gate excludes it. */
export const BALANCE_STRATEGY_BOT_IDS: ReadonlyArray<PolicyBotId> =
  PHASE_20_POLICY_BOTS.filter((bot) => bot.id !== 'manual_debug').map(
    (bot) => bot.id,
  )

export const ALL_DIFFICULTIES: ReadonlyArray<DifficultyId> = [
  'easy',
  'standard',
  'hard',
]

// ----------------------------------------------------------------------
// Matrix
// ----------------------------------------------------------------------

export type BalanceMatrixSpec = {
  /** Default: the eight strategy bots. */
  botIds?: ReadonlyArray<PolicyBotId>
  /** Default: `['standard']`. Wave 7's full sweep uses all three. */
  difficulties?: ReadonlyArray<DifficultyId>
  /** Default: `['full']`. */
  variants?: ReadonlyArray<BalanceVariantId>
  /**
   * Shared seeds. Every cell runs on every seed so a comparison is
   * always like-for-like. More than one is what makes the spread
   * measurable — a single-seed matrix cannot support a balance claim.
   */
  seeds: ReadonlyArray<string>
  days: number
  /** Called after each cell so a long sweep can report progress. */
  onCell?: (row: BalanceRunMetrics, index: number, total: number) => void
  measureRenderedChoices?: BalanceScenarioSpec['measureRenderedChoices']
}

export type BalanceMatrixResult = {
  spec: {
    botIds: ReadonlyArray<PolicyBotId>
    difficulties: ReadonlyArray<DifficultyId>
    variants: ReadonlyArray<BalanceVariantId>
    seeds: ReadonlyArray<string>
    days: number
  }
  rows: BalanceRunMetrics[]
}

/** Number of cells a spec will run, for cost estimates before committing. */
export function balanceMatrixSize(spec: BalanceMatrixSpec): number {
  const bots = spec.botIds ?? BALANCE_STRATEGY_BOT_IDS
  const difficulties = spec.difficulties ?? (['standard'] as const)
  const variants = spec.variants ?? (['full'] as const)
  return (
    bots.length * difficulties.length * variants.length * spec.seeds.length
  )
}

export function runBalanceMatrix(
  spec: BalanceMatrixSpec,
): BalanceMatrixResult {
  const botIds = spec.botIds ?? BALANCE_STRATEGY_BOT_IDS
  const difficulties = spec.difficulties ?? ['standard']
  const variants = spec.variants ?? ['full']
  const total = balanceMatrixSize(spec)

  const rows: BalanceRunMetrics[] = []
  let index = 0
  // Ordering is deterministic and nested bot → difficulty → variant → seed
  // so two runs of the same spec produce byte-identical row ordering and a
  // baseline diff is a real diff.
  for (const botId of botIds) {
    for (const difficulty of difficulties) {
      for (const variantId of variants) {
        const variant = BALANCE_VARIANTS[variantId]
        for (const seed of spec.seeds) {
          const row = measureBalanceScenario({
            botId,
            difficulty,
            seed,
            days: spec.days,
            ownerActions: variant.ownerActions,
            responses: variant.responses,
            ...(spec.measureRenderedChoices
              ? { measureRenderedChoices: spec.measureRenderedChoices }
              : {}),
          })
          rows.push(row)
          index += 1
          spec.onCell?.(row, index, total)
        }
      }
    }
  }

  return {
    spec: { botIds, difficulties, variants, seeds: spec.seeds, days: spec.days },
    rows,
  }
}

// ----------------------------------------------------------------------
// Aggregation across seeds
// ----------------------------------------------------------------------

/** The numeric columns a balance comparison is allowed to rank on. */
export type BalanceMetricKey =
  | 'finalCoin'
  | 'netCoinChange'
  | 'minCoin'
  | 'totalPatrons'
  | 'totalServiceCoin'
  | 'meanSatisfaction'
  | 'finalSatisfaction'
  | 'meanCleanliness'
  | 'meanDamage'
  | 'meanMorale'
  | 'finalStress'
  | 'finalStockQuantity'
  | 'pressureDaysAtCeiling'
  | 'totalIncidents'
  | 'meanCardsPerDay'
  | 'meanChoicesPerDay'
  | 'maxChoicesPerDay'
  | 'longestFamilyStreak'
  | 'totalResponsesResolved'
  | 'totalOwnerActionsApplied'
  | 'endingRentArrears'

/** For each metric, is a bigger number the better outcome for the player?
 *  This is a *direction*, not a value judgement — it says which way the
 *  axis points, which every candidate `DC-03` objective agrees on. */
export const METRIC_DIRECTION: Record<BalanceMetricKey, 'higher' | 'lower'> = {
  finalCoin: 'higher',
  netCoinChange: 'higher',
  minCoin: 'higher',
  totalPatrons: 'higher',
  totalServiceCoin: 'higher',
  meanSatisfaction: 'higher',
  finalSatisfaction: 'higher',
  meanCleanliness: 'higher',
  meanDamage: 'lower',
  meanMorale: 'higher',
  finalStress: 'lower',
  finalStockQuantity: 'higher',
  pressureDaysAtCeiling: 'lower',
  totalIncidents: 'lower',
  meanCardsPerDay: 'lower',
  meanChoicesPerDay: 'lower',
  maxChoicesPerDay: 'lower',
  longestFamilyStreak: 'lower',
  totalResponsesResolved: 'higher',
  totalOwnerActionsApplied: 'higher',
  endingRentArrears: 'lower',
}

/**
 * The axes a dominance check ranks on: the outcomes a player would
 * actually be trying to move. Load and activity counters are measured but
 * excluded — a strategy is not "winning" for rendering fewer buttons.
 */
export const OUTCOME_METRICS: ReadonlyArray<BalanceMetricKey> = [
  'finalCoin',
  'totalPatrons',
  'meanSatisfaction',
  'meanCleanliness',
  'meanDamage',
  'meanMorale',
  'pressureDaysAtCeiling',
]

export type MetricSpread = {
  metric: BalanceMetricKey
  mean: number
  median: number
  min: number
  max: number
  spread: number
  /** `spread / |mean|`, or `undefined` when the mean is ~0. */
  relativeSpread: number | undefined
  samples: number
  /** Per-seed values, aligned with the cell's `seeds` list. Kept so the
   *  noise check can pair seed-for-seed across strategies (Codex review
   *  of PR #242): every strategy runs the same seeds, so a shared
   *  environmental shift (a hard seed for everyone) must not read as
   *  uncertainty about the strategy comparison. */
  values: number[]
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}

/** Build a `MetricSpread` from raw per-seed values. Exported so tests and
 *  tooling can construct synthetic aggregates without re-implementing the
 *  statistics. */
export function metricSpreadOf(
  metric: BalanceMetricKey,
  values: number[],
): MetricSpread {
  if (values.length === 0) {
    return {
      metric,
      mean: 0,
      median: 0,
      min: 0,
      max: 0,
      spread: 0,
      relativeSpread: undefined,
      samples: 0,
      values: [],
    }
  }
  const sorted = [...values].sort((left, right) => left - right)
  const mid = Math.floor(sorted.length / 2)
  const median =
    sorted.length % 2 === 0
      ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
      : (sorted[mid] ?? 0)
  const mean = values.reduce((total, value) => total + value, 0) / values.length
  const min = sorted[0] ?? 0
  const max = sorted[sorted.length - 1] ?? 0
  return {
    metric,
    mean: round(mean),
    median: round(median),
    min: round(min),
    max: round(max),
    spread: round(max - min),
    relativeSpread:
      Math.abs(mean) < 1e-6 ? undefined : round(Math.abs((max - min) / mean)),
    samples: values.length,
    values: [...values],
  }
}

/** One strategy × difficulty × variant, aggregated over its seeds. */
export type BalanceCellAggregate = {
  botId: PolicyBotId
  botLabel: string
  difficulty: DifficultyId
  variant: BalanceVariantId
  seeds: string[]
  metrics: Record<BalanceMetricKey, MetricSpread>
  identityKeys: string[]
  dominantCustomerGroups: string[]
  /** True only when every seed in the cell validated and held invariants. */
  trustworthy: boolean
  untrustworthyReason: string | undefined
}

function variantIdOf(row: BalanceRunMetrics): BalanceVariantId {
  const match = ALL_BALANCE_VARIANT_IDS.find((id) => {
    const variant = BALANCE_VARIANTS[id]
    return (
      variant.ownerActions === row.ownerActions &&
      variant.responses === row.responses
    )
  })
  return match ?? 'full'
}

export function aggregateBalanceCells(
  rows: ReadonlyArray<BalanceRunMetrics>,
): BalanceCellAggregate[] {
  const groups = new Map<string, BalanceRunMetrics[]>()
  for (const row of rows) {
    const key = `${row.botId}|${row.difficulty}|${variantIdOf(row)}`
    const bucket = groups.get(key)
    if (bucket) bucket.push(row)
    else groups.set(key, [row])
  }

  const out: BalanceCellAggregate[] = []
  for (const bucket of groups.values()) {
    const first = bucket[0]
    if (!first) continue
    const metrics = {} as Record<BalanceMetricKey, MetricSpread>
    for (const metric of Object.keys(METRIC_DIRECTION) as BalanceMetricKey[]) {
      metrics[metric] = metricSpreadOf(
        metric,
        bucket.map((row) => row[metric] as number),
      )
    }
    const broken = bucket.find(
      (row) => !row.validatedThroughout || row.invariantFailureCount > 0,
    )
    out.push({
      botId: first.botId,
      botLabel: first.botLabel,
      difficulty: first.difficulty,
      variant: variantIdOf(first),
      seeds: bucket.map((row) => row.seed),
      metrics,
      identityKeys: [...new Set(bucket.map((row) => row.identityKey))].sort(),
      dominantCustomerGroups: [
        ...new Set(
          bucket
            .map((row) => row.dominantCustomerGroup)
            .filter((id): id is string => Boolean(id)),
        ),
      ].sort(),
      trustworthy: !broken,
      untrustworthyReason: broken
        ? (broken.firstInvariantFailure ??
          `validation failed on day ${broken.firstInvalidDay}`)
        : undefined,
    })
  }
  return out
}

// ----------------------------------------------------------------------
// Objective-agnostic analysis
// ----------------------------------------------------------------------

export type StrategyLeadership = {
  botId: PolicyBotId
  botLabel: string
  /** Metrics this strategy ranks first on, among trustworthy cells. */
  leadsOn: BalanceMetricKey[]
  /** Metrics it ranks last on. */
  trailsOn: BalanceMetricKey[]
}

export type BalanceAnalysis = {
  difficulty: DifficultyId
  variant: BalanceVariantId
  leadership: StrategyLeadership[]
  /** A strategy that leads on every rankable (non-noisy) outcome metric —
   *  a balance failure under any objective, because nothing trades off
   *  against it. */
  dominantStrategy: PolicyBotId | undefined
  /** Every usable cell has the same median on every outcome metric —
   *  the outcomes really are identical, not merely lead-free. Expected
   *  for `no_action`, where no lever the bot controls is ever pulled; a
   *  balance failure anywhere else. (Codex review of PR #242: inferring
   *  this from "nobody leads" also fired when every best value was merely
   *  shared, which suppressed the dead-strategy analysis.) */
  allStrategiesTied: boolean
  /** Strategies that are Pareto-DOMINATED on the rankable outcome
   *  metrics: some other strategy is at least as good everywhere and
   *  strictly better somewhere. (Codex review of PR #242: "leads on
   *  nothing" is not a dead strategy — a balanced compromise can lead on
   *  no single axis while being the best pick under a plausible
   *  objective.) Empty when `allStrategiesTied`. */
  deadStrategies: PolicyBotId[]
  /** Cells excluded from ranking because a seed failed an invariant. */
  excludedCells: Array<{ botId: PolicyBotId; reason: string }>
  distinctIdentityKeys: string[]
  distinctDominantCustomerGroups: string[]
  /** Metrics on which the best-vs-worst comparison is not seed-stable:
   *  paired seed-for-seed (every strategy runs the same seeds), the sign
   *  of the difference flips or vanishes on at least one seed. Rankings
   *  on these metrics are seed noise; leadership, dominance and the dead
   *  test all skip them. */
  noisyMetrics: BalanceMetricKey[]
}

function better(
  metric: BalanceMetricKey,
  left: number,
  right: number,
): boolean {
  return METRIC_DIRECTION[metric] === 'higher' ? left > right : left < right
}

/**
 * Rank strategies within one difficulty × variant slice.
 *
 * Uses the seed MEDIAN, not a single run, and drops any cell that failed
 * an invariant instead of ranking it — Phase 7 §5.2's first limitation
 * was reading two invalid runs as balance data.
 */
export function analyzeBalanceSlice(
  cells: ReadonlyArray<BalanceCellAggregate>,
  difficulty: DifficultyId,
  variant: BalanceVariantId,
): BalanceAnalysis {
  const slice = cells.filter(
    (cell) => cell.difficulty === difficulty && cell.variant === variant,
  )
  const usable = slice.filter((cell) => cell.trustworthy)
  const excludedCells = slice
    .filter((cell) => !cell.trustworthy)
    .map((cell) => ({
      botId: cell.botId,
      reason: cell.untrustworthyReason ?? 'unknown',
    }))

  const leadership = new Map<PolicyBotId, StrategyLeadership>()
  for (const cell of usable) {
    leadership.set(cell.botId, {
      botId: cell.botId,
      botLabel: cell.botLabel,
      leadsOn: [],
      trailsOn: [],
    })
  }

  const bestAndWorst = (
    metric: BalanceMetricKey,
  ): { best: BalanceCellAggregate; worst: BalanceCellAggregate } => {
    let best = usable[0]!
    let worst = usable[0]!
    for (const cell of usable) {
      if (better(metric, cell.metrics[metric].median, best.metrics[metric].median)) {
        best = cell
      }
      if (better(metric, worst.metrics[metric].median, cell.metrics[metric].median)) {
        worst = cell
      }
    }
    return { best, worst }
  }

  // Noise FIRST, so a noisy metric never hands out leadership before the
  // warning is computed (Codex review of PR #242).
  //
  // Every strategy runs the SAME seeds, so noise is judged on the paired
  // seed-for-seed differences between the best and worst strategy, not on
  // absolute within-cell spread — a seed that is hard for everyone shifts
  // every cell together and says nothing about the comparison. The metric
  // is unrankable when the extreme pairing is not seed-stable: on some
  // seed the "better" strategy fails to actually beat the "worse" one.
  const noisyMetrics: BalanceMetricKey[] = []
  if (usable.length >= 2) {
    for (const metric of OUTCOME_METRICS) {
      const { best, worst } = bestAndWorst(metric)
      const bestValues = best.metrics[metric].values
      const worstValues = worst.metrics[metric].values
      if (best.metrics[metric].median === worst.metrics[metric].median) continue
      if (bestValues.length !== worstValues.length) continue
      const sign = METRIC_DIRECTION[metric] === 'higher' ? 1 : -1
      const pairedDiffs = bestValues.map(
        (value, index) => sign * (value - (worstValues[index] ?? 0)),
      )
      if (pairedDiffs.some((diff) => diff <= 0)) noisyMetrics.push(metric)
    }
  }
  const rankableMetrics = OUTCOME_METRICS.filter(
    (metric) => !noisyMetrics.includes(metric),
  )

  for (const metric of rankableMetrics) {
    if (usable.length < 2) continue
    const { best, worst } = bestAndWorst(metric)
    // A lead has to be strict. The `no_action` variant makes every
    // strategy identical by construction (no lever the bot controls is
    // pulled), and a non-strict comparison would report the first bot in
    // the list as dominating a field it merely tied.
    const bestValue = best.metrics[metric].median
    const worstValue = worst.metrics[metric].median
    const bestIsUnique =
      usable.filter((cell) => cell.metrics[metric].median === bestValue)
        .length === 1
    const worstIsUnique =
      usable.filter((cell) => cell.metrics[metric].median === worstValue)
        .length === 1
    if (bestIsUnique) leadership.get(best.botId)?.leadsOn.push(metric)
    if (worstIsUnique) leadership.get(worst.botId)?.trailsOn.push(metric)
  }

  const rows = [...leadership.values()]
  const dominant =
    rankableMetrics.length > 0
      ? rows.find((row) => row.leadsOn.length === rankableMetrics.length)
      : undefined

  // A true tie is equal MEDIANS everywhere, not merely an absence of
  // unique leads — shared bests must not suppress the dead-strategy
  // analysis (Codex review of PR #242).
  const allTied =
    usable.length > 1 &&
    OUTCOME_METRICS.every((metric) => {
      const first = usable[0]!.metrics[metric].median
      return usable.every((cell) => cell.metrics[metric].median === first)
    })

  // Dead = Pareto-DOMINATED on the rankable metrics: someone else is at
  // least as good on every axis and strictly better on at least one. A
  // compromise strategy that leads nowhere but is dominated by no one is
  // a legitimate pick under some objective and must not be reported dead.
  const dominates = (
    candidate: BalanceCellAggregate,
    over: BalanceCellAggregate,
  ): boolean => {
    let strictlyBetterSomewhere = false
    for (const metric of rankableMetrics) {
      const a = candidate.metrics[metric].median
      const b = over.metrics[metric].median
      if (better(metric, b, a)) return false
      if (better(metric, a, b)) strictlyBetterSomewhere = true
    }
    return strictlyBetterSomewhere
  }
  const deadStrategies =
    allTied || rankableMetrics.length === 0
      ? []
      : usable
          .filter((cell) =>
            usable.some((other) => other !== cell && dominates(other, cell)),
          )
          .map((cell) => cell.botId)

  return {
    difficulty,
    variant,
    leadership: rows,
    dominantStrategy: dominant?.botId,
    allStrategiesTied: allTied,
    deadStrategies,
    excludedCells,
    distinctIdentityKeys: [
      ...new Set(usable.flatMap((cell) => cell.identityKeys)),
    ].sort(),
    distinctDominantCustomerGroups: [
      ...new Set(usable.flatMap((cell) => cell.dominantCustomerGroups)),
    ].sort(),
    noisyMetrics,
  }
}

// ----------------------------------------------------------------------
// Agency and difficulty checks
// ----------------------------------------------------------------------

export type AgencyComparison = {
  botId: PolicyBotId
  difficulty: DifficultyId
  metric: BalanceMetricKey
  baseline: { variant: BalanceVariantId; median: number }
  compared: { variant: BalanceVariantId; median: number }
  /** True when `compared` is the better outcome on this metric. */
  improved: boolean
  delta: number
}

/**
 * "Does acting beat not acting?" — the question `DC-04` needs answered
 * before a failure contract can be written, and the one the audit's
 * no-action route made urgent (28 permissive days, still solvent).
 *
 * Objective-agnostic: it reports per-metric direction rather than a
 * verdict, so it stays valid whichever objective `DC-03` picks.
 */
export function compareVariants(
  cells: ReadonlyArray<BalanceCellAggregate>,
  baselineVariant: BalanceVariantId,
  comparedVariant: BalanceVariantId,
  metrics: ReadonlyArray<BalanceMetricKey> = OUTCOME_METRICS,
): AgencyComparison[] {
  const out: AgencyComparison[] = []
  for (const compared of cells) {
    if (compared.variant !== comparedVariant) continue
    // Codex review of PR #242 — a cell that failed validation or an
    // invariant is excluded from EVERY ranking, agency included; the
    // slice analysis already refused to rank it and this comparison must
    // not readmit it.
    if (!compared.trustworthy) continue
    const baseline = cells.find(
      (cell) =>
        cell.botId === compared.botId &&
        cell.difficulty === compared.difficulty &&
        cell.variant === baselineVariant,
    )
    if (!baseline || !baseline.trustworthy) continue
    for (const metric of metrics) {
      const baseValue = baseline.metrics[metric].median
      const value = compared.metrics[metric].median
      out.push({
        botId: compared.botId,
        difficulty: compared.difficulty,
        metric,
        baseline: { variant: baselineVariant, median: baseValue },
        compared: { variant: comparedVariant, median: value },
        improved: better(metric, value, baseValue),
        delta: round(value - baseValue),
      })
    }
  }
  return out
}

export type DifficultyOrdering = {
  botId: PolicyBotId
  variant: BalanceVariantId
  metric: BalanceMetricKey
  easy: number
  standard: number
  hard: number
  /** True when easy ≥ standard ≥ hard in the player-favourable direction. */
  monotonic: boolean
}

/**
 * Easy should not be harder than Hard.
 *
 * `applyDifficultyToBase` only moves start-of-day values, so a 28-day run
 * can absolutely converge — this check exists to find the case where the
 * ORDER inverts, which would mean the presets are mislabelled rather than
 * merely weak.
 */
export function checkDifficultyMonotonicity(
  cells: ReadonlyArray<BalanceCellAggregate>,
  metrics: ReadonlyArray<BalanceMetricKey> = OUTCOME_METRICS,
): DifficultyOrdering[] {
  const out: DifficultyOrdering[] = []
  const keys = new Set(cells.map((cell) => `${cell.botId}|${cell.variant}`))
  for (const key of keys) {
    const [botId, variant] = key.split('|') as [PolicyBotId, BalanceVariantId]
    // Codex review of PR #242 — an ordering built on an invalid arm is
    // not an ordering; every one of the three cells must be trustworthy.
    const find = (difficulty: DifficultyId) =>
      cells.find(
        (cell) =>
          cell.botId === botId &&
          cell.variant === variant &&
          cell.difficulty === difficulty &&
          cell.trustworthy,
      )
    const easy = find('easy')
    const standard = find('standard')
    const hard = find('hard')
    if (!easy || !standard || !hard) continue
    for (const metric of metrics) {
      const e = easy.metrics[metric].median
      const s = standard.metrics[metric].median
      const h = hard.metrics[metric].median
      const monotonic =
        METRIC_DIRECTION[metric] === 'higher'
          ? e >= s && s >= h
          : e <= s && s <= h
      out.push({ botId, variant, metric, easy: e, standard: s, hard: h, monotonic })
    }
  }
  return out
}
