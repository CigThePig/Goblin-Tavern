# Phase 138 — Voiced Surface arc, Phase 12: Crises & Safety cluster

**ISSUE-107.** Sixth Movement II migration of the [Voiced Surface arc](voiced-surface-arc.md). Reads the arc's per-cluster standing prompt; runs the Phase-4 ([ISSUE-099 / phase 130](../ISSUE_TRACKER.md)) authoring loop end-to-end on the `food_safety`, `violence`, `inspection` card surface.

---

## Context

Three issue-seed families render through legacy paths today:

| Family | Current handler | Primary actor | Location | Generator timing |
|---|---|---|---|---|
| `food_safety` / `crisis` | `src/cards/templates/foodSafetyCrisis.ts` (hand-written, `minSeverity: 60`) | `cook ? staffRef(cook.id) : undefined` (`issueSeedGenerators.ts:331`) | `areaRef('kitchen')` (`:330`) | `morning_prep` (`:326`) |
| `violence` / `customer_incident` | `fallbackCard` (no dedicated template) | `customerRef(target.id)` — picker-rotated across rowdy/dangerous/incident-prone groups (`:2117-2144`) | `pickCustomerFacingArea(ctx, 'violence')` (`:2343`) | `during_service` (`:2338`) |
| `inspection` / `inspection_threat` | `fallbackCard` (no dedicated template) | notable NPC → faction (un-pinned per ISSUE-018) → `systemRef('inspector')` (`:2704-2711`) | `pickCustomerFacingArea(ctx, 'inspection')` (`:3233`) | `morning_prep` (`:3227`) |

`foodSafetyCrisis.ts:32-50` lifts `ti.subject` + `ti.sensoryDetails[0]` + `ti.recentContext[0]` + `ti.stakesReadable[0]` through `composeBody` / `composeTitle` with a `pickSeverityAdjective` prefix — the high-severity fragment-dump-with-adjective-glue pattern the arc is built to retire. `violence` and `inspection` seeds surface through `fallbackCard`: no dedicated rendering at all. The original Voiced Surface broken-screenshot audit named the crisis register most loudly; Phase 12 closes it.

The legacy template's `appliesTo.timings: ['during_service']` (`foodSafetyCrisis.ts:27`) mismatches the generator's emit timing (`morning_prep`). Phase 12 takes the opportunity to align template timings to what the generators emit.

---

## Movement I loopback — one new band signal

`customer_group.rowdiness` — Phase 134 banded satisfaction + loyalty, but the meter that *triggers* a `violence.customer_incident` seed is `customerGroup.rowdiness` (the violence picker scores `patronage + rowdiness` at `issueSeedGenerators.ts:2128`). Without a band on rowdiness the violence establishing line could only anchor on `pressureRising violence` and `customer_group.satisfaction` — neither states the triggering meter. With the band the line names the room's actual temperature ("the dwarves are seething tonight").

One additive entry in `src/sim/signals/`:

| Signal | Reads | Entity kind | Thresholds |
|---|---|---|---|
| `customer_group.rowdiness` | `state.customerGroups[id].rowdiness` | `customer_group` | `[40, 70]` |

Three-tier `low` / `mid` / `high`; mechanical wiring mirrors the existing customer-group bands across `types.ts`, `bands.ts`, `numeric.ts`, `query.ts`, `index.ts`.

No new bands for food_safety or inspection. Both anchor on existing signals: food_safety uses `area.cleanliness` + `area.damage` (kitchen area) plus `staff.stress` / `staff.fatigue` (cook); inspection uses `faction.relationship` / `faction.influence` (the inspecting faction) and `area.cleanliness` / `area.condition` (the inspected location). Plus the four primitives (`pressureRising`, `memoryPresent`, `repeatCount`, `hasTag`, `severityAtLeast`).

No new condition primitives. No new `resolveActorRef` role strings.

---

## Scope delivered

### Spec changes (design records)

- **New** `specs/cards/food_safety.spec.yaml` — full Phase-12 spec for the cook-voiced food-safety case.
- **New** `specs/cards/violence.spec.yaml` — full Phase-12 spec for the customer-group-voiced violence case.
- **New** `specs/cards/inspection.spec.yaml` — full Phase-12 spec for the faction-voiced / notable-NPC-voiced inspection case.

### Sim-layer changes

- **Modified** `src/sim/signals/types.ts`, `bands.ts`, `numeric.ts`, `query.ts`, `index.ts` — one new band signal added with no behaviour change to existing ones.

### Code changes — templates

- **Rewritten in place** `src/cards/templates/foodSafetyCrisis.ts` — switches from the hand-written `composeBody` to a compositional template. Template id `food_safety.crisis` (unchanged structurally), priority 80, voice register `back_of_house`. Custom predicate insists the resolved cook carries `castAttributes`; graceful fallback to `fallbackCard` when absent.
- **New** `src/cards/templates/violence.ts` — `violenceTemplate` + `violenceCard`. Template id `violence.customer_incident`, priority 75, voice register `tavern_floor`. Custom predicate requires the resolved customer group with `castAttributes`.
- **New** `src/cards/templates/inspection.ts` — `inspectionTemplate` + `inspectionCard`. Template id `inspection.inspection_threat`, priority 75, voice register `civic_floor`. Custom predicate accepts `faction` OR `notable_npc` kind with `castAttributes`; explicitly rejects `system` kind so the seeded `systemRef('inspector')` fallback falls through to `fallbackCard`.

