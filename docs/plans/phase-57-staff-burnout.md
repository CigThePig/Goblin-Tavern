# Phase 57 — `staff_burnout` family rewrite + rotation (ISSUE-017)

This phase delivers the work tracked as `ISSUE-017` in
[`docs/ISSUE_TRACKER.md`](../ISSUE_TRACKER.md). See the tracker entry
for the full evidence, impact, scope, and test approach.

## What changed

Pre-phase the `staff_burnout` family had:

1. **No rotation.** The picker hardcoded the single
   highest-`stress+fatigue` staff member every day, so the same person
   dominated the family for the duration of their burnout window.
2. **Thin profiles.** Only `push_through_profile` carried both a
   delayedEffect and a futureHook. The other three were
   immediate-only.

### `src/sim/modules/issues/issueSeedGenerators.ts`

Picker rewrite: enumerate staff whose `stress + fatigue > 60`. Score
by `(stress + fatigue)` minus a 5-day recency penalty of 30. Pick the
highest scoring. Falls back to the previous single-highest behaviour
when nobody crosses the threshold (so the family still fires on small
staff sets / early-game states).

Cross-staff support: pick a second staff member (`otherStaff`) for
the `reduce_workload` and `reassign` profiles to redistribute
fatigue against. Falls back to `worst` when only one staff exists.

Profile rewrites:
- `pay_bonus_profile`: immediate morale +15, stress -10, coin -15;
  delayed `pressure:debt` +3 (delay:5); futureHook
  `staff_bonus_expected_${worst.id}` (30d, tied to the picked staff).
- `reduce_workload_profile`: immediate fatigue -15, stress -10;
  delayed `staff.${otherStaff.id}.fatigue` +6 (delay:3) — coverage
  gap lands on another staff member; futureHook
  `coverage_gap_${worst.id}` (7d).
- `push_through_profile`: preserves existing delayed +8 pressure;
  futureHook id is now `staff_quit_risk_${worst.id}` instead of the
  generic `staff_quit_risk_possible` so each instance binds to a
  specific actor.
- `reassign_profile`: immediate stress -8 plus `staff.${otherStaff.id}.fatigue`
  +6 (cross-staff redistribution); delayed `pressure:staff_burnout`
  +3 (delay:5); futureHook `cross_staff_grumble_${otherStaff.id}`
  (10d).

## Tests

`tests/sim/phase57.staffBurnout.test.ts` covers:

1. Rotation across multiple staff above the stress+fatigue threshold.
2. Per-slot mutation distinctness via treatment-vs-control.
3. Every slot enqueues at least one pending entry.
4. The `reduce_workload` and `reassign` profiles produce cross-staff
   fatigue mutations on `otherStaff` (not just on `worst`).

## Verification

- `npx vitest run tests/sim/phase57.staffBurnout.test.ts` — passes.
- `npm run typecheck` — passes.
- `phase19.issueSeeds.test.ts:209` (staff burnout test) still passes —
  the single-staff fallback preserves the old behaviour.

## Out of scope

- Cook tier integration. ISSUE-031 / phase 71 already wired cook tiers
  + preparation gating; burnout effects on cook fatigue still flow
  through the same `staff.${id}.fatigue` path.
