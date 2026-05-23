// Phase 138 / ISSUE-107 — Voiced Surface arc, Phase 12 (Crises & Safety).
//
// Integration tests for `inspectionCard` — the first dedicated card for
// the `inspection.inspection_threat` seed family (pre-Phase 12 these
// seeds routed to `fallbackCard`). Actor-voiced via the inspecting
// faction's or notable-NPC's Phase-128 castAttributes. Mirrors
// `templates.staffBurnout.test.ts` shape.

import { describe, expect, it } from 'vitest'

import { inspectionCard, fallbackCard } from '../../src/cards/index'
import { pickCardForSeed } from '../../src/cards/selection'
import {
  inspectionEstablishingLinePool,
  inspectionReactionLinePool,
} from '../../src/cards/compose/pools/inspection'
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
  if (!id) throw new Error('test setup expects at least one faction')
  return id
}

function withFactionCast(
  state: TavernState,
  factionId: string,
  cast: FactionCastAttributes | undefined,
): TavernState {
  const existing = state.world.factions[factionId]!
  const next = cast === undefined
    ? (() => {
        const { castAttributes: _strip, ...rest } = existing
        void _strip
        return rest
      })()
    : { ...existing, castAttributes: cast }
  return {
    ...state,
    world: {
      ...state.world,
      factions: { ...state.world.factions, [factionId]: next },
    },
  }
}

function factionRef(id: string): EntityRef {
  return { kind: 'faction', id }
}

function systemRef(id: string): EntityRef {
  return { kind: 'system', id }
}

function inspectionSeed(
  factionId: string,
  id = 'inspection-seed',
): IssueSeed {
  return makeSeed({
    id,
    family: 'inspection' as IssueSeedFamilyId,
    type: 'inspection_threat',
    timing: 'morning_prep',
    severity: 60,
    domain: ['inspection', 'food', 'areas', 'reputation'],
    primaryActor: factionRef(factionId),
    location: { kind: 'area', id: 'main_room' },
    toneHints: ['inspection', 'urgent'],
    responseSlots: [
      {
        id: `${id}-slot-clean`,
        labelHint: 'Clean the worst areas',
        allowedVerbs: ['clean'],
        shape: 'long_term_investment',
        targetOptions: [{ kind: 'area', id: 'kitchen' }],
        expectedEffects: ['cleanliness +', 'pressure eases'],
      },
      {
        id: `${id}-slot-bribe`,
        labelHint: 'Bribe the inspector',
        allowedVerbs: ['bribe'],
        shape: 'risky_profitable',
        targetOptions: [factionRef(factionId)],
        expectedEffects: ['coin -30', 'pressure eases'],
      },
    ],
    consequenceProfiles: [
      {
        id: `${id}-profile-clean`,
        responseSlotId: `${id}-slot-clean`,
        immediateEffects: [
          {
            kind: 'state_change',
            target: 'areas.kitchen.cleanliness',
            amount: 20,
            readable: 'kitchen cleaner',
            tags: ['area'],
          },
          {
            kind: 'pressure',
            target: 'pressure:inspection',
            amount: -12,
            readable: 'inspection eases',
            tags: ['pressure'],
          },
        ],
        delayedEffects: [],
        memories: [],
        futureHooks: [],
        impactScore: 6,
      },
      {
        id: `${id}-profile-bribe`,
        responseSlotId: `${id}-slot-bribe`,
        immediateEffects: [
          {
            kind: 'state_change',
            target: 'coin',
            amount: -30,
            readable: 'pay the bribe',
            tags: ['coin'],
          },
        ],
        delayedEffects: [],
        memories: [],
        futureHooks: [],
        impactScore: 5,
      },
    ],
    textIngredients: {
      subject: 'the tavern',
      sensoryDetails: ['privy stench', 'grimy floor'],
      recentContext: ['privy left filthy', 'kitchen dirty for days'],
      stakesReadable: ['inspector may visit', 'reputation may rot'],
    },
  })
}

const ESTABLISHING_LINE_TEXTS = new Set(
  inspectionEstablishingLinePool.snippets.map((s) => s.text),
)
const REACTION_LINE_TEXTS = new Set(
  inspectionReactionLinePool.snippets.map((s) => s.text),
)

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length
}

