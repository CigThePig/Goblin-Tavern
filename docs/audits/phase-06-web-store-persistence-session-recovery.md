# Phase 6 — Web Store, Persistence, Import/Export, and Session Recovery

## Scope and status

Phase 6 audited the browser-facing state paths that can diverge from the
headless simulation path:

- `web/src/lib/sim/gameStore.svelte.ts` — segmented day execution, player picks,
  pending card choices, route/subroute state, and serialize/hydrate seams.
- `web/src/lib/sim/persistence.ts` — autosave envelope, migration, validation,
  localStorage failure handling, and old-save compatibility.
- `web/src/lib/sim/exportImport.ts` and `web/src/lib/sim/snapshots.ts` — manual
  backup/restore paths that reuse the autosave validator.
- `web/src/lib/prefs/*` — separate preference persistence and storage-failure
  behavior.
- `web/src/App.svelte` and `web/src/lib/components/more/SavesSection.svelte` —
  boot, save flush, Continue, Start over, snapshot load, import, and failure UI
  integration.
- Adjacent tests under `tests/web/` covering persistence, import/export,
  snapshot safety, day-segment recovery, and debug bundles.

Audit result: no confirmed recovery defect was reproduced in this phase. The
session state machine is well documented in code and covered by focused tests for
mid-day resume, legacy in-flight migration, failed storage writes, import
validation, and snapshot orphan recovery. Two low-severity candidate blind spots
remain because they are not currently protected by semantic or UI-level tests.

## Browser/session state machine

| Step | Store state | Persistence behavior | Recovery expectation | Evidence |
|---|---|---|---|---|
| Fresh boot with no save | `App.svelte` shows Start until `loadSession()` returns `fresh`. | `loadSession()` reads `SAVE_STORAGE_KEY` through the storage adapter and returns `fresh` for a missing or empty slot. | Player can start a new run; prefs are hydrated first. | `App.svelte`, `persistence.ts`, `preferences.ts`; covered by `tests/web/persistence.test.ts`. |
| Start game | `gameStore.reset(...)` creates a new state and `gameStore.beginDay()` opens Segment A. | Old autosave is cleared before reset; the first normal save happens after entering the game. | Day 1 starts with real Segment-A morning output, not a pre-baked surface. | `App.svelte`, `gameStore.svelte.ts`; covered by day-segment tests. |
| Segment A / morning-plan pause | `segment === 'A'`; `dayBaseline` stores the start-of-day state; pending responses are reset for the new day; picks remain queued. | `serializeForSave()` includes `dayBaseline` because the day is in progress. | Refresh resumes without rerunning Segment A and keeps a full-day diff baseline for later Segment C. | `gameStore.svelte.ts`, `persistence.ts`; covered by `tests/web/phase186.daySegments.test.ts`. |
| Segment B / service-closing pause | `segment === 'B'`; picks have been consumed and cleared; pending responses may point at morning, service, or closing seeds. | `serializeForSave()` still includes `dayBaseline`; `daySession.segment` is persisted. | Refresh can hydrate at closing/service and `endDay()` still computes a whole daily diff. | `gameStore.svelte.ts`, `persistence.ts`; covered by `tests/web/phase186.daySegments.test.ts`. |
| Segment C / closed-day report | `segment === 'C'`; `dayBaseline` is cleared; `latestResultLite` and `previousCalendar` preserve the report surface. | `serializeForSave()` omits stale `dayBaseline` and persists report-lite data without duplicating state. | Continue returns to the saved route/report state; opening the next day does not relabel yesterday. | `gameStore.svelte.ts`, `persistence.ts`; covered by `tests/web/phase186.daySegments.test.ts`. |
| Pre-Cluster-5 legacy in-flight save | Legacy `daySession` has no explicit `segment`; `plan`, `service`, and `closing` are treated as stale in-flight saves. | `validatePersistedSession()` resets those beats to clean morning, drops stale pending intents and stale baseline, but keeps queued picks. | Continue reopens the day from Segment A instead of skipping morning/world setup. | `persistence.ts`; covered by `tests/web/phase186.cluster7Migration.test.ts`. |
| Invalid or incompatible save | Store is not hydrated; `hydrationError` or StartScreen banner tells the player to start over. | Malformed JSON, missing `saveVersion`, state validation failure, and unsupported version return typed outcomes. | Bad autosave does not crash boot or corrupt prefs. | `App.svelte`, `persistence.ts`; covered by `tests/web/persistence.test.ts`. |
| Autosave write failure | Store keeps running; `lastSavedAt` is only updated after `saveSession()` returns `ok: true`; `saveError` holds failure details. | Storage exceptions are classified as `quota`, `unavailable`, or `unknown`. | UI can warn that latest progress is not saved instead of falsely reporting success. | `App.svelte`, `persistence.ts`, `SavesSection.svelte`; covered by `tests/web/phase89.persistenceSafety.test.ts`. |
| Snapshot load / JSON import | Parsed payload goes through `validatePersistedSession()` before `gameStore.hydrateFromSave()`. | Import and snapshot restore share the same migration and validation path as autosave. | Manual backups cannot bypass state schema validation or save-version checks. | `exportImport.ts`, `snapshots.ts`, `SavesSection.svelte`; covered by export/import and snapshot-safety tests. |
| Preferences | `prefsStore.hydrate()` loads display/tutorial/difficulty preferences before save load. | Preferences use a separate key and silently fall back to defaults on malformed JSON, version mismatch, or storage errors. | A bad game save does not poison preferences; a bad preference blob does not block boot. | `preferences.ts`, `prefsStore.svelte.ts`, `App.svelte`. |

