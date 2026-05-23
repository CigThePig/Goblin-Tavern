// Phase 136 / ISSUE-105 — Voiced Surface arc, Phase 10 (Factions & Culture).
//
// Integration tests for `factionRequestCard` — the compositional
// replacement for the legacy hand-written factionRequest template that
// glued raw textIngredients and a relation-noun lookup. Mirrors
// `templates.supplierReliability.test.ts` shape: appliesTo wiring,
// custom-cast predicate, sim-backed establishing line fires on signal
// bands and rising pressures, voiced reaction follows on voice axes,
// choices preserve mechanical truth, deterministic re-render, graceful
// degradation when castAttributes missing.

import { describe, expect, it } from 'vitest'

import {
  factionRequestCard,
  fallbackCard,
} from '../../src/cards/index'
import { pickCardForSeed } from '../../src/cards/selection'
import {
  factionRequestEstablishingLinePool,
  factionRequestReactionLinePool,
  factionRequestTitlePool,
} from '../../src/cards/compose/pools/factionRequest'
import { REQUIRED_CARDS } from '../../src/cards/templates/index'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import type { FactionCastAttributes } from '../../src/sim/content/cast'
import type {
  IssueSeed,
  IssueSeedFamilyId,
} from '../../src/sim/modules/issues/issueSeedTypes'
import type {
  EntityRef,
  TavernState,
} from '../../src/sim/state/TavernState'
import { makeSeed } from './cardFactories'

function firstFactionId(state: TavernState): string {
  const id = Object.keys(state.world.factions)[0]
  if (!id) throw new Error('test setup expects at least one starter faction')
  return id
}

function withFactionCast(
  state: TavernState,
  factionId: string,
  cast: FactionCastAttributes,
): TavernState {
  return {
    ...state,
    world: {
      ...state.world,
      factions: {
        ...state.world.factions,
        [factionId]: {
          ...state.world.factions[factionId]!,
          castAttributes: cast,
        },
      },
    },
  }
}

function withFactionRelationship(
  state: TavernState,
  factionId: string,
  relationship: number,
): TavernState {
  return {
    ...state,
    world: {
      ...state.world,
      factions: {
        ...state.world.factions,
        [factionId]: {
          ...state.world.factions[factionId]!,
          relationship,
        },
      },
    },
  }
}

function factionRef(id: string): EntityRef {
  return { kind: 'faction', id }
}

function factionRequestSeed(factionId: string, id = 'faction-seed'): IssueSeed {
  return makeSeed({
    id,
    family: 'faction_request' as IssueSeedFamilyId,
    type: 'social_conflict',
    timing: 'during_service',
    severity: 45,
    domain: ['factions', 'social'],
    primaryActor: factionRef(factionId),
    responseSlots: [
      {
        id: `${id}-appease`,
        labelHint: 'Appease them',
        allowedVerbs: ['appease'],
        shape: 'safe_costly',
        targetOptions: [factionRef(factionId)],
        expectedEffects: ['raise relationship', 'spend coin'],
      },
      {
        id: `${id}-ignore`,
        labelHint: 'Refuse outright',
        allowedVerbs: ['ignore'],
        shape: 'escalation',
        targetOptions: [factionRef(factionId)],
        expectedEffects: ['hold ground'],
      },
    ],
    consequenceProfiles: [
      {
        id: `${id}-appease-profile`,
        responseSlotId: `${id}-appease`,
        immediateEffects: [
          {
            kind: 'state_change',
            target: `factions.${factionId}.relationship`,
            amount: 10,
            readable: 'relationship rises',
            tags: ['faction'],
          },
          {
            kind: 'state_change',
            target: 'coin',
            amount: -20,
            readable: 'coin out',
            tags: ['coin'],
          },
        ],
        delayedEffects: [],
        memories: [],
        futureHooks: [],
        impactScore: 5,
      },
      {
        id: `${id}-ignore-profile`,
        responseSlotId: `${id}-ignore`,
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
      subject: 'a delegation visit',
      sensoryDetails: ['folded arms', 'measured glances'],
      recentContext: ['relationship 45'],
    },
  })
}

const ESTABLISHING_LINE_TEXTS = new Set(
  factionRequestEstablishingLinePool.snippets.map((s) => s.text),
)
const REACTION_LINE_TEXTS = new Set(
  factionRequestReactionLinePool.snippets.map((s) => s.text),
)
const TITLE_TEXTS = new Set(
  factionRequestTitlePool.snippets.map((s) => s.text),
)

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length
}

