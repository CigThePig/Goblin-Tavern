# Phase 2 — Simulation engine, phases, state, validation, and migrations

Status: complete for the Phase 2 audit pass. This is a discovery artifact, not
an implementation pass. No confirmed defects were found during this slice; the
items in the findings table are follow-up audit candidates or guardrail gaps.

## Scope and commands used

Phase 2 audited the shared mechanics that later producer, projection, and UI
audits depend on:

- `src/sim/core/*`: phase order, dependency sorting, segment execution, RNG
  streams, calendar gates, validation timing, report collection, diffs, and
  result shape.
- `src/sim/state/*`: validation defaults, reference checks, additive save-state
  migrations, and the legacy save-envelope placeholder.
- `web/src/lib/sim/persistence.ts` and `web/src/lib/sim/gameStore.svelte.ts` as
  the current browser/session migration and segmented-store boundaries.
- Adjacent tests for full-day engine behavior, segmented equivalence,
  persistence, and import/export hydration.

Commands run during this phase:

```bash
sed -n '1,260p' src/sim/core/engine.ts
sed -n '700,820p' src/sim/core/engine.ts
sed -n '1430,1705p' src/sim/core/engine.ts
sed -n '1,240p' src/sim/core/segments.ts
sed -n '1,220p' src/sim/core/phases.ts
sed -n '1,260p' src/sim/core/changeTracker.ts
sed -n '1,720p' src/sim/core/diff.ts
sed -n '1,180p' src/sim/state/validation.ts
sed -n '1,725p' src/sim/state/migrations.ts
sed -n '1,260p' src/sim/state/saveEnvelope.ts
sed -n '326,520p' web/src/lib/sim/persistence.ts
sed -n '270,370p' web/src/lib/sim/gameStore.svelte.ts
sed -n '431,515p' web/src/lib/sim/gameStore.svelte.ts
rg -n "validateState\(|safeValidateState\(|migrateSaveEnvelope|SaveEnvelope|dayBaseline|advanceDaySegment|isEndOfWeek|isEndOfMonth|getDiff\(|getDiffs\(|diffs" src web/src tests
rg -n "moduleRegistry\.(register|clear|all|get|has)" src web/src tests
rg -n "it\(|describe\(" tests/sim/phase7.engine.test.ts tests/web/persistence.test.ts tests/web/exportImport.test.ts tests/web/phase186.daySegments.test.ts tests/sim/phase186.segmentedEngine.test.ts
npm test -- tests/sim/phase7.engine.test.ts tests/web/phase186.daySegments.test.ts
npm test -- tests/web/persistence.test.ts tests/web/exportImport.test.ts
npm run typecheck
```

## Confirmed engine and state invariants

