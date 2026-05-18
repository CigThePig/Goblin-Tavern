// Crisis template — immediate, high-severity floor-safety situation.
// Mirrors cards-contract §7 Template 1 (foodSafetyCrisisCard).
//
// Phase 95 — Voice pass. The template's declared toneHints
// (`['urgent', 'visceral']`) are now passed through the voice
// composer so titles gain a tone-driven adjective ("Acrid …",
// "Pressing …") and body lines pick up an evocative connector
// ("the smell carries, …"). Deterministic per `seed.id`.

import { pickSeverityAdjective } from '../../sim/content/text/descriptors'
import {
  buildChoicesFromSeed,
  buildStakes,
  familyTag,
  makeCardView,
} from '../cardHelpers'
import { composeBody, composeTitle, type ComposeOpts } from '../voice/index'
import type { CardDefinition } from '../types'

const DEFINITION_TONES = ['urgent', 'visceral'] as const

export const foodSafetyCrisisCard: CardDefinition = {
  id: 'food_safety.crisis.serviceFloor',
  appliesTo: {
    seedFamilies: ['food_safety'],
    seedTypes: ['crisis'],
    timings: ['during_service'],
    minSeverity: 60,
  },
  priority: 90,
  toneHints: [...DEFINITION_TONES],
  render: (seed) => {
    const adj = pickSeverityAdjective(seed.severity, seed.id)
    const ti = seed.textIngredients
    const opts: ComposeOpts = {
      toneHints: [...DEFINITION_TONES, ...seed.toneHints],
      key: seed.id,
    }
    return makeCardView({
      title: composeTitle([adj, ti.subject], opts),
      body: composeBody(
        [ti.sensoryDetails[0], ti.recentContext[0], ti.stakesReadable[0]],
        opts,
      ),
      stakes: buildStakes(seed),
      choices: buildChoicesFromSeed(seed),
      severity: seed.severity,
      tag: familyTag(seed),
    })
  },
}
