// Expansion arc / Phase 0 (ISSUE-170, repo phase 207) — the repository map.
//
// `docs/plans/GOBLIN_TAVERN_SIMULATION_EXPANSION_WORK_PLAN.md` § "Phase 0 →
// Repository map" lists what must be mapped before the expansion starts:
// package scripts and runtime versions, the canonical pipeline / phases /
// segments, every module-owned persistent slice, every direct mutation of
// `TavernState`, every RNG stream and unscoped random call, every save
// version and migration, the registries and catalogs, and the Help/glossary
// promises.
//
// The map is DERIVED, never hand-maintained: everything below is read out
// of the live code, either by importing it or by a narrow static scan. The
// frozen copy lives at `docs/plans/expansion/repo-map.json` and
// `tests/sim/phase207.baselineAndLedger.test.ts` fails when the two
// disagree — so a later phase that adds a module, a phase, an RNG stream, a
// migration step, or a glossary promise has to record it here in the same
// commit.
//
//   npm run repo:map              re-derive and diff against the frozen file
//   npm run repo:map -- --write   re-freeze it
//
// Two entries are deliberately expressed as absences rather than lists:
// `unscopedRandomCalls` (the "no `Math.random()` in `src/sim/`" rule) and
// `directStateMutationSites` (the sanctioned-mutation rule). They are worth
// nothing as prose and everything as a number that must stay at zero.

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { FULL_PIPELINE } from '../src/sim/canonicalPipeline'
import { SIMULATION_PHASES } from '../src/sim/core/phases'
import { DAY_SEGMENTS, phasesForSegment } from '../src/sim/core/segments'
import { simulateDay } from '../src/sim/core/engine'
import { createInitialTavernState } from '../src/sim/state/defaults'
import { DIFFICULTY_PRESETS } from '../src/sim/state/difficulty'
import {
  actionRegistry,
  ensureRequiredOwnerActionsRegistered,
} from '../src/sim/registries/actionRegistry'
import { areaRegistry, ensureRequiredAreasRegistered } from '../src/sim/registries/areaRegistry'
import {
  customerRegistry,
  ensureRequiredCustomerGroupsRegistered,
} from '../src/sim/registries/customerRegistry'
import { pressureRegistry } from '../src/sim/registries/pressureRegistry'
import { ensureRequiredPressuresRegistered } from '../src/sim/modules/pressures/pressureRegistry'
import { recipeRegistry, ensureRequiredRecipesRegistered } from '../src/sim/registries/recipeRegistry'
import {
  staffPriorityRegistry,
  ensureRequiredStaffPrioritiesRegistered,
} from '../src/sim/registries/staffPriorityRegistry'
import { staffRegistry, ensureRequiredStaffRolesRegistered } from '../src/sim/registries/staffRegistry'
import { stockRegistry, ensureRequiredStockRegistered } from '../src/sim/registries/stockRegistry'
import {
  feedbackLoopRegistry,
  ensureRequiredFeedbackLoopsRegistered,
} from '../src/sim/modules/feedback/feedbackLoopRegistry'
import { ALL_SEED_GENERATORS } from '../src/sim/modules/issues/issueSeedGenerators'
import { REQUIRED_CARDS } from '../src/cards/templates/index'
import {
  areaUpgradeRegistry,
  ensureRequiredAreaUpgradesRegistered,
} from '../src/sim/content/tavern/areaUpgradeRegistry'
import {
  cultureRegistry,
  ensureRequiredCulturesRegistered,
} from '../src/sim/content/cultures/cultureRegistry'
import {
  factionRegistry,
  ensureRequiredFactionsRegistered,
} from '../src/sim/content/factions/factionRegistry'
import {
  supplierRegistry,
  ensureRequiredSuppliersRegistered,
} from '../src/sim/content/suppliers/supplierRegistry'
import {
  marketConditionRegistry,
  ensureRequiredMarketConditionsRegistered,
} from '../src/sim/content/suppliers/marketConditionRegistry'
import { STARTER_LOCAL_ARC_DEFINITIONS } from '../src/sim/content/events/localArcRegistry'
import { VENTURE_BLUEPRINTS } from '../src/sim/modules/ventures/ventureCatalog'
import { GLOSSARY_TERMS } from '../src/reports/glossary'
import { SAVE_VERSION } from '../web/src/lib/sim/persistence'
import { blankComments, scanFutureHookSites, futureHookIds } from './expansion-ledger'

export const REPO_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
export const REPO_MAP_PATH = join(REPO_ROOT, 'docs/plans/expansion/repo-map.json')

