// Phase 158 / ISSUE-126 — Legible Surface arc, Phase 13 (Social Previews).
//
// Cell-level unit coverage for the recalibrated social-meter blocks in the
// shared narrator base. Mirrors phase157.economicPreviews.test.ts: assert
// structural properties of the base (every emitted customer / reputation /
// supplier / faction / culture cell has at least one snippet that carries
// both the targetKind keyword and a magnitude-lexicon token), plus
// optimistic single-snippet coverage of the never-emitted cells (cohort
// across the board; customer tiny / pos large; reputation large; faction
// tiny; culture tiny / large), plus determinism (same effect ⇒ same text).
//
// The production cells listed below come from the audit in
// docs/plans/phase-158-social-previews.md §"What the sim emits".

import { describe, expect, it } from 'vitest'

import { pickSnippet } from '../../../src/cards/compose/assemble'
import { narratorEffectPreviewBase } from '../../../src/cards/compose/pools/_shared/effectPreviewBase'
import {
  MAGNITUDE_LEXICON,
  lineCarriesMagnitude,
} from '../../../src/cards/compose/magnitudeLexicon'
import { DEFAULT_TARGET_KIND_KEYWORDS } from '../../../src/cards/compose/gates/previewVariety'
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

function containsKeyword(line: string, kind: EffectTargetKind): boolean {
  const lower = line.toLowerCase()
  return DEFAULT_TARGET_KIND_KEYWORDS[kind].some((kw) =>
    lower.includes(kw.toLowerCase()),
  )
}

// ---- generic cell coverage helper ----
//
// For each social meter the helper iterates every direction × band cell and
// asserts (a) the base ships ≥1 snippet for that cell and (b) at least one
// of those snippets contains both the targetKind keyword and a calibrated
// magnitude-lexicon token. Cells the sim never emits today are covered with
// a single optimistic snippet per the Phase-158 plan.

const ALL_BANDS: readonly EffectMagnitudeBand[] = [
  'tiny',
  'small',
  'medium',
  'large',
]

function coverCells(
  kind: EffectTargetKind,
  cells: readonly [EffectDirection, EffectMagnitudeBand][],
): void {
  for (const [direction, band] of cells) {
    it(`${kind} ${direction} ${band} — snippet carries ${kind} keyword + magnitude token`, () => {
      const snippets = findCellSnippets(kind, direction, band)
      expect(
        snippets.length,
        `cell ${kind}/${direction}/${band} present`,
      ).toBeGreaterThan(0)
      const ok = snippets.some(
        (s) =>
          containsKeyword(s.text, kind) &&
          lineCarriesMagnitude(s.text, direction, band),
      )
      expect(
        ok,
        `cell ${kind}/${direction}/${band} has at least one keyword+magnitude snippet`,
      ).toBe(true)
    })
  }
}

// ---- customer ----
//
// Production cells: neg small (-5, -6), neg medium (-8), neg large (-25
// patronage bans), pos small (+4), pos medium (+8/+10/+12). tiny and pos
// large get optimistic single-snippet coverage so a future emission stays
// legible.

describe('shared narrator base — customer cell coverage', () => {
  coverCells(
    'customer',
    ALL_BANDS.flatMap((band) =>
      (['negative', 'positive'] as EffectDirection[]).map(
        (d) => [d, band] as [EffectDirection, EffectMagnitudeBand],
      ),
    ),
  )
})

// ---- reputation ----
//
// Production cells: tiny -3/-4 + pos +2/+4; small dominant on both sides;
// medium -10 + pos +10/+12. large left optimistic on both sides — no
// production emissions.

describe('shared narrator base — reputation cell coverage', () => {
  coverCells(
    'reputation',
    ALL_BANDS.flatMap((band) =>
      (['negative', 'positive'] as EffectDirection[]).map(
        (d) => [d, band] as [EffectDirection, EffectMagnitudeBand],
      ),
    ),
  )
})

// ---- supplier ----
//
// Production cells: neg small (-5), neg medium (-10), pos small (+3..+5).
// Other cells optimistic per Phase-158 plan.