| Invariant | Evidence | Current coverage | Audit note |
|---|---|---|---|
| `simulateDay` and `advanceDaySegment` share one segment runner. | Both entry points call `runSegmentPhases`; `simulateDay` loops `DAY_SEGMENTS`, while `advanceDaySegment` runs one `phasesForSegment(segment)` slice. | `tests/sim/phase186.segmentedEngine.test.ts`; `tests/web/phase186.daySegments.test.ts`. | This substantially lowers segment/full-day drift risk because phase hooks, report collection, validation, and calendar advancement are in the shared runner. |
| Segment RNG is deterministic and isolated. | `reseedSegmentRng(runtime, input.seed, segment)` recreates streams from `segmentSeed(baseSeed, segment)` before each segment. | Segmented engine tests assert final-state parity, serializable checkpoints, and deterministic re-runs from the same checkpoint. | Later module audits should still run the segmented tests when adding RNG consumers, because parity can fail if a hook reads from state that is not checkpointed. |
| Module hook order is dependency-sorted with hard failures for duplicates, missing deps, and cycles. | `topologicallySortModules` checks duplicate ids, missing declared dependencies, and cycles before running hooks. | `tests/sim/phase7.engine.test.ts`. | Phase 3 should compare declared dependencies with actual cross-module reads/writes; Phase 2 only verified the mechanical sorter. |
| End-week and end-month hooks are calendar-gated inside the shared runner. | `runSegmentPhases` skips `endWeek` unless `isEndOfWeek` and skips `endMonth` unless `isEndOfMonth`; Segment C owns both phases. | `tests/sim/phase7.engine.test.ts`; `tests/sim/phase186.segmentedEngine.test.ts`; `tests/sim/phase3.calendar.test.ts`. | Month close on day 28 implies week close too; existing tests cover both full-day and segmented paths. |
| Reports are collected after `generateReports` hooks mutate state. | `collectReports` is called after `runHooks('generateReports', ...)` in the shared runner. | `tests/sim/phase7.engine.test.ts` covers report collection shape; later report tests cover projection outputs. | Later report audits should verify individual reports read settled state and the final `day` diff. |
| Engine validation runs after report generation but before calendar advancement. | `SIMULATION_PHASES` orders `generateReports`, `validate`, then `advanceCalendar`; the runner collects module validations and then calls `ctx.validate()` during `validate`. | `tests/sim/phase7.engine.test.ts` checks result validation; persistence tests validate hydrated state. | This is a deliberate ordering tradeoff: reports can be generated from pre-calendar-advance state, while the returned state is advanced. |
| Result diffs expose a single day boundary. | `simulateDay` snapshots `day` before Segment A and finalizes after calendar advancement; `advanceDaySegment` snapshots from `dayBaseline` and finalizes after the selected segment. | `tests/sim/phase186.segmentedEngine.test.ts`; `tests/web/phase186.daySegments.test.ts`; report projection tests consume `result.diffs.find(boundary === 'day')`. | The full-day diff contract depends on the store persisting `dayBaseline` mid-day. |
| Bare state validation defaults to the canonical pipeline when no registry override exists. | `resolveModules` uses explicit `options.modules`, then non-empty `moduleRegistry`, then `FULL_PIPELINE`; current searches found no production or test registration into `moduleRegistry`. | Many tests call `validateState(state)` or `safeValidateState(state)` directly; Phase 1 already noted the repaired fallback. | The non-empty-registry branch remains an extension seam, not a current runtime path. |
| Validation includes schema and reference checks. | `validateState`/`safeValidateState` compose schemas from modules, warn on unknown module keys, and run world, recipe, stock, and area reference validators after parsing. | State/module tests exercise direct validation; persistence/import paths use `safeValidateState(..., { modules: FULL_PIPELINE })`. | Later module/content audits should inspect whether each reference validator knows all newer content families. |
| Browser load, snapshot load, and JSON import share migration + validation. | `validatePersistedSession` is the common parser; `migrateAndValidateState` applies additive `ensure*` helpers and validates with `FULL_PIPELINE`. | `tests/web/persistence.test.ts`; `tests/web/exportImport.test.ts`; `tests/web/phase186.daySegments.test.ts`; `tests/web/phase186.cluster7Migration.test.ts`. | This closes the Phase 2 concern that migrations might repair only initial state but not browser/import saves. |

## Segment and calendar seam map

| Segment | Phases | Store method | Key state boundary |
|---|---|---|---|
| `A` | `startDay` through `forecastTraffic` | `gameStore.beginDay()` | Takes the start-of-day `dayBaseline`, resets per-day UI/session state, and generates morning/prep seeds. |
| `B` | `beforeOwnerActions` through `closing` | `gameStore.runService()` | Applies queued owner actions and sticky staff priorities, drains owner-action picks, and keeps the original `dayBaseline`. |
| `C` | `applyResponses` through `advanceCalendar` | `gameStore.endDay()` | Applies response intents, weekly/monthly gates, report generation, validation, calendar advancement, final result storage, and `dayBaseline` clearing. |

The segment partition is explicitly tested against `SIMULATION_PHASES`, and the
web store tests cover mid-day serialization/hydration with the start-of-day
baseline preserved. The main remaining audit risk is not the segment machinery
itself; it is future hook additions that read/write state outside this persisted
checkpoint contract.

## Migration and save compatibility map

| Compatibility surface | Current behavior | Coverage / evidence | Audit note |
|---|---|---|---|
| Initial state creation | `createInitialTavernState()` remains the default source for fresh state and default module slices. | Used by migration helpers and test setup. | Fresh-state defaults and migration defaults share a source, reducing drift for additive module slices. |
| Web persisted session | `validatePersistedSession` enforces `SAVE_VERSION`, migrates both `state` and optional `dayBaseline`, sanitizes picks/pending/subroutes, and returns a canonical `PersistedSession`. | Persistence, export/import, and segmented day tests pass. | This is the real browser/import compatibility path today. |
| Additive state migrations | `ensureWorldBranch`, area/staff identity, recipes, upkeep recipe flags, expeditions, weekly/monthly history, owner-time fields, cast attributes, and module slices run before validation. | Covered piecemeal by persistence and phase-specific tests; not all helpers have one consolidated old-save fixture. | Candidate guardrail: add a fixture-style test that deletes/legacy-renames every currently migrated field in one payload and verifies load success. |
| Save envelope | `src/sim/state/saveEnvelope.ts` defines `SaveEnvelope` and a no-op `migrateSaveEnvelope`. | Search found references only to the type/function itself, not to the browser persistence path. | Treat as a legacy/deferred sim-level placeholder unless a future host adopts it; do not assume it protects web saves. |
| `moduleRegistry` fallback | Bare validation would use `moduleRegistry.all()` if someone populated it; current codebase does not. | Search found only validation reads. | Candidate guardrail: either keep it documented as an intentional host override or add a test proving accidental registry population does not happen in production imports. |

