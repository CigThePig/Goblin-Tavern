// Phase 88 — Catch-all card.
//
// Ensures every valid seed surfaces with something the player can play.
// The dedicated templates in `REQUIRED_CARDS` cover the high-traffic
// archetypes; everything else (the long tail of expanded families,
// low-severity warnings, arc milestones with no dedicated template
// yet) routes here.
//
// The fallback is the lowest-priority card. The selection algorithm
// only picks it when nothing else applies, but `pickCard` looks it up
// by id rather than re-running selection — keeping it priority -1 just
// documents that intent for future readers.
//
// Phase 142 / ISSUE-111 — Voiced Surface arc, Phase 16 (Ambient Surface).
// Rewritten as a compositional template. The title is composed from a
// severity-gated narrator-voiced pool; the body lines come straight
// from `seed.textIngredients` (raw sim-emitted fragments) because the
// fallback by definition catches families that have no dedicated
// snippet pools authored for them. The cards-contract truth rule holds
// by construction: body text is sourced only from the seed's own state.

import {
  buildStakes,
  buildChoicesFromSeed,
  familyTag,
  makeCardView,
} from '../cardHelpers'
import { defineCompositionalCard } from '../compose/defineCompositionalCard'
import type {
  CompositionalCardTemplate,
  FilledSlots,
} from '../compose/types'
import type { IssueSeed } from '../../sim/modules/issues/issueSeedTypes'
import { fallbackTitlePool } from '../compose/pools/fallback'
import type { CardDefinition } from '../types'

export const FALLBACK_CARD_ID = 'fallback.everySeed'

const MAX_BODY_LINES = 3

export const fallbackTemplate: CompositionalCardTemplate = {
  id: FALLBACK_CARD_ID,
  appliesTo: {
    // Empty constraints = matches every seed (selection algorithm
    // confirms with all-fields-undefined → true). Priority below 0
    // keeps it last after the registered templates.
  },
  priority: -1,
  voiceRegister: 'tavern_floor',
  slots: [
    {
      id: 'title',
      role: 'title',
      pool: fallbackTitlePool,
      wordBudget: 6,
      claimMode: 'flavor',
    },
  ],
  toCardView: (filled, seed) => {
    return makeCardView({
      title: buildFallbackTitle(filled, seed),
      body: buildFallbackBody(seed),
      stakes: buildStakes(seed),
      choices: buildChoicesFromSeed(seed),
      severity: seed.severity,
      tag: familyTag(seed),
    })
  },
}

function buildFallbackTitle(filled: FilledSlots, seed: IssueSeed): string {
  const snippet = filled['title'] ?? 'something stirs'
  const subject = seed.textIngredients.subject?.trim() || seed.family
  return `${snippet}: ${subject}`
}

function buildFallbackBody(seed: IssueSeed): string[] {
  // Body lines come straight from sim-emitted textIngredients — the
  // fallback can't author per-family snippet pools, so it presents the
  // raw fragments the seed carries (every entry already obeys
  // `TEXT_INGREDIENT_LIMITS`). No tone connectors prepended.
  const ti = seed.textIngredients
  const candidates: ReadonlyArray<string | undefined> = [
    ti.sensoryDetails[0],
    ti.recentContext[0],
    ti.pressureContext?.[0] ?? ti.stakesReadable[0],
  ]
  const lines: string[] = []
  for (const candidate of candidates) {
    if (!candidate) continue
    const trimmed = candidate.trim()
    if (!trimmed) continue
    lines.push(trimmed)
    if (lines.length >= MAX_BODY_LINES) break
  }
  return lines
}

export const fallbackCard: CardDefinition = defineCompositionalCard(
  fallbackTemplate,
)
