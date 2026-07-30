import type { SimulationPhase } from '../../core/phases'

// Expansion Phase 1 §1.7 — narrow the engine extension surface.
//
// The engine stays central; what changes is how much a new domain can get
// WRONG while connecting to it. Today a module can declare `dependsOn` for
// same-phase ordering and a `stateSchema` for its slice, and that is the
// whole contract — so nothing catches a module that reads a slice another
// module writes later in the same phase, or two modules both writing one
// slice, or a domain event with no owner.
//
// A `ModuleContract` is an optional, additive declaration of what a module
// touches. It is data, so architecture tests can check it without running a
// day; and it is optional, so this phase does not have to rewrite
// twenty-nine modules to land (§1.7: "Do not perform a big-bang engine
// rewrite. Migrate one domain at a time").

export type SliceAccess = 'reads' | 'writes' | 'owns'

export type ModuleSliceContract = {
  /** The `state.modules` key. */
  sliceId: string
  /**
   * Schema version for the slice. Bumped whenever a persisted field is
   * added or changed, so §5.7's "schema migration in the same phase as any
   * persisted field" has a version to migrate from.
   */
  version: number
  /**
   * `owns` — this module is the sole writer and the schema's author.
   * `writes` — it mutates a slice another module owns (needs the owner's
   *            blessing; the architecture test lists these so they stay
   *            deliberate rather than accidental).
   * `reads`  — read-only.
   */
  access: SliceAccess
}

export type ModuleContract = {
  /** Slices this module reads, writes, or owns. */
  slices: ReadonlyArray<ModuleSliceContract>
  /**
   * Top-level `TavernState` branches the module WRITES (`coin`, `areas`,
   * `pressures`, `world.suppliers`…). Declared so a cross-phase assumption
   * can be checked instead of trusted.
   */
  writesStatePaths?: ReadonlyArray<string>
  /** Top-level branches it depends on having been updated already. */
  readsStatePaths?: ReadonlyArray<string>
  /** Scheduled-event types this module owns and resolves. */
  ownsEventTypes?: ReadonlyArray<string>
  /** Scheduled-event types this module schedules but does not own. */
  schedulesEventTypes?: ReadonlyArray<string>
  /**
   * Phases in which the module's hooks must run after another module's,
   * beyond the coarse `dependsOn`. Keyed by phase so a same-phase
   * requirement is expressible without over-constraining every other phase.
   */
  phaseDependencies?: Partial<Record<SimulationPhase, ReadonlyArray<string>>>
}

/**
 * A compatibility re-export seam: a file that re-exports a symbol whose real
 * home is elsewhere, so older import paths keep working.
 *
 * §1.7 asks to "identify compatibility barrels and prevent them from
 * becoming alternate implementations". The risk is specific and worth naming
 * precisely: it is NOT that the seam file contains logic — `simRunner.ts` is
 * a substantial module in its own right that merely happens to re-export
 * `FULL_PIPELINE`. The risk is that the seam grows its own DEFINITION of the
 * re-exported symbol, at which point two copies drift and callers get
 * different answers depending on which path they imported from.
 *
 * So the checked property is per-symbol: `symbols` must be re-exported from
 * `canonical`, never declared locally.
 */
export type CompatibilityBarrel = {
  /** Repo-relative path of the file carrying the seam. */
  path: string
  /** Repo-relative path of the canonical implementation. */
  canonical: string
  /**
   * `re_export` — the file re-exports `symbols` from `canonical`. It may
   *   hold plenty of its own unrelated code; what it must never do is
   *   declare its own version of a re-exported symbol.
   * `legacy_parallel` — the file IS a second implementation of something
   *   `canonical` also does, kept alive for old tests. It cannot be checked
   *   for redefinition (redefinition is what it is); what must hold instead
   *   is that no production code reaches for it.
   */
  kind: 're_export' | 'legacy_parallel'
  symbols: ReadonlyArray<string>
  why: string
}

export const KNOWN_COMPATIBILITY_BARRELS: ReadonlyArray<CompatibilityBarrel> = [
  {
    path: 'src/sim/testing/simRunner.ts',
    canonical: 'src/sim/canonicalPipeline.ts',
    kind: 're_export',
    symbols: ['FULL_PIPELINE'],
    why: 'The cardless playtest runner also re-exports FULL_PIPELINE for the many callers that imported it from testing/ before Phase 92 moved the pipeline to production code.',
  },
  {
    path: 'src/sim/registries/moduleRegistry.ts',
    canonical: 'src/sim/canonicalPipeline.ts',
    kind: 'legacy_parallel',
    symbols: ['moduleRegistry'],
    why: 'Phase 2 generic registry kept for early structure tests. It is a genuine second implementation, so the enforceable rule is that no production code imports it — the runtime pipeline is the only source of module discovery.',
  },
]

/**
 * Contract declarations, keyed by module id.
 *
 * Kept OUT of `SimulationModule` itself so declaring a contract does not
 * require touching each module file, and so the whole map can be read at
 * once by the architecture tests. Modules with no entry are simply
 * undeclared — which the coverage test reports as a number to drive down,
 * not as a failure.
 */
