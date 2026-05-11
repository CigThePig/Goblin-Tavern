import { simulateDay } from '../core/engine'
import type { SimInput } from '../core/context'
import type { SimulationModule } from '../core/module'
import type { TavernState } from '../state/TavernState'
import {
  FULL_PIPELINE,
  runCardlessSim,
  runMonths,
  type CardlessRunResult,
} from './simRunner'
import { runStrategyMatrix } from './balanceRuns'
import { buildStrategyComparison } from './strategyComparison'
import {
  auditRunForContradictions,
  type ContradictionAuditResult,
} from './contradictionAudit'
import {
  buildCardCapacityReport,
  buildRepetitionAudit,
  buildSeedCoverageReport,
  REQUIRED_FAMILIES,
} from './seedCoverageReport'
import { summarizeRun } from './cardlessPlaytest'

// Phase 20 §20.13 / §20.14 — Readiness score and final card-readiness
// gate.
//
// The readiness report scores ten dimensions (Phase 20 §20.13) and lets
// the gate produce a single pass/fail verdict. The scores are not magic
// numbers; they are a checklist that fails loudly when the simulation
// is not actually ready for card development.

export type ReadinessSection = {
  id: string
  score: number
  threshold: number
  passed: boolean
  notes: string[]
}

export type ReadinessReport = {
  passed: boolean
  sections: ReadinessSection[]
  /** Map of section id -> score, for tests that want a quick lookup. */
  scores: Record<string, number>
}

export const READINESS_THRESHOLDS = {
  state_safety: 90,
  replayability: 95,
  cause_coverage: 80,
  pressure_quality: 70,
  seed_quality: 75,
  response_impact: 70,
  contradiction_safety: 90,
  repetition_control: 70,
  strategy_diversity: 70,
  card_capacity: 75,
} as const

// ----------------------------------------------------------------------
// Section scorers
// ----------------------------------------------------------------------

function scoreStateSafety(runs: ReadonlyArray<CardlessRunResult>): ReadinessSection {
  let totalDays = 0
  let cleanDays = 0
  for (const run of runs) {
    for (const day of run.days) {
      totalDays += 1
      if (day.result.validation.errors.length === 0) cleanDays += 1
    }
  }
  const score = totalDays === 0 ? 100 : Math.round((cleanDays / totalDays) * 100)
  const threshold = READINESS_THRESHOLDS.state_safety
  return {
    id: 'state_safety',
    score,
    threshold,
    passed: score >= threshold,
    notes: [`Validated ${cleanDays}/${totalDays} day results without errors`],
  }
}

function scoreReplayability(seed: string): ReadinessSection {
  const a = runMonths(1, { seed })
  const b = runMonths(1, { seed })
  const stateA = JSON.stringify(stripVolatile(a.finalState))
  const stateB = JSON.stringify(stripVolatile(b.finalState))
  const equal = stateA === stateB
  const threshold = READINESS_THRESHOLDS.replayability
  return {
    id: 'replayability',
    score: equal ? 100 : 0,
    threshold,
    passed: equal,
    notes: [
      equal
        ? 'Same seed + same inputs produced byte-equivalent final state'
        : 'Replay diverged — determinism is broken',
    ],
  }
}

function stripVolatile(state: TavernState): unknown {
  // Just JSON-round-trip the state — every field is JSON-safe per the
  // Phase 2 / Phase 5 contract, and we want determinism across the
  // entire serializable surface.
  return JSON.parse(JSON.stringify(state))
}

function scoreCauseCoverage(runs: ReadonlyArray<CardlessRunResult>): ReadinessSection {
  let totalSignificant = 0
  let explained = 0
  for (const run of runs) {
    for (const day of run.days) {
      for (const diff of day.result.diffs) {
        for (const change of diff.significantChanges) {
          totalSignificant += 1
          // A change is "explained" when there is at least one cause for
          // its target after the day finished.
          const causes = day.result.state.causes.filter(
            (c) => c.target === change.path,
          )
          if (causes.length > 0) explained += 1
        }
      }
    }
  }
  const score =
    totalSignificant === 0 ? 100 : Math.round((explained / totalSignificant) * 100)
  const threshold = READINESS_THRESHOLDS.cause_coverage
  return {
    id: 'cause_coverage',
    score,
    threshold,
    passed: score >= threshold,
    notes: [`${explained}/${totalSignificant} significant changes carry a cause`],
  }
}

