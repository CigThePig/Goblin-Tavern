# Phase 165 — Distinguishable Choices (Faithful Surface arc, Phase 3 / ISSUE-133)

Implements Phase 3 of [`faithful-surface-arc.md`](faithful-surface-arc.md). See
`docs/ISSUE_TRACKER.md` ISSUE-133 for the canonical status entry.

## Context

The arc's defect classes #2 + #3, plus the renderer taxonomy leak:

- **Label collisions (161 cases).** `choiceLabel.ts` pools gated only on `responseVerb`
  (+voiceAxis), so two response slots sharing a leading `allowedVerb` collapsed to one
  label — e.g. `factionRequest`'s `negotiate_terms` (compromise) and `play_rival_faction`
  (deception), both `allowedVerbs: ['negotiate']`, both rendering "Strike a quick bargain".
- **Preview collapse (4,368 cases).** The shared base `_shared/effectPreviewBase.ts` had
  ≤2 snippets per `(targetKind, direction, band)` cell, so 3+ same-band slots on one card
  rendered the same preview line.
- **Renderer leak.** `CardRenderer.svelte` printed `{verb} · {shape}` ("NEGOTIATE ·
  COMPROMISE") under every choice — internal sim taxonomy.

Phases 1 (real-seed samplers) and 2 (valence) are prerequisites: without real slot shape
the collisions are invisible, and the preview variants rely on correct-tone direction.

## Discovery method

A throwaway probe rendered all 20 templates' real-seed, voice-extreme determinism samples
(`build*DeterminismSamples()` from Phase 1) through the production `card.render()` path and
tallied within-card label + preview collisions. This was the authoritative scope finder —
the per-template `runAllGates` blocks wire `choiceDistinctness` only for supplierReliability,
and the `diversity` gate on `choice_label` checks distinctness *across* seeds, not *within*
one card, so neither caught these. The probe was deleted after authoring; the standing
`phase165.distinctChoices.test.ts` replaces it.

## What changed

### (a) Label collisions → zero
Each colliding peer gets a discriminating snippet at explicit `specificity: 3` (the
supplierReliability Phase-148 pattern) — `responseShape` where the slots differ in shape,
`responseSlot` where they share verb **and** shape. The verb-only snippet keeps serving the
non-colliding slot.

| Pool | Peer fixed | Discriminator |
|---|---|---|
| `staffAside` | publicly_back_staff | `responseShape: reputation_play` |
| `staffBurnout` | reassign | `responseSlot: reassign` (same verb+shape as reduce_workload) |
| `drinkOrder` | refuse_request | `responseShape: relationship_sacrifice` |
| `regularComplaint` | refuse_request | `responseShape: relationship_sacrifice` |
| `customerComplaint` | public_apology | `responseVerb: appease` + `responseShape: relationship_sacrifice` |
| `factionRequest` | play_rival_faction | `responseShape: deception` |
| `maintenance` | (severity snippet) | added `responseShape: long_term_investment` so the `patch` slot no longer matched the urgent `repair` line |
| `seasonalArc` | ask_supplier_help / ask_faction_help | `responseShape: compromise` / `relationship_sacrifice` |

### (b) Preview collapse → no 3-way
`responseShape`-gated variants added to the five shared-base cells the probe flagged as
3-way: **staff pos-medium, faction pos-medium, culture pos-medium, area pos-small, pressure
neg-medium**. Each variant is 4 conditions (the cell's targetKind/direction/band + a
`responseShape`) ⇒ specificity 4, out-ranking the 3-condition base for matching-shape slots;
each carries the targetKind keyword + a `MAGNITUDE_LEXICON[direction][band]` token and is
canonically distinct (clears specificity, magnitude, dedupe gates). Every `maxRun=3`
collapse drops to ≤2. The residual 2-way near-collisions are accepted WARN-level per the arc
plan — the FNV per-slot tie-break over the now-larger candidate set clears the
`previewVariety` FAIL rule.

**Named-target composition deliberately not built.** The arc's preferred option (ii) —
"warm the guild vs warm the watch" — does nothing here: nearly every card routes all slots
to the same entity (`targetOptions: [ref]`), so naming the target prints the identical name
on every choice. It would help only the rare multi-entity card at the cost of a target-path
resolver + snippet fill + a simCoherence name carve-out. Recorded as a narrow future
enhancement.

### (c) Renderer cleanup
`web/src/lib/cards/CardRenderer.svelte` — removed the `{c.verb} · {shapeLabel(c.shape)}`
subtitle span and the now-unused `shapeLabel` helper. The synthetic Ignore button's "do
nothing" line stays (player copy). No web test asserted on it; svelte-check clean.

## Tests

`tests/cards/compose/phase165.distinctChoices.test.ts` (new, 41 tests) is the standing
guard. Per-template, it renders each template's real-seed voice-extreme determinism samples
through the production `.render()` path and asserts (1) no two choices on one card render the
same label, (2) no preview line appears on 3+ choices in one card, plus the explicit
factionRequest `negotiate_terms` / `play_rival_faction` distinctness case. Mirrors the
supplierReliability live-test precedent (render via the real path, not a synthetic gate
sampler). The comprehensive cross-sim faithfulness audit is Phase 5's job; this phase stays
per-template and bounded.

## Scope boundary

No sim-side changes (slotId / verb / targetId / shape / effect amounts untouched); no new
condition primitives (reuses `responseShape` / `responseSlot`); no new gates; no
magnitude-lexicon change. The Phase-1 legibility `it.todo` stays todo (its
`establishing_off_salient` + future_hook-magnitude residue are Phase 4's).

## Result

`npm run typecheck` clean; svelte-check 0 errors; full suite green at **3143/3143 + 1 todo
across 226 files** (+41 from the new guard test).
