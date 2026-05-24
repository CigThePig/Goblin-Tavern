// Phase 143 / ISSUE-112 — Voiced Surface arc, Phase 17 (Cross-Situation
// Voice Consistency). The centerpiece of the arc, finally made testable:
// a structural gate proving the same character is recognizably themselves
// across every migrated actor-voiced template, driven only by their
// `voiceProfile`.
//
// Unlike the six framework gates (`coverage`, `specificity`, `voiceBounds`,
// `simCoherence`, `determinism`, `diversity`) and the seventh Voiced-
// Surface `dedupe` gate, this one is MULTI-TEMPLATE: it holds one
// `voiceProfile` fixed, samples its rendered output across every
// migrated actor-voiced template, and asserts three rules. It is NOT
// added to `runAllGates` — that runner is template-scoped, one report
// per template. The cross-situation check is a peer suite invoked from
// `tests/cards/compose/gates/crossSituation.test.ts` against the real
// pools (the agent-authoring harness arrives in Movement IV's
// continuation).
//
// The three structural rules (see `docs/plans/voiced-surface-arc.md`
// Phase 17):
//
//   1. Voice expression (LIVENESS). For each non-neutral archetype,
//      AT LEAST ONE fired snippet must carry a `voiceAxis` condition
//      matching one of the archetype's poles in ≥ ⌈templatesAvailable
//      × 0.5⌉ of the actor's migrated templates. The check is per-
//      archetype, not per-axis-pole: real pools commonly author only
//      one direction of an axis (low-floridity is the "default" voice,
//      so authors typically write only the high-floridity rung). What
//      we want to catch is the case where SOME archetype is voice-mute
//      across most templates — i.e., a fixed character with that voice
//      profile never shows up as themselves in most of their situations.
//
//   2. Tic surfacing (LIVENESS). For each archetype with `verbalTic` set,
//      a snippet conditioned on that tic must fire in at least
//      `minTicTemplatesReached` templates (2 for kinds with ≥3 templates,
//      1 for kinds with 2 templates). A tic that surfaces in only one
//      template is voice-mute everywhere else.
//
//   3. Voice-blind pool (SAFETY). For each `(template, slot)` actor-voiced
//      pair, compare rendered text from archetype `terse_cold` vs
//      `florid_warm` across N samples (same seeds). If ≥ 80% of samples
//      produce identical text, the pool is voice-blind on those poles.
//      This is the "florid line reachable by terse-max actor" detector
//      from the spec — when an unconditional snippet exists in a pool
//      that opposite-pole archetypes both draw, the pool fails to
//      differentiate voices.
//
// The threshold for rule 3 is 80% (not 100%) to allow occasional
// fallback collapse without false alarm: when both archetypes happen to
// land on the same unconditional snippet for a state where no axis-gated
// rung fires, that's fine, as long as the pool's other slots /
// snippets do voice them differently elsewhere.
//
// A deliberately-broken fixture in the test suite proves each failure
// mode bites; see `tests/cards/compose/gates/crossSituation.test.ts`.

import { pickSnippetTrace } from '../assemble'
import type {
  CompositionalCardTemplate,
  ConditionContext,
  SlotSpec,
  Snippet,
  SnippetCondition,
  VerbalTicId,
  VoiceAxisId,
  VoiceAxisValue,
} from '../types'
import type { IssueSeed } from '../../../sim/modules/issues/issueSeedTypes'
import type { TavernState } from '../../../sim/state/TavernState'
import {
  failReport,
  type GateReport,
  type GateViolation,
} from './types'

/** A single sampled situation: the template the actor appears in, the
 *  seed flowing into it, the state with the archetype installed, and an
 *  optional context (for choice-label / effect-preview slots that gate
 *  on `currentResponseSlot` / `currentEffect`). */
export type CrossSituationSample = {
  templateId: string
  template: CompositionalCardTemplate
  seed: IssueSeed
  state: TavernState
  ctx?: ConditionContext
}

/** A voice archetype the cross-situation gate holds fixed across all
 *  templates for a given actor kind. */
export type CrossSituationArchetype = {
  /** Unique label for diagnostics ('terse_cold', 'florid_warm', etc.). */
  id: string
  axes: Readonly<Record<VoiceAxisId, VoiceAxisValue>>
  verbalTic?: VerbalTicId
}

/** Per actor kind: the archetype list × the sample factory (one entry
 *  per (template, sampleIndex) tuple) the gate iterates. The factory
 *  installs the archetype's voice on the actor in `state` and returns
 *  the sample shape the gate consumes. */
