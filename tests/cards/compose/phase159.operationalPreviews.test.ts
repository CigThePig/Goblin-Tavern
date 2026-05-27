// Phase 159 / ISSUE-127 — Legible Surface arc, Phase 14 (Operational
// Previews + Pressure & Delayed/Uncertain framing).
//
// Cell-level unit coverage for the recalibrated operational-meter blocks in
// the shared narrator base (staff / area / pressure), the new inaction-gated
// pressure block, and the inaction-routing distinction between active-choice
// and inaction renders. Mirrors phase158.socialPreviews.test.ts in shape.
//
// Production cells come from the audit in
// docs/plans/phase-159-operational-previews.md §"What the sim emits".

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
  requireInaction = false,
): Snippet[] {
  return BASE.filter((snippet) => {
    let hasTargetKind = false
    let hasDirection = false
    let hasBand = false
    let hasInaction = false
    for (const c of snippet.conditions ?? []) {
      if (c.kind === 'effectTargetKind' && c.anyOf.includes(targetKind))
        hasTargetKind = true
      if (c.kind === 'effectDirection' && c.sign === direction)
        hasDirection = true
      if (c.kind === 'effectMagnitudeBand' && c.anyOf.includes(band))
        hasBand = true
      if (c.kind === 'inactionPreview' && c.value === true) hasInaction = true
    }
    if (requireInaction && !hasInaction) return false
    if (!requireInaction && hasInaction) return false
    return hasTargetKind && hasDirection && hasBand
  })
}

function containsKeyword(line: string, kind: EffectTargetKind): boolean {
  const lower = line.toLowerCase()
  return DEFAULT_TARGET_KIND_KEYWORDS[kind].some((kw) =>
    lower.includes(kw.toLowerCase()),
  )
}

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

// ---- staff ----
//
// Production cells: stress -8/-10/-12 (small/medium); fatigue -3/-15
// + +4/+6/+8 (tiny → medium); morale -6/-12/-15 + +6/+8/+12/+15;
// loyalty -3/-4/-20 + +6/+8/+10/+14/+15/+20. tiny optimistic on both
// sides (no production emission at <3 abs). All cells present.

describe('shared narrator base — staff cell coverage', () => {
  coverCells(
    'staff',
    ALL_BANDS.flatMap((band) =>
      (['negative', 'positive'] as EffectDirection[]).map(
        (d) => [d, band] as [EffectDirection, EffectMagnitudeBand],
      ),
    ),
  )
})

// ---- area ----
//
// Production cells: tiny damage +6 / damage -8; small condition -8 /
// smell -10..-12 / cleanliness +10..+12 / condition +10..+12 / damage
// -10; medium cleanliness +15..+25 / condition +20 / damage -20..-25.
// large optimistic on both sides — no production emissions today.

describe('shared narrator base — area cell coverage', () => {
  coverCells(
    'area',
    ALL_BANDS.flatMap((band) =>
      (['negative', 'positive'] as EffectDirection[]).map(
        (d) => [d, band] as [EffectDirection, EffectMagnitudeBand],
      ),
    ),
  )
})

// ---- pressure (active-choice path) ----
//
// Production cells: -3..-15 + +3..+15 across tiny/small/medium; +25
// rare (large). Most-emitted preview targetKind in the whole sim.
// The active-choice cells live under no `inactionPreview` condition;
// the inaction-gated cells are tested separately below.

describe('shared narrator base — pressure active-choice cell coverage', () => {
  coverCells(
    'pressure',
    ALL_BANDS.flatMap((band) =>
      (['negative', 'positive'] as EffectDirection[]).map(
        (d) => [d, band] as [EffectDirection, EffectMagnitudeBand],
      ),
    ),
  )
})

// ---- pressure inaction-gated block (specificity 4) ----
//
// Authored against the 14 inaction profiles in
// issueSeedGenerators.ts + expandedSeedGenerators.ts. Every one emits
// positive-direction pressure as its delayed cost (stock_shortage,
// maintenance, staff_burnout, debt, inspection, food_safety,
// customer_complaint, regular_loss, rival, rumour, …). Small/medium
// are heavily emitted; large is optimistic. The block exists so the
// `inactionPreview: true` ctx threads through to a snippet that
// frames "what *not* acting costs" — verbs "would keep …" / "would
// mount unchecked".

