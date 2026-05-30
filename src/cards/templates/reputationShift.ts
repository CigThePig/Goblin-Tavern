// Phase 139 / ISSUE-108 — Voiced Surface arc, Phase 13 (Reputation, Rumour & Rivals).
//
// Compositional template for the reputation_shift family. Replaces the
// legacy hand-written `reputationShiftWeeklyCard` (deleted in this
// phase). The legacy template declared `timings: ['end_week']` while
// the generator emits `timing: 'closing'` — the card never matched
// in production and reputation_shift seeds routed to `fallbackCard`,
// the same alignment bug Phases 7 (staffBurnout) and 12
// (foodSafetyCrisis) fixed.
//
// Body shape: [establishing_line, reaction_line, manner_note?].
//   - establishing_line (sim-backed, ≤14 words) states the situation
//     via `hasTag reputation.<axis>` (Phase-13 additive seed.domain
//     tag carrying the axisId), `pressureRising reputation_drift`,
//     prior-choice memories (embraced / corrected / advertised /
//     diversified), `repeatCount reputation`, and `severityAtLeast`.
//   - reaction_line (flavor, ≤12 words) is narrator's read; no
//     primaryActor resolves on the seed so the pool is free of
//     `voiceAxis` / `verbalTic` conditions.
//   - manner_note (flavor, ≤10 words, optional) is a sensory beat.
//
// appliesTo matches the actual seed shape at
// `issueSeedGenerators.ts:3510-3514` — `reputation_shift` /
// `reputation_shift` / `closing`. No `custom` predicate — the seed
// has no `primaryActor` (audit pass 1 §5.3 omits the singleton
// system:reputation ref), narrator-voiced via the room's identity.

import {
  buildStakes,
  composeChoicesFromSeed,
  familyTag,
  makeCardView,
} from '../cardHelpers'
import type { CardDefinition } from '../types'
import { defineCompositionalCard } from '../compose/defineCompositionalCard'
import type {
  CompositionalCardTemplate,
  FilledSlots,
} from '../compose/types'
import {
  reputationShiftChoiceLabelPool,
  reputationShiftEffectPreviewPool,
  reputationShiftEstablishingLinePool,
  reputationShiftMannerNotePool,
  reputationShiftReactionLinePool,
  reputationShiftTitlePool,
} from '../compose/pools/reputationShift'

export const reputationShiftTemplate: CompositionalCardTemplate = {
  id: 'reputation_shift.reputation_shift',
  appliesTo: {
    seedFamilies: ['reputation_shift'],
    seedTypes: ['reputation_shift'],
    timings: ['closing'],
  },
  priority: 55,
  voiceRegister: 'tavern_floor',
  slots: [
    {
      id: 'title',
      role: 'title',
      pool: reputationShiftTitlePool,
      wordBudget: 6,
      claimMode: 'flavor',
    },
    {
      // Phase 155 / ISSUE-123 — Legible Surface arc, Phase 10. The
      // reputation_shift card is *about* the axis × pressure pair
      // (which axis is moving, and whether the drift pressure is
      // climbing). `saliencePolicy: 'multi'` lets the assembler tie-
      // break top-specificity matches by salience (the axis tag is the
      // lead read for `reputation_shift`; see `compose/salience.ts`),
      // then append a secondary snippet covering the next orthogonal
      // salient fact (pressureRising / memory / severity / repeat)
      // within the combined word budget. Layered OVER the gradient —
      // when only one read resolves, behaviour matches the single-fact
      // baseline.
      id: 'establishing_line',
      role: 'utterance',
      pool: reputationShiftEstablishingLinePool,
      wordBudget: 14,
      claimMode: 'sim_backed',
      saliencePolicy: 'multi',
      multiFactJoin: ' — ',
    },
    {
      id: 'reaction_line',
      role: 'utterance',
      pool: reputationShiftReactionLinePool,
      wordBudget: 12,
      claimMode: 'flavor',
    },
    {
      id: 'manner_note',
      role: 'aside',
      pool: reputationShiftMannerNotePool,
      optional: true,
      wordBudget: 10,
      claimMode: 'flavor',
    },
  ],
  toCardView: (filled, seed, state) => {
    return makeCardView({
      title: buildReputationShiftTitle(filled),
      body: buildReputationShiftBody(filled),
      stakes: buildStakes(seed, 2),
      choices: composeChoicesFromSeed(seed, state, {
        labelPool: reputationShiftChoiceLabelPool,
        previewPool: reputationShiftEffectPreviewPool,
      }),
      severity: seed.severity,
      tag: familyTag(seed),
    })
  },
}

function buildReputationShiftTitle(filled: FilledSlots): string {
  const snippet = filled['title'] ?? 'tilting this week'
  return `Reputation: ${snippet}`
}

function buildReputationShiftBody(filled: FilledSlots): string[] {
  const lines: string[] = []
  const establishing = filled['establishing_line']
  if (establishing) lines.push(establishing)
  const reaction = filled['reaction_line']
  if (reaction) lines.push(reaction)
  const manner = filled['manner_note']
  if (manner) lines.push(manner)
  return lines.slice(0, 3)
}

export const reputationShiftCard: CardDefinition = defineCompositionalCard(
  reputationShiftTemplate,
)