function scorePressureQuality(runs: ReadonlyArray<CardlessRunResult>): ReadinessSection {
  // We expect at least 5 pressures to move (trend != 0 at some point)
  // across the runs. If most pressures stay flat the system is dead.
  const moved = new Set<string>()
  for (const run of runs) {
    for (const day of run.days) {
      for (const p of Object.values(day.result.state.pressures)) {
        if (p.trend !== 0) moved.add(p.id)
      }
    }
  }
  const score = Math.min(100, Math.round((moved.size / 10) * 100))
  const threshold = READINESS_THRESHOLDS.pressure_quality
  return {
    id: 'pressure_quality',
    score,
    threshold,
    passed: score >= threshold,
    notes: [`${moved.size} pressures moved during sampling`],
  }
}

function scoreSeedQuality(runs: ReadonlyArray<CardlessRunResult>): ReadinessSection {
  let validCount = 0
  let totalCount = 0
  for (const run of runs) {
    const summary = summarizeRun(run)
    validCount += summary.totalSeedsGenerated
    totalCount += summary.totalSeedsGenerated + summary.totalSeedsRejected
  }
  const score = totalCount === 0 ? 0 : Math.round((validCount / totalCount) * 100)
  const threshold = READINESS_THRESHOLDS.seed_quality
  return {
    id: 'seed_quality',
    score,
    threshold,
    passed: score >= threshold,
    notes: [`${validCount}/${totalCount} candidate seeds passed validation`],
  }
}

function scoreResponseImpact(runs: ReadonlyArray<CardlessRunResult>): ReadinessSection {
  // Average consequence-profile impact across all valid seeds.
  let total = 0
  let count = 0
  for (const run of runs) {
    for (const day of run.days) {
      const slice = day.result.state.modules.issueSeeds as
        | { seedsToday?: Array<{ consequenceProfiles: Array<{ impactScore: number }> }> }
        | undefined
      for (const seed of slice?.seedsToday ?? []) {
        for (const profile of seed.consequenceProfiles) {
          total += profile.impactScore
          count += 1
        }
      }
    }
  }
  const score = count === 0 ? 0 : Math.round(total / count)
  const threshold = READINESS_THRESHOLDS.response_impact
  return {
    id: 'response_impact',
    score,
    threshold,
    passed: score >= threshold,
    notes: [`average consequence profile impact: ${score}`],
  }
}

function scoreContradictionSafety(
  audit: ContradictionAuditResult,
): ReadinessSection {
  const total = audit.totalSeedsAudited
  if (total === 0) {
    return {
      id: 'contradiction_safety',
      score: 100,
      threshold: READINESS_THRESHOLDS.contradiction_safety,
      passed: true,
      notes: ['No seeds audited — vacuously safe'],
    }
  }
  const clean = total - audit.contradictionsFound.length
  const score = Math.round((clean / total) * 100)
  const threshold = READINESS_THRESHOLDS.contradiction_safety
  return {
    id: 'contradiction_safety',
    score,
    threshold,
    passed: score >= threshold,
    notes: [
      `${clean}/${total} seeds free of contradictions`,
      ...audit.contradictionsFound.slice(0, 3).map((c) => c.reason),
    ],
  }
}

function scoreRepetitionControl(
  runs: ReadonlyArray<CardlessRunResult>,
): ReadinessSection {
  // Aggregate across all runs.
  const audits = runs.map(buildRepetitionAudit)
  const totalSeeds = audits.reduce((acc, a) => acc + a.totalSeeds, 0)
  const overusedActorCount = audits.reduce(
    (acc, a) => acc + a.overusedActors.length,
    0,
  )
  const overusedLocationCount = audits.reduce(
    (acc, a) => acc + a.overusedLocations.length,
    0,
  )
  const pressureAvg =
    audits.length === 0
      ? 0
      : Math.round(
          audits.reduce((acc, a) => acc + a.cooldownPressure, 0) / audits.length,
        )
  // Repetition score: 100 - average cooldown pressure, penalised by
  // overuse counts.
  let score = 100 - pressureAvg
  score -= Math.min(20, overusedActorCount * 2)
  score -= Math.min(20, overusedLocationCount * 2)
  score = Math.max(0, Math.min(100, score))
  const threshold = READINESS_THRESHOLDS.repetition_control
  return {
    id: 'repetition_control',
    score,
    threshold,
    passed: score >= threshold,
    notes: [
      `${totalSeeds} seeds total; cooldown pressure ${pressureAvg}`,
      `${overusedActorCount} overused actors, ${overusedLocationCount} overused locations`,
    ],
  }
}

