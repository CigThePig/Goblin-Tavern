import { describe, it, expect } from 'vitest'
import { z } from 'zod'

import { createInitialTavernState } from '../../src/sim/state/defaults'
import {
  safeValidateState,
  validateState,
} from '../../src/sim/state/validation'
import {
  clampNonNegative,
  clampPercent,
  normalizeArea,
  normalizeStockItem,
  normalizeTavernState,
} from '../../src/sim/state/normalize'
import {
  buildModulesSchema,
  buildTavernStateSchema,
} from '../../src/sim/state/schemas'
import {
  migrateSaveEnvelope,
  type SaveEnvelope,
} from '../../src/sim/state/saveEnvelope'
import {
  withArea,
  withCoin,
  withModuleState,
  withStock,
} from '../../src/sim/testing/stateFactories'
import {
  expectCalendarValid,
  expectNoNegativeStock,
  expectPercentRangesValid,
  expectValidState,
} from '../../src/sim/testing/stateAssertions'
import type { TavernState } from '../../src/sim/state/TavernState'
import type { SimulationModule } from '../../src/sim/core/module'

describe('Phase 6 — Schema validation', () => {
  it('1. default tavern state passes validateState', () => {
    const state = createInitialTavernState()
    expect(() => validateState(state)).not.toThrow()
  })

  it('2. negative stock quantity fails with a path identifying the item', () => {
    const state = withStock(createInitialTavernState(), 'ale', { quantity: -5 })
    let caught: Error | undefined
    try {
      validateState(state)
    } catch (err) {
      caught = err as Error
    }
    expect(caught).toBeDefined()
    expect(caught?.message).toMatch(/stock\.ale\.quantity/)
  })

  it('3. area cleanliness > 100 fails with a path identifying the area', () => {
    const state = withArea(createInitialTavernState(), 'kitchen', { cleanliness: 142 })
    let caught: Error | undefined
    try {
      validateState(state)
    } catch (err) {
      caught = err as Error
    }
    expect(caught).toBeDefined()
    expect(caught?.message).toMatch(/areas\.kitchen\.cleanliness/)
  })

  it('4. NaN coin fails validateState', () => {
    const state = withCoin(createInitialTavernState(), Number.NaN)
    expect(() => validateState(state)).toThrow(/coin/)
  })

  it('5. missing calendar block fails validateState', () => {
    const base = createInitialTavernState() as unknown as Record<string, unknown>
    const { calendar: _calendar, ...withoutCalendar } = base
    expect(() => validateState(withoutCalendar)).toThrow(/calendar/)
  })

  it('6. invalid area object (missing required fields) fails validateState', () => {
    const state = createInitialTavernState() as unknown as TavernState
    const broken: TavernState = {
      ...state,
      areas: {
        ...state.areas,
        // Missing cleanliness, condition, etc.
        kitchen: { id: 'kitchen', label: 'Kitchen' } as unknown as TavernState['areas'][string],
      },
    }
    let caught: Error | undefined
    try {
      validateState(broken)
    } catch (err) {
      caught = err as Error
    }
    expect(caught).toBeDefined()
    expect(caught?.message).toMatch(/areas\.kitchen/)
  })

  it('7. safeValidateState returns { success: false, errors } for the same inputs', () => {
    const inputs: unknown[] = [
      withStock(createInitialTavernState(), 'ale', { quantity: -5 }),
      withArea(createInitialTavernState(), 'kitchen', { cleanliness: 142 }),
      withCoin(createInitialTavernState(), Number.NaN),
      (() => {
        const base = createInitialTavernState() as unknown as Record<string, unknown>
        const { calendar: _c, ...rest } = base
        return rest
      })(),
      {
        ...createInitialTavernState(),
        areas: {
          ...createInitialTavernState().areas,
          kitchen: { id: 'kitchen', label: 'Kitchen' },
        },
      },
    ]

    for (const input of inputs) {
      const result = safeValidateState(input)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errors.length).toBeGreaterThan(0)
        expect(result.errors[0]?.path).toBeTypeOf('string')
        expect(result.errors[0]?.message).toBeTypeOf('string')
      }
    }
  })

  it('8. normalization helpers clamp values, but validateState does not silently re-clamp', () => {
    expect(clampPercent(142)).toBe(100)
    expect(clampPercent(-7)).toBe(0)
    expect(clampPercent(Number.NaN)).toBe(0)
    expect(clampNonNegative(-3)).toBe(0)
    expect(clampNonNegative(Number.NaN)).toBe(0)

    // Out-of-range values still fail validation when not normalized.
    const dirty = withArea(createInitialTavernState(), 'kitchen', { cleanliness: 142 })
    expect(() => validateState(dirty)).toThrow(/areas\.kitchen\.cleanliness/)

    // Normalization clamps when called intentionally.
    const cleaned = normalizeTavernState(dirty)
    expect(cleaned.areas.kitchen?.cleanliness).toBe(100)
    expect(() => validateState(cleaned)).not.toThrow()
  })
})

