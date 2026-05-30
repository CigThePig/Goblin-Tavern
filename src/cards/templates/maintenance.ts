// Phase 137 / ISSUE-106 — Voiced Surface arc, Phase 11 (Premises & Atmosphere).
//
// Compositional template for the maintenance family (maintenance_problem).
// Replaces the legacy hand-written `maintenanceWarning` template, which
// built the body by concatenating `ti.sensoryDetails[0]`, `ti.pressureContext[0]`,
// and `ti.stakesReadable[0]` through the Phase-95 `composeBody` and
// prepended a deterministic `pickAreaStateAdjective` to the title — the
// raw-fragment-dump-with-adjective-glue pattern the arc was built to
// retire.
//
// Body shape: [establishing_line, reaction_line, manner_note?].
//   - establishing_line (sim-backed, ≤14 words) states the situation via
//     `signalEquals area.damage|area.condition` (Phase 11 loopback adds
//     `area.damage`; `area.condition` was already a Phase-1 band),
//     rising `maintenance` pressure, prior-choice memories
//     (warning / ignored / patch / area-tagged), `repeatCount maintenance`,
//     and `severityAtLeast` bands.
//   - reaction_line (flavor, ≤12 words) narrates the owner's morning
//     read of the wear, gated on tags + memories + severity + pressure.
//   - manner_note (flavor, ≤10 words, optional) is a sensory beat.
//
// The seed has no `primaryActor` — the area is referenced via
// `seed.location: areaRef(...)`. The Phase-1 `resolveActorRef` extension
// (Phase 137 additive change) lets snippets read the area through the
// `'location'` role for signal lookups. No `voiceAxis` / `verbalTic`
// conditions anywhere in the pools — areas carry no `castAttributes`.

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
  maintenanceChoiceLabelPool,
  maintenanceEffectPreviewPool,
  maintenanceEstablishingLinePool,
  maintenanceMannerNotePool,
  maintenanceReactionLinePool,
  maintenanceTitlePool,
} from '../compose/pools/maintenance'

export const maintenanceTemplate: CompositionalCardTemplate = {
  id: 'maintenance.maintenance_problem',
  appliesTo: {
    seedFamilies: ['maintenance'],
    seedTypes: ['maintenance_problem'],
    timings: ['morning_prep'],
  },
  priority: 65,
  voiceRegister: 'back_of_house',
  slots: [
    {
      id: 'title',
      role: 'title',
      pool: maintenanceTitlePool,
      wordBudget: 6,
      claimMode: 'flavor',
    },
    {
      // Phase 153 / ISSUE-121 — Legible Surface arc, Phase 8. The
      // maintenance card opens on a 3-meter cube (damage × condition
      // × cleanliness); when more than one band resolves, the
      // establishing line should state the salient combination, not
      // whichever single condition out-specifies the others.
      // `saliencePolicy: 'multi'` lets the assembler tie-break top-
      // specificity matches by salience (damage leads the read for
      // `maintenance`; see `compose/salience.ts`) and join a secondary
      // snippet covering the next orthogonal fact.
      //
      // The pool authors 4 spec-3 cube corners (damage=high ×
      // condition × cleanliness 2×2) plus 4 spec-2 damage × condition
      // supports for the cleanliness=mid case. The multi-fact join is
      // the fallback for unanticipated band pairs the spec-2/spec-3
      // cells don't catch. Layered OVER the gradient — when only one
      // read resolves, behaviour matches the single-fact baseline.
      id: 'establishing_line',
      role: 'utterance',
      pool: maintenanceEstablishingLinePool,
      wordBudget: 14,
      claimMode: 'sim_backed',
      saliencePolicy: 'multi',
      multiFactJoin: ' — ',
    },
    {
      id: 'reaction_line',
      role: 'utterance',
      pool: maintenanceReactionLinePool,
      wordBudget: 12,
      claimMode: 'flavor',
    },
    {
      id: 'manner_note',
      role: 'aside',
      pool: maintenanceMannerNotePool,
      optional: true,
      wordBudget: 10,
      claimMode: 'flavor',
    },
  ],
  toCardView: (filled, seed, state) => {
    return makeCardView({
      title: buildMaintenanceTitle(filled, seed, state),
      body: buildMaintenanceBody(filled),
      stakes: buildStakes(seed, 2),
      choices: composeChoicesFromSeed(seed, state, {
        labelPool: maintenanceChoiceLabelPool,
        previewPool: maintenanceEffectPreviewPool,
      }),
      severity: seed.severity,
      tag: familyTag(seed),
    })
  },
}

function buildMaintenanceTitle(
  filled: FilledSlots,
  seed: IssueSeed,
  state: TavernState,
): string {
  const ref = seed.location
  const area =
    ref && ref.kind === 'area' ? state.areas[ref.id] : undefined
  const snippet = filled['title'] ?? 'damage worth watching'
  return area ? `${area.label}: ${snippet}` : snippet
}

function buildMaintenanceBody(filled: FilledSlots): string[] {
  const lines: string[] = []
  const establishing = filled['establishing_line']
  if (establishing) lines.push(establishing)
  const reaction = filled['reaction_line']
  if (reaction) lines.push(reaction)
  const manner = filled['manner_note']
  if (manner) lines.push(manner)
  return lines.slice(0, 3)
}

export const maintenanceCard: CardDefinition = defineCompositionalCard(
  maintenanceTemplate,
)
