// Phase 157 / ISSUE-125 — Legible Surface arc, Phase 12 (Economic Previews).
//
// Cell-level unit coverage for the recalibrated shared narrator base.
// Mirrors `phase147.magnitudeLexicon.test.ts` shape: assert structural
// properties of the base (every emitted coin/stock cell has at least
// one snippet that carries both the targetKind keyword and a magnitude-
// lexicon token), plus determinism (same effect ⇒ same text), plus the
// rent / wages tag variants out-rank plain coin cells when the tag
// matches.

import { describe, expect, it } from 'vitest'

import { pickSnippet } from '../../../src/cards/compose/assemble'
import { narratorEffectPreviewBase } from '../../../src/cards/compose/pools/_shared/effectPreviewBase'
import {
  MAGNITUDE_LEXICON,
  lineCarriesMagnitude,
} from '../../../src/cards/compose/magnitudeLexicon'
import {
  DEFAULT_TARGET_KIND_KEYWORDS,
} from '../../../src/cards/compose/gates/previewVariety'
import type {
  ConditionContext,
  SlotSpec,
  Snippet,
  SnippetPool,
} from '../../../src/cards/compose/types'
import { createInitialTavernState } from '../../../src/sim/state/defaults'
import { effect } from '../../../src/sim/modules/issues/generatorHelpers'
import type {
  EffectDirection,
  EffectMagnitudeBand,
  EffectPreview,
  EffectTargetKind,
} from '../../../src/sim/core/effect'
import { makeSeed } from '../cardFactories'

const BASE = narratorEffectPreviewBase()

function findCellSnippets(
  targetKind: EffectTargetKind,
  direction: EffectDirection,
  band: EffectMagnitudeBand,
): Snippet[] {
  return BASE.filter((snippet) => {
    let hasTargetKind = false
    let hasDirection = false
    let hasBand = false
    for (const c of snippet.conditions ?? []) {
      if (c.kind === 'effectTargetKind' && c.anyOf.includes(targetKind))
        hasTargetKind = true
      if (c.kind === 'effectDirection' && c.sign === direction)
        hasDirection = true
      if (c.kind === 'effectMagnitudeBand' && c.anyOf.includes(band))
        hasBand = true
    }
    return hasTargetKind && hasDirection && hasBand
  })
}

function containsCoinKeyword(line: string): boolean {
  const lower = line.toLowerCase()
  return DEFAULT_TARGET_KIND_KEYWORDS.coin.some((kw) =>
    lower.includes(kw.toLowerCase()),
  )
}

function containsStockKeyword(line: string): boolean {
  const lower = line.toLowerCase()
  return DEFAULT_TARGET_KIND_KEYWORDS.stock.some((kw) =>
    lower.includes(kw.toLowerCase()),
  )
}

// ---- coin cell coverage ----
//
// Production-emitted coin cells per generators audit (see
// docs/plans/phase-157-economic-previews.md). Every cell listed must
// have at least one snippet in the recalibrated shared base that
// carries (i) the coin keyword (passes `requireCostSurfacing` when
// direction is negative) and (ii) the magnitude-lexicon token for its
// (direction, band) cell (passes `requireMagnitude`).

describe('shared narrator base — coin cell coverage', () => {
  const COIN_NEGATIVE_CELLS: readonly EffectMagnitudeBand[] = [
    'tiny',
    'small',
    'medium',
    'large',
  ]
  const COIN_POSITIVE_CELLS: readonly EffectMagnitudeBand[] = [
    'tiny',
    'small',
    'medium',
    'large',
  ]

  for (const band of COIN_NEGATIVE_CELLS) {
    it(`coin negative ${band} — at least one snippet carries coin keyword + magnitude token`, () => {
      const snippets = findCellSnippets('coin', 'negative', band)
      expect(snippets.length, `cell coin/neg/${band} present`).toBeGreaterThan(0)
      const ok = snippets.some(
        (s) =>
          containsCoinKeyword(s.text) &&
          lineCarriesMagnitude(s.text, 'negative', band),
      )
      expect(
        ok,
        `cell coin/neg/${band} has at least one cost+magnitude snippet`,
      ).toBe(true)
    })
  }

  for (const band of COIN_POSITIVE_CELLS) {
    it(`coin positive ${band} — at least one snippet carries coin keyword + magnitude token`, () => {
      const snippets = findCellSnippets('coin', 'positive', band)
      expect(snippets.length, `cell coin/pos/${band} present`).toBeGreaterThan(0)
      const ok = snippets.some(
        (s) =>
          containsCoinKeyword(s.text) &&
          lineCarriesMagnitude(s.text, 'positive', band),
      )
      expect(
        ok,
        `cell coin/pos/${band} has at least one keyword+magnitude snippet`,
      ).toBe(true)
    })
  }
})

// ---- stock cell coverage ----