describe('factionRequestCard — appliesTo', () => {
  const state = createInitialTavernState()
  const factionId = firstFactionId(state)

  it('is registered in REQUIRED_CARDS', () => {
    expect(REQUIRED_CARDS).toContain(factionRequestCard)
  })

  it('matches a faction_request / social_conflict / during_service seed with a cast-bearing faction', () => {
    const seed = factionRequestSeed(factionId)
    const chosen = pickCardForSeed(seed, state, REQUIRED_CARDS)
    expect(chosen?.id).toBe(factionRequestCard.id)
  })

  it('declines a seed whose faction has no cast attributes — fallback handles it', () => {
    const original = state.world.factions[factionId]!
    const { castAttributes: _strip, ...rest } = original
    void _strip
    const castless: TavernState = {
      ...state,
      world: {
        ...state.world,
        factions: { ...state.world.factions, [factionId]: rest },
      },
    }
    const seed = factionRequestSeed(factionId)
    const chosen = pickCardForSeed(seed, castless, REQUIRED_CARDS)
    expect(chosen?.id).not.toBe(factionRequestCard.id)
    expect(chosen?.id).toBe(fallbackCard.id)
  })

  it('declines a seed pointing at a missing faction', () => {
    const seed = factionRequestSeed('no_such_faction')
    const chosen = pickCardForSeed(seed, state, REQUIRED_CARDS)
    expect(chosen?.id).not.toBe(factionRequestCard.id)
    expect(chosen?.id).toBe(fallbackCard.id)
  })

  it('declines the legacy relationship_test seed type', () => {
    const seed = makeSeed({
      family: 'faction_request' as IssueSeedFamilyId,
      type: 'relationship_test',
      timing: 'during_service',
      primaryActor: factionRef(factionId),
    })
    const chosen = pickCardForSeed(seed, state, REQUIRED_CARDS)
    expect(chosen?.id).not.toBe(factionRequestCard.id)
  })
})

