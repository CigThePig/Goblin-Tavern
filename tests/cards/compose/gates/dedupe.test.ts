// Phase 130 / ISSUE-099 — Voiced Surface arc, Phase 4.
//
// Dedupe gate tests. Two roles:
//   1. Regression net — every committed pool (drinkOrder, staffAside)
//      clears the 0.85 threshold with zero violations. Lifted from the
//      retired `tests/cards/compose/pipeline/dedupe.test.ts`.
//   2. Sharpness — planted near-duplicates within a slot and canonical
//      duplicates across slots flip the gate.

import { describe, expect, it } from 'vitest'

import {
  DEFAULT_DEDUPE_THRESHOLD,
  canonicaliseText,
  checkDedupe,
  normalisedSimilarity,
} from '../../../../src/cards/compose/gates'
import type { CompositionalCardTemplate } from '../../../../src/cards/compose/types'
import { drinkOrderTemplate } from '../../../../src/cards/templates/drinkOrder'
import { staffAsideTemplate } from '../../../../src/cards/templates/staffAside'
import { orderLinePool } from '../../../../src/cards/compose/pools/drinkOrder/orderLine'
import { mannerNotePool } from '../../../../src/cards/compose/pools/drinkOrder/mannerNote'

function buildTemplate(
  id: string,
  slots: CompositionalCardTemplate['slots'],
): CompositionalCardTemplate {
  return {
    id,
    appliesTo: { seedFamilies: ['regular_customer'] },
    voiceRegister: 'tavern_floor',
    slots,
    toCardView: () => ({
      title: 'x',
      body: ['x'],
      stakes: [],
      choices: [],
    }),
  }
}

describe('checkDedupe — regression net against committed pools', () => {
  it('drinkOrderTemplate clears the dedupe gate', () => {
    const report = checkDedupe(drinkOrderTemplate)
    expect(report.pass).toBe(true)
    expect(report.violations).toEqual([])
  })

  it('staffAsideTemplate clears the dedupe gate', () => {
    const report = checkDedupe(staffAsideTemplate)
    expect(report.pass).toBe(true)
    expect(report.violations).toEqual([])
  })

  it('order_line: no pair exceeds 0.85 (pair-wise audit)', () => {
    const snippets = orderLinePool.snippets
    for (let i = 0; i < snippets.length; i++) {
      for (let j = i + 1; j < snippets.length; j++) {
        const a = canonicaliseText(snippets[i]!.text)
        const b = canonicaliseText(snippets[j]!.text)
        const sim = normalisedSimilarity(a, b)
        expect(
          sim,
          `unexpected near-duplicate pair ${snippets[i]!.id} ~= ${snippets[j]!.id} (sim ${sim.toFixed(3)})`,
        ).toBeLessThan(DEFAULT_DEDUPE_THRESHOLD)
      }
    }
  })

  it('manner_note (drinkOrder): no pair exceeds 0.85 (pair-wise audit)', () => {
    const snippets = mannerNotePool.snippets
    for (let i = 0; i < snippets.length; i++) {
      for (let j = i + 1; j < snippets.length; j++) {
        const a = canonicaliseText(snippets[i]!.text)
        const b = canonicaliseText(snippets[j]!.text)
        const sim = normalisedSimilarity(a, b)
        expect(
          sim,
          `unexpected near-duplicate pair ${snippets[i]!.id} ~= ${snippets[j]!.id} (sim ${sim.toFixed(3)})`,
        ).toBeLessThan(DEFAULT_DEDUPE_THRESHOLD)
      }
    }
  })
})

describe('checkDedupe — sharpness (planted duplicates trip the gate)', () => {
  it('flags an exact-text duplicate within a slot', () => {
    const bad = buildTemplate('bad_exact_dup', [
      {
        id: 'order_line',
        role: 'order',
        pool: {
          slotId: 'order_line',
          snippets: [
            { id: 'a', text: 'An ale, please.', conditions: [] },
            { id: 'b', text: 'An ale, please.', conditions: [] },
          ],
        },
      },
    ])
    const report = checkDedupe(bad)
    expect(report.pass).toBe(false)
    expect(report.violations).toHaveLength(1)
    expect(report.violations[0]!.reason).toBe('canonical_equality')
    expect(report.violations[0]!.slotId).toBe('order_line')
  })

  it('flags a near-duplicate (punctuation-only difference) within a slot', () => {
    const bad = buildTemplate('bad_near_dup', [
      {
        id: 'order_line',
        role: 'order',
        pool: {
          slotId: 'order_line',
          snippets: [
            { id: 'a', text: 'Ale. Now.', conditions: [] },
            { id: 'b', text: 'Ale! Now!', conditions: [] },
          ],
        },
      },
    ])
    const report = checkDedupe(bad)
    expect(report.pass).toBe(false)
    expect(report.violations).toHaveLength(1)
  })

  it('flags cross-slot canonical equality', () => {
    const bad = buildTemplate('bad_cross_slot', [
      {
        id: 'order_line',
        role: 'order',
        pool: {
          slotId: 'order_line',
          snippets: [{ id: 'a', text: 'An ale, please.', conditions: [] }],
        },
      },
      {
        id: 'manner_note',
        role: 'manner',
        pool: {
          slotId: 'manner_note',
          snippets: [{ id: 'b', text: 'An ale, please.', conditions: [] }],
        },
      },
    ])
    const report = checkDedupe(bad)
    expect(report.pass).toBe(false)
    expect(
      report.violations.some(
        (v) => v.reason === 'cross_slot_canonical_equality',
      ),
    ).toBe(true)
  })

  it('does NOT flag cross-slot near-duplicates (only canonical equality)', () => {
    const ok = buildTemplate('ok_cross_slot_near', [
      {
        id: 'order_line',
        role: 'order',
        pool: {
          slotId: 'order_line',
          snippets: [{ id: 'a', text: 'Ale. Now.', conditions: [] }],
        },
      },
      {
        id: 'manner_note',
        role: 'manner',
        pool: {
          slotId: 'manner_note',
          snippets: [
            { id: 'b', text: 'They tap two coins once.', conditions: [] },
          ],
        },
      },
    ])
    const report = checkDedupe(ok)
    expect(report.pass).toBe(true)
  })

  it('flags cross-slot canonical equality on punctuation-only differences', () => {
    const bad = buildTemplate('bad_cross_slot_punct', [
      {
        id: 'order_line',
        role: 'order',
        pool: {
          slotId: 'order_line',
          snippets: [{ id: 'a', text: 'Ale. Now.', conditions: [] }],
        },
      },
      {
        id: 'manner_note',
        role: 'manner',
        pool: {
          slotId: 'manner_note',
          snippets: [{ id: 'b', text: 'Ale! Now!', conditions: [] }],
        },
      },
    ])
    const report = checkDedupe(bad)
    expect(report.pass).toBe(false)
    expect(
      report.violations.some(
        (v) => v.reason === 'cross_slot_canonical_equality',
      ),
    ).toBe(true)
  })
})

describe('canonicaliseText', () => {
  it('lowercases, strips punctuation, collapses whitespace', () => {
    expect(canonicaliseText('Ale. Now!')).toBe('ale now')
    expect(canonicaliseText("It's   fine.")).toBe('its fine')
    expect(canonicaliseText('Trail off — like this …')).toBe(
      'trail off like this …',
    )
  })
})
