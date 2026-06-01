// Phase 161 / ISSUE-129 — Legible Surface arc, Phase 16.
//
// The Legibility Gate — Movement VIII centerpiece. A cross-template
// sibling gate analogous in shape to `crossSituation` (Phase 143):
// multi-template by construction, NOT added to `runAllGates`, invoked
// directly from `tests/cards/compose/gates/legibility.test.ts` against
// the registered migrated situations.
//
// Two questions, one report:
//
//   Q1 — establishing_off_salient.
//        For every (sample, slot-with-saliencePolicy) where
//        `resolveSalientReads(seed, state)` returns ≥1 fact AND a snippet
//        actually fired, assert the fired snippet's `scoreCandidateSalience`
//        index is finite. The Phase-1 / ISSUE-114 surface guarantees that
//        when salient candidates EXIST in the pool, `pickByTopSalience`
//        prefers them — so a finite-index fired snippet proves the pool
//        had at least one salient candidate the assembler chose. The
//        infinity-index failure mode is "the pool authored no salient
//        candidate at all and only an unconditional fallback or
//        unrelated voice-axis rung fired" — the "bare mood line when a
//        salient meter screams" defect the arc was written to prevent.
//
//   Q2 — preview legibility composed in-place.
//        For every sample: render the production `CardView` via
//        `template.toCardView(assembleSlots(...), seed, state)`. Walk
//        each `CardChoice`. Re-derive the per-line `EffectPreview` by
//        mirroring `composeChoicesFromSeed`'s effect-source logic
//        (`immediateEffects` unless empty, then `delayedEffects` for the
//        Phase-147 inaction carve-out, capped by line count). Three
//        rules, four reasons:
//
//          preview_magnitude_missing — an effect carries `magnitudeBand`
//            + `direction` but its rendered line contains no token from
//            `MAGNITUDE_LEXICON[direction][band]`. Sim fallback
//            (`line === effect.readable`) always counts as legible —
//            mirrors the per-template `previewVariety.requireMagnitude`
//            carve-out for sim authority.
//
//          preview_cost_unsurfaced — a choice carries any negative-
//            direction `coin` effect, and no rendered preview line
//            contains a coin keyword. The Phase-148 distinctness gate
//            warns on near-collisions; this gate FAILS on hidden cost.
//
//          preview_inaction_blank — a choice rendered zero preview lines.
//            The Phase-147 inaction wiring in `composeChoicesFromSeed`
//            sources from `delayedEffects` when `immediateEffects` is
//            empty, so this only fires when a profile carries no
//            consequences at all (a real regression, not a mis-wired
//            ignore choice).
//
//          choice_label_collision — two rendered choices with distinct
//            `(slotId, verb, targetId)` triples canonicalise to the same
//            label. Mirrors `choiceDistinctness.choice_label_collision`
//            but exercises the cross-template registry: a new template
//            that forgets to wire `choiceDistinctness` into its own
//            `runAllGates` config is still caught here.
//
// Phase 184 / ISSUE-152 — Choice-Preview Legibility arc, Phase 4 (the
// lock). Three more Q2 reasons make the Phase-1–3 fixes un-regressable:
//
//          preview_meter_unnamed — a previewed `state_change` line whose
//            backing effect's `meterId` is in the contracted leaf-named
//            allowlist (`DEFAULT_NAMED_METERS`) and which carries a
//            `meterLabel` must name that meter: the rendered line contains
//            a token derived from `meterLabel`. Sim fallback
//            (`line === effect.readable`) always counts as legible — same
//            carve-out the magnitude rule applies. The allowlist (not
//            "every meter") is load-bearing: Phase 3 only authored
//            leaf-naming prose for the high-traffic meters, so coin /
//            stock / area / long-tail-reputation lines that legitimately
//            name only the KIND must not fail; the allowlist names exactly
//            the meters proven leaf-named, and Phase 5 grows it. The
//            fallback template is excluded (its no-preview state is a
//            coverage matter owned by `complete-surface-arc.md`).
//
//          preview_duplicate_line — a single choice rendered two
//            canonically-identical preview lines. This is the rule
//            `previewVariety` deliberately omits (it permits within-choice
//            duplicates); the omission is reversed here on purpose. The
//            Phase-2 renderer collapses such repeats to the effect's
//            distinct `readable`, so the live suite is clean — this is the
//            belt-and-suspenders regression guard.
//
//          preview_risk_unsurfaced — a choice whose source effects carry a
//            decision-relevant `pressure`/risk change (`isRiskEffect`, the
//            Phase-2 priority-3 predicate) but whose shared
//            `selectPreviewEffects(source, lineCount)` set surfaces no risk
//            effect. Reuses the exact predicate + selection the renderer
//            uses, so gate and renderer never disagree about "shown".
//
// `pass === violations.length === 0`. No warnings — every legibility
// failure is a structural defect.
//
// Pure: no I/O, no `Math.random`. Same `LegibilityConfig` ⇒ same report,
// because every sample's `(seed, state)` and the assembler are
// deterministic.

