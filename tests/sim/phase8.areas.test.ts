import { describe, it, expect } from 'vitest'

import { simulateDay } from '../../src/sim/core/engine'
import {
  areasModule,
  getAreaQualityBand,
  isAreaDamaged,
  isAreaDangerous,
  isAreaFilthy,
  isAreaInspectionRisk,
} from '../../src/sim/modules/areas/index'
import { areaRegistry } from '../../src/sim/registries/areaRegistry'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import { validateState } from '../../src/sim/state/validation'
import type { AreaState, TavernState } from '../../src/sim/state/TavernState'

// Phase 8 — Area system.
//
// These tests cover the eight numbered cases in `phases-06-10.md` §8
// "Testing Requirements". The area module runs through `simulateDay` so
// the decay hook is exercised against the real engine pipeline.

const SEED = 'phase-8-areas-test'

function input() {
  return { seed: SEED }
}

function runDay(state: TavernState): TavernState {
  return simulateDay(state, input(), [areasModule]).state
}

function runDays(state: TavernState, days: number): TavernState {
  let current = state
  for (let i = 0; i < days; i += 1) {
    current = runDay(current)
  }
  return current
}

describe('Phase 8 — Area system', () => {
  it('1. default tavern includes main_room, kitchen, cellar, privy, and roof', () => {
    const state = createInitialTavernState()
    // Phase 73 / ISSUE-033 — area roster grows; check containment of
    // the original five rather than full-set equality.
    for (const id of ['cellar', 'kitchen', 'main_room', 'privy', 'roof']) {
      expect(state.areas[id]).toBeDefined()
    }
  })

  it('2. all required areas pass validateState immediately after createInitialTavernState', () => {
    const state = createInitialTavernState()
    expect(() => validateState(state)).not.toThrow()
    for (const id of ['main_room', 'kitchen', 'cellar', 'privy', 'roof']) {
      expect(state.areas[id]).toBeDefined()
    }
  })

  it('3. running the area module daily decay hook lowers cleanliness for affected areas', () => {
    const before = createInitialTavernState()
    const after = runDay(before)
    expect(after.areas.main_room!.cleanliness).toBeLessThan(
      before.areas.main_room!.cleanliness,
    )
    expect(after.areas.kitchen!.cleanliness).toBeLessThan(
      before.areas.kitchen!.cleanliness,
    )
  })

  it('4. privy.smell does not exceed 100 even after sustained decay days', () => {
    const base = createInitialTavernState()
    const stressed: TavernState = {
      ...base,
      areas: {
        ...base.areas,
        privy: { ...base.areas.privy!, smell: 100 },
      },
    }
    const after = runDays(stressed, 20)
    expect(after.areas.privy!.smell).toBeLessThanOrEqual(100)
    expect(after.areas.privy!.smell).toBeGreaterThanOrEqual(0)
  })

  it('5. roof.condition does not go negative even after sustained decay days', () => {
    const base = createInitialTavernState()
    const stressed: TavernState = {
      ...base,
      areas: {
        ...base.areas,
        roof: { ...base.areas.roof!, condition: 0 },
      },
    }
    const after = runDays(stressed, 50)
    expect(after.areas.roof!.condition).toBeGreaterThanOrEqual(0)
    expect(after.areas.roof!.condition).toBeLessThanOrEqual(100)
  })

  it('6. kitchen carries the food and inspection_relevant tags', () => {
    const state = createInitialTavernState()
    const tags = state.areas.kitchen!.tags
    expect(tags).toContain('food')
    expect(tags).toContain('inspection_relevant')
  })

  it('7. getAreaQualityBand returns expected band at threshold values', () => {
    const sample = (overrides: Partial<AreaState>): AreaState => ({
      id: 'sample',
      label: 'Sample',
      condition: 100,
      cleanliness: 100,
      mess: 0,
      damage: 0,
      smell: 0,
      risk: 0,
      tags: [],
      activeProblems: [],
      // Phase 28 §28.1 — identity fields are required on AreaState.
      // Tests that build sample areas pass empty defaults; the helpers
      // under test do not depend on these fields.
      traits: [],
      atmosphere: [],
      upgrades: {},
      ...overrides,
    })

    expect(getAreaQualityBand(sample({}))).toBe('excellent')
    expect(
      getAreaQualityBand(
        sample({ condition: 70, cleanliness: 70, damage: 30, mess: 30, risk: 30 }),
      ),
    ).toBe('good')
    expect(
      getAreaQualityBand(
        sample({ condition: 50, cleanliness: 50, damage: 50, mess: 50, risk: 50 }),
      ),
    ).toBe('rough')
    expect(
      getAreaQualityBand(
        sample({ condition: 30, cleanliness: 30, damage: 70, mess: 70, risk: 70 }),
      ),
    ).toBe('bad')
    expect(
      getAreaQualityBand(
        sample({ condition: 5, cleanliness: 10, damage: 90, mess: 90, risk: 95 }),
      ),
    ).toBe('critical')
  })

  it('8. area report includes the worst area (lowest condition) by name', () => {
    const state = createInitialTavernState()
    const result = simulateDay(state, input(), [areasModule])
    const areaReport = result.reports.find((r) => r.id === 'areas')
    expect(areaReport).toBeDefined()

    let worst: AreaState | undefined
    for (const area of Object.values(result.state.areas)) {
      if (!worst || area.condition < worst.condition) {
        worst = area
      }
    }
    expect(worst).toBeDefined()
    expect(areaReport!.lines.join('\n')).toContain(worst!.label)
    expect(areaReport!.data?.worstAreaId).toBe(worst!.id)
  })
})

