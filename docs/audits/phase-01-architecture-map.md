# Phase 1 — Architecture and source-of-truth map

Status: complete for the Phase 1 mapping pass. This is an architecture map, not
an issue-fix phase. Suspicions below remain audit candidates unless a later phase
adds reproduction evidence or an explicit repair task.

## Scope and commands used

Phase 1 traced the canonical runtime lists, public entry points, compatibility
wrappers, and source-of-truth validation coverage called out by
`end-to-end-audit-foundation.md`.

Commands run during this phase:

```bash
rg -n "FULL_PIPELINE|simulateDay|advanceDaySegment|runSimulation|moduleRegistry" src web/src tests docs/audits docs/plans
rg -n "from ['\"].*testing|deprecated|compat|alias" src web/src tests
rg -n "from ['\"][^'\"]*testing" src web/src
rg -n "new Registry|export const .*Registry|register\(" src/sim/registries src/sim/content src/sim/modules/issues src/cards
rg -n "export function simulateDay|export function advanceDaySegment|function runPhases|function buildRuntime|collectReports|safeValidateState|phasesForSegment|DAY_SEGMENTS|SIMULATION_PHASES" src/sim/core/engine.ts src/sim/core/segments.ts src/sim/core/phases.ts src/sim/core/module.ts src/sim/core/result.ts
npm test -- tests/sim/phase186.segmentedEngine.test.ts tests/web/phase186.daySegments.test.ts tests/sim/phase2.structure.test.ts
npm run typecheck
```

## Canonical runtime lists

### Simulation modules

`src/sim/canonicalPipeline.ts` is the authoritative production module order. The
file states that production engine validation and persistence migrations treat
`FULL_PIPELINE` as the runtime pipeline, and `src/sim/testing/simRunner.ts` only
re-exports it for compatibility.

| Order | Module id | Immediate audit role |
|---:|---|---|
| 1 | `areas` | Area state owner and area content validation surface. |
| 2 | `stock` | Stock/recipe inventory owner. |
| 3 | `staff` | Staff roster, roles, priorities, burnout inputs. |
| 4 | `customers` | Customer traffic and satisfaction producer. |
| 5 | `world` | World identity container and world-update scaffolding. |
| 6 | `cultures` | Culture identities and culture world effects. |
| 7 | `factions` | Faction state, requests, reputation/world hooks. |
| 8 | `suppliers` | Supplier identities, market/pricing/delivery state. |
| 9 | `regulars` | Regular-customer identities and relationship state. |
| 10 | `adventurers` | Hireable/adventurer economy state. |
| 11 | `expeditions` | Expedition offers, commissions, and resolution state. |
| 12 | `ownerActions` | Player-input owner action application. |
| 13 | `service` | Day service resolution. |
| 14 | `weekly` | Week-closing rollups. |
| 15 | `monthly` | Month-closing rollups. |
| 16 | `localArcs` | Local arc/event signals and issue-seed tags. |
| 17 | `tavernIdentity` | Tavern identity/atmosphere state and policy effects. |
| 18 | `memories` | Memory aging, creation, and memory registry consumers. |
| 19 | `history` | History entry production/pruning. |
| 20 | `causes` | Cause attribution aging/normalization. |
| 21 | `attribution` | Attribution analysis from causes/history/memories. |
| 22 | `pressures` | Pressure calculation and pressure state producer. |
| 23 | `feedback` | Feedback/analysis layer after pressures. |
| 24 | `issueSeeds` | Segment-local issue-seed generation and issue-seed report. |
| 25 | `responses` | Player response intent resolution and response cache. |

Audit implications:

- Later sim-module phases should read modules in this order, not by folder name
  or historical phase number.
- Dependency sorting still applies inside the engine, so the array is both a
  declared canonical order and the set passed to dependency validation.
- Tests and diagnostics that need production parity should import from
  `src/sim/canonicalPipeline.ts` directly or from a compatibility wrapper only
  with that wrapper's purpose understood.

### Simulation phases

`src/sim/core/phases.ts` owns the canonical phase order:

```text
startDay → identityGeneration → applyDayTypeModifiers → cultureUpdate →
supplierUpdate → factionUpdate → regularCustomerUpdate → localEventUpdate →
rumourUpdate → forecastTraffic → beforeOwnerActions → applyOwnerActions →
afterOwnerActions → assignStaffPriorities → beforeService → service →
afterService → closing → applyResponses → endDay → endWeek → endMonth →
generateReports → validate → advanceCalendar
```

`src/sim/core/segments.ts` partitions that exact phase list into the three web
runtime segments:

| Segment | Phases | Pause/input after segment |
|---|---|---|
| A | `startDay` through `forecastTraffic` | Morning plan pause; owner actions and staff priorities can be queued before Segment B. |
| B | `beforeOwnerActions` through `closing` | Service reaction pause; response intents can be queued before Segment C. |
| C | `applyResponses` through `advanceCalendar` | Day is closed; report/latest result is available. |

The partition is validated by `tests/sim/phase186.segmentedEngine.test.ts`, which
asserts that recombining all segment phase slices equals `SIMULATION_PHASES` and
that the seam phases map to the expected segments.

