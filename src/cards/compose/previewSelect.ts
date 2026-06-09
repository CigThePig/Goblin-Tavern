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
import type { ChoiceContract } from '../../sim/modules/issues/issueSeedTypes'

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
 *  (`future_hook` recurrence hooks, `risk` futureHook markers). Phase 3 keeps
 *  these tags as compatibility markers, then broadens delayed relevance below
 *  with metadata-based payoff/risk detection. */
export const DELAYED_RELEVANCE_TAGS: readonly string[] = Object.freeze([
  'future_hook',
  'risk',
])

/** A delayed effect the player should see flagged as a later consequence: a
 *  `future_hook` (the escalation/expectation recurrence hook), any delayed
 *  effect carrying one of `DELAYED_RELEVANCE_TAGS`, or a mechanically legible
 *  payoff/risk movement. Phase 3 of the card-choice coherence repair expands
 *  delayed relevance beyond explicit tags: untagged long-term payoffs such as
 *  area condition gains and maintenance-pressure relief are strategically
 *  decisive, so they must be eligible for `later:` previews too. */
export function isDecisionRelevantDelayed(e: EffectPreview): boolean {
  if (e.kind === 'future_hook') return true
  if (e.tags.some((t) => DELAYED_RELEVANCE_TAGS.includes(t))) return true
  return isDelayedBenefitEffect(e) || isDelayedRiskEffect(e)
}

/** True when a delayed effect is a payoff/benefit the player should understand.
 *  `effect()` has already made lower-is-better state meters valence-aware, so a
 *  `positive` direction means a good movement for normal state changes. Pressure
 *  intentionally keeps raw sign semantics elsewhere in the codebase: negative
 *  pressure is relief, and is therefore a benefit even though its `direction` is
 *  `negative`. */
export function isDelayedBenefitEffect(e: EffectPreview): boolean {
  if (e.kind !== 'state_change' && e.kind !== 'pressure') return false
  if (e.targetKind === 'coin') return e.direction === 'positive'
  if (e.targetKind === 'pressure') return e.direction === 'negative'
  return e.direction === 'positive'
}

/** True when a delayed effect is a future downside/risk. Lower-is-better state
 *  meters are already valence-aware (`negative` = bad), while pressure increases
 *  are raw-sign badness (`positive` = rising pressure/risk). */
export function isDelayedRiskEffect(e: EffectPreview): boolean {
  if (e.kind === 'future_hook') return true
  if (e.tags.includes('risk')) return true
  if (e.kind !== 'state_change' && e.kind !== 'pressure') return false
  if (e.targetKind === 'pressure') return e.direction === 'positive'
  return e.direction === 'negative'
}

function magnitudeRank(e: EffectPreview): number {
  return Math.abs(e.amount ?? 0)
}

function pickLargest(
  source: readonly EffectPreview[],
  predicate: (e: EffectPreview) => boolean,
  exclude: ReadonlySet<number>,
): number | undefined {
  let bestIndex: number | undefined
  let bestMagnitude = -1
  for (let i = 0; i < source.length; i += 1) {
    if (exclude.has(i)) continue
    const e = source[i]!
    if (!predicate(e)) continue
    const mag = magnitudeRank(e)
    if (bestIndex === undefined || mag > bestMagnitude) {
      bestIndex = i
      bestMagnitude = mag
    }
  }
  return bestIndex
}

function isProjectPayoff(e: EffectPreview): boolean {
  if (!isDelayedBenefitEffect(e)) return false
  // For long-term investments, pressure relief is often the second half of the
  // payoff ("maintenance pressure eases") rather than a generic risk note. Keep
  // it eligible alongside the primary state payoff.
  return true
}

/** Pick the delayed effects to surface as additive `later:` lines. Phase 189
 *  showed one tagged delayed consequence; card-choice coherence Phase 3 makes
 *  the selection role-based. The immediate preview cap is intentionally not
 *  shared with these lines: delayed role lines remain additive, as the Phase 189
 *  cost-preservation policy did, so a surfaced coin cost or immediate benefit is
 *  never displaced by long-term payoff/risk explanation.
 *
 *  Role order is stable and reader-friendly:
 *    1. delayed benefit/payoff (two for major projects so condition payoff and
 *       pressure relief can both explain the investment),
 *    2. delayed risk/downside,
 *    3. future hook when distinct from the risk already selected.
 */
export function selectDelayedPreviewEffects(
  delayed: readonly EffectPreview[],
  contract?: ChoiceContract,
): EffectPreview[] {
  if (delayed.length === 0) return []

  const selected = new Set<number>()
  const push = (idx: number | undefined) => {
    if (idx !== undefined) selected.add(idx)
  }

  const archetype = contract?.archetype
  const wantsMajorProjectPayoff =
    archetype === 'major_project' || contract?.mustShowDelayedPayoff === true

  if (wantsMajorProjectPayoff) {
    push(pickLargest(delayed, isProjectPayoff, selected))
    push(pickLargest(delayed, isProjectPayoff, selected))
  } else {
    push(pickLargest(delayed, isDelayedBenefitEffect, selected))
  }

  push(pickLargest(delayed, isDelayedRiskEffect, selected))
  push(pickLargest(delayed, (e) => e.kind === 'future_hook', selected))

  // If older content only marks relevance with tags, still surface the largest
  // tagged entry rather than dropping the established Phase 189 behaviour.
  if (selected.size === 0) {
    push(pickLargest(delayed, isDecisionRelevantDelayed, selected))
  }

  return [...selected]
    .sort((a, b) => a - b)
    .map((i) => delayed[i]!)
}

/** Back-compat helper for tests/gates that still need a single delayed line.
 *  New renderer code uses `selectDelayedPreviewEffects` so multiple role lines
 *  can explain a long-term option. */
export function selectDelayedPreviewEffect(
  delayed: readonly EffectPreview[],
  contract?: ChoiceContract,
): EffectPreview | undefined {
  const selected = selectDelayedPreviewEffects(delayed, contract)
  if (selected.length === 0) return undefined
  return selected.reduce((best, current) =>
    magnitudeRank(current) > magnitudeRank(best) ? current : best,
  )
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
