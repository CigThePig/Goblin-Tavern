// Phase 125 / ISSUE-094 — Living Cast arc, Phase E.
//
// Gate-adapter integration test. Confirms the existing Phase-C
// `orderLinePool` and `mannerNotePool` pass `runAllGates` through the
// pipeline adapter — proving Phase E enforces the same bar Phase D
// committed to.

import { describe, expect, it } from 'vitest'
import { loadSpecFromFile } from '../../../../scripts/generate-pool/loadSpec'
import { runGatesOnCandidates } from '../../../../scripts/generate-pool/runGates'
import { orderLinePool } from '../../../../src/cards/compose/pools/drinkOrder/orderLine'
import { mannerNotePool } from '../../../../src/cards/compose/pools/drinkOrder/mannerNote'
import type { Snippet } from '../../../../src/cards/compose/types'
import { join } from 'node:path'

const REAL_SPEC_PATH = join(
  process.cwd(),
  'specs/cards/drink_order.spec.yaml',
)

describe('runGatesOnCandidates', () => {
  it('passes all six gates for the committed Phase-B pools', async () => {
    const spec = await loadSpecFromFile(REAL_SPEC_PATH)
    const candidates = new Map<string, Snippet[]>([
      ['order_line', orderLinePool.snippets as Snippet[]],
      ['manner_note', mannerNotePool.snippets as Snippet[]],
    ])
    const result = runGatesOnCandidates(spec, candidates)
    expect(result.report.coverage.pass).toBe(true)
    expect(result.report.specificity.pass).toBe(true)
    expect(result.report.voiceBounds.pass).toBe(true)
    expect(result.report.simCoherence.pass).toBe(true)
    expect(result.report.determinism.pass).toBe(true)
    for (const d of result.report.diversity) {
      expect(d.pass, `${d.slotId} diversity should pass`).toBe(true)
    }
    expect(result.report.pass).toBe(true)
  })

  it('fails voice-bounds when a snippet exceeds the slot budget', async () => {
    const spec = await loadSpecFromFile(REAL_SPEC_PATH)
    const overBudget = [
      ...orderLinePool.snippets,
      {
        id: 'over_budget',
        text: 'A very very very very very very very very very very very very long line.',
        conditions: [],
      },
    ] as Snippet[]
    const candidates = new Map<string, Snippet[]>([
      ['order_line', overBudget],
      ['manner_note', mannerNotePool.snippets as Snippet[]],
    ])
    const result = runGatesOnCandidates(spec, candidates)
    expect(result.report.voiceBounds.pass).toBe(false)
    expect(result.report.pass).toBe(false)
  })

  it('fails sim-coherence on an invented role claim in a flavor slot', async () => {
    const spec = await loadSpecFromFile(REAL_SPEC_PATH)
    const polluted = [
      ...orderLinePool.snippets,
      {
        id: 'invent_role',
        text: 'Tell your cook to make it warmer.',
        conditions: [],
      },
    ] as Snippet[]
    const candidates = new Map<string, Snippet[]>([
      ['order_line', polluted],
      ['manner_note', mannerNotePool.snippets as Snippet[]],
    ])
    const result = runGatesOnCandidates(spec, candidates)
    expect(result.report.simCoherence.pass).toBe(false)
  })

  it('fails coverage when the required slot has no unconditional fallback', async () => {
    const spec = await loadSpecFromFile(REAL_SPEC_PATH)
    const noFallback = orderLinePool.snippets.filter(
      (s) => s.conditions.length > 0,
    ) as Snippet[]
    const candidates = new Map<string, Snippet[]>([
      ['order_line', noFallback],
      ['manner_note', mannerNotePool.snippets as Snippet[]],
    ])
    const result = runGatesOnCandidates(spec, candidates)
    expect(result.report.coverage.pass).toBe(false)
  })

  it('skips DISABLED_FOR_SPIKE slots — no diversity entry for sim_backed_hook', async () => {
    const spec = await loadSpecFromFile(REAL_SPEC_PATH)
    const candidates = new Map<string, Snippet[]>([
      ['order_line', orderLinePool.snippets as Snippet[]],
      ['manner_note', mannerNotePool.snippets as Snippet[]],
    ])
    const result = runGatesOnCandidates(spec, candidates)
    expect(result.report.diversity.map((d) => d.slotId)).not.toContain(
      'sim_backed_hook',
    )
  })
})