import { pickSnippetTrace, assembleSlots } from '../assemble'
import {
  selectPreviewEffects,
  isRiskEffect,
  isDecisionRelevantDelayed,
  isLaterPreviewLine,
} from '../previewSelect'
import { evalCondition } from '../conditions'
import { canonicaliseText } from './dedupe'
import {
  MAGNITUDE_LEXICON,
  lineCarriesMagnitude,
} from '../magnitudeLexicon'
import {
  resolveSalientReads,
  scoreCandidateSalience,
  type ResolvedRead,
  type SalienceRead,
} from '../salience'
import type {
  CompositionalCardTemplate,
  ConditionContext,
  Snippet,
  SnippetPool,
} from '../types'
import type {
  EffectDirection,
  EffectMagnitudeBand,
} from '../../../sim/core/effect'
import type { IssueSeed } from '../../../sim/modules/issues/issueSeedTypes'
import type { TavernState } from '../../../sim/state/TavernState'
import { DEFAULT_TARGET_KIND_KEYWORDS } from './previewVariety'
import { failReport, type GateReport, type GateViolation } from './types'

/** One sampled `(seed, state)` pair for a legibility check. The harness
 *  builds these per situation; the gate consumes them verbatim. The
 *  optional `maxPreview` overrides the per-template choice-preview cap
 *  for sample-level control; default 3 (matches
 *  `composeChoicesFromSeed`'s `MAX_PREVIEW`). */
export type LegibilitySample = {
  seed: IssueSeed
  state: TavernState
  maxPreview?: number
}

/** One migrated situation — a compositional template plus a deterministic
 *  sample factory. Iterated by `checkLegibility` against the registry of
 *  20 migrated templates (the `REQUIRED_CARDS` minus `fallbackCard`).
 *  Same structural shape as `CrossSituationActorKind` from Phase 143. */
export type LegibilitySituation = {
  templateId: string
  template: CompositionalCardTemplate
  /** Build a list of samples for this situation. Pure factory — same
   *  call ⇒ same list. Most situations return 3-5 samples covering
   *  realistic state perturbations (low/mid/high meter bands,
   *  representative pressure / memory / inaction routing). */
  buildSamples: () => readonly LegibilitySample[]
}

/** Per-situation tallies the gate records for diagnostics. Surfaced in
 *  the report so tests can sanity-check coverage without retracing gate
 *  logic. */
