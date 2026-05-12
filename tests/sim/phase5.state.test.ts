import { describe, it, expect } from 'vitest'
import { createInitialTavernState, cloneTavernState } from '../../src/sim/state/defaults'
import type {
  AreaState,
  CustomerGroupState,
  ReputationState,
  StaffState,
  StockState,
  TavernState,
} from '../../src/sim/state/TavernState'
import { createInitialCalendar } from '../../src/sim/modules/calendar/index'

const METER_BOUNDED_AREA_FIELDS: Array<keyof AreaState> = [
  'condition',
  'cleanliness',
  'mess',
  'damage',
  'smell',
  'risk',
]

const METER_BOUNDED_STOCK_FIELDS: Array<keyof StockState> = ['quality', 'spoilage']

const METER_BOUNDED_STAFF_FIELDS: Array<keyof StaffState> = [
  'skill',
  'morale',
  'stress',
  'fatigue',
  'loyalty',
]

const METER_BOUNDED_CUSTOMER_FIELDS: Array<keyof CustomerGroupState> = [
  'patronage',
  'satisfaction',
  'wealth',
  'rowdiness',
  'dangerTolerance',
  'filthTolerance',
  'priceSensitivity',
  'damageRisk',
  'tabRisk',
]

const REPUTATION_AXES: Array<keyof ReputationState> = [
  'cheap',
  'tasty',
  'filthy',
  'dangerous',
  'cozy',
  'strange',
  'reliable',
  'goblinAuthentic',
]

function isMeter(value: number): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100
}

