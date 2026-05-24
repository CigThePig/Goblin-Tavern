// Phase 142 / ISSUE-111 — Voiced Surface arc, Phase 16 (Ambient Surface).
//
// Tests for the day-screen service empty-state composer.

import { describe, expect, it } from 'vitest'

import { composeServiceEmptyLine } from '../../../src/reports/compose/sections'
import { createInitialTavernState } from '../../../src/sim/state/defaults'

const STATE = createInitialTavernState()

describe('composeServiceEmptyLine', () => {
  it('emits a non-empty line on a plain service beat', () => {
    const line = composeServiceEmptyLine({
      state: STATE,
      closedDayOrdinal: 1,
    })
    expect(line).toBeDefined()
    expect(typeof line).toBe('string')
    expect(line!.length).toBeGreaterThan(0)
  })

  it('is deterministic per closedDayOrdinal', () => {
    const args = { state: STATE, closedDayOrdinal: 5 }
    expect(composeServiceEmptyLine(args)).toBe(composeServiceEmptyLine(args))
  })

  it('picks the end-of-week-tagged snippet when isEndOfWeek is true', () => {
    const line = composeServiceEmptyLine({
      state: STATE,
      closedDayOrdinal: 7,
      isEndOfWeek: true,
    })
    expect(line).toBeDefined()
    expect(line).toContain('week')
  })

  it('produces multiple distinct lines across day ordinals', () => {
    const lines = new Set<string>()
    for (let i = 1; i <= 14; i++) {
      const line = composeServiceEmptyLine({
        state: STATE,
        closedDayOrdinal: i,
      })
      if (line) lines.add(line)
    }
    expect(lines.size).toBeGreaterThanOrEqual(2)
  })
})