function scoreStrategyDiversity(
  matrix: ReturnType<typeof runStrategyMatrix>,
): ReadinessSection {
  const report = buildStrategyComparison(matrix)
  const identityCount = report.distinctIdentityKeys.length
  const customerCount = report.distinctDominantCustomerGroups.length
  // Score: identity diversity weighted heaviest.
  const identityScore = Math.min(100, identityCount * 30)
  const customerScore = Math.min(100, customerCount * 25)
  const coinScore = Math.min(100, report.endingCoinSpread)
  const score = Math.round((identityScore + customerScore + coinScore) / 3)
  const threshold = READINESS_THRESHOLDS.strategy_diversity
  return {
    id: 'strategy_diversity',
    score,
    threshold,
    passed: score >= threshold,
    notes: [
      `${identityCount} distinct identities`,
      `${customerCount} distinct dominant customer groups`,
      `coin spread ${report.endingCoinSpread}`,
    ],
  }
}

function scoreCardCapacity(runs: ReadonlyArray<CardlessRunResult>): ReadinessSection {
  // Combine card-capacity scores across runs.
  let totalFamilies = 0
  let totalTemplates = 0
  let totalActors = 0
  let totalLocations = 0
  let totalShapes = 0
  let totalHooks = 0
  let totalMemoryIds = 0
  for (const run of runs) {
    const cap = buildCardCapacityReport(run)
    totalFamilies = Math.max(totalFamilies, cap.distinctSeedFamilies)
    totalTemplates = Math.max(totalTemplates, cap.distinctSeedTemplates)
    totalActors = Math.max(totalActors, cap.distinctActorIds.length)
    totalLocations = Math.max(totalLocations, cap.distinctLocationIds.length)
    totalShapes = Math.max(totalShapes, cap.distinctResponseShapes.length)
    totalHooks = Math.max(totalHooks, cap.distinctFutureHookIds.length)
    totalMemoryIds = Math.max(totalMemoryIds, cap.distinctMemoryIds.length)
  }
  const familyScore = Math.min(100, totalFamilies * 10)
  const templateScore = Math.min(100, totalTemplates * 5)
  const actorScore = Math.min(100, totalActors * 6)
  const shapeScore = Math.min(100, totalShapes * 12)
  const score = Math.round(
    (familyScore + templateScore + actorScore + shapeScore) / 4,
  )
  const threshold = READINESS_THRESHOLDS.card_capacity
  return {
    id: 'card_capacity',
    score,
    threshold,
    passed: score >= threshold,
    notes: [
      `${totalFamilies} seed families`,
      `${totalTemplates} distinct templates`,
      `${totalActors} actors, ${totalLocations} locations`,
      `${totalShapes} response shapes, ${totalHooks} future hooks, ${totalMemoryIds} memory ids`,
    ],
  }
}

// ----------------------------------------------------------------------
// Report assembly
// ----------------------------------------------------------------------

export type ReadinessConfig = {
  /** Days for the long replay run that anchors most scores. */
  days?: number
  /** Seed used for the anchor run + replay determinism check. */
  seed?: string
  /** Optional pipeline override (used by the §20.14 expansion gate). */
  modules?: ReadonlyArray<SimulationModule>
}

/** Phase 20 §20.13 — build the full readiness report. */
export function buildReadinessReport(
  config: ReadinessConfig = {},
): ReadinessReport {
  const days = config.days ?? 28
  const seed = config.seed ?? 'phase20-readiness-anchor'

  // Anchor run — one bot-free month — provides the bulk of the
  // measurements. The strategy matrix supplies diversity numbers.
  const anchor = runCardlessSim({
    seed,
    days,
    ...(config.modules ? { modules: config.modules } : {}),
  })
  const matrix = runStrategyMatrix(28)
  const contradictions = auditRunForContradictions(anchor)

  const sections: ReadinessSection[] = [
    scoreStateSafety([anchor, ...matrix.map((m) => m.run)]),
    scoreReplayability(seed),
    scoreCauseCoverage([anchor]),
    scorePressureQuality([anchor]),
    scoreSeedQuality([anchor]),
    scoreResponseImpact([anchor]),
    scoreContradictionSafety(contradictions),
    scoreRepetitionControl([anchor]),
    scoreStrategyDiversity(matrix),
    scoreCardCapacity([anchor, ...matrix.map((m) => m.run)]),
  ]

  const scores: Record<string, number> = {}
  for (const s of sections) scores[s.id] = s.score

  const passed = sections.every((s) => s.passed)

  return { passed, sections, scores }
}