describe('Phase 6 — Module schema composition (§6.1.1)', () => {
  it('composes registered module schemas into state.modules', () => {
    const stockSchema = z.object({ ledger: z.array(z.unknown()) })
    const stockModule: SimulationModule = {
      id: 'stock',
      version: '0.0.0',
      stateSchema: stockSchema,
    }

    const baseState = createInitialTavernState()
    const goodState = withModuleState(baseState, 'stock', { ledger: [] })
    expect(() => validateState(goodState, { modules: [stockModule] })).not.toThrow()

    const badState = withModuleState(baseState, 'stock', { ledger: 'not an array' })
    expect(() => validateState(badState, { modules: [stockModule] })).toThrow(
      /modules\.stock\.ledger/,
    )
  })

  it('treats unknown module keys as warnings, not errors', () => {
    const state = withModuleState(createInitialTavernState(), 'unknown_mod', { foo: 1 })
    const result = safeValidateState(state, { modules: [] })
    expect(result.success).toBe(true)
    if (result.success) {
      // Phase 9 §9.3 seeds `state.modules.stock` by default, so when no
      // module schemas are registered there will be at least two warnings.
      // The contract this test pins is that *unknown* keys produce a
      // warning, not a hard failure.
      const unknownWarning = result.warnings.find(
        (w) => w.path === 'modules.unknown_mod',
      )
      expect(unknownWarning).toBeDefined()
      expect(unknownWarning?.code).toBe('unknown_module_key')
    }
  })

  it('ignores registered modules that have no state in the current run', () => {
    const stockSchema = z.object({ ledger: z.array(z.unknown()) })
    const stockModule: SimulationModule = {
      id: 'stock',
      version: '0.0.0',
      stateSchema: stockSchema,
    }
    // The default state has empty `state.modules` — the registered module
    // schema should not be required to be present.
    const state = createInitialTavernState()
    expect(() => validateState(state, { modules: [stockModule] })).not.toThrow()
  })

  it('buildModulesSchema returns a schema that accepts an empty object', () => {
    const schema = buildModulesSchema([])
    expect(schema.safeParse({}).success).toBe(true)
  })

  it('buildTavernStateSchema composes correctly for the default state', () => {
    const schema = buildTavernStateSchema([])
    const result = schema.safeParse(createInitialTavernState())
    expect(result.success).toBe(true)
  })
})

describe('Phase 6 — Save envelope placeholder (§6.6)', () => {
  it('migrateSaveEnvelope returns the envelope unchanged for now', () => {
    const envelope: SaveEnvelope = {
      simVersion: '0.1.0',
      enabledModules: { calendar: '0.1.0', areas: '0.1.0' },
      state: createInitialTavernState(),
    }
    const migrated = migrateSaveEnvelope(envelope)
    expect(migrated).toEqual(envelope)
  })

  it('SaveEnvelope.state validates against the standard schema', () => {
    const envelope: SaveEnvelope = {
      simVersion: '0.1.0',
      enabledModules: {},
      state: createInitialTavernState(),
    }
    expect(() => validateState(envelope.state)).not.toThrow()
  })
})

describe('Phase 6 — Normalization helpers (§6.4)', () => {
  it('normalizeArea clamps every percent field', () => {
    const state = createInitialTavernState()
    const dirty = {
      ...state.areas.kitchen!,
      condition: 250,
      cleanliness: -10,
      mess: 110,
      damage: Number.NaN,
      smell: 50,
      risk: 80,
    }
    const cleaned = normalizeArea(dirty)
    expect(cleaned.condition).toBe(100)
    expect(cleaned.cleanliness).toBe(0)
    expect(cleaned.mess).toBe(100)
    expect(cleaned.damage).toBe(0)
    expect(cleaned.smell).toBe(50)
    expect(cleaned.risk).toBe(80)
  })

  it('normalizeStockItem clamps quantity at 0 and percents at 0–100', () => {
    const state = createInitialTavernState()
    const dirty = {
      ...state.stock.ale!,
      quantity: -7,
      quality: 142,
      spoilage: -3,
    }
    const cleaned = normalizeStockItem(dirty)
    expect(cleaned.quantity).toBe(0)
    expect(cleaned.quality).toBe(100)
    expect(cleaned.spoilage).toBe(0)
  })
})

describe('Phase 6 — Test assertion helpers (§6.5)', () => {
  it('expectValidState passes for the default state', () => {
    expect(() => expectValidState(createInitialTavernState())).not.toThrow()
  })

  it('expectValidState throws on broken state', () => {
    const broken = withArea(createInitialTavernState(), 'kitchen', { cleanliness: 142 })
    expect(() => expectValidState(broken)).toThrow(/expectValidState failed/)
  })

  it('expectNoNegativeStock detects negative quantity', () => {
    const broken = withStock(createInitialTavernState(), 'ale', { quantity: -1 })
    expect(() => expectNoNegativeStock(broken)).toThrow(/stock\.ale\.quantity/)
  })

  it('expectPercentRangesValid detects out-of-range meter', () => {
    const broken = withArea(createInitialTavernState(), 'kitchen', { cleanliness: 142 })
    expect(() => expectPercentRangesValid(broken)).toThrow(/areas\.kitchen\.cleanliness/)
  })

  it('expectCalendarValid passes for the default state', () => {
    expect(() => expectCalendarValid(createInitialTavernState())).not.toThrow()
  })
})
