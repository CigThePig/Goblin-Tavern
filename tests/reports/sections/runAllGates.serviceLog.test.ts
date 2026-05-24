// Phase 141 / ISSUE-110 — Voiced Surface arc, Phase 15 (Reports Prose).

import { describe, expect, it } from 'vitest'

import { runAllGates } from '../../../src/cards/compose/gates'
import {
  buildReportSeed,
  reportSectionAsTemplate,
} from '../../../src/cards/compose/reports'
import {
  serviceLogDriverSection,
  serviceLogServiceSection,
  serviceLogTrafficSection,
} from '../../../src/reports/compose/sections'
import { createInitialTavernState } from '../../../src/sim/state/defaults'
import type { DeterminismSample } from '../../../src/cards/compose/gates/determinism'
import type { DiversitySampler } from '../../../src/cards/compose/gates/diversity'

const STATE = createInitialTavernState()

function makeSection(
  sectionId: string,
  tags: readonly string[],
  slotId: string,
  sampleSize: number,
) {
  const determinismSamples: DeterminismSample[] = tags.map((tag, i) => ({
    seed: buildReportSeed({
      sectionId,
      periodKey: `det-${i}`,
      timing: 'closing',
      domain: [tag],
    }),
    state: STATE,
  }))
  const diversitySampler: DiversitySampler = (i: number) => {
    const tag = tags[i % tags.length]!
    return {
      seed: buildReportSeed({
        sectionId,
        periodKey: `div-${i}`,
        timing: 'closing',
        domain: [tag],
      }),
      state: STATE,
    }
  }
  return { determinismSamples, diversitySampler, slotId, sampleSize }
}

describe('runAllGates — daily.service_log.traffic section', () => {
  it('passes all seven gates', () => {
    const cfg = makeSection(
      'daily.service_log.traffic',
      ['traffic_low', 'traffic_mid', 'traffic_high'],
      'verb',
      40,
    )
    const template = reportSectionAsTemplate(serviceLogTrafficSection)
    const report = runAllGates(template, {
      simCoherence: { bannedDisplayNames: [] },
      determinism: { samples: cfg.determinismSamples },
      diversity: [
        {
          slotId: cfg.slotId,
          sampler: cfg.diversitySampler,
          config: { sampleSize: cfg.sampleSize, minDistinct: 3 },
        },
      ],
    })
    expect(report.pass).toBe(true)
  })
})

describe('runAllGates — daily.service_log.service section', () => {
  it('passes all seven gates', () => {
    const cfg = makeSection(
      'daily.service_log.service',
      [
        'service_gain_small',
        'service_gain_mid',
        'service_gain_large',
        'service_loss',
      ],
      'verb',
      50,
    )
    const template = reportSectionAsTemplate(serviceLogServiceSection)
    const report = runAllGates(template, {
      simCoherence: { bannedDisplayNames: [] },
      determinism: { samples: cfg.determinismSamples },
      diversity: [
        {
          slotId: cfg.slotId,
          sampler: cfg.diversitySampler,
          config: { sampleSize: cfg.sampleSize, minDistinct: 3 },
        },
      ],
    })
    expect(report.pass).toBe(true)
  })
})

describe('runAllGates — daily.service_log.driver section', () => {
  it('passes all seven gates', () => {
    const cfg = makeSection(
      'daily.service_log.driver',
      ['driver_positive', 'driver_negative'],
      'phrase',
      30,
    )
    const template = reportSectionAsTemplate(serviceLogDriverSection)
    const report = runAllGates(template, {
      simCoherence: { bannedDisplayNames: [] },
      determinism: { samples: cfg.determinismSamples },
      diversity: [
        {
          slotId: cfg.slotId,
          sampler: cfg.diversitySampler,
          config: { sampleSize: cfg.sampleSize, minDistinct: 3 },
        },
      ],
    })
    expect(report.pass).toBe(true)
  })
})
