// Phase 125 / ISSUE-094 — Living Cast arc, Phase E.
//
// Dedupe unit tests. Two roles:
//   1. Regression net — the existing 17-snippet order_line pool produces
//      ZERO false positives at the 0.85 threshold. If a future spec edit
//      drops separation below this, the test surfaces it before commit.
//   2. Sharpness — planted near-duplicates and cross-slot canonical
//      duplicates trip.

import { describe, expect, it } from 'vitest'
import {
  DEFAULT_DEDUPE_THRESHOLD,
  canonicaliseText,
  dedupePools,
  dedupeSlot,
} from '../../../../scripts/generate-pool/dedupe'
import { orderLinePool } from '../../../../src/cards/compose/pools/drinkOrder/orderLine'
import { mannerNotePool } from '../../../../src/cards/compose/pools/drinkOrder/mannerNote'
import { normalisedSimilarity } from '../../../../scripts/generate-pool/levenshtein'

describe('dedupe (regression net against real pool)', () => {
  it('reports zero false-positive dedup rejections at 0.85 for the order_line pool', () => {
    const result = dedupeSlot('order_line', orderLinePool.snippets)
    expect(result.rejections).toEqual([])
    expect(result.kept).toHaveLength(orderLinePool.snippets.length)
  })

  it('reports zero false-positive dedup rejections at 0.85 for the manner_note pool', () => {
    const result = dedupeSlot('manner_note', mannerNotePool.snippets)
    expect(result.rejections).toEqual([])
    expect(result.kept).toHaveLength(mannerNotePool.snippets.length)
  })

  it('keeps every existing pool pair below the 0.85 threshold (separation audit)', () => {
    // Walk every (i, j) pair across order_line and assert no pair is
    // unexpectedly close. This is the safety bar: if a future spec
    // tightens phrasing too far, this test flags the specific pair.
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
})

describe('dedupe (sharpness — planted duplicates trip)', () => {
  it('collapses an exact-text duplicate within a slot', () => {
    const snippets = [
      { id: 'a', text: 'An ale, please.', conditions: [] },
      { id: 'b', text: 'An ale, please.', conditions: [] },
    ]
    const result = dedupeSlot('order_line', snippets)
    expect(result.kept).toHaveLength(1)
    expect(result.rejections).toHaveLength(1)
    expect(result.rejections[0]!.reason).toBe('canonical_equality')
  })

  it('collapses a near-duplicate (different punctuation) within a slot', () => {
    const snippets = [
      { id: 'a', text: 'Ale. Now.', conditions: [] },
      { id: 'b', text: 'Ale! Now!', conditions: [] },
    ]
    const result = dedupeSlot('order_line', snippets)
    expect(result.kept).toHaveLength(1)
    expect(result.rejections).toHaveLength(1)
  })

  it('keeps the higher-specificity snippet when collapsing', () => {
    const snippets = [
      { id: 'fallback', text: 'Ale. Now.', conditions: [] },
      {
        id: 'specific',
        text: 'Ale. Now!',
        conditions: [
          {
            kind: 'voiceAxis' as const,
            role: 'primaryActor',
            axis: 'terseness' as const,
            atLeast: 2 as const,
          },
        ],
      },
    ]
    const result = dedupeSlot('order_line', snippets)
    expect(result.kept).toHaveLength(1)
    expect(result.kept[0]!.id).toBe('specific')
  })

  it('breaks specificity ties by lex-smaller id', () => {
    const snippets = [
      { id: 'zee', text: 'Ale. Now.', conditions: [] },
      { id: 'alpha', text: 'Ale! Now!', conditions: [] },
    ]
    const result = dedupeSlot('order_line', snippets)
    expect(result.kept).toHaveLength(1)
    expect(result.kept[0]!.id).toBe('alpha')
  })

  it('cross-slot dedupe only fires on canonical equality', () => {
    const result = dedupePools([
      {
        slotId: 'order_line',
        snippets: [{ id: 'a', text: 'An ale, please.', conditions: [] }],
      },
      {
        slotId: 'manner_note',
        snippets: [{ id: 'b', text: 'An ale, please.', conditions: [] }],
      },
    ])
    expect(result.crossSlotRejections).toHaveLength(1)
    expect(result.perSlot[0]!.kept).toHaveLength(1)
    expect(result.perSlot[1]!.kept).toHaveLength(0)
  })

  it('cross-slot dedupe does NOT fire on near-duplicate similarity (different canonical form)', () => {
    // These two canonicalise to different strings ("ale now" vs "they
    // tap two coins once") so cross-slot dedupe must leave both intact.
    // Cross-slot only collapses on canonical equality, not near-dups.
    const result = dedupePools([
      {
        slotId: 'order_line',
        snippets: [{ id: 'a', text: 'Ale. Now.', conditions: [] }],
      },
      {
        slotId: 'manner_note',
        snippets: [
          { id: 'b', text: 'They tap two coins once.', conditions: [] },
        ],
      },
    ])
    expect(result.crossSlotRejections).toEqual([])
    expect(result.perSlot[0]!.kept).toHaveLength(1)
    expect(result.perSlot[1]!.kept).toHaveLength(1)
  })

  it('cross-slot dedupe DOES fire when punctuation-only differences collapse to the same canonical text', () => {
    // "Ale. Now." and "Ale! Now!" both canonicalise to "ale now",
    // so cross-slot dedupe collapses the second.
    const result = dedupePools([
      {
        slotId: 'order_line',
        snippets: [{ id: 'a', text: 'Ale. Now.', conditions: [] }],
      },
      {
        slotId: 'manner_note',
        snippets: [{ id: 'b', text: 'Ale! Now!', conditions: [] }],
      },
    ])
    expect(result.crossSlotRejections).toHaveLength(1)
    expect(result.perSlot[0]!.kept).toHaveLength(1)
    expect(result.perSlot[1]!.kept).toHaveLength(0)
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