export type CrossSituationActorKind = {
  /** Human-readable label for diagnostics: 'staff', 'regular', etc. */
  actorKind: string
  /** The unique template IDs (matching `template.id`) the gate iterates
   *  for this actor kind. Drives "templatesAvailable" in rule 1 and
   *  rule 2. */
  templateIds: readonly string[]
  /** Build a list of samples for one archetype. Implementations must
   *  install the archetype's voice on the resolved actor in each
   *  sample's `state` so the snippet conditions evaluate against it. */
  buildSamples: (archetype: CrossSituationArchetype) => readonly CrossSituationSample[]
}

/** Per-actor-kind expected minima. The gate fails-loud when actual
 *  surfaces fall short. */
export type CrossSituationKindConfig = {
  /** Voice expression rule: minimum templates where AT LEAST ONE fired
   *  snippet has a `voiceAxis` gate matching any of the archetype's
   *  poles. Defaults to `⌈templatesAvailable × 0.5⌉`. */
  minTemplatesPerArchetype?: number
  /** Verbal-tic liveness rule. Templates the tic must surface in. */
  minTicTemplatesReached?: number
  /** Voice-blind pool detection threshold — fraction of samples where
   *  terse_cold and florid_warm produce identical text in the same slot
   *  before the slot is flagged as voice-blind. Default 0.8 (Phase 17
   *  spec). */
  voiceBlindThreshold?: number
}

export type CrossSituationConfig = {
  kinds: readonly CrossSituationActorKind[]
  archetypes: readonly CrossSituationArchetype[]
  /** Optional per-kind tuning. Missing entries fall back to the
   *  per-kind-count defaults below. */
  kindConfig?: Partial<Record<string, CrossSituationKindConfig>>
}

type AxisPoleObservation = {
  pole: 'atLeast' | 'atMost'
  templatesReached: number
}

/** What the gate records per archetype, per kind. Surfaced in
 *  `observed` so tests can sanity-check the actual coverage without
 *  retracing the gate's logic. */
export type CrossSituationArchetypeObservation = {
  archetypeId: string
  templatesAvailable: number
  templatesReached: number
  /** Templates that drew at least one snippet whose conditions include a
   *  `voiceAxis` gate matching this archetype's pole-set axes. Map keys
   *  are `'<axisId>:atLeast'` / `'<axisId>:atMost'`. Surfaced for
   *  diagnostics — rule 1 aggregates across these to form the
   *  per-archetype templatesWithAnyVoicePole count. */
  axisPolesReached: Record<string, AxisPoleObservation>
  /** How many templates in `templateIds` produced ANY voice-axis-gated
   *  snippet matching one of the archetype's poles. This is the
   *  metric rule 1 actually checks against `minTemplatesPerArchetype`. */
  templatesWithAnyVoicePole: number
  /** Templates where a `verbalTic` snippet matching the archetype's tic
   *  fired. Empty when archetype has no tic. */
  ticTemplatesReached?: number
}

export type CrossSituationKindObservation = {
  actorKind: string
  templatesAvailable: number
  archetypes: CrossSituationArchetypeObservation[]
  /** Per-(template, slot) voice-blind sample counts. The gate aggregates
   *  identical-text counts between the first two archetypes (canonically
   *  the opposite-pole pair); see `voice_blind_pool` violations. */
  voiceBlindPairs: Array<{
    templateId: string
    slotId: string
    archetypeA: string
    archetypeB: string
    identicalSamples: number
    totalSamples: number
    fraction: number
  }>
}

export type CrossSituationReport = GateReport & {
  observed: {
    kinds: CrossSituationKindObservation[]
  }
}

const VOICE_BOUND_AXES: readonly VoiceAxisId[] = [
  'terseness',
  'warmth',
  'formality',
  'floridity',
]

function defaultsFor(templatesAvailable: number): CrossSituationKindConfig {
  // The 50% floor for per-archetype voice expression matches the spec:
  // a fixed voiceProfile should reach axis-gated snippets in at least
  // half the templates the actor appears in. The tic-templates floor
  // is 2 for kinds with ≥3 templates and 1 for the 2-template kinds
  // (supplier, notable_npc) — per Phase 17's "≥3 migrated situations
  // to be meaningful" rule scaled down for the smaller kinds.
  return {
    minTemplatesPerArchetype: Math.max(1, Math.ceil(templatesAvailable * 0.5)),
    minTicTemplatesReached: templatesAvailable >= 3 ? 2 : 1,
    voiceBlindThreshold: 0.8,
  }
}

function isPoleAxis(value: VoiceAxisValue): 'atLeast' | 'atMost' | undefined {
  if (value === 2) return 'atLeast'
  if (value === 0) return 'atMost'
  return undefined
}

/** Does the snippet carry a `voiceAxis` condition matching the
 *  archetype's pole-set value on the named axis? */
