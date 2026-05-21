// Phase 124 / ISSUE-093 — Living Cast arc, Phase D.
//
// Diversity gate (framework §6 #6): a pool yields ≥ M distinct outputs
// across a sampled state range. Phase B locks `order_line ≥ 6`
// distinct over a random cast sample drawn from the real `[-1,0,0,1]`
// perturbation. Without this gate a pool can read repetitively in play
// even when every snippet is well-formed.

import { describe, expect, it } from 'vitest'

import { checkPoolDiversity } from '../../../../src/cards/compose/gates'
import { drinkOrderTemplate } from '../../../../src/cards/templates/drinkOrder'
import type { SlotSpec } from '../../../../src/cards/compose/types'
import {
  buildTemplate,
  lowDiversityPool,
} from './fixtures'
import { buildDiversitySampler } from './samplers'

function slotById(id: string): SlotSpec {
  const slot = drinkOrderTemplate.slots.find((s) => s.id === id)
  if (!slot) throw new Error(`test: missing slot "${id}"`)
  return slot
}

describe('diversity gate — happy path', () => {
  it('order_line yields ≥ 6 distinct outputs across 100 samples (Phase B locked threshold)', () => {
    const sampler = buildDiversitySampler()
    const slot = slotById('order_line')
    const report = checkPoolDiversity(slot, sampler, {
      sampleSize: 100,
      minDistinct: 6,
    })
    expect(report.pass).toBe(true)
    expect(report.violations).toEqual([])
    // The observed count should comfortably exceed the threshold. We
    // assert it lands in a sane range so future drift is visible
    // without making the test brittle to small distribution shifts.
    expect(report.observed.distinct).toBeGreaterThanOrEqual(6)
    expect(report.observed.distinct).toBeLessThanOrEqual(
      drinkOrderTemplate.slots
        .find((s) => s.id === 'order_line')!
        .pool.snippets.length,
    )
  })

  it('manner_note (optional) yields ≥ 3 distinct non-undefined outputs across 100 samples', () => {
    // Manner_note has no unconditional fallback; it omits on neutral
    // profiles. The threshold of 3 reflects the four single-axis
    // snippets plus the one tic-gated snippet, of which at least three
    // should hit a 100-sample draw from the real distribution.
    const sampler = buildDiversitySampler({ rngSeed: 'manner-note-diversity' })
    const slot = slotById('manner_note')
    const report = checkPoolDiversity(slot, sampler, {
      sampleSize: 100,
      minDistinct: 3,
    })
    expect(report.pass).toBe(true)
    expect(report.observed.distinct).toBeGreaterThanOrEqual(3)
  })
})

describe('diversity gate — failures', () => {
  it('a pool whose only conditioned snippet never fires yields 1 distinct output and fails', () => {
    const bad = buildTemplate('bad_low_diversity', [
      {
        id: 'order_line',
        role: 'aside',
        pool: lowDiversityPool(),
      },
    ])
    const sampler = buildDiversitySampler({ rngSeed: 'low-div-test' })
    const slot = bad.slots[0]!
    const report = checkPoolDiversity(slot, sampler, {
      sampleSize: 100,
      minDistinct: 6,
    })
    expect(report.pass).toBe(false)
    expect(report.observed.distinct).toBe(1)
    expect(report.violations).toHaveLength(1)
    expect(report.violations[0]!.reason).toBe('insufficient_diversity')
    expect(report.violations[0]!.detail).toContain('observed 1')
  })
})
