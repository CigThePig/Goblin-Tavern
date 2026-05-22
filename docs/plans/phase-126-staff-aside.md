# Phase 126 — Living Cast Phase F (first situation): staff_aside

**Tracker:** [`ISSUE-095`](../ISSUE_TRACKER.md#issue-095--living-cast-phase-f-first-situation-staff_aside-template). **Roadmap:** [`living-cast-arc.md` §"Phase F — Scale Out"](living-cast-arc.md). **Framework:** [`card-composition-framework.md`](card-composition-framework.md). **Phase-B reference:** [`living-cast-arc-phase-b.md`](living-cast-arc-phase-b.md). **Sibling template:** `src/cards/templates/drinkOrder.ts` (Phase C, ISSUE-092, phase 123).

## What changed

The first Phase F scale-out template: a new compositional card `staffAsideCard` voicing a staff member's pre-shift remark to the owner, attached to seeds the existing `staffRequest` hand-written card leaves uncovered. Hand-authored snippet pool — no API key, no model generation; the same path Phase B took for `drink_order`. The matching generation spec lives at `specs/cards/staff_aside.spec.yaml` as a design record + future regeneration input.

Phase-E discovery, fixed in the same phase: the spec schema (`scripts/generate-pool/specSchema.ts`) had hardcoded the first template's slot ids (`order_line`, `manner_note`, `sim_backed_hook`) under `hardBounds` and `positiveExemplars`. Generalised to `perSlotWords: Record<slotId, number>` and `slotLines: Record<slotId, string>` respectively. `buildPrompt.ts` updated to look up exemplar text by slot id. `drink_order.spec.yaml` migrated to the new shape — same content, slot-agnostic shell. This is the "one expected loop back" Phase F predicts.

## Why this situation

The existing `drinkOrder` template attaches to `regular_customer / relationship_test / during_service`. Phase A put `castAttributes` on **staff and regulars only**, so voice-led Phase F situations must have one of those as `primaryActor`. Of the three seed-family / type / timing combinations that emit a staff or regular as `primaryActor` and aren't already covered by a hand-written template:

- `staff_identity / relationship_test / morning_prep` — **uncovered** today (falls to fallback). Staff carries cast attributes. **Chosen.**
- `regular_customer / complaint` — covered by `customerComplaintCard`. Would replace, not scale out.
- `staff_burnout / staff_request / closing` — covered by `staffRequestCard`. Same.

The `staff_identity` generator (lines 720–833 of `src/sim/modules/issues/expandedSeedGenerators.ts`) pins `timing: 'morning_prep'`, `type: 'relationship_test'`, `primaryActor: staffRef(...)` and ships rich `textIngredients` (sensoryDetails, recentContext, perceivedBlame, pressureContext) — exactly the data the body composition needs after the voiced line.

## Shape

| field | value |
|---|---|
| Template id | `staff_identity.staff_aside` |
| Voice register | `staff_quarters` (new — back-of-house, pre-shift, owner-facing) |
| `appliesTo.seedFamilies` | `['staff_identity']` |
| `appliesTo.seedTypes` | `['relationship_test']` |
| `appliesTo.timings` | `['morning_prep']` |
| `appliesTo.custom` | rejects when `state.staff[ref.id].castAttributes === undefined` |
| Priority | 60 (parallel to drinkOrder; no contender at this slot) |
| Slot `aside_line` | required, flavor, `wordBudget: 12`, 18 snippets across four rungs |
| Slot `manner_note` | optional, flavor, `wordBudget: 10`, 5 snippets, no fallback |

The four rungs follow Phase B's structural fix: a fallback (specificity 0), single-axis snippets (the common middle rung, anchoring diversity under the `[-1,0,0,1]` perturbation), two-axis snippets (the rare top rung), and one snippet per registered verbal tic.

## Files added

- `src/cards/compose/pools/staffAside/index.ts` — re-exports the two pools.
- `src/cards/compose/pools/staffAside/asideLine.ts` — 18-snippet required-slot pool.
- `src/cards/compose/pools/staffAside/mannerNote.ts` — 5-snippet optional-slot pool.
- `src/cards/templates/staffAside.ts` — `staffAsideTemplate` + `staffAsideCard` via `defineCompositionalCard`.
- `specs/cards/staff_aside.spec.yaml` — design-record + future-regeneration spec.
- `tests/cards/templates.staffAside.test.ts` — 14 tests parallel to `templates.drinkOrder.test.ts`.

## Files modified

- `src/cards/templates/index.ts` — registers `staffAsideCard` in `REQUIRED_CARDS`.
- `src/cards/index.ts` — re-exports `staffAsideCard`.
- `scripts/generate-pool/specSchema.ts` — generalises `HardBoundsSchema.perSlotWords` and `PositiveExemplarSchema.slotLines`.
- `scripts/generate-pool/buildPrompt.ts` — reads exemplar text by `slotId` against `slotLines`.
- `specs/cards/drink_order.spec.yaml` — migrated to the new schema shape (same content).
- `tests/cards/compose/gates/samplers.ts` — adds `buildStaffDeterminismSamples` and `buildStaffDiversitySampler` mirroring the regular-side helpers; uses `createStaffCastAttributes` so samples reproduce the real staff distribution.
- `tests/cards/compose/gates/{coverage,specificity,voiceBounds,simCoherence,determinism,diversity,runAllGates}.test.ts` — each adds a parallel block exercising `staffAsideTemplate` against the same gate it already runs against `drinkOrderTemplate`.
- `tests/cards/compose/pipeline/loadSpec.test.ts` — inline-YAML fixture updated to the new schema shape.

## Verification (delivered)

- `npm run typecheck` clean.
- `npm test` green: 1856 tests across 155 files. Coverage:
  - 6 gates against `staffAsideTemplate` (coverage, specificity, voice-bounds, sim-coherence, determinism, diversity) all pass.
  - `runAllGates(staffAsideTemplate, …)` returns `pass: true` across all six.
  - Registry pick test: a `staff_identity / relationship_test / morning_prep` seed against a state with cast-attribute-bearing staff selects `staffAsideCard`, not the fallback.
  - Fallback-degradation test: same seed against a state where `state.staff[ref.id].castAttributes` is `undefined` selects `fallbackCard`.
  - Voice variance: three hand-picked staff profiles (terseness=2 + warmth=0; warmth=2 + formality=0; verbalTic=qualifies_everything against neutral axes) produce three distinct body[0] lines.
  - Spec round-trip: the new `staff_aside.spec.yaml` is structurally consumable by the generalised schema; `drink_order.spec.yaml`'s migration verified by the pre-existing `loadSpec.test.ts` "parses the committed drink_order spec" test.
  - Pipeline tests (`integration.test.ts`, `runGates.test.ts`, `buildPrompt.test.ts`, `dedupe.test.ts`, `retryLoop.test.ts`, `emitPool.test.ts`) all green with the generalised schema.

## What this phase deliberately did NOT do

- No model-generated pool. The user asked for "not through an API key"; the spec records intent and the pool was hand-authored against it. (Phase E was retired in phase 130 / ISSUE-099, the Voiced Surface arc's Phase 4: pool authoring is now an in-repo Claude Code plan-mode run; no `npm run generate-pool` invocation exists. The hand-authored shape this phase landed is now the standing pattern. See `voiced-surface-arc.md` Appendix A.)
- No `sim_backed_hook` slot. Phase B's lesson holds: until the underlying sim signals (per-actor repeat-visit count, confirmed pressure ids) are clearly emitted, a sim_backed slot would ship dead snippets or assert unbacked facts.
- No new DSL primitives. The 11 framework conditions + Phase B's two voice forms suffice.
- No second Phase F situation in this phase. The roadmap explicitly says "Repeat this prompt per situation. That repetition is the whole point" — each situation gets its own ISSUE entry and phase number.
