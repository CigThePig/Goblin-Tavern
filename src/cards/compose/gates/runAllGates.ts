// Phase 124 / ISSUE-093 — Living Cast arc, Phase D.
//
// Composite runner — calls all six structural gates against a single
// template and returns one aggregate report plus the six sub-reports.
// Phase E imports this from its generation pipeline: on a failed sub-
// report it feeds the violations back into the model retry; on
// `pass: true` it commits the pool. Phase D wires it into the drinkOrder
// integration test.

import type { CompositionalCardTemplate } from '../types'
import { checkCoverage } from './coverage'
import { checkSpecificityGradient } from './specificity'
import { checkVoiceBounds, type VoiceBoundsConfig } from './voiceBounds'
import { checkSimCoherence, type SimCoherenceConfig } from './simCoherence'
import { checkDeterminism, type DeterminismSample } from './determinism'
import {
  checkPoolDiversity,
  type DiversityConfig,
  type DiversitySampler,
  type DiversityObservation,
} from './diversity'
import { checkDedupe, type DedupeConfig } from './dedupe'
import {
  checkPreviewVariety,
  type PreviewVarietyConfig,
  type PreviewVarietyObservation,
  type PreviewVarietySampler,
} from './previewVariety'
import { passReport, type GateReport } from './types'

export type DiversitySlotConfig = {
  slotId: string
  sampler: DiversitySampler
  config: DiversityConfig
}

export type AllGatesConfig = {
  voiceBounds?: VoiceBoundsConfig
  simCoherence: SimCoherenceConfig
  determinism: { samples: readonly DeterminismSample[] }
  diversity: readonly DiversitySlotConfig[]
  dedupe?: DedupeConfig
  /**
   * Phase 144 / ISSUE-113 — Voiced Surface arc, Phase 18. Optional 8th
   * gate that simulates a multi-choice card render and asserts the
   * effect-preview lines vary across the card. Templates whose seeds
   * surface ≥ 2 response slots with effects should configure this; the
   * narrator-only `fallback` template legitimately omits it. When
   * absent, the gate is skipped and reports a pass.
   */
  previewVariety?: {
    sampler: PreviewVarietySampler
    config: PreviewVarietyConfig
  }
}

export type DiversityReportEntry = GateReport & {
  slotId: string
  observed: DiversityObservation
}

export type PreviewVarietyReportEntry = GateReport & {
  observed: PreviewVarietyObservation
  skipped: boolean
}

export type AllGatesReport = {
  pass: boolean
  coverage: GateReport
  specificity: GateReport
  voiceBounds: GateReport
  simCoherence: GateReport
  determinism: GateReport
  diversity: DiversityReportEntry[]
  dedupe: GateReport
  previewVariety: PreviewVarietyReportEntry
}

export function runAllGates(
  template: CompositionalCardTemplate,
  config: AllGatesConfig,
): AllGatesReport {
  const coverage = checkCoverage(template)
  const specificity = checkSpecificityGradient(template)
  const voiceBounds = checkVoiceBounds(template, config.voiceBounds)
  const simCoherence = checkSimCoherence(template, config.simCoherence)
  const determinism = checkDeterminism(template, config.determinism.samples)
  const dedupe = checkDedupe(template, config.dedupe)
  const diversity = config.diversity.map<DiversityReportEntry>((entry) => {
    const slot = template.slots.find((s) => s.id === entry.slotId)
    if (!slot) {
      return {
        slotId: entry.slotId,
        pass: false,
        violations: [
          {
            slotId: entry.slotId,
            reason: 'diversity_slot_not_found',
            detail: `template ${template.id} has no slot "${entry.slotId}"`,
          },
        ],
        observed: { distinct: 0, total: 0 },
      }
    }
    const result = checkPoolDiversity(slot, entry.sampler, entry.config)
    return {
      slotId: entry.slotId,
      pass: result.pass,
      violations: result.violations,
      observed: result.observed,
    }
  })
  const previewVarietyEntry = config.previewVariety
  let previewVariety: PreviewVarietyReportEntry
  if (previewVarietyEntry) {
    const result = checkPreviewVariety(
      previewVarietyEntry.sampler,
      previewVarietyEntry.config,
    )
    previewVariety = {
      pass: result.pass,
      violations: result.violations,
      observed: result.observed,
      skipped: false,
    }
  } else {
    previewVariety = {
      ...passReport(),
      observed: { sampleSize: 0, minUniqueRatio: 1, maxIdenticalRun: 0 },
      skipped: true,
    }
  }
  const pass =
    coverage.pass &&
    specificity.pass &&
    voiceBounds.pass &&
    simCoherence.pass &&
    determinism.pass &&
    diversity.every((d) => d.pass) &&
    dedupe.pass &&
    previewVariety.pass
  return {
    pass,
    coverage,
    specificity,
    voiceBounds,
    simCoherence,
    determinism,
    diversity,
    dedupe,
    previewVariety,
  }
}
