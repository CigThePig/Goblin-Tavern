// Phase 134 / ISSUE-103 — Voiced Surface arc, Phase 8 (Regulars & Complaints).
//
// Integration tests for `regularComplaintCard` — the first half of
// the Phase 8 cluster (the cohort case is `customerComplaintCard`).
// Mirrors `templates.staffBurnout.test.ts` shape; the load-bearing
// properties are: sim-backed establishing_line fires first, voiced
// reaction_line follows, choices project the seed's response slots
// mechanically unchanged, graceful degradation when castAttributes is
// missing, stable re-render.

import { describe, expect, it } from 'vitest'

import {
  regularComplaintCard,
  drinkOrderCard,
  fallbackCard,
} from '../../src/cards/index'
import { pickCardForSeed } from '../../src/cards/selection'
import {
  regularComplaintEstablishingLinePool,
  regularComplaintReactionLinePool,
} from '../../src/cards/compose/pools/regularComplaint'
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

function withIrritation(
  state: TavernState,
  regularId: string,
  irritation: number,
): TavernState {
  return {
    ...state,
    world: {
      ...state.world,
      regulars: {
        ...state.world.regulars,
        [regularId]: {
          ...state.world.regulars[regularId]!,
          irritation,
        },
      },
    },
  }
}

// Phase 151 / ISSUE-119 — hold loyalty at the mid band so a test that
// only intends to vary irritation isn't pulled into the new corner-
// combo or multi-fact rungs (starter regulars carry loyalty 58-72; the
// first is `local_goblins_1` at 72 = high, so high-irritation tests
// would resolve `est_high_irritation_high_loyalty` instead of the
// single-condition snippet they pre-Phase-6 expected).
function withLoyalty(
  state: TavernState,
  regularId: string,
  loyalty: number,
): TavernState {
  return {
    ...state,
    world: {
      ...state.world,
      regulars: {
        ...state.world.regulars,
        [regularId]: {
          ...state.world.regulars[regularId]!,
          loyalty,
        },
      },
    },
  }
}

function regularRef(id: string): EntityRef {
  return { kind: 'regular', id }
}

function regularComplaintSeed(
  regularId: string,
  id = 'regular-complaint-seed',
): IssueSeed {
  return makeSeed({
    id,
    family: 'regular_customer' as IssueSeedFamilyId,
    type: 'complaint',
    timing: 'during_service',
    severity: 60,
    domain: ['regulars', 'customers', 'social'],
    primaryActor: regularRef(regularId),
    responseSlots: [
      {
        id: `${id}-slot-appease`,
        labelHint: `Apologise to the regular`,
        allowedVerbs: ['appease'],
        shape: 'safe_costly',
        targetOptions: [regularRef(regularId)],
        expectedEffects: ['raise loyalty', 'time cost'],
      },
      {
        id: `${id}-slot-ignore`,
        labelHint: 'Ignore the regular',
        allowedVerbs: ['ignore'],
        shape: 'ignore',
        targetOptions: [],
        expectedEffects: ['no cost', 'raise regular loss pressure'],
      },
    ],
    consequenceProfiles: [
      {
        id: `${id}-profile-appease`,
        responseSlotId: `${id}-slot-appease`,
        immediateEffects: [
          {
            kind: 'cause',
            target: `regular:${regularId}`,
            amount: 8,
            readable: 'loyalty rises',
            tags: ['regular'],
          },
        ],
        delayedEffects: [],
        memories: [],
        futureHooks: [],
        impactScore: 5,
      },
      {
        id: `${id}-profile-ignore`,
        responseSlotId: `${id}-slot-ignore`,
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
      subject: 'looks ready to leave',
      problemNoun: 'sour mood',
      sensoryDetails: ['half-empty mug', 'cold stare'],
      actorOpinions: { [regularId]: 'looks ready to leave' },
      recentContext: ['irritation 75'],
    },
  })
}

const ESTABLISHING_LINE_TEXTS = new Set(
  regularComplaintEstablishingLinePool.snippets.map((s) => s.text),
)
const REACTION_LINE_TEXTS = new Set(
  regularComplaintReactionLinePool.snippets.map((s) => s.text),
)

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length
}

