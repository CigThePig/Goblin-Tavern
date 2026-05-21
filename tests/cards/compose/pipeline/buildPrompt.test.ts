// Phase 125 / ISSUE-094 — Living Cast arc, Phase E.
//
// Prompt builder unit tests. Confirms structure: spec content lands in
// the cached prefix; retry context lands in the tail; the tail is empty
// on first attempt.

import { describe, expect, it } from 'vitest'
import { loadSpecFromFile } from '../../../../scripts/generate-pool/loadSpec'
import {
  buildPrompt,
  assemblePromptUserMessage,
} from '../../../../scripts/generate-pool/buildPrompt'
import { join } from 'node:path'
import type { RetryContext } from '../../../../scripts/generate-pool/types'

const REAL_SPEC_PATH = join(
  process.cwd(),
  'specs/cards/drink_order.spec.yaml',
)

describe('buildPrompt', () => {
  it('produces a first-attempt prompt with empty retryTail', async () => {
    const spec = await loadSpecFromFile(REAL_SPEC_PATH)
    const prompt = buildPrompt(spec, 'order_line')
    expect(prompt.system).toContain('tavern-card snippet author')
    expect(prompt.cachedUserPrefix).toContain('TEMPLATE: drink_order')
    expect(prompt.cachedUserPrefix).toContain('SLOT: order_line')
    expect(prompt.cachedUserPrefix).toContain('VOICE AXES IN PLAY')
    expect(prompt.cachedUserPrefix).toContain('POSITIVE EXEMPLARS')
    expect(prompt.cachedUserPrefix).toContain('NEGATIVE EXAMPLES')
    expect(prompt.cachedUserPrefix).toContain(
      'CONDITION KINDS YOU MAY USE',
    )
    expect(prompt.retryTail).toBe('')
    expect(assemblePromptUserMessage(prompt)).toBe(prompt.cachedUserPrefix)
  })

  it('appends retry context after the cached prefix', async () => {
    const spec = await loadSpecFromFile(REAL_SPEC_PATH)
    const retryContext: RetryContext = {
      attempt: 2,
      previousSnippets: [
        {
          id: 'bad_one',
          text: 'I survived the dragon.',
          conditions: [],
        },
      ],
      gateViolations: [
        {
          slotId: 'order_line',
          snippetId: 'bad_one',
          reason: 'unbacked_history_claim',
          detail: '"the dragon" is uncondtioned history',
        },
      ],
      dedupeRejections: [],
    }
    const prompt = buildPrompt(spec, 'order_line', retryContext)
    expect(prompt.cachedUserPrefix).toContain('TEMPLATE: drink_order')
    expect(prompt.retryTail).toContain('RETRY 2')
    expect(prompt.retryTail).toContain('GATE VIOLATIONS')
    expect(prompt.retryTail).toContain('unbacked_history_claim')
    expect(prompt.retryTail).toContain('PREVIOUS ATTEMPT')

    const assembled = assemblePromptUserMessage(prompt)
    const prefixIdx = assembled.indexOf(prompt.cachedUserPrefix)
    const tailIdx = assembled.indexOf(prompt.retryTail)
    expect(prefixIdx).toBe(0)
    expect(tailIdx).toBeGreaterThan(prefixIdx + prompt.cachedUserPrefix.length - 1)
  })

  it('includes parse errors and dedupe rejections in the retry tail', async () => {
    const spec = await loadSpecFromFile(REAL_SPEC_PATH)
    const retryContext: RetryContext = {
      attempt: 3,
      previousSnippets: [],
      gateViolations: [],
      dedupeRejections: [
        {
          keptId: 'kept_a',
          rejectedId: 'dup_b',
          similarity: 0.91,
          reason: 'near_duplicate',
        },
      ],
      parseError: 'YAML parse failed: bad indent',
    }
    const prompt = buildPrompt(spec, 'manner_note', retryContext)
    expect(prompt.retryTail).toContain('PARSE FAILURE')
    expect(prompt.retryTail).toContain('YAML parse failed')
    expect(prompt.retryTail).toContain('DEDUPED')
    expect(prompt.retryTail).toContain('kept_a')
    expect(prompt.retryTail).toContain('0.91')
  })

  it('throws for an unknown slot id', async () => {
    const spec = await loadSpecFromFile(REAL_SPEC_PATH)
    expect(() => buildPrompt(spec, 'not_a_slot')).toThrow(/not_a_slot/)
  })
})
