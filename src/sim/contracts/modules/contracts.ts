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
    slices: [
      { sliceId: 'stock', version: 1, access: 'owns' },
      { sliceId: 'ruleset', version: 1, access: 'reads' },
    ],
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
  economy: {
    // Expansion Phase 5 — the economy owns its persisted accounting,
    // financial-state and policy-compliance evidence. Coin movements go
    // through the stock ledger, hence the deliberate foreign slice write.
    slices: [
      { sliceId: 'economy', version: 1, access: 'owns' },
      { sliceId: 'stock', version: 1, access: 'writes' },
      { sliceId: 'ownerActions', version: 1, access: 'reads' },
      { sliceId: 'obligations', version: 1, access: 'reads' },
      { sliceId: 'service', version: 1, access: 'reads' },
      { sliceId: 'monthly', version: 1, access: 'reads' },
    ],
    readsStatePaths: [
      'areas',
      'calendar',
      'coin',
      'customerGroups',
      'memories',
      'staff',
      'stock',
    ],
    writesStatePaths: ['coin', 'customerGroups'],
    ownsEventTypes: [
      'economy.house_rule_friction',
      'economy.policy_held_unrest',
      'economy.policy_punishment_grudge',
      'economy.policy_reversal_remembered',
      'price_complaint_possible',
      'economy.reserves_intact',
    ],
  },
  // Expansion Phase 7 §7.2/§7.3 — the monthly slice gains a declared owner.
  //
  // It had none before, and did not need one: nothing outside the module
  // wrote it. Two things do now — the tenancy writes `monthly.rent` and the
  // regulatory module writes `monthly.inspection`, both as projections of
  // the records that replaced them — and a foreign write into an unowned
  // slice is precisely what `checkSliceOwnership` exists to catch. Declaring
  // the ownership is what makes those two writes legible as deliberate.
  monthly: {
    slices: [
      { sliceId: 'monthly', version: 1, access: 'owns' },
      { sliceId: 'weekly', version: 1, access: 'reads' },
      { sliceId: 'economy', version: 1, access: 'reads' },
      { sliceId: 'tenancy', version: 1, access: 'reads' },
      { sliceId: 'regulatory', version: 1, access: 'reads' },
      { sliceId: 'stock', version: 1, access: 'writes' },
    ],
    readsStatePaths: ['areas', 'calendar', 'coin', 'reputation', 'stock'],
    writesStatePaths: ['coin', 'reputation', 'pressures'],
  },
  // Expansion Phase 7 §7.1–7.3 — the three external-obligation domains.
  //
  // Each owns its own slice and writes two shared ones on purpose: the
  // scheduled-event queue (for the events it registered) and the obligation
  // ledger (for the money it raises). Both are declared `writes` rather than
  // `owns` precisely so the architecture check reports them as deliberate
  // cross-module writes rather than a second owner.
  finance: {
    slices: [
      { sliceId: 'finance', version: 1, access: 'owns' },
      { sliceId: 'ruleset', version: 1, access: 'reads' },
      { sliceId: 'scheduledEvents', version: 1, access: 'writes' },
      { sliceId: 'obligations', version: 1, access: 'writes' },
      { sliceId: 'stock', version: 1, access: 'writes' },
    ],
    readsStatePaths: ['calendar', 'coin'],
    writesStatePaths: ['coin', 'pressures'],
    ownsEventTypes: ['loan_instalment_review', 'loan_collections'],
    schedulesEventTypes: ['loan_instalment_review', 'loan_collections'],
  },
  tenancy: {
    // The tenancy writes `modules.monthly.rent` as a PROJECTION of its own
    // record — declared here so the deliberate foreign write is visible
    // rather than looking like a second owner of the rent.
    slices: [
      { sliceId: 'tenancy', version: 1, access: 'owns' },
      { sliceId: 'ruleset', version: 1, access: 'reads' },
      { sliceId: 'scheduledEvents', version: 1, access: 'writes' },
      { sliceId: 'obligations', version: 1, access: 'writes' },
      { sliceId: 'monthly', version: 1, access: 'writes' },
      { sliceId: 'economy', version: 1, access: 'writes' },
      { sliceId: 'stock', version: 1, access: 'writes' },
    ],
    readsStatePaths: ['areas', 'calendar', 'coin'],
    writesStatePaths: ['areas', 'coin', 'pressures'],
    ownsEventTypes: [
      'rent_period_rollover',
      'tenancy_escalation_review',
      'eviction_hearing',
      'landlord_goodwill',
      'landlord_access_request',
    ],
    schedulesEventTypes: [
      'rent_period_rollover',
      'tenancy_escalation_review',
      'eviction_hearing',
      'landlord_access_request',
    ],
  },
  // Expansion Phase 8 (ISSUE-178) — the two domains the phase adds declare
  // themselves rather than joining the undeclared pile the §1.7 coverage
  // ratchet exists to drive down.
  npcs: {
    slices: [
      { sliceId: 'npcs', version: 1, access: 'owns' },
      { sliceId: 'scheduledEvents', version: 1, access: 'writes' },
    ],
    readsStatePaths: ['calendar', 'world', 'pressures', 'reputation'],
    writesStatePaths: ['world.notableNpcs'],
    ownsEventTypes: ['npc_proposal_deadline'],
    schedulesEventTypes: ['npc_proposal_deadline'],
  },
  rumours: {
    // The rumour module is the only writer of `world.socialRumours` after
    // creation — the weekly community pass and the attribution module still
    // START rumours, and everything that happens to one after that (spread,
    // reinforcement, contradiction, correction, decay, prune) is owned here.
    slices: [
      { sliceId: 'rumours', version: 1, access: 'owns' },
      { sliceId: 'scheduledEvents', version: 1, access: 'writes' },
    ],
    readsStatePaths: ['calendar', 'world', 'customerGroups'],
    writesStatePaths: ['world.socialRumours'],
    ownsEventTypes: [
      'rumour_escalation',
      'rumour_denial_backfire',
      'counter_rumour_runaway',
    ],
    schedulesEventTypes: [
      'rumour_escalation',
      'rumour_denial_backfire',
      'counter_rumour_runaway',
    ],
  },
  // Expansion Phase 9 §9.3 — the expeditions slice stops being an empty
  // passthrough and starts carrying the journey: route, party, loadout,
  // terms, position, condition, events, the pending question and the
  // dispatch queue. It writes `world.socialRumours` on purpose — a
  // legendary haul or a lost party is talked about, and the rumour layer
  // decides who hears it — and `world.hireableAdventurers` because the
  // roster is where a runner's experience and injuries live.
  expeditions: {
    slices: [
      { sliceId: 'expeditions', version: 2, access: 'owns' },
      // A settlement the till could not cover is recorded as a decaying
      // `debt` adjustment rather than forgiven, which is a write into the
      // pressure module's own slice and is declared as such.
      { sliceId: 'pressures', version: 1, access: 'writes' },
    ],
    readsStatePaths: ['calendar', 'coin', 'expeditions', 'stock', 'world'],
    writesStatePaths: [
      'coin',
      'expeditions',
      'stock',
      'world.hireableAdventurers',
      'world.socialRumours',
    ],
  },
  // Expansion Phase 9 §9.4 — world conditions own the process a month
  // modifier used to only hint at. The slice is theirs; the writes outside it
  // are the aftermath landing in the domains that own what it wrecked —
  // areas, stock, staff, customer groups, coin and renown — because §5 is
  // explicit that a consequence which is only a meter adjustment in this
  // module's own slice has not actually happened to the tavern.
  conditions: {
    slices: [
      { sliceId: 'conditions', version: 1, access: 'owns' },
      // A tax scar is remembered by the landlord, who is the party the levy
      // runs through — so the scar's drag lands on `monthly.landlord`
      // rather than on a meter of this module's own.
      { sliceId: 'monthly', version: 1, access: 'writes' },
      // The unpaid part of a levy is recorded as a decaying `debt`
      // adjustment rather than a direct pressure write, which is a write
      // into the pressure module's own slice and is declared as such.
      { sliceId: 'pressures', version: 1, access: 'writes' },
    ],
    readsStatePaths: ['areas', 'calendar', 'coin', 'customerGroups', 'reputation', 'staff', 'stock', 'world'],
    writesStatePaths: [
      'areas',
      'coin',
      'customerGroups',
      'pressures',
      'reputation',
      'staff',
      'stock',
      // Adventurer season claims the roster among the systems it touches,
      // and now actually reaches it; quiet roads claims the suppliers.
      'world.hireableAdventurers',
      'world.suppliers',
    ],
  },
  // Expansion Phase 9 §9.2 — the suppliers slice gains a declared owner.
  //
  // Same story as the factions slice in §9.1: it had none and did not need
  // one while the suppliers module was its only writer, and an arc changed
  // that. An arc whose owner is a supplier hardens that supplier's terms as
  // its opposing move, and a called-in favour does the same — both through
  // the suppliers module's own `writeSupplierAccount`. Declaring the
  // ownership is what makes those writes legible as deliberate rather than
  // looking like a second owner of the account.
  suppliers: {
    slices: [
      { sliceId: 'suppliers', version: 1, access: 'owns' },
      { sliceId: 'ruleset', version: 1, access: 'reads' },
      { sliceId: 'obligations', version: 1, access: 'writes' },
      { sliceId: 'scheduledEvents', version: 1, access: 'writes' },
      { sliceId: 'stock', version: 1, access: 'writes' },
    ],
    readsStatePaths: ['calendar', 'coin', 'stock', 'world'],
    writesStatePaths: ['coin', 'stock', 'world.suppliers'],
  },
  // Expansion Phase 9 §9.2 — identity reads the labels an arc earned. It
  // stays the sole WRITER of `world.tavernIdentity`; the arc slice is a
  // durable input it unions into what it recomputes.
  tavernIdentity: {
    slices: [{ sliceId: 'localArcs', version: 2, access: 'reads' }],
    readsStatePaths: ['areas', 'reputation', 'world'],
    writesStatePaths: ['world.tavernIdentity'],
  },
  // Expansion Phase 9 §9.2 — the local-arcs slice gains a declared owner.
  //
  // It writes three other slices on purpose. `scheduledEvents` carries the
  // four hook families it took ownership of. `factions` and `suppliers` are
  // the deliberate part: an arc's opposing move records a grievance in the
  // faction's own standing ledger and hardens a supplier's own terms, rather
  // than this module deciding what those domains conclude. Declaring them is
  // what makes those writes legible as intentional.
  localArcs: {
    slices: [
      { sliceId: 'localArcs', version: 2, access: 'owns' },
      { sliceId: 'monthly', version: 1, access: 'reads' },
      { sliceId: 'factions', version: 1, access: 'writes' },
      { sliceId: 'suppliers', version: 1, access: 'writes' },
      { sliceId: 'scheduledEvents', version: 1, access: 'writes' },
    ],
    readsStatePaths: ['areas', 'calendar', 'coin', 'customerGroups', 'pressures', 'reputation', 'world'],
    writesStatePaths: ['areas', 'customerGroups', 'pressures', 'reputation', 'world.localEvents', 'world.socialRumours', 'world.tavernIdentity'],
    ownsEventTypes: [
      'arc_outcome_review',
      'arc_permanent_lock',
      'arc_backlash',
      'arc_debt_called_in',
      // Expansion Phase 9 — four more `arcKey`-shaped promises. They live
      // here because resolving one starts by asking WHICH arc it was about,
      // which is this module's question; what each then does is handed to
      // the domain that owns it (a supplier's account, a faction's own
      // boycott move, the rumour layer, a faction's demand book).
      'payday_supplier_standing',
      'payday_boycott_review',
      'payday_brawl_legend',
      'festival_obligation_review',
    ],
    schedulesEventTypes: [
      'arc_outcome_review',
      'arc_permanent_lock',
      'arc_backlash',
      'arc_debt_called_in',
    ],
  },
  // Expansion Phase 9 §9.1 — the factions slice gains a declared owner.
  //
  // It had none, and did not need one while the factions module was the
  // only writer. The rival changes that: `seek_faction_backing` opens a
  // `rival_backing` stance, which is a faction record written by the
  // domain that provoked it. A foreign write into an UNOWNED slice is
  // exactly what `checkSliceOwnership` exists to catch, so declaring the
  // ownership here is what makes that one write legible as deliberate
  // rather than looking like a second owner.
  factions: {
    slices: [
      { sliceId: 'factions', version: 1, access: 'owns' },
      { sliceId: 'economy', version: 1, access: 'reads' },
      { sliceId: 'suppliers', version: 1, access: 'reads' },
      { sliceId: 'scheduledEvents', version: 1, access: 'writes' },
    ],
    readsStatePaths: ['calendar', 'customerGroups', 'pressures', 'reputation', 'world'],
    writesStatePaths: ['world.factions', 'coin'],
    ownsEventTypes: [
      'faction_demand_deadline',
      'faction_favour_due',
      'faction_retaliation',
    ],
    schedulesEventTypes: [
      'faction_demand_deadline',
      'faction_favour_due',
      'faction_retaliation',
    ],
  },
  // Expansion Phase 9 §9.1 — the rival tavern. It owns its own slice and
  // writes two others on purpose: the scheduled-event queue (for the four
  // hook families it took ownership of) and the factions slice, because
  // `seek_faction_backing` opens a `rival_backing` stance — a faction
  // record, written deliberately by the domain that provoked it rather than
  // duplicated here.
  rival: {
    slices: [
      { sliceId: 'rival', version: 1, access: 'owns' },
      { sliceId: 'factions', version: 1, access: 'writes' },
      { sliceId: 'economy', version: 1, access: 'reads' },
      { sliceId: 'scheduledEvents', version: 1, access: 'writes' },
    ],
    readsStatePaths: ['calendar', 'customerGroups', 'reputation', 'pressures', 'world'],
    writesStatePaths: ['world.socialRumours'],
    ownsEventTypes: [
      'rival_retaliation',
      'rival_dominance_review',
      'rival_rumour_exposed',
      'rival_pact_review',
      // Expansion Phase 9 — the two competitive families. Distinct from
      // `rival_retaliation` because they answer a specific commercial move
      // the house made rather than a provocation, so the move is named and
      // the counterplay is the one that belongs to it.
      'rival_price_war',
      'rival_quality_race',
    ],
    schedulesEventTypes: ['rival_retaliation', 'rival_pact_review'],
  },
  regulatory: {
    slices: [
      { sliceId: 'regulatory', version: 1, access: 'owns' },
      { sliceId: 'ruleset', version: 1, access: 'reads' },
      { sliceId: 'scheduledEvents', version: 1, access: 'writes' },
      { sliceId: 'obligations', version: 1, access: 'writes' },
      { sliceId: 'monthly', version: 1, access: 'writes' },
      { sliceId: 'economy', version: 1, access: 'writes' },
      { sliceId: 'stock', version: 1, access: 'writes' },
    ],
    readsStatePaths: ['areas', 'calendar', 'coin', 'stock'],
    writesStatePaths: ['coin', 'pressures'],
    ownsEventTypes: [
      'regulatory_visit',
      'regulatory_followup',
      'inspection_bribe_exposed',
      'watch_relationship',
      'cleaning_routine_review',
    ],
    schedulesEventTypes: [
      'regulatory_visit',
      'regulatory_followup',
      'inspection_bribe_exposed',
    ],
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