export type LegibilitySituationObservation = {
  templateId: string
  /** Total samples evaluated for this situation. */
  samplesEvaluated: number
  /** Count of (sample, saliencePolicy-slot) pairs where
   *  `resolveSalientReads` returned ≥1 fact AND a snippet fired. */
  salienceReadsResolved: number
  /** Count of those where the fired snippet covered ≥1 resolved read
   *  (i.e. `scoreCandidateSalience.index < Infinity`). */
  salienceReadsCovered: number
  /** Choice-set sizes after `applyLegibleChoiceCap` ran inside
   *  `composeChoicesFromSeed`. Surfaces whether the cap actually
   *  engaged (length > 0 always; supplier-size cards land at 6, smaller
   *  ones at their full slot count). */
  choiceSetSizesAfterCap: readonly number[]
  /** Total effects encountered that carried both `magnitudeBand` and
   *  `direction` (i.e. eligible for the requireMagnitude rule). */
  magnitudeChecksRun: number
  /** Count of those that failed (rendered line carried no
   *  magnitude-lexicon token AND was not the sim fallback). */
  magnitudeChecksFailed: number
  /** Total choices that carried any negative-direction coin effect. */
  costSurfacingChecksRun: number
  /** Count of those whose preview surfaced no coin keyword. */
  costSurfacingChecksFailed: number
  /** Count of choices that rendered zero preview lines. */
  inactionBlankCount: number
  /** Count of `choice_label_collision` violations recorded for this
   *  situation across all its samples. */
  labelCollisionsCount: number
  // Phase 184 / ISSUE-152 — Choice-Preview Legibility arc, Phase 4.
  /** State-change preview lines whose `meterId` was in the allowlist and
   *  carried a `meterLabel` (i.e. eligible for the meter-naming rule). */
  meterNamingChecksRun: number
  /** Count of those whose rendered line named neither the meter label nor
   *  was the sim fallback. */
  meterNamingChecksFailed: number
  /** Count of `preview_duplicate_line` violations (a choice rendering two
   *  canonically-identical preview lines). */
  duplicateLineCount: number
  /** Choices whose source effects carried a decision-relevant `pressure`
   *  risk change (eligible for the risk-surfacing rule). */
  riskSurfacingChecksRun: number
  /** Count of those whose preview surfaced no risk effect. */
  riskSurfacingChecksFailed: number
  // Phase 189 / ISSUE-156 — Consequence-Legible Choices.
  /** Active choices whose consequence profile carried a decision-relevant
   *  delayed effect (eligible for the delayed-surfacing rule). */
  delayedSurfacingChecksRun: number
  /** Count of those whose preview surfaced no `later:` line. */
  delayedSurfacingChecksFailed: number
}

export type LegibilityConfig = {
  situations: readonly LegibilitySituation[]
  /** Override the magnitude lexicon. Defaults to `MAGNITUDE_LEXICON`. */
  magnitudeLexicon?: Record<
    EffectDirection,
    Record<EffectMagnitudeBand, readonly string[]>
  >
  /** Override the coin-keyword list used by `preview_cost_unsurfaced`.
   *  Defaults to `DEFAULT_TARGET_KIND_KEYWORDS.coin`. */
  coinKeywords?: readonly string[]
  // Phase 184 / ISSUE-152 — Choice-Preview Legibility arc, Phase 4.
  /** The set of meter leaves (`effect.meterId`) the `preview_meter_unnamed`
   *  rule requires to be leaf-named in the rendered preview line. Defaults
   *  to `DEFAULT_NAMED_METERS` — the meters Phase 3 authored leaf-naming
   *  prose for and that are verified 100%-named across the live samples.
   *  Phase 5 grows this as more meters gain band-complete leaf prose. */
  requireMeterNaming?: readonly string[]
}

export type LegibilityReport = GateReport & {
  observed: {
    situations: LegibilitySituationObservation[]
  }
}

export const LEGIBILITY_REASONS = Object.freeze([
  'establishing_off_salient',
  'preview_magnitude_missing',
  'preview_cost_unsurfaced',
  'preview_inaction_blank',
  'choice_label_collision',
  // Phase 184 / ISSUE-152 — Choice-Preview Legibility arc, Phase 4.
  'preview_meter_unnamed',
  'preview_duplicate_line',
  'preview_risk_unsurfaced',
  // Phase 189 / ISSUE-156 — Consequence-Legible Choices.
  'preview_delayed_unsurfaced',
] as const)

export type LegibilityReason = (typeof LEGIBILITY_REASONS)[number]