function snippetHasMatchingAxisGate(
  snippet: Snippet,
  axis: VoiceAxisId,
  pole: 'atLeast' | 'atMost',
  poleValue: VoiceAxisValue,
): boolean {
  return snippet.conditions.some((c: SnippetCondition) => {
    if (c.kind !== 'voiceAxis') return false
    if (c.axis !== axis) return false
    if (pole === 'atLeast') {
      return 'atLeast' in c && c.atLeast === poleValue
    }
    return 'atMost' in c && c.atMost === poleValue
  })
}

/** Does the snippet carry a `verbalTic` condition matching the
 *  archetype's tic? */
function snippetHasMatchingTicGate(
  snippet: Snippet,
  tic: VerbalTicId,
): boolean {
  return snippet.conditions.some(
    (c) => c.kind === 'verbalTic' && c.tic === tic,
  )
}

function actorVoicedSlots(template: CompositionalCardTemplate): SlotSpec[] {
  // Only slots whose pool contains a voice-axis or verbal-tic gate are
  // candidates for the voice-blind check. Narrator-only slots (no actor
  // voice in the pool) would trivially produce identical text across
  // archetypes — by design — and would otherwise drown the signal.
  return template.slots.filter((slot) => {
    return slot.pool.snippets.some((s) =>
      s.conditions.some(
        (c) => c.kind === 'voiceAxis' || c.kind === 'verbalTic',
      ),
    )
  })
}

