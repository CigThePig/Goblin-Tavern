import { describe, expect, it } from 'vitest'

import { simulateDay } from '../../src/sim/core/engine'
import type { SimInput } from '../../src/sim/core/context'

import { FULL_PIPELINE } from '../../src/sim/testing/simRunner'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import { withArea, withStock } from '../../src/sim/testing/stateFactories'
import type { TavernState } from '../../src/sim/state/TavernState'
import type {
  IssueSeed,
  ResponseIntent,
} from '../../src/sim/modules/issues/issueSeedTypes'
import { getIssueSeeds } from '../../src/sim/modules/issues/issueSeedQueries'
import { resolveResponseIntent } from '../../src/sim/modules/responses/responseResolver'
import type {
  PendingResponseEntry,
  ResponsesModuleState,
} from '../../src/sim/modules/responses/types'
import { RESPONSES_MODULE_ID } from '../../src/sim/modules/responses/types'

// Phase 41 / ISSUE-001 — Response pipeline + unified pending queue.
//
// Covers the five assertions from the issue's Test approach:
//   a. immediate effects landed in state
//   b. delayed entries park in pending, not in state
//   c. advancing to scheduledFor day applies them
//   d. expired entries drop with a log entry
//   e. `effect('cause', ...)` produces a cause in state.causes
//
// Plus a pure-resolver assertion: the standalone resolver also applies
// the three previously-noop kinds.

const SEED = 'phase-41-response-pipeline'

function plentyOfStock(state: TavernState): TavernState {
  return {
    ...state,
    stock: {
      ...state.stock,
      ale: { ...state.stock.ale!, quantity: 800, quality: 60 },
      stew: { ...state.stock.stew!, quantity: 400, quality: 60 },
      mushrooms: { ...state.stock.mushrooms!, quantity: 200 },
    },
  }
}

function input(overrides: Partial<SimInput> = {}): SimInput {
  return { seed: SEED, ...overrides }
}

function runDay(state: TavernState, overrides: Partial<SimInput> = {}) {
  return simulateDay(state, input(overrides), FULL_PIPELINE)
}

function getResponsesSlice(state: TavernState): ResponsesModuleState {
  return state.modules[RESPONSES_MODULE_ID] as ResponsesModuleState
}

function setupFoodSafetyDay(): {
  baseAfterDay1: TavernState
  seed: IssueSeed
} {
  let base = plentyOfStock(createInitialTavernState())
  base = withArea(base, 'kitchen', { cleanliness: 10, smell: 80 })
  base = withStock(base, 'mushrooms', { spoilage: 90 })
  base = withStock(base, 'stew', { spoilage: 80, quantity: 400 })
  const day1 = runDay(base)
  const seed = getIssueSeeds(day1.state, { family: 'food_safety' })[0]
  if (!seed) {
    throw new Error('test setup failed: no food_safety seed generated')
  }
  return { baseAfterDay1: day1.state, seed }
}

