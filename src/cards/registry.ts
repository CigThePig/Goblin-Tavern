// Phase 88 — Card registry.
//
// Card definitions live in `templates/` and self-register via
// `ensureRequiredCardsRegistered()`. The registry mirrors the shape of
// the simulation registries (`Registry<T>` from `src/sim/registries/`)
// so consumers familiar with one know the other.
//
// `pickCard(seed, state)` is the single entry-point the UI uses:
//   1. it ensures cards are registered,
//   2. it runs the selection algorithm across the full registry,
//   3. it falls back to the catch-all card so every valid seed renders.

import { Registry } from '../sim/registries/Registry'
import type { IssueSeed } from '../sim/modules/issues/issueSeedTypes'
import type { TavernState } from '../sim/state/TavernState'
import type { CardDefinition, CardView } from './types'
import { pickCardForSeed } from './selection'
import { REQUIRED_CARDS, FALLBACK_CARD_ID } from './templates/index'

export const cardRegistry = new Registry<CardDefinition>()

let initialized = false

export function ensureRequiredCardsRegistered(): void {
  if (initialized) return
  for (const card of REQUIRED_CARDS) {
    if (!cardRegistry.has(card.id)) {
      cardRegistry.register(card)
    }
  }
  initialized = true
}

// Eagerly register on import. Tests that need a fresh registry can
// `cardRegistry.clear()` and re-call `ensureRequiredCardsRegistered()`.
ensureRequiredCardsRegistered()

/**
 * Render a card for the supplied seed. Falls back to the catch-all card
 * when no specific card matches so every valid seed surfaces with
 * something to play.
 */
export function pickCard(seed: IssueSeed, state: TavernState): CardView {
  ensureRequiredCardsRegistered()
  const chosen = pickCardForSeed(seed, state, cardRegistry.all())
  if (chosen) return chosen.render(seed, state)
  if (cardRegistry.has(FALLBACK_CARD_ID)) {
    return cardRegistry.get(FALLBACK_CARD_ID).render(seed, state)
  }
  throw new Error(
    `pickCard: no matching card and no fallback registered for seed ${seed.id}`,
  )
}