// Phase 184 / ISSUE-152 — Choice-Preview Legibility arc, Phase 4.
//
// The meters the `preview_meter_unnamed` rule requires to be leaf-named.
// This is a CONTRACTED set, not "every meter": Phase 3 authored leaf-naming
// preview prose only for the high-traffic meters the audit sweep named, and
// the coarse base remains the fallback for the rest (coin renders as
// silver/till, stock as shelves, reputation as repute — naming the KIND, not
// the leaf, which is what the specificity rule governs). A blanket rule would
// fail ~49% of live lines and, worse, a kind-keyword carve-out would make it
// toothless against the defining defect (loyalty/morale/stress all rendered
// as the fictional "trust", whose line still carried the staff keyword
// "crew"). So the rule fires only for meters whose LEAF is contractually
// named and verified named in every live sample. Phase 5 grows this set as it
// completes band coverage for cheap / dangerous / respectable / relationship /
// trust and the other shared-kind leaves. Plain enumerable data, mirroring
// `DEFAULT_TARGET_KIND_KEYWORDS`.
export const DEFAULT_NAMED_METERS: readonly string[] = Object.freeze([
  'loyalty',
  'morale',
  'stress',
  'fatigue',
  'satisfaction',
  'patronage',
  'reliable',
  'tasty',
])

// The fallback card is excluded from `preview_meter_unnamed` (its no-preview
// state is a coverage matter owned by `complete-surface-arc.md`, not a
// preview-legibility defect). Referenced as a local constant rather than
// imported from `src/cards/templates/fallback.ts` because `compose/` must not
// import `templates/` — that would invert the layering (`templates/` imports
// `compose/`, never the reverse). Kept in lockstep with `FALLBACK_CARD_ID`
// there. The fallback is not in `LEGIBILITY_SITUATIONS` anyway, so this is a
// belt-and-suspenders decoupling guard.
const FALLBACK_TEMPLATE_ID = 'fallback.everySeed'

