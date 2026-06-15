import { z } from 'zod'

import type { SimulationHook, SimulationModule } from '../../core/module'
import type { SimContext } from '../../core/context'
import type { ReportSection } from '../../core/reports'
import type { ValidationIssue } from '../../state/types'

import {
  ensureRequiredSeedGeneratorsRegistered,
  REQUIRED_SEED_GENERATORS,
} from './issueSeedGenerators'
import { issueSeedGeneratorRegistry } from './issueSeedRegistry'
import {
  bumpCooldownOnGenerate,
  computeCardWorthiness,
  computeNovelty,
  rankSeeds,
} from './issueSeedRanking'
import { validateSeed, validateSeedAgainstState } from './issueSeedValidation'
import { applyHandBudget } from './handBudget'
import { EXPANDED_ISSUE_SEED_FAMILIES } from './issueSeedTypes'
import { buildIssueSeedReport } from './issueSeedReport'
import { shouldSurfaceAsIssueSeed } from './fairness'
import {
  createInitialIssueSeedModuleState,
  type IssueSeed,
  type IssueSeedModuleState,
  type IssueSeedTiming,
} from './issueSeedTypes'
import { ISSUE_SEEDS_MODULE_ID } from './issueSeedQueries'

// Phase 19 — Issue seed module.
// Phase 186 / Day-Clock Cluster 1 — Seed lifecycle rewrite.
//
// Responsibilities:
//   - Self-register the required seed generators on module load.
//   - Generate seeds *segment-locally*, at the phase that matches each
//     generator's generation pass (`generateWith`, defaulting to its seed
//     render `timing`), instead of pre-baking the whole day's set during
//     `generateReports` the evening before:
//       · `morning_prep`   → `startDay`     (the morning the player sees)
//       · `during_service` → `afterService` (emergent from the service rush)
//       · `closing`        → `closing`      (after pressures settle)
//       · `end_week`       → `endWeek`      (future weekly-rollup seeds)
//       · `end_month`      → `endMonth`     (future monthly-rollup seeds)
//     Phase 186 / Cluster 4 — the choice-bearing periodic seeds
//     (`debt_rent`, `monthly_review`) carry render timing `end_month` but
//     set `generateWith: ['morning_prep']`, so they are *produced* in the
//     morning pass and surface at the morning pause where the player can
//     act on them (contract §3.5). `monthly_review` fires on the first
//     morning of the new month (its guard reads the persisted
//     `lastMonthlyResult` + `calendar.day === 1`).
//     `startDay` clears `seedsToday` first, so the day owns its own surface;
//     later passes append and re-rank the accumulated set. Generators are
//     pure readers of state (no RNG), so relocating them does not perturb
//     the shared RNG sequence — only *which* state values they read.
//   - Maintain cooldown/novelty tracking across days (now threaded in
//     temporal order across the passes, which is strictly more correct:
//     a morning seed's generation informs the novelty of a later
//     same-day during-service seed — see phase-186 contract §1.4/§1.5).
//   - Emit the ISSUE SEED REPORT during `generateReports` (the report
//     still reads the fully-accumulated `seedsToday`).
//   - Validate module slice shape on `validate`.
//
// See docs/plans/phase-186-day-clock-implementation-notes.md for the
// grounded findings that shaped this (esp. the during-service generator
// set and the pressure-snapshot timing that GATE A turns on).

const SOURCE = ISSUE_SEEDS_MODULE_ID

function writeSlice(
  ctx: SimContext,
  patch: Partial<IssueSeedModuleState>,
  reason: string,
): void {
  ctx.modifyModuleState<IssueSeedModuleState>(
    ISSUE_SEEDS_MODULE_ID,
    (current) => {
      const base = current ?? createInitialIssueSeedModuleState()
      return { ...base, ...patch }
    },
    { source: SOURCE, reason },
  )
}

function getSlice(ctx: SimContext): IssueSeedModuleState {
  return (ctx.state.modules[ISSUE_SEEDS_MODULE_ID] as
    | IssueSeedModuleState
    | undefined) ?? createInitialIssueSeedModuleState()
}