describe('shared narrator base — supplier cell coverage', () => {
  coverCells(
    'supplier',
    ALL_BANDS.flatMap((band) =>
      (['negative', 'positive'] as EffectDirection[]).map(
        (d) => [d, band] as [EffectDirection, EffectMagnitudeBand],
      ),
    ),
  )
})

// ---- faction ----
//
// Production cells: neg small (-8 trust), neg medium (-12..-15), neg large
// (-20/-25), pos small (+5..+8), pos medium (+10..+15), pos large (+15
// fear). tiny optimistic on both sides.

describe('shared narrator base — faction cell coverage', () => {
  coverCells(
    'faction',
    ALL_BANDS.flatMap((band) =>
      (['negative', 'positive'] as EffectDirection[]).map(
        (d) => [d, band] as [EffectDirection, EffectMagnitudeBand],
      ),
    ),
  )
})

// ---- culture ----
//
// Production cells: small/medium on both sides. tiny and large optimistic.

describe('shared narrator base — culture cell coverage', () => {
  coverCells(
    'culture',
    ALL_BANDS.flatMap((band) =>
      (['negative', 'positive'] as EffectDirection[]).map(
        (d) => [d, band] as [EffectDirection, EffectMagnitudeBand],
      ),
    ),
  )
})

// ---- cohort ----
//
// No state_change cohort emissions in production today; every customer_group:
// effect is a `cause` write. Each cell carries a single optimistic snippet so
// a future emission would still pass the legibility contract.

describe('shared narrator base — cohort optimistic coverage', () => {
  coverCells(
    'cohort',
    ALL_BANDS.flatMap((band) =>
      (['negative', 'positive'] as EffectDirection[]).map(
        (d) => [d, band] as [EffectDirection, EffectMagnitudeBand],
      ),
    ),
  )

  it('cohort neutral direction snippet still exists for cause-write paths', () => {
    const neu = BASE.find(
      (s) =>
        s.conditions?.some(
          (c) => c.kind === 'effectTargetKind' && c.anyOf.includes('cohort'),
        ) &&
        s.conditions?.some(
          (c) => c.kind === 'effectDirection' && c.sign === 'neutral',
        ),
    )
    expect(neu, 'cohort neutral direction snippet present').toBeDefined()
  })
})

// ---- determinism end-to-end ----

