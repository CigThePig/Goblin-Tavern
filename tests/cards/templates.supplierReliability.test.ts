// Phase 135 / ISSUE-104 — Voiced Surface arc, Phase 9 (Suppliers, Stock & Debt).
//
// Integration tests for `supplierReliabilityCard` — the compositional
// replacement for the legacy hand-written `supplierOfferCard`. Mirrors
// `templates.staffBurnout.test.ts` and `templates.regularComplaint.test.ts`
// shape: appliesTo wiring, custom-cast predicate, sim-backed
// establishing line fires on signal bands, voiced reaction follows on
// voice axes, choices preserve mechanical truth, deterministic re-render,
// graceful degradation when castAttributes missing.

import { describe, expect, it } from 'vitest'

import {
  supplierReliabilityCard,
  fallbackCard,
} from '../../src/cards/index'
import { pickCardForSeed } from '../../src/cards/selection'
import {
  supplierReliabilityChoiceLabelPool,
  supplierReliabilityEffectPreviewPool,
  supplierReliabilityEstablishingLinePool,
  supplierReliabilityReactionLinePool,
  supplierReliabilityTitlePool,
} from '../../src/cards/compose/pools/supplierReliability'
import { composeChoicesFromSeed } from '../../src/cards/cardHelpers'
import { REQUIRED_CARDS } from '../../src/cards/templates/index'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import type { SupplierCastAttributes } from '../../src/sim/content/cast'
import type {
  IssueSeed,
  IssueSeedFamilyId,
} from '../../src/sim/modules/issues/issueSeedTypes'
import type {
  EntityRef,
  TavernState,
} from '../../src/sim/state/TavernState'
import { makeSeed } from './cardFactories'

function firstSupplierId(state: TavernState): string {
  const id = Object.keys(state.world.suppliers)[0]
  if (!id) throw new Error('test setup expects at least one starter supplier')
  return id
}

function withSupplierCast(
  state: TavernState,
  supplierId: string,
  cast: SupplierCastAttributes,
): TavernState {
  return {
    ...state,
    world: {
      ...state.world,
      suppliers: {
        ...state.world.suppliers,
        [supplierId]: {
          ...state.world.suppliers[supplierId]!,
          castAttributes: cast,
        },
      },
    },
  }
}

function withSupplierReliability(
  state: TavernState,
  supplierId: string,
  reliability: number,
  relationship?: number,
): TavernState {
  return {
    ...state,
    world: {
      ...state.world,
      suppliers: {
        ...state.world.suppliers,
        [supplierId]: {
          ...state.world.suppliers[supplierId]!,
          reliability,
          ...(relationship !== undefined ? { relationship } : {}),
        },
      },
    },
  }
}

function supplierRef(id: string): EntityRef {
  return { kind: 'supplier', id }
}

function supplierOfferSeed(supplierId: string, id = 'supplier-seed'): IssueSeed {
  return makeSeed({
    id,
    family: 'supplier_relationship' as IssueSeedFamilyId,
    type: 'supplier_offer',
    timing: 'morning_prep',
    severity: 45,
    domain: ['suppliers', 'market', 'stock'],
    primaryActor: supplierRef(supplierId),
    responseSlots: [
      {
        id: `${id}-pay`,
        labelHint: 'Pay the supplier',
        allowedVerbs: ['pay'],
        shape: 'safe_costly',
        targetOptions: [supplierRef(supplierId)],
        expectedEffects: ['clear debt', 'spend coin'],
      },
      {
        id: `${id}-blame`,
        labelHint: 'Blame the supplier',
        allowedVerbs: ['blame'],
        shape: 'relationship_sacrifice',
        targetOptions: [supplierRef(supplierId)],
        expectedEffects: ['shed blame'],
      },
    ],
    consequenceProfiles: [
      {
        id: `${id}-pay-profile`,
        responseSlotId: `${id}-pay`,
        immediateEffects: [
          {
            kind: 'state_change',
            target: 'coin',
            amount: -20,
            readable: 'pay the supplier',
            tags: ['coin'],
          },
        ],
        delayedEffects: [],
        memories: [],
        futureHooks: [],
        impactScore: 5,
      },
      {
        id: `${id}-blame-profile`,
        responseSlotId: `${id}-blame`,
        immediateEffects: [
          {
            kind: 'state_change',
            target: 'noop',
            amount: 0,
            readable: 'nothing changes immediately',
            tags: [],
          },
        ],
        delayedEffects: [],
        memories: [],
        futureHooks: [],
        impactScore: 0,
      },
    ],
    textIngredients: {
      subject: 'a supply dispute',
      sensoryDetails: ['stacked crates', 'tight handshake'],
      recentContext: ['reliability 45'],
    },
  })
}