describe('shared narrator base — inaction pressure cell coverage', () => {
  it('inaction pressure positive small — at least one snippet, keyword + magnitude + threat verb', () => {
    const snippets = findCellSnippets('pressure', 'positive', 'small', true)
    expect(snippets.length).toBeGreaterThan(0)
    const ok = snippets.some(
      (s) =>
        containsKeyword(s.text, 'pressure') &&
        lineCarriesMagnitude(s.text, 'positive', 'small') &&
        /\b(keep|mount|build|press|climb|creep)\b/i.test(s.text),
    )
    expect(ok, 'small inaction-pressure carries threat verb').toBe(true)
  })

  it('inaction pressure positive medium — at least one snippet, keyword + magnitude + threat verb', () => {
    const snippets = findCellSnippets('pressure', 'positive', 'medium', true)
    expect(snippets.length).toBeGreaterThan(0)
    const ok = snippets.some(
      (s) =>
        containsKeyword(s.text, 'pressure') &&
        lineCarriesMagnitude(s.text, 'positive', 'medium') &&
        /\b(mount|build|press|climb|unchecked|harder)\b/i.test(s.text),
    )
    expect(ok, 'medium inaction-pressure carries threat verb').toBe(true)
  })

  it('inaction pressure positive large — optimistic single-snippet coverage', () => {
    const snippets = findCellSnippets('pressure', 'positive', 'large', true)
    expect(snippets.length).toBeGreaterThanOrEqual(1)
    const ok = snippets.some(
      (s) =>
        containsKeyword(s.text, 'pressure') &&
        lineCarriesMagnitude(s.text, 'positive', 'large'),
    )
    expect(ok).toBe(true)
  })

  it('inaction-block snippets all gate on positive direction (no negative-pressure inaction snippets)', () => {
    const inactionSnippets = BASE.filter((s) =>
      s.conditions?.some(
        (c) => c.kind === 'inactionPreview' && c.value === true,
      ),
    )
    // The areaAtmosphere pilot also authors area-targeted inaction
    // snippets in its own pool, not in the shared base. The shared
    // base only ships pressure-positive inaction snippets.
    const sharedPressureInaction = inactionSnippets.filter((s) =>
      s.conditions?.some(
        (c) => c.kind === 'effectTargetKind' && c.anyOf.includes('pressure'),
      ),
    )
    expect(sharedPressureInaction.length).toBeGreaterThan(0)
    for (const s of sharedPressureInaction) {
      const hasPositiveDirection = s.conditions?.some(
        (c) => c.kind === 'effectDirection' && c.sign === 'positive',
      )
      expect(
        hasPositiveDirection,
        `inaction-pressure snippet ${s.id} ("${s.text}") gates on positive direction`,
      ).toBe(true)
    }
  })
})

// ---- inaction routing — active vs inaction render distinct ----

