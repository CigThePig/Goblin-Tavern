# Phase 78 — Cook tier modulates foodQualityModifier (ISSUE-038)

See `docs/ISSUE_TRACKER.md` ISSUE-038 for full evidence and impact.

## Context

`derivePriorityModifiers` built the daily `foodQualityModifier` from
`currentPriority` + `workStyle` + `stressResponse`. The staff
member's `role` and `skill` fields were not read, so a master_chef
on `quality` priority and a kitchen_hand on `quality` priority
produced the same modifier. The cook hierarchy added in Phase 71
only mattered at the per-recipe prep gate; the daily satisfaction
loop was role-agnostic.

## Implementation

`src/sim/modules/staff/priorityEffects.ts`:
- New `COOK_ROLE_IDS` set (`cook`, `kitchen_hand`, `seasoned_cook`,
  `master_chef`) and `SERVER_ROLE_IDS` (`server`).
- `skillBias(skill) = (skill - 50) / 200`. Monotonic; bounded ±0.25
  across the full 0-100 skill range; ~+0.025 at the canonical
  cook (55), +0.175 at master_chef (85), -0.10 at kitchen_hand (30).
- Inside the per-staff loop in `derivePriorityModifiers`, layer
  `scaleByEffectiveness(skillBias(skill), eff)` onto
  `foodQualityModifier` for cook-family roles and `serviceSpeed`
  for the server role.
- Routed through `scaleByEffectiveness` so morale/stress/fatigue
  still suppress the bias — a high-stress master_chef contributes
  less than a calm one.

## Verification

`tests/sim/phase78.cookSkillModulation.test.ts` (new, 5 tests):
- master_chef@85 > kitchen_hand@30 on foodQualityModifier;
- cook-family roles produce a monotonic foodQualityModifier in skill
  across the full range, with an end-to-end spread > 0.2;
- non-cook roles are unaffected by the cook bias;
- server role gets a skill bias on serviceSpeed;
- high stress dampens the master_chef's lead.

Adjacent suites still green: `phase71.cookSkill` (11),
`phase11.staff` (32), `phase12.service` (25).

## Files

- `src/sim/modules/staff/priorityEffects.ts`
- `tests/sim/phase78.cookSkillModulation.test.ts` (new)
- `docs/ISSUE_TRACKER.md`