const ESTABLISHING_LINE_TEXTS = new Set(
  supplierReliabilityEstablishingLinePool.snippets.map((s) => s.text),
)
const REACTION_LINE_TEXTS = new Set(
  supplierReliabilityReactionLinePool.snippets.map((s) => s.text),
)
const TITLE_TEXTS = new Set(
  supplierReliabilityTitlePool.snippets.map((s) => s.text),
)

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length
}

describe('supplierReliabilityCard — appliesTo', () => {
  const state = createInitialTavernState()
  const supplierId = firstSupplierId(state)

  it('is registered in REQUIRED_CARDS', () => {
    expect(REQUIRED_CARDS).toContain(supplierReliabilityCard)
  })

  it('matches a supplier_relationship / supplier_offer / morning_prep seed with a cast-bearing supplier', () => {
    const seed = supplierOfferSeed(supplierId)
    const chosen = pickCardForSeed(seed, state, REQUIRED_CARDS)
    expect(chosen?.id).toBe(supplierReliabilityCard.id)
  })

  it('also matches the opportunity seed type', () => {
    const seed = makeSeed({
      family: 'supplier_relationship' as IssueSeedFamilyId,
      type: 'opportunity',
      timing: 'morning_prep',
      primaryActor: supplierRef(supplierId),
    })
    const chosen = pickCardForSeed(seed, state, REQUIRED_CARDS)
    expect(chosen?.id).toBe(supplierReliabilityCard.id)
  })

  it('declines a seed whose supplier has no cast attributes — fallback handles it', () => {
    const original = state.world.suppliers[supplierId]!
    const { castAttributes: _strip, ...rest } = original
    void _strip
    const castless: TavernState = {
      ...state,
      world: {
        ...state.world,
        suppliers: { ...state.world.suppliers, [supplierId]: rest },
      },
    }
    const seed = supplierOfferSeed(supplierId)
    const chosen = pickCardForSeed(seed, castless, REQUIRED_CARDS)
    expect(chosen?.id).not.toBe(supplierReliabilityCard.id)
    expect(chosen?.id).toBe(fallbackCard.id)
  })
})

