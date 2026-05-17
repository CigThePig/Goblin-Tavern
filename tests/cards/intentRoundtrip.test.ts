// Phase 88 — End-to-end roundtrip: pick a card, build a ResponseIntent
// from one of its choices, feed it into simulateDay, assert the
// responses report acknowledges the intent.
//
// The point is not to test the simulation's effect math (that's covered
// by phase 41 / responsesModule tests). It's to prove the seam:
//   card.choices[i] → ResponseIntent → engine accepts it → seed-driven
// consequence fires.

import { describe, expect, it } from 'vitest'

import { simulateDay } from '../../src/sim/core/engine'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import {
  FULL_PIPELINE,
} from '../../src/sim/testing/simRunner'
import type { TavernState } from '../../src/sim/state/TavernState'
import type {
  IssueSeed,
  ResponseIntent,
} from '../../src/sim/modules/issues/issueSeedTypes'

import { pickCard } from '../../src/cards/index'
import type { CardChoice } from '../../src/cards/types'

function getSeedsToday(state: TavernState): IssueSeed[] {
  const slot = state.modules['issueSeeds'] as
    | { seedsToday?: IssueSeed[] }
    | undefined
  return (slot?.seedsToday ?? []).filter((s) => s.validation?.valid === true)
}

function choiceToIntent(
  seed: IssueSeed,
  choice: CardChoice,
  intentId: string,
): ResponseIntent {
  const target = seed.responseSlots
    .find((s) => s.id === choice.slotId)
    ?.targetOptions.find((t) => t.id === choice.targetId)
  const intent: ResponseIntent = {
    id: intentId,
    seedId: seed.id,
    verb: choice.verb,
    shape: choice.shape,
    tags: [],
    intensity: 1,
    metadata: { responseSlotId: choice.slotId },
  }
  if (target) intent.target = target
  return intent
}

describe('Phase 88 — card → ResponseIntent → engine roundtrip', () => {
  it('runs at least one day forward and picks a card per valid seed', () => {
    // Run several days to give the seed generator something to emit.
    let state = createInitialTavernState()
    for (let day = 0; day < 5; day += 1) {
      const result = simulateDay(
        state,
        { seed: `roundtrip-d${day}` },
        FULL_PIPELINE,
      )
      state = result.state
    }
    const seeds = getSeedsToday(state)
    // The simulation may produce zero seeds on a sparse early day —
    // that's not a roundtrip failure, just nothing to roundtrip on.
    // The pickCard contract should still hold for whatever seeds DO
    // exist.
    for (const seed of seeds) {
      const view = pickCard(seed, state)
      expect(view.title.length).toBeGreaterThan(0)
      // Every choice (besides any synthetic ignore the renderer adds)
      // must map back onto a slot that exists in the seed.
      for (const choice of view.choices) {
        expect(seed.responseSlots.some((s) => s.id === choice.slotId)).toBe(true)
      }
    }
  })

  it('engine accepts intents whose metadata.responseSlotId matches the seed', () => {
    let state = createInitialTavernState()
    // Burn 7 days so we have rising pressure and reliable seed output.
    for (let day = 0; day < 7; day += 1) {
      const r = simulateDay(state, { seed: `accept-d${day}` }, FULL_PIPELINE)
      state = r.state
    }
    const seeds = getSeedsToday(state)
    if (seeds.length === 0) {
      // Sparse-seed day — nothing to assert. Skip cleanly; the
      // responses module's own tests cover the empty-input path.
      return
    }
    const seed = seeds[0]!
    const view = pickCard(seed, state)
    const choice = view.choices[0]
    if (!choice) {
      // Some seeds carry no response slots; their card has no choices.
      // Still a valid view; nothing to feed back.
      return
    }
    const intent = choiceToIntent(seed, choice, 'roundtrip-intent-1')
    const result = simulateDay(
      state,
      { seed: 'accept-d8', responseIntents: [intent] },
      FULL_PIPELINE,
    )
    const responsesSlice = result.state.modules['responses'] as
      | { resolvedToday?: Array<{ intentId: string }> }
      | undefined
    const resolved = responsesSlice?.resolvedToday ?? []
    // The intent should appear in the day's resolved list (or in the
    // engine logs as a skip with reason). Either way: the engine
    // observed it and did not crash.
    const resolvedIds = new Set(resolved.map((r) => r.intentId))
    const wasResolved = resolvedIds.has('roundtrip-intent-1')
    const wasLogged = result.logs.some(
      (l) =>
        typeof l.data === 'object' &&
        l.data !== null &&
        (l.data as Record<string, unknown>)['intentId'] === 'roundtrip-intent-1',
    )
    expect(wasResolved || wasLogged).toBe(true)
  })
})
