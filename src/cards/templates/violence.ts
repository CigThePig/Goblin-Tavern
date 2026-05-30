// Phase 138 / ISSUE-107 — Voiced Surface arc, Phase 12 (Crises & Safety).
//
// Compositional template for the violence family (customer_incident
// type). First dedicated card for the family — pre-Phase 12,
// violence.customer_incident seeds (issueSeedGenerators.ts:2334-2366)
// had no template claiming them and rendered through `fallbackCard`.
//
// Body shape: [establishing_line, reaction_line, manner_note?].
//   - establishing_line (sim-backed, ≤14 words) states the floor
//     situation via `signalEquals customer_group.rowdiness` (the
//     Phase-12 new band that drives the violence picker),
//     `signalEquals customer_group.satisfaction`, `signalEquals
//     area.damage role: 'location'` on the affected area, rising
//     `violence` pressure, prior-choice memories (warning / brawl /
//     security / banned), `repeatCount violence`, and
//     `severityAtLeast` bands.
//   - reaction_line (flavor, ≤12 words) carries the customer group's
//     voiced reply via voice axes + verbal tics.
//   - manner_note (flavor, ≤10 words, optional) is a sensory beat.
//
// appliesTo matches the actual seed shape — `violence` /
// `customer_incident` / `during_service`. The custom predicate
// insists the resolved customer group has Phase-128
// `castAttributes` populated; graceful degradation per framework §5,
// identical to factionRequest / supplierReliability / customerComplaint.

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
  violenceChoiceLabelPool,
  violenceEffectPreviewPool,
  violenceEstablishingLinePool,
  violenceMannerNotePool,
  violenceReactionLinePool,
  violenceTitlePool,
} from '../compose/pools/violence'

export const violenceTemplate: CompositionalCardTemplate = {
  id: 'violence.customer_incident',
  appliesTo: {
    seedFamilies: ['violence'],
    seedTypes: ['customer_incident'],
    timings: ['during_service'],
    custom: (seed, state) => {
      const ref = seed.primaryActor
      if (!ref || ref.kind !== 'customer_group') return false
      return state.customerGroups[ref.id]?.castAttributes !== undefined
    },
  },
  priority: 75,
  voiceRegister: 'tavern_floor',
  slots: [
    {
      id: 'title',
      role: 'title',
      pool: violenceTitlePool,
      wordBudget: 6,
      claimMode: 'flavor',
    },
    {
      id: 'establishing_line',
      role: 'utterance',
      pool: violenceEstablishingLinePool,
      wordBudget: 14,
      claimMode: 'sim_backed',
      // Phase 154 / ISSUE-122 — Legible Surface arc, Phase 9. The
      // violence SALIENCE_TABLES entry leads with
      // `customer_group.rowdiness` on `'primaryActor'` then
      // `customer_group.satisfaction` and `area.damage`. The cube is
      // authored at 4 spec-3 corners fixing `rowdiness=high` and
      // spanning `satisfaction × area.damage` 2×2 (the social pole
      // crossed with the structural pole); 4 spec-2 supports cover
      // the rowdiness=mid alternates. Multi-fact join is the fallback
      // for unanticipated band pairs the spec-2 / spec-3 cells don't
      // catch.
      saliencePolicy: 'multi',
      multiFactJoin: ' — ',
    },
    {
      id: 'reaction_line',
      role: 'utterance',
      pool: violenceReactionLinePool,
      wordBudget: 12,
      claimMode: 'flavor',
    },
    {
      id: 'manner_note',
      role: 'aside',
      pool: violenceMannerNotePool,
      optional: true,
      wordBudget: 10,
      claimMode: 'flavor',
    },
  ],
  toCardView: (filled, seed, state) => {
    return makeCardView({
      title: buildViolenceTitle(filled, seed, state),
      body: buildViolenceBody(filled),
      stakes: buildStakes(seed, 2),
      choices: composeChoicesFromSeed(seed, state, {
        labelPool: violenceChoiceLabelPool,
        previewPool: violenceEffectPreviewPool,
      }),
      severity: seed.severity,
      tag: familyTag(seed),
    })
  },
}

function buildViolenceTitle(
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
    group?.label ?? seed.textIngredients.subject ?? 'A rowdy group'
  const snippet = filled['title'] ?? 'tempers fraying'
  return `${display}: ${snippet}`
}

function buildViolenceBody(filled: FilledSlots): string[] {
  const lines: string[] = []
  const establishing = filled['establishing_line']
  if (establishing) lines.push(establishing)
  const reaction = filled['reaction_line']
  if (reaction) lines.push(reaction)
  const manner = filled['manner_note']
  if (manner) lines.push(manner)
  return lines.slice(0, 3)
}

export const violenceCard: CardDefinition = defineCompositionalCard(
  violenceTemplate,
)
