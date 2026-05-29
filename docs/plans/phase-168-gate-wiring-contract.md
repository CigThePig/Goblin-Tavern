# Phase 168 / ISSUE-136 — The Gate-Wiring Contract

**Arc:** Complete Surface, Movement I, Phase 1. **Depends on:** nothing (hard prerequisite for the rest of the arc).

See [`complete-surface-arc.md`](complete-surface-arc.md) Phase 1 for the full framing. This file is the implementation plan.

## Problem (audit finding #2)

Two coupled blind spots make it possible for a card template to ship under-gated and have nothing fail:

1. **The opt-in gates never run per-template.** `previewVariety`, `choiceDistinctness`, and `reportLegibility` only execute when a config block is passed to `runAllGates`. Across the whole suite `previewVariety:` is passed in **zero** files, `choiceDistinctness:` in **one** (the Phase-148 synthetic fixture, not a real template), and `reportLegibility:` only in report-section tests. So every one of the 20 migrated card templates' per-template `runAllGates` walk runs only the **seven** always-on framework gates (coverage, specificity, voiceBounds, simCoherence, determinism, diversity, dedupe). Preview/choice quality is checked instead by the cross-sim `legibility` harness — which is good, but it means a regression in the per-template render path isn't caught by the per-template walk.

2. **The cross-sim harness registries are hand-maintained with no completeness check.** `LEGIBILITY_SITUATIONS` (legibilityHarness) and `CROSS_SITUATION_ACTOR_KINDS` (crossSituationHarness) are literal lists. A template added to `REQUIRED_CARDS` but forgotten in a harness silently loses its cross-sim coverage. Nothing derives the required set from `REQUIRED_CARDS` and fails on a gap.

The CLAUDE.md Phase-161 note claims per-template `runAllGates` "runs the seven framework gates + dedupe + previewVariety + choiceDistinctness + reportLegibility for every template's own pool walk." That claim is **inaccurate** — the code runs seven + (opt-in, never-configured) three.

## The work

### (a) A full-gate harness + a data-driven per-template walk that wires the opt-in gates

New harness `tests/cards/compose/gates/fullGateHarness.ts`:

- `FULL_GATE_SITUATIONS: readonly FullGateSituation[]` — one entry per migrated template (the 20 in `REQUIRED_CARDS` minus `fallbackCard`). Each carries `{ templateId, template, labelPool, previewPool, buildSamples }` where `buildSamples` is the same per-template `build*DeterminismSamples()` factory the legibility harness already reuses, and `labelPool` / `previewPool` are the template's `choiceLabel` / `effectPreview` snippet pools.
- Two generic sampler builders that turn a situation into the gate samplers, deriving the render shape from the seed's own `responseSlots` + `consequenceProfiles` (the same fields `legibility.ts` reads):
  - `previewVarietySamplerFor(situation)` → `PreviewVarietySampler`. Maps each response slot to a `PreviewVarietyChoice { slot, effects, inactionPreview }`, sourcing `effects` from `immediateEffects` (or `delayedEffects` when immediate is empty — the Phase-147 inaction carve-out).
  - `choiceDistinctnessSamplerFor(situation)` → `ChoiceDistinctnessSampler`. Applies `applyLegibleChoiceCap(seed, responseSlots, profileFor, DEFAULT_LEGIBLE_CHOICE_CAP)` first — mirroring production — then maps the surviving slots to `{ slot, profile }`.

New test `tests/cards/compose/gates/fullGateWiring.test.ts`: a data-driven loop over `FULL_GATE_SITUATIONS` that runs `runAllGates(template, { …, previewVariety, choiceDistinctness })` per template and asserts `report.previewVariety.skipped === false`, `report.choiceDistinctness.skipped === false`, and `report.pass === true`. This is the per-template `runAllGates` walk now running the full nine-gate set against each template's real sampler. The existing 20 hand-tuned per-slot-diversity blocks in `runAllGates.test.ts` stay as-is.

### (b) A harness-completeness test derived from `REQUIRED_CARDS`

New test `tests/cards/compose/gates/harnessCompleteness.test.ts`:

- `requiredIds = REQUIRED_CARDS.map(c => c.id).filter(id => id !== FALLBACK_CARD_ID)`.
- Assert every `requiredId` appears in `LEGIBILITY_SITUATIONS`, in `FULL_GATE_SITUATIONS`, and in `cardRegistry.all()` (the faithfulness walk's candidate set — `faithfulnessHarness` walks `cardRegistry.all()` dynamically, so registry membership *is* faithfulness coverage).
- Derive the **actor-voiced** subset structurally: a template is actor-voiced iff any of its body/title slots' pool snippets carry a `voiceAxis` or `verbalTic` condition (the runtime templates' `.slots` never include choice/preview pools, so no exclusion is needed). Assert every actor-voiced `requiredId` appears in the flattened `CROSS_SITUATION_ACTOR_KINDS` `templateIds`. Verified by hand: the derivation yields exactly the 11 the crossSituation harness lists (customerComplaint, drinkOrder, factionRequest, foodSafety, inspection, regularComplaint, rumourCrisis, staffAside, staffBurnout, supplierReliability, violence).
- Assert no **stale** entries: every registry templateId is in `requiredIds` (catches a renamed/removed template).
- Document the `reportLegibility` exclusion as data: an exported `CARD_TEMPLATE_EXCLUDED_GATES = ['reportLegibility']` constant in the harness with a one-line reason (report-only; magnitude band lives in a routing tag, which card snippets never gate on), referenced by a test rather than left as silence.

### (c) Triage anything the newly-run gates surface

Run the suite. Any `previewVariety` / `choiceDistinctness` violation on a real template is a defect that was hiding behind the opt-in switch — fix it in the pool, never by loosening the gate (Faithful Surface Phase-1 rule). Expectation: low. The same `(seed, state)` pairs already pass the cross-sim `legibility` gate's Q2 (preview legibility + `choice_label_collision`), and `previewVariety`'s within-card variety rule was the Phase-144 repair applied across all 20 pools. The base `previewVariety` gate is wired (within-card variety); the magnitude/cost/specificity legibility sub-rules stay enforced cross-sim by `checkLegibility` and are not duplicated here.

### (d) Correct the CLAUDE.md Phase-161 claim

Reword to: per-template `runAllGates` runs the seven framework gates + `previewVariety` + `choiceDistinctness` (nine total) for every migrated card template; `reportLegibility` is report-section-only; the cross-template `legibility` / `crossSituation` / `faithfulness` harnesses remain siblings whose completeness is now asserted by `harnessCompleteness.test.ts`.

## Done when

- A test fails if any `REQUIRED_CARDS` template is absent from a cross-sim harness (legibility / faithfulness / — for actor-voiced — crossSituation) or from the full-gate walk.
- `previewVariety` and `choiceDistinctness` run on every migrated template's `runAllGates` walk with its real sampler (`skipped === false`, `pass === true`).
- Any defect the wiring surfaces is fixed in the pool.
- The CLAUDE.md claim is accurate.
- `npm test` and `npm run typecheck` green.

## Do not do

- Don't weaken a gate to keep a block green.
- Don't hand-add a missing registry entry without the test that would have caught it.
- Don't fold the cross-sim harnesses into `runAllGates` — they stay multi-template siblings; this phase makes their *completeness* checkable.
- Don't author content or touch drinkOrder's raw fragment (that's Phase 2).