// Phase 186 / Cluster 1 — run one segment-local generation pass.
//
// Generates only the generators whose declared `timing` intersects
// `timings`, scores/validates them against the *current* (mid-day) state,
// threads cooldown/novelty forward, then APPENDS the survivors to the
// day's accumulating `seedsToday` and re-ranks the union. Re-ranking the
// union each pass yields the same canonical order as ranking the whole
// day at once, because `rankSeeds` is a pure sort over already-scored
// seeds.
function runGenerationPass(
  ctx: SimContext,
  timings: readonly IssueSeedTiming[],
): void {
  ensureRequiredSeedGeneratorsRegistered(issueSeedGeneratorRegistry)

  const absoluteDay = ctx.state.calendar.totalDaysElapsed

  // Phase 60 / ISSUE-020 — read the arc-emitted issue-seed tags once
  // for the whole pass so ranking can amplify seeds whose domain or
  // cause tags intersect the active arc signal.
  const activeIssueSeedTags =
    (ctx.state.modules.localArcs as
      | { activeIssueSeedTags?: string[] }
      | undefined)?.activeIssueSeedTags ?? []

  // Snapshot the accumulating-day state up front; cooldown bumps thread
  // through `slice` as we go.
  let slice = getSlice(ctx)
  const existingSeeds = slice.seedsToday
  const baseSurfaced = slice.surfacedToday ?? []
  const baseRejected = slice.rejectedToday
  const baseTotalGenerated = slice.totalGenerated
  const baseTotalRejected = slice.totalRejected

  // Phase 186 / Cluster 4 — select by the generator's *generation* pass
  // (`generateWith`), which defaults to its seed render `timing`. This is
  // how `debt_rent`/`monthly_review` (render timing `end_month`) are
  // produced in the morning (`startDay`) pass so they reach the morning
  // pause, while still carrying their `end_month` card timing.
  const generators = issueSeedGeneratorRegistry
    .all()
    .filter((g) => (g.generateWith ?? g.timing).some((t) => timings.includes(t)))

  const allCandidates: Array<{ generatorId: string; seed: IssueSeed }> = []
  const rejected: IssueSeedModuleState['rejectedToday'] = []

  for (const generator of generators) {
    let produced: IssueSeed[] = []
    try {
      produced = generator.generate(ctx)
    } catch (err) {
      rejected.push({
        family: generator.family,
        templateId: generator.id,
        reason: `generator threw: ${(err as Error).message}`,
      })
      continue
    }
    for (const seed of produced) {
      // Defensive: a generator must only emit seeds of a timing it
      // declares it produces (`generator.timing`). Skip any stray
      // off-timing seed. Phase 186 / Cluster 4 — this checks the
      // generator's declared render timings, NOT the pass's timings,
      // because generation pass and render timing are now decoupled (a
      // generator may run in the morning pass yet emit an `end_month`
      // seed).
      if (!generator.timing.includes(seed.timing)) continue
      // Idempotent passes: a generator that already produced this exact
      // seed in an earlier pass today (e.g. `debt_rent` fires in the
      // `closing` pass and would fire again in the `endMonth` pass since
      // both carry the `end_month` timing) is not double-counted. The
      // first pass to produce it wins; later identical re-emissions are
      // skipped so cooldown/novelty bumps and ranking stay correct.
      if (existingSeeds.some((e) => e.id === seed.id)) continue
      allCandidates.push({ generatorId: generator.id, seed })
    }
  }

  if (allCandidates.length === 0 && rejected.length === 0) return

  // Score, validate, thread cooldowns.
  const accepted: IssueSeed[] = []
  for (const { generatorId, seed } of allCandidates) {
    const novelty = computeNovelty(generatorId, slice.cooldowns, absoluteDay)
    seed.novelty = novelty
    seed.cardWorthiness = computeCardWorthiness({
      seed,
      templateId: generatorId,
      cooldowns: slice.cooldowns,
      absoluteDay,
      activeIssueSeedTags,
    })
    // Phase 39 §39.16 — expanded families use the state-aware validator
    // so missing world refs / missing pressure snapshots / missing
    // memory/attribution backing rejects the seed.
    seed.validation = EXPANDED_ISSUE_SEED_FAMILIES.includes(
      seed.family as (typeof EXPANDED_ISSUE_SEED_FAMILIES)[number],
    )
      ? validateSeedAgainstState(seed, {
          state: ctx.state,
          strictTextBudget: false,
        })
      : validateSeed(seed, { strictTextBudget: false })

    if (!seed.validation.valid) {
      rejected.push({
        family: seed.family,
        templateId: generatorId,
        reason: seed.validation.errors[0] ?? 'invalid seed',
      })
      continue
    }
    if (!shouldSurfaceAsIssueSeed(ctx.state, seed)) {
      rejected.push({
        family: seed.family,
        templateId: generatorId,
        reason: 'withheld by early-game inherited-condition fairness gate',
      })
      continue
    }

    accepted.push(seed)
    // Track cooldown bump on every generation regardless of whether the
    // seed gets selected later — repeated generation is the signal that
    // novelty should drop.
    const actorIds = seed.affectedActors
      .map((a) => a.id)
      .concat(seed.primaryActor ? [seed.primaryActor.id] : [])
    const locationIds = seed.location ? [seed.location.id] : []
    slice = bumpCooldownOnGenerate(
      slice,
      generatorId,
      seed.family,
      absoluteDay,
      actorIds,
      locationIds,
    )
  }

  // Phase 2 (teleology) — bound the hand to a budget, reserving slots for
  // teleology vs triage seeds, sim-side for replay determinism. Applied
  // after ranking on the accumulated union so each segment-local pass holds
  // the hand within budget.
  const ranked = applyHandBudget(rankSeeds([...existingSeeds, ...accepted]))

  // Phase 2 (teleology) — preserve every seed that has been part of the
  // visible hand at the end of any pass today. The hand budget can displace
  // an earlier-surfaced seed from `seedsToday` when a later pass adds a
  // higher-ranked seed, but a card the player was shown must remain
  // resolvable by `applyResponses`. Union by id, with the latest ranked
  // version winning for a seed present in both, so a displaced seed survives
  // here while the visible hand stays budget-bounded.
  const surfacedById = new Map<string, IssueSeed>()
  for (const seed of baseSurfaced) surfacedById.set(seed.id, seed)
  for (const seed of ranked) surfacedById.set(seed.id, seed)
  const surfacedToday = [...surfacedById.values()]

  writeSlice(
    ctx,
    {
      seedsToday: ranked,
      surfacedToday,
      rejectedToday: [...baseRejected, ...rejected],
      cooldowns: slice.cooldowns,
      totalGenerated: baseTotalGenerated + allCandidates.length,
      totalRejected: baseTotalRejected + rejected.length,
      lastGeneratedDay: absoluteDay,
    },
    `generate_seeds_${timings.join('_')}`,
  )
}