export const MODULE_CONTRACTS: Readonly<Record<string, ModuleContract>> = {
  ruleset: {
    slices: [{ sliceId: 'ruleset', version: 1, access: 'owns' }],
    // The ruleset is read by whoever is decaying; it writes only its own
    // banked remainders.
    readsStatePaths: [],
  },
  scheduledEvents: {
    slices: [{ sliceId: 'scheduledEvents', version: 1, access: 'owns' }],
    // Resolvers belonging to other modules mutate their own state during the
    // drain, so this module declares no state paths of its own beyond causes
    // and history, which every module may append to.
    //
    // No `phaseDependencies` entry for "must see the day's responses": that
    // is a CROSS-phase requirement, guaranteed by the pipeline's phase order
    // (`resolveScheduledEvents` follows `applyResponses` in
    // `SIMULATION_PHASES`) and asserted by the segment-boundary check.
    // `phaseDependencies` is for SAME-phase ordering, which is a different
    // question — declaring a cross-phase requirement there would demand
    // `responses` grow a hook in a phase it has no business running in.
  },
  obligations: {
    slices: [
      { sliceId: 'obligations', version: 1, access: 'owns' },
      { sliceId: 'scheduledEvents', version: 1, access: 'writes' },
      { sliceId: 'ruleset', version: 1, access: 'reads' },
    ],
    ownsEventTypes: ['obligation_due', 'obligation_grace_expiry'],
    schedulesEventTypes: ['obligation_due', 'obligation_grace_expiry'],
  },
  meters: {
    slices: [{ sliceId: 'meters', version: 1, access: 'owns' }],
  },
  responses: {
    slices: [
      { sliceId: 'responses', version: 1, access: 'owns' },
      { sliceId: 'issueSeeds', version: 1, access: 'reads' },
      // The future-hook bridge records typed expectations.
      { sliceId: 'scheduledEvents', version: 1, access: 'writes' },
      { sliceId: 'ownerActions', version: 1, access: 'reads' },
    ],
    readsStatePaths: ['coin'],
    writesStatePaths: ['coin', 'pressures'],
  },
  areas: {
    slices: [{ sliceId: 'ruleset', version: 1, access: 'reads' }],
    writesStatePaths: ['areas'],
  },
  stock: {
    slices: [{ sliceId: 'ruleset', version: 1, access: 'reads' }],
    writesStatePaths: ['stock', 'coin'],
  },
  staff: {
    // Expansion Phase 3 — the staff module owns its own slice (employment
    // terms, the labor market, relationships, staff actors and the day's
    // roster), writes the shared scheduled-event queue for the events it owns,
    // and writes the shared obligation ledger for wage arrears. The last two are
    // declared `writes` rather than `owns` precisely so the architecture check
    // reports them as deliberate cross-module writes.
    slices: [
      { sliceId: 'staff', version: 1, access: 'owns' },
      { sliceId: 'ruleset', version: 1, access: 'reads' },
      { sliceId: 'scheduledEvents', version: 1, access: 'writes' },
      { sliceId: 'obligations', version: 1, access: 'writes' },
    ],
    ownsEventTypes: [
      'staff_quit_risk',
      'staff_separation',
      'staff_raise_demand',
      'wage_expectation',
      'raise_promised',
      'coverage_gap',
      'training_helper',
      'authority_test',
      'staff_bonus_expected',
      'cross_staff_grumble',
      'staff_loyalty_memory',
    ],
    schedulesEventTypes: [
      'staff_quit_risk',
      'staff_separation',
      'staff_raise_demand',
    ],
    writesStatePaths: ['staff', 'coin'],
  },
  pressures: {
    slices: [
      { sliceId: 'pressures', version: 1, access: 'owns' },
      { sliceId: 'ruleset', version: 1, access: 'reads' },
      { sliceId: 'meters', version: 1, access: 'writes' },
    ],
    writesStatePaths: ['pressures'],
  },
}

/** Every slice a module declares it owns. Used to detect two owners. */
export function ownedSlices(): Map<string, string[]> {
  const owners = new Map<string, string[]>()
  for (const [moduleId, contract] of Object.entries(MODULE_CONTRACTS)) {
    for (const slice of contract.slices) {
      if (slice.access !== 'owns') continue
      const list = owners.get(slice.sliceId) ?? []
      list.push(moduleId)
      owners.set(slice.sliceId, list)
    }
  }
  return owners
}

/** Cross-module slice writes, which must be deliberate rather than accidental. */
export function foreignSliceWrites(): Array<{
  moduleId: string
  sliceId: string
  owner: string | undefined
}> {
  const owners = ownedSlices()
  const out: Array<{ moduleId: string; sliceId: string; owner: string | undefined }> =
    []
  for (const [moduleId, contract] of Object.entries(MODULE_CONTRACTS)) {
    for (const slice of contract.slices) {
      if (slice.access !== 'writes') continue
      out.push({
        moduleId,
        sliceId: slice.sliceId,
        owner: owners.get(slice.sliceId)?.[0],
      })
    }
  }
  return out
}