describe('regularComplaintCard — appliesTo', () => {
  const state = createInitialTavernState()
  const regularId = firstRegularId(state)

  it('is registered in REQUIRED_CARDS', () => {
    expect(REQUIRED_CARDS).toContain(regularComplaintCard)
  })

  it('matches a regular_customer / complaint / during_service seed with a regular actor', () => {
    const seed = regularComplaintSeed(regularId)
    const chosen = pickCardForSeed(seed, state, REQUIRED_CARDS)
    expect(chosen?.id).toBe(regularComplaintCard.id)
  })

  it('declines a seed whose actor has no cast attributes — fallback handles it', () => {
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
    const seed = regularComplaintSeed(regularId)
    const chosen = pickCardForSeed(seed, castless, REQUIRED_CARDS)
    expect(chosen?.id).not.toBe(regularComplaintCard.id)
    expect(chosen?.id).toBe(fallbackCard.id)
  })

  it('does not match regular_customer / relationship_test (that is drinkOrder territory)', () => {
    const seed = makeSeed({
      id: 'regular-relationship-not-complaint',
      family: 'regular_customer' as IssueSeedFamilyId,
      type: 'relationship_test',
      timing: 'during_service',
      primaryActor: regularRef(regularId),
    })
    const chosen = pickCardForSeed(seed, state, REQUIRED_CARDS)
    expect(chosen?.id).not.toBe(regularComplaintCard.id)
    expect(chosen?.id).toBe(drinkOrderCard.id)
  })

  it('does not match customer_complaint family (that is customerComplaint territory)', () => {
    const seed = makeSeed({
      id: 'cohort-not-regular',
      family: 'customer_complaint' as IssueSeedFamilyId,
      type: 'complaint',
      timing: 'during_service',
    })
    expect(regularComplaintCard.appliesTo.seedFamilies).not.toContain(
      'customer_complaint',
    )
    void seed
  })
})