describe('Phase 8 — Area registry & derived helpers', () => {
  it('areaRegistry exposes the five required areas with default state', () => {
    // Phase 73 / ISSUE-033 — area registry has grown; check
    // containment of the original five.
    for (const id of ['cellar', 'kitchen', 'main_room', 'privy', 'roof']) {
      expect(areaRegistry.has(id)).toBe(true)
    }
    for (const def of areaRegistry.all()) {
      expect(def.defaultState.condition).toBeGreaterThanOrEqual(0)
      expect(def.defaultState.condition).toBeLessThanOrEqual(100)
      expect(def.defaultState.activeProblems).toEqual([])
    }
  })

  it('isAreaFilthy / isAreaDamaged / isAreaDangerous classify obvious cases', () => {
    const filthy: AreaState = {
      id: 'x',
      label: 'X',
      condition: 80,
      cleanliness: 10,
      mess: 90,
      damage: 5,
      smell: 60,
      risk: 20,
      tags: [],
      activeProblems: [],
      traits: [],
      atmosphere: [],
      upgrades: {},
    }
    expect(isAreaFilthy(filthy)).toBe(true)
    expect(isAreaDamaged(filthy)).toBe(false)

    const broken: AreaState = { ...filthy, cleanliness: 80, mess: 20, damage: 75 }
    expect(isAreaDamaged(broken)).toBe(true)

    const dangerous: AreaState = { ...filthy, risk: 80 }
    expect(isAreaDangerous(dangerous)).toBe(true)
  })

  it('isAreaInspectionRisk only fires for inspection_relevant areas', () => {
    const filthy: AreaState = {
      id: 'kitchen',
      label: 'Kitchen',
      condition: 80,
      cleanliness: 10,
      mess: 95,
      damage: 5,
      smell: 75,
      risk: 60,
      tags: ['inspection_relevant'],
      activeProblems: [],
      traits: [],
      atmosphere: [],
      upgrades: {},
    }
    expect(isAreaInspectionRisk(filthy)).toBe(true)

    const sameButNotFlagged: AreaState = { ...filthy, tags: [] }
    expect(isAreaInspectionRisk(sameButNotFlagged)).toBe(false)
  })

  it('the areas module is registered with the canonical id and version fields', () => {
    expect(areasModule.id).toBe('areas')
    expect(areasModule.version).toBeTypeOf('string')
    expect(areasModule.hooks?.startDay).toBeDefined()
    expect(areasModule.hooks?.endDay).toBeDefined()
    expect(areasModule.buildReport).toBeTypeOf('function')
  })

  it('simulateDay with the area module leaves state valid and produces an areas report', () => {
    const state = createInitialTavernState()
    const result = simulateDay(state, input(), [areasModule])
    expect(result.validation.errors).toEqual([])
    expect(result.reports.find((r) => r.id === 'areas')).toBeDefined()
  })
})
