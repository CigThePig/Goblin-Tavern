// Phase 141 / ISSUE-110 — Voiced Surface arc, Phase 15 (Reports Prose).
//
// Tests for the daily quiet-day line section composer.

import { describe, expect, it } from 'vitest'

import { composeDailyQuietLine } from '../../../src/reports/compose/sections'
import { createInitialTavernState } from '../../../src/sim/state/defaults'

const STATE = createInitialTavernState()

describe('composeDailyQuietLine', () => {
  it('emits a non-empty line', () => {
    const line = composeDailyQuietLine({
      state: STATE,
      closedDayOrdinal: 1,
      isEndOfWeek: false,
    })
    expect(line).toBeDefined()
    expect(typeof line).toBe('string')
    expect(line!.length).toBeGreaterThan(0)
  })

  it('is deterministic per closedDayOrdinal', () => {
    const args = { state: STATE, closedDayOrdinal: 5, isEndOfWeek: false }
    expect(composeDailyQuietLine(args)).toBe(composeDailyQuietLine(args))
  })

  it('picks the end-of-week tagged snippet when isEndOfWeek is true', () => {
    const line = composeDailyQuietLine({
      state: STATE,
      closedDayOrdinal: 7,
      isEndOfWeek: true,
    })
    expect(line).toBeDefined()
    expect(line).toContain('week')
  })

  it('varies across day ordinals (diversity across fallback voicings)', () => {
    const lines = new Set<string>()
    for (let i = 1; i <= 14; i++) {
      const line = composeDailyQuietLine({
        state: STATE,
        closedDayOrdinal: i,
        isEndOfWeek: false,
      })
      if (line) lines.add(line)
    }
    expect(lines.size).toBeGreaterThanOrEqual(2)
  })
})