describe('regularComplaintCard — render output', () => {
  it('body[0] is the sim-backed establishing line; body[1] is the voiced reaction', () => {
    const state = createInitialTavernState()
    const regularId = firstRegularId(state)
    const seed = regularComplaintSeed(regularId)
    const view = regularComplaintCard.render(seed, state)
    expect(view.body[0]).toBeDefined()
    expect(view.body[1]).toBeDefined()
    expect(ESTABLISHING_LINE_TEXTS.has(view.body[0]!)).toBe(true)
    expect(REACTION_LINE_TEXTS.has(view.body[1]!)).toBe(true)
    expect(wordCount(view.body[0]!)).toBeLessThanOrEqual(14)
    expect(wordCount(view.body[1]!)).toBeLessThanOrEqual(12)
  })

  it('body never surfaces raw textIngredients fragments', () => {
    const state = createInitialTavernState()
    const regularId = firstRegularId(state)
    const seed = regularComplaintSeed(regularId)
    const view = regularComplaintCard.render(seed, state)
    // The legacy template lifted these as body lines; the new template
    // composes through pools instead.
    for (const line of view.body) {
      expect(line).not.toBe('looks ready to leave')
      expect(line).not.toBe('half-empty mug')
      expect(line).not.toBe('cold stare')
      expect(line).not.toBe('irritation 75')
      // No raw "irritation X, loyalty Y" meter line either.
      expect(line).not.toMatch(/irritation \d+, loyalty \d+/)
    }
  })

  it('title centres on the named regular and never truncates with "…"', () => {
    const state = createInitialTavernState()
    const regularId = firstRegularId(state)
    const seed = regularComplaintSeed(regularId)
    const view = regularComplaintCard.render(seed, state)
    const display = state.world.regulars[regularId]!.name.display
    expect(view.title.toLowerCase()).toContain(display.split(' ')[0]!.toLowerCase())
    expect(view.title).not.toContain('…')
    expect(view.title).not.toContain('...')
    // Subject==label duplication is impossible here because the title
    // pool snippets never restate the display name.
    const titleWithoutDisplay = view.title
      .toLowerCase()
      .replace(display.toLowerCase(), '')
    expect(titleWithoutDisplay.toLowerCase()).not.toContain(display.toLowerCase())
  })

  it('falls back to the unconditional snippets when no axes match', () => {
    const state = createInitialTavernState()
    const regularId = firstRegularId(state)
    const neutral: CastAttributes = {
      specialty: 'gossip',
      blindspot: 'war_story',
      affinities: [],
      voice: { axes: { terseness: 1, warmth: 1, formality: 1, floridity: 1 } },
    }
    const flat = withCast(state, regularId, neutral)
    const seed = regularComplaintSeed(regularId)
    const view = regularComplaintCard.render(seed, flat)
    // Starter regular has irritation=0, loyalty=50 → both signals
    // resolve to band 'mid' / 'mid', and no memory tags or pressures
    // are active in the starter state. Without an axis match, both
    // slots fall back.
    expect(view.body[0]).toBe('A regular leans forward at their usual table.')
    expect(view.body[1]).toBe('I came in for warmth. The bench is cold today.')
  })

  it('picks a sim-backed snippet when the regular has high irritation (loyalty mid)', () => {
    const state = createInitialTavernState()
    const regularId = firstRegularId(state)
    // Hold loyalty mid so the single-condition `est_high_irritation`
    // snippet wins specificity — the Phase-6 corner combos
    // (est_high_irritation_high_loyalty / _low_loyalty) only fire when
    // loyalty also resolves to low or high.
    const angry = withIrritation(withLoyalty(state, regularId, 50), regularId, 85)
    const seed = regularComplaintSeed(regularId, 'high-irritation')
    const view = regularComplaintCard.render(seed, angry)
    expect(view.body[0]).toBe('Their patience snapped a quarter-hour back.')
  })

  it('picks a two-axis snippet when both extremes land', () => {
    const state = createInitialTavernState()
    const regularId = firstRegularId(state)
    const cast: CastAttributes = {
      specialty: 'gossip',
      blindspot: 'war_story',
      affinities: [],
      voice: { axes: { terseness: 2, warmth: 0, formality: 1, floridity: 1 } },
    }
    const sharp = withCast(state, regularId, cast)
    const seed = regularComplaintSeed(regularId, 'regular-sharp')
    const view = regularComplaintCard.render(seed, sharp)
    expect(view.body[1]).toBe("Fix it or I'm done here.")
    // The manner_note `mnr_terse_cold` fires on the same conditions.
    expect(view.body[2]).toBe('They fold their arms and wait.')
  })

  it('emits valid choices whose verbs are in seed.responseSlots.allowedVerbs', () => {
    const state = createInitialTavernState()
    const regularId = firstRegularId(state)
    const seed = regularComplaintSeed(regularId)
    const view = regularComplaintCard.render(seed, state)
    expect(view.choices.length).toBeGreaterThan(0)
    for (const choice of view.choices) {
      const slot = seed.responseSlots.find((s) => s.id === choice.slotId)
      expect(slot, `slot ${choice.slotId} resolves`).toBeDefined()
      expect(slot!.allowedVerbs).toContain(choice.verb)
    }
  })

  it('preserves choice mechanical truth: verb, shape, targetId, preview count unchanged by composition', () => {
    const state = createInitialTavernState()
    const regularId = firstRegularId(state)
    const seed = regularComplaintSeed(regularId)
    const view = regularComplaintCard.render(seed, state)
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
    const regularId = firstRegularId(state)
    const seed = regularComplaintSeed(regularId)
    const view = regularComplaintCard.render(seed, state)
    expect(view.tag).toBe('regular_customer')
    expect(view.severity).toBe(60)
  })

  it('is deterministic — same seed + state ⇒ identical CardView', () => {
    const state = createInitialTavernState()
    const regularId = firstRegularId(state)
    const seed = regularComplaintSeed(regularId)
    const a = regularComplaintCard.render(seed, state)
    const b = regularComplaintCard.render(seed, structuredClone(state) as TavernState)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('does not mutate state', () => {
    const state = createInitialTavernState()
    const regularId = firstRegularId(state)
    const seed = regularComplaintSeed(regularId)
    const before = JSON.stringify(state)
    regularComplaintCard.render(seed, state)
    expect(JSON.stringify(state)).toBe(before)
  })
})

describe('regularComplaintCard — voice variance across three profiles', () => {
  it('produces three distinct reaction lines (body[1]) for three distinct voices', () => {
    const state = createInitialTavernState()
    const regularId = firstRegularId(state)
    const profiles: CastAttributes[] = [
      {
        specialty: 'gossip',
        blindspot: 'war_story',
        affinities: [],
        voice: { axes: { terseness: 2, warmth: 0, formality: 1, floridity: 1 } },
      },
      {
        specialty: 'gossip',
        blindspot: 'war_story',
        affinities: [],
        voice: { axes: { terseness: 1, warmth: 2, formality: 0, floridity: 1 } },
      },
      {
        specialty: 'gossip',
        blindspot: 'war_story',
        affinities: [],
        voice: {
          axes: { terseness: 1, warmth: 1, formality: 1, floridity: 1 },
          verbalTic: 'qualifies_everything',
        },
      },
    ]
    const reactions = profiles.map((cast, i) => {
      const installed = withCast(state, regularId, cast)
      const view = regularComplaintCard.render(
        regularComplaintSeed(regularId, `variance-${i}`),
        installed,
      )
      return view.body[1]
    })
    expect(new Set(reactions).size).toBe(3)
  })
})