describe('inaction routing — active-choice vs inaction render produce different snippets', () => {
  const state = createInitialTavernState()
  const seed = makeSeed({
    id: 'phase159-inaction-routing',
    family: 'maintenance',
    type: 'maintenance_problem',
    timing: 'morning_prep',
    severity: 40,
    domain: ['area'],
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
    inaction: boolean,
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
    const ctx: ConditionContext = inaction
      ? { currentEffect: e as EffectPreview, inactionPreview: true }
      : { currentEffect: e as EffectPreview }
    return pickSnippet(slot, seed, state, ctx)
  }

  it('pressure:maintenance +6 (small) renders differently on inaction vs active path', () => {
    const active = pickFor('pressure:maintenance', 6, ['pressure'], 'active', 0, false)
    const inact = pickFor('pressure:maintenance', 6, ['pressure'], 'ignore', 0, true)
    expect(active).toBeDefined()
    expect(inact).toBeDefined()
    expect(active).not.toBe(inact)
  })

  it('inaction render carries a temporal-claim verb ("keep" / "mount" / "build")', () => {
    const inact = pickFor('pressure:debt', 10, ['pressure'], 'delay', 0, true)
    expect(inact).toBeDefined()
    expect(
      /\b(keep|mount|build|press|harder|unchecked|every)\b/i.test(inact!),
    ).toBe(true)
  })

  it('active-choice render does NOT carry the inaction-only "unchecked" framing', () => {
    const active = pickFor('pressure:landlord', 10, ['pressure'], 'pay', 0, false)
    expect(active).toBeDefined()
    expect(active!.toLowerCase()).not.toContain('unchecked')
  })

  it('active-choice render still satisfies the contract (keyword + magnitude)', () => {
    const active = pickFor('pressure:food_safety', 8, ['pressure'], 'treat', 0, false)
    expect(active).toBeDefined()
    expect(containsKeyword(active!, 'pressure')).toBe(true)
    expect(lineCarriesMagnitude(active!, 'positive', 'small')).toBe(true)
  })
})

// ---- determinism end-to-end ----

describe('shared narrator base — determinism via pickSnippet on operational effects', () => {
  const state = createInitialTavernState()
  const seed = makeSeed({
    id: 'phase159-determinism',
    family: 'maintenance',
    type: 'maintenance_problem',
    timing: 'morning_prep',
    severity: 40,
    domain: ['area'],
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

  it('two calls with the same staff -10 medium effect return the same text', () => {
    const a = pickFor('staff.alice.stress', -10, ['staff'], 'rest', 0)
    const b = pickFor('staff.alice.stress', -10, ['staff'], 'rest', 0)
    expect(a).toBeDefined()
    expect(a).toBe(b)
  })

  it('area cleanliness +25 medium renders an area keyword + clear-lift line', () => {
    const text = pickFor('areas.kitchen.cleanliness', 25, ['area'], 'scrub', 0)
    expect(text).toBeDefined()
    expect(containsKeyword(text!, 'area')).toBe(true)
    expect(lineCarriesMagnitude(text!, 'positive', 'medium')).toBe(true)
  })

  it('pressure +12 medium renders a pressure keyword + clear-lift line', () => {
    const text = pickFor('pressure:inspection', 12, ['pressure'], 'ignore', 0)
    expect(text).toBeDefined()
    expect(containsKeyword(text!, 'pressure')).toBe(true)
    expect(lineCarriesMagnitude(text!, 'positive', 'medium')).toBe(true)
  })

  it('staff +15 large renders a staff keyword + strong-climb line', () => {
    const text = pickFor('staff.bob.loyalty', 15, ['staff'], 'praise', 0)
    expect(text).toBeDefined()
    expect(containsKeyword(text!, 'staff')).toBe(true)
    expect(lineCarriesMagnitude(text!, 'positive', 'large')).toBe(true)
  })

  it('axis-neutral pressure: pressure:debt +6 and pressure:food_safety +6 both render small-band positive lines', () => {
    const a = pickFor('pressure:debt', 6, ['pressure'], 'a', 0)
    const b = pickFor('pressure:food_safety', 6, ['pressure'], 'b', 0)
    expect(a).toBeDefined()
    expect(b).toBeDefined()
    expect(containsKeyword(a!, 'pressure')).toBe(true)
    expect(containsKeyword(b!, 'pressure')).toBe(true)
    expect(lineCarriesMagnitude(a!, 'positive', 'small')).toBe(true)
    expect(lineCarriesMagnitude(b!, 'positive', 'small')).toBe(true)
  })
})

// ---- Phase 159 retirement guards ----
//
// Phase 159 retires the kind+direction-only snippets at the staff / area /
// pressure blocks. Every snippet for these targetKinds now carries the band
// condition. The inaction-gated block is a strict superset (it also carries
// the `inactionPreview` condition).

describe('shared narrator base — Phase 159 retirement of kind+direction-only operational snippets', () => {
  const OPERATIONAL_KINDS: readonly EffectTargetKind[] = [
    'staff',
    'area',
    'pressure',
  ]

  for (const kind of OPERATIONAL_KINDS) {
    it(`every ${kind} snippet carries a magnitudeBand condition`, () => {
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

// ---- magnitude lexicon parity check ----
//
// Sanity check that the lexicon still carries the tokens Phase 14 reaches
// for in its pressure/staff/area authoring. If anyone shifts the lexicon
// these tests fail loudly so authoring can be re-anchored.

describe('Phase 159 — magnitude lexicon tokens used by operational pools are present', () => {
  it('positive small lexicon includes "a step" / "a notch" / "a measure"', () => {
    expect(MAGNITUDE_LEXICON.positive.small).toContain('a step')
    expect(MAGNITUDE_LEXICON.positive.small).toContain('a notch')
    expect(MAGNITUDE_LEXICON.positive.small).toContain('a measure')
  })

  it('negative medium lexicon includes "a clear drop" / "a real slip" / "a marked fall"', () => {
    expect(MAGNITUDE_LEXICON.negative.medium).toContain('a clear drop')
    expect(MAGNITUDE_LEXICON.negative.medium).toContain('a real slip')
    expect(MAGNITUDE_LEXICON.negative.medium).toContain('a marked fall')
  })

  it('positive large lexicon includes "a strong climb" (used by inaction pressure large)', () => {
    expect(MAGNITUDE_LEXICON.positive.large).toContain('a strong climb')
  })
})
