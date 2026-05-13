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
} from './issueSeedTypes'
import { ISSUE_SEEDS_MODULE_ID } from './issueSeedQueries'

// Phase 19 — Issue seed module.
//
// Responsibilities:
//   - Self-register the required seed generators on module load.
//   - Run all generators during the `generateReports` phase, after
//     pressures and causes have settled. The generators are pure-ish
//     readers of state; they emit seed candidates which the module then
//     validates, ranks, and stores in `state.modules.issueSeeds`.
//   - Maintain cooldown/novelty tracking across days.
//   - Emit the ISSUE SEED REPORT during `generateReports`.
//   - Validate module slice shape on `validate`.

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

const startDayHook: SimulationHook = (ctx: SimContext): void => {
  ensureRequiredSeedGeneratorsRegistered(issueSeedGeneratorRegistry)
  writeSlice(
    ctx,
    {
      seedsToday: [],
      rejectedToday: [],
    },
    'day_initialize',
  )
}

// Phase 19 generators run during `generateReports` so they see the
// fully settled pressures/causes from the day, before the issue-seed
// report is built.
const generateSeedsHook: SimulationHook = (ctx: SimContext): void => {
  ensureRequiredSeedGeneratorsRegistered(issueSeedGeneratorRegistry)
  const allCandidates: Array<{ generatorId: string; seed: IssueSeed }> = []
  const rejected: IssueSeedModuleState['rejectedToday'] = []

  // Read previous slice now; we'll write all changes once at the end so
  // every generator sees the same starting cooldown state.
  let slice = getSlice(ctx)
  const absoluteDay = ctx.state.calendar.totalDaysElapsed

  for (const generator of issueSeedGeneratorRegistry.all()) {
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
      allCandidates.push({ generatorId: generator.id, seed })
    }
  }

  // Score, validate, and rank.
  const accepted: IssueSeed[] = []
  for (const { generatorId, seed } of allCandidates) {
    const novelty = computeNovelty(generatorId, slice.cooldowns, absoluteDay)
    seed.novelty = novelty
    seed.cardWorthiness = computeCardWorthiness({
      seed,
      templateId: generatorId,
      cooldowns: slice.cooldowns,
      absoluteDay,
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

  const ranked = rankSeeds(accepted)

  writeSlice(
    ctx,
    {
      seedsToday: ranked,
      rejectedToday: rejected,
      cooldowns: slice.cooldowns,
      totalGenerated:
        getSlice(ctx).totalGenerated + allCandidates.length,
      totalRejected: getSlice(ctx).totalRejected + rejected.length,
      lastGeneratedDay: absoluteDay,
    },
    'generate_seeds',
  )
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
  dependsOn: ['causes', 'memories', 'pressures'],
  hooks: {
    startDay: [startDayHook],
    // Seeds are generated after pressures finalise during `closing`, but
    // before `generateReports` collects sections. Placing the hook in
    // `generateReports` ensures the seed report can include the freshly
    // generated seeds.
    generateReports: [generateSeedsHook],
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