describe('shared narrator base — stock cell coverage', () => {
  const STOCK_CELLS: readonly [EffectDirection, EffectMagnitudeBand][] = [
    ['negative', 'tiny'],
    ['negative', 'small'],
    ['negative', 'medium'],
    ['negative', 'large'],
    ['positive', 'tiny'],
    ['positive', 'small'],
    ['positive', 'medium'],
    ['positive', 'large'],
  ]

  for (const [direction, band] of STOCK_CELLS) {
    it(`stock ${direction} ${band} — snippet carries stock keyword + magnitude token`, () => {
      const snippets = findCellSnippets('stock', direction, band)
      expect(
        snippets.length,
        `cell stock/${direction}/${band} present`,
      ).toBeGreaterThan(0)
      const ok = snippets.some(
        (s) =>
          containsStockKeyword(s.text) &&
          lineCarriesMagnitude(s.text, direction, band),
      )
      expect(
        ok,
        `cell stock/${direction}/${band} has at least one keyword+magnitude snippet`,
      ).toBe(true)
    })
  }
})

// ---- debt-tag variants ----

describe('shared narrator base — debt-tag variants', () => {
  it('a rent-tagged coin snippet exists at small + medium bands', () => {
    const rentSnippets = BASE.filter((s) =>
      s.conditions?.some(
        (c) => c.kind === 'effectTag' && c.tag === 'rent',
      ),
    )
    expect(rentSnippets.length).toBeGreaterThanOrEqual(2)
    for (const s of rentSnippets) {
      // Each rent snippet must contain "rent" in the text.
      expect(s.text.toLowerCase().includes('rent')).toBe(true)
    }
  })

  it('a wages-tagged coin snippet exists at small band', () => {
    const wagesSnippets = BASE.filter((s) =>
      s.conditions?.some(
        (c) => c.kind === 'effectTag' && c.tag === 'wages',
      ),
    )
    expect(wagesSnippets.length).toBeGreaterThanOrEqual(1)
    for (const s of wagesSnippets) {
      expect(s.text.toLowerCase().includes('wages')).toBe(true)
    }
  })

  it('rent variant has more conditions than the plain coin medium cell (higher specificity)', () => {
    const plainMedium = BASE.find(
      (s) => s.id === 'shared_preview_coin_neg_medium_a',
    )
    const rentMedium = BASE.find(
      (s) => s.id === 'shared_preview_coin_rent_medium_a',
    )
    expect(plainMedium).toBeDefined()
    expect(rentMedium).toBeDefined()
    expect(rentMedium!.conditions!.length).toBeGreaterThan(
      plainMedium!.conditions!.length,
    )
  })
})

// ---- determinism end-to-end ----

describe('shared narrator base — determinism via pickSnippet', () => {
  const state = createInitialTavernState()
  const seed = makeSeed({
    id: 'phase157-determinism',
    family: 'supplier_relationship',
    type: 'supplier_offer',
    timing: 'during_service',
    severity: 40,
    domain: ['supplier'],
  })
  const pool: SnippetPool = {
    slotId: 'effect_preview',
    snippets: BASE,
  }

  function pickFor(
    targetKind: EffectTargetKind,
    target: string,
    amount: number,
    tags: string[],
    slotId: string,
    idx: number,
  ): string | undefined {
    const e = effect('state_change', target, amount, 'readable stub', tags)
    const slot: SlotSpec = {
      id: `effect_preview::${slotId}::${idx}`,
      role: 'effect_preview',
      pool,
      optional: true,
      wordBudget: 10,
      claimMode: 'flavor',
    }
    const ctx: ConditionContext = {
      currentEffect: e as EffectPreview,
    }
    return pickSnippet(slot, seed, state, ctx)
  }

  it('two calls with the same effect produce the same text (coin -25 medium)', () => {
    const a = pickFor('coin', 'coin', -25, ['coin'], 'pay', 0)
    const b = pickFor('coin', 'coin', -25, ['coin'], 'pay', 0)
    expect(a).toBeDefined()
    expect(a).toBe(b)
  })

  it('rent-tagged coin -25 medium resolves to a rent-flavoured snippet', () => {
    const text = pickFor('coin', 'coin', -25, ['coin', 'rent'], 'pay', 0)
    expect(text).toBeDefined()
    expect(text!.toLowerCase().includes('rent')).toBe(true)
  })

  it('plain coin -25 medium (no rent tag) resolves to a non-rent snippet', () => {
    const text = pickFor('coin', 'coin', -25, ['coin'], 'pay', 0)
    expect(text).toBeDefined()
    expect(text!.toLowerCase().includes('rent')).toBe(false)
  })

  it('wages-tagged coin -10 small resolves to a wages-flavoured snippet', () => {
    const text = pickFor('coin', 'coin', -10, ['coin', 'wages'], 'pay', 0)
    expect(text).toBeDefined()
    expect(text!.toLowerCase().includes('wages')).toBe(true)
  })

  it('stock +60 large quantity resolves to a stock keyword + magnitude snippet', () => {
    const text = pickFor(
      'stock',
      'stock.ale.quantity',
      60,
      ['stock'],
      'restock',
      0,
    )
    expect(text).toBeDefined()
    expect(containsStockKeyword(text!)).toBe(true)
    expect(lineCarriesMagnitude(text!, 'positive', 'large')).toBe(true)
  })

  it('coin -40 medium spend surfaces a coin keyword in the rendered line', () => {
    const text = pickFor('coin', 'coin', -40, ['coin'], 'bribe', 0)
    expect(text).toBeDefined()
    expect(containsCoinKeyword(text!)).toBe(true)
    expect(lineCarriesMagnitude(text!, 'negative', 'medium')).toBe(true)
  })
})