export function checkLegibility(config: LegibilityConfig): LegibilityReport {
  const magnitudeLexicon = config.magnitudeLexicon ?? MAGNITUDE_LEXICON
  const coinKeywords = config.coinKeywords ?? DEFAULT_TARGET_KIND_KEYWORDS.coin
  const namedMeters = new Set(config.requireMeterNaming ?? DEFAULT_NAMED_METERS)
  const violations: GateViolation[] = []
  const situationObservations: LegibilitySituationObservation[] = []

  for (const situation of config.situations) {
    const samples = situation.buildSamples()
    let samplesEvaluated = 0
    let salienceReadsResolved = 0
    let salienceReadsCovered = 0
    const choiceSetSizesAfterCap: number[] = []
    let magnitudeChecksRun = 0
    let magnitudeChecksFailed = 0
    let costSurfacingChecksRun = 0
    let costSurfacingChecksFailed = 0
    let inactionBlankCount = 0
    let labelCollisionsCount = 0
    let meterNamingChecksRun = 0
    let meterNamingChecksFailed = 0
    let duplicateLineCount = 0
    let riskSurfacingChecksRun = 0
    let riskSurfacingChecksFailed = 0
    let delayedSurfacingChecksRun = 0
    let delayedSurfacingChecksFailed = 0
    // Phase 184 — the meter rule is skipped for the fallback template. Phase
    // 189 — the delayed rule excludes it for the same reason (the fallback's
    // no-preview state is a coverage matter, not a legibility defect).
    const meterRuleApplies = situation.templateId !== FALLBACK_TEMPLATE_ID

    for (let i = 0; i < samples.length; i += 1) {
      const sample = samples[i]!
      samplesEvaluated += 1

      // ---- Q1: establishing-salience check ----
      // Two refinements on top of "fail when fired snippet covers no
      // resolved read":
      //
      //   (1) Filter mid-band signal reads from "meaningfully salient."
      //       `resolveSalientReads` returns every read that holds —
      //       including mid-band signal reads (extremity 1). Mid bands
      //       are the intentionally-unauthored default across all
      //       Movement-VI pools: a supplier at mid reliability + mid
      //       relationship is "no particular story," and the
      //       establishing-line fallback IS that story. Pressures /
      //       memories / repeats / hasTag / severity are inherently
      //       binary — when they resolve they're salient by
      //       construction (extremity 1 is their fired weight, not a
      //       "default" reading).
      //
      //   (2) Fire only when the pool HAS a state-matching covering
      //       snippet that the assembler didn't pick. Without this, the
      //       gate flags every state combination the pool deliberately
      //       didn't author for (e.g., regularComplaint never sees
      //       irritation=low because the `complaint` seed type fires
      //       only at irritation > 60; the pool's silence on
      //       irritation=low is by design, not a gradient-over-salience
      //       failure). With this, the gate fires only on the case the
      //       arc was written to prevent: a covering snippet exists in
      //       the pool, would have matched, but the gradient picked a
      //       non-covering higher-specificity sibling.
      const resolved = resolveSalientReads(sample.seed, sample.state)
      const meaningful = resolved.filter(
        (r) => !(r.read.kind === 'signal' && r.extremity <= 1),
      )
      if (meaningful.length > 0) {
        for (const slot of situation.template.slots) {
          if (!slot.saliencePolicy) continue
          const trace = pickSnippetTrace(slot, sample.seed, sample.state, {})
          if (!trace) continue
          salienceReadsResolved += 1
          const score = scoreCandidateSalience(trace, meaningful)
          if (score.index !== Infinity) {
            salienceReadsCovered += 1
            continue
          }
          // Picked snippet doesn't cover any meaningful read. Check
          // whether a covering snippet EXISTS in the pool and would
          // match the current state — if so, the gradient/specificity
          // suppressed it and authoring needs adjustment.
          const missedCover = poolHasMatchingCoveringSnippet(
            slot.pool,
            meaningful,
            sample.seed,
            sample.state,
            {},
          )
          if (missedCover) {
            violations.push({
              slotId: slot.id,
              snippetId: trace.id,
              reason: 'establishing_off_salient',
              detail: `${situation.templateId} sample ${i}: slot "${slot.id}" fired "${trace.id}" (covers no meaningful read) but pool contains a state-matching covering snippet "${missedCover.id}" the gradient overrode. Resolved reads: ${formatResolvedSummary(meaningful)}`,
            })
          }
        }
      }

      // ---- Q2: render the production CardView via the template's own
      // `toCardView` so the cap, voice composition, and choice ordering
      // are exactly what the player would see. The template's
      // `composeChoicesFromSeed` call inside applies the legible cap and
      // threads `inactionPreview`; we just inspect the rendered output.
      const filled = assembleSlots(situation.template.slots, sample.seed, sample.state)
      const cardView = situation.template.toCardView(filled, sample.seed, sample.state)
      choiceSetSizesAfterCap.push(cardView.choices.length)

      const renderedChoices: RenderedLegibleChoice[] = []
      for (const choice of cardView.choices) {
        const profile = sample.seed.consequenceProfiles.find(
          (p) => p.responseSlotId === choice.slotId,
        )
        const lineCount = choice.previewEffects.length

        // Phase 147 inaction routing mirror.
        const immediate = profile?.immediateEffects ?? []
        const delayed = profile?.delayedEffects ?? []
        const useDelayed = immediate.length === 0 && delayed.length > 0
        // Phase 189 / ISSUE-156 — an active choice may carry a trailing
        // `later:` delayed-consequence line appended past the immediate cap.
        // It is NOT a `source` effect, so re-derive the immediate effects
        // against the count of the immediate (non-`later:`) lines only; the
        // trailing `later:` line then maps to `effects[idx] === undefined` and
        // the per-line magnitude / meter rules skip it (they own the immediate
        // previews; the delayed line has its own rule below).
        const immediateLineCount = choice.previewEffects.filter(
          (l) => !isLaterPreviewLine(l),
        ).length
        // Phase 166 / ISSUE-134 — mirror the renderer's cost-surfacing
        // selection exactly. `immediateLineCount` is the number of immediate
        // lines the production renderer emitted (its own `maxPreview`);
        // `selectPreviewEffects(source, immediateLineCount)` reproduces the same
        // effects in the same order, so `effects[lineIdx]` is the true backing
        // effect for `choice.previewEffects[lineIdx]`.
        const source = useDelayed ? delayed : immediate
        const effects = selectPreviewEffects(source, immediateLineCount)

        // Phase 189 / ISSUE-156 — preview_delayed_unsurfaced. An ACTIVE choice
        // (immediate effects present) whose profile authored a decision-
        // relevant delayed consequence must surface at least one `later:` line
        // — the analogue of `preview_cost_unsurfaced`, for the delayed axis.
        // The inaction path (`useDelayed`) is exempt: it already previews its
        // delayed effects directly (Phase 147), without a `later:` prefix.
        if (meterRuleApplies && !useDelayed && delayed.some(isDecisionRelevantDelayed)) {
          delayedSurfacingChecksRun += 1
          const surfaced = choice.previewEffects.some(isLaterPreviewLine)
          if (!surfaced) {
            delayedSurfacingChecksFailed += 1
            violations.push({
              slotId: choice.slotId,
              reason: 'preview_delayed_unsurfaced',
              detail: `${situation.templateId} sample ${i}: choice "${choice.slotId}" carries a decision-relevant delayed consequence that no rendered "later:" preview line surfaced`,
            })
          }
        }

        // forbidInactionBlank — a choice with NO rendered lines AND a
        // profile carrying no consequences at all (no immediate AND no
        // delayed) is a structural blank. A profile with only delayed
        // effects renders via the Phase-147 inaction path and produces
        // lines from the delayed effects, so it should never hit this.
        if (lineCount === 0) {
          inactionBlankCount += 1
          violations.push({
            slotId: choice.slotId,
            reason: 'preview_inaction_blank',
            detail: `${situation.templateId} sample ${i}: choice "${choice.slotId}" rendered zero preview lines (profile: ${immediate.length} immediate, ${delayed.length} delayed)`,
          })
        }

        // requireMagnitude — per-line check.
        for (let lineIdx = 0; lineIdx < lineCount; lineIdx += 1) {
          const line = choice.previewEffects[lineIdx]!
          const effect = effects[lineIdx]
          if (!effect) continue
          // Phase 166 / ISSUE-134 — `future_hook` (a narrative recurrence
          // hook, "a complaint loops back round") and `cause`
          // (attribution writes) carry a classified magnitudeBand because
          // `effect()` bands any non-zero amount, but their band is not
          // player-facing magnitude the way a metered `state_change` /
          // `pressure` is. The previewVariety design already treats such
          // effects as band-less; the magnitude rule applies only to the
          // metered kinds.
          if (effect.kind === 'future_hook' || effect.kind === 'cause') continue
          const band = effect.magnitudeBand
          const direction = effect.direction
          if (band === undefined || direction === undefined) continue
          magnitudeChecksRun += 1
          // Sim fallback always counts (same carve-out previewVariety
          // applies). Heuristic: the composer falls through to
          // `effect.readable` when the snippet pool returned undefined;
          // a verbatim equality is the cleanest proxy.
          if (line === effect.readable) continue
          if (lineCarriesMagnitude(line, direction, band, magnitudeLexicon)) continue
          magnitudeChecksFailed += 1
          violations.push({
            slotId: choice.slotId,
            reason: 'preview_magnitude_missing',
            detail: `${situation.templateId} sample ${i}: choice "${choice.slotId}" effect #${lineIdx} (${direction}/${band}): "${line}" lacks magnitude token`,
          })
        }

        // Phase 184 — preview_meter_unnamed. A previewed state_change line
        // whose meter is in the contracted leaf-named allowlist must name
        // that meter. Sim fallback (`line === effect.readable`) is always
        // legible, mirroring the magnitude carve-out above. Skipped for the
        // fallback template (coverage, not legibility — see
        // FALLBACK_TEMPLATE_ID).
        for (let lineIdx = 0; meterRuleApplies && lineIdx < lineCount; lineIdx += 1) {
          const line = choice.previewEffects[lineIdx]!
          const effect = effects[lineIdx]
          if (!effect) continue
          if (effect.kind !== 'state_change') continue
          const meterId = effect.meterId
          const meterLabel = effect.meterLabel
          if (meterId === undefined || meterLabel === undefined) continue
          if (!namedMeters.has(meterId)) continue
          meterNamingChecksRun += 1
          if (line === effect.readable) continue
          if (lineNamesMeter(line, meterLabel)) continue
          meterNamingChecksFailed += 1
          violations.push({
            slotId: choice.slotId,
            reason: 'preview_meter_unnamed',
            detail: `${situation.templateId} sample ${i}: choice "${choice.slotId}" effect #${lineIdx} moves "${meterId}" (label "${meterLabel}") but the line "${line}" names no token from it`,
          })
        }

        // Phase 184 — preview_duplicate_line. No choice may render two
        // canonically-identical preview lines. The Phase-2 renderer collapses
        // such repeats to the effect's distinct `readable`, so the live suite
        // is clean — this is the regression guard for that policy.
        const seenLines = new Set<string>()
        for (const previewLine of choice.previewEffects) {
          const canonical = canonicaliseText(previewLine)
          if (seenLines.has(canonical)) {
            duplicateLineCount += 1
            violations.push({
              slotId: choice.slotId,
              reason: 'preview_duplicate_line',
              detail: `${situation.templateId} sample ${i}: choice "${choice.slotId}" rendered the line "${previewLine}" twice`,
            })
          }
          seenLines.add(canonical)
        }

        // Phase 184 — preview_risk_unsurfaced. A choice whose source effects
        // carry a decision-relevant pressure/risk change must surface it. The
        // shared `selectPreviewEffects` force-includes risk (priority 3) within
        // the cap, so `effects` (re-derived above) contains it whenever it fits;
        // it falls out only when the render cap is too tight to hold it. Reusing
        // `isRiskEffect` + `selectPreviewEffects` keeps the gate and renderer
        // agreed on what "shown" means.
        const sourceHasRisk = source.some(isRiskEffect)
        if (sourceHasRisk) {
          riskSurfacingChecksRun += 1
          if (!effects.some(isRiskEffect)) {
            riskSurfacingChecksFailed += 1
            violations.push({
              slotId: choice.slotId,
              reason: 'preview_risk_unsurfaced',
              detail: `${situation.templateId} sample ${i}: choice "${choice.slotId}" carries a decision-relevant pressure/risk change that no rendered preview line surfaced (source ${source.length} effects, ${lineCount} rendered)`,
            })
          }
        }

        // requireCostSurfacing — per-choice check across all rendered lines.
        const spendsCoin = effects.some(
          (e) => e.targetKind === 'coin' && e.direction === 'negative',
        )
        if (spendsCoin) {
          costSurfacingChecksRun += 1
          const surfaced = choice.previewEffects.some((line) =>
            lineContainsAny(line, coinKeywords),
          )
          if (!surfaced) {
            costSurfacingChecksFailed += 1
            violations.push({
              slotId: choice.slotId,
              reason: 'preview_cost_unsurfaced',
              detail: `${situation.templateId} sample ${i}: choice "${choice.slotId}" spends coin but no preview line surfaced a coin keyword`,
            })
          }
        }

        renderedChoices.push({
          slotId: choice.slotId,
          verb: choice.verb,
          targetId: choice.targetId,
          label: choice.label,
          canonicalLabel: canonicaliseText(choice.label),
        })
      }

      // Q2b — label collisions across distinct mechanical identities.
      for (let a = 0; a < renderedChoices.length; a += 1) {
        for (let b = a + 1; b < renderedChoices.length; b += 1) {
          const A = renderedChoices[a]!
          const B = renderedChoices[b]!
          if (sameMechanicalIdentity(A, B)) continue
          if (A.canonicalLabel === B.canonicalLabel) {
            labelCollisionsCount += 1
            violations.push({
              slotId: A.slotId,
              reason: 'choice_label_collision',
              detail: `${situation.templateId} sample ${i}: "${A.label}" rendered for both ${A.slotId} (${A.verb}) and ${B.slotId} (${B.verb})`,
            })
          }
        }
      }
    }

    situationObservations.push({
      templateId: situation.templateId,
      samplesEvaluated,
      salienceReadsResolved,
      salienceReadsCovered,
      choiceSetSizesAfterCap,
      magnitudeChecksRun,
      magnitudeChecksFailed,
      costSurfacingChecksRun,
      costSurfacingChecksFailed,
      inactionBlankCount,
      labelCollisionsCount,
      meterNamingChecksRun,
      meterNamingChecksFailed,
      duplicateLineCount,
      riskSurfacingChecksRun,
      riskSurfacingChecksFailed,
      delayedSurfacingChecksRun,
      delayedSurfacingChecksFailed,
    })
  }

  const base = failReport(violations)
  return {
    pass: base.pass,
    violations: base.violations,
    observed: { situations: situationObservations },
  }
}

