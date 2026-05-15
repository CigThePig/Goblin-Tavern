# Phase 71 — Cook tier grow + preparation gating (ISSUE-031)

Implements ISSUE-031 per `docs/ISSUE_TRACKER.md` and the locked design
contract at `docs/plans/rare-ingredients-economy.md` (sections §4.3,
§6.5).

This phase finishes the preparation half of the rare-ingredient loop:
recipes have `prepDifficulty`; cooks have `skill`; serving compares
the two and produces excellent / ordinary / botched outcomes.

## Scope

- Add 3 new staff role definitions to `staffRegistry`:
  `kitchen_hand` (low skill ~30), `seasoned_cook` (mid skill ~62),
  `master_chef` (high skill ~85). Each has an identity profile in
  `staffIdentityProfiles.ts`.
- Each new role gets `seedOnDayZero: false` so `createInitialStaff`
  skips them. Players hire them via the existing `hire_staff` action
  (or via direct world manipulation for tests).
- Extend `StaffRoleDefinition` with optional `seedOnDayZero` field
  (default true).
- Soft-gate prep check in `sellRecipe`:
  - `skill > prepDifficulty + 15` → excellent — bonus served quality
    + `excellent_preparation` memory.
  - `skill < prepDifficulty - 15` → botched — penalty served quality
    + `botched_preparation` memory with `gap` severity.
  - In margin → ordinary — no bonus, no memory.
- The active cook for the gate check: highest-skill staff whose role
  is in the cook-tier set (`cook`, `kitchen_hand`, `seasoned_cook`,
  `master_chef`). If no cook is present, default to skill 30 (so
  unstaffed kitchens botch even uncommon recipes).
- Wire the renown drift hook points from phase 67:
  - +drift on excellent prep of rare+ (already happens at recipe
    serve via the per-serving bump; phase 71 adds an extra bump on
    excellent prep).
  - −drift on botched prep of rare+ (negative drift bracket
    referenced in §6.6).

## Critical files

- `src/sim/registries/staffRegistry.ts` — three new role
  definitions with `seedOnDayZero: false`.
- `src/sim/content/staff/staffIdentityProfiles.ts` — three new
  identity profiles, each tied to a new role.
- `src/sim/state/defaults.ts` — `createInitialStaff` skips roles
  with `seedOnDayZero === false`.
- `src/sim/modules/service/recipes.ts` — prep-gate check + memory
  writes + extra renown drift on excellent rare+ / botched rare+.
- `tests/sim/phase71.cookSkill.test.ts` — **NEW.**

## Test approach (ISSUE-031 verification)

- A kitchen_hand cook attempting a rare recipe produces a
  `botched_preparation` memory and a quality penalty.
- A master_chef cook on the same recipe produces an
  `excellent_preparation` memory and a quality bonus.
- An ordinary (in-margin) skill produces no memory and no quality
  modulation.
- Renown drifts up on excellent rare+, down on botched rare+.
- New role definitions exist with `seedOnDayZero: false` and don't
  appear in default `state.staff`.

## Out of scope (do not do)

- The forager_cook role — design doc §6.5 lists 4 roles, but for
  phase 71 the spoilage-reduction wiring duplicates phase 73's area
  spoilageModifier work. Keep the trio simple and revisit if needed.
- Actually serving multi-cook handoffs / kitchen routing — phase 71
  picks the highest-skill cook.
- Customer-facing salePrice modulation by served quality — the
  served-quality concept is computed for memory writes but does not
  yet modulate the recipe's basePrice.

## Notes

- Per the design doc §4.3, "soft gating" means the action still
  happens; we record why it went badly. A kitchen_hand attempting a
  legendary recipe still serves (the dish gets served, the
  customers still get fed), but quality penalty + botched memory
  reflect the screw-up.
- Quality penalty on botched: scale by gap (e.g. `gap = |skill -
  prepDifficulty|`; quality penalty = `-min(20, gap * 0.5)`).
- Quality bonus on excellent: cap at +20.
