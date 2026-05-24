// Phase 141 / ISSUE-110 — Voiced Surface arc, Phase 15 (Reports Prose).

import { describe, expect, it } from 'vitest'

import {
  composeDriverLine,
  composeServiceLine,
  composeTrafficLine,
  serviceCoinTag,
  trafficVolumeTag,
} from '../../../src/reports/compose/sections'
import { createInitialTavernState } from '../../../src/sim/state/defaults'

const STATE = createInitialTavernState()

describe('trafficVolumeTag', () => {
  it('bands at ≤20 / 21-60 / >60', () => {
    expect(trafficVolumeTag(1)).toBe('traffic_low')
    expect(trafficVolumeTag(20)).toBe('traffic_low')
    expect(trafficVolumeTag(21)).toBe('traffic_mid')
    expect(trafficVolumeTag(60)).toBe('traffic_mid')
    expect(trafficVolumeTag(61)).toBe('traffic_high')
    expect(trafficVolumeTag(200)).toBe('traffic_high')
  })
})

describe('serviceCoinTag', () => {
  it('bands signed: <0 loss, 0-30 small, 31-100 mid, >100 large', () => {
    expect(serviceCoinTag(-1)).toBe('service_loss')
    expect(serviceCoinTag(-50)).toBe('service_loss')
    expect(serviceCoinTag(0)).toBe('service_gain_small')
    expect(serviceCoinTag(30)).toBe('service_gain_small')
    expect(serviceCoinTag(31)).toBe('service_gain_mid')
    expect(serviceCoinTag(100)).toBe('service_gain_mid')
    expect(serviceCoinTag(101)).toBe('service_gain_large')
    expect(serviceCoinTag(500)).toBe('service_gain_large')
  })
})

describe('composeTrafficLine', () => {
  it('composes a low-volume readable with figures intact', () => {
    const line = composeTrafficLine({
      state: STATE,
      closedDay: 3,
      trafficTotal: 12,
      groupCount: 2,
    })
    expect(line).toMatch(/^(Welcomed|Seated|Served) 12 patrons across 2 groups\.$/)
  })

  it('composes a high-volume readable with figures intact', () => {
    const line = composeTrafficLine({
      state: STATE,
      closedDay: 3,
      trafficTotal: 142,
      groupCount: 5,
    })
    expect(line).toMatch(/^(Drew|Brought in|Served) 142 patrons across 5 groups\.$/)
  })

  it('is deterministic per closedDay', () => {
    const args = { state: STATE, closedDay: 7, trafficTotal: 40, groupCount: 3 }
    expect(composeTrafficLine(args)).toBe(composeTrafficLine(args))
  })
})

describe('composeServiceLine', () => {
  it('composes a small-gain line with absolute figures', () => {
    const line = composeServiceLine({
      state: STATE,
      closedDay: 3,
      netCoin: 15,
      unpaidTabs: 1,
    })
    expect(line).toMatch(/^(Pocketed|Took) 15 coin \(1 unpaid tabs\)\.$/)
  })

  it('composes a mid-gain line', () => {
    const line = composeServiceLine({
      state: STATE,
      closedDay: 3,
      netCoin: 65,
      unpaidTabs: 0,
    })
    expect(line).toMatch(/^(Earned|Banked|Took) 65 coin \(0 unpaid tabs\)\.$/)
  })

  it('composes a large-gain line', () => {
    const line = composeServiceLine({
      state: STATE,
      closedDay: 3,
      netCoin: 250,
      unpaidTabs: 2,
    })
    expect(line).toMatch(/^(Brought in|Pulled in|Took) 250 coin \(2 unpaid tabs\)\.$/)
  })

  it('composes a loss line with absolute figure (verb carries direction)', () => {
    const line = composeServiceLine({
      state: STATE,
      closedDay: 3,
      netCoin: -45,
      unpaidTabs: 3,
    })
    expect(line).toMatch(/^(Lost|Dropped|Took) 45 coin \(3 unpaid tabs\)\.$/)
  })

  it('is deterministic', () => {
    const args = {
      state: STATE,
      closedDay: 7,
      netCoin: 80,
      unpaidTabs: 1,
    }
    expect(composeServiceLine(args)).toBe(composeServiceLine(args))
  })
})

describe('composeDriverLine', () => {
  it('composes a positive driver line', () => {
    const line = composeDriverLine({
      state: STATE,
      closedDay: 3,
      driverName: 'patron rush',
      direction: 'positive',
    })
    expect(line).toMatch(/^(Boosted|Lifted|Carried|Driven) by patron rush\.$/)
  })

  it('composes a negative driver line', () => {
    const line = composeDriverLine({
      state: STATE,
      closedDay: 3,
      driverName: 'stew shortage',
      direction: 'negative',
    })
    expect(line).toMatch(/^(Held back|Dragged|Slowed|Driven) by stew shortage\.$/)
  })

  it('is deterministic per (closedDay, direction)', () => {
    const args = {
      state: STATE,
      closedDay: 7,
      driverName: 'patron rush',
      direction: 'positive' as const,
    }
    expect(composeDriverLine(args)).toBe(composeDriverLine(args))
  })
})