### Code changes — pools

- **New** `src/cards/compose/pools/foodSafety/{title,establishingLine,reactionLine,mannerNote,choiceLabel,effectPreview,index}.ts`.
- **New** `src/cards/compose/pools/violence/{title,establishingLine,reactionLine,mannerNote,choiceLabel,effectPreview,index}.ts`.
- **New** `src/cards/compose/pools/inspection/{title,establishingLine,reactionLine,mannerNote,choiceLabel,effectPreview,index}.ts`.

### Code changes — wiring

- **Modified** `src/cards/templates/index.ts` — added `violenceCard` and `inspectionCard` to imports, `REQUIRED_CARDS`, and the re-export block; the existing `foodSafetyCrisisCard` re-export now points at the new compositional template.
- **Modified** `src/cards/index.ts` — re-exported `violenceCard` and `inspectionCard` alongside the existing `foodSafetyCrisisCard` re-export.

### Test changes

- **New** `tests/cards/templates.foodSafety.test.ts` — ~17 tests mirroring `tests/cards/templates.maintenance.test.ts` shape (`appliesTo` matching, render output, mechanical-truth preservation, determinism, non-mutation, graceful degradation when cook role absent).
- **New** `tests/cards/templates.violence.test.ts` — ~16 tests, customer-group actor.
- **New** `tests/cards/templates.inspection.test.ts` — ~17 tests, faction or notable_npc actor. Includes an explicit test that `systemRef('inspector')` does NOT match (falls to fallback).
- **Modified** `tests/cards/templates.test.ts` — the legacy `Template 1 — foodSafetyCrisisCard` block stays but is rewritten for the compositional output (no raw `ti.sensoryDetails[0]` in body); add new Template 1b (violence) + 1c (inspection) blocks alongside.
- **Modified** `tests/cards/templates.voice.test.ts` — the legacy `foodSafetyCrisisCard voice` block splits into three (one per new template), each asserting no raw `${severityAdjective} ${subject}` mechanical adjective glue and that the rendered title contains no `…` and no immediate duplicated token.
- **Modified** `tests/cards/compose/gates/samplers.ts` — six new exported sampler families:
  - `buildFoodSafetyDeterminismSamples` / `buildFoodSafetyDiversitySampler` — actor-perturbation across cook's `[-1, 0, 0, 1]` voice axis distribution × state perturbation.
  - `buildViolenceDeterminismSamples` / `buildViolenceDiversitySampler` — actor-perturbation across customer-group voice × state perturbation (rowdiness band + damage band + pressure + memories + severity).
  - `buildInspectionDeterminismSamples` / `buildInspectionDiversitySampler` — actor-perturbation across faction voice × state perturbation.
  - Six Phase-6 context builders rotating each template's response-slot roster (food_safety: 4 slots; violence: 4; inspection: 9 — the largest verb roster in the codebase).
- **Modified** `tests/cards/compose/gates/runAllGates.test.ts` — three new template-integration blocks + three new ad-hoc choice-pool blocks (all seven gates green per template, mirroring Phase 11). diversity `minDistinct` floors: title 3, establishing_line 1, reaction_line 3, manner_note 2.
- **Modified** `tests/sim/phase127.signals.numeric.test.ts` — boundary tests for the new `customer_group.rowdiness` band reader + dispatcher tests for the new (signal, kind) pair.

---

## Out of scope (explicit)

- Reports tab, tavern log, weekly review prose for food_safety / violence / inspection → Phases 14 / 15 / 16.
- Reputation/rumour/rival migrations → Phase 13.
- Touching `voice/composer.ts` or `voice/tonePools.ts` → Phase 16 retires them globally.
- Adding signal bands beyond `customer_group.rowdiness` — out of scope for Phase 12.
- New condition primitives or new `resolveActorRef` role strings.
- Changes to the three seed generators (`generateFoodSafety`, `generateViolence`, `generateInspection`) — mechanical truth (severity, response slots, consequence profiles, future hooks) is unchanged; only wording is composed.
- A `systemRef('inspector')` fallback voicing for inspection — when the predicate fails the card falls through to `fallbackCard` (intentional, matches every other actor-voiced template).
- Voice register churn — three existing registers (`back_of_house`, `tavern_floor`, `civic_floor`) cover the cluster.

---

## Verification

- `npm test -- --run tests/cards/templates.foodSafety.test.ts` — ~17 tests.
- `npm test -- --run tests/cards/templates.violence.test.ts` — ~16 tests.
- `npm test -- --run tests/cards/templates.inspection.test.ts` — ~17 tests.
- `npm test -- --run tests/cards/compose/gates/runAllGates.test.ts` — template + choice integration blocks.
- `npm test -- --run tests/sim/phase127.signals.numeric.test.ts` — rowdiness band boundary tests.
- `npm test -- --run tests/cards/templates.test.ts tests/cards/templates.voice.test.ts` — split block updates.
- `npm run typecheck` — clean.
- `npm test -- --run` — full regression green.
- Structural: `grep -rn 'composeBody\|composeTitle' src/cards/templates/foodSafetyCrisis.ts src/cards/templates/violence.ts src/cards/templates/inspection.ts` returns nothing.
