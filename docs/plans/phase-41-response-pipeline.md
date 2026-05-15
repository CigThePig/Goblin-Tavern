# Phase 41 — Response pipeline + unified pending queue (ISSUE-001)

This phase delivers the work tracked as `ISSUE-001` in
[`docs/ISSUE_TRACKER.md`](../ISSUE_TRACKER.md). See the tracker entry
for the full evidence, impact, scope, and test approach. This document
records the implementation choices that arrived from the planning pass.

## What changed

The response resolver (`src/sim/modules/responses/responseResolver.ts`)
existed as a pure transform before Phase 41 but was not wired into the
simulation pipeline. Phase 41:

1. Adds a new `applyResponses` phase slot between `closing` and `endDay`
   in `src/sim/core/phases.ts`.
2. Extends `SimInput` with an optional `responseIntents` field.
3. Adds a new `state.modules.responses` slice with a unified pending
   queue, a cross-day seed cache, per-day bookkeeping, and lifetime
   counters.
4. Introduces a `responsesModule` that owns:
   - `applyResponses` — reads `ctx.input.responseIntents`, locates each
     seed by id in `state.modules.issueSeeds.seedsToday`, and
     dispatches the matching consequence profile through the shared
     `applyResponseProfile` walker with a `CtxApplier`. Unknown seeds,
     slots, or verbs are logged and skipped.
   - `startDay` — drains the pending queue: entries past `expiresAt`
     drop with a log entry; entries whose `scheduledFor` has arrived
     are applied via the same `CtxApplier` paths.
5. Adjusts `issueSeedsModule`'s `startDay` hook so it only clears
   `rejectedToday` (not `seedsToday`). Yesterday's seeds remain
   visible through the next day's `applyResponses`; the day's
   `generateReports` overwrites `seedsToday` with the fresh set a few
   phases later, so the carry-over window is exactly one day. This is
   load-bearing for the pipeline — without it, day N+1's
   `applyResponses` cannot find the seeds the player saw at the end of
   day N.
5. Extends the pure `resolveResponseIntent` resolver to dispatch all
   five effect kinds through a shared `applyResponseProfile` walker
   backed by a `CloneApplier`. `cause`-kind effects now append to
   `state.causes`; `memory`-kind effects append to `state.memories`;
   `future_hook`-kind effects and every entry in `profile.delayedEffects`
   enqueue into `state.modules.responses.pending`; `profile.memories`
   apply immediately and `profile.futureHooks` enqueue as
   `memory_future_hook` payloads.

## Shared dispatch contract

`src/sim/modules/responses/applyResponseProfile.ts` defines an
`EffectApplier` strategy interface and walks a `ConsequenceProfile` in
a fixed order:

1. `profile.immediateEffects` — apply via the applier (a
   `future_hook` kind is enqueued instead).
2. `profile.delayedEffects` — enqueue each as a pending entry.
3. `profile.memories` — apply via the applier.
4. `profile.futureHooks` — enqueue each as a `memory_future_hook`.

Two concrete `EffectApplier` implementations share the iteration
logic but differ in mutation primitive:

- **`createCtxApplier(ctx)`** (`ctxApplier.ts`) routes through
  `ctx.modifyArea/Stock/Staff/CustomerGroup/Coin/Reputation`,
  `ctx.modifyPressure`, `ctx.addCause`, and `ctx.addMemory`. Every
  mutation emits a cause through the canonical mutator contract.
- **`createCloneApplier(stateClone)`** (`cloneApplier.ts`) mutates a
  cloned `TavernState` directly. Used by the pure resolver for tests
  and preview drivers.

## Pending entry scheduling

`pendingHelpers.ts` derives each pending entry's `scheduledFor` and
`expiresAt`:

- `delayedEffects` default to `today + 3` days. Producers can override
  by adding a `delay:N` tag on the effect.
- `futureHooks` default to `today + 7` days. Producers can override
  via `metadata.scheduledInDays` on the `MemoryDraft`.
- `expiresAt` defaults to `scheduledFor + 7`. Producers can override
  via `metadata.expiresInDays` on the `MemoryDraft`.

These defaults reflect the surrounding weekly cadence: a delayed
effect fires before the week closes; a future hook fires roughly when
the week resets.

## Seed lifecycle

Phase 41 narrows the `issueSeedsModule.startDay` hook so it no longer
clears `seedsToday` at the start of the day. Seeds generated on day N
during `generateReports` remain in state until day N+1's
`generateReports` overwrites them with the new set. The carry-over
window is exactly one day — enough for the player loop:

- Day N runs without intents → `generateReports` populates `seedsToday`.
- Day N+1 player supplies `responseIntents` referencing the seed ids
  from N's report. `startDay` no longer clears them; `applyResponses`
  finds the seed in `seedsToday` and applies the consequence profile.
- Day N+1's `generateReports` overwrites `seedsToday` with fresh
  seeds for N+1.

This is the smallest viable contract change: same-day reads of
`seedsToday` (the only ones that exist in the engine today) still see
the most recent generation, and consumers that don't care about the
day boundary keep working.

## Files added

- `src/sim/modules/responses/types.ts` — module state + zod schema.
- `src/sim/modules/responses/selectConsequence.ts` — extracted from
  the resolver; shared between resolver and module.
- `src/sim/modules/responses/pendingHelpers.ts` — scheduling
  derivation.
- `src/sim/modules/responses/applyResponseProfile.ts` — shared
  iteration logic + `EffectApplier` interface.
- `src/sim/modules/responses/ctxApplier.ts` — engine-path
  implementation.
- `src/sim/modules/responses/cloneApplier.ts` — pure-resolver
  implementation.
- `src/sim/modules/responses/responsesModule.ts` — module + hooks.
- `src/sim/modules/responses/index.ts` — barrel re-exports.
- `tests/sim/phase41.responsePipeline.test.ts` — end-to-end tests.

## Files modified

- `src/sim/core/phases.ts` — `applyResponses` phase slot.
- `src/sim/core/context.ts` — `SimInput.responseIntents`.
- `src/sim/state/defaults.ts` — seed `state.modules.responses`.
- `src/sim/modules/issues/issueSeedModule.ts` — `startDay` no longer
  clears `seedsToday`. See the "Seed lifecycle" section above.
- `src/sim/modules/responses/responseResolver.ts` — refactored to
  use the shared applier; the existing return shape is preserved.
- `src/sim/testing/simRunner.ts` — register `responsesModule` in
  `FULL_PIPELINE`; thread `responseIntents` through `DayInputChooser`.
- `docs/ISSUE_TRACKER.md` — Status / Phase for ISSUE-001.

## Verification

```
npm test -- tests/sim/phase41.responsePipeline.test.ts
npm run typecheck
npm test
```

`tests/sim/phase41.responsePipeline.test.ts` covers the five
assertions from the issue's Test approach plus two pure-resolver
assertions for the newly-handled effect kinds. The existing Phase 19
and Phase 20 resolver tests are preserved (the resolver's external
return shape is unchanged; the new state-clone mutations are
additive).

## Downstream unlocks

With the pipeline wired:

- `policy_backlash` (ISSUE-013), `regular_customer` (ISSUE-014),
  `reputation_shift` (ISSUE-015), `violence` (ISSUE-016),
  `staff_burnout` (ISSUE-017), and the depth-thin families
  (ISSUE-024) can now ship meaningful consequence profiles whose
  effects actually mutate state.
- Roughly 50 of the codebase's ~70 hook ids carry time or
  precondition semantics that depend on a pending queue existing —
  those producers can now author against a real consumer surface.