// Phase 186 / Cluster 1 — Segment A entry. Clear the day's seed surface
// so the day owns its own seeds (no carry-over of yesterday's set), then
// generate the morning surface. Morning generators read the prior day's
// settled (closing) pressure snapshot — the standing conditions known at
// sunrise (phase-186 contract §3.1). On day 0 there is no prior snapshot,
// so the morning surface is legitimately empty until a closing has run.
const startDayHook: SimulationHook = (ctx: SimContext): void => {
  ensureRequiredSeedGeneratorsRegistered(issueSeedGeneratorRegistry)
  writeSlice(
    ctx,
    { seedsToday: [], surfacedToday: [], rejectedToday: [] },
    'day_initialize',
  )
  runGenerationPass(ctx, ['morning_prep'])
}

// Phase 186 / Cluster 1 — during-service surface. Runs at `afterService`
// so it reads the day's *settled* customer satisfaction (the customers
// module writes satisfaction in its own `afterService` hook, which — by
// pipeline registration order — precedes this one), while still running
// before this day's `closing` pressure recompute, so the pressure-based
// guards read the prior-closing snapshot (GATE A / contract §1.8).
const duringServiceHook: SimulationHook = (ctx: SimContext): void => {
  runGenerationPass(ctx, ['during_service'])
}

// Phase 186 / Cluster 1 — closing surface. Depends on `pressures`, so this
// hook runs after `calculatePressuresHook` and reads this day's freshly
// settled pressures — the same settled read the retired `generateReports`
// lump gave every late-timing seed.
//
// Phase 186 / Cluster 4 — the choice-bearing periodic seeds
// (`debt_rent`, `monthly_review`) were re-homed to the *morning* pass via
// `generateWith: ['morning_prep']`, so they surface at the morning pause
// where the player can act on them (contract §3.5). This pass therefore no
// longer runs the `end_week`/`end_month` timings, and the Cluster-1
// closing-pass/boundary-pass dual generation + id-dedupe scaffold that
// kept `debt_rent` on a daily cadence is gone — each periodic-choice seed
// now has a single generation home in the morning pass.
const closingHook: SimulationHook = (ctx: SimContext): void => {
  runGenerationPass(ctx, ['closing'])
}

