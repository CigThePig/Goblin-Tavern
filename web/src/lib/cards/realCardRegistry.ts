// Phase 88 — Card adapter for the web.
//
// Thin facade over `src/cards/`. The web layer never reaches into the
// registry directly — it calls `renderCard(seed, state)`, gets a
// `CardView`, and hands it to `<CardRenderer>`. Everything else
// (selection, fallback, registration) lives in the cards slice.
//
// This file replaces the old `mockCardRegistry.ts` that shipped with
// Phase 87 chassis.

import { pickCard } from '../../../../src/cards/index'
import type { IssueSeed } from '../../../../src/sim/modules/issues/issueSeedTypes'
import type { TavernState } from '../../../../src/sim/state/TavernState'
import type { CardView } from './types'

export function renderCard(seed: IssueSeed, state: TavernState): CardView {
  return pickCard(seed, state)
}
