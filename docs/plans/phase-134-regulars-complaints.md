# Phase 134 — Voiced Surface arc, Phase 8: Regulars & Complaints cluster

**ISSUE-103.** Second Movement II migration of the [Voiced Surface arc](voiced-surface-arc.md). Reads the arc's per-cluster standing prompt; runs the Phase-4 ([ISSUE-099](../ISSUE_TRACKER.md#issue-099--voiced-surface-phase-4-retire-the-build-time-api-pipeline-document-the-claude-code-authoring-loop)) authoring loop end-to-end on the regulars-and-complaints card surface.

---

## Context

The legacy `src/cards/templates/customerComplaint.ts` hand-handled **two seed families** through one template:

| Family | Type | Timing | Whose voice? |
|---|---|---|---|
| `regular_customer` | `complaint` | `during_service` | a specific named regular |
| `customer_complaint` | `complaint` | `during_service` | a customer-group cohort |

It composed by lifting raw `textIngredients`: `title = formatTitle(${display}: ${problemNoun})`, `body = [actorOpinions[firstKey] ?? sensoryDetails[0], relevantMemories[0], recentContext[0]]`. No voice, no sim-backed claims, no specificity gradient. Choices came from `buildChoicesFromSeed` with bare `slot.labelHint` (the Phase-6 helper wasn't wired). The exact "fragment-dump" pattern the Voiced Surface arc is killing.

A second structural problem the migration fixes: the legacy template's name-resolver always looked for a regular in `namedEntities`, so the cohort case (`customer_complaint`) defaulted to "A patron" — the card could not even centre on its own subject.

Two templates partition the surface cleanly the way Phase 7 partitioned `staff_identity` (staffAside) vs `staff_burnout` (staffBurnout).

---

## Movement I loopback — four new band signals

Phase 127 (ISSUE-096) shipped bands for staff, faction, supplier, and area — but nothing for regulars or customer groups, even though `regular.irritation > 60` is what *triggers* a `regular_customer.complaint` seed and `group.satisfaction ≤ 60` triggers a `customer_complaint`. Without bands the establishing line could only anchor on `pressureRising` and `memoryPresent`; with bands it can state the triggering meter directly.

Four additive entries in `src/sim/signals/`:

| Signal | Reads | Entity kind |
|---|---|---|
| `regular.irritation` | `state.world.regulars[id].irritation` | `regular` |
| `regular.loyalty` | `state.world.regulars[id].loyalty` | `regular` |
| `customer_group.satisfaction` | `state.customerGroups[id].satisfaction` | `customer_group` |
| `customer_group.loyalty` | `state.customerGroups[id].loyalty` | `customer_group` |

Three-tier `low` / `mid` / `high` scheme; default-thirds thresholds `[40, 70]`. Mechanical wiring mirrors the existing staff bands across `types.ts`, `bands.ts`, `numeric.ts`, `query.ts`, `index.ts`.

---

## Scope delivered

### Spec changes (design records)

- **New** `specs/cards/regular_complaint.spec.yaml` — full Phase-8 spec for the named-regular case.
- **New** `specs/cards/customer_complaint.spec.yaml` — full Phase-8 spec for the cohort case.

### Sim-layer changes

- **Modified** `src/sim/signals/types.ts`, `bands.ts`, `numeric.ts`, `query.ts`, `index.ts` — four new band signals added with no behaviour change to existing ones.

### Code changes — templates

- **New** `src/cards/templates/regularComplaint.ts` — `regularComplaintTemplate: CompositionalCardTemplate` + `regularComplaintCard` (id `regular_customer.complaint`, priority 70, voice register `tavern_floor`, custom predicate requires a regular with `castAttributes`).
- **Deleted then recreated** `src/cards/templates/customerComplaint.ts` — same path, new compositional contents. Template id `customer_complaint.complaint`, priority 70, voice register `tavern_floor`, custom predicate requires a customer-group with `castAttributes`. Title resolver reads `state.customerGroups[id].label`.

### Code changes — pools

- **New** `src/cards/compose/pools/regularComplaint/{title,establishingLine,reactionLine,mannerNote,choiceLabel,effectPreview,index}.ts`.
- **New** `src/cards/compose/pools/customerComplaint/{title,establishingLine,reactionLine,mannerNote,choiceLabel,effectPreview,index}.ts`.

### Code changes — wiring

- **Modified** `src/cards/templates/index.ts` — added `regularComplaintCard` to imports, `REQUIRED_CARDS`, and the re-export block; the existing `customerComplaintCard` re-export now points at the new compositional template.
- **Modified** `src/cards/index.ts` — re-exported `regularComplaintCard` alongside the existing `customerComplaintCard` re-export.

### Test changes

- **New** `tests/cards/templates.regularComplaint.test.ts` — 17 tests mirroring `tests/cards/templates.staffBurnout.test.ts` shape.
- **New** `tests/cards/templates.customerComplaint.test.ts` — 16 tests, cohort actor.
- **Modified** `tests/cards/templates.test.ts` — the legacy `Template 2 — customerComplaintCard` block splits into `Template 2a — customerComplaintCard (cohort case)` + `Template 2b — regularComplaintCard (named-regular case)`. The 2b block picks a 1-word starter regular so the legacy `assertTitleBudget` (≤6 words) holds against the composed `${display}: ${snippet}` title.
- **Modified** `tests/cards/templates.voice.test.ts` — the legacy `customerComplaintCard voice` block splits into two.
- **Modified** `tests/cards/templates.drinkOrder.test.ts` — the "does not steal the complaint variant" assertion now points at `regularComplaintCard`.
- **Modified** `tests/cards/compose/gates/samplers.ts` — added `buildRegularComplaintDeterminismSamples` / `buildRegularComplaintDiversitySampler` / `buildCustomerComplaintDeterminismSamples` / `buildCustomerComplaintDiversitySampler` plus four Phase-6 context builders. Each cohort context builder rotates a 5-slot verb roster so the verb-gated rungs in the pools can fire across the perturbed cast distribution.
- **Modified** `tests/cards/compose/gates/runAllGates.test.ts` — two new template integration blocks + two new ad-hoc choice-pool blocks. All seven gates green for both new templates.
- **Modified** `tests/sim/phase127.signals.numeric.test.ts` — boundary tests for the four new band readers + dispatcher tests for the new (signal, kind) pairs.

---

## Out of scope (explicit)

- Reports tab, tavern log, weekly review prose for regulars/complaints → Phases 14 / 15 / 16.
- Suppliers, factions, premises, crises, reputation migrations → Phases 9–13.
- Touching `voice/composer.ts` or `voice/tonePools.ts` → Phase 16 retires them.
- Adding more band signals beyond the four named here → out of scope for Phase 8.
- Changing the seed generators or response-slot shapes → mechanical truth is unchanged; only wording is composed.

---

## Verification

- `npm test -- --run tests/cards/templates.regularComplaint.test.ts` — 17/17.
- `npm test -- --run tests/cards/templates.customerComplaint.test.ts` — 16/16.
- `npm test -- --run tests/cards/compose/gates/runAllGates.test.ts` — 11/11.
- `npm test -- --run tests/sim/phase127.signals.numeric.test.ts` — 25/25.
- `npm test -- --run tests/cards/templates.test.ts tests/cards/templates.voice.test.ts tests/cards/templates.drinkOrder.test.ts` — green.
- `npm run typecheck` — clean.
- `npm test -- --run` — full suite green.
- Structural: `grep -rn 'composeBody\|composeTitle' src/cards/templates/customerComplaint.ts src/cards/templates/regularComplaint.ts` returns nothing.
