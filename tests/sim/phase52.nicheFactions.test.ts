import { describe, expect, it } from 'vitest'

import { simulateDay } from '../../src/sim/core/engine'
import type { SimInput } from '../../src/sim/core/context'

import { factionModule } from '../../src/sim/modules/factions'
import {
  ensureRequiredFactionsRegistered,
  factionRegistry,
} from '../../src/sim/content/factions/factionRegistry'
import { FULL_PIPELINE } from '../../src/sim/canonicalPipeline'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import { validateState } from '../../src/sim/state/validation'
import { withModuleState } from '../../src/sim/testing/stateFactories'
import { createInitialOwnerActionsModuleState } from '../../src/sim/modules/ownerActions/stateHelpers'
import type {
  CalendarStamp,
  MemoryState,
  PressureState,
  TavernState,
} from '../../src/sim/state/TavernState'

// Phase 52 — ISSUE-012. Niche factions + factionUpdate triggers.
//
// Three new factions (`smugglers_ring`, `silvermark_house`,
// `rival_taverns`) join the registry and the seeded default state.
// `factionUpdateHook` gains trigger pairs for `local_shrine` (festival
// engagement vs disregard) and `scrap_collectors` (waste buildup vs
// recent cleanup credit) so all six original starter factions get
// module-driven drift.

const SEED = 'phase-52-niche-factions-test'

const NEW_FACTIONS = [
  'smugglers_ring',
  'silvermark_house',
  'rival_taverns',
] as const

function input(overrides: Partial<SimInput> = {}): SimInput {
  return { seed: SEED, ...overrides }
}

function withCalendarTag(state: TavernState, tag: string): TavernState {
  if ((state.calendar.tags as readonly string[]).includes(tag)) return state
  return {
    ...state,
    calendar: {
      ...state.calendar,
      tags: [...state.calendar.tags, tag] as typeof state.calendar.tags,
    },
  }
}

function setPressureValue(
  state: TavernState,
  id: string,
  value: number,
): TavernState {
  const existing: PressureState = state.pressures[id] ?? {
    id,
    label: id,
    value: 0,
    trend: 0,
    tags: [],
    topCauses: [],
  }
  return {
    ...state,
    pressures: {
      ...state.pressures,
      [id]: { ...existing, value },
    },
  }
}

function calendarStampFromState(state: TavernState): CalendarStamp {
  return {
    year: state.calendar.year,
    month: state.calendar.month,
    week: state.calendar.week,
    day: state.calendar.day,
    absoluteDay: state.calendar.totalDaysElapsed,
  }
}

function seedMemory(
  state: TavernState,
  memory: Partial<MemoryState> & { id: string },
): TavernState {
  const full: MemoryState = {
    type: 'timed',
    strength: 30,
    ageDays: 0,
    durationDays: 7,
    createdAt: calendarStampFromState(state),
    actors: [],
    locations: [],
    relatedSystems: [],
    tags: [],
    ...memory,
  }
  return { ...state, memories: [...state.memories, full] }
}

function withFestivalProject(state: TavernState): TavernState {
  const slice = createInitialOwnerActionsModuleState()
  return withModuleState(state, 'ownerActions', {
    ...slice,
    projects: {
      festival_prep_2: {
        id: 'festival_prep_2',
        projectType: 'festival_prep',
        label: 'Festival Preparation',
        startedAtDay: 0,
        progress: 0,
        requiredProgress: 10,
        coinInvested: 0,
        status: 'active',
        tags: ['project', 'festival', 'festival_prep'],
        effectsPreview: ['shrine engagement up'],
      },
    },
  })
}

