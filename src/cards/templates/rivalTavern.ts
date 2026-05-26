// Phase 139 / ISSUE-108 — Voiced Surface arc, Phase 13 (Reputation, Rumour & Rivals).
//
// Compositional template for the rival_tavern family (social_conflict
// type). First dedicated card for the family — pre-Phase 13,
// rival_tavern seeds (`expandedSeedGenerators.ts:5772`) had no
// template claiming them and rendered through `fallbackCard`.
//
// Body shape: [establishing_line, reaction_line, manner_note?].
//   - establishing_line (sim-backed, ≤14 words) states the situation
//     via `hasTag rival.arc` / `rival.system` (Phase-13 additive
//     seed.domain tag), `pressureRising rival_tavern_pressure` /
//     `regular_customer_loss`, prior-choice memories (compete /
//     price / event / quality / deception / compromise / ignored),
//     `repeatCount rival`, and `severityAtLeast`.
//   - reaction_line (flavor, ≤12 words) is narrator's read; the
//     primaryActor (a localArc or systemRef) carries no castAttributes,
//     so the pool is free of `voiceAxis` / `verbalTic` conditions.
//   - manner_note (flavor, ≤10 words, optional) is a sensory beat.
//
// appliesTo matches the actual seed shape at
// `expandedSeedGenerators.ts:6004-6008` — `rival_tavern` /
// `social_conflict` / `closing`. No `custom` predicate — both the
// `local_event` (rival arc) and `system` (`systemRef('rival_tavern')`)
// primaryActor paths render through this template; voice comes from
// state perturbation, not actor cast.
//
// Voice register `office_quarters` — closing-time strategic thinking
// from the owner's books, matching `debtRentCard`'s precedent.

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
import type { IssueSeed } from '../../sim/modules/issues/issueSeedTypes'
import type { TavernState } from '../../sim/state/TavernState'
import {
  rivalTavernChoiceLabelPool,
  rivalTavernEffectPreviewPool,
  rivalTavernEstablishingLinePool,
  rivalTavernMannerNotePool,
  rivalTavernReactionLinePool,
  rivalTavernTitlePool,
} from '../compose/pools/rivalTavern'

export const rivalTavernTemplate: CompositionalCardTemplate = {
  id: 'rival_tavern.social_conflict',
  appliesTo: {
    seedFamilies: ['rival_tavern'],
    seedTypes: ['social_conflict'],
    timings: ['closing'],
  },
  priority: 60,
  voiceRegister: 'office_quarters',
  slots: [
    {
      id: 'title',
      role: 'title',
      pool: rivalTavernTitlePool,
      wordBudget: 6,
      claimMode: 'flavor',
    },
    {
      // Phase 155 / ISSUE-123 — Legible Surface arc, Phase 10. The
      // rival_tavern card is *about* the rival-type × pressure pair (a
      // named-arc rival reads as a different problem from an anonymous
      // price-undercutter, and the rival-tavern pressure climbing
      // changes the urgency). `saliencePolicy: 'multi'` lets the
      // assembler tie-break top-specificity matches by salience (the
      // rival-type tag is the lead read for `rival_tavern`; see
      // `compose/salience.ts`), then append a secondary snippet covering
      // the next orthogonal salient fact (pressureRising / memory /
      // severity / repeat) within the combined word budget. Layered
      // OVER the gradient — when only one read resolves, behaviour
      // matches the single-fact baseline.
      id: 'establishing_line',
      role: 'utterance',
      pool: rivalTavernEstablishingLinePool,
      wordBudget: 14,
      claimMode: 'sim_backed',
      saliencePolicy: 'multi',
      multiFactJoin: ' — ',
    },
    {
      id: 'reaction_line',
      role: 'utterance',
      pool: rivalTavernReactionLinePool,
      wordBudget: 12,
      claimMode: 'flavor',
    },
    {
      id: 'manner_note',
      role: 'aside',
      pool: rivalTavernMannerNotePool,
      optional: true,
      wordBudget: 10,
      claimMode: 'flavor',
    },
  ],
  toCardView: (filled, seed, state) => {
    return makeCardView({
      title: buildRivalTavernTitle(filled, seed, state),
      body: buildRivalTavernBody(filled),
      stakes: buildStakes(seed, 2),
      choices: composeChoicesFromSeed(seed, state, {
        labelPool: rivalTavernChoiceLabelPool,
        previewPool: rivalTavernEffectPreviewPool,
        maxPreview: 2,
      }),
      severity: seed.severity,
      tag: familyTag(seed),
    })
  },
}

function buildRivalTavernTitle(
  filled: FilledSlots,
  seed: IssueSeed,
  state: TavernState,
): string {
  const ref = seed.primaryActor
  const arcLabel =
    ref && ref.kind === 'local_event'
      ? state.world.localEvents[ref.id]?.label
      : undefined
  const display = arcLabel ?? 'Rival tavern'
  const snippet = filled['title'] ?? 'pulling crowds'
  return `${display}: ${snippet}`
}

function buildRivalTavernBody(filled: FilledSlots): string[] {
  const lines: string[] = []
  const establishing = filled['establishing_line']
  if (establishing) lines.push(establishing)
  const reaction = filled['reaction_line']
  if (reaction) lines.push(reaction)
  const manner = filled['manner_note']
  if (manner) lines.push(manner)
  return lines.slice(0, 3)
}

export const rivalTavernCard: CardDefinition = defineCompositionalCard(
  rivalTavernTemplate,
)