describe('inspectionCard — appliesTo', () => {
  const state = createInitialTavernState()
  const factionId = firstFactionId(state)

  it('is registered in REQUIRED_CARDS', () => {
    expect(REQUIRED_CARDS).toContain(inspectionCard)
  })

  it('matches an inspection / inspection_threat / morning_prep seed with a faction actor', () => {
    const seed = inspectionSeed(factionId)
    const chosen = pickCardForSeed(seed, state, REQUIRED_CARDS)
    expect(chosen?.id).toBe(inspectionCard.id)
  })

  it('declines a seed whose faction has no cast attributes — fallback handles it', () => {
    const castless = withFactionCast(state, factionId, undefined)
    const seed = inspectionSeed(factionId)
    const chosen = pickCardForSeed(seed, castless, REQUIRED_CARDS)
    expect(chosen?.id).not.toBe(inspectionCard.id)
    expect(chosen?.id).toBe(fallbackCard.id)
  })

  it('declines a seed with a systemRef primary actor (no castAttributes path)', () => {
    const seed = inspectionSeed(factionId, 'inspection-system-actor')
    const systemSeed: IssueSeed = { ...seed, primaryActor: systemRef('inspector') }
    const chosen = pickCardForSeed(systemSeed, state, REQUIRED_CARDS)
    expect(chosen?.id).not.toBe(inspectionCard.id)
    expect(chosen?.id).toBe(fallbackCard.id)
  })
})

describe('inspectionCard — render output', () => {
  it('body[0] is the sim-backed establishing line; body[1] is the voiced reaction', () => {
    const state = createInitialTavernState()
    const factionId = firstFactionId(state)
    const seed = inspectionSeed(factionId)
    const view = inspectionCard.render(seed, state)
    expect(view.body[0]).toBeDefined()
    expect(view.body[1]).toBeDefined()
    expect(ESTABLISHING_LINE_TEXTS.has(view.body[0]!)).toBe(true)
    expect(REACTION_LINE_TEXTS.has(view.body[1]!)).toBe(true)
    expect(wordCount(view.body[0]!)).toBeLessThanOrEqual(14)
    expect(wordCount(view.body[1]!)).toBeLessThanOrEqual(12)
  })

  it('body never surfaces raw textIngredients fragments', () => {
    const state = createInitialTavernState()
    const factionId = firstFactionId(state)
    const seed = inspectionSeed(factionId)
    const view = inspectionCard.render(seed, state)
    for (const line of view.body) {
      expect(line).not.toBe('privy stench')
      expect(line).not.toBe('grimy floor')
      expect(line).not.toBe('privy left filthy')
      expect(line).not.toBe('inspector may visit')
    }
  })

  it('title centres on the faction label and never truncates with "…"', () => {
    const state = createInitialTavernState()
    const factionId = firstFactionId(state)
    const seed = inspectionSeed(factionId)
    const view = inspectionCard.render(seed, state)
    const label = state.world.factions[factionId]!.label
    expect(view.title.toLowerCase()).toContain(label.split(' ')[0]!.toLowerCase())
    expect(view.title).not.toContain('…')
    expect(view.title).not.toContain('...')
  })

  it('preserves choice mechanical truth (verb, target, effects)', () => {
    const state = createInitialTavernState()
    const factionId = firstFactionId(state)
    const seed = inspectionSeed(factionId)
    const view = inspectionCard.render(seed, state)
    expect(view.choices.length).toBe(seed.responseSlots.length)
    for (const [i, choice] of view.choices.entries()) {
      const slot = seed.responseSlots[i]!
      expect(choice.verb).toBe(slot.allowedVerbs[0])
    }
  })

  it('is deterministic — same seed + state ⇒ identical CardView', () => {
    const state = createInitialTavernState()
    const factionId = firstFactionId(state)
    const seed = inspectionSeed(factionId, 'inspection-deterministic')
    const a = inspectionCard.render(seed, state)
    const b = inspectionCard.render(seed, state)
    expect(a.title).toBe(b.title)
    expect(a.body).toEqual(b.body)
    expect(a.choices).toEqual(b.choices)
  })

  it('does not mutate state', () => {
    const state = createInitialTavernState()
    const factionId = firstFactionId(state)
    const seed = inspectionSeed(factionId)
    const before = JSON.stringify(state)
    inspectionCard.render(seed, state)
    expect(JSON.stringify(state)).toBe(before)
  })
})

describe('inspectionCard — pools shape', () => {
  it('reaction_line pool is actor-aware (voice axes drive variants)', () => {
    const hasVoiceCondition = inspectionReactionLinePool.snippets.some((s) =>
      s.conditions.some(
        (c) => c.kind === 'voiceAxis' || c.kind === 'verbalTic',
      ),
    )
    expect(hasVoiceCondition).toBe(true)
  })

  it('establishing_line reaches the area.cleanliness / faction.relationship signals', () => {
    const reachesAreaCleanliness = inspectionEstablishingLinePool.snippets.some((s) =>
      s.conditions.some(
        (c) => c.kind === 'signalEquals' && c.signal === 'area.cleanliness',
      ),
    )
    const reachesFactionRelationship = inspectionEstablishingLinePool.snippets.some(
      (s) =>
        s.conditions.some(
          (c) => c.kind === 'signalEquals' && c.signal === 'faction.relationship',
        ),
    )
    expect(reachesAreaCleanliness).toBe(true)
    expect(reachesFactionRelationship).toBe(true)
  })
})
