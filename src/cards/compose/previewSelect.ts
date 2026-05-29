// Phase 166 / ISSUE-134 — Faithful Surface arc, Phase 4.
//
// Shared preview-effect selection policy. Both the production renderer
// (`composeChoicesFromSeed` in `cardHelpers.ts`) and the cross-template
// legibility gate must select the SAME effects to preview, in the same
// order, or the gate pairs a rendered line with the wrong backing
// effect. Extracted here (depends only on the `EffectPreview` type) so
// neither side re-implements it and they can never drift.

import type { EffectPreview } from '../../sim/core/effect'

/** Select the effects a choice should preview, capped at `previewMax`,
 *  guaranteeing a coin-cost line is surfaced within the cap. Returns the
 *  first `previewMax` effects in source order, except that when a
 *  negative-direction coin effect sits past the cap it is pulled into
 *  the final previewed slot (displacing the lowest-priority in-cap
 *  effect). The player must always see when a choice spends coin. Pure;
 *  never mutates the input. */
export function selectPreviewEffects(
  source: readonly EffectPreview[],
  previewMax: number,
): EffectPreview[] {
  const head = source.slice(0, previewMax)
  if (previewMax <= 0) return head
  const isCost = (e: EffectPreview) =>
    e.targetKind === 'coin' && e.direction === 'negative'
  if (head.some(isCost)) return head
  const costIdx = source.findIndex(isCost)
  if (costIdx < 0) return head
  // Keep the leading (previewMax - 1) effects, then the cost effect.
  return [...source.slice(0, previewMax - 1), source[costIdx]!]
}
