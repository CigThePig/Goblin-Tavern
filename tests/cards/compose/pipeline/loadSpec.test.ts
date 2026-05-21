// Phase 125 / ISSUE-094 — Living Cast arc, Phase E.
//
// Spec loader unit tests. Confirms the real `drink_order.spec.yaml` is
// accepted (so the schema doesn't drift from the doc), and that an
// unknown top-level key rejects.

import { describe, expect, it } from 'vitest'
import {
  loadSpecFromFile,
  loadSpecFromString,
} from '../../../../scripts/generate-pool/loadSpec'
import { join } from 'node:path'
import { readFile } from 'node:fs/promises'

const REAL_SPEC_PATH = join(
  process.cwd(),
  'specs/cards/drink_order.spec.yaml',
)

describe('loadSpec', () => {
  it('parses the committed drink_order spec', async () => {
    const spec = await loadSpecFromFile(REAL_SPEC_PATH)
    expect(spec.templateId).toBe('drink_order')
    expect(spec.voiceRegister).toBe('tavern_floor')
    expect(spec.slots).toHaveLength(3)
    expect(spec.slots.map((s) => s.id)).toEqual([
      'order_line',
      'manner_note',
      'sim_backed_hook',
    ])
    const disabled = spec.slots.find((s) => s.id === 'sim_backed_hook')
    expect(disabled?.status).toBe('DISABLED_FOR_SPIKE')
    expect(spec.positiveExemplars.length).toBeGreaterThanOrEqual(15)
    expect(spec.negativeExamples.length).toBeGreaterThan(0)
  })

  it('parses every snippet pool entry from the real spec', async () => {
    const spec = await loadSpecFromFile(REAL_SPEC_PATH)
    const orderLinePool = spec.snippetPools.find(
      (p) => p.slotId === 'order_line',
    )
    expect(orderLinePool).toBeDefined()
    expect(orderLinePool!.required).toBe(true)
    expect(orderLinePool!.snippets.length).toBe(18)
    const fallback = orderLinePool!.snippets.find(
      (s) => s.id === 'order_fallback_plain',
    )
    expect(fallback?.conditions).toEqual([])
  })

  it('rejects unknown top-level keys', async () => {
    const raw = await readFile(REAL_SPEC_PATH, 'utf8')
    const polluted = raw.replace(
      'templateId: drink_order',
      'templateId: drink_order\nunknownKey: hello',
    )
    expect(() => loadSpecFromString(polluted)).toThrow(/unknownKey/)
  })

  it('rejects unknown condition kinds', () => {
    const minimal = `
templateId: x
voiceRegister: tavern_floor
purpose: t
slots:
  - { id: a, required: true, claims: flavor, maxWords: 10, description: t }
voiceAxesInPlay: {}
verbalTicsCovered: []
allowedTargets: []
mustNotInvent: []
hardBounds:
  perSlotWords: { a: 10 }
  punctuation: x
  noFragmentsThatRequireConcatenation: true
  noMadLibPlaceholders: true
  noModernSlang: true
  noEarthIdioms: true
  noDirectMechanicalLanguage: true
gradientPolicy: { base: a, middle: b, top: c, tic: d }
positiveExemplars: []
negativeExamples: []
snippetPools:
  - slotId: a
    required: true
    snippets:
      - id: bad
        text: hi
        conditions:
          - { kind: madeUpCondition, foo: 1 }
diversityCases: []
mustPass:
  coverage: { rule: r, current: true }
  specificityGradient: { rule: r, current: true }
  voiceBounds: { rule: r, current: true }
  simCoherence: { rule: r, current: true }
  determinism: { rule: r, current: true }
  diversity: { rule: r, current: true }
`
    expect(() => loadSpecFromString(minimal)).toThrow()
  })
})
