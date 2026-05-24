// Phase 141 / ISSUE-110 — Voiced Surface arc, Phase 15 (Reports Prose).

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

const STATE = createInitialTavernState()

const SECONDARY_TAGS: readonly string[] = [
  'reputation_gain',
  'reputation_loss',
  'reputation_hold',
  'pressure_rise_small',
  'pressure_rise_mid',
  'pressure_rise_large',
]

const COIN_TAGS: readonly string[] = ['coin_gain', 'coin_loss', 'coin_flat']

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
  it('passes all seven gates', () => {
    const template = reportSectionAsTemplate(yesterdayDigestSecondarySection)
    const report = runAllGates(template, {
      simCoherence: { bannedDisplayNames: [] },
      determinism: { samples: secDeterminism() },
      diversity: [
        {
          slotId: 'verb',
          sampler: secDiversity(),
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

describe('runAllGates — morning.yesterday_digest.coin section', () => {
  it('passes all seven gates', () => {
    const template = reportSectionAsTemplate(yesterdayDigestCoinSection)
    const report = runAllGates(template, {
      simCoherence: { bannedDisplayNames: [] },
      determinism: { samples: coinDeterminism() },
      diversity: [
        {
          slotId: 'verb',
          sampler: coinDiversity(),
          config: { sampleSize: 30, minDistinct: 3 },
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