## Public entry points and runtime flow

| Surface | Entry point(s) | Producer/consumer edges | Source-of-truth notes |
|---|---|---|---|
| Headless one-day sim | `simulateDay(state, input, modules)` in `src/sim/core/engine.ts` | Consumes a `TavernState`, `SimInput`, and module list; topologically sorts modules; runs all three segments in order; returns `SimResult` with state, reports, logs, validation, and day diff. | Requires callers to pass a module list. Production parity is `FULL_PIPELINE`. |
| Segmented sim | `advanceDaySegment(state, input, modules, segment, options)` in `src/sim/core/engine.ts` | Runs one segment slice, reseeds segment RNG, and can bracket the day diff with `options.dayBaseline`. | Web store uses this for the interactive day clock. Segment equivalence tests compare final state and day diffs against `simulateDay`. |
| Deprecated sim placeholder | `runSimulation()` in `src/sim/core/engine.ts` | Throws immediately. | Compatibility/deprecation seam only; not a runtime path to exercise. |
| Headless test/debug runner | `runCardlessSim`, `runOneDay`, `runOneWeek`, `runOneMonth`, `runMonths` in `src/sim/testing/simRunner.ts` | Thin wrappers around `simulateDay` that default to `FULL_PIPELINE` and create per-day inputs. | Useful test/debug harness; should not be mistaken for the production source of the pipeline. |
| Web store | `beginDay`, `runService`, `endDay`, `runDay` in `web/src/lib/sim/gameStore.svelte.ts` | Sole web caller of the engine; owns state, picks, staff priorities, pending responses, segment position, baseline, latest result, and route/subroute state. | Uses `advanceDaySegment`; `runDay` is a guarded convenience that completes A → B → C. |
| Persistence | `saveSession`, `loadSession`, `validatePersistedSession` in `web/src/lib/sim/persistence.ts` | Serializes the store session, migrates/hydrates state and mid-day baseline, validates through canonical modules, sanitizes picks/session state. | Imports `FULL_PIPELINE` directly from `canonicalPipeline.ts`. |
| Cards | `pickCard(seed, state)` in `src/cards/registry.ts`, exported by `src/cards/index.ts` | Ensures required cards are registered, selects by `appliesTo`/priority/specificity/id, and falls back to the catch-all card. | Card registry is the card source of truth; issue seeds are produced by the sim and consumed by cards/UI. |
| Reports | `src/reports/index.ts` exports daily, weekly, monthly, tavern, world, log, and missed-opportunity projections | Report builders consume final state, day diff, causes, issue seeds, history, and rollup state; web components consume projection data. | Later report audit should trace each displayed number/text to state/diff/cause/seed. |

High-level dependency flow:

```text
content registries + defaults + migrations
  → TavernState
  → simulateDay / advanceDaySegment + FULL_PIPELINE
  → SimResult { state, reports, logs, validation, diffs }
  → issue seeds / reports / causes / history / pressures
  → card selection + report projections
  → web store state/session
  → Svelte screens/components + persistence/import/export/debug surfaces
```

## Registries and extension seams

| Registry/list | Runtime status | Notes for later phases |
|---|---|---|
| `FULL_PIPELINE` | Canonical runtime module list. | Treat as authoritative for production parity. |
| `SIMULATION_PHASES` | Canonical phase order. | Segment partition must continue to cover it exactly. |
| `DAY_SEGMENTS` / `phasesForSegment` | Canonical web segment partition. | Web/session audits should exercise segment methods, not only `simulateDay`. |
| `moduleRegistry` | Empty secondary registry. | Validation consults it only if populated, then falls back to `FULL_PIPELINE`; Phase 2 structure tests still assert it starts empty. |
| Sim content registries under `src/sim/registries` and `src/sim/content` | Mostly self-seeded content/catalog registries. | Later content audits should distinguish self-seeded catalogs from empty extension seams. |
| `src/sim/registries/issueSeedRegistry.ts` | Empty family-definition registry. | Not the generator registry used by runtime seed generation. |
| `src/sim/modules/issues/issueSeedGeneratorRegistry` | Runtime issue-seed generator registry. | `issueSeedsModule` ensures required generators are registered before generation passes. |
| `src/cards/registry.ts` `cardRegistry` | Runtime card registry. | Self-registers required cards on import; fallback route is explicit. |
| `src/sim/content/events/localEventRegistry.ts` and `seasonalEventRegistry.ts` | Empty structural event registries in current reconnaissance. | Treat as extension seams until Phase 3/9 traces producers and consumers. |

## Compatibility exports, deprecated wrappers, and historical aliases

Confirmed compatibility/deprecation surfaces:

- `src/sim/testing/simRunner.ts` re-exports `FULL_PIPELINE` from
  `src/sim/canonicalPipeline.ts` for existing tests/debug callers.
- `src/sim/core/engine.ts` keeps `runSimulation()` as a deprecated Phase 2
  placeholder that throws and tells callers to use `simulateDay`.
- `src/sim/modules/issueSeeds/*` is a backwards-compatible barrel for the
  canonical `src/sim/modules/issues/*` module.
