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
    // Plan §4.2 — 20 numbered bullets, one DEP row each. Asserted by
    // PRESENCE rather than by count, because §4.2's numbering is not the
    // plan's whole list of depth gaps: the §12 table names one more for
    // phase 9 ("Thin month modifiers") that §4.2 omits, and §9.4 is its own
    // section. That gap is `DEP-21`. Counting would have made adding it
    // look like a violation of the very check it belongs in.
    const dep = rows.filter((r) => r.requirement_id.startsWith('DEP-'))
    for (let n = 1; n <= 20; n += 1) {
      expect(dep.map((r) => r.requirement_id)).toContain(
        `DEP-${String(n).padStart(2, '0')}`,
      )
    }
    expect(dep.length).toBeGreaterThanOrEqual(20)
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
    // What must stay true is that no row is closed ahead of its work. This
    // is the check that would catch a row marked done to quiet a red test,
    // which the arc's conventions forbid. Bump `LANDED_PHASES` when a phase
    // completes, and never to make a failing row pass.
    // Phase 0 (ISSUE-170), Phase 1 (ISSUE-171), Phase 2 (ISSUE-172),
    // Phase 3 (ISSUE-173), Phase 4 (ISSUE-174), Phase 5 (ISSUE-175),
    // Phase 6 (ISSUE-176), Phase 7 (ISSUE-177).
    const LANDED_PHASES = 7

    // Phase 8 is being executed IN PARTS (§8.1 factions, §8.2 cultures,
    // §8.3 notable NPCs, §8.4 rumours, §8.5 behavioural attribution), so a
    // whole-phase watermark cannot express what has actually landed. Rather
    // than bump `LANDED_PHASES` to 8 — which would silently exempt the four
    // parts still to come, and is exactly the loophole this test exists to
    // shut — the landed part names its own rows. Anything else in phase 8
    // still fails.
    //
    // §8.1 (2026-08-06) closed the four faction retaliation/favour hook
    // families. §8.2 (2026-08-07) closed the culture half, so DEP-08 —
    // which covers factions AND cultures in one row — is now `done`.
    // §8.3 (2026-08-07) took DEP-09 to `in-progress` (the notable-NPC half;
    // rivals belong to Phase 9 §9.1) and closed the two culture hook
    // families that §8.2 had left open.
    //
    // Phase 9 is likewise being executed IN PARTS (§9.1 the rival actor,
    // §9.2 local arcs, §9.3 expeditions, §9.4 month modifiers), so the same
    // rule applies and the same loophole stays shut: §9.1 (2026-08-07)
    // completed DEP-09 by closing its rival half, and closed the four rival
    // hook families; §9.2 (2026-08-08) closed DEP-13 and the five arc hook
    // families; §9.3 (2026-08-08) closed DEP-12. The six remaining phase-9
    // hook families are still open, so anything else in phase 9 still fails
    // this check.
    const LANDED_PART_ROWS = new Map<string, string>([
      ['DEP-08', 'done'],
      ['DEP-09', 'done'],
      ['HOOK-rival_retaliation_*', 'done'],
      ['HOOK-rival_dominance_*', 'done'],
      ['HOOK-rival_rumour_exposed_*', 'done'],
      ['HOOK-rival_settlement_pact_*', 'done'],
      // §9.2 (2026-08-08) — local arcs. DEP-13 closes with the arc layer's
      // five hook families; DEP-12 belongs to §9.3 and is still open.
      ['DEP-13', 'done'],
      ['HOOK-arc_failure_*', 'done'],
      ['HOOK-blight_brand_lock_*', 'done'],
      ['HOOK-arc_exploit_backlash_*', 'done'],
      ['HOOK-arc_faction_debt_*', 'done'],
      ['HOOK-arc_supplier_favour_owed_*', 'done'],
      // §9.3 (2026-08-08) — expeditions. DEP-12 closes; the six remaining
      // phase-9 hook families belong to the rival and arc CONTENT and are
      // still open, so they still fail this check.
      ['DEP-12', 'done'],
      // §9.4 (2026-08-08) — month modifiers become processes. DEP-21 is the
      // §12-table depth gap §4.2 does not number.
      ['DEP-21', 'done'],
      ['HOOK-culture_walkout_risk_*', 'done'],
      ['HOOK-culture_seating_backlash_*', 'done'],
      ['HOOK-faction_grudge_*', 'done'],
      ['HOOK-faction_revenge_*', 'done'],
      ['HOOK-faction_deception_exposed_*', 'done'],
      ['HOOK-*_boycott_possible', 'done'],
      ['HOOK-shrine_favour_owed_*', 'done'],
      ['DEP-10', 'done'],
      ['HOOK-rumour_escalation_*', 'done'],
      ['HOOK-rumour_escalation_*_*', 'done'],
      ['HOOK-rumour_denial_backfire_*', 'done'],
      ['HOOK-rumour_denial_backfire_*_*', 'done'],
      ['HOOK-counter_rumour_runaway_*', 'done'],
      ['DEP-11', 'done'],
      ['HOOK-rumour_blame_grudge_*_*', 'done'],
      ['HOOK-rumour_bribe_exposed_*_*', 'done'],
    ])

    const closedEarly = rows.filter((r) => {
      if (r.status === 'open') return false
      if (Number(r.phase) <= LANDED_PHASES) return false
      return LANDED_PART_ROWS.get(r.requirement_id) !== r.status
    })
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
      //
      // Expansion Phase 4 (ISSUE-174) moves exactly one count, and that it is
      // only one is the assertion:
      //   * `ownerActions` 51 → 55: `collect_tab`, `forgive_tab`,
      //     `greet_regular` and `answer_regular_request` — the counterplay to
      //     the slates the flow now opens and the regulars who now ask for
      //     things.
      // Nothing else grows. `customerGroups` is still 9 and `recipes` still 22:
      // §4.2 makes the existing menu a decision rather than adding to it, and
      // §4.1's parties are per-night cohorts, not new registry entries.
      //
      // Expansion Phase 5 (ISSUE-175) moves two counts:
      //   * `runtimeModules` 33 → 34: the economy module now owns exact
      //     accounting, operating costs, stress/recovery state and policy
      //     compliance instead of leaving economy as a placeholder.
      //   * `ownerActions` 55 → 59: pay arrears, close temporarily,
      //     restructure and reopen are the explicit financial counterplay.
      //
      // Expansion Phase 6 (ISSUE-176) moves one count:
      //   * `ownerActions` 59 → 67: place/amend/cancel/dispute an order,
      //     request credit, pay/schedule an invoice, and negotiate terms.
      //
      // Expansion Phase 7 (ISSUE-177) moves two counts, and that it is only
      // two is the assertion:
      //   * `runtimeModules` 34 → 37: `finance`, `tenancy` and `regulatory`.
      //     Three modules rather than one because §5.4 wants one domain per
      //     transition, and a lender, a landlord and the watch are three
      //     counterparties with three unrelated escalation ladders.
      //   * `ownerActions` 67 → 82: four for loans (borrow, repay,
      //     renegotiate, settle), six for the tenancy (pay, negotiate, grant
      //     and refuse access, request a repair, buy the tenancy back) and
      //     five for the watch (the books, report an order done, appeal, pay
      //     a fine, and the quiet word).
      // Nothing else grows. There are no new areas, stock records, recipes or
      // customer groups: §7 deepens what the tavern OWES rather than what it
      // is made of, and the inspection reads the existing rooms and cellar
      // rather than adding anything to inspect.
      //
      // Expansion Phase 8.1 (ISSUE-178) moves exactly one count, and that it
      // is only one is the assertion:
      //   * `ownerActions` 82 → 86: grant and refuse a faction's request,
      //     appeal against a move it has made, and repay a sponsorship
      //     before it is called in. §8.1 requires faction outcomes that can
      //     be OPPOSED, and opposition has to be a move on the board.
      // `factions` stays at 9 and `runtimeModules` at 37 on purpose: 8.1
      // gives the factions that already exist goals, memory and a bounded
      // action set inside the module that already owned them, rather than
      // growing the cast or adding a domain.
      //
      // Expansion Phase 8.2 (ISSUE-178) moves the same one count again:
      //   * `ownerActions` 86 → 90: make amends to a culture and mark an
      //     observance, plus the enable/disable pair for `seat_groups_apart`
      //     — the first policy in the game to carry the
      //     `cultural_accommodation` tag that `culturalTension`'s relief
      //     term and the old culture module had both been looking for since
      //     Phase 38 without ever finding.
      // `cultures` stays at 8 for the same reason `factions` stayed at 9:
      // 8.2 deepens the cultures that exist rather than adding any.
      //
      // Expansion Phase 8.3 (ISSUE-178) moves two:
      //   * `runtimeModules` 37 → 38: `npcs`. A module rather than an
      //     extension of `world`, because §8.3's promotion rule owns a real
      //     state transition (who is an agent) and §5.4 wants one domain per
      //     transition.
      //   * `ownerActions` 90 → 93: accept and decline what somebody has put
      //     to the house, and seek somebody out — the last being how a player
      //     DRIVES §8.3's repeated-interaction threshold rather than waiting.
      // `notableNpcs` is unchanged: 8.3 gives the nine who already exist
      // goals, memory, a schedule and a small action set. It promotes at
      // most four of them at a time, and promotes none of them at day zero.
      //
      // Expansion Phase 8.4 (ISSUE-178) moves the same two:
      //   * `runtimeModules` 38 → 39: `rumours`. The lifecycle sat on
      //     `worldModule`, which owned it only because nothing else did;
      //     `world.socialRumours` now has start, spread, contradict,
      //     correct, decay and prune, which is a domain rather than a chore,
      //     and §5.4 wants one owner per transition.
      //   * `ownerActions` 93 → 96: deny it, put a story about, and name the
      //     source. §8.4 requires correction to be reachable, and all three
      //     are answers a player can be wrong to give — denying a TRUE story
      //     costs credit when the denial is tested.
      // `customerGroups`, `cultures`, `factions` and `notableNpcs` are all
      // unchanged: the channels a rumour travels through are the people the
      // world already has.
      //
      // Expansion Phase 8.5 (ISSUE-178) moves exactly one, and that it is
      // only one is the assertion:
      //   * `ownerActions` 96 → 97: `address_grievance`. §8.5 is six domains
      //     ACTING on what people believe, and without a move on the other
      //     side of it the player could only watch. Answering something
      //     somebody is right about hardens it, so it is a move that can be
      //     played badly.
      // `runtimeModules` stays at 39 on purpose: belief already had a domain
      // that owned it since Phase 37, and §8.5 makes that domain's output an
      // input to six existing rules rather than adding a seventh owner.
      //
      // Expansion Phase 9.1 (ISSUE-179) moves two, and that it is only two
      // is the assertion:
      //   * `runtimeModules` 39 → 40: `rival`. A module rather than three
      //     more fields on `modules.monthly`, because §9.1 gives the
      //     competitor a position it chose, a capability it invests in, a
      //     purse it spends and an `ActorState` — a domain that owns real
      //     transitions, which §5.4 wants one owner for.
      //   * `ownerActions` 97 → 101: scout them, buy a courted crowd back,
      //     hire out from under them, and settle. §9.1's rival can be
      //     answered rather than only out-played, and two of the four
      //     rebound — poaching schedules a retaliation the rival picks for
      //     itself, settling schedules the review at which it reconsiders.
      // Everything else is unchanged: 9.1 adds no areas, stock, recipes,
      // customer groups, cultures, factions or arcs. The competition is a
      // comparison between the house and one rival over the crowds the world
      // already has.
      //
      // Expansion Phase 9.2 (ISSUE-179) moves two, and that it is only two
      // is the assertion:
      //   * `localArcs` 5 → 9: §9.2 requires the catalog to collectively
      //     exercise eight materially different shapes, and the starter five
      //     covered four of them. The four added are the state-driven crisis,
      //     the faction conflict, the recovery arc, and the arc that changes
      //     the world for good. The five that existed are MIGRATED — given a
      //     goal, an owner and interventions — rather than duplicated.
      //   * `ownerActions` 101 → 103: `intervene_in_arc` takes one of an
      //     arc's own declared moves, `settle_arc` ends a close-run one as a
      //     compromise. Two rather than a verb per intervention, because the
      //     interventions are content and the action is the seam.
      // `runtimeModules` stays at 40 on purpose: arcs already had a module
      // that owned them since Phase 35, and §9.2 gives that module a daily
      // pass rather than adding a second owner.
      //
      // Expansion Phase 9.3 (ISSUE-179) moves exactly one, and that it is
      // only one is the assertion:
      //   * `ownerActions` 103 → 106: `answer_expedition_dispatch`,
      //     `recall_expedition` and `send_relief_to_expedition`. Once a
      //     party was on the road the player had no move at all, and §9.3
      //     names recall, retreat, rescue and risk/reward decisions among
      //     the things an expedition must support.
      // `runtimeModules` stays at 40 again: expeditions already had a module
      // since Phase 70. What §9.3 adds is content — five routes and eight
      // road events — which no inventory count tracks, and a run book inside
      // the slice that module already owned.
      //
      // Expansion Phase 9.4 (ISSUE-179) moves two, and that it is only two
      // is the assertion:
      //   * `runtimeModules` 40 → 41: `conditions`. A module rather than
      //     more fields on `modules.monthly`, because §9.4 turns a label
      //     into a lifecycle — forecast, start, a burden that accumulates,
      //     counterplay, an ending and a scar — and those are real state
      //     transitions, which §5.4 wants one owner for. The monthly slice
      //     keeps `currentModifier` as a projection of what is running, so
      //     the tax rent bump and the arc engine's `month_modifier` gate go
      //     on reading the field they always read.
      //   * `ownerActions` 106 → 109: `prepare_for_condition` acts on a
      //     forecast before the thing exists, `counter_condition` works the
      //     burden down while it runs, `exploit_condition` takes the upside
      //     instead of only surviving it. Before this the player could not
      //     act on a month modifier at all.
      // Everything else is unchanged: §9.4 adds no areas, stock or arcs. The
      // six conditions are the six modifiers that already existed, given the
      // seven things §9.4 says each one needs.
      runtimeModules: 41,
      simulationPhases: 26,
      daySegments: 3,
      ownerActions: 109,
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
      localArcs: 9,
      ventureBlueprints: 1,
      staffRoles: 8,
      reputationAxes: 10,
    })
  })
})
