// Phase 138 / ISSUE-107 — Voiced Surface arc, Phase 12 (Crises & Safety).
//
// Compositional template for the inspection family (inspection_threat
// type). First dedicated card for the family — pre-Phase 12,
// inspection.inspection_threat seeds had no template claiming them
// and rendered through `fallbackCard`.
//
// Body shape: [establishing_line, reaction_line, manner_note?].
//   - establishing_line (sim-backed, ≤14 words) states the morning
//     situation via `signalEquals faction.relationship` /
//     `faction.influence` on the inspecting faction, `signalEquals
//     area.cleanliness` / `area.condition` on the inspected area
//     (via the Phase-11 `'location'` role), rising `inspection`
//     pressure, prior-choice memories (warning / bribed / hid / prep
//     / walkthrough), `repeatCount inspection`, and `severityAtLeast`.
//   - reaction_line (flavor, ≤12 words) carries the inspector's
//     voiced reply via voice axes + verbal tics.
//   - manner_note (flavor, ≤10 words, optional) is a sensory beat.
//
// appliesTo matches the actual seed shape — `inspection` /
// `inspection_threat` / `morning_prep` at
// `issueSeedGenerators.ts:3223-3227`. The seed's primaryActor is the
// inspector (`inspectorActor` at lines 2708-2711) — a notable_npc
// when one is seeded for the picked faction (per ISSUE-018 picker
// rotation), else the faction ref, else `systemRef('inspector')`. The
// custom predicate accepts `faction` OR `notable_npc` kinds with
// `castAttributes`; it explicitly rejects the `system` ref so the
// system-fallback seed cascades to `fallbackCard` rather than
// rendering through a template with no voice attached.

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
  inspectionChoiceLabelPool,
  inspectionEffectPreviewPool,
  inspectionEstablishingLinePool,
  inspectionMannerNotePool,
  inspectionReactionLinePool,
  inspectionTitlePool,
} from '../compose/pools/inspection'

export const inspectionTemplate: CompositionalCardTemplate = {
  id: 'inspection.inspection_threat',
  appliesTo: {
    seedFamilies: ['inspection'],
    seedTypes: ['inspection_threat'],
    timings: ['morning_prep'],
    custom: (seed, state) => {
      const ref = seed.primaryActor
      if (!ref) return false
      if (ref.kind === 'faction') {
        return state.world.factions[ref.id]?.castAttributes !== undefined
      }
      if (ref.kind === 'notable_npc') {
        return state.world.notableNpcs[ref.id]?.castAttributes !== undefined
      }
      // Phase 12 — explicitly rejects `system` so the
      // `systemRef('inspector')` fallback seed cascades to fallbackCard.
      return false
    },
  },
  priority: 75,
  voiceRegister: 'civic_floor',
  slots: [
    {
      id: 'title',
      role: 'title',
      pool: inspectionTitlePool,
      wordBudget: 6,
      claimMode: 'flavor',
    },
    {
      id: 'establishing_line',
      role: 'utterance',
      pool: inspectionEstablishingLinePool,
      wordBudget: 14,
      claimMode: 'sim_backed',
      // Phase 154 / ISSUE-122 — Legible Surface arc, Phase 9. The
      // inspection SALIENCE_TABLES entry leads with
      // `faction.relationship` on `'primaryActor'` then
      // `faction.influence` and `area.cleanliness` / `area.condition`
      // on `'location'`. The cube is authored at 4 spec-3 corners
      // fixing `faction.relationship=low` and spanning `influence ×
      // area.cleanliness` 2×2 (authority + venue-state); 4 spec-2
      // supports cover the relationship=mid alternates. When
      // primaryActor is a notable_npc (not a faction) the faction-
      // signal reads on `'primaryActor'` silently don't resolve —
      // single-condition snippets handle the establishing line.
      // Multi-fact join is the fallback for unanticipated band pairs.
      saliencePolicy: 'multi',
      multiFactJoin: ' — ',
    },
    {
      id: 'reaction_line',
      role: 'utterance',
      pool: inspectionReactionLinePool,
      wordBudget: 12,
      claimMode: 'flavor',
    },
    {
      id: 'manner_note',
      role: 'aside',
      pool: inspectionMannerNotePool,
      optional: true,
      wordBudget: 10,
      claimMode: 'flavor',
    },
  ],
  toCardView: (filled, seed, state) => {
    return makeCardView({
      title: buildInspectionTitle(filled, seed, state),
      body: buildInspectionBody(filled),
      stakes: buildStakes(seed, 2),
      choices: composeChoicesFromSeed(seed, state, {
        labelPool: inspectionChoiceLabelPool,
        previewPool: inspectionEffectPreviewPool,
      }),
      severity: seed.severity,
      tag: familyTag(seed),
    })
  },
}

function buildInspectionTitle(
  filled: FilledSlots,
  seed: IssueSeed,
  state: TavernState,
): string {
  const ref = seed.primaryActor
  let display: string | undefined
  if (ref?.kind === 'faction') {
    display = state.world.factions[ref.id]?.label
  } else if (ref?.kind === 'notable_npc') {
    display = state.world.notableNpcs[ref.id]?.name.display
  }
  if (!display) display = seed.textIngredients.subject ?? 'The inspector'
  const snippet = filled['title'] ?? 'a word at the door'
  return `${display}: ${snippet}`
}

function buildInspectionBody(filled: FilledSlots): string[] {
  const lines: string[] = []
  const establishing = filled['establishing_line']
  if (establishing) lines.push(establishing)
  const reaction = filled['reaction_line']
  if (reaction) lines.push(reaction)
  const manner = filled['manner_note']
  if (manner) lines.push(manner)
  return lines.slice(0, 3)
}

export const inspectionCard: CardDefinition = defineCompositionalCard(
  inspectionTemplate,
)
