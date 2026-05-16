# Phase 74 — Test Worker Crash Hardening (ISSUE-034)

Tier-3 audit finding. See `docs/ISSUE_TRACKER.md` ISSUE-034 for full
evidence, impact, and scope.

## Context

The audit captured an unreliable CI signal: vitest reported
`Tests 987 passed (1045)` and `Errors 1 error` while still exiting 0,
hiding ~58 collected-but-not-run tests behind a worker crash. A partial
fix (commit `c7647b7`) added pool-isolation for `phase20` /
`phase40` and resolved the crash itself; on the current
`claude/tier-3-audit-findings-71akX` branch, `npm test` reports
`Tests 1045 passed (1045)` and `Errors 0`. The remaining work is
hardening: a future worker crash must fail `npm test` regardless of
vitest's own exit-code behaviour.

## Implementation

- Add `scripts/run-tests.mjs` — a thin Node wrapper that spawns
  `npx vitest run`, tees stdio, and post-parses the summary. Fails
  the run when any of these hold:
  - vitest exits non-zero,
  - `Test Files X passed (Y)` shows X ≠ Y,
  - `Tests X passed (Y)` shows X ≠ Y,
  - the output contains `Vitest caught N unhandled error`,
  - the output contains `Worker exited unexpectedly`.
- Point `package.json#scripts.test` at the wrapper: `node scripts/run-tests.mjs`.
- `test:watch` and `typecheck` unchanged — watch mode runs locally and
  doesn't need the CI guard.

## Verification

Manual reproduction during development (per the issue's test approach):

- `setTimeout(() => process.exit(7))` inside a throwaway test →
  wrapper exits 1 with reasons `vitest exited with code 1` +
  `vitest reported one or more unhandled errors during the run`.
- `setTimeout(() => process.kill(process.pid, 'SIGKILL'))` inside a
  throwaway test → wrapper exits 1 with reason
  `vitest exited with code 137`.

Both throwaway tests were deleted before commit; the wrapper itself is
exercised every time `npm test` runs.

## Files

- `scripts/run-tests.mjs` (new)
- `package.json` (point `test` at the wrapper)
- `docs/ISSUE_TRACKER.md` (Status + Phase fields for ISSUE-034)
