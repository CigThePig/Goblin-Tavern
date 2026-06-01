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

// ---- delayed-effect decision-relevance (Phase 189 / ISSUE-156) ----
//
// The rendering convention for a delayed-consequence preview line: the composed
// line (meter-named exactly like an immediate preview), prefixed with `later: `.
// Defined here — the lowest shared layer — so the renderer (`cardHelpers`) and
// both cross-template gates (`legibility`, `faithfulness`) split immediate from
// delayed lines with one definition and never drift.
export const LATER_PREVIEW_PREFIX = 'later: '

/** True when a rendered preview line is a Phase-189 delayed-consequence line. */
export function isLaterPreviewLine(line: string): boolean {
  return line.startsWith(LATER_PREVIEW_PREFIX)
}

//
// Choice-Preview Legibility arc completion. `selectPreviewEffects` above ranks
// within a single `source` (immediate OR — on the inaction carve-out — delayed).
// For an ACTIVE choice that source is `immediate`, so the delayed consequences a
// profile authors (what the choice sets up for LATER) never reach the preview.
// These two exports let the renderer surface ONE decision-relevant delayed
// effect as a trailing `later:` line, and let the legibility gate assert it did.
// Shared here — same discipline as the immediate predicates — so the renderer
// and the gate never disagree about which delayed effects are "consequential."

/** Tags that mark a delayed effect as a consequence worth surfacing: the
 *  escalation / expectation / risk hooks the consequence profiles emit
 *  (`future_hook` recurrence hooks, `risk` futureHook markers). Plain
 *  bookkeeping delayed effects (an un-tagged pressure drift) are not
 *  decision-relevant on their own — the player learns nothing actionable from
 *  "a meter will drift" that the immediate previews didn't already imply. */
export const DELAYED_RELEVANCE_TAGS: readonly string[] = Object.freeze([
  'future_hook',
  'risk',
])

/** A delayed effect the player should see flagged as a later consequence: a
 *  `future_hook` (the escalation/expectation recurrence hook) or any delayed
 *  effect carrying one of `DELAYED_RELEVANCE_TAGS`. Used identically by the
 *  renderer's `selectDelayedPreviewEffect` and the gate's
 *  `preview_delayed_unsurfaced` rule. */
export function isDecisionRelevantDelayed(e: EffectPreview): boolean {
  if (e.kind === 'future_hook') return true
  return e.tags.some((t) => DELAYED_RELEVANCE_TAGS.includes(t))
}

/** Pick at most ONE decision-relevant delayed effect to surface as a `later:`
 *  line, or `undefined` when the profile authors none. Ranks the relevant
 *  entries by (1) carrying a relevance tag / being a `future_hook`, then
 *  (2) magnitude (larger |amount| first), then (3) source order — a small,
 *  deterministic ranker analogous to `selectPreviewEffects`. Pure; never
 *  mutates the input. */
export function selectDelayedPreviewEffect(
  delayed: readonly EffectPreview[],
): EffectPreview | undefined {
  let best: EffectPreview | undefined
  let bestIndex = -1
  for (let i = 0; i < delayed.length; i += 1) {
    const e = delayed[i]!
    if (!isDecisionRelevantDelayed(e)) continue
    if (best === undefined) {
      best = e
      bestIndex = i
      continue
    }
    const eMag = Math.abs(e.amount ?? 0)
    const bestMag = Math.abs(best.amount ?? 0)
    if (eMag > bestMag) {
      best = e
      bestIndex = i
    }
    // Equal magnitude keeps the earlier (lower source index) entry — `best`
    // was set first, so nothing to do; `bestIndex` documents the tie-break.
  }
  void bestIndex
  return best
}

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
