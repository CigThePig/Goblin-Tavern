// Phase 141 / ISSUE-110 — Voiced Surface arc, Phase 15 (Reports Prose).
// Phase 160 / ISSUE-128 — Legible Surface arc, Phase 15: added the
// `reportLegibility` config wiring for the traffic and service sections
// (both route by magnitude bands and the verb pools carry
// MAGNITUDE_LEXICON tokens). Driver section stays out of the gate — its
// phrase pool routes by direction only, no magnitude weight.

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
import type { ReportLegibilityConfig } from '../../../src/cards/compose/gates'

const STATE = createInitialTavernState()

const TRAFFIC_TAG_TO_BAND: ReportLegibilityConfig['tagToBand'] = {
  // Traffic is always inflow = positive direction. Volume bands map to
  // the lexicon's tiny / small / large rungs (a quiet night reads as a
  // hair / touch; a packed one reads as a strong climb / wide leap).
  traffic_low: { direction: 'positive', band: 'tiny' },
  traffic_mid: { direction: 'positive', band: 'small' },
  traffic_high: { direction: 'positive', band: 'large' },
}

const SERVICE_TAG_TO_BAND: ReportLegibilityConfig['tagToBand'] = {
  service_gain_small: { direction: 'positive', band: 'small' },
  service_gain_mid: { direction: 'positive', band: 'medium' },
  service_gain_large: { direction: 'positive', band: 'large' },
  service_loss_small: { direction: 'negative', band: 'small' },
  service_loss_mid: { direction: 'negative', band: 'medium' },
  service_loss_large: { direction: 'negative', band: 'large' },
}

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
  it('passes all ten gates (incl. reportLegibility on traffic_* tags)', () => {
    const cfg = makeSection(
      'daily.service_log.traffic',
      ['traffic_low', 'traffic_mid', 'traffic_high'],
      'verb',
      60,
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
      reportLegibility: { tagToBand: TRAFFIC_TAG_TO_BAND },
    })
    expect(report.reportLegibility.pass).toBe(true)
    expect(report.reportLegibility.observed.bandedSnippets).toBeGreaterThan(0)
    expect(report.pass).toBe(true)
  })
})

describe('runAllGates — daily.service_log.service section', () => {
  it('passes all ten gates (incl. reportLegibility on service_* tags)', () => {
    const cfg = makeSection(
      'daily.service_log.service',
      [
        'service_gain_small',
        'service_gain_mid',
        'service_gain_large',
        'service_loss_small',
        'service_loss_mid',
        'service_loss_large',
      ],
      'verb',
      80,
    )
    const template = reportSectionAsTemplate(serviceLogServiceSection)
    const report = runAllGates(template, {
      simCoherence: { bannedDisplayNames: [] },
      determinism: { samples: cfg.determinismSamples },
      diversity: [
        {
          slotId: cfg.slotId,
          sampler: cfg.diversitySampler,
          config: { sampleSize: cfg.sampleSize, minDistinct: 4 },
        },
      ],
      reportLegibility: { tagToBand: SERVICE_TAG_TO_BAND },
    })
    expect(report.reportLegibility.pass).toBe(true)
    expect(report.reportLegibility.observed.bandedSnippets).toBeGreaterThan(0)
    expect(report.pass).toBe(true)
  })
})

describe('runAllGates — daily.service_log.driver section', () => {
  it('passes all nine pre-Phase-160 gates (reportLegibility omitted; pool routes by direction only)', () => {
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
    expect(report.reportLegibility.skipped).toBe(true)
    expect(report.pass).toBe(true)
  })
})
