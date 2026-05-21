// Phase 125 / ISSUE-094 — Living Cast arc, Phase E.
//
// Retry-loop tests. Inject a mock `generateCompletion` so no network is
// touched. Confirms:
//   - invalid-then-valid → accepted on attempt 2
//   - 3 invalid → structured failure result with history
//   - dedupe rejection → next retry sees the rejection in feedback

import { describe, expect, it } from 'vitest'
import { join } from 'node:path'
import { loadSpecFromFile } from '../../../../scripts/generate-pool/loadSpec'
import { runRetryLoop } from '../../../../scripts/generate-pool/retryLoop'
import { orderLinePool } from '../../../../src/cards/compose/pools/drinkOrder/orderLine'
import { mannerNotePool } from '../../../../src/cards/compose/pools/drinkOrder/mannerNote'
import type { Snippet } from '../../../../src/cards/compose/types'
import type { GenerateCompletion } from '../../../../scripts/generate-pool/callModel'

const REAL_SPEC_PATH = join(
  process.cwd(),
  'specs/cards/drink_order.spec.yaml',
)

function poolToYamlBlock(snippets: readonly Snippet[]): string {
  // Hand-emit a YAML fence the model would produce. We round-trip the
  // existing committed pool so the gate adapter accepts it.
  const lines: string[] = ['```yaml', 'snippets:']
  for (const s of snippets) {
    lines.push(`  - id: ${JSON.stringify(s.id)}`)
    lines.push(`    text: ${JSON.stringify(s.text)}`)
    if (s.conditions.length === 0) {
      lines.push('    conditions: []')
    } else {
      lines.push('    conditions:')
      for (const c of s.conditions) {
        const entries = Object.entries(c)
          .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
          .join(', ')
        lines.push(`      - { ${entries} }`)
      }
    }
  }
  lines.push('```')
  return lines.join('\n')
}

function makeMockGenerate(responses: readonly string[]): {
  generate: GenerateCompletion
  callCount: () => number
  lastTail: () => string
} {
  let i = 0
  let last = ''
  const generate: GenerateCompletion = async ({ retryTail }) => {
    last = retryTail
    const response = responses[i] ?? responses[responses.length - 1] ?? ''
    i++
    return response
  }
  return {
    generate,
    callCount: () => i,
    lastTail: () => last,
  }
}

describe('runRetryLoop', () => {
  it('accepts on attempt 1 when the model returns a valid pool', async () => {
    const spec = await loadSpecFromFile(REAL_SPEC_PATH)
    const yamlBlock = poolToYamlBlock(orderLinePool.snippets)
    const mock = makeMockGenerate([yamlBlock])
    const result = await runRetryLoop({
      spec,
      slotId: 'order_line',
      acceptedBySlot: new Map([
        ['manner_note', mannerNotePool.snippets as Snippet[]],
      ]),
      generate: mock.generate,
    })
    expect(result.status).toBe('accepted')
    if (result.status !== 'accepted') throw new Error('expected accepted')
    expect(result.attempts).toBe(1)
    expect(result.snippets.length).toBe(orderLinePool.snippets.length)
    expect(mock.callCount()).toBe(1)
  })

  it('recovers on attempt 2 when the first attempt is unparseable', async () => {
    const spec = await loadSpecFromFile(REAL_SPEC_PATH)
    const validBlock = poolToYamlBlock(orderLinePool.snippets)
    const mock = makeMockGenerate(['No fence here, just words.', validBlock])
    const result = await runRetryLoop({
      spec,
      slotId: 'order_line',
      acceptedBySlot: new Map([
        ['manner_note', mannerNotePool.snippets as Snippet[]],
      ]),
      generate: mock.generate,
    })
    expect(result.status).toBe('accepted')
    if (result.status !== 'accepted') throw new Error('expected accepted')
    expect(result.attempts).toBe(2)
    expect(mock.lastTail()).toContain('RETRY 2')
    expect(mock.lastTail()).toContain('PARSE FAILURE')
  })

  it('returns structured failure after 3 invalid attempts', async () => {
    const spec = await loadSpecFromFile(REAL_SPEC_PATH)
    const mock = makeMockGenerate([
      'no fence',
      'still no fence',
      'still no fence',
    ])
    const result = await runRetryLoop({
      spec,
      slotId: 'order_line',
      acceptedBySlot: new Map([
        ['manner_note', mannerNotePool.snippets as Snippet[]],
      ]),
      generate: mock.generate,
    })
    expect(result.status).toBe('failed')
    if (result.status !== 'failed') throw new Error('expected failed')
    expect(result.attempts).toBe(3)
    expect(result.lastParseError).toContain('no fenced')
    expect(mock.callCount()).toBe(3)
  })

  it('feeds gate violations back into the retry tail', async () => {
    const spec = await loadSpecFromFile(REAL_SPEC_PATH)
    // First attempt: a pool with an over-budget snippet. Second
    // attempt: the real Phase-C pool, which passes.
    const overBudget: Snippet[] = [
      ...orderLinePool.snippets.map((s) => ({ ...s })),
      {
        id: 'over_budget',
        text: 'A very very very very very very very very very very very very long line.',
        conditions: [],
      },
    ]
    const badBlock = poolToYamlBlock(overBudget)
    const goodBlock = poolToYamlBlock(orderLinePool.snippets)
    const mock = makeMockGenerate([badBlock, goodBlock])
    const result = await runRetryLoop({
      spec,
      slotId: 'order_line',
      acceptedBySlot: new Map([
        ['manner_note', mannerNotePool.snippets as Snippet[]],
      ]),
      generate: mock.generate,
    })
    expect(result.status).toBe('accepted')
    expect(mock.callCount()).toBe(2)
    expect(mock.lastTail()).toContain('GATE VIOLATIONS')
    expect(mock.lastTail()).toContain('over_budget')
  })
})