describe('Phase 41 §ISSUE-001 — Response pipeline (engine path)', () => {
  it('immediate effects from a response intent land in state', () => {
    const { baseAfterDay1, seed } = setupFoodSafetyDay()
    const cleanlinessBefore = baseAfterDay1.areas.kitchen!.cleanliness

    const intent: ResponseIntent = {
      id: 'r-clean',
      seedId: seed.id,
      verb: 'clean',
      shape: 'long_term_investment',
      tags: [],
      intensity: 50,
      metadata: { responseSlotId: 'clean_kitchen' },
    }

    const day2 = runDay(baseAfterDay1, { responseIntents: [intent] })

    expect(day2.state.areas.kitchen!.cleanliness).toBeGreaterThan(
      cleanlinessBefore,
    )

    const responseCauses = day2.state.causes.filter((c) =>
      c.tags.includes('response'),
    )
    expect(responseCauses.length).toBeGreaterThan(0)

    const responsesSlice = getResponsesSlice(day2.state)
    expect(responsesSlice.totalResolved).toBeGreaterThanOrEqual(1)
    expect(responsesSlice.resolvedToday.length).toBeGreaterThanOrEqual(1)
  })

  it('delayed entries park in the pending queue, not in target state', () => {
    const { baseAfterDay1, seed } = setupFoodSafetyDay()

    // 'serve_anyway' carries a delayedEffect of kind 'future_hook'.
    const intent: ResponseIntent = {
      id: 'r-serve',
      seedId: seed.id,
      verb: 'serve',
      shape: 'risky_profitable',
      tags: [],
      intensity: 70,
      metadata: { responseSlotId: 'serve_anyway' },
    }

    const day2 = runDay(baseAfterDay1, { responseIntents: [intent] })

    const responsesSlice = getResponsesSlice(day2.state)
    expect(responsesSlice.pending.length).toBeGreaterThan(0)

    const futureHookEntry = responsesSlice.pending.find(
      (p) =>
        p.payload.kind === 'memory_future_hook' ||
        p.payload.kind === 'future_hook',
    )
    expect(futureHookEntry).toBeDefined()
    expect(futureHookEntry!.scheduledFor).toBeGreaterThan(
      day2.state.calendar.totalDaysElapsed,
    )
  })

  it('advancing to scheduledFor applies pending entries and drains them', () => {
    const { baseAfterDay1, seed } = setupFoodSafetyDay()

    const intent: ResponseIntent = {
      id: 'r-serve',
      seedId: seed.id,
      verb: 'serve',
      shape: 'risky_profitable',
      tags: [],
      intensity: 70,
      metadata: { responseSlotId: 'serve_anyway' },
    }

    let state = runDay(baseAfterDay1, { responseIntents: [intent] }).state

    const sliceAfterResolve = getResponsesSlice(state)
    expect(sliceAfterResolve.pending.length).toBeGreaterThan(0)
    const targetEntry = sliceAfterResolve.pending[0]!
    const scheduledFor = targetEntry.scheduledFor

    // Roll the simulation forward until scheduledFor has passed. The
    // drain hook runs on `startDay`, so we run enough days to cross the
    // boundary.
    const daysToAdvance =
      scheduledFor - state.calendar.totalDaysElapsed + 1
    for (let i = 0; i < daysToAdvance; i += 1) {
      state = runDay(state).state
    }

    const sliceAfterDrain = getResponsesSlice(state)
    const stillPending = sliceAfterDrain.pending.find(
      (p) => p.id === targetEntry.id,
    )
    expect(stillPending).toBeUndefined()
    expect(sliceAfterDrain.totalApplied).toBeGreaterThanOrEqual(1)
  })

  it('pending entries past expiresAt drop without firing', () => {
    let state = plentyOfStock(createInitialTavernState())
    // First advance several days so the pending entry can have an
    // expiresAt in the past after surgery.
    for (let i = 0; i < 5; i += 1) state = runDay(state).state
    const today = state.calendar.totalDaysElapsed

    const orphanEntry: PendingResponseEntry = {
      id: `pending-orphan-${today}`,
      origin: {
        seedId: 'fake-seed',
        intentId: 'fake-intent',
        profileId: 'fake-profile',
        responseSlotId: 'fake-slot',
        verb: 'discard',
        enqueuedDay: today - 5,
      },
      scheduledFor: today - 3,
      expiresAt: today - 1, // already past expiry
      payload: {
        kind: 'state_change',
        effect: {
          kind: 'state_change',
          target: 'areas.kitchen.cleanliness',
          amount: 99,
          readable: 'should not fire',
          tags: [],
        },
      },
    }

    // Splice the orphan onto the slice directly.
    const slice = getResponsesSlice(state)
    state = {
      ...state,
      modules: {
        ...state.modules,
        [RESPONSES_MODULE_ID]: {
          ...slice,
          pending: [...slice.pending, orphanEntry],
        },
      },
    }

    const cleanlinessBefore = state.areas.kitchen!.cleanliness

    const day = runDay(state)

    const sliceAfter = getResponsesSlice(day.state)
    const stillPending = sliceAfter.pending.find((p) => p.id === orphanEntry.id)
    expect(stillPending).toBeUndefined()
    expect(sliceAfter.totalExpired).toBeGreaterThanOrEqual(1)
    // Effect must NOT have fired. The orphan effect would have added
    // +99 (clamped to 100); allow small normal-sim drift but reject any
    // change consistent with the effect firing.
    expect(day.state.areas.kitchen!.cleanliness).toBeLessThan(
      cleanlinessBefore + 10,
    )
    // A log entry should record the expiry.
    const expiryLogs = day.logs.filter(
      (l) =>
        l.source === 'responses' &&
        l.message.includes(orphanEntry.id) &&
        l.message.includes('expired'),
    )
    expect(expiryLogs.length).toBeGreaterThanOrEqual(1)
  })

  it("immediate effect('cause', ...) produces an entry in state.causes", () => {
    const { baseAfterDay1, seed } = setupFoodSafetyDay()

    // 'blame_supplier' profile has effect('cause', ...) as its only
    // immediate effect plus a delayed future_hook. Verifies that a
    // cause-kind effect now lands in state.causes via the ctx applier.
    const intent: ResponseIntent = {
      id: 'r-blame',
      seedId: seed.id,
      verb: 'blame',
      shape: 'relationship_sacrifice',
      tags: [],
      intensity: 60,
      metadata: { responseSlotId: 'blame_supplier' },
    }

    const causesBefore = baseAfterDay1.causes.length
    const day2 = runDay(baseAfterDay1, { responseIntents: [intent] })

    const newCauses = day2.state.causes.slice(causesBefore)
    const responseCauses = newCauses.filter((c) =>
      c.tags.includes('response'),
    )
    expect(responseCauses.length).toBeGreaterThan(0)
  })

  it('unknown seedId is logged and skipped without throwing', () => {
    const state = plentyOfStock(createInitialTavernState())
    const intent: ResponseIntent = {
      id: 'r-unknown',
      seedId: 'seed-does-not-exist',
      verb: 'clean',
      shape: 'long_term_investment',
      tags: [],
      intensity: 50,
    }
    const day = runDay(state, { responseIntents: [intent] })
    const warnings = day.logs.filter(
      (l) => l.source === 'responses' && l.level === 'warn',
    )
    expect(warnings.length).toBeGreaterThanOrEqual(1)
    const slice = getResponsesSlice(day.state)
    expect(slice.totalResolved).toBe(0)
  })
})

