// Phase 167 / ISSUE-135 — Faithful Surface arc, Phase 5 (Close the Loop).
//
// The standing cross-sim faithfulness audit. A multi-template sibling
// gate analogous in shape to `crossSituation` (Phase 143) and
// `legibility` (Phase 161): multi-template by construction, NOT added to
// `runAllGates`, invoked directly from
// `tests/cards/compose/gates/faithfulness.test.ts`. Where `checkLegibility`
// runs per-template synthetic-sampler walks, this gate consumes samples
// the harness collected by driving the REAL simulation (`runCardlessSim`)
// across several policy bots and rendering every emitted seed through
// `pickCard`. The shape players actually see is the shape the gate audits.
//
// Four rules, four reasons — one per defect class the arc fixed. The arc
// adds NO new rules beyond these four:
//
//   direction_mismatch — a rendered preview line for a lower-is-better
//     meter (where `METER_VALENCE` resolves) carries opposite-direction
//     magnitude vocabulary. Re-checking `effect.direction` against
//     `classifyDirection(amount, target)` is tautological after Phase 2
//     made `effect()` valence-correct at generation; the render-level
//     defect is the LINE speaking the wrong direction's words ("a clear
//     drop" on a stress-reduction). `MAGNITUDE_LEXICON` shares tiny/small
//     tokens across directions but diverges at medium/large, so this only
//     fires at those bands — the only structurally detectable signal.
//
//   label_collision — two rendered choices with distinct
//     `(slotId, verb, targetId)` triples canonicalise to the same label.
//     Same rule as `legibility.choice_label_collision`, but exercised over
//     the production-shape render stream.
//
//   duplicate_preview_line — two distinct choices in one card render the
//     same preview line. The 4,368-case defect: pools keyed only on
//     `(targetKind, direction, band)`, so distinct slots collapsed.
//
//   distress_state_mismatch — a distress-lexicon flavor line fires when
//     the actor is actually calm (or a calm line when distressed). The
//     static `unbacked_state_claim` detector (Phase 4) guarantees these
//     snippets CARRY a state condition; this DYNAMIC check verifies the
//     condition actually held by computing the actor's distress from STATE
//     independently of the fired snippet. Reuses the same distress/calm
//     lexicon and the existing signal bands — no new lexicon, no new band.
//
// `pass === violations.length === 0`. No warnings. Pure: same samples ⇒
// same report (every input is plain data; the only state reads are
// deterministic `querySignal` / `pressureIsRising` over the frozen state).

import { selectPreviewEffects } from '../previewSelect'
import { canonicaliseText } from './dedupe'
import { MAGNITUDE_LEXICON, lineCarriesMagnitude } from '../magnitudeLexicon'
import { resolveMeterValence } from '../../../sim/modules/issues/generatorHelpers'
import { __internal as simCoherenceInternal } from './simCoherence'
import { __internal as conditionsInternal } from '../conditions'
import { querySignal, pressureIsRising, type SignalResult } from '../../../sim/signals'
import type {
  EffectDirection,
  EffectMagnitudeBand,
} from '../../../sim/core/effect'
import type { IssueSeed } from '../../../sim/modules/issues/issueSeedTypes'
import type { TavernState } from '../../../sim/state/TavernState'
import type { CardView } from '../../types'
import { failReport, type GateReport, type GateViolation } from './types'

const { resolveActorRef } = conditionsInternal
const { DEFAULT_DISTRESS_PATTERNS, DEFAULT_CALM_PATTERNS } = simCoherenceInternal

/** One pre-rendered production-shape sample. The harness builds these by
 *  driving `runCardlessSim` and rendering every non-fallback seed via
 *  `pickCard`; the gate consumes them verbatim and re-derives per-line
 *  effect metadata itself (the `CardView`'s `previewEffects` are plain
 *  strings and carry no metadata). */
export type FaithfulnessSample = {
  seed: IssueSeed
  state: TavernState
  cardView: CardView
}

export type FaithfulnessConfig = {
  samples: readonly FaithfulnessSample[]
  /** Override the magnitude lexicon. Defaults to `MAGNITUDE_LEXICON`. */
  magnitudeLexicon?: Record<
    EffectDirection,
    Record<EffectMagnitudeBand, readonly string[]>
  >
  /** Override the distress / calm lexicons used by rule (d). Default to
   *  `simCoherence.__internal.DEFAULT_DISTRESS_PATTERNS` /
   *  `DEFAULT_CALM_PATTERNS` — the same curated tables the static
   *  `unbacked_state_claim` detector uses. */
  distressPatterns?: readonly RegExp[]
  calmPatterns?: readonly RegExp[]
}

export type FaithfulnessReport = GateReport & {
  observed: {
    samplesEvaluated: number
    /** Preview lines eligible for rule (a) (medium/large band on a
     *  lower-is-better meter). */
    directionChecksRun: number
    directionMismatches: number
    labelCollisions: number
    duplicatePreviewLines: number
    /** Lines matched against the distress/calm lexicon where the actor's
     *  reading was decidable (not `'unknown'`). */
    distressChecksRun: number
    distressMismatches: number
    /** Cards whose actor distress reading was `'unknown'` ⇒ rule (d)
     *  skipped. Diagnostics only. */
    distressUnknownSkipped: number
  }
}

