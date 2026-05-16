# Phase 86 — Staff-management owner actions (ISSUE-046)

See `docs/ISSUE_TRACKER.md` ISSUE-046 for full evidence and impact.
Depends on Phase 81 / ISSUE-041 (wider staff identity profile pool)
to keep new hires out of goblin/human/dwarf monoculture.

## Context

The owner-action registry shipped 11 actions before this phase, none
of which could add or remove staff members or refuse service to a
customer group. Several systems already assumed the player could act
on staff problems (staff burnout, staff loyalty meter, wage
settlement, cook tier progression from ISSUE-031) but the only
response to a quitting staff member was nothing. Same on the
customer side — no eject lever for low-tolerance groups.

## Implementation

`src/sim/core/context.ts` and `src/sim/core/engine.ts`:
- New `addStaff(staff, meta)` and `removeStaff(id, meta)` ctx
  mutators. Mirrors the adventurer add/remove pair: `addStaff`
  rejects duplicate ids, `removeStaff` no-ops on unknown ids, both
  emit a cause with `targetType: 'staff'`.

`src/sim/modules/ownerActions/staffManagementActions.ts` (new):
- `hire_staff` (cost 40 coin, action point 1) — pick a role id from
  the staff registry, charge the placement fee via `spendCoin`, run
  `createStaffIdentity` against the `staff_identity` RNG stream
  (using the wider Phase 81 pool, optionally biased by
  `input.options.preferredCultureId`), append the new entry via
  `addStaff`, drop a `staff_hired` memory.
- `fire_staff` (action point 1) — target a staff id, validate it
  exists and isn't the last remaining member, drop every remaining
  staff member's morale by 5, remove via `removeStaff`, drop a
  `staff_fired` memory.
- `ban_customer_group` (action point 1) — target a customer-group
  id, drop patronage to 0, drop loyalty by 10, add `'banned'` to
  the group's `tags`, charge `respectable -3` reputation, drop a
  `customer_group_banned` memory.

`src/sim/modules/ownerActions/actionDefinitions.ts`:
- Import `STAFF_MANAGEMENT_ACTIONS` and spread into
  `REQUIRED_OWNER_ACTIONS` so the action-registry bootstrap path
  picks them up.

All three actions route causes / memories / mutations through the
ISSUE-001 response-pipeline contract (every state-changing path
goes through `ctx.modify*` or the new `addStaff` / `removeStaff`,
which emit attributed causes).

## Verification

`tests/sim/phase86.staffManagementActions.test.ts` (new, 7 tests):
- registry contains all three new action ids;
- `hire_staff` appends a new staff record with a generated identity
  and the right role;
- `hire_staff` rejects when coin < `HIRE_STAFF_COST`;
- `fire_staff` removes the target and drops remaining staff morale;
- `fire_staff.canApply` rejects firing the last staff member;
- `ban_customer_group` zeros patronage, hits loyalty by 10, tags
  the group `'banned'`, and drops `respectable` by `BAN_REPUTATION_COST`;
- `ban_customer_group` rejects unknown group ids (no group is
  suppressed).

Adjacent suites still green: `phase11.staff` (32),
`phase13.ownerActions` (33), `phase81.staffIdentityCoverage` (7).
Typecheck clean.

## Files

- `src/sim/core/context.ts` (addStaff / removeStaff declarations)
- `src/sim/core/engine.ts` (implementations)
- `src/sim/modules/ownerActions/staffManagementActions.ts` (new)
- `src/sim/modules/ownerActions/actionDefinitions.ts` (registration)
- `tests/sim/phase86.staffManagementActions.test.ts` (new)
- `docs/ISSUE_TRACKER.md`
