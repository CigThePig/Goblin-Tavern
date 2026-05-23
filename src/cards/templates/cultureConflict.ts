// Phase 136 / ISSUE-105 — Voiced Surface arc, Phase 10 (Factions & Culture).
//
// Compositional template for the culture_conflict family. First dedicated
// card for the family — the legacy factionRequest template nominally
// listed `culture_conflict` in its seedFamilies, but its name resolver
// guarded on `kind === 'faction'`, so culture refs (the actual primary
// actor of these seeds — `expandedSeedGenerators.ts:2438`) fell through
// to a bare `ti.subject` title and raw textIngredient body.
//
// Cultures have meters (tension / comfort / familiarity) but no
// castAttributes (Phase 128 only gave voice to suppliers, factions,
// customer groups, and notable NPCs — cultures are population concepts,
// not individuals). The template therefore renders NARRATOR-VOICED in
// the `civic_floor` register: snippet pools gate ONLY on sim/state
// primitives (signalEquals on the three new culture.* bands from
// Phase 136's Movement I loopback, pressureRising, memoryPresent,
// repeatCount, hasTag, severityAtLeast). No voiceAxis / verbalTic in
// any body slot.
//
// Body shape: [establishing_line, reaction_line, manner_note?].
//   - establishing_line (sim-backed, ≤14 words) states the culture's
//     standing — tension/comfort/familiarity band, rising
//     cultural_tension, prior-choice memory, festival/ritual pin.
//   - reaction_line (flavor, ≤12 words) narrates the owner's read of
//     the moment, gated on tags + memories + severity.
//   - manner_note (flavor, ≤10 words, optional) is a sensory beat.
//
// No `custom` predicate — the family has no actor cast surface to
// require. The seed shape is unchanged from
// `expandedSeedGenerators.ts:2206-2480`.

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
  cultureConflictChoiceLabelPool,
  cultureConflictEffectPreviewPool,
  cultureConflictEstablishingLinePool,
  cultureConflictMannerNotePool,
  cultureConflictReactionLinePool,
  cultureConflictTitlePool,
} from '../compose/pools/cultureConflict'

export const cultureConflictTemplate: CompositionalCardTemplate = {
  id: 'culture_conflict.social_conflict',
  appliesTo: {
    seedFamilies: ['culture_conflict'],
    seedTypes: ['social_conflict'],
    timings: ['during_service'],
  },
  priority: 70,
  voiceRegister: 'civic_floor',
  slots: [
    {
      id: 'title',
      role: 'title',
      pool: cultureConflictTitlePool,
      wordBudget: 6,
      claimMode: 'flavor',
    },
    {
      id: 'establishing_line',
      role: 'utterance',
      pool: cultureConflictEstablishingLinePool,
      wordBudget: 14,
      claimMode: 'sim_backed',
    },
    {
      id: 'reaction_line',
      role: 'utterance',
      pool: cultureConflictReactionLinePool,
      wordBudget: 12,
      claimMode: 'flavor',
    },
    {
      id: 'manner_note',
      role: 'aside',
      pool: cultureConflictMannerNotePool,
      optional: true,
      wordBudget: 10,
      claimMode: 'flavor',
    },
  ],
  toCardView: (filled, seed, state) => {
    return makeCardView({
      title: buildCultureConflictTitle(filled, seed, state),
      body: buildCultureConflictBody(filled),
      stakes: buildStakes(seed, 2),
      choices: composeChoicesFromSeed(seed, state, {
        labelPool: cultureConflictChoiceLabelPool,
        previewPool: cultureConflictEffectPreviewPool,
        maxPreview: 2,
      }),
      severity: seed.severity,
      tag: familyTag(seed),
    })
  },
}

function buildCultureConflictTitle(
  filled: FilledSlots,
  seed: IssueSeed,
  state: TavernState,
): string {
  const ref = seed.primaryActor
  const culture =
    ref && ref.kind === 'culture' ? state.world.cultures[ref.id] : undefined
  const display =
    culture?.label ?? seed.textIngredients.subject ?? 'A culture'
  const snippet = filled['title'] ?? 'tension across the room'
  return `${display}: ${snippet}`
}

function buildCultureConflictBody(filled: FilledSlots): string[] {
  const lines: string[] = []
  const establishing = filled['establishing_line']
  if (establishing) lines.push(establishing)
  const reaction = filled['reaction_line']
  if (reaction) lines.push(reaction)
  const manner = filled['manner_note']
  if (manner) lines.push(manner)
  return lines.slice(0, 3)
}

export const cultureConflictCard: CardDefinition = defineCompositionalCard(
  cultureConflictTemplate,
)