describe('factionRequestCard — render output', () => {
  it('body[0] is the sim-backed establishing line; body[1] is the voiced reaction', () => {
    const state = createInitialTavernState()
    const factionId = firstFactionId(state)
    const seed = factionRequestSeed(factionId)
    const view = factionRequestCard.render(seed, state)
    expect(view.body[0]).toBeDefined()
    expect(view.body[1]).toBeDefined()
    expect(ESTABLISHING_LINE_TEXTS.has(view.body[0]!)).toBe(true)
    expect(REACTION_LINE_TEXTS.has(view.body[1]!)).toBe(true)
    expect(wordCount(view.body[0]!)).toBeLessThanOrEqual(14)
    expect(wordCount(view.body[1]!)).toBeLessThanOrEqual(12)
  })

  it('body never surfaces a raw relationship / influence stat readout', () => {
    const state = createInitialTavernState()
    const factionId = firstFactionId(state)
    const seed = factionRequestSeed(factionId)
    const view = factionRequestCard.render(seed, state)
    for (const line of view.body) {
      expect(line).not.toBe('folded arms')
      expect(line).not.toBe('measured glances')
      expect(line).not.toBe('relationship 45')
      expect(line).not.toMatch(/relationship \d+/i)
      expect(line).not.toMatch(/influence \d+/i)
    }
  })

  it('establishing_line picks the low-relationship snippet when faction.relationship is in the low band', () => {
    const state = createInitialTavernState()
    const factionId = firstFactionId(state)
    const low = withFactionRelationship(state, factionId, 25)
    const seed = factionRequestSeed(factionId, 'faction-low-rel')
    const view = factionRequestCard.render(seed, low)
    expect(view.body[0]).toBe('There is old cold between this house and theirs.')
  })

  it('establishing_line picks the high-relationship snippet when faction.relationship is in the high band', () => {
    const state = createInitialTavernState()
    const factionId = firstFactionId(state)
    const high = withFactionRelationship(state, factionId, 80)
    const seed = factionRequestSeed(factionId, 'faction-high-rel')
    const view = factionRequestCard.render(seed, high)
    expect(view.body[0]).toBe('Their people walk this room like welcome guests.')
  })

  it('title centres on the faction display label and never truncates with "…"', () => {
    const state = createInitialTavernState()
    const factionId = firstFactionId(state)
    const seed = factionRequestSeed(factionId)
    const view = factionRequestCard.render(seed, state)
    const display = state.world.factions[factionId]!.label
    expect(view.title).toContain(display)
    expect(view.title).not.toContain('…')
    expect(view.title).not.toContain('...')
    const colonIdx = view.title.indexOf(':')
    expect(colonIdx).toBeGreaterThan(0)
    const after = view.title.slice(colonIdx + 1).trim()
    expect(TITLE_TEXTS.has(after)).toBe(true)
  })

  it('picks a two-axis reaction snippet when both extremes land', () => {
    const state = createInitialTavernState()
    const factionId = firstFactionId(state)
    const sharpCast: FactionCastAttributes = {
      specialty: 'hard_bargain',
      blindspot: 'patience',
      affinities: [],
      voice: { axes: { terseness: 2, warmth: 0, formality: 1, floridity: 1 } },
    }
    const sharp = withFactionCast(state, factionId, sharpCast)
    const seed = factionRequestSeed(factionId, 'faction-sharp')
    const view = factionRequestCard.render(seed, sharp)
    expect(view.body[1]).toBe('No softer words. Answer us plain.')
  })

  it('emits valid choices whose verbs are in seed.responseSlots.allowedVerbs', () => {
    const state = createInitialTavernState()
    const factionId = firstFactionId(state)
    const seed = factionRequestSeed(factionId)
    const view = factionRequestCard.render(seed, state)
    expect(view.choices.length).toBeGreaterThan(0)
    for (const choice of view.choices) {
      const slot = seed.responseSlots.find((s) => s.id === choice.slotId)
      expect(slot, `slot ${choice.slotId} resolves`).toBeDefined()
      expect(slot!.allowedVerbs).toContain(choice.verb)
    }
  })

  it('preserves choice mechanical truth: verb, shape, preview count unchanged by composition', () => {
    const state = createInitialTavernState()
    const factionId = firstFactionId(state)
    const seed = factionRequestSeed(factionId)
    const view = factionRequestCard.render(seed, state)
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
    const factionId = firstFactionId(state)
    const seed = factionRequestSeed(factionId)
    const view = factionRequestCard.render(seed, state)
    expect(view.tag).toBe('faction_request')
    expect(view.severity).toBe(45)
  })

  it('is deterministic — same seed + state ⇒ identical CardView', () => {
    const state = createInitialTavernState()
    const factionId = firstFactionId(state)
    const seed = factionRequestSeed(factionId)
    const a = factionRequestCard.render(seed, state)
    const b = factionRequestCard.render(seed, structuredClone(state) as TavernState)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('does not mutate state', () => {
    const state = createInitialTavernState()
    const factionId = firstFactionId(state)
    const seed = factionRequestSeed(factionId)
    const before = JSON.stringify(state)
    factionRequestCard.render(seed, state)
    expect(JSON.stringify(state)).toBe(before)
  })
})

describe('factionRequestCard — voice variance across three profiles', () => {
  it('produces three distinct reaction lines for three distinct voices', () => {
    const state = createInitialTavernState()
    const factionId = firstFactionId(state)
    const base = {
      specialty: 'ceremony',
      blindspot: 'patience',
      affinities: [],
    }
    const profiles: FactionCastAttributes[] = [
      { ...base, voice: { axes: { terseness: 2, warmth: 0, formality: 1, floridity: 1 } } },
      { ...base, voice: { axes: { terseness: 1, warmth: 2, formality: 0, floridity: 1 } } },
      {
        ...base,
        voice: {
          axes: { terseness: 1, warmth: 1, formality: 1, floridity: 1 },
          verbalTic: 'italicises_stakes',
        },
      },
    ]
    const reactions = profiles.map((cast, i) => {
      const installed = withFactionCast(state, factionId, cast)
      const view = factionRequestCard.render(
        factionRequestSeed(factionId, `variance-${i}`),
        installed,
      )
      return view.body[1]
    })
    expect(new Set(reactions).size).toBe(3)
  })
})
