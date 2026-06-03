# Phase 4 — Cards, issue seeds, and composition faithfulness

Status: **completed** on 2026-06-03.

This phase audited the path from issue-seed generation to card template
selection, card composition, web rendering, and adjacent tests. It is an audit
artifact, not a repair patch.

## Scope inspected

Primary surfaces inspected:

- `src/sim/modules/issues/issueSeedTypes.ts`
- `src/sim/modules/issues/issueSeedRegistry.ts`
- `src/sim/modules/issues/issueSeedGenerators.ts`
- `src/sim/modules/issues/expandedSeedGenerators.ts`
- `src/cards/registry.ts`
- `src/cards/selection.ts`
- `src/cards/templates/*`
- `src/cards/compose/*`
- `src/cards/cardHelpers.ts`
- `specs/cards/*.spec.yaml`
- `web/src/lib/cards/*`
- `web/src/lib/components/CardDeck.svelte`
- `tests/cards/**`
- `tests/web/phase193.actionPreviewsAndSuggest.test.ts`
- Adjacent sim tests for issue-family behavior, especially
  `tests/sim/phase53.policyBacklash.test.ts` and
  `tests/sim/phase193.actionAffinity.test.ts`.

Commands run during the audit:

```bash
find src/cards src/sim/modules/issues specs/cards web/src/lib -maxdepth 3 -type f | sort
find tests -path '*cards*' -o -path '*phase193*' | sort
rg -n "family: '|type: '|timing: '" src/sim/modules/issues/issueSeedGenerators.ts src/sim/modules/issues/expandedSeedGenerators.ts
for f in src/cards/templates/*.ts; do echo "--- $f"; rg -n "id: '.*'|seedFamilies|seedTypes|timings|custom:" "$f"; done
for f in specs/cards/*.spec.yaml; do echo "--- $f"; rg -n "^(id|family|type|timing|timings|template|card|seed_family|seed_type):|family:|seedTypes|seedFamilies|timings" "$f" | sed -n '1,80p'; done
rg -n "policy_backlash|policy_reaction" specs/cards src/cards tests/cards docs/plans
rg -n "policy_backlash|policy_reaction" tests/sim tests/cards tests/web src/sim/modules/issues src
npm test -- tests/cards tests/web/phase193.actionPreviewsAndSuggest.test.ts
```

## Runtime path summary

| Step | Source of truth | Audit result |
|---|---|---|
| Seed-family roster | `IssueSeedFamilyId`, `CORE_ISSUE_SEED_FAMILIES`, and `EXPANDED_ISSUE_SEED_FAMILIES` in `issueSeedTypes.ts` | 20 families are defined: 10 core and 10 expanded. |
| Active seed generators | `ALL_SEED_GENERATORS` in `issueSeedGenerators.ts`, combining required and expanded generators | All 20 families have active generators. |
| Card registration | `REQUIRED_CARDS` in `src/cards/templates/index.ts` | 20 dedicated card definitions plus `fallback.everySeed` are registered. |
| Selection | `pickCardForSeed` in `src/cards/selection.ts` | Match order is priority, specificity, then id; no match falls back through `pickCard`. |
| Rendering | `pickCard` in `src/cards/registry.ts` and `renderCard` in `web/src/lib/cards/realCardRegistry.ts` | Web rendering is a thin adapter over the real card registry; no mock registry remains in the live path. |
| Web deck | `CardDeck.svelte` | The deck maps each seed to `renderCard(seed, gameStore.state)` and sends selected choices back by seed id. |
| Choice preview source | `buildChoice` / `composeChoicesFromSeed` in `src/cards/cardHelpers.ts` | Preview lines are derived from `ConsequenceProfile.immediateEffects` / delayed effects, or from effect-preview snippets keyed to those effects. |

## Seed-to-template matrix

Legend:

- **Dedicated** means a non-fallback card can match the generator's emitted
  `family` + `type` + `timing` tuple.
- **Custom guard** means the tuple must also pass a state/entity predicate, most
  often requiring a resolved actor with `castAttributes`.
- **Fallback route** describes what happens when no dedicated template matches.

