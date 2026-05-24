// Phase 142 / ISSUE-111 — Voiced Surface arc, Phase 16 (Ambient Surface).
//
// runAllGates integration: the three day-beat empty-state sections
// (morning / service / closing) each pass every gate. Single-slot
// narrator-voiced pools mirroring the Phase-15 daily-header pattern —
// the diversity sampler varies the seed's domain tags so the gate
// exercises every gated rung.

import { describe, expect, it } from 'vitest'

import { runAllGates } from '../../../src/cards/compose/gates'
import {
  buildReportSeed,
  reportSectionAsTemplate,
} from '../../../src/cards/compose/reports'
import {
  closingEmptySection,
  morningEmptySection,
  serviceEmptySection,
} from '../../../src/reports/compose/sections'
import { createInitialTavernState } from '../../../src/sim/state/defaults'
import type { DeterminismSample } from '../../../src/cards/compose/gates/determinism'
import type { DiversitySampler } from '../../../src/cards/compose/gates/diversity'

const STATE = createInitialTavernState()

const MORNING_TAG_SETS: readonly (readonly string[])[] = [
  ['morning'],
  ['morning', 'end_of_week'],
]

const SERVICE_TAG_SETS: readonly (readonly string[])[] = [
  ['service'],
  ['service', 'end_of_week'],
]

const CLOSING_TAG_SETS: readonly (readonly string[])[] = [
  ['closing'],
  ['closing', 'end_of_week'],
  ['closing', 'end_of_month'],
  ['closing', 'end_of_week', 'end_of_month'],
]

function morningDeterminismSamples(): DeterminismSample[] {
  return MORNING_TAG_SETS.map((tags, i) => ({
    seed: buildReportSeed({
      sectionId: 'day.morning_empty',
      periodKey: `det-m-${i}`,
      timing: 'morning_prep',
      domain: tags,
    }),
    state: STATE,
  }))
}

function morningDiversitySampler(): DiversitySampler {
  return (i: number) => {
    const tags = MORNING_TAG_SETS[i % MORNING_TAG_SETS.length]!
    return {
      seed: buildReportSeed({
        sectionId: 'day.morning_empty',
        periodKey: `div-m-${i}`,
        timing: 'morning_prep',
        domain: tags,
      }),
      state: STATE,
    }
  }
}

function serviceDeterminismSamples(): DeterminismSample[] {
  return SERVICE_TAG_SETS.map((tags, i) => ({
    seed: buildReportSeed({
      sectionId: 'day.service_empty',
      periodKey: `det-s-${i}`,
      timing: 'during_service',
      domain: tags,
    }),
    state: STATE,
  }))
}

function serviceDiversitySampler(): DiversitySampler {
  return (i: number) => {
    const tags = SERVICE_TAG_SETS[i % SERVICE_TAG_SETS.length]!
    return {
      seed: buildReportSeed({
        sectionId: 'day.service_empty',
        periodKey: `div-s-${i}`,
        timing: 'during_service',
        domain: tags,
      }),
      state: STATE,
    }
  }
}

function closingDeterminismSamples(): DeterminismSample[] {
  return CLOSING_TAG_SETS.map((tags, i) => ({
    seed: buildReportSeed({
      sectionId: 'day.closing_empty',
      periodKey: `det-c-${i}`,
      timing: 'closing',
      domain: tags,
    }),
    state: STATE,
  }))
}

function closingDiversitySampler(): DiversitySampler {
  return (i: number) => {
    const tags = CLOSING_TAG_SETS[i % CLOSING_TAG_SETS.length]!
    return {
      seed: buildReportSeed({
        sectionId: 'day.closing_empty',
        periodKey: `div-c-${i}`,
        timing: 'closing',
        domain: tags,
      }),
      state: STATE,
    }
  }
}

describe('runAllGates — day.morning_empty section', () => {
  it('passes all seven gates', () => {
    const template = reportSectionAsTemplate(morningEmptySection)
    const report = runAllGates(template, {
      simCoherence: { bannedDisplayNames: [] },
      determinism: { samples: morningDeterminismSamples() },
      diversity: [
        {
          slotId: 'line',
          sampler: morningDiversitySampler(),
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

describe('runAllGates — day.service_empty section', () => {
  it('passes all seven gates', () => {
    const template = reportSectionAsTemplate(serviceEmptySection)
    const report = runAllGates(template, {
      simCoherence: { bannedDisplayNames: [] },
      determinism: { samples: serviceDeterminismSamples() },
      diversity: [
        {
          slotId: 'line',
          sampler: serviceDiversitySampler(),
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

describe('runAllGates — day.closing_empty section', () => {
  it('passes all seven gates', () => {
    const template = reportSectionAsTemplate(closingEmptySection)
    const report = runAllGates(template, {
      simCoherence: { bannedDisplayNames: [] },
      determinism: { samples: closingDeterminismSamples() },
      diversity: [
        {
          slotId: 'line',
          sampler: closingDiversitySampler(),
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
