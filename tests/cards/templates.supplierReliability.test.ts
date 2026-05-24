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
  supplierReliabilityEstablishingLinePool,
  supplierReliabilityReactionLinePool,
  supplierReliabilityTitlePool,
} from '../../src/cards/compose/pools/supplierReliability'
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
  // The establishing slot is opted into `saliencePolicy: 'multi'`; the
  // assembler picks the reliability-covering snippet as primary and
  // appends the relationship-covering snippet via the ' — ' join.
  it('multi-fact establishing line states both reliability AND relationship when both bands resolve', () => {
    const state = createInitialTavernState()
    const supplierId = firstSupplierId(state)
    const both = withSupplierReliability(state, supplierId, 20, 20)
    const seed = supplierOfferSeed(supplierId, 'supplier-low-low')
    const view = supplierReliabilityCard.render(seed, both)
    expect(view.body[0]).toContain('come up short') // reliability fact
    expect(view.body[0]).toContain('old cold') // relationship fact
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
