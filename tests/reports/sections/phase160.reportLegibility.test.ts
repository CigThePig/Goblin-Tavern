// Phase 160 / ISSUE-128 — Legible Surface arc, Phase 15 (Report-Prose
// Legibility). Fixture tests for the new `checkReportLegibility` gate:
// pass case, fail case per direction × band cell, determinism check.
// Live integration is exercised by the per-section `runAllGates.*` tests
// which thread a real `tagToBand` map through `runAllGates`.

import { describe, expect, it } from 'vitest'

import {
  checkReportLegibility,
  REPORT_LEGIBILITY_REASONS,
  type ReportLegibilityConfig,
} from '../../../src/cards/compose/gates'
import { reportSectionAsTemplate } from '../../../src/cards/compose/reports'
import type { ReportSection } from '../../../src/cards/compose/reports'
import type { SlotSpec, SnippetPool } from '../../../src/cards/compose/types'

function makeSection(pool: SnippetPool): ReportSection {
  const slot: SlotSpec = {
    id: 'verb',
    role: 'aside',
    pool,
    optional: false,
    wordBudget: 6,
    claimMode: 'flavor',
  }
  return {
    id: 'test.fixture',
    voiceRegister: 'tavern_floor',
    slots: [slot],
  }
}

describe('checkReportLegibility — REASONS', () => {
  it('exports a frozen list with the single defined reason', () => {
    expect(REPORT_LEGIBILITY_REASONS).toEqual(['report_magnitude_missing'])
    expect(Object.isFrozen(REPORT_LEGIBILITY_REASONS)).toBe(true)
  })
})

describe('checkReportLegibility — pass cases', () => {
  it('passes when every banded snippet carries a lexicon token', () => {
    const pool: SnippetPool = {
      slotId: 'verb',
      snippets: [
        { id: 'fallback', text: 'shifted', conditions: [] },
        {
          id: 'small_notch',
          text: 'rose a notch',
          conditions: [{ kind: 'hasTag', tag: 'gain_small' }],
        },
        {
          id: 'mid_real_step',
          text: 'climbed a real step',
          conditions: [{ kind: 'hasTag', tag: 'gain_mid' }],
        },
        {
          id: 'large_surge',
          text: 'surged a strong climb',
          conditions: [{ kind: 'hasTag', tag: 'gain_large' }],
        },
      ],
    }
    const template = reportSectionAsTemplate(makeSection(pool))
    const config: ReportLegibilityConfig = {
      tagToBand: {
        gain_small: { direction: 'positive', band: 'small' },
        gain_mid: { direction: 'positive', band: 'medium' },
        gain_large: { direction: 'positive', band: 'large' },
      },
    }
    const report = checkReportLegibility(template, config)
    expect(report.pass).toBe(true)
    expect(report.violations).toEqual([])
    expect(report.observed.bandedSnippets).toBe(3)
    expect(report.observed.magnitudeOkSnippets).toBe(3)
  })

  it('skips snippets without band-mapped tags (opt-in cell-by-cell)', () => {
    const pool: SnippetPool = {
      slotId: 'verb',
      snippets: [
        { id: 'fallback', text: 'shifted', conditions: [] },
        {
          id: 'direction_only',
          text: 'rose',
          conditions: [{ kind: 'hasTag', tag: 'gain' }],
        },
      ],
    }
    const template = reportSectionAsTemplate(makeSection(pool))
    const report = checkReportLegibility(template, { tagToBand: {} })
    expect(report.pass).toBe(true)
    expect(report.observed.bandedSnippets).toBe(0)
  })
})

describe('checkReportLegibility — fail cases', () => {
  function failsWith(
    direction: 'positive' | 'negative' | 'neutral',
    band: 'tiny' | 'small' | 'medium' | 'large',
    text: string,
  ): void {
    const pool: SnippetPool = {
      slotId: 'verb',
      snippets: [
        { id: 'fallback', text: 'shifted', conditions: [] },
        {
          id: 'banded',
          text,
          conditions: [{ kind: 'hasTag', tag: 'cell' }],
        },
      ],
    }
    const template = reportSectionAsTemplate(makeSection(pool))
    const report = checkReportLegibility(template, {
      tagToBand: { cell: { direction, band } },
    })
    expect(report.pass).toBe(false)
    expect(report.violations).toHaveLength(1)
    expect(report.violations[0]!.reason).toBe('report_magnitude_missing')
    expect(report.violations[0]!.snippetId).toBe('banded')
    expect(report.observed.bandedSnippets).toBe(1)
    expect(report.observed.magnitudeOkSnippets).toBe(0)
  }

  it('fires for positive × small when no small token present', () => {
    failsWith('positive', 'small', 'rose sharply')
  })

  it('fires for positive × medium when no medium token present', () => {
    failsWith('positive', 'medium', 'climbed a bit')
  })

  it('fires for positive × large when no large token present', () => {
    failsWith('positive', 'large', 'surged quickly')
  })

  it('fires for negative × small', () => {
    failsWith('negative', 'small', 'slipped sharply')
  })

  it('fires for negative × medium', () => {
    failsWith('negative', 'medium', 'fell a bit')
  })

  it('fires for negative × large', () => {
    failsWith('negative', 'large', 'plunged quickly')
  })

  it('fires for positive × tiny', () => {
    failsWith('positive', 'tiny', 'rose sharply')
  })

  it('fires for neutral × small when no neutral-small token present', () => {
    failsWith('neutral', 'small', 'moved upward')
  })
})

describe('checkReportLegibility — determinism', () => {
  it('produces identical violation lists across two runs', () => {
    const pool: SnippetPool = {
      slotId: 'verb',
      snippets: [
        { id: 'fallback', text: 'shifted', conditions: [] },
        {
          id: 'ok',
          text: 'rose a notch',
          conditions: [{ kind: 'hasTag', tag: 'gain_small' }],
        },
        {
          id: 'bad_1',
          text: 'climbed sharply',
          conditions: [{ kind: 'hasTag', tag: 'gain_mid' }],
        },
        {
          id: 'bad_2',
          text: 'surged quickly',
          conditions: [{ kind: 'hasTag', tag: 'gain_large' }],
        },
      ],
    }
    const template = reportSectionAsTemplate(makeSection(pool))
    const config: ReportLegibilityConfig = {
      tagToBand: {
        gain_small: { direction: 'positive', band: 'small' },
        gain_mid: { direction: 'positive', band: 'medium' },
        gain_large: { direction: 'positive', band: 'large' },
      },
    }
    const a = checkReportLegibility(template, config)
    const b = checkReportLegibility(template, config)
    expect(a.pass).toBe(b.pass)
    expect(a.violations.map((v) => v.snippetId)).toEqual(
      b.violations.map((v) => v.snippetId),
    )
    expect(a.observed).toEqual(b.observed)
  })
})