## Source map

### Store and day execution

- `gameStore` is the web layer's engine boundary. It calls `advanceDaySegment()`
  for Segment A (`beginDay`), Segment B (`runService`), and Segment C (`endDay`),
  and keeps the segment position in a persisted `segment` field.
- `dayInput()` derives a stable per-day seed from `seedString` plus
  `state.calendar.totalDaysElapsed`. Since the calendar advances only in Segment
  C, all segments for the same day use the same day seed.
- `dayBaseline` is snapshotted before Segment A and passed to Segment B/C so the
  final day diff spans the entire day. It is only serialized while `segment` is
  `A` or `B`.
- `picks` are a cross-screen owner-action queue. Segment B consumes them and then
  clears the queue. `staffPriorities` are sticky by design.
- `pendingBySeedId` records card decisions until Segment C. `DayScreen` converts
  entries for currently visible morning/service/closing seeds into
  `ResponseIntent[]` immediately before calling `endDay()`.
- `latestResult` is persisted as `LatestResultLite` without duplicating `state`;
  hydration reconstructs a `SimResult` by pairing lite data with the hydrated
  state.

### Autosave envelope and validation

- The autosave root is a versioned `PersistedSession` under
  `goblin-tavern:save:v1`.
- `validatePersistedSession()` is the shared gate for autosave load, snapshot
  payloads, and import payloads. It checks the envelope version, migrates and
  validates `state`, optionally migrates and validates `dayBaseline`, sanitizes
  picks/pending/subroutes, and applies legacy day-session reset rules.
- State validation uses `safeValidateState(..., { modules: FULL_PIPELINE })`, so
  load/import paths validate against the canonical module list rather than a
  small web-only subset.
- Save writes return a typed `SaveResult`. `App.svelte` is responsible for only
  advancing `lastSavedAt` on success and leaving `saveError` visible on failure.

### Snapshots and import/export

- Export is a pure JSON serialization of the same `PersistedSession` shape used
  by autosave.
- Import is parse-only until the player confirms replacement. The confirm step
  reparses and revalidates the stored raw text, reducing the chance that a stale
  preview applies unchecked data.
- Named snapshots store a lightweight index separately from payload blobs.
  Snapshot load returns the same `ValidationOutcome` as autosave load.
- Snapshot creation checks count limits and a soft byte budget before writing.
  If the payload write succeeds but the index write fails, it rolls back the
  payload; orphan recovery scans payload keys that are not listed in the index.

### Preferences and diagnostics

- Preferences are isolated from game save state under
  `goblin-tavern:prefs:v1`. Their loader sanitizes enum/boolean/list fields and
  falls back to defaults on bad input.
- Preference writes intentionally swallow storage errors because no gameplay
  flow depends on them.
