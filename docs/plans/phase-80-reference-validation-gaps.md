# Phase 80 — Reference validation gaps (ISSUE-040)

See `docs/ISSUE_TRACKER.md` ISSUE-040 for full evidence and impact.

## Context

Two dangling-reference shapes were not validated:

- `staff.identity.cultureId` — the optional pointer was not checked
  against `state.world.cultures`. A staff member could keep a
  dangling culture id indefinitely (e.g. a culture removed from the
  registry between saves).
- `hireableAdventurer.currentExpeditionId` — the forward edge from
  active expeditions to adventurers was validated; the reverse was
  not. A double-resolve, an exception during `applyResolution`, or
  a save-game with mismatched data would strand an adventurer
  claiming to be on a nonexistent expedition.

Both produced silent null lookups at runtime instead of validation
failures.

## Implementation

`src/sim/state/referenceValidation.ts`:
- New staff loop iterates `state.staff` and, when
  `staff.identity?.cultureId` is set, asserts membership in
  `state.world.cultures`. Error code `unknown_culture_ref`, path
  `staff.{id}.identity.cultureId`.
- Precompute `activeExpeditionIds = new Set(state.expeditions.active
  .map((e) => e.id))` once, then for each adventurer with
  `currentExpeditionId !== null`, assert the id is in that set.
  Error code `dangling_expedition_ref`, path
  `world.hireableAdventurers.{id}.currentExpeditionId`.

## Verification

`tests/sim/phase80.referenceValidationGaps.test.ts` (new, 5 tests):
- staff with a dangling cultureId fails validation;
- a valid cultureId passes;
- adventurer with `currentExpeditionId: 'exp_999'` (no matching
  active expedition) fails the reverse-edge check;
- a consistent runner ↔ active expedition pair passes;
- the canonical starter state has no new dangling references
  (regression guard).

Adjacent suites still green: `phase26.expandedValidation` (17),
`phase6.validation` (22). Typecheck clean.

## Files

- `src/sim/state/referenceValidation.ts`
- `tests/sim/phase80.referenceValidationGaps.test.ts` (new)
- `docs/ISSUE_TRACKER.md`
