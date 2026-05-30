// Phase 166 / ISSUE-134 — Faithful Surface arc, Phase 4.
// Phase 182 / ISSUE-150 — Choice-Preview Legibility arc, Phase 2.
//
// Shared preview-effect selection policy. Both the production renderer
// (`composeChoicesFromSeed` in `cardHelpers.ts`) and the cross-template
// legibility / faithfulness gates must select the SAME effects to
// preview, in the same order, or a gate pairs a rendered line with the
// wrong backing effect. Extracted here (depends only on the
// `EffectPreview` type) so neither side re-implements it and they can
// never drift.

import type { EffectPreview } from '../../sim/core/effect'

// ---- decision-relevance predicates (Phase 182 / ISSUE-150) ----
//
// The three must-surface categories, exported as named predicates rather
// than inlined closures so the Phase-4 legibility gate reads the SAME
// definition the renderer uses — the gate must never re-invent what
// "risk" or "cost" means. Priority order is: (1) headline state_change,
// (2) cost, (3) headline risk.

/** The headline meter the choice moves: the first `state_change` effect
 *  in source order. */
export function isHeadlineStateChange(e: EffectPreview): boolean {
  return e.kind === 'state_change'
}

/** A coin cost: a negative-direction `coin` effect. The player must always
 *  see when a choice spends coin (Phase 166). */
export function isCostEffect(e: EffectPreview): boolean {
  return e.targetKind === 'coin' && e.direction === 'negative'
}

/** A decision-relevant risk change: a `pressure` effect whose direction
 *  marks a meaningful move on a risk meter (positive = rising/bad,
 *  negative = relief/good — see the pressure-block comment in
 *  `effectPreviewBase.ts`). The hidden pressure relief is frequently the
 *  single fact that distinguishes one option from another, so it earns a
 *  rescue beside the coin cost. */
export function isRiskEffect(e: EffectPreview): boolean {
  return (
    e.targetKind === 'pressure' &&
    (e.direction === 'positive' || e.direction === 'negative')
  )
}

/** The must-surface predicates in priority order. Enumerable so the gate
 *  and the renderer share one definition of "what a preview must show." */
export const MUST_SURFACE_PREDICATES: ReadonlyArray<
  (e: EffectPreview) => boolean
> = [isHeadlineStateChange, isCostEffect, isRiskEffect]

/** Select the effects a choice should preview, capped at `previewMax`.
 *
 *  Decision-relevance selection (Phase 182): within the cap, three
 *  priority categories are guaranteed to be surfaced when present —
 *  (1) the headline `state_change`, (2) a negative-`coin` cost,
 *  (3) the headline `pressure`/risk change — so the player is never shown
 *  two vague lines while the fact that distinguishes the option (a coin
 *  cost, a relieved/incurred risk) is hidden past the cap. Remaining
 *  slots are filled in source order. The result is returned in source
 *  order so the rendered lines read top-to-bottom as authored.
 *
 *  Pure; never mutates the input. With the standard cap of 3 the three
 *  categories always fit, so the returned length is
 *  `min(previewMax, source.length)` — keeping the gates' re-derivation
 *  (`selectPreviewEffects(source, lineCount)`) idempotent. */
export function selectPreviewEffects(
  source: readonly EffectPreview[],
  previewMax: number,
): EffectPreview[] {
  if (previewMax <= 0) return []
  if (source.length <= previewMax) return source.slice()

  // Force-include the present must-surface indices, in priority order,
  // until the cap is full.
  const included = new Set<number>()
  for (const predicate of MUST_SURFACE_PREDICATES) {
    if (included.size >= previewMax) break
    const idx = source.findIndex((e) => predicate(e))
    if (idx >= 0) included.add(idx)
  }
  // Fill the remaining slots with the next effects in source order.
  for (let i = 0; i < source.length && included.size < previewMax; i += 1) {
    included.add(i)
  }
  // Return in source order.
  return [...included]
    .sort((a, b) => a - b)
    .map((i) => source[i]!)
}
