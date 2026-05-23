// Phase 136 / ISSUE-105 — Voiced Surface arc, Phase 10 (Factions & Culture).
//
// Integration tests for `cultureConflictCard` — first dedicated card
// for the culture_conflict family. Narrator-voiced (cultures have
// meters but no `castAttributes`); every snippet pool is free of
// `voiceAxis` / `verbalTic` conditions. Variety comes from state
// perturbation (culture meters via the new culture.* bands, rising
// cultural_tension pressure, prior-choice memories, calendar tags).

import { describe, expect, it } from 'vitest'

import { cultureConflictCard } from '../../src/cards/index'
import { pickCardForSeed } from '../../src/cards/selection'
import {
  cultureConflictEstablishingLinePool,
  cultureConflictReactionLinePool,
  cultureConflictTitlePool,
} from '../../src/cards/compose/pools/cultureConflict'
import { REQUIRED_CARDS } from '../../src/cards/templates/index'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import type {
  IssueSeed,
  IssueSeedFamilyId,
} from '../../src/sim/modules/issues/issueSeedTypes'
import type {
  EntityRef,
  TavernState,
} from '../../src/sim/state/TavernState'
import { makeSeed } from './cardFactories'

function firstCultureId(state: TavernState): string {
  const id = Object.keys(state.world.cultures)[0]
  if (!id) throw new Error('test setup expects at least one starter culture')
  return id
}

function cultureRef(id: string): EntityRef {
  return { kind: 'culture', id }
}

function withCultureMeters(
  state: TavernState,
  cultureId: string,
  overrides: Partial<{ tension: number; comfort: number; familiarity: number }>,
): TavernState {
  return {
    ...state,
    world: {
      ...state.world,
      cultures: {
        ...state.world.cultures,
        [cultureId]: {
          ...state.world.cultures[cultureId]!,
          ...overrides,
        },
      },
    },
  }
}

function withRisingPressure(
  state: TavernState,
  pressureId: string,
  value = 50,
): TavernState {
  return {
    ...state,
    pressures: {
      ...state.pressures,
      [pressureId]: {
        id: pressureId,
        label: pressureId,
        value,
        trend: 1,
        tags: state.pressures[pressureId]?.tags ?? [],
        topCauses: state.pressures[pressureId]?.topCauses ?? [],
      },
    },
  }
}

