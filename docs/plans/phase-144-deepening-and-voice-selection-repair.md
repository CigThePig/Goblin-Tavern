# Phase 144 — Deepening, Pruning & Voice-Selection Repair

**Voiced Surface arc, Phase 18 (standing — first playtest iteration).** Tracked as ISSUE-113. Closes the first playtest cycle of the standing-phase entry in [`voiced-surface-arc.md`](voiced-surface-arc.md).

## Context

The Voiced Surface arc closed Movement III at Phase 16 (ISSUE-111) and the centerpiece consistency gate at Phase 17 (ISSUE-112), with 19 compositional templates passing `runAllGates` (the seven framework gates) and the cross-situation consistency check. In play, however, the user surfaced five screenshots showing two structural defects that none of the seven gates caught:

1. **Effect previews collapsed within a single card render.** Every choice on Mira's `staff_identity` card showed "the kitchen keeps its quiet drumbeat" repeated across all preview lines. The `area_atmosphere` "Privy" card showed "The room would steady its footing" for every choice's every effect. Same pattern on `seasonal_arc` "Mushroom Blight", `inspection`, and `stock_shortage`.
2. **Bodies collapsed to 2 lines for moderate-voiced actors.** Mira's body rendered as `[establishing_line, aside_line]` with no `manner_note`; Mushroom Blight rendered similarly thin.

**Root cause (one diagnosis, two surfaces).** Across all 20 Movement II templates' `effectPreview` pools, every snippet was authored as a 2-condition entry (`effectKind|effectTag + voiceAxis`) with **no kind-only base-rung fallback**. When one snippet matched (because the actor's voice aligned with one extreme axis), it covered every effect of that kind on the card, and the FNV tie-break had only one candidate to choose from. The `mannerNote` pools demanded two simultaneous voice extremes (`warmth ≤ 0 AND terseness ≥ 2`), so neutral-voiced actors (the bulk of the `[-1,0,0,1]`-perturbed cast) matched nothing and the slot silently omitted.

**Why the seven gates missed it.** The diversity gate samples ONE slot under fresh-actor perturbation; it never simulates a whole card render with multiple choices × multiple effects. The coverage gate requires fallbacks only on `required: true` slots — `manner_note` and `effect_preview` are both `optional: true`. Cross-situation voice (Phase 17) holds voice fixed across templates, not across effects within one card.

## Goal

Ship one new 8th structural gate (`checkPreviewVariety`) wired into `runAllGates`, repair every Movement II template's `effectPreview` and `mannerNote` pools to match the gate's expectations, and document a standing repair pattern future playtests can reuse.

## Scope & non-goals

**In scope:**
- New gate `src/cards/compose/gates/previewVariety.ts` wired into `runAllGates` (optional config entry; templates without multi-effect renders skip it cleanly).
- `effectPreview.ts` repaired across all 20 Movement II templates.
- `mannerNote.ts` repaired across all 20 Movement II templates.
- One render-shape regression test (`tests/cards/compose/gates/previewVariety.live.test.ts`) exercising five screenshot-defect templates.
- Five fixture tests at `tests/cards/compose/gates/previewVariety.test.ts` proving each rule fires / passes correctly.

**Out of scope** (decided with user via `AskUserQuestion`):
- Title verbosity (e.g. `MIRA THE RESOLUTE: LINGERS WITH SOMETHING TO SAY`).
- Report prose, day beats, choice labels (already varied).
- The fallback card and legacy composer (retired Phase 16).
- Spec-file (YAML) updates: deferred — the design records under `specs/cards/` lag the in-repo pool authoring per the Phase-4 authoring loop.

## Design

### A. The gate

`checkPreviewVariety(sampler, config)` is a pure function over `(PreviewVarietySampler, PreviewVarietyConfig) → GateReport`. Same shape as the diversity gate; pure calls to `pickSnippet` with synthetic per-effect slot ids; no I/O.

**Two failure rules:**
- `within_card_preview_collapse` fires when ≥3 identical preview lines render in a row within a single card render (catches the screenshot pattern directly).
- `card_render_low_diversity` fires when the unique-to-total ratio of rendered preview lines falls below `minUniqueRatio` (default 0.15).

**Defaults chosen to discriminate the broken case from healthy variety:**
- `minUniqueRatio: 0.15` — broken card with 1 unique snippet across 24 lines = 0.04 (fails); healthy card with 6 snippets across 24 lines = 0.25 (passes).
- `maxIdenticalRun: 2` — at most one duplicate pair allowed in a row.

**`runAllGates` wiring:** new optional `previewVariety` config entry. Templates without multi-choice multi-effect renders (e.g. the fallback card) legitimately omit the entry; the gate reports `pass: true, skipped: true`.