/** Walk the pool for a snippet whose conditions all evaluate true
 *  against `(seed, state, ctx)` AND whose `scoreCandidateSalience`
 *  index is finite (i.e. covers at least one of the resolved meaningful
 *  reads). When such a snippet exists, the gradient is suppressing
 *  salience-aware picking — the gate's `establishing_off_salient`
 *  failure mode. Returns the first match (or undefined). Pure. */
function poolHasMatchingCoveringSnippet(
  pool: SnippetPool,
  meaningful: readonly ResolvedRead[],
  seed: IssueSeed,
  state: TavernState,
  ctx: ConditionContext,
): Snippet | undefined {
  for (const snippet of pool.snippets) {
    if (!snippet.conditions.every((c) => evalCondition(c, seed, state, ctx))) {
      continue
    }
    const score = scoreCandidateSalience(snippet, meaningful)
    if (score.index !== Infinity) return snippet
  }
  return undefined
}

type RenderedLegibleChoice = {
  slotId: string
  verb: string
  targetId: string | undefined
  label: string
  canonicalLabel: string
}

function sameMechanicalIdentity(
  a: RenderedLegibleChoice,
  b: RenderedLegibleChoice,
): boolean {
  return a.slotId === b.slotId && a.verb === b.verb && a.targetId === b.targetId
}

