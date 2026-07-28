import { describe, expect, it } from 'vitest'

import { simulateDay } from '../../src/sim/core/engine'
import {
  RUMOUR_MAX_ENTRIES,
  RUMOUR_STALE_DAYS,
  RUMOUR_STALE_STRENGTH,
  worldModule,
} from '../../src/sim/modules/world/worldModule'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import type {
  SocialRumourState,
  TavernState,
} from '../../src/sim/state/TavernState'

// Phase 83 — ISSUE-043: socialRumours pruning.
//
// The persistRumour helper in `weekly/community.ts` writes new
// rumours to `state.world.socialRumours` and refreshes existing
// ones, but never deletes. Long runs grew the map linearly. Phase 83
// adds an endMonth pruning hook in `worldModule`.

const SEED = 'phase-83-rumour-pruning-test'

function withRumours(
  state: TavernState,
  rumours: SocialRumourState[],
): TavernState {
  const map: Record<string, SocialRumourState> = {}
  for (const r of rumours) map[r.id] = r
  return {
    ...state,
    world: { ...state.world, socialRumours: map },
  }
}

function stale(id: string): SocialRumourState {
  // A stale rumour: lastSpreadDay far in the past, strength below the
  // prune's stale floor. Should be dropped by the endMonth prune.
  //
  // Phase 206 / audit Wave 7 — strength 8, not 5: the daily decay hook
  // now runs earlier in the same simulated day and removes anything that
  // falls under `RUMOUR_FADE_FLOOR` (5). 8 × 0.85 = 6.8 survives decay
  // but sits under `RUMOUR_STALE_STRENGTH` (10), so these fixtures still
  // exercise the prune path rather than being eaten by decay first.
  return {
    id,
    label: `stale ${id}`,
    strength: 8,
    accuracy: 'partial',
    firstHeardDay: 0,
    lastSpreadDay: 0,
    tags: [],
  }
}

function fresh(id: string, strength = 50): SocialRumourState {
  return {
    id,
    label: `fresh ${id}`,
    strength,
    accuracy: 'partial',
    firstHeardDay: 0,
    lastSpreadDay: 0,
    tags: [],
  }
}

// Position the calendar at the last day of a month so a single
// simulateDay call triggers the endMonth phase. We also bump
// totalDaysElapsed past RUMOUR_STALE_DAYS so the age-based prune
// path can fire against `lastSpreadDay: 0` fixtures.
function jumpToEndOfMonth(
  state: TavernState,
  totalDaysElapsed: number,
): TavernState {
  return {
    ...state,
    calendar: {
      ...state.calendar,
      day: 28, // DAYS_PER_MONTH = DAYS_PER_WEEK(7) × WEEKS_PER_MONTH(4) = 28
      dayOfWeek: 7,
      totalDaysElapsed,
    },
  }
}

function runEndMonthOnce(state: TavernState): TavernState {
  // Run the worldModule alone — the prune is hook-local and we want
  // to assert against it without entanglement from other modules.
  return simulateDay(state, { seed: SEED }, [worldModule]).state
}

describe('Phase 83 / ISSUE-043 — socialRumours endMonth pruning', () => {
  it('exports policy constants', () => {
    expect(RUMOUR_MAX_ENTRIES).toBeGreaterThan(0)
    expect(RUMOUR_STALE_DAYS).toBeGreaterThan(0)
    expect(RUMOUR_STALE_STRENGTH).toBeGreaterThan(0)
  })

  it('drops stale + low-strength rumours on endMonth', () => {
    let state = withRumours(createInitialTavernState(), [
      stale('rumour_old_1'),
      stale('rumour_old_2'),
      fresh('rumour_recent'),
    ])
    state = jumpToEndOfMonth(state, RUMOUR_STALE_DAYS + 5)
    state = runEndMonthOnce(state)
    // The stale entries are gone; the recent one survives (its
    // strength is above the floor).
    expect(state.world.socialRumours['rumour_old_1']).toBeUndefined()
    expect(state.world.socialRumours['rumour_old_2']).toBeUndefined()
    expect(state.world.socialRumours['rumour_recent']).toBeDefined()
  })

  it('caps total rumour count at RUMOUR_MAX_ENTRIES on endMonth', () => {
    const overage = 15
    const fixtures: SocialRumourState[] = []
    for (let i = 0; i < RUMOUR_MAX_ENTRIES + overage; i += 1) {
      fixtures.push({
        id: `rumour_${i}`,
        label: `rumour ${i}`,
        strength: 50 + (i % 20),
        accuracy: 'partial',
        firstHeardDay: 0,
        lastSpreadDay: 0,
        tags: [],
      })
    }
    let state = withRumours(createInitialTavernState(), fixtures)
    state = jumpToEndOfMonth(state, RUMOUR_STALE_DAYS + 5)
    state = runEndMonthOnce(state)
    expect(Object.keys(state.world.socialRumours).length).toBeLessThanOrEqual(
      RUMOUR_MAX_ENTRIES,
    )
  })

  it('emits a prune cause that includes the dropped count', () => {
    let state = withRumours(createInitialTavernState(), [
      stale('rumour_old_1'),
      stale('rumour_old_2'),
    ])
    state = jumpToEndOfMonth(state, RUMOUR_STALE_DAYS + 5)
    state = runEndMonthOnce(state)
    const pruneCause = state.causes.find((c) =>
      c.source.endsWith('rumour_prune'),
    )
    expect(pruneCause).toBeDefined()
    expect(pruneCause!.tags).toContain('rumour')
    expect(pruneCause!.amount).toBe(-2)
  })

  it('worldModule is wired with an endMonth hook', () => {
    expect(worldModule.hooks?.endMonth?.length).toBeGreaterThan(0)
  })

  it('day-zero run with no rumours does not emit a prune cause', () => {
    // Sanity floor — no rumours means no prune work, so no cause is
    // emitted on a clean state. Force one endMonth to confirm.
    let state = createInitialTavernState()
    state = jumpToEndOfMonth(state, RUMOUR_STALE_DAYS + 5)
    state = runEndMonthOnce(state)
    const pruneCause = state.causes.find((c) =>
      c.source.endsWith('rumour_prune'),
    )
    expect(pruneCause).toBeUndefined()
  })
})
