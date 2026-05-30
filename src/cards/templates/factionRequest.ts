// Phase 136 / ISSUE-105 — Voiced Surface arc, Phase 10 (Factions & Culture).
//
// Compositional template for the faction_request family. Replaces the
// legacy hand-written factionRequest template, which lifted raw
// textIngredients (socialContext[0], perceivedBlame[0],
// relevantMemories[0]) through `composeBody` and prefixed the title
// with a `pickFactionRelationNoun` lookup — no voice, no sim-backed
// claims, no specificity gradient.
//
// Cluster partition (Phase 10):
//   faction_request / social_conflict / during_service → THIS TEMPLATE
//   culture_conflict / social_conflict / during_service → cultureConflictCard
//
// Body shape: [establishing_line, reaction_line, manner_note?].
//   - establishing_line (sim-backed, ≤14 words) states the situation
//     via `faction.relationship` / `faction.influence` signal bands,
//     rising `faction_anger` / `cultural_tension` pressure, prior-choice
//     memories (grudge, gratitude, refusal), and a top-rung band+repeat
//     combination.
//   - reaction_line (flavor, ≤12 words) carries the faction's voiced
//     reply via voice axes + verbal tics.
//   - manner_note (flavor, ≤10 words, optional) is a sensory beat.
//
// appliesTo matches the actual seed shape — `faction_request` /
// `social_conflict` / `during_service` per `expandedSeedGenerators.ts:2160`.
// The legacy template's `seedTypes: ['relationship_test', 'social_conflict']`
// admitted a dead type; the new contract drops it.
//
// The `custom` predicate insists the resolved faction has Phase-128
// `castAttributes` populated. Graceful degradation per framework §5,
// identical to drinkOrder / staffBurnout / supplierReliability.

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
  factionRequestChoiceLabelPool,
  factionRequestEffectPreviewPool,
  factionRequestEstablishingLinePool,
  factionRequestMannerNotePool,
  factionRequestReactionLinePool,
  factionRequestTitlePool,
} from '../compose/pools/factionRequest'

export const factionRequestTemplate: CompositionalCardTemplate = {
  id: 'faction_request.social_conflict',
  appliesTo: {
    seedFamilies: ['faction_request'],
    seedTypes: ['social_conflict'],
    timings: ['during_service'],
    custom: (seed, state) => {
      const ref = seed.primaryActor
      if (!ref || ref.kind !== 'faction') return false
      return state.world.factions[ref.id]?.castAttributes !== undefined
    },
  },
  priority: 70,
  voiceRegister: 'tavern_floor',
  slots: [
    {
      id: 'title',
      role: 'title',
      pool: factionRequestTitlePool,
      wordBudget: 6,
      claimMode: 'flavor',
    },
    {
      // Phase 152 / ISSUE-120 — Legible Surface arc, Phase 7. The
      // faction card is *about* relationship × influence; when both
      // bands resolve, the establishing line should state the pair.
      // `saliencePolicy: 'multi'` lets the assembler tie-break top-
      // specificity matches by salience (relationship is the lead read
      // for `faction_request`; see `compose/salience.ts`), then append
      // a secondary snippet covering the next orthogonal salient fact
      // (influence, faction_anger, cultural_tension, prior-choice
      // memory, repeat) within the combined word budget. Layered OVER
      // the gradient — when only one read resolves, behaviour matches
      // the single-fact baseline. The 4 spec-2 corner combos in the
      // pool cover every relationship × influence band pair; the
      // multi-fact join fires only for unanticipated signal × pressure
      // / memory pairs.
      id: 'establishing_line',
      role: 'utterance',
      pool: factionRequestEstablishingLinePool,
      wordBudget: 14,
      claimMode: 'sim_backed',
      saliencePolicy: 'multi',
      multiFactJoin: ' — ',
    },
    {
      id: 'reaction_line',
      role: 'utterance',
      pool: factionRequestReactionLinePool,
      wordBudget: 12,
      claimMode: 'flavor',
    },
    {
      id: 'manner_note',
      role: 'aside',
      pool: factionRequestMannerNotePool,
      optional: true,
      wordBudget: 10,
      claimMode: 'flavor',
    },
  ],
  toCardView: (filled, seed, state) => {
    return makeCardView({
      title: buildFactionRequestTitle(filled, seed, state),
      body: buildFactionRequestBody(filled),
      stakes: buildStakes(seed, 2),
      choices: composeChoicesFromSeed(seed, state, {
        labelPool: factionRequestChoiceLabelPool,
        previewPool: factionRequestEffectPreviewPool,
      }),
      severity: seed.severity,
      tag: familyTag(seed),
    })
  },
}

function buildFactionRequestTitle(
  filled: FilledSlots,
  seed: IssueSeed,
  state: TavernState,
): string {
  const ref = seed.primaryActor
  const faction =
    ref && ref.kind === 'faction' ? state.world.factions[ref.id] : undefined
  const display =
    faction?.label ?? seed.textIngredients.subject ?? 'A faction'
  const snippet = filled['title'] ?? 'a word about terms'
  return `${display}: ${snippet}`
}

function buildFactionRequestBody(filled: FilledSlots): string[] {
  const lines: string[] = []
  const establishing = filled['establishing_line']
  if (establishing) lines.push(establishing)
  const reaction = filled['reaction_line']
  if (reaction) lines.push(reaction)
  const manner = filled['manner_note']
  if (manner) lines.push(manner)
  return lines.slice(0, 3)
}

export const factionRequestCard: CardDefinition = defineCompositionalCard(
  factionRequestTemplate,
)
