// Phase 142 / ISSUE-111 — Voiced Surface arc, Phase 16 (Ambient Surface).
//
// Tests for the day-screen morning empty-state composer. Mirrors the
// Phase-15 `dailyHeader.test.ts` shape: non-empty output, determinism
// per `(closedDayOrdinal)`, gated-rung activation when calendar tags
// are routed, and FNV variety across ordinals so the same calendar day
// doesn't always pick the same fallback snippet.

import { describe, expect, it } from 'vitest'

import { composeMorningEmptyLine } from '../../../src/reports/compose/sections'
import { createInitialTavernState } from '../../../src/sim/state/defaults'

const STATE = createInitialTavernState()

describe('composeMorningEmptyLine', () => {
  it('emits a non-empty line on a plain morning', () => {
    const line = composeMorningEmptyLine({
      state: STATE,
      closedDayOrdinal: 1,
    })
    expect(line).toBeDefined()
    expect(typeof line).toBe('string')
    expect(line!.length).toBeGreaterThan(0)
  })

  it('is deterministic per closedDayOrdinal', () => {
    const args = { state: STATE, closedDayOrdinal: 5 }
    expect(composeMorningEmptyLine(args)).toBe(composeMorningEmptyLine(args))
  })

  it('picks the end-of-week-tagged snippet when isEndOfWeek is true', () => {
    const line = composeMorningEmptyLine({
      state: STATE,
      closedDayOrdinal: 7,
      isEndOfWeek: true,
    })
    expect(line).toBeDefined()
    // The end_of_week snippet has specificity 1; it always wins over
    // the unconditional fallback rungs when end_of_week is in seed.domain.
    expect(line).toContain('week')
  })

  it('produces multiple distinct lines across day ordinals', () => {
    const lines = new Set<string>()
    for (let i = 1; i <= 14; i++) {
      const line = composeMorningEmptyLine({
        state: STATE,
        closedDayOrdinal: i,
      })
      if (line) lines.add(line)
    }
    // Across 14 ordinals we expect a healthy variety from FNV
    // tie-breaking on the five-snippet fallback pool.
    expect(lines.size).toBeGreaterThanOrEqual(2)
  })
})