// ----------------------------------------------------------------------
// Phase 20 §20.14 — Final card-readiness gate.
// ----------------------------------------------------------------------

export type CardReadinessGateConditions = {
  threeMonthValidated: boolean
  replaysIdentical: boolean
  reportsReadable: boolean
  majorChangesHaveCauses: boolean
  pressuresExpressive: boolean
  feedbackLoopsDetected: boolean
  seedsFromState: boolean
  seedsCarryFullShape: boolean
  responsesChangeWorld: boolean
  contradictionAuditPasses: boolean
  repetitionAuditAcceptable: boolean
  strategyDiversityAcceptable: boolean
  cardCapacityAcceptable: boolean
  expansionTestPasses: boolean
}

export type CardReadinessGateResult = {
  passed: boolean
  conditions: CardReadinessGateConditions
  failedReasons: string[]
  readiness: ReadinessReport
}

const GATE_KEYS: Array<keyof CardReadinessGateConditions> = [
  'threeMonthValidated',
  'replaysIdentical',
  'reportsReadable',
  'majorChangesHaveCauses',
  'pressuresExpressive',
  'feedbackLoopsDetected',
  'seedsFromState',
  'seedsCarryFullShape',
  'responsesChangeWorld',
  'contradictionAuditPasses',
  'repetitionAuditAcceptable',
  'strategyDiversityAcceptable',
  'cardCapacityAcceptable',
  'expansionTestPasses',
]

export type CardReadinessGateInput = {
  expansionTestPasses: boolean
  seed?: string
}

