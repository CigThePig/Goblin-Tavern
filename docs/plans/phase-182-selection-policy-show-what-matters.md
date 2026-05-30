# Phase 182 / ISSUE-150 — Choice-Preview Legibility arc, Phase 2: Selection Policy — show what matters, never show a literal duplicate

**Depends on:** Phase 181 / ISSUE-149 (the meter contract — `EffectPreview.meterId`/`meterLabel`, the `effectMeter` condition, the meter-aware `previewCellKey`).

**Record for:** `docs/plans/choice-preview-legibility-arc.md` Phase 2.

## Problem (from the arc)

Two defects live in how the preview *array* is assembled, both upstream of any prose:

1. **A flat `maxPreview: 2` hides most consequences, and the only rescue is for coin.**
   `selectPreviewEffects` (`src/cards/compose/previewSelect.ts`) returns the first
   `previewMax` effects, with a single exception: a negative-`coin` effect past the cap
   is pulled into view (Phase 166 cost-surfacing). Nothing rescues *pressure* effects,
   which encode risk relief / escalation (positive pressure = rising/bad, negative =
   relief/good — see the pressure-block comment in `effectPreviewBase.ts`). Across the
   sampled families, 37% of authored effects never reach the player, and the hidden
   pressure relief is frequently the single fact that distinguishes one option from
   another (e.g. `publicly_back_staff_profile` hides `pressure:staff_loyalty_risk −8` at
   index 3, the whole point of "back them in public").

2. **The within-choice "cell collapse" emits a duplicate line.** Phase 181 made the
   de-dup *key* meter-aware, but the renderer's `coarseCellLine` fallback still reuses one
   coarse line for two distinct meters (deliberately, to preserve the cross-choice
   candidate budget until Phase 3). So the player still sees the same line twice.

## The fix (contract → policy, no prose)

### 1. `selectPreviewEffects` — add a risk-surfacing rescue beside the cost rescue

Replace the "first N + coin rescue" body with a **decision-relevance selection** that
guarantees three priority categories are surfaced within the cap, in this documented,
enumerable order (each exposed as a named, exported predicate so the legibility gate in
Phase 4 reads the *same* definition — never a private closure):

1. **headline `state_change`** — the first `state_change` effect in source order (the
   meter the choice headlines).
2. **cost** — the first negative-direction `coin` effect (the existing Phase-166 rule).
3. **headline risk** — the first decision-relevant `pressure` effect (`targetKind ===
   'pressure'` with a non-neutral `direction`): the risk the choice relieves or incurs.

Algorithm (pure, deterministic, source-order output):
- If `source.length <= previewMax`, return all.
- Otherwise force-include the present must-surface indices (in the priority order above,
  until the cap is full), then fill the remaining slots with the next effects in source
  order, and return the selected effects **in source order** so the rendered lines read
  top-to-bottom as authored.

Because there are exactly three must-surface categories, a cap of 3 always fits headline
+ cost + risk — no growth past the ceiling is needed, and the returned length stays
`min(previewMax, source.length)`. That keeps the gate's re-derivation
(`selectPreviewEffects(source, lineCount)`) perfectly idempotent: the renderer emits one
line per selected effect, so `lineCount === selected.length` and the gate re-selects the
identical effects in the identical order.

### 2. The cap lives in one place

`composeChoicesFromSeed` already defaults to the shared `MAX_PREVIEW` constant
(`options.maxPreview ?? MAX_PREVIEW`), and `MAX_PREVIEW` is already `3` — the small,
phone-scannable ceiling that fits cost + risk + headline. The flat `maxPreview: 2` is
duplicated verbatim across all twenty templates' `composeChoicesFromSeed` calls. **Delete
every per-template `maxPreview: 2`** so the twenty converge on the single `MAX_PREVIEW`
source of truth. The `maxPreview` override stays on `ComposeChoicesOptions` for genuine
future exceptions; no template needs one today.

### 3. De-duplicate identical rendered lines within a choice

After the per-effect line is composed (which still populates the cross-choice
`usedPreviews` avoid-set and the cell-reuse maps exactly as before, so the candidate
budget is untouched), apply a final within-choice presentation pass: if the composed line
is a literal duplicate of one already emitted **for this choice**, fall back to the
effect's own sim `readable` (the distinct, sim-authored text — "Loyalty rises", "Stress
drops") instead of the duplicate metaphor.

Replacing-with-`readable` (rather than dropping the entry) is deliberate and load-bearing:
it keeps `previewEffects` 1:1 with the selected effects, so both the `legibility` and
`faithfulness` gates' line→effect re-derivation stays aligned and green, and the
`readable` fallback already counts as legible under those gates' `line === effect.readable`
sim-authority carve-out. It is also strictly *more* informative than a repeated metaphor —
the readable names the meter ("Stress drops") where the duplicate said nothing new. Phase
3 then swaps these readable stopgaps for meter-named composed prose; Phase 4 locks "no
duplicate line" with a gate.

## Acceptance Criteria

- A choice that relieves or incurs a headline risk shows that `pressure` line within the
  cap (test on a `staff_identity`-style profile asserting `staff_loyalty_risk` relief is
  selected).
- No rendered choice contains two identical preview lines (test on a two-same-cell
  profile, e.g. loyalty +10 / stress −8).
- The cost rescue still holds (a coin-spend choice still surfaces a coin line).
- The cap policy lives in one place (`MAX_PREVIEW`); no template passes `maxPreview: 2`.
- `selectPreviewEffects` stays pure and shared with the legibility + faithfulness gates;
  its must-surface predicates are exported and enumerable.
- `npm test` and `npm run typecheck` green.

## Do Not Do

- Don't change effect *mechanics* — verbs, targets, amounts, and the order in the
  consequence profile are untouched; this only changes which effects the preview
  *renders* and how the array is de-duplicated.
- Don't author or reword preview prose (Phase 3).
- Don't raise the cap past the small ceiling — favour the priority rule over a big number.
- Don't fork `selectPreviewEffects` for the gate — extend the shared function.
- Don't add the Phase-4 gate rules here (`preview_meter_unnamed` /
  `preview_duplicate_line` / `preview_risk_unsurfaced`).