function lineContainsAny(line: string, tokens: readonly string[]): boolean {
  if (tokens.length === 0) return false
  const haystack = line.toLowerCase()
  return tokens.some((tok) => haystack.includes(tok.toLowerCase()))
}

// Phase 184 / ISSUE-152 — Choice-Preview Legibility arc, Phase 4.
//
// Split a meter label into its naming tokens — the ≥3-char words of the
// label. Single-word labels (`loyalty`, `morale`, `tasty`) yield one token;
// multi-word labels (`culinary renown`, `sale price`, `goblin-authentic`)
// yield each significant word so a line naming any of them counts. Short
// connective fragments (≤2 chars) are dropped so they can't match on noise.
function meterLabelTokens(label: string): string[] {
  return label
    .toLowerCase()
    .split(/[\s_-]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3)
}

/** True when the rendered line names the meter: it contains the full label
 *  as a case-insensitive substring, or any of the label's ≥3-char word
 *  tokens. Substring matching mirrors `lineCarriesMagnitude` /
 *  `lineContainsAny`. */
function lineNamesMeter(line: string, meterLabel: string): boolean {
  const haystack = line.toLowerCase()
  if (haystack.includes(meterLabel.toLowerCase())) return true
  return meterLabelTokens(meterLabel).some((tok) => haystack.includes(tok))
}

/** Short summary of the first few resolved reads, for failure-detail
 *  diagnostics. Authors reading a violation should immediately see which
 *  fact was on offer when the establishing line picked a non-salient
 *  snippet. */
function formatResolvedSummary(resolved: readonly ResolvedRead[]): string {
  return resolved
    .slice(0, 3)
    .map((r) => describeRead(r.read))
    .join(', ')
}

function describeRead(read: SalienceRead): string {
  switch (read.kind) {
    case 'signal':
      return `signal ${read.signal}`
    case 'pressure':
      return `pressure ${read.pressureId}`
    case 'memory':
      return `memory ${read.tag}`
    case 'repeat':
      return `repeat ${read.subjectTag}>=${read.atLeast}`
    case 'hasTag':
      return `tag ${read.tag}`
    case 'severity':
      return `severity>=${read.atLeast}`
  }
}

