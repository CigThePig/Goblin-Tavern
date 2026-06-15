// Phase 4b (teleology) — the staff_arc compositional card.
//
// First dedicated arc card. It REVEALS a character arc's autonomous
// movement (the arc advances on its own in `arcModule`); the card does not
// drive it. Narrator-voiced: the seed's primaryActor is a `system` ref
// `arc:<id>` carrying no castAttributes, so every pool gates on the seed's
// live stage tags, never on actor voice.
//
// The entity is resolved from the seed's `arc:<id>` target and the title /
// body read the entry's CURRENT stage from `state.arcs` — never a
// hardcoded arc id or literal threshold (guardrail §10). Both choices are
// acknowledgement-only (`cause`-kind effects), so the legibility magnitude
// / meter / cost / risk rules have nothing to bite on.

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
  staffArcChoiceLabelPool,
  staffArcEffectPreviewPool,
  staffArcEstablishingLinePool,
  staffArcMannerNotePool,
  staffArcReactionLinePool,
  staffArcTitlePool,
} from '../compose/pools/staffArc'

export const staffArcTemplate: CompositionalCardTemplate = {
  id: 'staff_arc.arc_milestone',
  appliesTo: {
    seedFamilies: ['staff_arc'],
    seedTypes: ['arc_milestone'],
    timings: ['morning_prep'],
  },
  priority: 72,
  voiceRegister: 'civic_floor',
  slots: [
    {
      id: 'title',
      role: 'title',
      pool: staffArcTitlePool,
      wordBudget: 6,
      claimMode: 'flavor',
    },
    {
      id: 'establishing_line',
      role: 'utterance',
      pool: staffArcEstablishingLinePool,
      wordBudget: 14,
      claimMode: 'flavor',
    },
    {
      id: 'reaction_line',
      role: 'utterance',
      pool: staffArcReactionLinePool,
      wordBudget: 12,
      claimMode: 'flavor',
    },
    {
      id: 'manner_note',
      role: 'aside',
      pool: staffArcMannerNotePool,
      optional: true,
      wordBudget: 10,
      claimMode: 'flavor',
    },
  ],
  toCardView: (filled, seed, state) => {
    return makeCardView({
      title: buildStaffArcTitle(filled, seed, state),
      body: buildStaffArcBody(filled),
      stakes: buildStakes(seed, 2),
      choices: composeChoicesFromSeed(seed, state, {
        labelPool: staffArcChoiceLabelPool,
        previewPool: staffArcEffectPreviewPool,
      }),
      severity: seed.severity,
      tag: familyTag(seed),
    })
  },
}

function resolveArcLabel(seed: IssueSeed, state: TavernState): string | undefined {
  const ref = seed.primaryActor
  if (!ref || ref.kind !== 'system') return undefined
  if (!ref.id.startsWith('arc:')) return undefined
  const arcId = ref.id.slice('arc:'.length)
  return state.arcs[arcId]?.label
}

function buildStaffArcTitle(
  filled: FilledSlots,
  seed: IssueSeed,
  state: TavernState,
): string {
  const label = resolveArcLabel(seed, state) ?? 'A character finds their way'
  const snippet = filled['title'] ?? 'a path takes its shape'
  return `${label}: ${snippet}`
}

function buildStaffArcBody(filled: FilledSlots): string[] {
  const lines: string[] = []
  const establishing = filled['establishing_line']
  if (establishing) lines.push(establishing)
  const reaction = filled['reaction_line']
  if (reaction) lines.push(reaction)
  const manner = filled['manner_note']
  if (manner) lines.push(manner)
  return lines.slice(0, 3)
}

export const staffArcCard: CardDefinition = defineCompositionalCard(
  staffArcTemplate,
)