function cultureConflictSeed(
  cultureId: string,
  id = 'culture-seed',
  overrides: { severity?: number; toneHints?: string[] } = {},
): IssueSeed {
  return makeSeed({
    id,
    family: 'culture_conflict' as IssueSeedFamilyId,
    type: 'social_conflict',
    timing: 'during_service',
    severity: overrides.severity ?? 50,
    domain: ['cultures', 'social'],
    toneHints: overrides.toneHints ?? ['culture', 'tension'],
    primaryActor: cultureRef(cultureId),
    responseSlots: [
      {
        id: `${id}-mediate`,
        labelHint: 'Mediate between groups',
        allowedVerbs: ['appease', 'negotiate'],
        shape: 'compromise',
        targetOptions: [cultureRef(cultureId)],
        expectedEffects: ['lower tension'],
      },
      {
        id: `${id}-ignore`,
        labelHint: 'Ignore the custom',
        allowedVerbs: ['ignore'],
        shape: 'ignore',
        targetOptions: [],
        expectedEffects: ['no immediate change'],
      },
    ],
    consequenceProfiles: [
      {
        id: `${id}-mediate-profile`,
        responseSlotId: `${id}-mediate`,
        immediateEffects: [
          {
            kind: 'state_change',
            target: `cultures.${cultureId}.tension`,
            amount: -10,
            readable: 'tension drops',
            tags: ['culture'],
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
      subject: 'cultural friction',
      sensoryDetails: ['drawn breath', 'shifted seat'],
      recentContext: ['tension 60'],
    },
  })
}

const ESTABLISHING_LINE_TEXTS = new Set(
  cultureConflictEstablishingLinePool.snippets.map((s) => s.text),
)
const REACTION_LINE_TEXTS = new Set(
  cultureConflictReactionLinePool.snippets.map((s) => s.text),
)
const TITLE_TEXTS = new Set(
  cultureConflictTitlePool.snippets.map((s) => s.text),
)

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length
}

describe('cultureConflictCard — appliesTo', () => {
  const state = createInitialTavernState()
  const cultureId = firstCultureId(state)

  it('is registered in REQUIRED_CARDS', () => {
    expect(REQUIRED_CARDS).toContain(cultureConflictCard)
  })

  it('matches a culture_conflict / social_conflict / during_service seed', () => {
    const seed = cultureConflictSeed(cultureId)
    const chosen = pickCardForSeed(seed, state, REQUIRED_CARDS)
    expect(chosen?.id).toBe(cultureConflictCard.id)
  })

  it('matches even when the culture has no castAttributes (narrator-voiced)', () => {
    const seed = cultureConflictSeed(cultureId)
    const chosen = pickCardForSeed(seed, state, REQUIRED_CARDS)
    expect(chosen?.id).toBe(cultureConflictCard.id)
  })

  it('declines the legacy relationship_test seed type', () => {
    const seed = makeSeed({
      family: 'culture_conflict' as IssueSeedFamilyId,
      type: 'relationship_test',
      timing: 'during_service',
      primaryActor: cultureRef(cultureId),
    })
    const chosen = pickCardForSeed(seed, state, REQUIRED_CARDS)
    expect(chosen?.id).not.toBe(cultureConflictCard.id)
  })

  it('declines a faction-bearing seed (that goes to factionRequest)', () => {
    const factionId = Object.keys(state.world.factions)[0]!
    const seed = makeSeed({
      family: 'faction_request' as IssueSeedFamilyId,
      type: 'social_conflict',
      timing: 'during_service',
      primaryActor: { kind: 'faction', id: factionId },
    })
    const chosen = pickCardForSeed(seed, state, REQUIRED_CARDS)
    expect(chosen?.id).not.toBe(cultureConflictCard.id)
  })
})

describe('cultureConflictCard — render output', () => {
  it('body[0] is the sim-backed establishing line; body[1] is the narrator reaction', () => {
    const state = createInitialTavernState()
    const cultureId = firstCultureId(state)
    const seed = cultureConflictSeed(cultureId)
    const view = cultureConflictCard.render(seed, state)
    expect(view.body[0]).toBeDefined()
    expect(view.body[1]).toBeDefined()
    expect(ESTABLISHING_LINE_TEXTS.has(view.body[0]!)).toBe(true)
    expect(REACTION_LINE_TEXTS.has(view.body[1]!)).toBe(true)
    expect(wordCount(view.body[0]!)).toBeLessThanOrEqual(14)
    expect(wordCount(view.body[1]!)).toBeLessThanOrEqual(12)
  })

  it('body never surfaces a raw tension / comfort / familiarity stat readout', () => {
    const state = createInitialTavernState()
    const cultureId = firstCultureId(state)
    const seed = cultureConflictSeed(cultureId)
    const view = cultureConflictCard.render(seed, state)
    for (const line of view.body) {
      expect(line).not.toBe('drawn breath')
      expect(line).not.toBe('shifted seat')
      expect(line).not.toBe('tension 60')
      expect(line).not.toMatch(/tension \d+/i)
      expect(line).not.toMatch(/comfort \d+/i)
      expect(line).not.toMatch(/familiarity \d+/i)
    }
  })

  it('establishing_line picks the high-tension snippet when culture.tension is in the high band', () => {
    const state = createInitialTavernState()
    const cultureId = firstCultureId(state)
    // Starter cultures preset comfort + familiarity high; isolate the
    // tension band by parking the others in mid.
    const high = withCultureMeters(state, cultureId, {
      tension: 80,
      comfort: 50,
      familiarity: 50,
    })
    const seed = cultureConflictSeed(cultureId, 'culture-high-tension')
    const view = cultureConflictCard.render(seed, high)
    expect(view.body[0]).toBe('This group has been on edge across the whole evening.')
  })

  it('establishing_line picks the low-familiarity snippet when culture.familiarity is in the low band', () => {
    const state = createInitialTavernState()
    const cultureId = firstCultureId(state)
    const low = withCultureMeters(state, cultureId, {
      tension: 50,
      comfort: 50,
      familiarity: 25,
    })
    const seed = cultureConflictSeed(cultureId, 'culture-low-familiarity')
    const view = cultureConflictCard.render(seed, low)
    expect(view.body[0]).toBe('Their customs are still alien to this house.')
  })

  it('reaction_line picks the rising-tension snippet when cultural_tension is rising', () => {
    const state = createInitialTavernState()
    const cultureId = firstCultureId(state)
    const rising = withRisingPressure(state, 'cultural_tension', 60)
    const seed = cultureConflictSeed(cultureId, 'culture-rising-tension')
    const view = cultureConflictCard.render(seed, rising)
    expect(view.body[1]).toBe(
      'Tension is rising and the wrong word will tip it over.',
    )
  })

  it('title centres on the culture display label and never truncates with "…"', () => {
    const state = createInitialTavernState()
    const cultureId = firstCultureId(state)
    const seed = cultureConflictSeed(cultureId)
    const view = cultureConflictCard.render(seed, state)
    const display = state.world.cultures[cultureId]!.label
    expect(view.title).toContain(display)
    expect(view.title).not.toContain('…')
    expect(view.title).not.toContain('...')
    const colonIdx = view.title.indexOf(':')
    expect(colonIdx).toBeGreaterThan(0)
    const after = view.title.slice(colonIdx + 1).trim()
    expect(TITLE_TEXTS.has(after)).toBe(true)
  })

  it('emits valid choices whose verbs are in seed.responseSlots.allowedVerbs', () => {
    const state = createInitialTavernState()
    const cultureId = firstCultureId(state)
    const seed = cultureConflictSeed(cultureId)
    const view = cultureConflictCard.render(seed, state)
    expect(view.choices.length).toBeGreaterThan(0)
    for (const choice of view.choices) {
      const slot = seed.responseSlots.find((s) => s.id === choice.slotId)
      expect(slot, `slot ${choice.slotId} resolves`).toBeDefined()
      expect(slot!.allowedVerbs).toContain(choice.verb)
    }
  })

  it('preserves choice mechanical truth: verb, shape, preview count unchanged by composition', () => {
    const state = createInitialTavernState()
    const cultureId = firstCultureId(state)
    const seed = cultureConflictSeed(cultureId)
    const view = cultureConflictCard.render(seed, state)
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
    const cultureId = firstCultureId(state)
    const seed = cultureConflictSeed(cultureId, 'culture-tags', { severity: 65 })
    const view = cultureConflictCard.render(seed, state)
    expect(view.tag).toBe('culture_conflict')
    expect(view.severity).toBe(65)
  })

  it('is deterministic — same seed + state ⇒ identical CardView', () => {
    const state = createInitialTavernState()
    const cultureId = firstCultureId(state)
    const seed = cultureConflictSeed(cultureId)
    const a = cultureConflictCard.render(seed, state)
    const b = cultureConflictCard.render(seed, structuredClone(state) as TavernState)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('does not mutate state', () => {
    const state = createInitialTavernState()
    const cultureId = firstCultureId(state)
    const seed = cultureConflictSeed(cultureId)
    const before = JSON.stringify(state)
    cultureConflictCard.render(seed, state)
    expect(JSON.stringify(state)).toBe(before)
  })
})

describe('cultureConflictCard — narrator framing', () => {
  it('no first-person address in any body line', () => {
    const state = createInitialTavernState()
    const cultureId = firstCultureId(state)
    const seed = cultureConflictSeed(cultureId)
    const view = cultureConflictCard.render(seed, state)
    for (const line of view.body) {
      // Narrator voice — the culture is described in third person, never
      // speaking as "we" or "I" or addressing the owner with "you" beyond
      // narrator framing.
      expect(line).not.toMatch(/^\s*I\b/)
      expect(line).not.toMatch(/^\s*we\b/i)
    }
  })

  it('produces different establishing lines across distinct culture meter perturbations', () => {
    const state = createInitialTavernState()
    const cultureId = firstCultureId(state)
    const lines = new Set<string>()
    // Isolate each band by parking the others mid.
    const perturbations = [
      { tension: 80, comfort: 50, familiarity: 50 },
      { tension: 50, comfort: 25, familiarity: 50 },
      { tension: 50, comfort: 50, familiarity: 25 },
    ]
    for (const meters of perturbations) {
      const s = withCultureMeters(state, cultureId, meters)
      const seed = cultureConflictSeed(cultureId, `meter-${JSON.stringify(meters)}`)
      const view = cultureConflictCard.render(seed, s)
      lines.add(view.body[0]!)
    }
    expect(lines.size).toBe(3)
  })
})