describe('shared narrator base — determinism via pickSnippet on social effects', () => {
  const state = createInitialTavernState()
  const seed = makeSeed({
    id: 'phase158-determinism',
    family: 'regular_customer',
    type: 'complaint',
    timing: 'during_service',
    severity: 40,
    domain: ['customer'],
  })
  const pool: SnippetPool = {
    slotId: 'effect_preview',
    snippets: BASE,
  }

  function pickFor(
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

  it('two calls with the same customer -8 medium effect return the same text', () => {
    const a = pickFor('customers.miners.satisfaction', -8, ['customer'], 'ignore', 0)
    const b = pickFor('customers.miners.satisfaction', -8, ['customer'], 'ignore', 0)
    expect(a).toBeDefined()
    expect(a).toBe(b)
  })

  it('reputation -8 small renders a name/word/talk + small-magnitude line', () => {
    const text = pickFor('reputation.respectable', -8, ['reputation'], 'sidetake', 0)
    expect(text).toBeDefined()
    expect(containsKeyword(text!, 'reputation')).toBe(true)
    expect(lineCarriesMagnitude(text!, 'negative', 'small')).toBe(true)
  })

  it('faction -20 large renders a guild/order/faction + heavy-fall line', () => {
    const text = pickFor(
      'factions.guild.relationship',
      -20,
      ['faction'],
      'betray',
      0,
    )
    expect(text).toBeDefined()
    expect(containsKeyword(text!, 'faction')).toBe(true)
    expect(lineCarriesMagnitude(text!, 'negative', 'large')).toBe(true)
  })

  it('culture +15 medium renders a kin/folk/people + clear-lift line', () => {
    const text = pickFor(
      'cultures.miners.familiarity',
      15,
      ['culture'],
      'honor',
      0,
    )
    expect(text).toBeDefined()
    expect(containsKeyword(text!, 'culture')).toBe(true)
    expect(lineCarriesMagnitude(text!, 'positive', 'medium')).toBe(true)
  })

  it('supplier -10 medium renders a supplier/merchant/trader/deal + marked-fall line', () => {
    const text = pickFor(
      'world.suppliers.alepost.relationship',
      -10,
      ['supplier'],
      'blame',
      0,
    )
    expect(text).toBeDefined()
    expect(containsKeyword(text!, 'supplier')).toBe(true)
    expect(lineCarriesMagnitude(text!, 'negative', 'medium')).toBe(true)
  })

  it('customer +12 medium renders a patron/regular/customer/guest + clear-lift line', () => {
    const text = pickFor(
      'customers.merchants.patronage',
      12,
      ['customer'],
      'invest',
      0,
    )
    expect(text).toBeDefined()
    expect(containsKeyword(text!, 'customer')).toBe(true)
    expect(lineCarriesMagnitude(text!, 'positive', 'medium')).toBe(true)
  })

  it('reputation +12 medium renders a name/word/talk + clear-lift line', () => {
    const text = pickFor(
      'reputation.reliable',
      12,
      ['reputation'],
      'invest',
      0,
    )
    expect(text).toBeDefined()
    expect(containsKeyword(text!, 'reputation')).toBe(true)
    expect(lineCarriesMagnitude(text!, 'positive', 'medium')).toBe(true)
  })

  it('axis-neutral: respectable -8 and dangerous -8 both render small-band reputation lines (same axis-blind grade)', () => {
    // Phase 158 deliberately keeps reputation snippets axis-neutral; the
    // line names the meter (reputation/name/word/talk) without claiming
    // which axis moved.
    const a = pickFor('reputation.respectable', -8, ['reputation'], 'a', 0)
    const b = pickFor('reputation.dangerous', -8, ['reputation'], 'b', 0)
    expect(a).toBeDefined()
    expect(b).toBeDefined()
    expect(containsKeyword(a!, 'reputation')).toBe(true)
    expect(containsKeyword(b!, 'reputation')).toBe(true)
    expect(lineCarriesMagnitude(a!, 'negative', 'small')).toBe(true)
    expect(lineCarriesMagnitude(b!, 'negative', 'small')).toBe(true)
  })
})

// ---- replaced cells: the old 2-condition snippets are gone ----
//
// Phase 158 retires the kind+direction-only snippets at the customer /
// cohort / reputation / supplier / faction / culture blocks. Lock that in:
// every social-meter snippet in the new base now carries the band
// condition, except for the explicit `neutral`-direction fallthroughs
// (cohort / supplier / faction).

describe('shared narrator base — Phase 158 retirement of kind+direction-only social snippets', () => {
  const SOCIAL_KINDS: readonly EffectTargetKind[] = [
    'customer',
    'cohort',
    'reputation',
    'supplier',
    'faction',
    'culture',
  ]

  for (const kind of SOCIAL_KINDS) {
    it(`every ${kind} snippet carries a magnitudeBand condition (except neutral-direction fallthroughs)`, () => {
      const snippets = BASE.filter((s) =>
        s.conditions?.some(
          (c) => c.kind === 'effectTargetKind' && c.anyOf.includes(kind),
        ),
      )
      expect(snippets.length).toBeGreaterThan(0)
      for (const s of snippets) {
        const hasBand = s.conditions?.some(
          (c) => c.kind === 'effectMagnitudeBand',
        )
        const isNeutralFallthrough = s.conditions?.some(
          (c) => c.kind === 'effectDirection' && c.sign === 'neutral',
        )
        if (!hasBand && !isNeutralFallthrough) {
          throw new Error(
            `${kind} snippet ${s.id} ("${s.text}") has no band and is not a neutral fallthrough`,
          )
        }
      }
    })
  }
})
