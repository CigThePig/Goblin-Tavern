// Phase 139 / ISSUE-108 — Voiced Surface arc, Phase 13 (Reputation, Rumour & Rivals).
//
// Compositional template for the rumour_crisis family (rumour type).
// First dedicated card for the family — pre-Phase 13, rumour_crisis
// seeds (`expandedSeedGenerators.ts:4895`, `5564`) had no template
// claiming them and rendered through `fallbackCard`.
//
// Body shape: [establishing_line, reaction_line, manner_note?].
//   - establishing_line (sim-backed, ≤14 words) states the rumour
//     situation via `hasTag rumour.<accuracy>` (Phase-13 additive
//     seed.domain tag — `true` / `partial` / `false` / `unknown`),
//     `hasTag rumour.target.<kind>` (Phase-13 additive seed.domain
//     tag), `pressureRising rumour_pressure`, prior-choice memories
//     (denial / confess / bribe / ignored / vouch / counter /
//     escalation), `repeatCount rumour`, and `severityAtLeast`.
//   - reaction_line (flavor, ≤12 words) carries the target's voiced
//     reply via voice axes + verbal tics.
//   - manner_note (flavor, ≤10 words, optional) is a sensory beat.
//
// appliesTo matches the actual seed shape at
// `expandedSeedGenerators.ts:5513-5518, 5722-5726` — `rumour_crisis`
// / `rumour` / `closing`. The custom predicate insists primaryActor
// is present AND carries castAttributes for its kind; the
// `tavern_identity` no-primaryActor path (`expandedSeedGenerators.ts:5526`,
// `5733`) falls through to `fallbackCard`, matching the inspection /
// systemRef fallback precedent from Phase 12.

import {
  buildStakes,
  composeChoicesFromSeed,
  familyTag,
  makeCardView,
} from '../cardHelpers'
import { displayNameForRef } from '../../sim/modules/issues/generatorHelpers'
import type { CardDefinition } from '../types'
import { defineCompositionalCard } from '../compose/defineCompositionalCard'
import type {
  CompositionalCardTemplate,
  FilledSlots,
} from '../compose/types'
import type { IssueSeed } from '../../sim/modules/issues/issueSeedTypes'
import type { TavernState } from '../../sim/state/TavernState'
import {
  rumourCrisisChoiceLabelPool,
  rumourCrisisEffectPreviewPool,
  rumourCrisisEstablishingLinePool,
  rumourCrisisMannerNotePool,
  rumourCrisisReactionLinePool,
  rumourCrisisTitlePool,
} from '../compose/pools/rumourCrisis'

export const rumourCrisisTemplate: CompositionalCardTemplate = {
  id: 'rumour_crisis.rumour',
  appliesTo: {
    seedFamilies: ['rumour_crisis'],
    seedTypes: ['rumour'],
    timings: ['closing'],
    custom: (seed, state) => {
      const ref = seed.primaryActor
      if (!ref) return false
      if (ref.kind === 'supplier') {
        return state.world.suppliers[ref.id]?.castAttributes !== undefined
      }
      if (ref.kind === 'regular') {
        return state.world.regulars[ref.id]?.castAttributes !== undefined
      }
      if (ref.kind === 'faction') {
        return state.world.factions[ref.id]?.castAttributes !== undefined
      }
      if (ref.kind === 'staff') {
        return state.staff[ref.id]?.castAttributes !== undefined
      }
      if (ref.kind === 'customer_group') {
        return state.customerGroups[ref.id]?.castAttributes !== undefined
      }
      if (ref.kind === 'notable_npc') {
        return state.world.notableNpcs[ref.id]?.castAttributes !== undefined
      }
      // `tavern_identity`, `rumour`, `system`, etc. — no actor with
      // castAttributes resolves; cascade to fallbackCard.
      return false
    },
  },
  priority: 70,
  voiceRegister: 'tavern_floor',
  slots: [
    {
      id: 'title',
      role: 'title',
      pool: rumourCrisisTitlePool,
      wordBudget: 6,
      claimMode: 'flavor',
    },
    {
      // Phase 155 / ISSUE-123 — Legible Surface arc, Phase 10. The
      // rumour_crisis card is *about* the accuracy × target-kind pair
      // (which truth-value the tale carries, and who it's landed on).
      // `saliencePolicy: 'multi'` lets the assembler tie-break top-
      // specificity matches by salience (the accuracy tag is the lead
      // read for `rumour_crisis`; see `compose/salience.ts`), then
      // append a secondary snippet covering the next orthogonal salient
      // fact (target-kind tag / pressureRising / memory / severity /
      // repeat) within the combined word budget. Layered OVER the
      // gradient — when only one read resolves, behaviour matches the
      // single-fact baseline.
      id: 'establishing_line',
      role: 'utterance',
      pool: rumourCrisisEstablishingLinePool,
      wordBudget: 14,
      claimMode: 'sim_backed',
      saliencePolicy: 'multi',
      multiFactJoin: ' — ',
    },
    {
      id: 'reaction_line',
      role: 'utterance',
      pool: rumourCrisisReactionLinePool,
      wordBudget: 12,
      claimMode: 'flavor',
    },
    {
      id: 'manner_note',
      role: 'aside',
      pool: rumourCrisisMannerNotePool,
      optional: true,
      wordBudget: 10,
      claimMode: 'flavor',
    },
  ],
  toCardView: (filled, seed, state) => {
    return makeCardView({
      title: buildRumourCrisisTitle(filled, seed, state),
      body: buildRumourCrisisBody(filled),
      stakes: buildStakes(seed, 2),
      choices: composeChoicesFromSeed(seed, state, {
        labelPool: rumourCrisisChoiceLabelPool,
        previewPool: rumourCrisisEffectPreviewPool,
      }),
      severity: seed.severity,
      tag: familyTag(seed),
    })
  },
}

function buildRumourCrisisTitle(
  filled: FilledSlots,
  seed: IssueSeed,
  state: TavernState,
): string {
  const ref = seed.primaryActor
  const display = ref
    ? displayNameForRef(state, ref)
    : seed.textIngredients.subject ?? 'The story'
  const snippet = filled['title'] ?? 'a word travelling'
  return `${display}: ${snippet}`
}

function buildRumourCrisisBody(filled: FilledSlots): string[] {
  const lines: string[] = []
  const establishing = filled['establishing_line']
  if (establishing) lines.push(establishing)
  const reaction = filled['reaction_line']
  if (reaction) lines.push(reaction)
  const manner = filled['manner_note']
  if (manner) lines.push(manner)
  return lines.slice(0, 3)
}

export const rumourCrisisCard: CardDefinition = defineCompositionalCard(
  rumourCrisisTemplate,
)
