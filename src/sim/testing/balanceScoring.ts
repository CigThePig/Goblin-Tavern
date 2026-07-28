import type { DifficultyId } from '../state/difficulty'
import type { PolicyBotId } from './policyBots'
import {
  analyzeBalanceSlice,
  type BalanceAnalysis,
  type BalanceCellAggregate,
  type BalanceVariantId,
} from './balanceMatrix'

// Phase 206 / gameplay-audit Wave 7 — the scoring layer, keyed on the
// recorded `DC-03` decision.
//
// `DC-03` (decided in Wave 7, recorded in the remediation queue): the
// long-term player objective is **identity through viability**. Play is
// organized by shaping a distinctive tavern — reputation axes, audience
// mix, relationships — on top of an operation that stays viable. Cash is
// a constraint and a means, never the score; there is no win condition
// (`game-loop-and-ux.md §5.4` is locked on that), and the late game is
// legibility, not a scoreboard.
//
// `DC-04` (decided in Wave 7): failure in 0.1.0 is a SOFT-FAIL SPIRAL,
// not a terminal screen. Missed rent, collapsing morale and a driven-off
// audience are the failure surface; they escalate pressure and issue
// seeds rather than ending the run.
//
// Under those two decisions, "balanced" is a property of the whole
// strategy set, not of any single number:
//
//   1. every intended strategy keeps the tavern VIABLE (the DC-04 floors
//      hold);
//   2. no strategy is DOMINANT (leads on every rankable outcome axis —
//      nothing would trade off against it under any objective);
//   3. no intended strategy is Pareto-DOMINATED (there is a reason to
//      pick each one), foil strategies excepted;
//   4. the strategy set expresses DISTINCT identities — different play
//      styles must end the month as recognisably different taverns.
//
// This module sits ON TOP of `balanceMatrix`'s objective-agnostic
// primitives, exactly as the Wave 7 plan requires ("add a scoring layer
// on top of these primitives — do not fold the objective into them").
// It reads aggregates and analyses; it never re-derives a measurement.

// ----------------------------------------------------------------------
// DC-04 viability floors
// ----------------------------------------------------------------------

/** Rent must be paid: ending the month in arrears is the clearest DC-04
 *  failure surface the sim already models (landlord pressure, eviction
 *  threat seeds hang off it). */
export const VIABILITY_MAX_ENDING_RENT_ARREARS = 0

/** A month that averages staff morale below this is a tavern the staff
 *  are walking out of — the DC-04 "staff departure" surface. */
export const VIABILITY_MIN_MEAN_MORALE = 25

/** 28-day patron floor. The audit's fully passive route drew 828; a
 *  strategy that drives traffic below half of even that has collapsed its
 *  audience — the DC-04 "customer collapse" surface. */
export const VIABILITY_MIN_TOTAL_PATRONS = 400

/** Foil strategies: deliberately bad or control policies. They exist so
 *  the matrix has a floor to measure against, not as recommended play,
 *  so being Pareto-dominated is their expected shape and does not fail
 *  the balance verdict. (`auto_no_owner_actions` is the passive control;
 *  `auto_random_owner` is unfocused-by-design; `auto_ignore_repairs` is
 *  the neglect foil.) */
export const DEFAULT_FOIL_BOTS: ReadonlySet<PolicyBotId> = new Set([
  'auto_no_owner_actions',
  'auto_random_owner',
  'auto_ignore_repairs',
])

// ----------------------------------------------------------------------
// Shapes
// ----------------------------------------------------------------------

export type StrategyScore = {
  botId: PolicyBotId
  botLabel: string
  /** All DC-04 floors held (median across seeds). */
  viable: boolean
  /** Human-readable floor failures, empty when viable. */
  viabilityFailures: string[]
  /** Reputation identity keys this strategy produced across its seeds. */
  identityKeys: string[]
  /** No other strategy in the slice shares an identity key with it. */
  distinctIdentity: boolean
  /** From the analysis: rankable metrics this strategy leads on. */
  leadsOn: string[]
  /** From the analysis: Pareto-dominated on the rankable metrics. */
  dominated: boolean
  /** Dominated but listed as a foil — expected, not a balance failure. */
  foil: boolean
}

export type SliceVerdict = {
  difficulty: DifficultyId
  variant: BalanceVariantId
  scores: StrategyScore[]
  /** The slice passes all four DC-03 balance conditions. */
  balanced: boolean
  /** Why not, when it does not. */
  problems: string[]
  analysis: BalanceAnalysis
}

export type BalanceVerdict = {
  slices: SliceVerdict[]
  balanced: boolean
  problems: string[]
}

// ----------------------------------------------------------------------
// Scoring
// ----------------------------------------------------------------------