// Phase 186 / Cluster 4 — weekly/monthly boundary surfaces are retained for
// any *future* rollup-dependent boundary seed that genuinely cannot be read
// before its rollup settles. After the Cluster-4 re-homing, no registered
// generator targets these passes (`debt_rent`/`monthly_review` use
// `generateWith: ['morning_prep']`), so they currently produce nothing —
// `runGenerationPass` returns early when no generator matches. A future
// generator opts in by declaring `end_week`/`end_month` as its
// `generateWith` (or, by default, its render `timing`).
const endWeekHook: SimulationHook = (ctx: SimContext): void => {
  runGenerationPass(ctx, ['end_week'])
}

const endMonthHook: SimulationHook = (ctx: SimContext): void => {
  runGenerationPass(ctx, ['end_month'])
}

function buildReport(ctx: SimContext): ReportSection {
  return buildIssueSeedReport(ctx)
}

function validateIssueSeeds(ctx: SimContext): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const slice = getSlice(ctx)
  for (let i = 0; i < slice.seedsToday.length; i += 1) {
    const seed = slice.seedsToday[i]!
    if (seed.severity < 0 || seed.severity > 100) {
      issues.push({
        path: `modules.issueSeeds.seedsToday[${i}].severity`,
        message: `Seed '${seed.id}' severity out of range`,
        code: 'issue_seed_severity_oor',
      })
    }
    if (seed.urgency < 0 || seed.urgency > 100) {
      issues.push({
        path: `modules.issueSeeds.seedsToday[${i}].urgency`,
        message: `Seed '${seed.id}' urgency out of range`,
        code: 'issue_seed_urgency_oor',
      })
    }
  }
  return issues
}

// Schema for state.modules.issueSeeds. Kept loose for the rich seed
// shape — we validate via the engine validators below, not by replicating
// every nested field in Zod. The shape is JSON-safe.
const IssueSeedModuleStateSchema = z.object({
  seedsToday: z.array(z.unknown()),
  // Optional so saves written before Phase 2 (which lack the field) still
  // validate; `startDay` rewrites it every day and reads default to `[]`.
  surfacedToday: z.array(z.unknown()).optional(),
  cooldowns: z.record(z.string(), z.unknown()),
  rejectedToday: z.array(z.unknown()),
  totalGenerated: z.number().int().min(0),
  totalRejected: z.number().int().min(0),
  lastGeneratedDay: z.number().int(),
  recentPicks: z.record(z.string(), z.record(z.string(), z.number().int())),
})

export const issueSeedsModule: SimulationModule = {
  id: ISSUE_SEEDS_MODULE_ID,
  version: '0.1.0',
  // Phase 186 / Cluster 1 — `customers` added so the during-service
  // (`afterService`) generation pass runs AFTER the customers module
  // settles satisfaction in its own `afterService` hook; `weekly`/`monthly`
  // added so the `endWeek`/`endMonth` passes run AFTER their rollups settle
  // (e.g. `monthly_review` can read `lastMonthlyResult`). The pre-existing
  // causes/memories/pressures deps keep generation after the analysis
  // stack, including the `closing` pressure recompute.
  dependsOn: [
    'causes',
    'memories',
    'pressures',
    'customers',
    'weekly',
    'monthly',
  ],
  hooks: {
    // Phase 186 / Cluster 1 — generation is segment-local: each pass runs
    // at the phase matching its seeds' `timing`, replacing the single
    // end-of-day `generateReports` lump. See the hook comments above.
    startDay: [startDayHook],
    afterService: [duringServiceHook],
    closing: [closingHook],
    endWeek: [endWeekHook],
    endMonth: [endMonthHook],
  },
  buildReport: buildReport,
  validate: validateIssueSeeds,
  stateSchema: IssueSeedModuleStateSchema,
}

export {
  ISSUE_SEEDS_MODULE_ID,
  createInitialIssueSeedModuleState,
  issueSeedGeneratorRegistry,
  REQUIRED_SEED_GENERATORS,
}

export type { IssueSeedModuleState }
