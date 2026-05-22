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
import type { GateReport } from './types'

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
}

export type DiversityReportEntry = GateReport & {
  slotId: string
  observed: DiversityObservation
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
  const pass =
    coverage.pass &&
    specificity.pass &&
    voiceBounds.pass &&
    simCoherence.pass &&
    determinism.pass &&
    diversity.every((d) => d.pass) &&
    dedupe.pass
  return {
    pass,
    coverage,
    specificity,
    voiceBounds,
    simCoherence,
    determinism,
    diversity,
    dedupe,
  }
}