describe('Phase 41 §ISSUE-001 — Pure resolver state mutations', () => {
  it('cause-kind effects now append to state.causes on the cloned state', () => {
    const { baseAfterDay1, seed } = setupFoodSafetyDay()
    const intent: ResponseIntent = {
      id: 'r-blame',
      seedId: seed.id,
      verb: 'blame',
      shape: 'relationship_sacrifice',
      tags: [],
      intensity: 60,
      metadata: { responseSlotId: 'blame_supplier' },
    }
    const causesBefore = baseAfterDay1.causes.length
    const resolution = resolveResponseIntent(baseAfterDay1, seed, intent)
    expect(resolution.state.causes.length).toBeGreaterThan(causesBefore)
    const newCauses = resolution.state.causes.slice(causesBefore)
    expect(newCauses.some((c) => c.tags.includes('response'))).toBe(true)
  })

  it('future_hook delayed effects enqueue into the pending queue', () => {
    const { baseAfterDay1, seed } = setupFoodSafetyDay()
    const intent: ResponseIntent = {
      id: 'r-serve',
      seedId: seed.id,
      verb: 'serve',
      shape: 'risky_profitable',
      tags: [],
      intensity: 70,
      metadata: { responseSlotId: 'serve_anyway' },
    }
    const resolution = resolveResponseIntent(baseAfterDay1, seed, intent)
    const slice = resolution.state.modules[
      RESPONSES_MODULE_ID
    ] as ResponsesModuleState
    expect(slice).toBeDefined()
    expect(slice.pending.length).toBeGreaterThan(0)
  })
})
