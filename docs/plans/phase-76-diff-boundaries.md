# Phase 76 — Drop unused tagged diff boundaries (ISSUE-036)

See `docs/ISSUE_TRACKER.md` ISSUE-036 for full evidence and impact.

## Context

`simulateDay` was snapshotting and finalizing four tagged diff
boundaries — `owner_actions`, `service`, `end_week`, `end_month` —
in addition to the `'day'` boundary the cause report relies on. The
audit found no production consumer for any of the four; the only
readers were two test asserts in `tests/sim/phase17.causes.test.ts`.
Worse, the `'service'` boundary was finalized after the `closing`
phase but five phase slots before `generateReports`, so any future
consumer reading it would have missed every mutation produced by
`applyResponses`, `endDay`, `endWeek`, `endMonth`.

Each tagged boundary costs a full state snapshot + diff walk per day.

## Decision

Remove the four dead boundaries; keep only `'day'`. The phase-17
tests are updated to read from `'day'` (the same mutations show up
there). The `PhaseBoundary` union collapses to a single member so the
type system flags any future code that tries to add a non-`'day'`
boundary without wiring an engine snapshot for it.

## Implementation

- `src/sim/core/engine.ts` — remove the `owner_actions` / `service` /
  `end_week` / `end_month` snapshot/finalize calls and the local
  `isEndWeekDay` / `isEndMonthDay` bookkeeping that fed them. Replace
  the misleading "reports can read it from getDiff('service')" comment
  with a one-paragraph note pointing at this issue.
- `src/sim/core/diff.ts` — collapse `PhaseBoundary` to `'day'`.
- `tests/sim/phase17.causes.test.ts` — rewrite the three boundary
  asserts to read the day diff instead. The first asserts
  `boundaries.toEqual(['day'])`; the second finds the ale quality
  drop in the day diff; the third still confirms a day diff fires on
  week-closing days.

## Verification

- `tests/sim/phase17.causes.test.ts` (31 tests) — passes.
- `tests/sim/phase42.worldDiffCoverage.test.ts` (13 tests) — passes,
  confirming the `'day'` boundary still surfaces every world-slice
  mutation the cause-coverage audit needs.
- `npm run typecheck` — clean.

## Files

- `src/sim/core/engine.ts`
- `src/sim/core/diff.ts`
- `tests/sim/phase17.causes.test.ts`
- `docs/ISSUE_TRACKER.md`
