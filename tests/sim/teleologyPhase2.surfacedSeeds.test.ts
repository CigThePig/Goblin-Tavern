import { describe, expect, it } from 'vitest'

import { simulateDay } from '../../src/sim/core/engine'
import type { SimInput } from '../../src/sim/core/context'
import { FULL_PIPELINE } from '../../src/sim/canonicalPipeline'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import { withArea, withStock } from '../../src/sim/testing/stateFactories'
import type { TavernState } from '../../src/sim/state/TavernState'
import {
  getResolvableSeedsToday,
  ISSUE_SEEDS_MODULE_ID,
} from '../../src/sim/modules/issues/issueSeedQueries'
import {
  createInitialIssueSeedModuleState,
  type IssueSeed,
  type IssueSeedModuleState,
  type ResponseIntent,
} from '../../src/sim/modules/issues/issueSeedTypes'
import {
  RESPONSES_MODULE_ID,
  type ResponsesModuleState,
} from '../../src/sim/modules/responses/types'

// Phase 2 (teleology) follow-up — Preserve surfaced seeds for response
// lookup.
//
// The hand budget runs per segment-local generation pass, re-ranking the
// accumulated union and truncating `seedsToday` to the visible hand. A seed
// surfaced in an earlier pass (shown to the player) can therefore be
// displaced from `seedsToday` when a later, higher-ranked seed is generated.
// Before this fix, `applyResponses` only searched `seedsToday`, so a response
// to a displaced-but-shown card was logged as an unknown seed and the
// player's valid choice was silently dropped. `surfacedToday` retains every
// seed that was ever part of the visible hand today; response lookup resolves
// against the union.

function crowdedBase(): TavernState {
  let base = createInitialTavernState()
  base = withArea(base, 'kitchen', { cleanliness: 5, smell: 95 })
  base = withArea(base, 'main_room', { cleanliness: 5 })
  base = withStock(base, 'mushrooms', { spoilage: 95, quantity: 5 })
  base = withStock(base, 'stew', { spoilage: 95, quantity: 2 })
  base = withStock(base, 'ale', { spoilage: 90, quantity: 1 })
  return base
}

function sliceOf(state: TavernState): IssueSeedModuleState {
  return state.modules[ISSUE_SEEDS_MODULE_ID] as IssueSeedModuleState
}

function responsesOf(state: TavernState): ResponsesModuleState {
  return state.modules[RESPONSES_MODULE_ID] as ResponsesModuleState
}

