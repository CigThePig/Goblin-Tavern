// Phase 127 / ISSUE-096 — Voiced Surface arc, Phase 1.
//
// `pressureRising` already evaluated; this test asserts it can be
// evaluated against the eleven pressure ids the broken-card audit
// flagged. The contract is that `state.pressures[id]` exists from day
// zero for every id listed below (createInitialPressures seeds them at
// safe starting values; pressureModule recomputes daily).

import { describe, expect, it } from 'vitest'

import { evalCondition } from '../../src/cards/compose/conditions'
import { pressureTrend } from '../../src/sim/signals'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import type { TavernState } from '../../src/sim/state/TavernState'
import { makeSeed } from '../cards/cardFactories'

/** The pressure ids the four target situations (supplier/staff/faction/area)
 *  + the migration phases (food safety, violence, inspection, rumour,
 *  market, customer loss, loyalty) reach for. Phase 1 verifies they are
 *  all addressable on state. */
const TARGET_PRESSURE_IDS = [
  'stock_shortage',
  'maintenance',
  'supplier_distrust',
  'faction_anger',
  'staff_loyalty_risk',
  'regular_customer_loss',
  'rumour_pressure',
  'market_instability',
  'food_safety',
  'inspection',
  'violence',
] as const

describe('Phase 127 — target pressure ids are addressable on state', () => {
  const base = createInitialTavernState()
  const seed = makeSeed()

  it.each(TARGET_PRESSURE_IDS)(
    'state.pressures[%s] exists from day zero',
    (id) => {
      expect(base.pressures[id]).toBeDefined()
    },
  )

  it.each(TARGET_PRESSURE_IDS)(
    'pressureRising on "%s" can be set to true via on-state trend',
    (id) => {
      const rising: TavernState = {
        ...base,
        pressures: {
          ...base.pressures,
          [id]: {
            ...(base.pressures[id] ?? {
              id,
              label: id,
              value: 0,
              trend: 0,
              tags: [],
              topCauses: [],
            }),
            trend: 5,
          },
        },
      }
      expect(
        evalCondition({ kind: 'pressureRising', pressureId: id }, seed, rising),
      ).toBe(true)
      expect(pressureTrend(rising, id)).toBe('rising')
    },
  )
})
