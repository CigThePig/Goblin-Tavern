// Phase 141 / ISSUE-110 — Voiced Surface arc, Phase 15 (Reports Prose).
//
// runAllGates integration: the daily header + quiet sections pass every
// gate. Both sections are tiny single-slot narrator-voiced pools — the
// expensive Phase-14 state-perturbation tables aren't needed; instead
// the samplers vary the seed's domain tags (`end_of_week`,
// `end_of_month`, `heavy_day` for header; `end_of_week` for quiet) so
// the diversity gate exercises every gated rung.

import { describe, expect, it } from 'vitest'

import { runAllGates } from '../../../src/cards/compose/gates'
import {
  buildReportSeed,
  reportSectionAsTemplate,
} from '../../../src/cards/compose/reports'
import {
  dailyHeaderSection,
  dailyQuietSection,
} from '../../../src/reports/compose/sections'
import { createInitialTavernState } from '../../../src/sim/state/defaults'
import type { DeterminismSample } from '../../../src/cards/compose/gates/determinism'
import type { DiversitySampler } from '../../../src/cards/compose/gates/diversity'

const STATE = createInitialTavernState()

const HEADER_TAG_SETS: readonly (readonly string[])[] = [
  ['closed'],
  ['closed', 'end_of_week'],
  ['closed', 'end_of_month'],
  ['closed', 'end_of_week', 'end_of_month'],
  ['closed', 'heavy_day'],
  ['closed', 'end_of_week', 'heavy_day'],
]

const QUIET_TAG_SETS: readonly (readonly string[])[] = [
  ['quiet'],
  ['quiet', 'end_of_week'],
]

function headerDeterminismSamples(): DeterminismSample[] {
  return HEADER_TAG_SETS.map((tags, i) => ({
    seed: buildReportSeed({
      sectionId: 'daily.header',
      periodKey: `det-${i}`,
      timing: 'closing',
      domain: tags,
    }),
    state: STATE,
  }))
}

function headerDiversitySampler(): DiversitySampler {
  return (i: number) => {
    const tags = HEADER_TAG_SETS[i % HEADER_TAG_SETS.length]!
    return {
      seed: buildReportSeed({
        sectionId: 'daily.header',
        periodKey: `div-${i}`,
        timing: 'closing',
        domain: tags,
      }),
      state: STATE,
    }
  }
}

function quietDeterminismSamples(): DeterminismSample[] {
  return QUIET_TAG_SETS.map((tags, i) => ({
    seed: buildReportSeed({
      sectionId: 'daily.quiet',
      periodKey: `det-${i}`,
      timing: 'closing',
      domain: tags,
    }),
    state: STATE,
  }))
}

function quietDiversitySampler(): DiversitySampler {
  return (i: number) => {
    const tags = QUIET_TAG_SETS[i % QUIET_TAG_SETS.length]!
    return {
      seed: buildReportSeed({
        sectionId: 'daily.quiet',
        periodKey: `div-${i}`,
        timing: 'closing',
        domain: tags,
      }),
      state: STATE,
    }
  }
}

describe('runAllGates — daily.header section', () => {
  it('passes all seven gates', () => {
    const template = reportSectionAsTemplate(dailyHeaderSection)
    const report = runAllGates(template, {
      simCoherence: { bannedDisplayNames: [] },
      determinism: { samples: headerDeterminismSamples() },
      diversity: [
        {
          slotId: 'line',
          sampler: headerDiversitySampler(),
          config: { sampleSize: 60, minDistinct: 3 },
        },
      ],
    })
    expect(report.coverage.pass).toBe(true)
    expect(report.specificity.pass).toBe(true)
    expect(report.voiceBounds.pass).toBe(true)
    expect(report.simCoherence.pass).toBe(true)
    expect(report.determinism.pass).toBe(true)
    expect(report.dedupe.pass).toBe(true)
    expect(report.diversity.every((d) => d.pass)).toBe(true)
    expect(report.pass).toBe(true)
  })
})

describe('runAllGates — daily.quiet section', () => {
  it('passes all seven gates', () => {
    const template = reportSectionAsTemplate(dailyQuietSection)
    const report = runAllGates(template, {
      simCoherence: { bannedDisplayNames: [] },
      determinism: { samples: quietDeterminismSamples() },
      diversity: [
        {
          slotId: 'line',
          sampler: quietDiversitySampler(),
          config: { sampleSize: 40, minDistinct: 2 },
        },
      ],
    })
    expect(report.coverage.pass).toBe(true)
    expect(report.specificity.pass).toBe(true)
    expect(report.voiceBounds.pass).toBe(true)
    expect(report.simCoherence.pass).toBe(true)
    expect(report.determinism.pass).toBe(true)
    expect(report.dedupe.pass).toBe(true)
    expect(report.diversity.every((d) => d.pass)).toBe(true)
    expect(report.pass).toBe(true)
  })
})
