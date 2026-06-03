import { describe, expect, it } from 'vitest'

import { simulateDay } from '../../src/sim/core/engine'
import type { SimInput } from '../../src/sim/core/context'

import { areasModule } from '../../src/sim/modules/areas/index'
import { customersModule } from '../../src/sim/modules/customers/index'
import { ownerActionsModule } from '../../src/sim/modules/ownerActions/index'
import { serviceModule } from '../../src/sim/modules/service/index'
import { staffModule } from '../../src/sim/modules/staff/index'
import { stockModule } from '../../src/sim/modules/stock/index'
import { weeklyModule } from '../../src/sim/modules/weekly/index'
import { monthlyModule } from '../../src/sim/modules/monthly/index'
import { memoriesModule } from '../../src/sim/modules/memories/index'
import { historyModule } from '../../src/sim/modules/history/index'
import { causesModule } from '../../src/sim/modules/causes/index'
import {
  PRESSURE_IDS,
  EXPANDED_PRESSURE_IDS,
  PRESSURES_MODULE_ID,
  getPressureModuleState,
  pressuresModule,
} from '../../src/sim/modules/pressures/index'
import { feedbackModule } from '../../src/sim/modules/feedback/index'

import { createInitialTavernState } from '../../src/sim/state/defaults'
import type { TavernState } from '../../src/sim/state/TavernState'
import type {
  PressureModuleState,
  PressureSnapshot,
} from '../../src/sim/modules/pressures/index'
import {
  buildPressureConsequenceLine,
  buildPressureConsequenceLines,
} from '../../src/reports/pressureConsequenceLine'

// Phase 191 / ISSUE-158 — Pressure stakes projection.
//
// The projection must return *exactly* the sim's authored `consequences`
// (top line, or all lines) and nothing else — it never invents copy and is
// silent when a pressure is below its danger band (no authored
// consequences). These tests pin that contract across all 21 pressure ids.

const SEED = 'phase-191-pressure-stakes'

const FULL_PIPELINE = [
  areasModule,
  stockModule,
  staffModule,
  customersModule,
  ownerActionsModule,
  serviceModule,
  weeklyModule,
  monthlyModule,
  memoriesModule,
  historyModule,
  causesModule,
  pressuresModule,
  feedbackModule,
]

const ALL_PRESSURE_IDS: string[] = [...PRESSURE_IDS, ...EXPANDED_PRESSURE_IDS]

function input(overrides: Partial<SimInput> = {}): SimInput {
  return { seed: SEED, ...overrides }
}

function runDays(days: number): TavernState {
  let current = createInitialTavernState()
  for (let i = 0; i < days; i += 1) {
    current = simulateDay(current, input(), FULL_PIPELINE).state
  }
  return current
}

function snapshot(
  id: string,
  consequences: string[],
): PressureSnapshot {
  return {
    id,
    label: id,
    value: 80,
    previousValue: 70,
    delta: 10,
    trend: 'rising',
    severity: 80,
    urgency: 80,
    volatility: 10,
    causes: [],
    relatedActors: [],
    relatedLocations: [],
    relatedSystems: [],
    tags: [],
    consequences,
    lastUpdated: { year: 1, month: 1, week: 1, day: 1, absoluteDay: 1 },
  }
}

function stateWithSnapshots(
  snapshots: Record<string, PressureSnapshot>,
): TavernState {
  const base = createInitialTavernState()
  const slice: PressureModuleState = {
    snapshots,
    history: {},
    lastCalculatedDay: 1,
  }
  return {
    ...base,
    modules: { ...base.modules, [PRESSURES_MODULE_ID]: slice },
  }
}

describe('Phase 191 — pressure consequence projection', () => {
  it('returns the snapshot top consequence line verbatim, never invents', () => {
    const state = stateWithSnapshots({
      food_safety: snapshot('food_safety', [
        'Customers may fall ill if pressure keeps climbing.',
        'Inspection pressure will rise.',
      ]),
    })
    expect(buildPressureConsequenceLine('food_safety', state)).toBe(
      'Customers may fall ill if pressure keeps climbing.',
    )
    expect(buildPressureConsequenceLines('food_safety', state)).toEqual([
      'Customers may fall ill if pressure keeps climbing.',
      'Inspection pressure will rise.',
    ])
  })

  it('is silent for a pressure below its danger band (no consequences)', () => {
    const state = stateWithSnapshots({
      debt: snapshot('debt', []),
    })
    expect(buildPressureConsequenceLine('debt', state)).toBeUndefined()
    expect(buildPressureConsequenceLines('debt', state)).toEqual([])
  })

  it('is silent for an unknown pressure id', () => {
    const state = stateWithSnapshots({})
    expect(buildPressureConsequenceLine('not_a_pressure', state)).toBeUndefined()
    expect(buildPressureConsequenceLines('not_a_pressure', state)).toEqual([])
  })

  it('is silent when no pressure module slice exists', () => {
    const base = createInitialTavernState()
    const stripped: TavernState = {
      ...base,
      modules: Object.fromEntries(
        Object.entries(base.modules).filter(([k]) => k !== PRESSURES_MODULE_ID),
      ),
    }
    expect(buildPressureConsequenceLine('food_safety', stripped)).toBeUndefined()
    expect(buildPressureConsequenceLines('food_safety', stripped)).toEqual([])
  })

  it('ignores empty-string consequence entries', () => {
    const state = stateWithSnapshots({
      pests: snapshot('pests', ['', 'Pests spread to the cellar.']),
    })
    // Top line skips the empty entry — the line returned is real copy.
    expect(buildPressureConsequenceLines('pests', state)).toEqual([
      'Pests spread to the cellar.',
    ])
    // The single-line helper reads index 0; an empty leading entry is
    // treated as "no headline yet".
    expect(buildPressureConsequenceLine('pests', state)).toBeUndefined()
  })

  it('is deterministic — same id and state yield the same line', () => {
    const state = stateWithSnapshots({
      violence: snapshot('violence', ['Brawls become likely.']),
    })
    const a = buildPressureConsequenceLine('violence', state)
    const b = buildPressureConsequenceLine('violence', state)
    expect(a).toBe(b)
    expect(a).toBe('Brawls become likely.')
  })

  it('across all 21 pressures, the projection is exactly consequences[0] or undefined', () => {
    const state = runDays(8)
    const slice = getPressureModuleState(state)
    const seen = Object.keys(slice.snapshots)
    // The run should have produced snapshots for the registered pressures.
    expect(seen.length).toBeGreaterThan(0)

    for (const snap of Object.values(slice.snapshots)) {
      const line = buildPressureConsequenceLine(snap.id, state)
      const expected = snap.consequences.find((c) => c.length > 0)
      expect(line).toBe(expected)
      // The list helper mirrors the snapshot's own (non-empty) entries.
      expect(buildPressureConsequenceLines(snap.id, state)).toEqual(
        snap.consequences.filter((c) => c.length > 0),
      )
    }
  })

  it('every canonical + expanded pressure id projects without throwing', () => {
    const state = runDays(4)
    for (const id of ALL_PRESSURE_IDS) {
      expect(() => buildPressureConsequenceLine(id, state)).not.toThrow()
      const line = buildPressureConsequenceLine(id, state)
      expect(line === undefined || typeof line === 'string').toBe(true)
    }
    expect(ALL_PRESSURE_IDS.length).toBe(21)
  })
})
