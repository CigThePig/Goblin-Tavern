# Phase 55 — `reputation_shift` family rewrite (ISSUE-015)

This phase delivers the work tracked as `ISSUE-015` in
[`docs/ISSUE_TRACKER.md`](../ISSUE_TRACKER.md). See the tracker entry
for the full evidence, impact, scope, and test approach.

## What changed

Pre-phase the `reputation_shift` family had two problems:

1. **No rotation.** The picker always selected the single reputation
   axis with the highest `|value - 50|`, so the same axis (typically
   `goblinAuthentic` or `respectable` at game start) dominated every
   day the family fired.
2. **Profile depth.** All four consequence profiles were flat
   immediate-only — zero `delayedEffects` across the family, and only
   one `futureHook` (`identity_lock_in_possible`) at the seed level
   total. Picking a response slot produced an immediate reputation
   bump with no temporal weight.

### `src/sim/modules/issues/issueSeedGenerators.ts`

- Add a local `reputationRecencyPenalty` + `recordReputationPick`
  helper (mirrors the existing `complaintRecencyPenalty` /
  `recordComplaintPick` pattern in `customer_complaint`). Window of
  5 days, penalty of 18 — enough to rotate across the top-2 / top-3
  axes when they're within ~18 points of each other.
- Score every axis by `|value - 50| - penalty`; pick the highest
  scoring after penalty. Still require the underlying base score
  (without penalty) to clear 15 so the family doesn't fire on flat
  reputations.
- `recordReputationPick` after selection.
- Rewrite all 4 consequence profiles to include `delayedEffects` and
  `futureHooks`:
  - `embrace_profile`: immediate `reputation.${axisId}` +5; delayed
    `reputation.${axisId}` +3 (delay:7) — drift continues across the
    week; futureHook `identity_lock_in_${axisId}` (in 14 days).
  - `correct_profile`: immediate `reputation.${axisId}` -5, `coin`
    -10; delayed `reputation.${axisId}` -3 (delay:5); futureHook
    `identity_correction_${axisId}` (in 10 days).
  - `advertise_profile`: immediate `customers.miners.patronage` +8;
    delayed `pressure:reputation_drift` +4 (delay:5) — targeted
    advertising deepens drift; futureHook `audience_lock_${axisId}`
    (in 10 days).
  - `diversify_profile`: immediate `reputation.${axisId}` -3,
    `customers.merchants.patronage` +4 (broaden); delayed
    `pressure:rumour_pressure` +3 (delay:5) — mixed messages breed
    gossip; futureHook `audience_dilution_${axisId}` (in 12 days).

## Tests

`tests/sim/phase55.reputationShift.test.ts` covers:

1. Rotation: a state with two reputation axes far off-neutral
   (e.g. `respectable=20`, `dangerous=85`) — the family rotates across
   the two axes over a 14-day window.
2. Per-slot delayedEffects: each of the 4 slots produces a pending
   entry that lands on its `scheduledFor` day.
3. Per-slot mutation distinctness via treatment-vs-control:
   `embrace` raises the axis, `correct` lowers it AND lowers coin,
   `advertise` raises miners patronage, `diversify` lowers axis AND
   raises merchants patronage.

## Verification

- `npx vitest run tests/sim/phase55.reputationShift.test.ts` — passes.
- `npm run typecheck` — passes (no new errors in the file scope).
- Existing `phase19.issueSeeds.test.ts:277` reputation_shift case
  still triggers because the picker still fires on a single strongly
  off-neutral axis when no recency history exists.

## Out of scope

- Cross-family rotation. The recency state lives in
  `state.modules.issueSeeds.recentPicks` keyed by family — this
  family's rotation does not affect any other family's picks.
- Adding new reputation axes. Picking rotates across the existing
  Phase 5 / Phase 67 axes (cheap, tasty, filthy, dangerous, cozy,
  strange, reliable, goblinAuthentic, respectable, culinary_renown).
