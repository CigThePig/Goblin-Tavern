// Phase 123 / ISSUE-092 — Living Cast arc, Phase C.
//
// Integration tests for `drinkOrderCard` — the first compositional card.
// Proves the runtime end-to-end: a real seed with a real regular renders
// a composed CardView whose title is one of the committed `order_line`
// snippet texts, whose body grounds the order in seed ingredients, and
// whose choices project the seed's response slots. Graceful degradation
// when castAttributes is missing is the other load-bearing property.

import { describe, expect, it } from 'vitest'

import {
  drinkOrderCard,
  regularComplaintCard,
  fallbackCard,
} from '../../src/cards/index'
import { pickCardForSeed } from '../../src/cards/selection'
import { orderLinePool } from '../../src/cards/compose/pools/drinkOrder'
import { REQUIRED_CARDS } from '../../src/cards/templates/index'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import type { CastAttributes } from '../../src/sim/content/cast'
import type {
  IssueSeed,
  IssueSeedFamilyId,
} from '../../src/sim/modules/issues/issueSeedTypes'
import type {
  EntityRef,
  TavernState,
} from '../../src/sim/state/TavernState'
import { makeSeed } from './cardFactories'

function firstRegularId(state: TavernState): string {
  const id = Object.keys(state.world.regulars)[0]
  if (!id) throw new Error('test setup expects at least one starter regular')
  return id
}

function withCast(
  state: TavernState,
  regularId: string,
  cast: CastAttributes,
): TavernState {
  return {
    ...state,
    world: {
      ...state.world,
      regulars: {
        ...state.world.regulars,
        [regularId]: {
          ...state.world.regulars[regularId]!,
          castAttributes: cast,
        },
      },
    },
  }
}

function regularRef(id: string): EntityRef {
  return { kind: 'regular', id }
}