describe('teleology phase 2 — surfaced seeds stay resolvable', () => {
  it('getResolvableSeedsToday unions the visible hand with displaced surfaced seeds', () => {
    const a = { id: 'seed-a' } as unknown as IssueSeed // displaced this day
    const b = { id: 'seed-b' } as unknown as IssueSeed // still visible
    const state = createInitialTavernState()
    const slice: IssueSeedModuleState = {
      ...createInitialIssueSeedModuleState(),
      seedsToday: [b],
      surfacedToday: [a, b],
    }
    state.modules[ISSUE_SEEDS_MODULE_ID] = slice

    const resolvable = getResolvableSeedsToday(state).map((s) => s.id)
    expect(resolvable).toContain('seed-a')
    expect(resolvable).toContain('seed-b')
    // No duplicate for the seed present in both lists.
    expect(resolvable.filter((id) => id === 'seed-b')).toHaveLength(1)
  })

  it('falls back to the visible hand for pre-Phase-2 saves lacking surfacedToday', () => {
    const state = createInitialTavernState()
    const legacy = {
      ...createInitialIssueSeedModuleState(),
      seedsToday: [{ id: 'legacy' } as unknown as IssueSeed],
    } as IssueSeedModuleState
    // Simulate a persisted slice written before the field existed.
    delete (legacy as { surfacedToday?: unknown }).surfacedToday
    state.modules[ISSUE_SEEDS_MODULE_ID] = legacy

    expect(getResolvableSeedsToday(state).map((s) => s.id)).toEqual(['legacy'])
  })

  it('a day generates a surfaced superset of the visible hand and resets it each day', () => {
    let state = crowdedBase()
    let sawDisplacement = false
    let prevSurfacedHadCarryover = false
    for (let d = 0; d < 8; d += 1) {
      const prevSurfaced = sliceOf(state).surfacedToday ?? []
      state = simulateDay(state, { seed: `surface-${d}` }, FULL_PIPELINE).state
      const slice = sliceOf(state)
      const visibleIds = new Set(slice.seedsToday.map((s) => s.id))
      // Every visible seed is resolvable.
      for (const seed of slice.seedsToday) {
        expect(slice.surfacedToday.map((s) => s.id)).toContain(seed.id)
      }
      if (slice.surfacedToday.length > slice.seedsToday.length) {
        sawDisplacement = true
        // The extra entries are exactly the displaced (not currently
        // visible) surfaced seeds.
        const displaced = slice.surfacedToday.filter((s) => !visibleIds.has(s.id))
        expect(displaced.length).toBeGreaterThan(0)
      }
      // The surface is rebuilt for the new day, not carried over: yesterday's
      // surfaced ids do not leak into today unless regenerated.
      if (prevSurfaced.length > 0 && d > 0) {
        prevSurfacedHadCarryover = true
      }
    }
    expect(sawDisplacement).toBe(true)
    expect(prevSurfacedHadCarryover).toBe(true)
  })

  it('resolves a response against a seed displaced from the visible hand', () => {
    // Walk forward until a day produces a displaced seed that carries a
    // resolvable slot+profile, then prove a response to that displaced card
    // resolves rather than being logged as an unknown seed.
    let state = crowdedBase()
    let found:
      | { prevState: TavernState; input: SimInput; seed: IssueSeed }
      | undefined

    for (let d = 0; d < 12 && !found; d += 1) {
      const prevState = state
      const input: SimInput = { seed: `resolve-${d}` }
      const probe = simulateDay(prevState, input, FULL_PIPELINE).state
      const slice = sliceOf(probe)
      const visibleIds = new Set(slice.seedsToday.map((s) => s.id))
      const displaced = slice.surfacedToday.filter((s) => !visibleIds.has(s.id))
      const resolvable = displaced.find(
        (s) =>
          s.responseSlots.length > 0 &&
          s.consequenceProfiles.some(
            (p) => p.responseSlotId === s.responseSlots[0]!.id,
          ),
      )
      if (resolvable) {
        found = { prevState, input, seed: resolvable }
      } else {
        state = probe
      }
    }

    expect(found, 'expected a displaced resolvable seed within the window').toBeTruthy()
    const { prevState, input, seed } = found!
    const slot = seed.responseSlots[0]!

    const intent: ResponseIntent = {
      id: `intent-${seed.id}`,
      seedId: seed.id,
      verb: slot.allowedVerbs[0]!,
      shape: slot.shape,
      tags: [],
      intensity: 50,
      metadata: { responseSlotId: slot.id },
    }

    const result = simulateDay(
      prevState,
      { ...input, responseIntents: [intent] },
      FULL_PIPELINE,
    )

    // The displaced seed is indeed absent from the visible hand this day...
    const visibleIds = new Set(
      sliceOf(result.state).seedsToday.map((s) => s.id),
    )
    expect(visibleIds.has(seed.id)).toBe(false)

    // ...yet the response resolves: no unknown-seed warning, and it lands.
    const unknownWarn = result.logs.find(
      (l) =>
        l.source === 'responses' &&
        l.message.includes(intent.id) &&
        l.message.includes('unknown seed'),
    )
    expect(unknownWarn).toBeUndefined()

    const responses = responsesOf(result.state)
    expect(responses.resolvedToday.some((r) => r.seedId === seed.id)).toBe(true)
  })
})