export const REPO_MAP_VERSION = 1

// ---------------------------------------------------------------------------
// Static scans
// ---------------------------------------------------------------------------

function listTypeScriptFiles(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) listTypeScriptFiles(full, out)
    else if (entry.name.endsWith('.ts')) out.push(full)
  }
  return out
}

/** The `RngStreamId` union members, in declaration order. Named streams are
 *  an architectural rule (CLAUDE.md §7), so the list is worth freezing. */
export function scanRngStreamIds(root: string = REPO_ROOT): string[] {
  const source = blankComments(readFileSync(join(root, 'src/sim/core/rng.ts'), 'utf8'))
  const start = source.indexOf('export type RngStreamId')
  if (start === -1) throw new Error('repo map: RngStreamId union not found in src/sim/core/rng.ts')
  const end = source.indexOf('export type RngStreamState', start)
  const body = source.slice(start, end === -1 ? undefined : end)
  return [...body.matchAll(/\|\s*'([a-z0-9_]+)'/g)].map((m) => m[1]!)
}

/** Files under `dir` that call `Math.random()`. `src/sim/` must stay empty
 *  — the simulation is seeded (CLAUDE.md §5). */
export function scanUnscopedRandomCalls(dir: string, root: string = REPO_ROOT): string[] {
  const hits: string[] = []
  for (const file of listTypeScriptFiles(join(root, dir))) {
    const source = blankComments(readFileSync(file, 'utf8'))
    if (/\bMath\.random\s*\(/.test(source)) hits.push(relative(root, file))
  }
  return hits.sort()
}

/** The ordered migration chain the loader runs on an old save. */
export function scanMigrationSteps(root: string = REPO_ROOT): string[] {
  const source = blankComments(
    readFileSync(join(root, 'web/src/lib/sim/persistence.ts'), 'utf8'),
  )
  const start = source.indexOf('function migrateAndValidateState')
  if (start === -1) throw new Error('repo map: migrateAndValidateState not found')
  const end = source.indexOf('\n}', source.indexOf('safeValidateState', start))
  const body = source.slice(start, end === -1 ? undefined : end)
  return [...body.matchAll(/\b(ensure[A-Za-z]+|flip[A-Za-z]+)\(/g)].map((m) => m[1]!)
}

// ---------------------------------------------------------------------------
// The map
// ---------------------------------------------------------------------------

export type RepoMap = {
  version: number
  packageScripts: string[]
  runtime: Record<string, string | null>
  pipeline: string[]
  phases: string[]
  segments: Record<string, string[]>
  /** Module-owned persistent slices, as they exist after one simulated day. */
  moduleStateSlices: string[]
  topLevelStateSlices: string[]
  rngStreams: string[]
  /** Must stay empty: the simulation is seeded end to end. */
  unscopedRandomCallsInSim: string[]
  unscopedRandomCallsInCards: string[]
  save: { version: number; migrationSteps: string[] }
  difficulties: string[]
  /** Plan §3's starting inventory, read from the live registries. */
  inventory: Record<string, number>
  /** Every Help/glossary promise, by id. */
  glossaryTerms: string[]
  futureHooks: { families: number; sites: number }
}

function readPackageJson(root: string): {
  scripts?: Record<string, string>
  engines?: Record<string, string>
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
} {
  return JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
}

export function collectInventory(): Record<string, number> {
  ensureRequiredOwnerActionsRegistered()
  ensureRequiredAreasRegistered()
  ensureRequiredCustomerGroupsRegistered()
  ensureRequiredPressuresRegistered()
  ensureRequiredRecipesRegistered()
  ensureRequiredStaffPrioritiesRegistered()
  ensureRequiredStaffRolesRegistered()
  ensureRequiredStockRegistered()
  ensureRequiredFeedbackLoopsRegistered()
  ensureRequiredAreaUpgradesRegistered()
  ensureRequiredCulturesRegistered()
  ensureRequiredFactionsRegistered()
  ensureRequiredSuppliersRegistered()
  ensureRequiredMarketConditionsRegistered()

  const fresh = createInitialTavernState()
  return {
    runtimeModules: FULL_PIPELINE.length,
    simulationPhases: SIMULATION_PHASES.length,
    daySegments: DAY_SEGMENTS.length,
    ownerActions: actionRegistry.all().length,
    staffPriorities: staffPriorityRegistry.all().length,
    pressureDomains: pressureRegistry.all().length,
    feedbackDetectors: feedbackLoopRegistry.all().length,
    issueGenerators: ALL_SEED_GENERATORS.length,
    issueGeneratorFamilies: new Set(ALL_SEED_GENERATORS.map((g) => g.family)).size,
    cardTemplates: REQUIRED_CARDS.length,
    areas: areaRegistry.all().length,
    areaUpgrades: areaUpgradeRegistry.all().length,
    stockRecords: stockRegistry.all().length,
    recipes: recipeRegistry.all().length,
    customerGroups: customerRegistry.all().length,
    foundingStaff: Object.keys(fresh.staff).length,
    cultures: cultureRegistry.all().length,
    factions: factionRegistry.all().length,
    suppliers: supplierRegistry.all().length,
    marketConditions: marketConditionRegistry.all().length,
    localArcs: STARTER_LOCAL_ARC_DEFINITIONS.length,
    ventureBlueprints: Object.keys(VENTURE_BLUEPRINTS).length,
    staffRoles: staffRegistry.all().length,
    reputationAxes: Object.keys(fresh.reputation).length,
  }
}

export function collectRepoMap(root: string = REPO_ROOT): RepoMap {
  const pkg = readPackageJson(root)
  const deps = { ...pkg.dependencies, ...pkg.devDependencies }

  const fresh = createInitialTavernState()
  const afterOneDay = simulateDay(fresh, { seed: 'repo-map' }, FULL_PIPELINE).state

  const segments: Record<string, string[]> = {}
  for (const segment of DAY_SEGMENTS) segments[segment] = [...phasesForSegment(segment)]

  const sites = scanFutureHookSites(root)

  return {
    version: REPO_MAP_VERSION,
    packageScripts: Object.keys(pkg.scripts ?? {}).sort(),
    runtime: {
      // No `engines` field today — recorded as null rather than guessed, so
      // adding one is a visible change to the map.
      node: pkg.engines?.['node'] ?? null,
      typescript: deps['typescript'] ?? null,
      vite: deps['vite'] ?? null,
      vitest: deps['vitest'] ?? null,
      svelte: deps['svelte'] ?? null,
      zod: deps['zod'] ?? null,
      prando: deps['prando'] ?? null,
    },
    pipeline: FULL_PIPELINE.map((m) => m.id),
    phases: [...SIMULATION_PHASES],
    segments,
    moduleStateSlices: Object.keys(afterOneDay.modules).sort(),
    topLevelStateSlices: Object.keys(afterOneDay).sort(),
    rngStreams: scanRngStreamIds(root),
    unscopedRandomCallsInSim: scanUnscopedRandomCalls('src/sim', root),
    unscopedRandomCallsInCards: scanUnscopedRandomCalls('src/cards', root),
    save: { version: SAVE_VERSION, migrationSteps: scanMigrationSteps(root) },
    difficulties: Object.keys(DIFFICULTY_PRESETS).sort(),
    inventory: collectInventory(),
    glossaryTerms: GLOSSARY_TERMS.map((t) => t.id).sort(),
    futureHooks: { families: futureHookIds(sites).length, sites: sites.length },
  }
}

export function readRepoMap(path: string = REPO_MAP_PATH): RepoMap {
  return JSON.parse(readFileSync(path, 'utf8')) as RepoMap
}

export function serializeRepoMap(map: RepoMap): string {
  return `${JSON.stringify(map, null, 2)}\n`
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function main(argv: string[]): number {
  const built = collectRepoMap()

  if (argv.includes('--write')) {
    writeFileSync(REPO_MAP_PATH, serializeRepoMap(built), 'utf8')
    process.stdout.write(`wrote the repository map to ${REPO_MAP_PATH}\n`)
    return 0
  }

  let frozen: RepoMap
  try {
    frozen = readRepoMap()
  } catch (err) {
    process.stderr.write(
      `repo map: cannot read ${REPO_MAP_PATH} (${(err as Error).message}). Run with --write.\n`,
    )
    return 1
  }

  const drifted = (Object.keys(built) as Array<keyof RepoMap>).filter(
    (key) => JSON.stringify(frozen[key]) !== JSON.stringify(built[key]),
  )

  process.stdout.write(
    `repo map: ${built.pipeline.length} modules, ${built.phases.length} phases, ` +
      `${built.rngStreams.length} rng streams, ${built.glossaryTerms.length} glossary terms, ` +
      `${drifted.length} section(s) drifted\n`,
  )
  if (drifted.length > 0) {
    for (const key of drifted) process.stderr.write(`  ! ${key}\n`)
    process.stderr.write('If the change is intended, re-run with --write and commit the diff.\n')
    return 1
  }
  return 0
}

const invokedDirectly =
  process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (invokedDirectly) process.exit(main(process.argv.slice(2)))
