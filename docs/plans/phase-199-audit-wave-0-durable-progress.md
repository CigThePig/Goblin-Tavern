# Phase 199 — Gameplay audit, Wave 0: restore durable progress

Wave doc for `ISSUE-166` / Wave 0 of
`docs/audits/2026-07-26-gameplay-audit/REMEDIATION_QUEUE.md`.

**Finding:** `P2-RT-001` (Critical / P0) — *Save serialization throws on a
Svelte proxy; autosave, Continue, snapshot, export/import and error-reload
all lose the run.* Evidence: Phase 2 §9.

**Gate (Phase 8 §7):** R11 and R12 pass at Morning, Plan, Service, Closing,
Report and the next Morning; pending choice, queued action, baseline,
Service outcome, report archive, RNG and calendar remain identical across
the reload.

---

## 1. Root cause

`GameStore.serializeForSave()` builds the save envelope from `$state`
fields and calls `structuredClone` on two of them:

```ts
latestResultLite = structuredClone({ reports, logs, validation, diffs })  // line 525
pendingBySeedId:  structuredClone(this.pendingBySeedId)                   // line 548
```

Both arguments are Svelte deep proxies. `structuredClone` rejects a Proxy
with `DataCloneError` — in Chrome and in Node alike. `pendingBySeedId` is
proxied from the first assignment even while empty, so **every** save
throws, on day 0, before the player has done anything.

The throw happens *inside* `serializeForSave()`, i.e. before
`saveSession()` ever runs, so the typed `SaveResult` failure path — and
with it the `saveError` banner and its Retry — is never reached. The player
sees no error; the save simply never exists. That is the second half of the
defect and is fixed separately from the clone itself (§2.3).

Why the suite missed it: in the Vitest node environment the runes compile
to their SSR forms, where `$state` is identity and no proxy exists. The
existing round-trip test (`phase186.daySegments`) therefore serialized
plain objects and passed. Regression coverage has to inject the proxy
itself rather than rely on the environment to produce one (§3).

## 2. Work

### 2.1 A proxy-safe save serializer

New `web/src/lib/sim/plainSave.ts`, plain TypeScript (no runes, so it
behaves identically in the browser, in jsdom and in node):

```ts
toPlainSaveData<T>(value: T): T
```

A deep clone that *reads through* proxies and reproduces `JSON.stringify`
semantics exactly — `toJSON()` honoured, `undefined`/function-valued keys
dropped, array holes and `undefined` elements to `null`. Anything that
cannot survive a JSON round trip (`Map`, `Set`, class instances, `BigInt`,
`Symbol`, non-finite numbers, cycles) throws a typed
`SaveSerializationError` naming the offending path, rather than silently
persisting `{}` where state used to be. That converts the architectural
"state must be plain JSON" rule into an enforced, visible save-boundary
check.

`serializeForSave()` drops both `structuredClone` calls and returns
`toPlainSaveData(envelope)` — one guarantee point for the whole envelope
instead of two ad-hoc clones, so `state`, `picks`, `previousCalendar` and
every future field are covered too.

### 2.2 The fields the gate names

Two of the gate's fields were not in the envelope at all.

**Service outcome.** `serviceOutcome` (patrons / net coin / incidents) was
explicitly session-only, so a mid-day reload dropped the strip. It is three
numbers — persist it.

**Start-of-day baseline.** `dayBaseline` was removed from the envelope by
the 2026-06-11 audit (§1): persisting a second full `TavernState` mid-day
doubled the payload and crossed the ~5 MB browser quota from about day 22.
That constraint is real — measured on the current build, `state` alone is
194 KB at day 1, 1 005 KB at day 14 and 1 691 KB at day 28.

New `web/src/lib/sim/baselinePatch.ts` persists the baseline as a
structural patch against the state already in the envelope, since mid-day
the two differ mostly by appends to `attribution.attributions`, `causes`
and `history`. The encoder walks both trees and emits, per node, either
nothing (identical), a per-index array patch with the baseline's length, a
key-wise object patch, or the baseline subtree verbatim. Measured over 28
days, both mid-day segments, round-tripping exactly:

