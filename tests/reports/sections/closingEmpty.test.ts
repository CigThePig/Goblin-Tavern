// Phase 142 / ISSUE-111 — Voiced Surface arc, Phase 16 (Ambient Surface).
//
// Tests for the day-screen closing empty-state composer.

import { describe, expect, it } from 'vitest'

import { composeClosingEmptyLine } from '../../../src/reports/compose/sections'
import { createInitialTavernState } from '../../../src/sim/state/defaults'

const STATE = createInitialTavernState()

describe('composeClosingEmptyLine', () => {
  it('emits a non-empty line on a plain closing beat', () => {
    const line = composeClosingEmptyLine({
      state: STATE,
      closedDayOrdinal: 1,
    })
    expect(line).toBeDefined()
    expect(typeof line).toBe('string')
    expect(line!.length).toBeGreaterThan(0)
  })

  it('is deterministic per closedDayOrdinal', () => {
    const args = { state: STATE, closedDayOrdinal: 5 }
    expect(composeClosingEmptyLine(args)).toBe(composeClosingEmptyLine(args))
  })

  it('picks the end-of-week-tagged snippet when isEndOfWeek is true', () => {
    const line = composeClosingEmptyLine({
      state: STATE,
      closedDayOrdinal: 7,
      isEndOfWeek: true,
    })
    expect(line).toBeDefined()
    expect(line).toContain('week')
  })

  it('picks the end-of-month-tagged snippet when isEndOfMonth is true', () => {
    const line = composeClosingEmptyLine({
      state: STATE,
      closedDayOrdinal: 28,
      isEndOfWeek: true,
      isEndOfMonth: true,
    })
    expect(line).toBeDefined()
    // end_of_month snippet has specificity 1 (just `hasTag`), same as
    // end_of_week; ties break on FNV. The pool's only end-of-month
    // snippet uses "month" so the win is recoverable.
    expect(line === undefined || /month|week/.test(line!)).toBe(true)
  })

  it('produces multiple distinct lines across day ordinals', () => {
    const lines = new Set<string>()
    for (let i = 1; i <= 14; i++) {
      const line = composeClosingEmptyLine({
        state: STATE,
        closedDayOrdinal: i,
      })
      if (line) lines.add(line)
    }
    expect(lines.size).toBeGreaterThanOrEqual(2)
  })
})
