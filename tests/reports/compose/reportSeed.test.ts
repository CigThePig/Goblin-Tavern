// Phase 141 / ISSUE-110 — Voiced Surface arc, Phase 15 (Reports Prose).
//
// Unit tests for the synthetic report-seed builder. The load-bearing
// property is `seed.id` stability across calls: same `(sectionId,
// periodKey)` produces the same id, which feeds the FNV tie-break in
// `pickSnippet` and keeps re-renders byte-identical.

import { describe, expect, it } from 'vitest'

import {
  buildReportSeed,
  type ReportSeedTiming,
} from '../../../src/cards/compose/reports/reportSeed'

describe('buildReportSeed', () => {
  it('produces a stable id per (sectionId, periodKey)', () => {
    const a = buildReportSeed({
      sectionId: 'weekly.signals',
      periodKey: 'W04Y1',
      timing: 'end_week',
    })
    const b = buildReportSeed({
      sectionId: 'weekly.signals',
      periodKey: 'W04Y1',
      timing: 'end_week',
    })
    expect(a.id).toBe(b.id)
    expect(a.id).toBe('report.weekly.signals.W04Y1')
  })

  it('encodes timing per section', () => {
    const timings: ReportSeedTiming[] = [
      'closing',
      'morning_prep',
      'end_week',
      'end_month',
      'during_service',
    ]
    for (const timing of timings) {
      const seed = buildReportSeed({
        sectionId: 'x',
        periodKey: 'k',
        timing,
      })
      expect(seed.timing).toBe(timing)
    }
  })

  it('omits primaryActor when not supplied', () => {
    const seed = buildReportSeed({
      sectionId: 'weekly.signals',
      periodKey: 'W04',
      timing: 'end_week',
    })
    expect(seed.primaryActor).toBeUndefined()
  })

  it('binds primaryActor when supplied (row-scoped sections)', () => {
    const seed = buildReportSeed({
      sectionId: 'weekly.staff_row',
      periodKey: 'W04',
      timing: 'end_week',
      primaryActor: { kind: 'staff', id: 'staff:bran' },
    })
    expect(seed.primaryActor).toEqual({ kind: 'staff', id: 'staff:bran' })
  })

  it('passes domain + toneHints through verbatim', () => {
    const seed = buildReportSeed({
      sectionId: 'monthly.landlord',
      periodKey: 'M03',
      timing: 'end_month',
      domain: ['rent_paid', 'reserves_held'],
      toneHints: ['strategic'],
    })
    expect(seed.domain).toEqual(['rent_paid', 'reserves_held'])
    expect(seed.toneHints).toEqual(['strategic'])
  })

  it('zeroes numeric fields (severity reads state, not seed)', () => {
    const seed = buildReportSeed({
      sectionId: 'x',
      periodKey: 'k',
      timing: 'closing',
    })
    expect(seed.severity).toBe(0)
    expect(seed.urgency).toBe(0)
    expect(seed.novelty).toBe(0)
    expect(seed.cardWorthiness).toBe(0)
  })

  it('produces empty arrays for all list fields the runtime never reads', () => {
    const seed = buildReportSeed({
      sectionId: 'x',
      periodKey: 'k',
      timing: 'closing',
    })
    expect(seed.affectedActors).toEqual([])
    expect(seed.causes).toEqual([])
    expect(seed.pressures).toEqual([])
    expect(seed.stakes).toEqual([])
    expect(seed.responseSlots).toEqual([])
    expect(seed.consequenceProfiles).toEqual([])
    expect(seed.memoriesCreated).toEqual([])
    expect(seed.futureHooks).toEqual([])
  })

  it('passes Zod-style validation as a valid seed shape', () => {
    const seed = buildReportSeed({
      sectionId: 'x',
      periodKey: 'k',
      timing: 'closing',
    })
    expect(seed.validation.valid).toBe(true)
    expect(seed.validation.errors).toEqual([])
  })
})
