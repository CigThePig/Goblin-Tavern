// Phase 139 / ISSUE-108 — Voiced Surface arc, Phase 13 (Reputation, Rumour & Rivals).
//
// Integration tests for `reputationShiftCard` — replaces the legacy
// `reputationShiftWeeklyCard` (deleted in this phase) whose
// `timings: ['end_week']` never matched the generator's `closing`
// emit. Narrator-voiced (no primaryActor on the seed); every snippet
// pool is free of `voiceAxis` / `verbalTic` conditions. Variety comes
// from state perturbation (hasTag reputation.<axis>, pressures
// rising, memories, repeat count, severity).

import { describe, expect, it } from 'vitest'

import { reputationShiftCard, fallbackCard } from '../../src/cards/index'
import { pickCardForSeed } from '../../src/cards/selection'
import {
  reputationShiftChoiceLabelPool,
  reputationShiftEstablishingLinePool,
  reputationShiftMannerNotePool,
  reputationShiftReactionLinePool,
  reputationShiftTitlePool,
} from '../../src/cards/compose/pools/reputationShift'
import type {
  SnippetCondition,
  SnippetPool,
} from '../../src/cards/compose/types'
import { REQUIRED_CARDS } from '../../src/cards/templates/index'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import type {
  IssueSeed,
  IssueSeedFamilyId,
} from '../../src/sim/modules/issues/issueSeedTypes'
import type { TavernState } from '../../src/sim/state/TavernState'
import { makeSeed } from './cardFactories'

function reputationShiftSeed(
  id = 'reputation-shift-seed',
  overrides: {
    severity?: number
    domain?: string[]
    toneHints?: string[]
  } = {},
): IssueSeed {
  return makeSeed({
    id,
    family: 'reputation_shift' as IssueSeedFamilyId,
    type: 'reputation_shift',
    timing: 'closing',
    severity: overrides.severity ?? 50,
    domain: overrides.domain ?? ['reputation', 'customers', 'reputation.cozy'],
    toneHints: overrides.toneHints ?? ['identity', 'reputation'],
    location: { kind: 'area', id: 'main_room' },
    responseSlots: [
      {
        id: `${id}-embrace`,
        labelHint: 'Embrace the identity',
        allowedVerbs: ['rebrand'],
        shape: 'reputation_play',
        targetOptions: [{ kind: 'system', id: 'reputation' }],
        expectedEffects: ['lean into reputation', 'narrow audience'],
      },
      {
        id: `${id}-correct`,
        labelHint: 'Correct the identity',
        allowedVerbs: ['clean', 'repair', 'pay'],
        shape: 'long_term_investment',
        targetOptions: [{ kind: 'system', id: 'reputation' }],
        expectedEffects: ['shift reputation away', 'costly effort'],
      },
      {
        id: `${id}-advertise`,
        labelHint: 'Advertise to matching group',
        allowedVerbs: ['invite'],
        shape: 'compromise',
        targetOptions: [{ kind: 'customer_group', id: 'miners' }],
        expectedEffects: ['raise patronage', 'lock identity'],
      },
      {
        id: `${id}-diversify`,
        labelHint: 'Diversify',
        allowedVerbs: ['rebrand'],
        shape: 'compromise',
        targetOptions: [{ kind: 'system', id: 'customers' }],
        expectedEffects: ['broaden appeal', 'risk dilution'],
      },
    ],
    consequenceProfiles: [
      {
        id: `${id}-embrace-profile`,
        responseSlotId: `${id}-embrace`,
        immediateEffects: [
          {
            kind: 'state_change',
            target: 'reputation.cozy',
            amount: 5,
            readable: 'lean into cozy reputation',
            tags: ['reputation'],
          },
        ],
        delayedEffects: [],
        memories: [],
        futureHooks: [],
        impactScore: 5,
      },
      {
        id: `${id}-correct-profile`,
        responseSlotId: `${id}-correct`,
        immediateEffects: [
          {
            kind: 'state_change',
            target: 'reputation.cozy',
            amount: -5,
            readable: 'shift away from cozy',
            tags: ['reputation'],
          },
          {
            kind: 'state_change',
            target: 'coin',
            amount: -10,
            readable: 'pay for the correction',
            tags: ['coin'],
          },
        ],
        delayedEffects: [],
        memories: [],
        futureHooks: [],
        impactScore: 6,
      },
      {
        id: `${id}-advertise-profile`,
        responseSlotId: `${id}-advertise`,
        immediateEffects: [
          {
            kind: 'state_change',
            target: 'customers.miners.patronage',
            amount: 8,
            readable: 'miners drift in',
            tags: ['customer'],
          },
        ],
        delayedEffects: [],
        memories: [],
        futureHooks: [],
        impactScore: 4,
      },
      {
        id: `${id}-diversify-profile`,
        responseSlotId: `${id}-diversify`,
        immediateEffects: [
          {
            kind: 'state_change',
            target: 'reputation.cozy',
            amount: -3,
            readable: 'soften the name',
            tags: ['reputation'],
          },
        ],
        delayedEffects: [],
        memories: [],
        futureHooks: [],
        impactScore: 3,
      },
    ],
    textIngredients: {
      subject: 'the tavern',
      sensoryDetails: ['regulars settle in', 'newcomers turn away'],
      recentContext: ['cozy reputation rising'],
      stakesReadable: ['identity may lock in', 'audience may narrow'],
    },
  })
}

