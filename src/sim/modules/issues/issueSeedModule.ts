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
import { EXPANDED_ISSUE_SEED_FAMILIES } from './issueSeedTypes'
import { buildIssueSeedReport } from './issueSeedReport'
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
//     generator's declared `timing`, instead of pre-baking the whole day's
//     set during `generateReports` the evening before:
//       · `morning_prep`   → `startDay`     (the morning the player sees)
//       · `during_service` → `afterService` (emergent from the service rush)
//       · `closing`        → `closing`      (after pressures settle)
//       · `end_week`       → `endWeek`      (weekly boundary only)
//       · `end_month`      → `endMonth`     (monthly boundary only)
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
  const baseRejected = slice.rejectedToday
  const baseTotalGenerated = slice.totalGenerated
  const baseTotalRejected = slice.totalRejected

  const generators = issueSeedGeneratorRegistry
    .all()
    .filter((g) => g.timing.some((t) => timings.includes(t)))

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
      // Defensive: a generator declared for this pass's timings must
      // emit seeds of those timings. Skip any stray off-timing seed so a
      // pass never stores a seed that belongs to another segment.
      if (!timings.includes(seed.timing)) continue
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

  const ranked = rankSeeds([...existingSeeds, ...accepted])

  writeSlice(
    ctx,
    {
      seedsToday: ranked,
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
  writeSlice(ctx, { seedsToday: [], rejectedToday: [] }, 'day_initialize')
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

// Phase 186 / Cluster 1 — closing + standing-periodic surface. Depends on
// `pressures`, so this hook runs after `calculatePressuresHook` and reads
// this day's freshly settled pressures — the same settled read the retired
// `generateReports` lump gave every late-timing seed.
//
// The `end_week`/`end_month` timings are run here as well so the *standing-
// condition* periodic seeds keep their daily cadence: `debt_rent` (an
// `end_month` seed that fires whenever rent arrears / low coin hold, not
// only on the 28th) stays available the day its condition holds. Periodic
// seeds whose content depends on a weekly/monthly rollup self-guard out of
// this pass — `monthly_review` returns nothing until `lastMonthlyResult`
// exists, which is not written until `endMonth` — and are produced by the
// boundary passes below instead. Re-homing the choice-bearing periodic
// seeds to their proper pause/report surface is Cluster 4's job
// (contract §3.5); Cluster 1 only relocates *where* they are produced.
const closingHook: SimulationHook = (ctx: SimContext): void => {
  runGenerationPass(ctx, ['closing', 'end_week', 'end_month'])
}

// Phase 186 / Cluster 1 — weekly/monthly boundary surfaces. The engine
// only runs `endWeek`/`endMonth` on the matching calendar boundary and
// (by pipeline order) AFTER the weekly/monthly modules settle their
// rollups, so a rollup-dependent seed like `monthly_review` (which needs
// `lastMonthlyResult`) reads correct, post-rollup state here. Any seed
// already produced by the `closing` pass today (e.g. `debt_rent`) is
// deduped by id inside `runGenerationPass`, so these passes only ADD the
// boundary-only seeds.
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