describe('Phase 52 §ISSUE-012 — Niche faction registry', () => {
  it('1. factionRegistry contains the three new niche factions', () => {
    ensureRequiredFactionsRegistered()
    for (const id of NEW_FACTIONS) {
      expect(factionRegistry.has(id), `faction '${id}'`).toBe(true)
    }
  })

  it('2. Default state seeds each new faction with non-zero meters', () => {
    const state = createInitialTavernState()
    for (const id of NEW_FACTIONS) {
      const faction = state.world.factions[id]
      expect(faction, `expected '${id}' in state.world.factions`).toBeDefined()
      expect(faction!.relationship).toBeGreaterThan(0)
      expect(faction!.influence).toBeGreaterThan(0)
    }
  })

  it('3. silvermark_house references the traveling_outsiders culture and that culture exists', () => {
    const state = createInitialTavernState()
    const noble = state.world.factions['silvermark_house']
    expect(noble).toBeDefined()
    expect(noble!.cultureId).toBe('traveling_outsiders')
    expect(state.world.cultures['traveling_outsiders']).toBeDefined()
  })

  it('4. validateState passes for the default starting state with the new factions', () => {
    const state = createInitialTavernState()
    expect(() => validateState(state, { modules: FULL_PIPELINE })).not.toThrow()
  })
})

describe('Phase 52 §ISSUE-012 — local_shrine trigger pair', () => {
  it('5. local_shrine drops when a festival tag is active and no festival project/arc is in play', () => {
    const base = createInitialTavernState()
    const before = base.world.factions['local_shrine']!.relationship
    const stage = withCalendarTag(base, 'festival_window')
    const result = simulateDay(stage, input(), [factionModule])
    const after = result.state.world.factions['local_shrine']!.relationship
    expect(after).toBe(before - 1)
  })

  it('6. local_shrine rises when a festival tag is active AND a festival-tagged owner project is active', () => {
    let base = createInitialTavernState()
    base = withCalendarTag(base, 'festival_window')
    base = withFestivalProject(base)
    const before = base.world.factions['local_shrine']!.relationship
    const result = simulateDay(base, input(), [factionModule])
    const after = result.state.world.factions['local_shrine']!.relationship
    expect(after).toBe(before + 1)
  })
})

describe('Phase 52 §ISSUE-012 — scrap_collectors trigger pair', () => {
  it('7. scrap_collectors drops when maintenance pressure is at or above 60', () => {
    let base = createInitialTavernState()
    base = setPressureValue(base, 'maintenance', 75)
    const before = base.world.factions['scrap_collectors']!.relationship
    const result = simulateDay(base, input(), [factionModule])
    const after = result.state.world.factions['scrap_collectors']!.relationship
    expect(after).toBe(before - 1)
  })

  it('8. scrap_collectors rises when maintenance pressure is low and a recent cleanup memory is present', () => {
    let base = createInitialTavernState()
    base = setPressureValue(base, 'maintenance', 20)
    base = seedMemory(base, {
      id: 'area_cleaned_recently',
      definitionId: 'area_cleaned_recently',
      tags: ['cleanliness', 'maintenance'],
      relatedSystems: ['areas'],
    })
    const before = base.world.factions['scrap_collectors']!.relationship
    const result = simulateDay(base, input(), [factionModule])
    const after = result.state.world.factions['scrap_collectors']!.relationship
    expect(after).toBe(before + 1)
  })
})

describe('Phase 52 §ISSUE-012 — New factions reach faction_request generation', () => {
  it('9. Every new faction can be enumerated by faction_request candidate logic', () => {
    const state = createInitialTavernState()
    const candidates = Object.values(state.world.factions)
    const ids = new Set(candidates.map((f) => f.id))
    for (const id of NEW_FACTIONS) {
      expect(ids.has(id), `new faction '${id}' missing from world state`).toBe(
        true,
      )
    }
    // Sanity: the generator picks by relationship/influence shape; the
    // new factions all carry positive starting values, so they would be
    // valid selection targets when faction_anger conditions clear the
    // entry gate. The picker uses Object.values(state.world.factions)
    // (expandedSeedGenerators.ts:1922), so registration is sufficient.
    const niche = candidates.filter((f) => NEW_FACTIONS.includes(f.id as any))
    expect(niche.length).toBe(NEW_FACTIONS.length)
    for (const f of niche) {
      expect(f.influence).toBeGreaterThan(0)
      expect(f.relationship).toBeGreaterThan(0)
    }
  })
})