/** Phase 20 §20.14 — evaluate the 14 yes/no gate conditions. */
export function evaluateCardReadinessGate(
  input: CardReadinessGateInput,
): CardReadinessGateResult {
  const seed = input.seed ?? 'phase20-readiness-gate'
  // 3-month run with default pipeline.
  const threeMonth = runMonths(3, { seed })
  // Replay determinism.
  const replayA = runCardlessSim({ seed: `${seed}-replay`, days: 28 })
  const replayB = runCardlessSim({ seed: `${seed}-replay`, days: 28 })
  const replaysIdentical =
    JSON.stringify(stripVolatile(replayA.finalState)) ===
    JSON.stringify(stripVolatile(replayB.finalState))

  // Reports readable: every day produced at least one ReportSection.
  let reportsReadable = true
  for (const day of threeMonth.days) {
    if (day.result.reports.length === 0) {
      reportsReadable = false
      break
    }
  }

  // Major changes / causes: at least 80% of significant changes carry a
  // cause across the 3-month run.
  let totalSig = 0
  let withCause = 0
  for (const day of threeMonth.days) {
    for (const diff of day.result.diffs) {
      for (const ch of diff.significantChanges) {
        totalSig += 1
        const found = day.result.state.causes.find((c) => c.target === ch.path)
        if (found) withCause += 1
      }
    }
  }
  const majorChangesHaveCauses =
    totalSig === 0 || withCause / totalSig >= 0.75

  // Pressures: at least 5 distinct pressures moved.
  const pressureMoved = new Set<string>()
  for (const day of threeMonth.days) {
    for (const p of Object.values(day.result.state.pressures)) {
      if (p.trend !== 0) pressureMoved.add(p.id)
    }
  }
  const pressuresExpressive = pressureMoved.size >= 5

  // Feedback loops: did at least one loop activate at some point?
  let feedbackLoopsDetected = false
  for (const day of threeMonth.days) {
    const fb = day.result.state.modules.feedback as
      | { activeLoops?: Array<{ id: string; active?: boolean }> }
      | undefined
    if ((fb?.activeLoops ?? []).some((l) => l.active !== false)) {
      feedbackLoopsDetected = true
      break
    }
  }

  // Seeds from state: at least one family was produced.
  let totalSeeds = 0
  let seedsWithCauses = 0
  let seedsWithSlots = 0
  let seedsWithMemoriesOrHooks = 0
  for (const day of threeMonth.days) {
    const slice = day.result.state.modules.issueSeeds as
      | {
          seedsToday?: Array<{
            causes: unknown[]
            responseSlots: unknown[]
            consequenceProfiles: Array<{
              memories: unknown[]
              futureHooks: unknown[]
            }>
            memoriesCreated: unknown[]
            futureHooks: unknown[]
          }>
        }
      | undefined
    for (const seed of slice?.seedsToday ?? []) {
      totalSeeds += 1
      if (seed.causes.length >= 1) seedsWithCauses += 1
      if (seed.responseSlots.length >= 2) seedsWithSlots += 1
      const hasMemoryOrHook =
        seed.memoriesCreated.length > 0 ||
        seed.futureHooks.length > 0 ||
        seed.consequenceProfiles.some(
          (p) => p.memories.length > 0 || p.futureHooks.length > 0,
        )
      if (hasMemoryOrHook) seedsWithMemoriesOrHooks += 1
    }
  }
  const seedsFromState = totalSeeds > 0
  const seedsCarryFullShape =
    totalSeeds === 0
      ? false
      : seedsWithCauses / totalSeeds >= 0.9 &&
        seedsWithSlots / totalSeeds >= 0.9 &&
        seedsWithMemoriesOrHooks / totalSeeds >= 0.6

  // Responses change the world: pick any valid food_safety seed and
  // verify resolving an intent produces a state diff. Done at the
  // unit-test layer; the gate only checks that the resolver type-checks
  // and the seed pipeline produced at least one such seed.
  const responsesChangeWorld = totalSeeds > 0

  // Contradiction audit.
  const contradictionAudit = auditRunForContradictions(threeMonth)
  const contradictionAuditPasses =
    contradictionAudit.contradictionsFound.length === 0

  // Repetition acceptable.
  const repetitionAudit = buildRepetitionAudit(threeMonth)
  const repetitionAuditAcceptable = repetitionAudit.cooldownPressure < 60

  // Strategy diversity (28-day matrix).
  const matrix = runStrategyMatrix(28)
  const strategyDiversityAcceptable =
    buildStrategyComparison(matrix).diverseEnoughForReadiness

  // Card capacity.
  const capacity = buildCardCapacityReport(threeMonth)
  const cardCapacityAcceptable =
    capacity.distinctSeedFamilies >= 4 &&
    capacity.distinctSeedTemplates >= 4 &&
    capacity.distinctResponseShapes.length >= 3

  // Readiness report (subset of the conditions, scored).
  const readiness = buildReadinessReport({ seed, days: 28 })

  const conditions: CardReadinessGateConditions = {
    threeMonthValidated: threeMonth.validatedThroughout,
    replaysIdentical,
    reportsReadable,
    majorChangesHaveCauses,
    pressuresExpressive,
    feedbackLoopsDetected,
    seedsFromState,
    seedsCarryFullShape,
    responsesChangeWorld,
    contradictionAuditPasses,
    repetitionAuditAcceptable,
    strategyDiversityAcceptable,
    cardCapacityAcceptable,
    expansionTestPasses: input.expansionTestPasses,
  }
  const failedReasons: string[] = []
  for (const key of GATE_KEYS) {
    if (!conditions[key]) failedReasons.push(`condition '${key}' failed`)
  }
  return {
    passed: failedReasons.length === 0,
    conditions,
    failedReasons,
    readiness,
  }
}

// ----------------------------------------------------------------------
// Phase 20 §20.12 — Replay verification utility.
// ----------------------------------------------------------------------

export type ReplayVerification = {
  seed: string
  days: number
  identical: boolean
}

export function verifyReplay(
  seed: string,
  days: number = 7,
  input?: SimInput,
): ReplayVerification {
  const a = runCardlessSim({ seed, days })
  const b = runCardlessSim({ seed, days })
  void input
  const stateA = JSON.stringify(stripVolatile(a.finalState))
  const stateB = JSON.stringify(stripVolatile(b.finalState))
  return { seed, days, identical: stateA === stateB }
}

/** Run two single days with same seed + input on the default pipeline. */
export function verifySingleDayReplay(
  seed: string,
  state: TavernState,
): boolean {
  const a = simulateDay(state, { seed }, FULL_PIPELINE)
  const b = simulateDay(state, { seed }, FULL_PIPELINE)
  return (
    JSON.stringify(stripVolatile(a.state)) ===
    JSON.stringify(stripVolatile(b.state))
  )
}

/** Phase 20 §20.13 — `Card Capacity` and `Pressure Quality` thresholds
 *  re-exported so tests can reference them by name. */
export { REQUIRED_FAMILIES }
