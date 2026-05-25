// Phase 137 / ISSUE-106 — Voiced Surface arc, Phase 11 (Premises & Atmosphere).
//
// Compositional template for the area_atmosphere family (warning).
// First dedicated card for the family — pre-Phase 11 these seeds were
// nominally claimed by the legacy `maintenanceWarning` template's
// shared appliesTo, but the template was written against the
// `maintenance_problem` text-ingredient shape and mishandled the
// atmosphere seed's `cleanliness X` recentContext readout and
// `namedEntities` block.
//
// Body shape: [establishing_line, reaction_line, manner_note?].
//   - establishing_line (sim-backed, ≤14 words) states the situation via
//     `signalEquals area.cleanliness|area.damage`, rising `maintenance`
//     pressure, prior-choice memories (atmosphere / neglected / cleaning /
//     repair), `repeatCount atmosphere`, and `severityAtLeast` bands.
//   - reaction_line (flavor, ≤12 words) narrates the owner's morning
//     read of the room, gated on tags + memories + severity + pressure.
//   - manner_note (flavor, ≤10 words, optional) is a sensory beat.
//
// The seed has no `primaryActor` — the area is referenced via
// `seed.location: areaRef(...)` and `affectedActors: [areaRef]`. The
// Phase-1 `resolveActorRef` extension (Phase 137 additive change) lets
// snippets read the area through the `'location'` role for signal
// lookups. No `voiceAxis` / `verbalTic` conditions anywhere in the
// pools — areas carry no `castAttributes`.

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
  areaAtmosphereChoiceLabelPool,
  areaAtmosphereEffectPreviewPool,
  areaAtmosphereEstablishingLinePool,
  areaAtmosphereMannerNotePool,
  areaAtmosphereReactionLinePool,
  areaAtmosphereTitlePool,
} from '../compose/pools/areaAtmosphere'

export const areaAtmosphereTemplate: CompositionalCardTemplate = {
  id: 'area_atmosphere.warning',
  appliesTo: {
    seedFamilies: ['area_atmosphere'],
    seedTypes: ['warning'],
    timings: ['morning_prep'],
  },
  priority: 65,
  voiceRegister: 'back_of_house',
  slots: [
    {
      id: 'title',
      role: 'title',
      pool: areaAtmosphereTitlePool,
      wordBudget: 6,
      claimMode: 'flavor',
    },
    {
      // Phase 153 / ISSUE-121 — Legible Surface arc, Phase 8. The
      // area_atmosphere card opens on a 3-meter cube (cleanliness ×
      // damage × condition); when more than one band resolves, the
      // establishing line should state the salient combination, not
      // whichever single condition out-specifies the others.
      // `saliencePolicy: 'multi'` lets the assembler tie-break top-
      // specificity matches by salience (cleanliness leads the read
      // for `area_atmosphere`; see `compose/salience.ts`) and join a
      // secondary snippet covering the next orthogonal fact.
      //
      // The pool authors 4 spec-3 cube corners (cleanliness=low ×
      // damage × condition 2×2) plus 4 spec-2 cleanliness × damage
      // supports for the condition=mid case. The multi-fact join is
      // the fallback for unanticipated band pairs. Layered OVER the
      // gradient — when only one read resolves, behaviour matches the
      // single-fact baseline.
      id: 'establishing_line',
      role: 'utterance',
      pool: areaAtmosphereEstablishingLinePool,
      wordBudget: 14,
      claimMode: 'sim_backed',
      saliencePolicy: 'multi',
      multiFactJoin: ' — ',
    },
    {
      id: 'reaction_line',
      role: 'utterance',
      pool: areaAtmosphereReactionLinePool,
      wordBudget: 12,
      claimMode: 'flavor',
    },
    {
      id: 'manner_note',
      role: 'aside',
      pool: areaAtmosphereMannerNotePool,
      optional: true,
      wordBudget: 10,
      claimMode: 'flavor',
    },
  ],
  toCardView: (filled, seed, state) => {
    return makeCardView({
      title: buildAreaAtmosphereTitle(filled, seed, state),
      body: buildAreaAtmosphereBody(filled),
      stakes: buildStakes(seed, 2),
      choices: composeChoicesFromSeed(seed, state, {
        labelPool: areaAtmosphereChoiceLabelPool,
        previewPool: areaAtmosphereEffectPreviewPool,
        maxPreview: 2,
      }),
      severity: seed.severity,
      tag: familyTag(seed),
    })
  },
}

function buildAreaAtmosphereTitle(
  filled: FilledSlots,
  seed: IssueSeed,
  state: TavernState,
): string {
  const ref = seed.location
  const area =
    ref && ref.kind === 'area' ? state.areas[ref.id] : undefined
  const snippet = filled['title'] ?? 'the room feels off'
  return area ? `${area.label}: ${snippet}` : snippet
}

function buildAreaAtmosphereBody(filled: FilledSlots): string[] {
  const lines: string[] = []
  const establishing = filled['establishing_line']
  if (establishing) lines.push(establishing)
  const reaction = filled['reaction_line']
  if (reaction) lines.push(reaction)
  const manner = filled['manner_note']
  if (manner) lines.push(manner)
  return lines.slice(0, 3)
}

export const areaAtmosphereCard: CardDefinition = defineCompositionalCard(
  areaAtmosphereTemplate,
)