describe('Phase 5 — Base Tavern State', () => {
  it('createInitialTavernState() returns a complete state', () => {
    const state = createInitialTavernState()
    expect(state).toMatchObject({
      meta: expect.any(Object),
      calendar: expect.any(Object),
      coin: expect.any(Number),
      areas: expect.any(Object),
      stock: expect.any(Object),
      staff: expect.any(Object),
      customerGroups: expect.any(Object),
      reputation: expect.any(Object),
      memories: expect.any(Array),
      causes: expect.any(Array),
      pressures: expect.any(Object),
      modules: expect.any(Object),
    })
  })

  it('initial state includes the Phase 3 calendar', () => {
    const state = createInitialTavernState()
    expect(state.calendar).toEqual(createInitialCalendar())
  })

  it('initial state has all five required areas', () => {
    const state = createInitialTavernState()
    expect(Object.keys(state.areas).sort()).toEqual(
      ['cellar', 'kitchen', 'main_room', 'privy', 'roof'].sort(),
    )
  })

  it('initial state has all six required stock items', () => {
    const state = createInitialTavernState()
    expect(Object.keys(state.stock).sort()).toEqual(
      ['ale', 'firewood', 'ingredients', 'mugs', 'mushrooms', 'stew'].sort(),
    )
  })

  it('initial state has all three required staff members', () => {
    const state = createInitialTavernState()
    expect(Object.keys(state.staff).sort()).toEqual(
      ['cleaner_bouncer', 'cook', 'server'].sort(),
    )
  })

  it('initial state has all five customer groups', () => {
    const state = createInitialTavernState()
    expect(Object.keys(state.customerGroups).sort()).toEqual(
      ['adventurers', 'local_goblins', 'merchants', 'miners', 'ogres'].sort(),
    )
  })

  it('reputation axes exist and are numeric', () => {
    const state = createInitialTavernState()
    for (const axis of REPUTATION_AXES) {
      expect(typeof state.reputation[axis]).toBe('number')
      expect(Number.isFinite(state.reputation[axis])).toBe(true)
    }
  })

  it('initial pressures exist', () => {
    const state = createInitialTavernState()
    // Phase 18 §"Naming reconciliation" — the canonical pressure id set
    // drops the `_pressure` suffix, replaces `structural_decay` with
    // `maintenance`, and adds `stock_shortage` and `landlord`.
    expect(Object.keys(state.pressures).sort()).toEqual(
      [
        'debt',
        'food_safety',
        'inspection',
        'landlord',
        'maintenance',
        'pests',
        'reputation_drift',
        'staff_burnout',
        'stock_shortage',
        'violence',
      ].sort(),
    )
    for (const pressure of Object.values(state.pressures)) {
      expect(pressure.trend).toBe(0)
      expect(Array.isArray(pressure.tags)).toBe(true)
      expect(Array.isArray(pressure.topCauses)).toBe(true)
    }
  })

  it('memories and causes start empty', () => {
    const state = createInitialTavernState()
    expect(state.memories).toEqual([])
    expect(state.causes).toEqual([])
  })

  it('modules state seeds the stock, owner-actions, and weekly slices (Phase 9 §9.3 / Phase 13 §13.1 / Phase 14 §14.1)', () => {
    const state = createInitialTavernState()
    expect(state.modules.stock).toEqual({ ledger: [], shortages: [] })
    // Phase 33 §33.3 widened the owner-actions slice with persistent
    // project / policy / social-action records. Empty maps + array are
    // the default-seeded shape.
    expect(state.modules.ownerActions).toEqual({
      actionPointsUsed: 0,
      actionPointBudget: 3,
      applied: [],
      rejected: [],
      projects: {},
      policies: {},
      recentSocialActions: [],
    })
    // Phase 14 §14.1 — weekly slice is seeded with empty accumulators
    // and no finalized week. The full default shape is asserted in
    // `phase14.weekly.test.ts`; here we only confirm the slice exists.
    expect(state.modules.weekly).toBeDefined()
  })

  it('all meter-like values are between 0 and 100', () => {
    const state = createInitialTavernState()

    for (const area of Object.values(state.areas)) {
      for (const field of METER_BOUNDED_AREA_FIELDS) {
        expect(isMeter(area[field] as number)).toBe(true)
      }
    }

    for (const item of Object.values(state.stock)) {
      for (const field of METER_BOUNDED_STOCK_FIELDS) {
        expect(isMeter(item[field] as number)).toBe(true)
      }
    }

    for (const staff of Object.values(state.staff)) {
      for (const field of METER_BOUNDED_STAFF_FIELDS) {
        expect(isMeter(staff[field] as number)).toBe(true)
      }
    }

    for (const group of Object.values(state.customerGroups)) {
      for (const field of METER_BOUNDED_CUSTOMER_FIELDS) {
        expect(isMeter(group[field] as number)).toBe(true)
      }
    }

    for (const axis of REPUTATION_AXES) {
      expect(isMeter(state.reputation[axis])).toBe(true)
    }

    for (const pressure of Object.values(state.pressures)) {
      expect(isMeter(pressure.value)).toBe(true)
    }
  })

  it('state can be cloned without preserving object references', () => {
    const state = createInitialTavernState()
    const clone = cloneTavernState(state)

    expect(clone).toEqual(state)
    expect(clone).not.toBe(state)
    expect(clone.meta).not.toBe(state.meta)
    expect(clone.calendar).not.toBe(state.calendar)
    expect(clone.areas).not.toBe(state.areas)
    expect(clone.areas.main_room).not.toBe(state.areas.main_room)
    expect(clone.stock).not.toBe(state.stock)
    expect(clone.staff).not.toBe(state.staff)
    expect(clone.customerGroups).not.toBe(state.customerGroups)
    expect(clone.reputation).not.toBe(state.reputation)
    expect(clone.pressures).not.toBe(state.pressures)
    expect(clone.memories).not.toBe(state.memories)
    expect(clone.causes).not.toBe(state.causes)
    expect(clone.modules).not.toBe(state.modules)

    const firstArea = state.areas.main_room
    if (firstArea) {
      const cloneArea = clone.areas.main_room
      expect(cloneArea?.tags).not.toBe(firstArea.tags)
    }
  })

  it('state can be serialized with JSON.stringify', () => {
    const state = createInitialTavernState()
    expect(() => JSON.stringify(state)).not.toThrow()
    const serialized = JSON.stringify(state)
    expect(typeof serialized).toBe('string')
    expect(serialized.length).toBeGreaterThan(0)
  })

  it('state can be deserialized back into an object with the same top-level structure', () => {
    const state = createInitialTavernState()
    const roundTripped = JSON.parse(JSON.stringify(state)) as TavernState

    expect(Object.keys(roundTripped).sort()).toEqual(Object.keys(state).sort())
    expect(roundTripped).toEqual(state)
  })

  it('overrides argument shallowly replaces top-level fields', () => {
    const customCalendar = {
      ...createInitialCalendar(),
      totalDaysElapsed: 7,
    }
    const state = createInitialTavernState({ coin: 250, calendar: customCalendar })
    expect(state.coin).toBe(250)
    expect(state.calendar.totalDaysElapsed).toBe(7)
    expect(Object.keys(state.areas).length).toBe(5)
  })
})
