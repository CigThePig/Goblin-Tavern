// Phase 207 / ISSUE-170 — Expansion Phase 0: the frozen baseline and the
// implementation ledger.
//
// `docs/plans/GOBLIN_TAVERN_SIMULATION_EXPANSION_WORK_PLAN.md` § "Phase 0"
// ends with *no intended behavior change*. What it must leave behind is an
// authoritative baseline, a complete requirement ledger, and reproducible
// probes later phases can compare against. This file is the gate on all
// three:
//
//   - every probe route still produces the frozen snapshot;
//   - a route replayed from the same state, input and seed is identical;
//   - the full-day and segmented routes agree exactly;
//   - the long-run core invariants hold on every route;
//   - the repository map still describes the repository;
//   - the ledger is structurally valid and cites only paths that exist;
//   - every player-facing future hook emitted in `src/` has a ledger row;
//   - the plan's §3 inventory counts still match the live registries.
//
// Save/load at the five day beats is the sibling file,
// `phase207.dayBeatPersistence.test.ts`.

import { describe, expect, it } from 'vitest'

import {
  PROBE_ROUTES,
  buildBaselineProbeFile,
  probeSnapshot,
  runProbeRoute,
  snapshotProbeRun,
  BASELINE_PROBE_VERSION,
  type ProbeRouteId,
} from '../../src/sim/testing/expansionBaseline'
import { readBaselineProbeFile } from '../../scripts/expansion-baseline'
import {
  readLedger,
  scanFutureHookSites,
  futureHookIds,
  uncoveredFutureHooks,
  staleFutureHookRows,
  validateLedger,
  normalizeHookId,
  blankComments,
  parseCsv,
  PHASE_TO_ISSUE,
} from '../../scripts/expansion-ledger'
import { coreStateInvariantFailures } from '../../src/sim/testing/balanceHarness'

import {
  REPO_MAP_VERSION,
  collectInventory,
  collectRepoMap,
  readRepoMap,
} from '../../scripts/expansion-repo-map'
import { FULL_PIPELINE } from '../../src/sim/canonicalPipeline'
import { SIMULATION_PHASES } from '../../src/sim/core/phases'
import { DAY_SEGMENTS } from '../../src/sim/core/segments'

// ---------------------------------------------------------------------------
// Frozen probes
// ---------------------------------------------------------------------------