| Family | Generator tuple(s) | Dedicated card template(s) | Spec coverage | Test coverage observed | Fallback route assessment |
|---|---|---|---|---|---|
| `food_safety` | `crisis` / `morning_prep` | `food_safety.crisis`; custom guard requires staff primary actor with cast attributes | `food_safety.spec.yaml` | `templates.foodSafety.test.ts`, `templates.test.ts`, gate tests | Intentional only for malformed/legacy actor state; normal tuple is covered. |
| `stock_shortage` | `warning` / `morning_prep` | `stock_shortage.warning` | `stock_shortage.spec.yaml` | `templates.stockShortage.test.ts`, `phase171.matrixCoverage.test.ts` | No suspicious fallback found. |
| `maintenance` | `maintenance_problem` / `morning_prep` | `maintenance.maintenance_problem` | `maintenance.spec.yaml` | `templates.maintenance.test.ts`, operational preview tests | No suspicious fallback found. |
| `staff_burnout` | `staff_request` / `morning_prep` | `staff_burnout.staff_request`; custom guard requires staff primary actor with cast attributes | `staff_burnout.spec.yaml` | `templates.staffBurnout.test.ts`, `templates.test.ts` | Intentional only for malformed/legacy actor state; normal tuple is covered. |
| `customer_complaint` | `complaint` / `during_service` | `customer_complaint.complaint`; custom guard requires customer-group cast attributes | `customer_complaint.spec.yaml` | `templates.customerComplaint.test.ts`, `templates.test.ts` | Intentional only for malformed/legacy actor state; normal tuple is covered. |
| `violence` | `customer_incident` / `during_service` | `violence.customer_incident`; custom guard requires customer-group cast attributes | `violence.spec.yaml` | `templates.violence.test.ts`, `templates.test.ts` | Intentional only for malformed/legacy actor state; normal tuple is covered. |
| `debt_rent` | `debt_pressure` / `end_month`; generator runs in morning via `generateWith` | `debt_rent.debt_pressure` | `debt_rent.spec.yaml` | `templates.debtRent.test.ts`, `phase171.matrixCoverage.test.ts` | No suspicious fallback found; render timing intentionally remains `end_month`. |
| `inspection` | `inspection_threat` / `morning_prep` | `inspection.inspection_threat`; custom guard requires faction primary actor with cast attributes | `inspection.spec.yaml` | `templates.inspection.test.ts`, matrix and gate tests | Intentional only for malformed/legacy actor state; normal tuple is covered. |
| `reputation_shift` | `reputation_shift` / `closing` | `reputation_shift.reputation_shift` | `reputation_shift.spec.yaml` | `templates.reputationShift.test.ts`, `templates.test.ts` | No suspicious fallback found; old `end_week` mismatch is documented as fixed. |
| `monthly_review` | `monthly_review` / `end_month`; generator runs in morning via `generateWith` | `monthly_review.monthly_review` | `monthly_review.spec.yaml` | `templates.monthlyReview.test.ts`, `templates.test.ts` | No suspicious fallback found; render timing intentionally remains `end_month`. |
| `staff_identity` | `relationship_test` / `morning_prep` | `staff_identity.staff_aside`; custom guard requires staff cast attributes | `staff_aside.spec.yaml` | `templates.staffAside.test.ts`, exhaustive matrix tests | Intentional only for malformed/legacy actor state; normal tuple is covered. |
| `regular_customer` | `complaint` or `relationship_test` / `during_service` | `regular_customer.complaint` and `regular_customer.drink_order`; custom guards require regular cast attributes | `regular_complaint.spec.yaml`, `drink_order.spec.yaml` | `templates.regularComplaint.test.ts`, `templates.drinkOrder.test.ts`, social preview tests | Intentional only for malformed/legacy actor state; normal high- and low-irritation branches are covered. |
| `supplier_relationship` | `supplier_offer` / `morning_prep`; templates also accept `opportunity` | `supplier_relationship.supplier_offer`; custom guard requires supplier cast attributes | `supplier_reliability.spec.yaml` | `templates.supplierReliability.test.ts`, `phase171.matrixCoverage.test.ts` | No suspicious fallback for emitted tuple; extra `opportunity` acceptance appears compatible with older/adjacent seed shapes. |
| `faction_request` | `social_conflict` / `during_service` | `faction_request.social_conflict`; custom guard requires faction cast attributes | `faction_request.spec.yaml` | `templates.factionRequest.test.ts`, exhaustive matrix tests | Intentional only for malformed/legacy actor state; normal tuple is covered. |
| `culture_conflict` | `social_conflict` / `during_service` | `culture_conflict.social_conflict` | `culture_conflict.spec.yaml` | `templates.cultureConflict.test.ts`, exhaustive matrix tests | No suspicious fallback found. |
| `area_atmosphere` | `warning` / `morning_prep` | `area_atmosphere.warning` | `area_atmosphere.spec.yaml` | `templates.areaAtmosphere.test.ts`, exhaustive matrix tests | No suspicious fallback found. |
| `seasonal_arc` | `arc_milestone` or `festival_preparation` / `morning_prep` | `seasonal_arc.arc_milestone` accepts both types | `seasonal_arc.spec.yaml` | `templates.seasonalArc.test.ts`, `templates.test.ts` | No suspicious fallback found. |
| `policy_backlash` | `policy_reaction` / `morning_prep` | **None**; only `fallback.everySeed` can render this family | **No `policy_backlash.spec.yaml` found** | Sim behavior is covered by `phase53.policyBacklash.test.ts`; salience-table completeness is covered by `phase170.salienceCompleteness.test.ts`; no dedicated card/template test exists | **Suspicious / candidate:** active family has mechanical responses and salience coverage but no authored card/spec. |
| `rumour_crisis` | `rumour` / `closing` | `rumour_crisis.rumour`; custom guard requires a cast-backed actor and deliberately rejects tavern/system identities | `rumour_crisis.spec.yaml` | `templates.rumourCrisis.test.ts`, `templates.test.ts` | Partly intentional: no-actor/tavern-identity rumours intentionally fall back; cast-backed rumours are covered. |
| `rival_tavern` | `social_conflict` / `closing` | `rival_tavern.social_conflict` | `rival_tavern.spec.yaml` | `templates.rivalTavern.test.ts`, `templates.test.ts` | No suspicious fallback found. |

