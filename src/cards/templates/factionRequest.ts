// Relationship-test template — faction or culture moment. Reads the
// stored faction relationship to pick a relation noun (cooperation /
// tension / rivalry / truce / feud). Mirrors cards-contract §7 Template 6.

import {
  pickFactionRelationNoun,
  type FactionRelationKey,
} from '../../sim/content/text/descriptors'
import {
  buildBody,
  buildChoicesFromSeed,
  buildStakes,
  familyTag,
  formatTitle,
  makeCardView,
} from '../cardHelpers'
import type { CardDefinition } from '../types'

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
  toneHints: ['social', 'relational'],
  render: (seed, state) => {
    const ti = seed.textIngredients
    const factionRef =
      seed.primaryActor?.kind === 'faction' ? seed.primaryActor : undefined
    const faction = factionRef ? state.world.factions[factionRef.id] : undefined
    const relationNoun = faction
      ? pickFactionRelationNoun(pickFactionRelation(faction.relationship), seed.id)
      : undefined

    return makeCardView({
      title: formatTitle(
        faction ? [`${faction.label}:`, `a ${relationNoun}`] : [ti.subject],
      ),
      body: buildBody([
        ti.socialContext?.[0],
        ti.perceivedBlame?.[0],
        ti.relevantMemories?.[0],
      ]),
      stakes: buildStakes(seed),
      choices: buildChoicesFromSeed(seed, {
        overrides: () => (factionRef?.id ? { targetId: factionRef.id } : {}),
      }),
      severity: seed.severity,
      tag: familyTag(seed),
    })
  },
}