- `SimulationResult`, `SimPhase`, `SimHook`, and `SimModule` are type aliases
  retained for legacy imports.
- Several content/state types retain documented optional aliases or deprecated
  fields for save/content compatibility; later state/content phases should
  evaluate those locally rather than treating all aliases as defects.

Production imports from `testing/`:

| Importer | Import | Status |
|---|---|---|
| `web/src/lib/sim/gameStore.svelte.ts` | `FULL_PIPELINE` from `src/sim/testing/simRunner` | Candidate source-of-truth drift. The imported value is a compatibility re-export of `canonicalPipeline`, so behavior is not currently different, but production web code still points at a testing wrapper. |

No other `src` or `web/src` production imports from `testing/` were found by the
targeted `rg -n "from ['\"][^'\"]*testing" src web/src` check.

## Drift tests and current coverage

| Invariant | Current coverage found | What it proves | Remaining audit note |
|---|---|---|---|
| Segment phase partition equals full phase list. | `tests/sim/phase186.segmentedEngine.test.ts`. | Every phase belongs to exactly one segment and seam phases match the day-clock contract. | Later phases should add tests if new phases are introduced. |
| Segmented A → B → C equals one `simulateDay`. | `tests/sim/phase186.segmentedEngine.test.ts` and `tests/web/phase186.daySegments.test.ts`. | Final state and day diff parity across quiet, action, mid-run, week-close, month-close, and store paths. | Future module hooks should run these tests when adding RNG/history/cause producers. |
| Empty secondary registries remain empty. | `tests/sim/phase2.structure.test.ts`. | `moduleRegistry` and sim-level `issueSeedRegistry` are not populated by import side effects. | This is intentional in current code, but can mislead audits if treated as runtime source. |
| Bare validation defaults to canonical modules if no registry override exists. | `src/sim/state/validation.ts` code path; adjacent tests call bare `validateState`. | The prior hazard where bare validation skipped schemas appears repaired. | Add a specific drift test in Phase 2 if not already present in narrower tests. |
| Production web engine entry is centralized. | `web/src/lib/sim/gameStore.svelte.ts` comments and targeted search. | Web screens should mutate sim through the store segment methods. | Phase 7 should still trace UI controls to store methods and guards. |

## Phase 1 findings ledger

| ID | Status | Severity | Area | Summary | Evidence | Current tests | Next action |
|---|---|---|---|---|---|---|---|
| AUD-ARCH-001 | candidate | low | Web/store imports | `web/src/lib/sim/gameStore.svelte.ts` imports `FULL_PIPELINE` through the `src/sim/testing/simRunner` compatibility wrapper instead of the production `src/sim/canonicalPipeline.ts` module. | Targeted search found exactly one production `testing/` import: `web/src/lib/sim/gameStore.svelte.ts`. `simRunner.ts` re-exports `FULL_PIPELINE` from `canonicalPipeline.ts`, so this is source-of-truth drift rather than proven behavior drift. | Segment/web tests exercise the store path and pass. | In a repair phase, switch the import to `src/sim/canonicalPipeline.ts` and add/keep a search-based guard if desired. |
| AUD-ARCH-002 | candidate | low | Secondary registries | `moduleRegistry` and sim-level `issueSeedRegistry` are empty extension/placeholder registries, while runtime uses `FULL_PIPELINE` and `issueSeedGeneratorRegistry`. | `moduleRegistry` is a bare `new Registry<SimulationModule>()`; `tests/sim/phase2.structure.test.ts` asserts it starts empty. Runtime validation now falls back to `FULL_PIPELINE`. | Phase 2 structure test covers emptiness; validation code covers fallback by inspection. | Do not use either registry as source of truth in later phases; consider documentation or explicit names if future audits keep confusing them. |
| AUD-ARCH-003 | candidate | low | Deprecated entry points | `runSimulation()` is still exported but throws immediately. | `src/sim/core/engine.ts` marks it as a Phase 2 placeholder and throws `runSimulation is deprecated; use simulateDay`. | No direct runtime use found in `src`/`web/src`; search found references in docs/tests. | Later test-suite audit can decide whether to add a no-production-import guard or remove the placeholder if legacy callers are gone. |

## Entry points later phases should exercise

- Phase 2 should exercise both `simulateDay(..., FULL_PIPELINE)` and the
  composed `advanceDaySegment` path with `dayBaseline`.
- Phase 3 should audit modules in `FULL_PIPELINE` order and compare declared
  `dependsOn` with actual state reads/writes.
- Phase 4 should treat `issueSeedGeneratorRegistry` as the runtime generator
  source and `cardRegistry`/`REQUIRED_CARDS` as the card source.
- Phase 5 should trace report projections from `src/reports/index.ts` exports to
  state/diff/cause/seed inputs.
- Phase 6 and Phase 7 should use `gameStore.beginDay`, `runService`, `endDay`,
  and `serializeForSave`/`hydrateFromSave` as the browser/session boundaries.
- Phase 8 should classify tests that import the testing runner separately from
  tests that import production entry points directly.
