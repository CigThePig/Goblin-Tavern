# Tier 2 follow-ups (post phase 53–59)

Notes captured during the Tier 2 implementation pass that didn't
warrant blocking the merge but are worth picking up later.

## Phase 20 (cardlessPlaytest) — RAM growth on long-running suites

The `tests/sim/phase20.cardlessPlaytest.test.ts` file calls
`runMonths(1)` / `runMonths(2)` several times in series. On this
environment a single vitest run of that file climbs from ~1 GB to
~6+ GB of RSS, sometimes hitting the OOM killer before the file
finishes.

- Reproduced on `claude/tier-2-features-idWqx` AND on `da6f549` (the
  pre-Tier-2 main HEAD). The behaviour predates this phase.
- Individual Tier 2 phase tests (`phase53.policyBacklash`,
  `phase54.regularCustomer`, `phase55.reputationShift`,
  `phase56.violence`, `phase57.staffBurnout`,
  `phase58.inspectionRotation`, `phase59.monthlyReview`) all pass
  cleanly on their own, and the full vitest run reaches the rest of
  the suite (≈ 50 test files pass before the OOM zone).

## Phase 40 (expandedReadiness) — long runtime

`phase40.expandedReadiness.test.ts` runs multiple `runMonths(1)` /
`runMonths(2)` calls plus an 84-day pipeline scenario. It is slow
(several minutes per run) but does complete on its own. The
non-runMonths subset (identity richness, memory quality,
attribution quality scorers) runs in under 3s.

## Suggested follow-up

- Profile `runMonths` for state growth — likely candidates are
  arrays that accumulate without pruning across days
  (`state.causes`, `state.memories`, the responses pending queue,
  the `recentPicks` map this phase added but with one entry per
  family/entity pair the additional growth is bounded).
- Consider running `phase20` and `phase40` in their own vitest
  pools (`vitest --pool=forks --poolOptions.forks.isolate=true`
  drops per-test heap retention).
- ISSUE-022 (history log pruning policy) and ISSUE-023 (RNG stream
  prune or wire) in the tracker may share root causes with the
  pattern of unbounded slice growth.

## Tier 2 acceptance summary

All 7 ISSUE-NNN entries are marked `done` in `docs/ISSUE_TRACKER.md`
with their phase number assigned. Per-phase test files were verified
locally:

| Phase | Test file | Result |
|---|---|---|
| 53 | `tests/sim/phase53.policyBacklash.test.ts` | 10/10 pass |
| 54 | `tests/sim/phase54.regularCustomer.test.ts` | 9/9 pass |
| 55 | `tests/sim/phase55.reputationShift.test.ts` | 6/6 pass |
| 56 | `tests/sim/phase56.violence.test.ts` | 6/6 pass |
| 57 | `tests/sim/phase57.staffBurnout.test.ts` | 6/6 pass |
| 58 | `tests/sim/phase58.inspectionRotation.test.ts` | 3/3 pass |
| 59 | `tests/sim/phase59.monthlyReview.test.ts` | 8/8 pass |

`npm run typecheck` passes clean. Existing Tier 0/1 tests that
exercise the same families (`phase19`, `phase37`, `phase39`,
`phase41`, `phase42`, `phase43`, `phase44`, `phase50`, `phase51`,
`phase52`, plus the broader phase 11/13/15/17/18/27/28/29/30/31/32/33/34/35/36/38/65/66/67/70/71/72/73)
all passed in the partial full-suite run before the run hit the
phase 20 memory issue.
