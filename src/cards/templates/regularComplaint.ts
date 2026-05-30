// Phase 134 / ISSUE-103 — Voiced Surface arc, Phase 8 (Regulars & Complaints).
//
// Compositional template for the loud branch of the regular_customer
// family: a named regular speaking when their irritation has crossed
// the seed-firing threshold (irritation > 60). Replaces the
// regular_customer half of the legacy customerComplaint hand-written
// template, which lifted raw textIngredients (`actorOpinions[firstKey]`,
// `sensoryDetails[0]`, `recentContext[0]`) into the body — no voice,
// no sim-backed claims, no specificity gradient.
//
// Cluster partition (same family, different type):
//   regular_customer / relationship_test / during_service → drinkOrderCard
//     (Phase 123 / ISSUE-092; mild branch, irritation ≤ 60)
//   regular_customer / complaint          / during_service → THIS TEMPLATE
//     (loud branch, irritation > 60)
//
// Body shape: [establishing_line, reaction_line, manner_note?].
//   - establishing_line (sim-backed, ≤14 words) states the situation
//     via signal bands, rising pressures, memory tags, repeat-count.
//   - reaction_line (flavor, ≤12 words) carries the regular's voiced
//     reply via voice axes + verbal tics.
//   - manner_note (flavor, ≤10 words, optional) is a sensory beat.
//
// The `custom` predicate insists the resolved regular has Phase-A
// `castAttributes` populated. Graceful degradation per framework §5,
// identical to drinkOrderCard.

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
  regularComplaintChoiceLabelPool,
  regularComplaintEffectPreviewPool,
  regularComplaintEstablishingLinePool,
  regularComplaintMannerNotePool,
  regularComplaintReactionLinePool,
  regularComplaintTitlePool,
} from '../compose/pools/regularComplaint'

export const regularComplaintTemplate: CompositionalCardTemplate = {
  id: 'regular_customer.complaint',
  appliesTo: {
    seedFamilies: ['regular_customer'],
    seedTypes: ['complaint'],
    timings: ['during_service'],
    custom: (seed, state) => {
      const ref = seed.primaryActor
      if (!ref || ref.kind !== 'regular') return false
      return state.world.regulars[ref.id]?.castAttributes !== undefined
    },
  },
  priority: 70,
  voiceRegister: 'tavern_floor',
  slots: [
    {
      id: 'title',
      role: 'title',
      pool: regularComplaintTitlePool,
      wordBudget: 6,
      claimMode: 'flavor',
    },
    {
      // Phase 151 / ISSUE-119 — Legible Surface arc, Phase 6. The
      // regular_complaint card is *about* irritation × loyalty; when
      // both bands resolve, the establishing line should state the
      // pair (or the band+pressure / band+memory rung the salience
      // table ranks second). `saliencePolicy: 'multi'` lets the
      // assembler tie-break top-specificity matches by salience
      // (irritation leads for `regular_customer`; see
      // `compose/salience.ts`), then append an orthogonal secondary
      // within the combined word budget. Layered OVER the gradient —
      // when only one read resolves, behaviour matches the single-fact
      // baseline.
      id: 'establishing_line',
      role: 'utterance',
      pool: regularComplaintEstablishingLinePool,
      wordBudget: 14,
      claimMode: 'sim_backed',
      saliencePolicy: 'multi',
      multiFactJoin: ' — ',
    },
    {
      id: 'reaction_line',
      role: 'utterance',
      pool: regularComplaintReactionLinePool,
      wordBudget: 12,
      claimMode: 'flavor',
    },
    {
      id: 'manner_note',
      role: 'aside',
      pool: regularComplaintMannerNotePool,
      optional: true,
      wordBudget: 10,
      claimMode: 'flavor',
    },
  ],
  toCardView: (filled, seed, state) => {
    return makeCardView({
      title: buildRegularComplaintTitle(filled, seed, state),
      body: buildRegularComplaintBody(filled),
      stakes: buildStakes(seed, 2),
      choices: composeChoicesFromSeed(seed, state, {
        labelPool: regularComplaintChoiceLabelPool,
        previewPool: regularComplaintEffectPreviewPool,
      }),
      severity: seed.severity,
      tag: familyTag(seed),
    })
  },
}

function buildRegularComplaintTitle(
  filled: FilledSlots,
  seed: IssueSeed,
  state: TavernState,
): string {
  const ref = seed.primaryActor
  const regular =
    ref && ref.kind === 'regular' ? state.world.regulars[ref.id] : undefined
  const display =
    regular?.name.display ?? seed.textIngredients.subject ?? 'A regular'
  const snippet = filled['title'] ?? 'a quiet word'
  return `${display}: ${snippet}`
}

function buildRegularComplaintBody(filled: FilledSlots): string[] {
  const lines: string[] = []
  const establishing = filled['establishing_line']
  if (establishing) lines.push(establishing)
  const reaction = filled['reaction_line']
  if (reaction) lines.push(reaction)
  const manner = filled['manner_note']
  if (manner) lines.push(manner)
  return lines.slice(0, 3)
}

export const regularComplaintCard: CardDefinition = defineCompositionalCard(
  regularComplaintTemplate,
)
