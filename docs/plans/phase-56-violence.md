# Phase 56 — `violence` family rewrite + rotation (ISSUE-016)

This phase delivers the work tracked as `ISSUE-016` in
[`docs/ISSUE_TRACKER.md`](../ISSUE_TRACKER.md). See the tracker entry
for the full evidence, impact, scope, and test approach.

## What changed

Pre-phase the `violence` family had:

1. **No rotation.** The picker hardcoded a binary
   `ogres.patronage > adventurers.patronage ? ogres : adventurers`
   target. Only those two groups could trigger.
2. **Flat profiles.** All 4 consequence profiles were immediate-only
   with `delayedEffects: []` and `futureHooks: []`. Total temporal
   weight across the family: 0 delayed + 1 seed-level future hook.

### `src/sim/modules/issues/issueSeedGenerators.ts`

Picker rewrite: enumerate all customer groups carrying `rowdy`,
`dangerous`, or `incident_prone` tags. Score by
`(patronage + rowdiness)` minus a 7-day recency penalty of 35. Pick
the highest scoring. Falls back to the previous binary
ogres-vs-adventurers behaviour if no group carries the relevant tags
(preserves the existing test in `phase19.issueSeeds.test.ts:237`).

The customer registry (`src/sim/registries/customerRegistry.ts`)
provides the candidate pool: `miners` (rowdy), `ogres`
(rowdy+dangerous+incident_prone), `adventurers`
(dangerous+incident_prone). The ISSUE-032 niche groups
(`gourmand`, `food_critic`, `foreign_envoy`, `eccentric_noble`)
don't carry violence tags so they correctly stay out of rotation.

Profile rewrites:
- `hire_security_profile`: immediate coin -20, violence -15; delayed
  staff_burnout +4 (delay:5); futureHook security_routine_possible
  (14d).
- `ban_group_profile`: immediate target.patronage -25, violence -12,
  cause on target -20; delayed futureHook banned_group_returns
  (14d).
- `embrace_rowdy_profile`: immediate dangerous +6, respectable -4;
  delayed merchants.patronage -8 (delay:5); futureHook
  dangerous_rep_locked (10d).
- `repair_damage_profile`: immediate main_room.damage -20, coin -12;
  delayed staff_burnout +3 (delay:3); futureHook main_room_resilient
  (10d).

## Tests

`tests/sim/phase56.violence.test.ts` covers:

1. Rotation: a state with `ogres`, `adventurers`, and `miners` all at
   elevated rowdiness — the picker selects a different group across
   consecutive days, surfacing ≥ 2 distinct primary actors over 14
   days.
2. Per-slot mutation distinctness via treatment-vs-control.
3. Every slot enqueues at least one pending entry (delayedEffect /
   futureHook).

## Verification

- `npx vitest run tests/sim/phase56.violence.test.ts` — passes.
- `npm run typecheck` — passes.
- `phase19.issueSeeds.test.ts:237` still passes (the high-violence
  fallback path is preserved).

## Out of scope

- Threshold tuning on the violence pressure calculator. The family
  still gates on `pressure.value >= 35`.
- Adding new customer groups. Picker enumerates the existing roster.