export const FAITHFULNESS_REASONS = Object.freeze([
  'direction_mismatch',
  'label_collision',
  'duplicate_preview_line',
  'distress_state_mismatch',
] as const)

export type FaithfulnessReason = (typeof FAITHFULNESS_REASONS)[number]

export function checkFaithfulness(
  config: FaithfulnessConfig,
): FaithfulnessReport {
  const magnitudeLexicon = config.magnitudeLexicon ?? MAGNITUDE_LEXICON
  const distressPatterns = config.distressPatterns ?? DEFAULT_DISTRESS_PATTERNS
  const calmPatterns = config.calmPatterns ?? DEFAULT_CALM_PATTERNS

  const violations: GateViolation[] = []
  let samplesEvaluated = 0
  let directionChecksRun = 0
  let directionMismatches = 0
  let labelCollisions = 0
  let duplicatePreviewLines = 0
  let distressChecksRun = 0
  let distressMismatches = 0
  let distressUnknownSkipped = 0

  for (const sample of config.samples) {
    samplesEvaluated += 1
    const { seed, state, cardView } = sample

    const renderedChoices: RenderedChoice[] = []
    // (slotId, canonical preview line) across every choice in THIS card.
    const previewLines: { slotId: string; canon: string }[] = []

    for (const choice of cardView.choices) {
      const profile = seed.consequenceProfiles.find(
        (p) => p.responseSlotId === choice.slotId,
      )
      const lineCount = choice.previewEffects.length

      // Phase-147 inaction routing mirror — source from delayed effects
      // when there are no immediate ones, exactly as
      // `composeChoicesFromSeed` does, so `effects[lineIdx]` is the true
      // backing effect for `choice.previewEffects[lineIdx]`.
      const immediate = profile?.immediateEffects ?? []
      const delayed = profile?.delayedEffects ?? []
      const useDelayed = immediate.length === 0 && delayed.length > 0
      const source = useDelayed ? delayed : immediate
      const effects = selectPreviewEffects(source, lineCount)

      for (let lineIdx = 0; lineIdx < lineCount; lineIdx += 1) {
        const line = choice.previewEffects[lineIdx]!
        previewLines.push({ slotId: choice.slotId, canon: canonicaliseText(line) })

        const effect = effects[lineIdx]
        if (!effect) continue
        // `future_hook` (narrative recurrence) and `cause` (attribution)
        // carry a banded amount but no player-facing magnitude — same
        // carve-out the legibility gate applies.
        if (effect.kind === 'future_hook' || effect.kind === 'cause') continue

        const dir = effect.direction
        const band = effect.magnitudeBand
        if (dir === undefined || band === undefined) continue
        if (dir === 'neutral') continue
        // Only medium/large carry directional vocabulary; tiny/small are
        // shared across directions, so an opposite-token check there is
        // meaningless.
        if (band !== 'medium' && band !== 'large') continue
        // "Where METER_VALENCE resolves" — the lower-is-better meters where
        // the Phase-2 valence flip happened and the 339 defects lived.
        if (!meterValenceResolves(effect.target)) continue

        directionChecksRun += 1
        const opposite: EffectDirection = dir === 'positive' ? 'negative' : 'positive'
        const carriesOpposite = lineCarriesMagnitude(line, opposite, band, magnitudeLexicon)
        // The `!carriesCorrect` guard is a no-op today (medium/large token
        // sets are disjoint) but future-proofs against a lexicon edit
        // reintroducing a shared medium/large stem.
        const carriesCorrect = lineCarriesMagnitude(line, dir, band, magnitudeLexicon)
        if (carriesOpposite && !carriesCorrect) {
          directionMismatches += 1
          violations.push({
            slotId: choice.slotId,
            reason: 'direction_mismatch',
            detail: `seed ${seed.id}: choice "${choice.slotId}" effect #${lineIdx} is ${dir}/${band} on ${effect.target} but line "${line}" speaks ${opposite}/${band} vocabulary`,
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

    // (b) label_collision — distinct mechanical identities, same label.
    for (let a = 0; a < renderedChoices.length; a += 1) {
      for (let b = a + 1; b < renderedChoices.length; b += 1) {
        const A = renderedChoices[a]!
        const B = renderedChoices[b]!
        if (sameMechanicalIdentity(A, B)) continue
        if (A.canonicalLabel.length > 0 && A.canonicalLabel === B.canonicalLabel) {
          labelCollisions += 1
          violations.push({
            slotId: A.slotId,
            reason: 'label_collision',
            detail: `seed ${seed.id}: "${A.label}" rendered for both ${A.slotId} (${A.verb}) and ${B.slotId} (${B.verb})`,
          })
        }
      }
    }

    // (c) duplicate_preview_line — same line across distinct choices.
    for (let a = 0; a < previewLines.length; a += 1) {
      for (let b = a + 1; b < previewLines.length; b += 1) {
        const A = previewLines[a]!
        const B = previewLines[b]!
        if (A.slotId === B.slotId) continue
        if (A.canon.length > 0 && A.canon === B.canon) {
          duplicatePreviewLines += 1
          violations.push({
            slotId: A.slotId,
            reason: 'duplicate_preview_line',
            detail: `seed ${seed.id}: preview line "${A.canon}" rendered for both ${A.slotId} and ${B.slotId}`,
          })
        }
      }
    }

    // (d) distress_state_mismatch — distress/calm flavor vs computed state.
    const reading = actorDistressReading(seed, state)
    if (reading === 'unknown') {
      distressUnknownSkipped += 1
    } else {
      // Scope to BODY flavor lines only. The static `unbacked_state_claim`
      // detector deliberately exempts consequence slots (choice labels /
      // effect previews) — a preview describes a future mechanical effect,
      // not the actor's current inner state — so scanning previews would
      // false-positive on lines like "the strain would ease".
      const lines = cardView.body
      for (const line of lines) {
        const distressHit = distressPatterns.some((rx) => rx.test(line))
        const calmHit = calmPatterns.some((rx) => rx.test(line))
        // A line that carries BOTH a distress and a calm token is a mixed
        // snippet — Phase 4 deliberately preserved these (it drops only
        // strictly-opposed SEPARATE facts in the multi-fact join, not a
        // single authored line that holds nuance). Rule (d) targets the
        // pure-valence contradiction: a wholly-distress line on a calm
        // actor (or vice versa). Skip the ambiguous mixed case.
        if (distressHit === calmHit) continue
        distressChecksRun += 1
        if (distressHit && reading === 'calm') {
          distressMismatches += 1
          violations.push({
            slotId: 'body',
            reason: 'distress_state_mismatch',
            detail: `seed ${seed.id}: distress line "${line}" fired but ${actorLabel(seed)} reads calm`,
          })
        } else if (calmHit && reading === 'distressed') {
          distressMismatches += 1
          violations.push({
            slotId: 'body',
            reason: 'distress_state_mismatch',
            detail: `seed ${seed.id}: calm line "${line}" fired but ${actorLabel(seed)} reads distressed`,
          })
        }
      }
    }
  }

  const base = failReport(violations)
  return {
    pass: base.pass,
    violations: base.violations,
    observed: {
      samplesEvaluated,
      directionChecksRun,
      directionMismatches,
      labelCollisions,
      duplicatePreviewLines,
      distressChecksRun,
      distressMismatches,
      distressUnknownSkipped,
    },
  }
}

type RenderedChoice = {
  slotId: string
  verb: string
  targetId: string | undefined
  label: string
  canonicalLabel: string
}

function sameMechanicalIdentity(a: RenderedChoice, b: RenderedChoice): boolean {
  return a.slotId === b.slotId && a.verb === b.verb && a.targetId === b.targetId
}

/** "Where METER_VALENCE resolves" — `resolveMeterValence` always returns a
 *  value (defaulting to `'higherIsBetter'`), so the set the spec means is
 *  exactly the lower-is-better meters the map lists. Higher-is-better
 *  meters never had the direction bug (their arithmetic sign was always
 *  correct), so scoping rule (a) here is both faithful to the audit and
 *  free of false positives. */
function meterValenceResolves(target: string): boolean {
  return resolveMeterValence(target) === 'lowerIsBetter'
}

function bandFrom(result: SignalResult): 'low' | 'mid' | 'high' | undefined {
  return 'band' in result ? result.band : undefined
}

/** Compute the actor's distress from STATE, independently of any fired
 *  snippet's conditions. Scoped to the actor kinds the distress/calm
 *  lexicon applies to (staff exhaustion/strain, regular irritation);
 *  returns `'unknown'` for mid bands, unresolved meters, and other actor
 *  kinds so rule (d) skips rather than false-positives. Reuses the
 *  existing signal bands + `staff_burnout` pressure — no new band. */
function actorDistressReading(
  seed: IssueSeed,
  state: TavernState,
): 'distressed' | 'calm' | 'unknown' {
  const ref = resolveActorRef('primaryActor', seed)
  if (!ref) return 'unknown'

  if (ref.kind === 'staff') {
    const stress = bandFrom(querySignal(state, 'staff.stress', ref))
    const fatigue = bandFrom(querySignal(state, 'staff.fatigue', ref))
    const burnout = pressureIsRising(state, 'staff_burnout')
    if (stress === 'high' || fatigue === 'high' || burnout) return 'distressed'
    if (stress === 'low' && fatigue === 'low' && !burnout) return 'calm'
    return 'unknown'
  }

  if (ref.kind === 'regular') {
    const irritation = bandFrom(querySignal(state, 'regular.irritation', ref))
    if (irritation === 'high') return 'distressed'
    if (irritation === 'low') return 'calm'
    return 'unknown'
  }

  return 'unknown'
}

function actorLabel(seed: IssueSeed): string {
  const ref = seed.primaryActor
  return ref ? `${ref.kind} ${ref.id}` : 'the actor'
}
