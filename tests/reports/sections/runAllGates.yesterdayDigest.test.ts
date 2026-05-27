// Phase 141 / ISSUE-110 — Voiced Surface arc, Phase 15 (Reports Prose).
// Phase 160 / ISSUE-128 — Legible Surface arc, Phase 15: added the new
// `reportLegibility` config wiring (`tagToBand` map) so every
// magnitude-banded snippet in the secondary + coin pools is checked for
// its `MAGNITUDE_LEXICON[direction][band]` token. The seven framework
// gates + the two Phase-V sibling gates run unchanged.

import { describe, expect, it } from 'vitest'

import { runAllGates } from '../../../src/cards/compose/gates'
import {
  buildReportSeed,
  reportSectionAsTemplate,
} from '../../../src/cards/compose/reports'
import {
  yesterdayDigestCoinSection,
  yesterdayDigestSecondarySection,
} from '../../../src/reports/compose/sections'
import { createInitialTavernState } from '../../../src/sim/state/defaults'
import type { DeterminismSample } from '../../../src/cards/compose/gates/determinism'
import type { DiversitySampler } from '../../../src/cards/compose/gates/diversity'
import type { ReportLegibilityConfig } from '../../../src/cards/compose/gates'

const STATE = createInitialTavernState()

const SECONDARY_TAGS: readonly string[] = [
  'reputation_gain',
  'reputation_loss',
  'reputation_hold',
  'reputation_gain_small',
  'reputation_gain_mid',
  'reputation_gain_large',
  'reputation_loss_small',
  'reputation_loss_mid',
  'reputation_loss_large',
  'pressure_rise_small',
  'pressure_rise_mid',
  'pressure_rise_large',
]

const COIN_TAGS: readonly string[] = [
  'coin_gain',
  'coin_loss',
  'coin_flat',
  'coin_gain_small',
  'coin_gain_mid',
  'coin_gain_large',
  'coin_loss_small',
  'coin_loss_mid',
  'coin_loss_large',
]

const SECONDARY_TAG_TO_BAND: ReportLegibilityConfig['tagToBand'] = {
  reputation_gain_small: { direction: 'positive', band: 'small' },
  reputation_gain_mid: { direction: 'positive', band: 'medium' },
  reputation_gain_large: { direction: 'positive', band: 'large' },
  reputation_loss_small: { direction: 'negative', band: 'small' },
  reputation_loss_mid: { direction: 'negative', band: 'medium' },
  reputation_loss_large: { direction: 'negative', band: 'large' },
  // Pressure rise = positive direction (the meter going up) = bad.
  pressure_rise_small: { direction: 'positive', band: 'small' },
  pressure_rise_mid: { direction: 'positive', band: 'medium' },
  pressure_rise_large: { direction: 'positive', band: 'large' },
}

const COIN_TAG_TO_BAND: ReportLegibilityConfig['tagToBand'] = {
  coin_gain_small: { direction: 'positive', band: 'small' },
  coin_gain_mid: { direction: 'positive', band: 'medium' },
  coin_gain_large: { direction: 'positive', band: 'large' },
  coin_loss_small: { direction: 'negative', band: 'small' },
  coin_loss_mid: { direction: 'negative', band: 'medium' },
  coin_loss_large: { direction: 'negative', band: 'large' },
}

function secDeterminism(): DeterminismSample[] {
  return SECONDARY_TAGS.map((tag, i) => ({
    seed: buildReportSeed({
      sectionId: 'morning.yesterday_digest.secondary',
      periodKey: `det-${i}`,
      timing: 'morning_prep',
      domain: [tag],
    }),
    state: STATE,
  }))
}

function secDiversity(): DiversitySampler {
  return (i: number) => {
    const tag = SECONDARY_TAGS[i % SECONDARY_TAGS.length]!
    return {
      seed: buildReportSeed({
        sectionId: 'morning.yesterday_digest.secondary',
        periodKey: `div-${i}`,
        timing: 'morning_prep',
        domain: [tag],
      }),
      state: STATE,
    }
  }
}

function coinDeterminism(): DeterminismSample[] {
  return COIN_TAGS.map((tag, i) => ({
    seed: buildReportSeed({
      sectionId: 'morning.yesterday_digest.coin',
      periodKey: `det-${i}`,
      timing: 'morning_prep',
      domain: [tag],
    }),
    state: STATE,
  }))
}

function coinDiversity(): DiversitySampler {
  return (i: number) => {
    const tag = COIN_TAGS[i % COIN_TAGS.length]!
    return {
      seed: buildReportSeed({
        sectionId: 'morning.yesterday_digest.coin',
        periodKey: `div-${i}`,
        timing: 'morning_prep',
        domain: [tag],
      }),
      state: STATE,
    }
  }
}

describe('runAllGates — morning.yesterday_digest.secondary section', () => {
  it('passes all ten gates (seven framework + sibling preview/choice + reportLegibility)', () => {
    const template = reportSectionAsTemplate(yesterdayDigestSecondarySection)
    const report = runAllGates(template, {
      simCoherence: { bannedDisplayNames: [] },
      determinism: { samples: secDeterminism() },
      diversity: [
        {
          slotId: 'verb',
          sampler: secDiversity(),
          config: { sampleSize: 120, minDistinct: 6 },
        },
      ],
      reportLegibility: { tagToBand: SECONDARY_TAG_TO_BAND },
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

describe('runAllGates — morning.yesterday_digest.coin section', () => {
  it('passes all ten gates', () => {
    const template = reportSectionAsTemplate(yesterdayDigestCoinSection)
    const report = runAllGates(template, {
      simCoherence: { bannedDisplayNames: [] },
      determinism: { samples: coinDeterminism() },
      diversity: [
        {
          slotId: 'verb',
          sampler: coinDiversity(),
          config: { sampleSize: 60, minDistinct: 5 },
        },
      ],
      reportLegibility: { tagToBand: COIN_TAG_TO_BAND },
    })
    expect(report.coverage.pass).toBe(true)
    expect(report.specificity.pass).toBe(true)
    expect(report.voiceBounds.pass).toBe(true)
    expect(report.simCoherence.pass).toBe(true)
    expect(report.determinism.pass).toBe(true)
    expect(report.dedupe.pass).toBe(true)
    expect(report.diversity.every((d) => d.pass)).toBe(true)
    expect(report.reportLegibility.pass).toBe(true)
    expect(report.reportLegibility.observed.bandedSnippets).toBeGreaterThan(0)
    expect(report.pass).toBe(true)
  })
})