## Findings

| ID | Status | Severity | Area | Summary | Evidence | Current tests | Next action |
|---|---|---|---|---|---|---|---|
| AUD-CARD-001 | candidate | medium | `policy_backlash` card surface | `policy_backlash` is the only active issue-seed family that appears to rely on `fallback.everySeed` for live card rendering. | `expandedSeedGenerators.ts` emits `family: 'policy_backlash'`, `type: 'policy_reaction'`, `timing: 'morning_prep'`; `REQUIRED_CARDS` has no policy-backlash template; `specs/cards/` has no `policy_backlash.spec.yaml`; repo search only finds salience and sim tests under cards for this family. | `tests/sim/phase53.policyBacklash.test.ts` covers seed/response mechanics; `tests/cards/compose/phase170.salienceCompleteness.test.ts` covers the salience table. These do not prove the family has an authored card, title/body pools, or card-level choice voice. | Decide whether fallback is a deliberate design state. If not, add `policy_backlash` spec + dedicated compositional template + template tests. |

## Non-findings and resolved risk areas

- The historical timing mismatches called out in comments appear resolved for
  inspected families: `food_safety`, `staff_burnout`, and `reputation_shift`
  templates now match the generator-emitted timings.
- The card-selection fallback itself is intentional and valuable: `pickCard`
  guarantees every valid seed can render even when a dedicated card is absent.
  The audit flags only the active, mechanically rich `policy_backlash` family as
  suspicious because it has no dedicated authoring artifact.
- Choice preview text is structurally anchored to sim effect previews. The helper
  reads from `ConsequenceProfile` effects by default and the composed preview
  path threads each `EffectPreview` through snippet selection rather than
  inventing mechanical effects.
- Web card rendering uses the real card registry through
  `web/src/lib/cards/realCardRegistry.ts`; the inspected deck component does not
  maintain a separate card selection path.
- The spec/template/test triplet is present for every dedicated family template
  except fallback and the identified missing `policy_backlash` dedicated
  template. `drink_order` and `staff_aside` specs are design artifacts rather
  than strict schema inputs, but they are present and align with their template
  purpose.

## Suggested follow-up probes

1. Add a derived card-surface coverage test that compares active generator
   families against dedicated non-fallback template `seedFamilies`, with an
   explicit allowlist for intentional fallback-only families. This would catch
   another `policy_backlash`-style gap without relying on manual audits.
2. If `policy_backlash` is intentionally fallback-only, document that in the
   template manifest and add a test asserting the fallback route is deliberate.
3. If `policy_backlash` should be authored, implement a dedicated card using the
   existing `SALIENCE_TABLES.policy_backlash` reads and the Phase 53 mechanical
   response slots as its choice source.
4. Consider a lightweight spec parity check for `specs/cards/*.spec.yaml` versus
   `src/cards/templates/*` so future changes to `seedTypes` or `timings` fail
   before a card silently falls back.

## Verification

The focused Phase 4 test command passed:

```text
Test Files  79 passed (79)
Tests       1350 passed (1350)
```

Command:

```bash
npm test -- tests/cards tests/web/phase193.actionPreviewsAndSuggest.test.ts
```