### B. The pool repair pattern

For each Movement II template's `effectPreview.ts`:
- Add 4-8 unconditional kind-only base-rung snippets covering the effect kinds the template's choices actually emit (`state_change`, `pressure`, `future_hook`, `cause` as applicable). Specificity 1 (one condition).
- Preserve all existing voice-axis-gated snippets unchanged (specificity 2).

The Phase-C `pickSnippet` already picks highest-specificity matches first; the new base-rung snippets only fire when no higher-specificity (voice-axis-gated) snippet matches. For each effect within a card render, the synthetic slot id `effect_preview::${slot.id}::${idx}` differs, so the FNV tie-break spreads across the multiple base-rung candidates and renders different snippets across the card's effects.

For each Movement II template's `mannerNote.ts`:
- Add 3-4 `atLeast: 1` mid-rung snippets at explicit `specificity: 0` so neutral-voiced actors fire SOMETHING.
- Preserve all extreme-rung snippets (specificity 1 for single-axis, 2 for two-axis combos) unchanged — existing tests asserting specific snippets for specific profiles still pass because the explicit-0 mid-rung never outranks them.

For narrator-voiced templates (areaAtmosphere, debtRent, monthlyReview, rivalTavern, seasonalArc, stockShortage, etc.), the mid-rung snippets are unconditional narrator beats at explicit specificity 0.

### C. The render-shape regression test

`tests/cards/compose/gates/previewVariety.live.test.ts` exercises five screenshot-defect templates with realistic multi-choice multi-effect renders that mirror the screenshot card shapes:
- staffAside (Mira-like florid-warm actor, 12 choices × 2 effects = 24 lines)
- staffBurnout (florid actor, 4 choices × 2 effects)
- areaAtmosphere, seasonalArc, inspection, stockShortage (narrator-voiced, 3 choices × 2 effects each)
- staffAside again with a NEUTRAL cast actor

Each asserts `checkPreviewVariety` passes. Pre-Phase-18, all six would have failed.

## Files modified

**New (2):**
- `src/cards/compose/gates/previewVariety.ts`
- `tests/cards/compose/gates/previewVariety.test.ts`
- `tests/cards/compose/gates/previewVariety.live.test.ts`

**Gate wiring (2):**
- `src/cards/compose/gates/index.ts` — re-exports the new symbols
- `src/cards/compose/gates/runAllGates.ts` — registers the optional 8th gate

**Pool files (40):**
- `src/cards/compose/pools/<template>/effectPreview.ts` for all 20 Movement II templates
- `src/cards/compose/pools/<template>/mannerNote.ts` for all 20 Movement II templates

**Documentation:**
- `docs/ISSUE_TRACKER.md` — new ISSUE-113 entry
- `CLAUDE.md` — new Phase 144 paragraph at the top of the "Current Status" block

## Verification

- **Gate unit tests:** 5 fixture-driven tests cover the two failure rules and the happy path (`previewVariety.test.ts`).
- **Live regression:** 7 tests exercise the real screenshot-defect templates (`previewVariety.live.test.ts`).
- **Per-template gates:** every Movement II template's `runAllGates` block still passes (no regressions in coverage / specificity / voiceBounds / simCoherence / determinism / diversity / dedupe).
- **Full suite:** `npm test -- --run` and `npm run typecheck` green.

## What this iteration deliberately does NOT do

- Does not add new condition primitives, signals, or `runAllGates` features beyond the 8th gate.
- Does not change `composeChoicesFromSeed` plumbing — the plumbing is correct (`cardHelpers.ts:223-227`); the bug was in the pools.
- Does not change the body shape `[establishing_line, reaction_line, manner_note?]` — the optionality of `manner_note` stays; more actors will now hit it.
- Does not redesign the diversity gate or change its thresholds — `previewVariety` is a sibling gate, not a replacement.
- Does not update the YAML specs under `specs/cards/` to mirror the new authored shapes — deferred to a future Phase-18 iteration or to be reconciled when a spec is next consulted.

## Future Phase-18 iterations

ISSUE-113 stays open as the standing playtest-driven phase. Future iterations append additional repair entries to the tracker entry without creating new ISSUE-NNN ids. The standing repair recipe:

1. Receive playtest defect screenshots / reports.
2. Reproduce the defect with a fixture test against the relevant pool.
3. Decide whether the gate threshold needs tuning, the pool needs more snippets, or a new structural rule is warranted.
4. Apply the smallest repair that satisfies the gates and resolves the visible defect.
5. Run `npm test -- --run` + `npm run typecheck`.
6. Append a one-line entry to ISSUE-113 in the tracker.