function viabilityOf(
  cell: BalanceCellAggregate,
): { viable: boolean; failures: string[] } {
  const failures: string[] = []
  const arrears = cell.metrics.endingRentArrears.median
  if (arrears > VIABILITY_MAX_ENDING_RENT_ARREARS) {
    failures.push(`ends the month ${arrears} coin in rent arrears`)
  }
  const morale = cell.metrics.meanMorale.median
  if (morale < VIABILITY_MIN_MEAN_MORALE) {
    failures.push(
      `mean staff morale ${morale} is below the departure floor (${VIABILITY_MIN_MEAN_MORALE})`,
    )
  }
  const patrons = cell.metrics.totalPatrons.median
  if (patrons < VIABILITY_MIN_TOTAL_PATRONS) {
    failures.push(
      `${patrons} patrons over the month is audience collapse (< ${VIABILITY_MIN_TOTAL_PATRONS})`,
    )
  }
  return { viable: failures.length === 0, failures }
}

/**
 * Score one difficulty × variant slice under the DC-03 objective.
 *
 * Only trustworthy cells are scored — an invariant-failing cell is not a
 * strategy outcome, and the analysis this layer reads has already
 * excluded it.
 */
export function scoreBalanceSlice(
  cells: ReadonlyArray<BalanceCellAggregate>,
  difficulty: DifficultyId,
  variant: BalanceVariantId,
  foilBots: ReadonlySet<PolicyBotId> = DEFAULT_FOIL_BOTS,
): SliceVerdict {
  const analysis = analyzeBalanceSlice(cells, difficulty, variant)
  const usable = cells.filter(
    (cell) =>
      cell.difficulty === difficulty &&
      cell.variant === variant &&
      cell.trustworthy,
  )

  const identityCounts = new Map<string, number>()
  for (const cell of usable) {
    for (const key of cell.identityKeys) {
      identityCounts.set(key, (identityCounts.get(key) ?? 0) + 1)
    }
  }

  const scores: StrategyScore[] = usable.map((cell) => {
    const { viable, failures } = viabilityOf(cell)
    const leadership = analysis.leadership.find(
      (row) => row.botId === cell.botId,
    )
    const dominated = analysis.deadStrategies.includes(cell.botId)
    return {
      botId: cell.botId,
      botLabel: cell.botLabel,
      viable,
      viabilityFailures: failures,
      identityKeys: cell.identityKeys,
      distinctIdentity: cell.identityKeys.every(
        (key) => (identityCounts.get(key) ?? 0) <= 1,
      ),
      leadsOn: leadership?.leadsOn ?? [],
      dominated,
      foil: dominated && foilBots.has(cell.botId),
    }
  })

  const problems: string[] = []
  if (analysis.excludedCells.length > 0) {
    problems.push(
      `${analysis.excludedCells.length} cell(s) failed invariants and could not be scored`,
    )
  }
  if (analysis.dominantStrategy) {
    problems.push(
      `${analysis.dominantStrategy} is dominant — it leads on every rankable outcome axis, so nothing trades off against it`,
    )
  }
  for (const score of scores) {
    if (!score.viable) {
      problems.push(
        `${score.botId} is not viable: ${score.viabilityFailures.join('; ')}`,
      )
    }
    if (score.dominated && !score.foil) {
      problems.push(
        `${score.botId} is Pareto-dominated — there is no reason to pick it`,
      )
    }
  }
  // Identity expression is a property of the whole slice: the set must
  // produce more than one distinct identity. `no_action` is exempt — with
  // no lever pulled every run is the same tavern by construction.
  if (!analysis.allStrategiesTied) {
    const distinct = new Set(usable.flatMap((cell) => cell.identityKeys))
    if (usable.length > 1 && distinct.size < 2) {
      problems.push(
        'every strategy converges on one reputation identity — play style is not expressed in the tavern',
      )
    }
  }

  return {
    difficulty,
    variant,
    scores,
    balanced: problems.length === 0,
    problems,
    analysis,
  }
}

/** Score every difficulty × variant slice present in the aggregates. */
export function scoreBalance(
  cells: ReadonlyArray<BalanceCellAggregate>,
  foilBots: ReadonlySet<PolicyBotId> = DEFAULT_FOIL_BOTS,
): BalanceVerdict {
  const seen = new Set<string>()
  const slices: SliceVerdict[] = []
  for (const cell of cells) {
    const key = `${cell.difficulty}|${cell.variant}`
    if (seen.has(key)) continue
    seen.add(key)
    slices.push(scoreBalanceSlice(cells, cell.difficulty, cell.variant, foilBots))
  }
  const problems = slices.flatMap((slice) =>
    slice.problems.map(
      (problem) => `${slice.difficulty}/${slice.variant}: ${problem}`,
    ),
  )
  return {
    slices,
    balanced: problems.length === 0,
    problems,
  }
}