describe('supplierReliabilityCard — render output', () => {
  it('body[0] is the sim-backed establishing line; body[1] is the voiced reaction', () => {
    const state = createInitialTavernState()
    const supplierId = firstSupplierId(state)
    const seed = supplierOfferSeed(supplierId)
    const view = supplierReliabilityCard.render(seed, state)
    expect(view.body[0]).toBeDefined()
    expect(view.body[1]).toBeDefined()
    expect(ESTABLISHING_LINE_TEXTS.has(view.body[0]!)).toBe(true)
    expect(REACTION_LINE_TEXTS.has(view.body[1]!)).toBe(true)
    expect(wordCount(view.body[0]!)).toBeLessThanOrEqual(14)
    expect(wordCount(view.body[1]!)).toBeLessThanOrEqual(12)
  })

  it('body never surfaces raw textIngredients fragments or the reliability stat readout', () => {
    const state = createInitialTavernState()
    const supplierId = firstSupplierId(state)
    const seed = supplierOfferSeed(supplierId)
    const view = supplierReliabilityCard.render(seed, state)
    for (const line of view.body) {
      expect(line).not.toBe('stacked crates')
      expect(line).not.toBe('tight handshake')
      expect(line).not.toBe('reliability 45')
      expect(line).not.toMatch(/reliability \d+/i)
    }
  })

  it('establishing_line picks the low-reliability snippet when supplier.reliability is in the low band', () => {
    const state = createInitialTavernState()
    const supplierId = firstSupplierId(state)
    const low = withSupplierReliability(state, supplierId, 25)
    const seed = supplierOfferSeed(supplierId, 'supplier-low-rel')
    const view = supplierReliabilityCard.render(seed, low)
    expect(view.body[0]).toBe('The goods come up short most weeks.')
  })

  it('establishing_line picks the high-reliability snippet when supplier.reliability is in the high band', () => {
    const state = createInitialTavernState()
    const supplierId = firstSupplierId(state)
    const high = withSupplierReliability(state, supplierId, 80)
    const seed = supplierOfferSeed(supplierId, 'supplier-high-rel')
    const view = supplierReliabilityCard.render(seed, high)
    expect(view.body[0]).toBe('Their wagons run steady; the loads always arrive whole.')
  })

  // Phase 146 / ISSUE-114 — Legible Surface arc, Phase 1. The supplier
  // card opens with reliability × relationship when both bands resolve.
  // Phase 149 / ISSUE-117 — Phase 4 added matrix-cell combo snippets at
  // spec 2 (`est_low_rel_low_rship`, etc.) that state BOTH facts as one
  // hand-authored line. The combo cell wins specificity over the spec-1
  // single-condition pair the multi-fact join would compose, so when a
  // corner cell is reachable the body[0] IS the combo — no ' — ' join
  // because the line itself already carries both facts.
  it('establishing line states both reliability AND relationship when both low bands resolve', () => {
    const state = createInitialTavernState()
    const supplierId = firstSupplierId(state)
    const both = withSupplierReliability(state, supplierId, 20, 20)
    const seed = supplierOfferSeed(supplierId, 'supplier-low-low')
    const view = supplierReliabilityCard.render(seed, both)
    // `est_low_rel_low_rship`: 'Both their goods and their goodwill come up short with us.'
    // "goods" surfaces the reliability fact; "goodwill" surfaces the
    // relationship fact. The line stays within `multiFactBudget` (28) by
    // a wide margin — it's a 12-word single snippet, not a join.
    expect(view.body[0]).toContain('come up short')
    expect(view.body[0]).toContain('goodwill')
    expect(wordCount(view.body[0]!)).toBeLessThanOrEqual(14)
  })

  it('multi-fact join still composes the pair when no combo cell exists (low rel × distrust rising state)', () => {
    // When low reliability resolves AND market_instability is rising (but
    // not supplier_distrust), no spec-2 combo covers that exact pair, so
    // the assembler falls back to multi-fact: it picks the salient
    // primary (covering reliability — index 0) and appends a secondary
    // covering market_instability (index 3) within budget. This proves
    // the multi-fact mechanism still works for non-authored combinations.
    const state = createInitialTavernState()
    const supplierId = firstSupplierId(state)
    const low = withSupplierReliability(state, supplierId, 20)
    const withMarketRising: TavernState = {
      ...low,
      pressures: {
        ...low.pressures,
        market_instability: {
          id: 'market_instability',
          label: 'market_instability',
          value: 40,
          trend: 1,
          tags: low.pressures.market_instability?.tags ?? [],
          topCauses: low.pressures.market_instability?.topCauses ?? [],
        },
      },
    }
    const seed = supplierOfferSeed(supplierId, 'supplier-low-market')
    const view = supplierReliabilityCard.render(seed, withMarketRising)
    // est_low_reliability + ' — ' + est_market_rising (or similar join).
    // Both fact substrings should appear; the join token should appear.
    expect(view.body[0]).toContain('come up short')
    expect(view.body[0]).toContain('market')
    expect(view.body[0]).toContain(' — ')
  })

  it('title centres on the supplier display and never truncates with "…"', () => {
    const state = createInitialTavernState()
    const supplierId = firstSupplierId(state)
    const seed = supplierOfferSeed(supplierId)
    const view = supplierReliabilityCard.render(seed, state)
    const display = state.world.suppliers[supplierId]!.name?.display ?? state.world.suppliers[supplierId]!.label
    expect(view.title.toLowerCase()).toContain(display.split(' ')[0]!.toLowerCase())
    expect(view.title).not.toContain('…')
    expect(view.title).not.toContain('...')
    const colonIdx = view.title.indexOf(':')
    expect(colonIdx).toBeGreaterThan(0)
    const after = view.title.slice(colonIdx + 1).trim()
    expect(TITLE_TEXTS.has(after)).toBe(true)
  })

  it('picks a two-axis reaction snippet when both extremes land', () => {
    const state = createInitialTavernState()
    const supplierId = firstSupplierId(state)
    const sharpCast: SupplierCastAttributes = {
      specialty: 'goods',
      blindspot: 'late_payment',
      affinities: [],
      voice: { axes: { terseness: 2, warmth: 0, formality: 1, floridity: 1 } },
    }
    const sharp = withSupplierCast(state, supplierId, sharpCast)
    const seed = supplierOfferSeed(supplierId, 'supplier-sharp')
    const view = supplierReliabilityCard.render(seed, sharp)
    expect(view.body[1]).toBe("Speak plain. I've a route to make.")
  })

  it('emits valid choices whose verbs are in seed.responseSlots.allowedVerbs', () => {
    const state = createInitialTavernState()
    const supplierId = firstSupplierId(state)
    const seed = supplierOfferSeed(supplierId)
    const view = supplierReliabilityCard.render(seed, state)
    expect(view.choices.length).toBeGreaterThan(0)
    for (const choice of view.choices) {
      const slot = seed.responseSlots.find((s) => s.id === choice.slotId)
      expect(slot, `slot ${choice.slotId} resolves`).toBeDefined()
      expect(slot!.allowedVerbs).toContain(choice.verb)
    }
  })

  it('preserves choice mechanical truth: verb, shape, targetId, preview count unchanged by composition', () => {
    const state = createInitialTavernState()
    const supplierId = firstSupplierId(state)
    const seed = supplierOfferSeed(supplierId)
    const view = supplierReliabilityCard.render(seed, state)
    for (const choice of view.choices) {
      const slot = seed.responseSlots.find((s) => s.id === choice.slotId)!
      const profile = seed.consequenceProfiles.find(
        (p) => p.responseSlotId === slot.id,
      )!
      expect(slot.allowedVerbs).toContain(choice.verb)
      expect(slot.shape).toBe(choice.shape)
      expect(choice.previewEffects.length).toBeLessThanOrEqual(2)
      expect(choice.previewEffects.length).toBeLessThanOrEqual(
        profile.immediateEffects.length,
      )
    }
  })

  it('tags and severity flow from the seed', () => {
    const state = createInitialTavernState()
    const supplierId = firstSupplierId(state)
    const seed = supplierOfferSeed(supplierId)
    const view = supplierReliabilityCard.render(seed, state)
    expect(view.tag).toBe('supplier_relationship')
    expect(view.severity).toBe(45)
  })

  it('is deterministic — same seed + state ⇒ identical CardView', () => {
    const state = createInitialTavernState()
    const supplierId = firstSupplierId(state)
    const seed = supplierOfferSeed(supplierId)
    const a = supplierReliabilityCard.render(seed, state)
    const b = supplierReliabilityCard.render(seed, structuredClone(state) as TavernState)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('does not mutate state', () => {
    const state = createInitialTavernState()
    const supplierId = firstSupplierId(state)
    const seed = supplierOfferSeed(supplierId)
    const before = JSON.stringify(state)
    supplierReliabilityCard.render(seed, state)
    expect(JSON.stringify(state)).toBe(before)
  })
})

// Phase 148 / ISSUE-116 — Legible Surface arc, Phase 3. The eleven-slot
// supplier seed is the canonical worst case for both Layer C (cap) and
// Layer D (label distinctness). These tests use a real eleven-slot seed
// shaped like `expandedSeedGenerators.ts:1189-1280` to assert end-to-end
// that the cap caps and the new slot-distinct snippets disambiguate.
function elevenSlotSupplierOfferSeed(supplierId: string): IssueSeed {
  const ref: EntityRef = supplierRef(supplierId)
  const goodsRef: EntityRef = { kind: 'stock', id: 'good_basic_grain' }
  return makeSeed({
    id: 'eleven-slot-supplier-seed',
    family: 'supplier_relationship' as IssueSeedFamilyId,
    type: 'supplier_offer',
    timing: 'morning_prep',
    severity: 45,
    domain: ['suppliers', 'market', 'stock'],
    primaryActor: ref,
    responseSlots: [
      { id: 'pay_supplier', labelHint: 'Pay supplier', allowedVerbs: ['pay'], shape: 'safe_costly', targetOptions: [ref], expectedEffects: [] },
      { id: 'negotiate_supplier', labelHint: 'Negotiate', allowedVerbs: ['negotiate'], shape: 'compromise', targetOptions: [ref], expectedEffects: [] },
      { id: 'blame_supplier', labelHint: 'Blame supplier', allowedVerbs: ['blame'], shape: 'relationship_sacrifice', targetOptions: [ref], expectedEffects: [] },
      { id: 'switch_supplier', labelHint: 'Switch supplier', allowedVerbs: ['fire'], shape: 'long_term_investment', targetOptions: [ref], expectedEffects: [] },
      { id: 'accept_suspicious_goods', labelHint: 'Accept suspicious goods', allowedVerbs: ['buy'], shape: 'risky_profitable', targetOptions: [goodsRef], expectedEffects: [] },
      { id: 'refuse_supplier_offer', labelHint: 'Refuse the offer', allowedVerbs: ['ignore'], shape: 'safe_costly', targetOptions: [ref], expectedEffects: [] },
      { id: 'place_standing_order', labelHint: 'Place a standing order', allowedVerbs: ['buy', 'negotiate'], shape: 'safe_costly', targetOptions: [ref], expectedEffects: [] },
      { id: 'inspect_delivery', labelHint: 'Inspect delivery', allowedVerbs: ['inspect'], shape: 'compromise', targetOptions: [ref, goodsRef], expectedEffects: [] },
      { id: 'split_orders', labelHint: 'Split orders', allowedVerbs: ['buy', 'negotiate'], shape: 'long_term_investment', targetOptions: [ref], expectedEffects: [] },
      { id: 'supplier_exclusivity_deal', labelHint: 'Sign exclusivity', allowedVerbs: ['negotiate', 'buy'], shape: 'risky_profitable', targetOptions: [ref], expectedEffects: [] },
      { id: 'investigate_suspicious_goods', labelHint: 'Investigate goods', allowedVerbs: ['inspect', 'discard'], shape: 'safe_costly', targetOptions: [ref, goodsRef], expectedEffects: [] },
    ],
    consequenceProfiles: [
      { id: 'pay_supplier_p', responseSlotId: 'pay_supplier', immediateEffects: [{ kind: 'cause', target: `supplier:${supplierId}`, amount: 10, readable: 'Supplier paid', tags: ['supplier', 'attribution'], targetKind: 'supplier', direction: 'positive', magnitudeBand: 'medium' }], delayedEffects: [], memories: [], futureHooks: [], impactScore: 5 },
      { id: 'negotiate_p', responseSlotId: 'negotiate_supplier', immediateEffects: [{ kind: 'cause', target: `supplier:${supplierId}`, amount: 12, readable: 'Negotiated', tags: ['supplier', 'attribution'], targetKind: 'supplier', direction: 'positive', magnitudeBand: 'medium' }], delayedEffects: [], memories: [], futureHooks: [], impactScore: 5 },
      { id: 'blame_p', responseSlotId: 'blame_supplier', immediateEffects: [{ kind: 'cause', target: `supplier:${supplierId}`, amount: -10, readable: 'Blamed', tags: ['supplier', 'attribution'], targetKind: 'supplier', direction: 'negative', magnitudeBand: 'medium' }], delayedEffects: [], memories: [], futureHooks: [], impactScore: 5 },
      { id: 'switch_p', responseSlotId: 'switch_supplier', immediateEffects: [{ kind: 'cause', target: `supplier:${supplierId}`, amount: -20, readable: 'Switched', tags: ['supplier', 'attribution'], targetKind: 'supplier', direction: 'negative', magnitudeBand: 'large' }], delayedEffects: [], memories: [], futureHooks: [], impactScore: 5 },
      { id: 'accept_p', responseSlotId: 'accept_suspicious_goods', immediateEffects: [{ kind: 'state_change', target: 'stock', amount: 10, readable: 'Got cheap stock', tags: ['stock'], targetKind: 'stock', direction: 'positive', magnitudeBand: 'medium' }], delayedEffects: [], memories: [], futureHooks: [], impactScore: 5 },
      { id: 'refuse_p', responseSlotId: 'refuse_supplier_offer', immediateEffects: [], delayedEffects: [{ kind: 'cause', target: `supplier:${supplierId}`, amount: -3, readable: 'They look elsewhere', tags: ['supplier', 'attribution'], targetKind: 'supplier', direction: 'negative', magnitudeBand: 'tiny' }], memories: [], futureHooks: [], impactScore: 2 },
      { id: 'standing_p', responseSlotId: 'place_standing_order', immediateEffects: [{ kind: 'cause', target: `supplier:${supplierId}`, amount: 8, readable: 'Standing order', tags: ['supplier', 'attribution'], targetKind: 'supplier', direction: 'positive', magnitudeBand: 'small' }], delayedEffects: [], memories: [], futureHooks: [], impactScore: 4 },
      { id: 'inspect_p', responseSlotId: 'inspect_delivery', immediateEffects: [{ kind: 'cause', target: `supplier:${supplierId}`, amount: 3, readable: 'Inspected', tags: ['supplier', 'attribution'], targetKind: 'supplier', direction: 'positive', magnitudeBand: 'tiny' }], delayedEffects: [], memories: [], futureHooks: [], impactScore: 3 },
      { id: 'split_p', responseSlotId: 'split_orders', immediateEffects: [{ kind: 'cause', target: `supplier:${supplierId}`, amount: -3, readable: 'Split orders', tags: ['supplier', 'attribution'], targetKind: 'supplier', direction: 'negative', magnitudeBand: 'tiny' }], delayedEffects: [], memories: [], futureHooks: [], impactScore: 4 },
      { id: 'exclusivity_p', responseSlotId: 'supplier_exclusivity_deal', immediateEffects: [{ kind: 'cause', target: `supplier:${supplierId}`, amount: 15, readable: 'Exclusivity locked', tags: ['supplier', 'attribution'], targetKind: 'supplier', direction: 'positive', magnitudeBand: 'large' }], delayedEffects: [], memories: [], futureHooks: [], impactScore: 6 },
      { id: 'investigate_p', responseSlotId: 'investigate_suspicious_goods', immediateEffects: [{ kind: 'cause', target: `supplier:${supplierId}`, amount: 5, readable: 'Investigated', tags: ['supplier', 'attribution'], targetKind: 'supplier', direction: 'positive', magnitudeBand: 'small' }], delayedEffects: [], memories: [], futureHooks: [], impactScore: 3 },
    ],
    textIngredients: {
      subject: 'a supply dispute',
      sensoryDetails: ['stacked crates', 'tight handshake'],
      recentContext: ['reliability 45'],
    },
  })
}

describe('supplierReliabilityCard — Phase 148 cap & distinctness', () => {
  it('caps an 11-slot supplier seed to 6 rendered choices (DEFAULT_LEGIBLE_CHOICE_CAP)', () => {
    const state = createInitialTavernState()
    const supplierId = firstSupplierId(state)
    const seed = elevenSlotSupplierOfferSeed(supplierId)
    const view = supplierReliabilityCard.render(seed, state)
    // 11 slots ⇒ cap of 6. `accept_suspicious_goods` only touches the
    // `stock` meter, which the `supplier_relationship` salience table
    // doesn't cover — so it scores Infinity and ranks last, dropping
    // out of the cap. Every other slot touches `supplier:X` (signal
    // index 0 or 1) and scores 0 — those ten resolve by original
    // index, giving us the first six in seed order. `refuse_supplier_offer`
    // (inaction) is at original index 5 ⇒ already in the cap ⇒ no append.
    expect(view.choices.length).toBe(6)
    expect(view.choices.map((c) => c.slotId)).toEqual([
      'pay_supplier',
      'negotiate_supplier',
      'blame_supplier',
      'switch_supplier',
      'refuse_supplier_offer',
      'place_standing_order',
    ])
  })

  it('renders distinct labels for the same-verb collision pairs (Layer D)', () => {
    // A terse-cold supplier: `terseness 2` activates the
    // `label_negotiate_terse` "Cut the terms shorter" snippet for any
    // slot with first verb `negotiate`. Pre-Phase 148 both
    // `negotiate_supplier` and `supplier_exclusivity_deal` rendered
    // that same text. The new Layer-D `responseSlot`-gated snippets
    // out-rank it for `supplier_exclusivity_deal`.
    const state = createInitialTavernState()
    const supplierId = firstSupplierId(state)
    const terseCold: SupplierCastAttributes = {
      specialty: 'goods',
      blindspot: 'late_payment',
      affinities: [],
      voice: { axes: { terseness: 2, warmth: 0, formality: 1, floridity: 0 } },
    }
    const installed = withSupplierCast(state, supplierId, terseCold)
    // To get both `negotiate_supplier` and `supplier_exclusivity_deal`
    // into the rendered set we need a larger cap than 6, since the
    // exclusivity slot is at original index 9. Use the explicit
    // maxChoices override via a wrapping render. The supplier card
    // template doesn't expose `maxChoices`, so we exercise the
    // `composeChoicesFromSeed` helper directly with the supplier
    // pools — same call shape the template uses.
    const seed = elevenSlotSupplierOfferSeed(supplierId)
    const choices = composeChoicesFromSeed(seed, installed, {
      labelPool: supplierReliabilityChoiceLabelPool,
      previewPool: supplierReliabilityEffectPreviewPool,
      maxPreview: 2,
      maxChoices: 11,
    })
    // All eleven slots rendered ⇒ all labels distinct after Layer D.
    const labels = choices.map((c) => c.label)
    const uniqueLabels = new Set(labels)
    expect(uniqueLabels.size).toBe(labels.length)
    // Specifically: the two same-verb pairs render distinctly.
    const labelBySlot = new Map(choices.map((c) => [c.slotId, c.label]))
    expect(labelBySlot.get('negotiate_supplier')).not.toBe(
      labelBySlot.get('supplier_exclusivity_deal'),
    )
    expect(labelBySlot.get('place_standing_order')).not.toBe(
      labelBySlot.get('split_orders'),
    )
    expect(labelBySlot.get('inspect_delivery')).not.toBe(
      labelBySlot.get('investigate_suspicious_goods'),
    )
  })

  it('preserves mechanical mapping after capping (slotId / verb / shape unchanged)', () => {
    const state = createInitialTavernState()
    const supplierId = firstSupplierId(state)
    const seed = elevenSlotSupplierOfferSeed(supplierId)
    const view = supplierReliabilityCard.render(seed, state)
    for (const choice of view.choices) {
      const slot = seed.responseSlots.find((s) => s.id === choice.slotId)
      expect(slot).toBeDefined()
      expect(slot!.allowedVerbs).toContain(choice.verb)
      expect(slot!.shape).toBe(choice.shape)
    }
  })

  it('re-render stability — same seed ⇒ same capped choice set', () => {
    const state = createInitialTavernState()
    const supplierId = firstSupplierId(state)
    const seed = elevenSlotSupplierOfferSeed(supplierId)
    const a = supplierReliabilityCard.render(seed, state)
    const b = supplierReliabilityCard.render(seed, state)
    expect(a.choices.map((c) => c.slotId)).toEqual(
      b.choices.map((c) => c.slotId),
    )
    expect(a.choices.map((c) => c.label)).toEqual(
      b.choices.map((c) => c.label),
    )
  })
})

describe('supplierReliabilityCard — voice variance across three profiles', () => {
  it('produces three distinct reaction lines for three distinct voices', () => {
    const state = createInitialTavernState()
    const supplierId = firstSupplierId(state)
    const base = {
      specialty: 'goods',
      blindspot: 'late_payment',
      affinities: [],
    }
    const profiles: SupplierCastAttributes[] = [
      { ...base, voice: { axes: { terseness: 2, warmth: 0, formality: 1, floridity: 1 } } },
      { ...base, voice: { axes: { terseness: 1, warmth: 2, formality: 0, floridity: 1 } } },
      {
        ...base,
        voice: {
          axes: { terseness: 1, warmth: 1, formality: 1, floridity: 1 },
          verbalTic: 'qualifies_everything',
        },
      },
    ]
    const reactions = profiles.map((cast, i) => {
      const installed = withSupplierCast(state, supplierId, cast)
      const view = supplierReliabilityCard.render(
        supplierOfferSeed(supplierId, `variance-${i}`),
        installed,
      )
      return view.body[1]
    })
    expect(new Set(reactions).size).toBe(3)
  })
})
