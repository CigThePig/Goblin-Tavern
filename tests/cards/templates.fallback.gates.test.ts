// Phase 142 / ISSUE-111 — Voiced Surface arc, Phase 16 (Ambient Surface).
//
// runAllGates integration for the rewritten compositional fallback
// card. Narrator-voiced, severity-gated — sampler varies severity
// across the three bands (low / mid / high) so the diversity gate
// exercises every gated rung.

import { describe, expect, it } from 'vitest'

import {
  representativeBannedNames,
  runAllGates,
} from '../../src/cards/compose/gates'
import { fallbackTemplate } from '../../src/cards/templates/fallback'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import type { DeterminismSample } from '../../src/cards/compose/gates/determinism'
import type { DiversitySampler } from '../../src/cards/compose/gates/diversity'
import { makeSeed } from './cardFactories'

const STATE = createInitialTavernState()

const SEVERITY_BANDS = [10, 30, 55, 75, 90]

function fallbackDeterminismSamples(): DeterminismSample[] {
  return SEVERITY_BANDS.map((severity, i) => ({
    seed: makeSeed({ id: `fb-det-${i}`, severity }),
    state: STATE,
  }))
}

function fallbackDiversitySampler(prefix: string): DiversitySampler {
  return (i: number) => {
    const severity = SEVERITY_BANDS[i % SEVERITY_BANDS.length]!
    return {
      seed: makeSeed({ id: `${prefix}-${i}`, severity }),
      state: STATE,
    }
  }
}

describe('runAllGates — fallback compositional template', () => {
  it('passes all seven gates', () => {
    const report = runAllGates(fallbackTemplate, {
      simCoherence: {
        bannedDisplayNames: representativeBannedNames(STATE),
      },
      determinism: { samples: fallbackDeterminismSamples() },
      diversity: [
        {
          slotId: 'title',
          // Pool has four snippets: fallback (unconditional), low,
          // mid, high. The diversity floor of 3 covers
          // sub-low + at-or-above mid (split mid/high by FNV) + the
          // unconditional surfacing on severity ≥ 40 ties.
          sampler: fallbackDiversitySampler('fb-div-title'),
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
