// Phase 160 / ISSUE-128 — Legible Surface arc, Phase 15 (Report-Prose
// Legibility). Pins the contract that voiced reports never restate the
// structured figure — the sim figure (signed delta, value, count, coin
// amount) MUST land verbatim in the composed line; the voiced verb
// wraps the figure, never absorbs it. Guards against future drift
// where a "rose a notch (+5)" snippet absorbs the +5 into prose and
// becomes "rose by five points".

import { describe, expect, it } from 'vitest'

import {
  composeDriverLine,
  composePressureReadableVoiced,
  composePressureSecondaryVoiced,
  composeServiceLine,
  composeTrafficLine,
  pickYesterdayCoinVerb,
  pickYesterdayPressureVerb,
  pickYesterdayReputationVerb,
} from '../../../src/reports/compose/sections'
import { createInitialTavernState } from '../../../src/sim/state/defaults'

const STATE = createInitialTavernState()

describe('figure exactness — yesterday digest verbs (pickers return verb only)', () => {
  it('reputation picker returns only the verb (figure is composed by projection)', () => {
    // The picker returns the verb fragment; the figure is appended by
    // the projection in `yesterdayDigest.ts:repSecondary`. This test
    // pins that the verb does NOT itself contain any digit.
    for (const delta of [2, 6, 15, -2, -6, -15]) {
      const v = pickYesterdayReputationVerb({
        state: STATE,
        closedDayOrdinal: 3,
        axis: 'cozy',
        delta,
      })
      expect(v).not.toMatch(/\d/)
    }
  })

  it('pressure picker returns only the verb', () => {
    for (const delta of [2, 5, 15]) {
      const v = pickYesterdayPressureVerb({
        state: STATE,
        closedDayOrdinal: 3,
        pressureId: 'food_safety',
        delta,
      })
      expect(v).not.toMatch(/\d/)
    }
  })

  it('coin picker returns only the verb', () => {
    for (const delta of [10, 60, 150, -10, -60, -150]) {
      const v = pickYesterdayCoinVerb({
        state: STATE,
        closedDayOrdinal: 3,
        delta,
      })
      expect(v).not.toMatch(/\d/)
    }
  })
})

describe('figure exactness — composeTrafficLine', () => {
  it('renders the exact patron count and group count verbatim', () => {
    for (const total of [12, 40, 142]) {
      for (const groups of [2, 5, 11]) {
        const line = composeTrafficLine({
          state: STATE,
          closedDay: 3,
          trafficTotal: total,
          groupCount: groups,
        })
        expect(line).toContain(`${total} patrons`)
        expect(line).toContain(`${groups} groups`)
      }
    }
  })
})

describe('figure exactness — composeServiceLine', () => {
  it('renders the absolute coin amount and tab count verbatim', () => {
    for (const net of [15, 65, 250, -15, -65, -250]) {
      for (const tabs of [0, 1, 5]) {
        const line = composeServiceLine({
          state: STATE,
          closedDay: 3,
          netCoin: net,
          unpaidTabs: tabs,
        })
        expect(line).toContain(`${Math.abs(net)} coin`)
        expect(line).toContain(`(${tabs} unpaid tabs)`)
      }
    }
  })
})

describe('figure exactness — composeDriverLine', () => {
  it('renders the driver name verbatim', () => {
    const line = composeDriverLine({
      state: STATE,
      closedDay: 3,
      driverName: 'patron rush',
      direction: 'positive',
    })
    expect(line).toContain('patron rush')
  })
})

describe('figure exactness — composePressureSecondaryVoiced', () => {
  it('renders the signed delta and value verbatim', () => {
    for (const delta of [2, 5, 15, -2, -5, -15]) {
      for (const value of [10, 67, 90]) {
        const line = composePressureSecondaryVoiced({
          state: STATE,
          closedDay: 3,
          actionId: 'clean_area',
          targetId: 'kitchen',
          pressureLabel: 'Food safety',
          pressureDelta: delta,
          pressureValue: value,
        })
        const signed = delta >= 0 ? `+${delta}` : `${delta}`
        expect(line).toContain(`${signed} to ${value}.`)
        expect(line).toContain('Food safety')
      }
    }
  })
})

describe('figure exactness — composePressureReadableVoiced', () => {
  it('preserves the action target label and pressure label verbatim', () => {
    const line = composePressureReadableVoiced({
      state: STATE,
      closedDay: 3,
      actionId: 'clean_area',
      actionLabel: 'Clean',
      targetLabel: 'kitchen',
      pressureLabel: 'Food safety',
      pressureDelta: 5,
    })
    expect(line).toContain('kitchen')
    expect(line).toContain('food safety')
    expect(line.endsWith('.')).toBe(true)
  })
})
