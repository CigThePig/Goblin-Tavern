# Phase 75 — Diff coverage for recipes / expeditions / hireableAdventurers (ISSUE-035)

See `docs/ISSUE_TRACKER.md` ISSUE-035 for full evidence and impact.

## Context

`createStateDiff` walks coin / areas / stock / staff / customers /
reputation / pressures / memories / world.* / modules. Three top-level
slices that are actively mutated by the production pipeline were
silently absent:

- `state.recipes` — mutated by `ctx.modifyRecipe` (Phase 65).
- `state.expeditions` — mutated by the expeditions module commission /
  resolution paths (Phase 70).
- `state.world.hireableAdventurers` — mutated by
  `ctx.modifyHireableAdventurer` (Phase 69).

Without diff walks, the Phase-42 cause-coverage audit ("unexplained
significant changes") cannot flag a mutation on these slices that
lands without a matching cause.

## Implementation

`src/sim/core/diff.ts`:
- Add `diffRecipes` — per-id walk; surface only `onMenu` boolean flips.
  `timesServed` / `daysSinceLastServed` / `lastServedDay` are per-day
  counters and timestamps; treating them as diff entries would flood
  the audit (same shape as how regulars' `lastSeenDay` is skipped).
- Add `diffExpeditions` — keyset diff on `active` (commissions and
  resolutions emit one change each), plus a count-delta on
  `completed.length`. `daysElapsed` and `status` are skipped for the
  same flooding/no-movement reasons.
- Add `diffHireableAdventurers` — per-id walk on `experience`,
  `reliability`, `relationship` (all 0-100 meters), plus
  `currentExpeditionId` flips. `daysSinceLastJob` increments daily and
  is skipped.
- Add `hireableAdventurers.` to `isMeterPath` so the significance
  filter applies the meter threshold (5) to those changes.
- Wire all three walkers into `createStateDiff` after the existing
  world-slice walks; module diff stays last so module-internal writes
  remain the audit's catch-all.

## Verification

`tests/sim/phase75.tier3DiffCoverage.test.ts` — 6 tests covering:
- recipe `onMenu` flip surfaces with the right path and lands in
  `significantChanges` (non-numeric → always significant);
- counter-only recipe changes do *not* flood the diff;
- expedition commission and resolution emit keyset flip entries with
  `commissioned` / `resolved` tags;
- `completed.count` delta emits on resolution;
- hireable adventurer meter + assignment changes surface on the right
  paths;
- meter significance threshold (5) drops a +2 reliability change but
  keeps a +15 experience change.

Existing `tests/sim/phase42.worldDiffCoverage.test.ts` stays green.

## Files

- `src/sim/core/diff.ts`
- `tests/sim/phase75.tier3DiffCoverage.test.ts` (new)
- `docs/ISSUE_TRACKER.md`