function withMemory(
  state: TavernState,
  memoryId: string,
  tags: string[],
): TavernState {
  return {
    ...state,
    memories: [
      ...state.memories,
      {
        id: memoryId,
        type: 'fact',
        label: memoryId,
        strength: 50,
        ageDays: 1,
        createdAt: {
          year: 1,
          month: 1,
          week: 1,
          day: 1,
          absoluteDay: 0,
        },
        actors: [],
        locations: [],
        relatedSystems: [],
        tags,
      },
    ],
  }
}

function withRisingPressure(
  state: TavernState,
  pressureId: string,
  value = 55,
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

const ESTABLISHING_TEXTS = new Set(
  reputationShiftEstablishingLinePool.snippets.map((s) => s.text),
)
const REACTION_TEXTS = new Set(
  reputationShiftReactionLinePool.snippets.map((s) => s.text),
)
const TITLE_TEXTS = new Set(reputationShiftTitlePool.snippets.map((s) => s.text))

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length
}

function poolHasActorCondition(pool: SnippetPool): boolean {
  return pool.snippets.some((snippet) =>
    snippet.conditions.some(
      (c: SnippetCondition) =>
        c.kind === 'voiceAxis' || c.kind === 'verbalTic' || c.kind === 'actorTrait',
    ),
  )
}

describe('reputationShiftCard — appliesTo', () => {
  const state = createInitialTavernState()

  it('is registered in REQUIRED_CARDS', () => {
    expect(REQUIRED_CARDS).toContain(reputationShiftCard)
  })

  it('matches a reputation_shift / reputation_shift / closing seed (alignment fix)', () => {
    const seed = reputationShiftSeed()
    const chosen = pickCardForSeed(seed, state, REQUIRED_CARDS)
    expect(chosen?.id).toBe(reputationShiftCard.id)
  })

  it('falls back when the timing does not match (the legacy end_week shape no longer routes here)', () => {
    const seed = makeSeed({
      family: 'reputation_shift' as IssueSeedFamilyId,
      type: 'reputation_shift',
      timing: 'end_week',
    })
    const chosen = pickCardForSeed(seed, state, REQUIRED_CARDS)
    expect(chosen?.id).not.toBe(reputationShiftCard.id)
    expect(chosen?.id).toBe(fallbackCard.id)
  })
})

