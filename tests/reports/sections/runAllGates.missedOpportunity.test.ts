// Phase 141 / ISSUE-110 — Voiced Surface arc, Phase 15 (Reports Prose).
//
// runAllGates integration for the Missed Opportunities readable +
// secondary sections. Both are narrator-voiced single-slot connector/
// verb pools; samplers cover the full routing surface
// (action category × delta magnitude).

import { describe, expect, it } from 'vitest'

import { runAllGates } from '../../../src/cards/compose/gates'
import {
  buildReportSeed,
  reportSectionAsTemplate,
} from '../../../src/cards/compose/reports'
import {
  missedOpportunityReadableSection,
  missedOpportunitySecondarySection,
} from '../../../src/reports/compose/sections'
import { createInitialTavernState } from '../../../src/sim/state/defaults'
import type { DeterminismSample } from '../../../src/cards/compose/gates/determinism'
import type { DiversitySampler } from '../../../src/cards/compose/gates/diversity'

const STATE = createInitialTavernState()

const ACTION_TAGS: readonly string[] = [
  'clean_action',
  'repair_action',
  'patch_action',
  'fumigate_action',
  'restock_action',
  'bonus_action',
  'price_action',
  'generic_action',
]

const TREND_TAGS: readonly string[] = [
  'trend_small',
  'trend_mid',
  'trend_large',
]

function readableDeterminismSamples(): DeterminismSample[] {
  return ACTION_TAGS.map((tag, i) => ({
    seed: buildReportSeed({
      sectionId: 'daily.missed_opportunity.readable',
      periodKey: `det-${i}`,
      timing: 'closing',
      domain: [tag],
    }),
    state: STATE,
  }))
}

function readableDiversitySampler(): DiversitySampler {
  return (i: number) => {
    const tag = ACTION_TAGS[i % ACTION_TAGS.length]!
    return {
      seed: buildReportSeed({
        sectionId: 'daily.missed_opportunity.readable',
        periodKey: `div-${i}`,
        timing: 'closing',
        domain: [tag],
      }),
      state: STATE,
    }
  }
}

function secondaryDeterminismSamples(): DeterminismSample[] {
  return TREND_TAGS.map((tag, i) => ({
    seed: buildReportSeed({
      sectionId: 'daily.missed_opportunity.secondary',
      periodKey: `det-${i}`,
      timing: 'closing',
      domain: [tag],
    }),
    state: STATE,
  }))
}

function secondaryDiversitySampler(): DiversitySampler {
  return (i: number) => {
    const tag = TREND_TAGS[i % TREND_TAGS.length]!
    return {
      seed: buildReportSeed({
        sectionId: 'daily.missed_opportunity.secondary',
        periodKey: `div-${i}`,
        timing: 'closing',
        domain: [tag],
      }),
      state: STATE,
    }
  }
}

describe('runAllGates — daily.missed_opportunity.readable section', () => {
  it('passes all seven gates', () => {
    const template = reportSectionAsTemplate(missedOpportunityReadableSection)
    const report = runAllGates(template, {
      simCoherence: { bannedDisplayNames: [] },
      determinism: { samples: readableDeterminismSamples() },
      diversity: [
        {
          slotId: 'connector',
          sampler: readableDiversitySampler(),
          config: { sampleSize: 80, minDistinct: 3 },
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

describe('runAllGates — daily.missed_opportunity.secondary section', () => {
  it('passes all seven gates', () => {
    const template = reportSectionAsTemplate(missedOpportunitySecondarySection)
    const report = runAllGates(template, {
      simCoherence: { bannedDisplayNames: [] },
      determinism: { samples: secondaryDeterminismSamples() },
      diversity: [
        {
          slotId: 'verb',
          sampler: secondaryDiversitySampler(),
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