describe('Phase 207 — frozen baseline probes', () => {
  const frozen = readBaselineProbeFile()

  it('freezes the snapshot shape version alongside the code', () => {
    expect(frozen.version).toBe(BASELINE_PROBE_VERSION)
  })

  it('covers every route the plan names', () => {
    const ids = PROBE_ROUTES.map((r) => r.id)
    // Plan § "Phase 0 → Baseline probes".
    expect(ids).toEqual(
      expect.arrayContaining([
        'fresh-easy',
        'fresh-standard',
        'fresh-hard',
        'full-day',
        'segmented-day',
        'week-boundary',
        'month-boundary',
        'no-action',
        'quality-focused',
        'profit-focused',
        'staff-focused',
        'supplier-focused',
      ]),
    )
    expect(Object.keys(frozen.snapshots).sort()).toEqual([...ids].sort())
  })

  for (const route of PROBE_ROUTES) {
    it(`reproduces the frozen snapshot for '${route.id}'`, () => {
      expect(probeSnapshot(route.id)).toEqual(frozen.snapshots[route.id])
    })
  }

  it('records every metric the plan asks a probe to freeze', () => {
    const snapshot = frozen.snapshots['month-boundary']!
    // Plan § "Phase 0 → Baseline probes → Record:".
    expect(Object.keys(snapshot.ledger)).toContain('serviceCoinEarned')
    expect(snapshot.traffic.total).toBeGreaterThan(0)
    expect(Object.keys(snapshot.satisfaction.byGroup).length).toBeGreaterThan(0)
    const anyArea = Object.values(snapshot.areas)[0]!
    expect(anyArea).toHaveProperty('cleanliness')
    expect(anyArea).toHaveProperty('damage')
    expect(anyArea).toHaveProperty('upgradesInstalled')
    const anyStaff = Object.values(snapshot.staff)[0]!
    for (const meter of ['morale', 'fatigue', 'stress', 'loyalty']) {
      expect(anyStaff).toHaveProperty(meter)
    }
    expect(anyStaff).toHaveProperty('available')
    expect(Object.keys(snapshot.stock).length).toBeGreaterThan(0)
    expect(Object.keys(snapshot.recipes.timesServed).length).toBeGreaterThan(0)
    expect(snapshot.obligations).toHaveProperty('pendingByKind')
    expect(Object.keys(snapshot.pressures).length).toBeGreaterThan(0)
    expect(snapshot.issues.totalGenerated).toBeGreaterThan(0)
    expect(Object.keys(snapshot.collections).length).toBeGreaterThan(10)
    expect(snapshot.validation).toEqual({ ok: true, errors: 0, warnings: 0 })
  })

  it('records active obligations on the route that actually creates them', () => {
    // Every other route answers no cards, so its pending queue is empty by
    // construction. `responsive-route` is the one that exercises the
    // scheduling path, which makes it the OBL-02 before-picture: hooks
    // enqueue and drain, and nothing downstream owns the outcome.
    const snapshot = frozen.snapshots['responsive-route']!
    expect(snapshot.obligations.totalResolved).toBeGreaterThan(0)
    expect(snapshot.obligations.totalApplied).toBeGreaterThan(0)
    expect(
      (snapshot.obligations.pendingByKind['memory_future_hook'] ?? 0) +
        (snapshot.obligations.pendingByKind['future_hook'] ?? 0),
    ).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// Determinism, replay, equivalence, invariants
// ---------------------------------------------------------------------------

describe('Phase 207 — determinism and equivalence', () => {
  const replayed: ProbeRouteId[] = ['full-day', 'week-boundary', 'responsive-route']

  for (const routeId of replayed) {
    it(`replays '${routeId}' identically from the same state, input and seed`, () => {
      expect(probeSnapshot(routeId)).toEqual(probeSnapshot(routeId))
    })
  }

  it('produces identical results from the full-day and segmented routes', () => {
    const full = runProbeRoute('full-day')
    const segmented = runProbeRoute('segmented-day')
    // Same seed (segmented-day borrows full-day's), same inputs, so the
    // final state must be byte-identical — the day-clock contract's
    // load-bearing invariant.
    expect(segmented.finalState).toEqual(full.finalState)

    const a = snapshotProbeRun(full)
    const b = snapshotProbeRun(segmented)
    const { route: _ra, seed: _sa, ...restA } = a
    const { route: _rb, seed: _sb, ...restB } = b
    expect(restB).toEqual(restA)
  })

  it('holds the core state invariants on every probe route', () => {
    for (const route of PROBE_ROUTES) {
      const run = runProbeRoute(route.id)
      expect(coreStateInvariantFailures(run.finalState, route.id)).toEqual([])
    }
  })

  it('rebuilds the whole probe file deterministically', () => {
    const first = buildBaselineProbeFile()
    const second = buildBaselineProbeFile()
    expect(second).toEqual(first)
  })
})

// ---------------------------------------------------------------------------
// The implementation ledger
// ---------------------------------------------------------------------------

describe('Phase 207 — implementation ledger', () => {
  const rows = readLedger()

  it('is structurally valid and cites only paths that exist', () => {
    expect(validateLedger(rows)).toEqual([])
  })

  it('carries a row for all nine broken obligations', () => {
    const ids = rows.map((r) => r.requirement_id)
    for (let n = 1; n <= 9; n += 1) {
      expect(ids).toContain(`OBL-0${n}`)
    }
  })

  it('carries a row for every simulation-depth gap the plan lists', () => {
    // Plan §4.2 — 20 bullets, one DEP row each.
    const dep = rows.filter((r) => r.requirement_id.startsWith('DEP-'))
    expect(dep).toHaveLength(20)
  })

  it('assigns every row to a phase owned by the right tracker issue', () => {
    for (const row of rows) {
      expect(row.issue).toBe(PHASE_TO_ISSUE[Number(row.phase)])
    }
  })

  it('only closes rows belonging to a phase that has actually landed', () => {
    // Phase 0 changed no behavior, so at the freeze nothing was closed. That
    // is a statement about the arc's STARTING point, not an invariant — as
    // phases land, their rows legitimately move to `in-progress` and `done`.
    //
    // What must stay true is that no row is closed ahead of its phase. This
    // is the check that would catch a row marked done to quiet a red test,
    // which the arc's conventions forbid. Bump `LANDED_PHASES` when a phase
    // completes, and never to make a failing row pass.
    // Phase 0 (ISSUE-170), Phase 1 (ISSUE-171), Phase 2 (ISSUE-172),
    // Phase 3 (ISSUE-173).
    const LANDED_PHASES = 3
    const closedEarly = rows.filter(
      (r) => r.status !== 'open' && Number(r.phase) > LANDED_PHASES,
    )
    expect(
      closedEarly.map((r) => `${r.requirement_id} (phase ${r.phase}, ${r.status})`),
    ).toEqual([])
  })
})

describe('Phase 207 — future-hook coverage scan', () => {
  const rows = readLedger()
  const sites = scanFutureHookSites()

  it('finds the hooks the plan names by hand', () => {
    const ids = futureHookIds(sites)
    // Plan §3.4 / §7.1 / §7.2 name these three explicitly.
    expect(ids).toContain('staff_quit_risk_*')
    expect(ids).toContain('loan_due_soon')
    expect(ids).toContain('eviction_threat_possible')
  })

  it('represents every player-facing future hook in the ledger', () => {
    expect(uncoveredFutureHooks(rows, sites)).toEqual([])
  })

  it('carries no ledger row for a hook the source no longer emits', () => {
    expect(staleFutureHookRows(rows, sites)).toEqual([])
  })

  it('collapses per-entity hook ids into one family row', () => {
    expect(normalizeHookId('staff_quit_risk_${worst.id}')).toBe('staff_quit_risk_*')
    expect(normalizeHookId('loan_due_soon')).toBe('loan_due_soon')
    // A fully computed id would be a finding, not a family.
    expect(normalizeHookId('${prefix}-${suffix}')).toBeUndefined()
  })

  it('does not let prose apostrophes swallow the source', () => {
    // Regression: `// the actor's own chain` used to open an unterminated
    // string and run the bracket matcher off the end of the file, which
    // pulled unrelated ids into the hook inventory.
    const source = "const a = [\n  // the actor's own chain\n  { id: 'x' },\n]\n"
    expect(blankComments(source)).toContain("{ id: 'x' }")
    expect(blankComments(source)).not.toContain('actor')
  })
})

describe('Phase 207 — ledger CSV parsing', () => {
  it('round-trips quoted cells containing commas and quotes', () => {
    const parsed = parseCsv('a,b\n"one, two","he said ""hi"""\n')
    expect(parsed).toEqual([
      ['a', 'b'],
      ['one, two', 'he said "hi"'],
    ])
  })
})

// ---------------------------------------------------------------------------
// Repository map + starting inventory (plan §3)
// ---------------------------------------------------------------------------

describe('Phase 207 — repository map', () => {
  const built = collectRepoMap()

  it('matches the frozen map section for section', () => {
    const frozen = readRepoMap()
    expect(frozen.version).toBe(REPO_MAP_VERSION)
    for (const key of Object.keys(built) as Array<keyof typeof built>) {
      expect({ [key]: frozen[key] }).toEqual({ [key]: built[key] })
    }
  })

  it('maps the pipeline, phases and segments the engine actually runs', () => {
    expect(built.pipeline).toEqual(FULL_PIPELINE.map((m) => m.id))
    expect(built.phases).toEqual([...SIMULATION_PHASES])
    expect(Object.keys(built.segments).sort()).toEqual([...DAY_SEGMENTS].sort())
    expect(DAY_SEGMENTS.flatMap((s) => built.segments[s]!)).toEqual([...SIMULATION_PHASES])
  })

  it('records no unscoped random call in the simulation or the card layer', () => {
    // CLAUDE.md architectural rule 5: the sim is seeded end to end.
    expect(built.unscopedRandomCallsInSim).toEqual([])
    expect(built.unscopedRandomCallsInCards).toEqual([])
  })

  it('records every save version and migration step', () => {
    expect(built.save.version).toBeGreaterThan(0)
    expect(built.save.migrationSteps.length).toBeGreaterThan(0)
    // The chain must end by installing module slices — everything else
    // depends on them existing.
    expect(built.save.migrationSteps.at(-1)).toBe('ensureModuleSlices')
  })

  it('records the named RNG streams and the Help/glossary promises', () => {
    expect(built.rngStreams).toContain('service')
    expect(built.rngStreams).toContain('npc_identity')
    expect(built.glossaryTerms).toContain('quick_day')
    expect(built.glossaryTerms).toContain('queued_action')
  })
})

describe('Phase 207 — plan §3 starting inventory', () => {
  it('matches the counts the plan freezes', () => {
    expect(collectInventory()).toEqual({
      // Expansion Phase 1 (ISSUE-171) added four shared-contract modules
      // (`ruleset`, `meters`, `scheduledEvents`, `obligations`) and one
      // phase (`resolveScheduledEvents`, the wrap-up beat). The Phase 0
      // freeze is the arc's BEFORE picture, and the plan says to update
      // these artifacts in place as later phases land — so these two counts
      // move with the code rather than the code being bent to fit them.
      //
      // Expansion Phase 2 (ISSUE-172) moves two more, and the shape of WHICH
      // two is the assertion:
      //   * `stockRecords` / `recipes` 20 → 22: `timber` and `cut_stone`, the
      //     construction materials §2.3 requires a build to consume, plus the
      //     1:1 `dish_<id>` records the stock/recipe pairing invariant demands
      //     (they carry the `upkeep` tag, so nothing serves them).
      //   * `ownerActions` stays at 41: seven upgrade-lifecycle actions in,
      //     and the seven retired project actions out (five starters that
      //     duplicated upgrade definitions, plus `fund_active_project` and
      //     `cancel_project`, whose only targets were those five).
      // `areaUpgrades` is deliberately still 18 — Phase 2 makes the existing
      // catalogue buildable rather than growing it.
      //
      // Expansion Phase 3 (ISSUE-173) moves two more, and again the shape of
      // which two is the assertion:
      //   * `ownerActions` 41 → 51: the twelve workforce actions §"Player-facing
      //     work" requires, less the one that was already there. `hire_staff` and
      //     `fire_staff` keep their ids and were rebuilt rather than added, so the
      //     net is ten.
      //   * `staffRoles` 6 → 8: `head_server` and `head_keeper`, the top rung for
      //     the two families that had nowhere to be promoted to. §3.1 requires
      //     promotion, and without them it would have meant a wage rise with a new
      //     label for two of the three founding roles.
      // `staffPriorities` is deliberately still 12 — §3.2 turns the existing
      // twelve into real allocations rather than adding to them. `foundingStaff`
      // is still 3, and now means the day-zero roster rather than a structural
      // requirement: every one of them can be dismissed or resign.
      runtimeModules: 33,
      simulationPhases: 26,
      daySegments: 3,
      ownerActions: 51,
      staffPriorities: 12,
      pressureDomains: 21,
      feedbackDetectors: 13,
      issueGenerators: 25,
      issueGeneratorFamilies: 25,
      cardTemplates: 24,
      areas: 9,
      areaUpgrades: 18,
      stockRecords: 22,
      recipes: 22,
      customerGroups: 9,
      foundingStaff: 3,
      cultures: 8,
      factions: 9,
      suppliers: 9,
      marketConditions: 8,
      localArcs: 5,
      ventureBlueprints: 1,
      staffRoles: 8,
      reputationAxes: 10,
    })
  })
})