export function checkCrossSituationVoice(
  config: CrossSituationConfig,
): CrossSituationReport {
  const violations: GateViolation[] = []
  const kindObservations: CrossSituationKindObservation[] = []

  for (const kind of config.kinds) {
    const templatesAvailable = kind.templateIds.length
    const defaults = defaultsFor(templatesAvailable)
    const kindCfg = config.kindConfig?.[kind.actorKind]
    const minTemplatesPerArchetype =
      kindCfg?.minTemplatesPerArchetype ?? defaults.minTemplatesPerArchetype!
    const minTicTemplatesReached =
      kindCfg?.minTicTemplatesReached ?? defaults.minTicTemplatesReached!
    const voiceBlindThreshold =
      kindCfg?.voiceBlindThreshold ?? defaults.voiceBlindThreshold!

    const archetypeObservations: CrossSituationArchetypeObservation[] = []
    // archetypeId → templateId → slotId → list of snippet texts (one per
    // sample). Used for rule 3.
    const renderedTexts = new Map<
      string,
      Map<string, Map<string, string[]>>
    >()

    for (const archetype of config.archetypes) {
      const samples = kind.buildSamples(archetype)
      const templateRenders = new Map<string, Map<string, string[]>>()
      // templateId → axis pole key → boolean (one snippet with matching
      // gate fired in some sample)
      const axisPoleHit = new Map<string, Set<string>>()
      // templateId → boolean (tic-conditioned snippet fired)
      const ticHit = new Set<string>()
      const templatesWithAnySnippet = new Set<string>()

      for (const sample of samples) {
        if (!kind.templateIds.includes(sample.templateId)) continue
        const slots = sample.template.slots
        const ctx = sample.ctx ?? {}
        const slotRenders = templateRenders.get(sample.templateId) ?? new Map<string, string[]>()
        for (const slot of slots) {
          const trace = pickSnippetTrace(slot, sample.seed, sample.state, ctx)
          if (!trace) continue
          templatesWithAnySnippet.add(sample.templateId)
          const list = slotRenders.get(slot.id) ?? []
          list.push(trace.text)
          slotRenders.set(slot.id, list)
          // Record axis-pole gate hits.
          for (const axis of VOICE_BOUND_AXES) {
            const value = archetype.axes[axis]
            const pole = isPoleAxis(value)
            if (!pole) continue
            if (snippetHasMatchingAxisGate(trace, axis, pole, value)) {
              const key = `${axis}:${pole}`
              const set = axisPoleHit.get(sample.templateId) ?? new Set<string>()
              set.add(key)
              axisPoleHit.set(sample.templateId, set)
            }
          }
          // Record tic gate hits.
          if (archetype.verbalTic && snippetHasMatchingTicGate(trace, archetype.verbalTic)) {
            ticHit.add(sample.templateId)
          }
        }
        templateRenders.set(sample.templateId, slotRenders)
      }
      renderedTexts.set(archetype.id, templateRenders)

      // Aggregate axis-pole reach for this archetype, then compute
      // per-archetype "templates with any matching voice pole" — the
      // metric rule 1 actually checks. Per-pole counts stay in the
      // observation for diagnostics; failures are only emitted on the
      // aggregate.
      const axisPolesReached: Record<string, AxisPoleObservation> = {}
      const archetypeHasAnyPole = (tid: string): boolean => {
        const hits = axisPoleHit.get(tid)
        if (!hits) return false
        for (const axis of VOICE_BOUND_AXES) {
          const value = archetype.axes[axis]
          const pole = isPoleAxis(value)
          if (!pole) continue
          if (hits.has(`${axis}:${pole}`)) return true
        }
        return false
      }
      for (const axis of VOICE_BOUND_AXES) {
        const value = archetype.axes[axis]
        const pole = isPoleAxis(value)
        if (!pole) continue
        const key = `${axis}:${pole}`
        let reached = 0
        for (const tid of kind.templateIds) {
          if (axisPoleHit.get(tid)?.has(key)) reached += 1
        }
        axisPolesReached[key] = { pole, templatesReached: reached }
      }
      // Skip the per-archetype rule for archetypes with no pole-set
      // axes (i.e. the tic-only neutral archetypes). Rule 2 covers
      // tics independently.
      const hasAnyPole = VOICE_BOUND_AXES.some(
        (axis) => isPoleAxis(archetype.axes[axis]) !== undefined,
      )
      let templatesWithAnyVoicePole = 0
      if (hasAnyPole) {
        for (const tid of kind.templateIds) {
          if (archetypeHasAnyPole(tid)) templatesWithAnyVoicePole += 1
        }
        if (templatesWithAnyVoicePole < minTemplatesPerArchetype) {
          violations.push({
            slotId: '*',
            reason: 'voice_axis_under_expressed',
            detail: `${kind.actorKind} / ${archetype.id}: reached voice-pole snippets in ${templatesWithAnyVoicePole} of ${templatesAvailable} templates (need ≥ ${minTemplatesPerArchetype})`,
          })
        }
      }

      // Tic surfacing for this archetype.
      let ticTemplatesReached: number | undefined
      if (archetype.verbalTic) {
        ticTemplatesReached = ticHit.size
        if (ticTemplatesReached < minTicTemplatesReached) {
          violations.push({
            slotId: '*',
            reason: 'tic_under_surfaced',
            detail: `${kind.actorKind} / ${archetype.id} / tic ${archetype.verbalTic}: matched in ${ticTemplatesReached} of ${templatesAvailable} templates (need ≥ ${minTicTemplatesReached})`,
          })
        }
      }

      archetypeObservations.push({
        archetypeId: archetype.id,
        templatesAvailable,
        templatesReached: templatesWithAnySnippet.size,
        axisPolesReached,
        templatesWithAnyVoicePole,
        ...(ticTemplatesReached !== undefined ? { ticTemplatesReached } : {}),
      })
    }

    // Rule 3 — voice-blind pool detection between the first two archetypes
    // (canonically the opposite-pole pair, see test wiring).
    const voiceBlindPairs: CrossSituationKindObservation['voiceBlindPairs'] = []
    if (config.archetypes.length >= 2) {
      const archA = config.archetypes[0]!
      const archB = config.archetypes[1]!
      const rendersA = renderedTexts.get(archA.id)
      const rendersB = renderedTexts.get(archB.id)
      if (rendersA && rendersB) {
        for (const tid of kind.templateIds) {
          // Find the template's actor-voiced slots — narrator-only slots
          // would always agree across archetypes, by design.
          const slotsA = rendersA.get(tid)
          const slotsB = rendersB.get(tid)
          if (!slotsA || !slotsB) continue
          // We need the actual template to identify actor-voiced slots,
          // but only have the renders here. Look up via sample build
          // (lazy): use buildSamples once to read the templates this kind
          // exposes.
          const probeSamples = kind.buildSamples(archA)
          const probe = probeSamples.find((s) => s.templateId === tid)
          if (!probe) continue
          const voiceSlotIds = new Set(
            actorVoicedSlots(probe.template).map((s) => s.id),
          )
          for (const slotId of voiceSlotIds) {
            const listA = slotsA.get(slotId) ?? []
            const listB = slotsB.get(slotId) ?? []
            const n = Math.min(listA.length, listB.length)
            if (n === 0) continue
            let identical = 0
            for (let i = 0; i < n; i += 1) {
              if (listA[i] === listB[i]) identical += 1
            }
            const fraction = identical / n
            voiceBlindPairs.push({
              templateId: tid,
              slotId,
              archetypeA: archA.id,
              archetypeB: archB.id,
              identicalSamples: identical,
              totalSamples: n,
              fraction,
            })
            if (fraction >= voiceBlindThreshold) {
              violations.push({
                slotId,
                reason: 'voice_blind_pool',
                detail: `${kind.actorKind} / ${tid} / slot ${slotId}: ${identical} of ${n} samples (${(fraction * 100).toFixed(0)}%) identical between ${archA.id} and ${archB.id} (threshold ${(voiceBlindThreshold * 100).toFixed(0)}%)`,
              })
            }
          }
        }
      }
    }

    kindObservations.push({
      actorKind: kind.actorKind,
      templatesAvailable,
      archetypes: archetypeObservations,
      voiceBlindPairs,
    })
  }

  const base = failReport(violations)
  return {
    pass: base.pass,
    violations: base.violations,
    observed: { kinds: kindObservations },
  }
}