function drinkOrderSeed(regularId: string, id = 'drink-order-seed'): IssueSeed {
  return makeSeed({
    id,
    family: 'regular_customer' as IssueSeedFamilyId,
    type: 'relationship_test',
    timing: 'during_service',
    severity: 35,
    domain: ['regulars', 'customers', 'social'],
    primaryActor: regularRef(regularId),
    responseSlots: [
      {
        id: `${id}-slot-appease`,
        labelHint: 'Smooth it over',
        allowedVerbs: ['appease'],
        shape: 'safe_costly',
        targetOptions: [regularRef(regularId)],
        expectedEffects: ['irritation -5'],
      },
      {
        id: `${id}-slot-ignore`,
        labelHint: 'Let it ride',
        allowedVerbs: ['ignore'],
        shape: 'ignore',
        targetOptions: [],
        expectedEffects: ['nothing changes'],
      },
    ],
    consequenceProfiles: [
      {
        id: `${id}-profile-a`,
        responseSlotId: `${id}-slot-appease`,
        immediateEffects: [
          {
            kind: 'state_change',
            target: `world.regulars.${regularId}.irritation`,
            amount: -5,
            readable: 'the regular settles',
            tags: ['regulars'],
          },
        ],
        delayedEffects: [],
        memories: [],
        futureHooks: [],
        impactScore: 4,
      },
      {
        id: `${id}-profile-b`,
        responseSlotId: `${id}-slot-ignore`,
        immediateEffects: [
          {
            kind: 'state_change',
            target: 'noop',
            amount: 0,
            readable: 'nothing happens',
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
      subject: 'asks for ale',
      sensoryDetails: ['stools scrape back as they settle'],
      recentContext: ['second visit this week'],
    },
  })
}

const ORDER_LINE_TEXTS = new Set(orderLinePool.snippets.map((s) => s.text))

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length
}

describe('drinkOrderCard — appliesTo', () => {
  const state = createInitialTavernState()
  const regularId = firstRegularId(state)

  it('is registered in REQUIRED_CARDS', () => {
    expect(REQUIRED_CARDS).toContain(drinkOrderCard)
  })

  it('matches a regular_customer / relationship_test / during_service seed with a regular actor', () => {
    const seed = drinkOrderSeed(regularId)
    const chosen = pickCardForSeed(seed, state, REQUIRED_CARDS)
    expect(chosen?.id).toBe(drinkOrderCard.id)
  })

  // Phase 134 / ISSUE-103 — Voiced Surface arc, Phase 8.
  // regular_customer / complaint now routes to regularComplaintCard
  // (the new compositional template); previously it went to the legacy
  // customerComplaintCard, which Phase 8 split by family.
  it('does not steal the complaint variant from regularComplaintCard', () => {
    const seed = makeSeed({
      id: 'complaint-seed',
      family: 'regular_customer' as IssueSeedFamilyId,
      type: 'complaint',
      timing: 'during_service',
      primaryActor: regularRef(regularId),
    })
    const chosen = pickCardForSeed(seed, state, REQUIRED_CARDS)
    expect(chosen?.id).toBe(regularComplaintCard.id)
  })

  it('declines a seed whose actor has no cast attributes — fallback handles it', () => {
    // Strip cast attributes off the regular. The drinkOrderCard's custom
    // predicate insists on a populated CastAttributes; without it, the
    // template steps aside and the fallback (or another card) renders.
    const original = state.world.regulars[regularId]!
    const { castAttributes: _strip, ...rest } = original
    void _strip
    const castless: TavernState = {
      ...state,
      world: {
        ...state.world,
        regulars: { ...state.world.regulars, [regularId]: rest },
      },
    }
    const seed = drinkOrderSeed(regularId)
    const chosen = pickCardForSeed(seed, castless, REQUIRED_CARDS)
    // No other higher-priority card claims this exact shape, so the
    // fallback wins. The point is that drinkOrderCard does NOT.
    expect(chosen?.id).not.toBe(drinkOrderCard.id)
    expect(chosen?.id).toBe(fallbackCard.id)
  })
})

describe('drinkOrderCard — render output', () => {
  // Phase 169 / ISSUE-137 — Complete Surface arc, Phase 2 (drinkOrder
  // Parity). The body is now [establishing_line, order_line, manner_note?]:
  // body[0] is the sim-backed establishing line, body[1] is the voiced
  // order_line. The raw recentContext splice is gone.
  it('body[1] is one of the committed order_line snippet texts', () => {
    const state = createInitialTavernState()
    const regularId = firstRegularId(state)
    const seed = drinkOrderSeed(regularId)
    const view = drinkOrderCard.render(seed, state)
    expect(view.body[1]).toBeDefined()
    expect(ORDER_LINE_TEXTS.has(view.body[1]!)).toBe(true)
    // The order_line still respects the 12-word ingredient budget.
    expect(wordCount(view.body[1]!)).toBeLessThanOrEqual(12)
    // body[0] is the sim-backed establishing line (≤ 14-word budget),
    // not an order_line snippet.
    expect(view.body[0]).toBeDefined()
    expect(ORDER_LINE_TEXTS.has(view.body[0]!)).toBe(false)
    expect(wordCount(view.body[0]!)).toBeLessThanOrEqual(14)
  })

  it('title centres on the named regular and never truncates with "…"', () => {
    const state = createInitialTavernState()
    const regularId = firstRegularId(state)
    const seed = drinkOrderSeed(regularId)
    const view = drinkOrderCard.render(seed, state)
    const display = state.world.regulars[regularId]!.name.display
    // Phase 131 / ISSUE-100 — title is a composed slot with the
    // display name prepended by template glue, no clamping. The actor
    // identification survives in full; total length may run past six
    // words for long display names but never carries "…" / "...".
    expect(view.title.toLowerCase()).toContain(display.split(' ')[0]!.toLowerCase())
    expect(view.title).not.toContain('…')
    expect(view.title).not.toContain('...')
  })

  it('renders the same title for the same seed (compositional determinism)', () => {
    const state = createInitialTavernState()
    const regularId = firstRegularId(state)
    const seed = drinkOrderSeed(regularId)
    const a = drinkOrderCard.render(seed, state)
    const b = drinkOrderCard.render(seed, state)
    expect(a.title).toBe(b.title)
  })

  it('falls back to the unconditional snippet when no axes match', () => {
    const state = createInitialTavernState()
    const regularId = firstRegularId(state)
    // Force the regular onto neutral axes (1 across the board, no tic)
    // so no specific snippet's conditions can match.
    const neutral: CastAttributes = {
      specialty: 'gossip',
      blindspot: 'war_story',
      affinities: [],
      voice: {
        axes: { terseness: 1, warmth: 1, formality: 1, floridity: 1 },
      },
    }
    const flat = withCast(state, regularId, neutral)
    const seed = drinkOrderSeed(regularId)
    const view = drinkOrderCard.render(seed, flat)
    // Phase 169 / ISSUE-137 — the order_line is body[1] now; with neutral
    // axes it falls back to the unconditional snippet.
    expect(view.body[1]).toBe('An ale, please. Whatever the house recommends.')
  })

  it('picks a two-axis snippet when both extremes land', () => {
    const state = createInitialTavernState()
    const regularId = firstRegularId(state)
    // terseness=2 AND warmth=0 — only `order_terse_cold` should win
    // (specificity 2; no other top-rung snippet matches this profile).
    const cast: CastAttributes = {
      specialty: 'gossip',
      blindspot: 'war_story',
      affinities: [],
      voice: {
        axes: { terseness: 2, warmth: 0, formality: 1, floridity: 1 },
      },
    }
    const sharp = withCast(state, regularId, cast)
    const seed = drinkOrderSeed(regularId, 'drink-sharp')
    const view = drinkOrderCard.render(seed, sharp)
    // Phase 169 / ISSUE-137 — body[0] is the sim-backed establishing
    // line; the voiced order_line shifts to body[1] and its companion
    // manner_note to body[2].
    expect(view.body[1]).toBe('Ale. Cold. No speech with it.')
    // The manner_note `manner_cold_coin` fires on the same conditions,
    // landing as the third body line.
    expect(view.body[2]).toBe('They tap two coins once.')
  })

  it('emits valid choices whose verbs are in seed.responseSlots.allowedVerbs', () => {
    const state = createInitialTavernState()
    const regularId = firstRegularId(state)
    const seed = drinkOrderSeed(regularId)
    const view = drinkOrderCard.render(seed, state)
    expect(view.choices.length).toBeGreaterThan(0)
    for (const choice of view.choices) {
      const slot = seed.responseSlots.find((s) => s.id === choice.slotId)
      expect(slot, `slot ${choice.slotId} resolves`).toBeDefined()
      expect(slot!.allowedVerbs).toContain(choice.verb)
    }
  })

  it('tags and severity flow from the seed', () => {
    const state = createInitialTavernState()
    const regularId = firstRegularId(state)
    const seed = drinkOrderSeed(regularId)
    const view = drinkOrderCard.render(seed, state)
    expect(view.tag).toBe('regular_customer')
    expect(view.severity).toBe(35)
  })

  it('is deterministic — same seed + state ⇒ identical CardView', () => {
    const state = createInitialTavernState()
    const regularId = firstRegularId(state)
    const seed = drinkOrderSeed(regularId)
    const a = drinkOrderCard.render(seed, state)
    const b = drinkOrderCard.render(seed, structuredClone(state) as TavernState)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('does not mutate state', () => {
    const state = createInitialTavernState()
    const regularId = firstRegularId(state)
    const seed = drinkOrderSeed(regularId)
    const before = JSON.stringify(state)
    drinkOrderCard.render(seed, state)
    expect(JSON.stringify(state)).toBe(before)
  })
})