describe('reputationShiftCard — render output', () => {
  it('body[0] is the sim-backed establishing line; body[1] is the flavor reaction', () => {
    const state = createInitialTavernState()
    const seed = reputationShiftSeed()
    const view = reputationShiftCard.render(seed, state)
    expect(view.body[0]).toBeDefined()
    expect(view.body[1]).toBeDefined()
    expect(ESTABLISHING_TEXTS.has(view.body[0]!)).toBe(true)
    expect(REACTION_TEXTS.has(view.body[1]!)).toBe(true)
    expect(wordCount(view.body[0]!)).toBeLessThanOrEqual(14)
    expect(wordCount(view.body[1]!)).toBeLessThanOrEqual(12)
  })

  it('body never surfaces raw textIngredients fragments or mechanical readouts', () => {
    const state = createInitialTavernState()
    const seed = reputationShiftSeed()
    const view = reputationShiftCard.render(seed, state)
    for (const line of view.body) {
      expect(line).not.toBe('cozy reputation rising')
      expect(line).not.toBe('regulars settle in')
      expect(line).not.toBe('newcomers turn away')
      expect(line).not.toBe('identity may lock in')
      expect(line).not.toMatch(/cozy \d+/i)
      expect(line).not.toMatch(/dangerous \d+/i)
    }
  })

  it('title carries the fixed `Reputation:` prefix and no "…"', () => {
    const state = createInitialTavernState()
    const seed = reputationShiftSeed()
    const view = reputationShiftCard.render(seed, state)
    expect(view.title.startsWith('Reputation: ')).toBe(true)
    const snippet = view.title.slice('Reputation: '.length)
    expect(TITLE_TEXTS.has(snippet)).toBe(true)
    expect(view.title).not.toContain('…')
    expect(view.title).not.toContain('...')
    expect(view.title).not.toMatch(/^Weekly shift:/)
  })

  it('establishing_line fires an axis-specific snippet when the axis tag + rising drift are present', () => {
    const state = createInitialTavernState()
    const rising = withRisingPressure(state, 'reputation_drift')
    const seed = reputationShiftSeed('reputation-shift-dangerous', {
      domain: ['reputation', 'customers', 'reputation.dangerous'],
    })
    const view = reputationShiftCard.render(seed, rising)
    // The axis + rising-pressure rung (or the axis + severity + pressure
    // top rung when severity is high enough — at sev 50 only the middle
    // rung is reachable).
    expect([
      'A rougher name is gathering around the place.',
    ]).toContain(view.body[0])
  })

  it('establishing_line fires the rising-pressure snippet when reputation_drift trends positive', () => {
    const state = createInitialTavernState()
    const rising = withRisingPressure(state, 'reputation_drift')
    const seed = reputationShiftSeed('reputation-shift-pressure-rising', {
      domain: ['reputation', 'customers', 'reputation.tasty'],
    })
    const view = reputationShiftCard.render(seed, rising)
    expect([
      'Reputation_drift has been climbing onto the slate for days.',
      'Word of the kitchen is travelling beyond the usual tables.',
    ]).toContain(view.body[0])
  })

  it('establishing_line fires the embraced-memory snippet when an identity memory is present', () => {
    const state = createInitialTavernState()
    const remembered = withMemory(state, 'embraced_cozy_identity', ['reputation', 'identity'])
    const seed = reputationShiftSeed('reputation-shift-memory', {
      domain: ['reputation', 'customers', 'reputation.cozy'],
    })
    const view = reputationShiftCard.render(seed, remembered)
    expect([
      'The identity embraced last time keeps writing itself deeper.',
      'The room is gaining a cozier name with the regulars.',
    ]).toContain(view.body[0])
  })

  it('emits valid choices whose verbs are in seed.responseSlots.allowedVerbs', () => {
    const state = createInitialTavernState()
    const seed = reputationShiftSeed()
    const view = reputationShiftCard.render(seed, state)
    expect(view.choices.length).toBeGreaterThan(0)
    for (const choice of view.choices) {
      const slot = seed.responseSlots.find((s) => s.id === choice.slotId)
      expect(slot, `slot ${choice.slotId} resolves`).toBeDefined()
      expect(slot!.allowedVerbs).toContain(choice.verb)
    }
  })

  it('preserves choice mechanical truth: verb, shape, preview count unchanged by composition', () => {
    const state = createInitialTavernState()
    const seed = reputationShiftSeed()
    const view = reputationShiftCard.render(seed, state)
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
    const seed = reputationShiftSeed('reputation-shift-tag', { severity: 75 })
    const view = reputationShiftCard.render(seed, state)
    expect(view.tag).toBe('reputation_shift')
    expect(view.severity).toBe(75)
  })

  it('is deterministic — same seed + state ⇒ identical CardView', () => {
    const state = createInitialTavernState()
    const seed = reputationShiftSeed('reputation-shift-deterministic')
    const a = reputationShiftCard.render(seed, state)
    const b = reputationShiftCard.render(seed, structuredClone(state) as TavernState)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('does not mutate state', () => {
    const state = createInitialTavernState()
    const seed = reputationShiftSeed()
    const before = JSON.stringify(state)
    reputationShiftCard.render(seed, state)
    expect(JSON.stringify(state)).toBe(before)
  })
})

describe('reputationShiftCard — ownerless guarantee', () => {
  it('every pool is free of actor-voice conditions (no actor would resolve)', () => {
    expect(poolHasActorCondition(reputationShiftTitlePool)).toBe(false)
    expect(poolHasActorCondition(reputationShiftEstablishingLinePool)).toBe(false)
    expect(poolHasActorCondition(reputationShiftReactionLinePool)).toBe(false)
    expect(poolHasActorCondition(reputationShiftMannerNotePool)).toBe(false)
    expect(poolHasActorCondition(reputationShiftChoiceLabelPool)).toBe(false)
  })
})
