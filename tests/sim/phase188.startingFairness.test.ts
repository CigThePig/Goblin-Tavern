import { describe, expect, it } from 'vitest'

import { simulateDay } from '../../src/sim/core/engine'
import { FULL_PIPELINE } from '../../src/sim/canonicalPipeline'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import {
  getIssueSeeds,
  isExternalIssueSeed,
  selectOpeningLedgerEntries,
} from '../../src/sim/modules/issues/index'
import { getPressureModuleState } from '../../src/sim/modules/pressures/index'
import type { TavernState } from '../../src/sim/state/TavernState'

const SEED = 'phase-188-starting-fairness'

function runDay(state: TavernState, suffix = '') {
  return simulateDay(state, { seed: `${SEED}${suffix}` }, FULL_PIPELINE)
}

function pressure(state: TavernState, id: string) {
  return getPressureModuleState(state).snapshots[id]
}

describe('Phase 188 — inherited starting condition fairness', () => {
  it('fresh start produces no inherited blame/consequence card on Day 1', () => {
    const result = runDay(createInitialTavernState(), '-day1')
    const seeds = getIssueSeeds(result.state, { includeInvalid: true })

    expect(seeds.some((seed) => seed.family === 'staff_identity')).toBe(false)
    expect(seeds.some((seed) => seed.family === 'supplier_relationship')).toBe(false)
    expect(seeds.some((seed) => seed.family === 'faction_request')).toBe(false)
    expect(seeds.some((seed) => seed.family === 'culture_conflict')).toBe(false)
    expect(seeds.some((seed) => seed.family === 'inspection')).toBe(false)
  })

  it('after one no-action day, visible non-external issue cards are capped', () => {
    const day1 = runDay(createInitialTavernState(), '-cap-1')
    const day2 = runDay(day1.state, '-cap-2')
    const seeds = getIssueSeeds(day2.state, { includeInvalid: true })
    const nonExternal = seeds.filter((seed) => !isExternalIssueSeed(seed))

    expect(nonExternal.length).toBeLessThanOrEqual(2)
  })

  it('raw pressure diagnostics still expose inherited pressure causes', () => {
    const result = runDay(createInitialTavernState(), '-raw-pressure')
    const pests = pressure(result.state, 'pests')
    const inspection = pressure(result.state, 'inspection')

    expect(pests?.causes.some((cause) => cause.origin === 'inherited')).toBe(true)
    expect(inspection?.causes.some((cause) => cause.origin === 'inherited')).toBe(true)
  })

  it('staff loyalty baseline is unproven context, not an active loyalty crisis', () => {
    const result = runDay(createInitialTavernState(), '-staff')
    const loyaltyRisk = pressure(result.state, 'staff_loyalty_risk')

    expect(
      loyaltyRisk?.causes.some((cause) =>
        cause.id === 'avg_loyalty_low' || cause.id === 'avg_loyalty_unproven',
      ),
    ).toBe(false)
    expect(loyaltyRisk?.value ?? 0).toBeLessThan(30)
    expect(getIssueSeeds(result.state, { family: 'staff_identity' })).toEqual([])
  })

  it('active cultural observance is discovered context, not ignored neglect', () => {
    const base = createInitialTavernState()
    const state: TavernState = {
      ...base,
      calendar: {
        ...base.calendar,
        tags: [...(base.calendar.tags ?? []), 'payday'],
      },
    }
    const result = runDay(state, '-culture')
    const tension = pressure(result.state, 'cultural_tension')
    const observance = tension?.causes.find((cause) => cause.id === 'observance_active')

    expect(observance).toBeDefined()
    expect(observance?.origin).toBe('discovered')
    expect(observance?.readable.toLowerCase()).not.toContain('ignored')
    expect(observance?.origin).not.toBe('neglected')
  })

  it('default ale survives a normal first day above a fair runway threshold', () => {
    const result = runDay(createInitialTavernState(), '-ale')

    expect(result.state.stock.ale?.quantity ?? 0).toBeGreaterThanOrEqual(100)
  })

  it('opening supplier and faction baselines do not immediately count as distrust or anger', () => {
    const result = runDay(createInitialTavernState(), '-social-baseline')

    expect(pressure(result.state, 'supplier_distrust')?.value ?? 0).toBeLessThanOrEqual(10)
    expect(pressure(result.state, 'faction_anger')?.value ?? 0).toBe(0)
    expect(
      pressure(result.state, 'cultural_tension')?.causes.some(
        (cause) => cause.id === 'avg_cultural_tension',
      ),
    ).toBe(false)
  })

  it('targeted staff bonus has visible morale, stress, and loyalty effects', () => {
    const base = createInitialTavernState()
    const before = base.staff.cook!
    const result = simulateDay(
      base,
      {
        seed: `${SEED}-bonus`,
        ownerActions: [{ actionId: 'pay_staff_bonus', targetId: 'cook' }],
      },
      FULL_PIPELINE,
    )
    const after = result.state.staff.cook!

    expect(after.morale - before.morale).toBeGreaterThanOrEqual(5)
    expect(before.stress - after.stress).toBeGreaterThanOrEqual(3)
    expect(after.loyalty - before.loyalty).toBeGreaterThanOrEqual(3)
  })

  it('opening ledger represents dirty inherited areas without blame cards', () => {
    const result = runDay(createInitialTavernState(), '-ledger')
    const ledger = selectOpeningLedgerEntries(result.state)

    expect(ledger).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'cellar_dirty_pest_prone' }),
        expect.objectContaining({ id: 'privy_future_inspection_risk' }),
      ]),
    )
    expect(getIssueSeeds(result.state, { family: 'inspection' })).toEqual([])
  })
})
