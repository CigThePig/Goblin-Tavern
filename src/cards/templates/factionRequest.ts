// Relationship-test template — faction or culture moment. Reads the
// stored faction relationship to pick a relation noun (cooperation /
// tension / rivalry / truce / feud). Mirrors cards-contract §7 Template 6.
//
// Phase 95 — Voice pass.

import {
  pickFactionRelationNoun,
  type FactionRelationKey,
} from '../../sim/content/text/descriptors'
import {
  buildChoicesFromSeed,
  buildStakes,
  familyTag,
  makeCardView,
} from '../cardHelpers'
import { composeBody, composeTitle, type ComposeOpts } from '../voice/index'
import type { CardDefinition } from '../types'

const DEFINITION_TONES = ['social', 'relational', 'faction'] as const

function pickFactionRelation(relationship: number): FactionRelationKey {
  if (relationship <= 20) return 'feud'
  if (relationship <= 40) return 'rivalry'
  if (relationship <= 55) return 'tension'
  if (relationship <= 70) return 'truce'
  return 'cooperation'
}

export const factionRequestCard: CardDefinition = {
  id: 'faction_request.relationship_test',
  appliesTo: {
    seedFamilies: ['faction_request', 'culture_conflict'],
    seedTypes: ['relationship_test', 'social_conflict'],
  },
  priority: 75,
  toneHints: [...DEFINITION_TONES],
  render: (seed, state) => {
    const ti = seed.textIngredients
    const factionRef =
      seed.primaryActor?.kind === 'faction' ? seed.primaryActor : undefined
    const faction = factionRef ? state.world.factions[factionRef.id] : undefined
    const relationNoun = faction
      ? pickFactionRelationNoun(pickFactionRelation(faction.relationship), seed.id)
      : undefined

    const opts: ComposeOpts = {
      toneHints: [...DEFINITION_TONES, ...seed.toneHints],
      key: seed.id,
    }

    return makeCardView({
      title: composeTitle(
        faction ? [`${faction.label}:`, `a ${relationNoun}`] : [ti.subject],
        opts,
      ),
      body: composeBody(
        [ti.socialContext?.[0], ti.perceivedBlame?.[0], ti.relevantMemories?.[0]],
        opts,
      ),
      stakes: buildStakes(seed),
      choices: buildChoicesFromSeed(seed, {
        overrides: () => (factionRef?.id ? { targetId: factionRef.id } : {}),
      }),
      severity: seed.severity,
      tag: familyTag(seed),
    })
  },
}
