// Phase 134 / ISSUE-103 — Voiced Surface arc, Phase 8 (Regulars & Complaints).
//
// Compositional template for the customer_complaint family — a
// customer-group cohort voicing a collective complaint when group
// satisfaction has dropped past the seed-firing threshold (≤ 60).
// Replaces the customer_complaint half of the legacy
// hand-written template, which lifted raw textIngredients
// (`actorOpinions[firstKey]`, `sensoryDetails[0]`, `recentContext[0]`)
// into the body and which also failed to centre the card on its
// subject — its name-resolver always looked for a regular in
// `namedEntities`, so cohort seeds rendered as "A patron".
//
// Phase 8's two-template partition:
//   regular_customer  / complaint / during_service → regularComplaintCard
//   customer_complaint / complaint / during_service → THIS TEMPLATE
//
// Body shape: [establishing_line, reaction_line, manner_note?].
//   - establishing_line (sim-backed, ≤14 words) states the cohort
//     situation via satisfaction / loyalty bands, rising pressures,
//     memory tags, repeat-count.
//   - reaction_line (flavor, ≤12 words) carries the cohort's voiced
//     reply (we / us / this lot) via voice axes + verbal tics.
//   - manner_note (flavor, ≤10 words, optional) is a sensory beat.
//
// The `custom` predicate insists the resolved customer group has
// Phase-2 `castAttributes` populated. Graceful degradation per
// framework §5.

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
  customerComplaintChoiceLabelPool,
  customerComplaintEffectPreviewPool,
  customerComplaintEstablishingLinePool,
  customerComplaintMannerNotePool,
  customerComplaintReactionLinePool,
  customerComplaintTitlePool,
} from '../compose/pools/customerComplaint'

export const customerComplaintTemplate: CompositionalCardTemplate = {
  id: 'customer_complaint.complaint',
  appliesTo: {
    seedFamilies: ['customer_complaint'],
    seedTypes: ['complaint'],
    timings: ['during_service'],
    custom: (seed, state) => {
      const ref = seed.primaryActor
      if (!ref || ref.kind !== 'customer_group') return false
      return state.customerGroups[ref.id]?.castAttributes !== undefined
    },
  },
  priority: 70,
  voiceRegister: 'tavern_floor',
  slots: [
    {
      id: 'title',
      role: 'title',
      pool: customerComplaintTitlePool,
      wordBudget: 6,
      claimMode: 'flavor',
    },
    {
      id: 'establishing_line',
      role: 'utterance',
      pool: customerComplaintEstablishingLinePool,
      wordBudget: 14,
      claimMode: 'sim_backed',
    },
    {
      id: 'reaction_line',
      role: 'utterance',
      pool: customerComplaintReactionLinePool,
      wordBudget: 12,
      claimMode: 'flavor',
    },
    {
      id: 'manner_note',
      role: 'aside',
      pool: customerComplaintMannerNotePool,
      optional: true,
      wordBudget: 10,
      claimMode: 'flavor',
    },
  ],
  toCardView: (filled, seed, state) => {
    return makeCardView({
      title: buildCustomerComplaintTitle(filled, seed, state),
      body: buildCustomerComplaintBody(filled),
      stakes: buildStakes(seed, 2),
      choices: composeChoicesFromSeed(seed, state, {
        labelPool: customerComplaintChoiceLabelPool,
        previewPool: customerComplaintEffectPreviewPool,
        maxPreview: 2,
      }),
      severity: seed.severity,
      tag: familyTag(seed),
    })
  },
}

function buildCustomerComplaintTitle(
  filled: FilledSlots,
  seed: IssueSeed,
  state: TavernState,
): string {
  const ref = seed.primaryActor
  const group =
    ref && ref.kind === 'customer_group'
      ? state.customerGroups[ref.id]
      : undefined
  const display =
    group?.label ?? seed.textIngredients.subject ?? 'A group'
  const snippet = filled['title'] ?? 'a few words'
  return `${display}: ${snippet}`
}

function buildCustomerComplaintBody(filled: FilledSlots): string[] {
  const lines: string[] = []
  const establishing = filled['establishing_line']
  if (establishing) lines.push(establishing)
  const reaction = filled['reaction_line']
  if (reaction) lines.push(reaction)
  const manner = filled['manner_note']
  if (manner) lines.push(manner)
  return lines.slice(0, 3)
}

export const customerComplaintCard: CardDefinition = defineCompositionalCard(
  customerComplaintTemplate,
)
