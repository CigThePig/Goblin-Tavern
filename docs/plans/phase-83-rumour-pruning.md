# Phase 83 — socialRumours pruning (ISSUE-043)

See `docs/ISSUE_TRACKER.md` ISSUE-043 for full evidence and impact.

## Context

`weekly/community.ts:persistRumour` writes and refreshes
`state.world.socialRumours` entries but never deletes. Long runs
that emitted rumours at any non-zero rate grew the map linearly with
sim age — `pressures/calculators/rumourPressure.ts` walks the full
map every day, so daily work also grew linearly. Phase 20
long-run audits flagged this in commit `359f268`; this phase closes
it.

## Implementation

`src/sim/modules/world/worldModule.ts`:
- New `pruneRumoursHook` runs on `endMonth`, mirroring the
  `endMonth` pruning shape from `historyModule.ts` (Phase 62 /
  ISSUE-022).
- Policy constants exported:
  - `RUMOUR_STALE_DAYS = 90` — `lastSpreadDay` window.
  - `RUMOUR_STALE_STRENGTH = 10` — drop only if strength is below.
  - `RUMOUR_MAX_ENTRIES = 60` — hard cap.
- Pass 1 drops entries where `lastSpreadDay <= today - 90` AND
  `strength < 10`. Pass 2 sorts survivors by strength and drops the
  lowest until at-cap.
- A single `addCause` records the dropped count
  (`source: world.rumour_prune`, `targetType: global`,
  `amount: -dropped.length`, tags `world / rumour / prune`).
- The hook mutates `socialRumours` via `delete` — same pattern as
  `persistRumour`'s direct write into the same map. Mutating an
  in-state map without a dedicated mutator is consistent with how
  rumours are added.

## Verification

`tests/sim/phase83.rumourPruning.test.ts` (new, 6 tests):
- policy constants exported and non-zero;
- stale + low-strength rumours dropped on endMonth;
- map size capped at `RUMOUR_MAX_ENTRIES` after a +15 overage;
- prune emits a cause with the right count and tags;
- `worldModule.hooks.endMonth` exists;
- clean state (no rumours) does not emit a spurious prune cause.

Adjacent suites still green: `phase34.weeklyCommunity` (17),
`phase62.historyPruning` (4). Typecheck clean.

## Files

- `src/sim/modules/world/worldModule.ts`
- `tests/sim/phase83.rumourPruning.test.ts` (new)
- `docs/ISSUE_TRACKER.md`