- The debug bundle is intentionally narrower than a save export: it summarizes
  route, subroutes, beat flags, calendar, top pressures, pending choices, picks,
  errors, and preferences while omitting heavy save payloads and card prose.

## Tests and checks run

| Command | Result | Notes |
|---|---|---|
| `npm test -- tests/web/persistence.test.ts tests/web/exportImport.test.ts tests/web/phase89.persistenceSafety.test.ts` | Pass | 43 tests passed. Expected console warnings were emitted for quota simulation and dropped invalid picks. |
| `npm test -- tests/web/phase186.daySegments.test.ts tests/web/phase186.cluster7Migration.test.ts tests/web/debugBundle.test.ts` | Pass | 24 tests passed. Expected console warnings were emitted for legacy in-flight save resets. |
| `npm run build` | Pass with warnings | Production build completed. Existing warnings: Svelte a11y click/key warning in `BottomSheet.svelte` and Rollup chunk-size warning. |

## Findings ledger

| ID | Status | Severity | Area | Summary | Evidence | Current tests | Next action |
|---|---|---|---|---|---|---|---|
| AUD-WEB-006-001 | candidate | low | Import/load pending responses | `pendingBySeedId` is shape-sanitized but not semantically re-bound to the hydrated day's actual seeds or slots. A crafted import can carry a pending choice whose `seedId` matches a current seed but whose choice/slot no longer matches; `DayScreen` would treat the card as resolved and Segment C would build an intent that the responses module logs and skips. | `sanitizePending()` only checks field shapes and `sanitizeChoice()` only checks the choice object's primitive fields. `DayScreen.endDay()` trusts `pending.choice` for any currently visible seed id. `responsesModule` logs and skips unmatched intents instead of applying a consequence. | Existing import/persistence tests cover malformed JSON, schema-invalid state, incompatible versions, and shape-preserving pending round trips, but do not assert semantic pending choice rebinding against actual `seed.responseSlots`. | Add a focused test with a valid save/import whose current seed id has a mismatched pending slot; decide whether load should drop mismatches, `DayScreen` should ignore mismatches and leave the card unresolved, or the engine warning is acceptable. |
| AUD-WEB-006-002 | candidate | low | Snapshot budget tests / custom storage seam | Snapshot storage budget accounting is precise for real `localStorage`, but with an injected `StorageLike` that lacks `length`/`key`, `estimateStorageBytes()` falls back only to module `memoryFallback`, not the injected adapter. This can make tests undercount bytes and miss budget regressions. | `snapshots.ts` reads active storage through `getStorage()` but the fallback branch only walks `memoryFallback`. The phase-89 test adapter does not expose `length`/`key`. Production browser storage does expose both, so this is a test-seam weakness rather than a player-facing defect. | Snapshot tests cover orphan recovery and save failure paths, not byte-budget behavior with injected adapters. | Either make test adapters implement `length`/`key`, or extend the storage seam with an optional key iterator so budget tests can exercise the same path as browsers. |

## Follow-up test candidates

1. **Semantic pending-choice load/import test**
   - Build or mutate a valid save so `pendingBySeedId[currentSeed.id]` contains a
     well-shaped choice with a nonexistent `slotId` or impossible verb/shape.
   - Load through `validatePersistedSession()` and hydrate `gameStore`.
   - Assert the chosen design: drop invalid pending, preserve but do not mark the
     card resolved, or record a visible warning before Segment C.

2. **Import replacement autosave test**
   - Component- or store-level test that confirms snapshot/import replacement
     calls `hydrateFromSave()`, routes via `onreplaced`, and causes the next save
     flush to write the replacement session rather than the prior run.

3. **Preference unavailable-storage test**
   - Inject a throwing preferences storage adapter and assert `loadPreferences()`
     returns defaults and setters do not throw. This documents the deliberately
     silent preference-failure contract.

4. **Snapshot budget test with browser-like storage**
   - Use a storage fixture that implements `length` and `key(i)` to verify
     `estimateStorageBytes()` and `wouldExceedBudget()` count index and payload
     bytes as expected.

## Phase 6 exit criteria

- Browser/session state machine documented: complete.
- Reproduction scripts or tests for confirmed recovery defects: not applicable;
  no confirmed defect was reproduced.
- Candidate blind spots documented with concrete next tests: complete.