## Diff surface observed in Phase 2

`diffTavernStates` currently walks these broad areas:

- core operational meters: areas, stock, staff, customer groups, reputation,
  pressures, and memory count;
- world numeric/social slices: cultures, factions, suppliers, regulars, local
  events, social rumours, and tavern identity;
- economy/adventure slices: recipes, expeditions, hireable adventurers;
- selected module-state internals for owner actions, weekly, monthly, issue
  seeds, responses, history, and feedback.

The diff deliberately skips noisy timestamp fields and records adds/removes only
where helper logic has been implemented. Phase 2 found no direct mismatch in the
mechanical day-diff contract, but later report/card audits should compare each
projection's consumed paths against this whitelist. In particular, any report or
card that explains a state field outside the current diff walkers should either
have a separate source of truth or a new diff path.

## Findings ledger

| ID | Status | Severity | Area | Summary | Evidence | Current tests | Next action |
|---|---|---|---|---|---|---|---|
| AUD-SIM-001 | candidate | low | Save-envelope compatibility | `src/sim/state/saveEnvelope.ts` still contains a no-op `migrateSaveEnvelope`, while the active browser/import path uses `web/src/lib/sim/persistence.ts` migrations instead. | Search found `SaveEnvelope`/`migrateSaveEnvelope` only in the placeholder file; persistence/import code calls `validatePersistedSession` and `migrateAndValidateState`. | Web persistence and export/import tests pass through the active path. | Document the envelope as legacy/deferred, remove it if no host needs it, or wire explicit versioned migrations if a non-web host starts using it. |
| AUD-SIM-002 | candidate | low | Migration test oracles | The active migration chain is broad and additive, but coverage is distributed across phase-specific tests rather than one consolidated old-save fixture that exercises all current helpers together. | `migrateAndValidateState` chains world, area, staff, recipes, upkeep, expeditions, weekly, monthly, owner-time, cast, and module-slice helpers before validation. | `tests/web/persistence.test.ts`, `tests/web/exportImport.test.ts`, and phase-specific migration tests pass, but no single fixture was found that combines every legacy omission/rename. | Add a focused persistence fixture test that starts from a deliberately old-shaped state with all known missing/renamed fields and asserts load/import success plus migrated fields. |
| AUD-SIM-003 | candidate | low | Validation extension seam | Bare validation prefers a non-empty `moduleRegistry` over `FULL_PIPELINE`; current runtime never populates that registry, so this is not a defect today, but accidental future registration could narrow bare validation unexpectedly. | `resolveModules` checks `moduleRegistry.all()` before `FULL_PIPELINE`; targeted search found no `moduleRegistry.register(...)` calls. | Existing direct `validateState(state)` tests pass because the registry remains empty. | Keep the seam documented, or add a guard test that production imports do not populate `moduleRegistry` unless the override behavior is intentionally redesigned. |
| AUD-SIM-004 | candidate | medium | Diff/report contract | The day-diff walker is intentionally selective; later projection/card audits must verify every consumer path is represented or separately justified. | `diffTavernStates` walks many but not all state slices and skips noisy counters/timestamps by design; report projections read the single `day` diff. | Segmented/full-day tests prove diff parity, not consumer-path exhaustiveness. | In Phase 5, build a consumer-path matrix for daily report, missed opportunity, pressure, and digest projections against `diff.ts` walkers. |

## Proposed follow-up tests

1. **Consolidated legacy-save migration fixture.** Build one old-shaped
   persisted session that omits `world`, area identity fields, staff identity,
   recipes, expeditions, weekly/monthly history, newer module slices, and uses
   legacy owner-action time field names. Assert `validatePersistedSession` loads
   and normalizes it.
2. **Validation override guard.** Assert production imports leave
   `moduleRegistry.all()` empty, or redesign `resolveModules` so a non-empty test
   registry cannot accidentally narrow bare validation for production callers.
3. **Diff consumer matrix.** In Phase 5, script or table every report projection
   path that reads `result.diffs` and compare it to `diffTavernStates` coverage.
4. **Future RNG hook smoke.** When a module adds a new named RNG stream or
   cross-segment hook, rerun the segmented parity suite and add a narrow test if
   the hook depends on state that must survive a checkpoint.

## Phase 2 exit criteria

- Engine/state invariants are listed above with source evidence and current
  coverage.
- Migration/reference-validation gaps are queued as focused follow-up tests.
- No confirmed Phase 2 defects were promoted from candidate status during this
  pass.
