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
  missedOpportunityDiffSection,
  missedOpportunityIgnoredSection,
  missedOpportunityReadableSection,
  missedOpportunitySecondarySection,
} from '../../../src/reports/compose/sections'
import { createInitialTavernState } from '../../../src/sim/state/defaults'
import type { DeterminismSample } from '../../../src/cards/compose/gates/determinism'
import type { DiversitySampler } from '../../../src/cards/compose/gates/diversity'
import type { ReportLegibilityConfig } from '../../../src/cards/compose/gates'

// Phase 160 / ISSUE-128 — Legible Surface arc, Phase 15. The secondary
// pool routes by absolute-delta tier (trend_small / mid / large) and
// every banded snippet carries a MAGNITUDE_LEXICON.positive.* token.
// (Pressure rises in this surface are always positive direction = bad;
// see `pools/missedOpportunity/secondaryVerb.ts`.)
const TREND_TAG_TO_BAND: ReportLegibilityConfig['tagToBand'] = {
  trend_small: { direction: 'positive', band: 'small' },
  trend_mid: { direction: 'positive', band: 'medium' },
  trend_large: { direction: 'positive', band: 'large' },
}

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
  it('passes all ten gates (incl. reportLegibility on trend_* tags)', () => {
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
      reportLegibility: { tagToBand: TREND_TAG_TO_BAND },
    })
    expect(report.coverage.pass).toBe(true)
    expect(report.specificity.pass).toBe(true)
    expect(report.voiceBounds.pass).toBe(true)
    expect(report.simCoherence.pass).toBe(true)
    expect(report.determinism.pass).toBe(true)
    expect(report.dedupe.pass).toBe(true)
    expect(report.diversity.every((d) => d.pass)).toBe(true)
    expect(report.reportLegibility.pass).toBe(true)
    expect(report.reportLegibility.skipped).toBe(false)
    expect(report.reportLegibility.observed.bandedSnippets).toBeGreaterThan(0)
    expect(report.pass).toBe(true)
  })
})

// — diff_counterfactual section —

function diffDeterminismSamples(): DeterminismSample[] {
  return ACTION_TAGS.map((tag, i) => ({
    seed: buildReportSeed({
      sectionId: 'daily.missed_opportunity.diff',
      periodKey: `det-${i}`,
      timing: 'closing',
      domain: [tag],
    }),
    state: STATE,
  }))
}

function diffDiversitySampler(): DiversitySampler {
  return (i: number) => {
    const tag = ACTION_TAGS[i % ACTION_TAGS.length]!
    return {
      seed: buildReportSeed({
        sectionId: 'daily.missed_opportunity.diff',
        periodKey: `div-${i}`,
        timing: 'closing',
        domain: [tag],
      }),
      state: STATE,
    }
  }
}

describe('runAllGates — daily.missed_opportunity.diff section', () => {
  it('passes all seven gates', () => {
    const template = reportSectionAsTemplate(missedOpportunityDiffSection)
    const report = runAllGates(template, {
      simCoherence: { bannedDisplayNames: [] },
      determinism: { samples: diffDeterminismSamples() },
      diversity: [
        {
          slotId: 'diff_connector',
          sampler: diffDiversitySampler(),
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

// — ignored_seed section —

const IGNORED_TAGS: readonly string[] = [
  'ignored_low',
  'ignored_mid',
  'ignored_high',
]

function ignoredDeterminismSamples(): DeterminismSample[] {
  return IGNORED_TAGS.map((tag, i) => ({
    seed: buildReportSeed({
      sectionId: 'daily.missed_opportunity.ignored',
      periodKey: `det-${i}`,
      timing: 'closing',
      domain: [tag],
    }),
    state: STATE,
  }))
}

function ignoredDiversitySampler(): DiversitySampler {
  return (i: number) => {
    const tag = IGNORED_TAGS[i % IGNORED_TAGS.length]!
    return {
      seed: buildReportSeed({
        sectionId: 'daily.missed_opportunity.ignored',
        periodKey: `div-${i}`,
        timing: 'closing',
        domain: [tag],
      }),
      state: STATE,
    }
  }
}

describe('runAllGates — daily.missed_opportunity.ignored section', () => {
  it('passes all seven gates', () => {
    const template = reportSectionAsTemplate(missedOpportunityIgnoredSection)
    const report = runAllGates(template, {
      simCoherence: { bannedDisplayNames: [] },
      determinism: { samples: ignoredDeterminismSamples() },
      diversity: [
        {
          slotId: 'ignored_verb',
          sampler: ignoredDiversitySampler(),
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