| Day | Baseline | Patch |
|---|---|---|
| 1 | 54 KB | 2.3 KB (A) · 5.9 KB (B) |
| 7 | 697 KB | 273 KB (A) · 261 KB (B) |
| 14 | 837 KB | 107 KB (A) · 190 KB (B) |
| 28 | 1 585 KB | 190 KB (A) · 218 KB (B) |

The patch is written only while a day is in flight (segment `A` or `B`) —
at segment `C` there is no baseline to hold. On load the patch is applied
to the raw saved state and the reconstruction runs through the same
migration + Zod pipeline as `state`; a patch that fails to apply or
validate is dropped with a warning and the existing fall-back (baseline =
current state) stands, so a bad patch degrades the resumed day's full-day
diff instead of failing the load.

`dayBaseline` (the full pre-2026-06-11 form) is still accepted on read, so
old saves keep loading.

### 2.3 Visible, recoverable save failures

`persistence.saveSessionFrom(build)` takes a thunk, so a throw *during*
serialization becomes `{ ok: false, reason: 'serialize', … }` instead of an
uncaught exception. `SaveFailureReason` gains `'serialize'` and the More →
Saves banner gains copy for it; autosave, `pagehide` flush, Retry, snapshot
creation and export all route through it. A save that cannot be built now
tells the player so and offers Retry.

### 2.4 The persistence contract

`persistence.ts`'s header becomes the written contract the gate needs:
which fields cross the save boundary (canonical state, seed, calendar via
state, `previousCalendar`, report archive, route + subroutes, beat +
segment + completion flags, pending choices, queued picks, staff
priorities, dismissal ids, baseline patch, Service outcome), which are
deliberately transient and why (transition/pacing flags, bottom-sheet and
picker state, routing hints, debug fields, per-day accumulated logs), and
where RNG lives — `world.rngStreams` inside state for the named identity
streams, and `simSeed` + `calendar.totalDaysElapsed` for the per-day
stream, so both follow `state` with nothing extra to persist.

## 3. Evidence

`tests/web/phase199.wave0.durableProgress.test.ts`:

1. **Reproduction.** Wrap the store's reactive fields in Svelte-style deep
   proxies, then `serializeForSave()`. Fails before the fix with the
   audit's `DataCloneError`; after the fix returns an envelope that
   `structuredClone` accepts and that equals its own JSON round trip.
2. **Serializer unit.** Proxy unwrapping, nested proxies, JSON parity for
   `undefined`/`toJSON`/array holes, and a named-path throw for cycles,
   `Map`/`Set` and non-finite numbers.
3. **Baseline patch.** Exact round-trip against real mid-day states, and a
   size assertion that the patch stays a fraction of the baseline.
4. **R11 — reload at every day position.** For Morning, Plan, Service,
   Closing, Report and the next Morning: serialize → validate → hydrate a
   reset store, then assert state, calendar, pending choices, picks, staff
   priorities, beat/segment/flags, route + subroutes, dismissal ids,
   Service outcome, reconstructed baseline and report archive are
   identical.
5. **Continuity.** A run interrupted mid-day and resumed closes the day to
   byte-identical state, report and calendar versus the uninterrupted run —
   the RNG assertion.
6. **R12 — snapshot, export/import, failure recovery.** Snapshot create →
   load, export → import, and a build that throws surfacing as
   `{ ok: false, reason: 'serialize' }` rather than an uncaught error.

## 4. Noted, not fixed here

`TavernState` grows without bound — `modules.attribution.attributions`
alone is 985 KB of the 1 691 KB day-28 state, ahead of `issueSeeds`
(209 KB), `causes` (182 KB) and `history` (150 KB). localStorage stores
UTF-16, so a day-28 save is already ~4 MB of a typical 5 MB origin budget
and a long run will eventually fail to save for reasons that have nothing
to do with `P2-RT-001`. The audit ran 28–30 days and did not reach it, and
no queue finding covers it. Recorded here and in the queue as an
observation for the user to schedule; pruning ledgers is a simulation
change, not a Wave 0 one.
