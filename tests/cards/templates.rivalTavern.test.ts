// Phase 139 / ISSUE-108 — Voiced Surface arc, Phase 13 (Reputation, Rumour & Rivals).
//
// Integration tests for `rivalTavernCard` — the first dedicated card
// for the `rival_tavern.social_conflict` seed family (pre-Phase 13
// these seeds routed to `fallbackCard`). Narrator-voiced — the seed's
// primaryActor is a `local_event` (rival arc) or `system` ref, neither
// carrying castAttributes. Variety comes from state perturbation
// (rival.arc / rival.system tag, pressures rising, memories, repeat
// count, severity).

import { describe, expect, it } from 'vitest'

import { rivalTavernCard } from '../../src/cards/index'
import { pickCardForSeed } from '../../src/cards/selection'
import {
  rivalTavernChoiceLabelPool,
  rivalTavernEstablishingLinePool,
  rivalTavernMannerNotePool,
  rivalTavernReactionLinePool,
  rivalTavernTitlePool,
} from '../../src/cards/compose/pools/rivalTavern'
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
import type {
  EntityRef,
  TavernState,
} from '../../src/sim/state/TavernState'
import { makeSeed } from './cardFactories'

function systemRivalRef(): EntityRef {
  return { kind: 'system', id: 'rival_tavern' }
}

function arcRivalRef(id: string): EntityRef {
  return { kind: 'local_event', id }
}

function rivalTavernSeed(
  primaryActor: EntityRef,
  id = 'rival-tavern-seed',
  overrides: { severity?: number; domain?: string[] } = {},
): IssueSeed {
  const isArc = primaryActor.kind === 'local_event'
  const domain = overrides.domain ?? [
    'rival',
    'market',
    'customers',
    isArc ? 'rival.arc' : 'rival.system',
  ]
  return makeSeed({
    id,
    family: 'rival_tavern' as IssueSeedFamilyId,
    type: 'social_conflict',
    timing: 'closing',
    severity: overrides.severity ?? 50,
    domain,
    toneHints: ['rival', 'market'],
    primaryActor,
    responseSlots: [
      {
        id: `${id}-price`,
        labelHint: 'Compete on price',
        allowedVerbs: ['lower_price'],
        shape: 'risky_profitable',
        targetOptions: [{ kind: 'stock', id: 'ale' }],
        expectedEffects: ['raise patronage', 'lose margin'],
      },
      {
        id: `${id}-quality`,
        labelHint: 'Improve quality',
        allowedVerbs: ['upgrade'],
        shape: 'long_term_investment',
        targetOptions: [{ kind: 'stock', id: 'ale' }],
        expectedEffects: ['raise reputation', 'time cost'],
      },
      {
        id: `${id}-ignore`,
        labelHint: 'Ignore the rival',
        allowedVerbs: ['ignore'],
        shape: 'ignore',
        targetOptions: [],
        expectedEffects: ['no cost', 'rival grows'],
      },
    ],
    consequenceProfiles: [
      {
        id: `${id}-price-profile`,
        responseSlotId: `${id}-price`,
        immediateEffects: [
          {
            kind: 'state_change',
            target: 'customers.local_goblins.patronage',
            amount: 8,
            readable: 'locals drift back',
            tags: ['customer'],
          },
          {
            kind: 'state_change',
            target: 'coin',
            amount: -12,
            readable: 'margin erodes',
            tags: ['coin'],
          },
        ],
        delayedEffects: [],
        memories: [],
        futureHooks: [],
        impactScore: 4,
      },
      {
        id: `${id}-quality-profile`,
        responseSlotId: `${id}-quality`,
        immediateEffects: [
          {
            kind: 'state_change',
            target: 'reputation.tasty',
            amount: 12,
            readable: 'quality reputation rises',
            tags: ['reputation'],
          },
        ],
        delayedEffects: [],
        memories: [],
        futureHooks: [],
        impactScore: 6,
      },
      {
        id: `${id}-ignore-profile`,
        responseSlotId: `${id}-ignore`,
        immediateEffects: [
          {
            kind: 'state_change',
            target: 'noop',
            amount: 0,
            readable: 'nothing changes',
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
      subject: 'the rival tavern',
      sensoryDetails: ['emptier seats tonight'],
      recentContext: ['rival pulling crowds'],
      stakesReadable: ['rival may steal market'],
    },
  })
}

function withArcLabel(
  state: TavernState,
  arcId: string,
  label: string,
): TavernState {
  return {
    ...state,
    world: {
      ...state.world,
      localEvents: {
        ...state.world.localEvents,
        [arcId]: {
          ...(state.world.localEvents[arcId] ?? {
            id: arcId,
            tags: [],
            severity: 50,
          }),
          id: arcId,
          label,
        },
      } as TavernState['world']['localEvents'],
    },
  }
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
  rivalTavernEstablishingLinePool.snippets.map((s) => s.text),
)
const REACTION_TEXTS = new Set(
  rivalTavernReactionLinePool.snippets.map((s) => s.text),
)
const TITLE_TEXTS = new Set(rivalTavernTitlePool.snippets.map((s) => s.text))

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

describe('rivalTavernCard — appliesTo', () => {
  const state = createInitialTavernState()

  it('is registered in REQUIRED_CARDS', () => {
    expect(REQUIRED_CARDS).toContain(rivalTavernCard)
  })

  it('matches a system-ref rival seed (no arc active)', () => {
    const seed = rivalTavernSeed(systemRivalRef())
    const chosen = pickCardForSeed(seed, state, REQUIRED_CARDS)
    expect(chosen?.id).toBe(rivalTavernCard.id)
  })

  it('matches an arc-ref rival seed (rival local event active)', () => {
    const arcId = 'rival_arc_a'
    const stateWithArc = withArcLabel(state, arcId, 'The Crooked Pint')
    const seed = rivalTavernSeed(arcRivalRef(arcId), 'rival-tavern-arc', {
      domain: ['rival', 'market', 'customers', 'rival.arc'],
    })
    const chosen = pickCardForSeed(seed, stateWithArc, REQUIRED_CARDS)
    expect(chosen?.id).toBe(rivalTavernCard.id)
  })
})

describe('rivalTavernCard — render output', () => {
  it('body[0] is the sim-backed establishing line; body[1] is the flavor reaction', () => {
    const state = createInitialTavernState()
    const seed = rivalTavernSeed(systemRivalRef())
    const view = rivalTavernCard.render(seed, state)
    expect(view.body[0]).toBeDefined()
    expect(view.body[1]).toBeDefined()
    expect(ESTABLISHING_TEXTS.has(view.body[0]!)).toBe(true)
    expect(REACTION_TEXTS.has(view.body[1]!)).toBe(true)
    expect(wordCount(view.body[0]!)).toBeLessThanOrEqual(14)
    expect(wordCount(view.body[1]!)).toBeLessThanOrEqual(12)
  })

  it('body never surfaces raw textIngredients fragments', () => {
    const state = createInitialTavernState()
    const seed = rivalTavernSeed(systemRivalRef())
    const view = rivalTavernCard.render(seed, state)
    for (const line of view.body) {
      expect(line).not.toBe('emptier seats tonight')
      expect(line).not.toBe('rival pulling crowds')
      expect(line).not.toBe('rival may steal market')
    }
  })

  it('title prefix is the arc label when one is active', () => {
    const arcId = 'rival_arc_a'
    const state = withArcLabel(createInitialTavernState(), arcId, 'The Black Lantern')
    const seed = rivalTavernSeed(arcRivalRef(arcId), 'rival-tavern-arc-render', {
      domain: ['rival', 'market', 'customers', 'rival.arc'],
    })
    const view = rivalTavernCard.render(seed, state)
    expect(view.title.startsWith('The Black Lantern: ')).toBe(true)
    const snippet = view.title.slice('The Black Lantern: '.length)
    expect(TITLE_TEXTS.has(snippet)).toBe(true)
    expect(view.title).not.toContain('…')
    expect(view.title).not.toContain('...')
  })

  it('title prefix falls back to `Rival tavern` for the system ref', () => {
    const state = createInitialTavernState()
    const seed = rivalTavernSeed(systemRivalRef())
    const view = rivalTavernCard.render(seed, state)
    expect(view.title.startsWith('Rival tavern: ')).toBe(true)
    const snippet = view.title.slice('Rival tavern: '.length)
    expect(TITLE_TEXTS.has(snippet)).toBe(true)
    expect(view.title).not.toContain('…')
    expect(view.title).not.toContain('...')
  })

  it('establishing_line fires the rising-pressure snippet when rival_tavern_pressure trends positive', () => {
    const state = createInitialTavernState()
    const rising = withRisingPressure(state, 'rival_tavern_pressure')
    const seed = rivalTavernSeed(systemRivalRef(), 'rival-tavern-pressure')
    const view = rivalTavernCard.render(seed, rising)
    expect([
      'Rival_tavern_pressure has been climbing onto the books for days.',
      'An unnamed competitor is bleeding patronage off the books.',
    ]).toContain(view.body[0])
  })

  it('establishing_line fires the rival.arc snippet when arc tag + rising pressure are both present', () => {
    const state = createInitialTavernState()
    const arcId = 'rival_arc_b'
    let withLabel = withArcLabel(state, arcId, 'The Crooked Pint')
    withLabel = withRisingPressure(withLabel, 'rival_tavern_pressure')
    const seed = rivalTavernSeed(arcRivalRef(arcId), 'rival-tavern-arc-est', {
      domain: ['rival', 'market', 'customers', 'rival.arc'],
    })
    const view = rivalTavernCard.render(seed, withLabel)
    // The rival.arc + pressureRising top rung is the only snippet that
    // fires under this state combination.
    expect(view.body[0]).toBe(
      'The rival house has a name and momentum behind it now.',
    )
  })

  it('establishing_line fires the compete-memory snippet when a price memory is present', () => {
    const state = createInitialTavernState()
    const remembered = withMemory(state, 'rival_priced_recently', ['rival', 'price'])
    const seed = rivalTavernSeed(systemRivalRef(), 'rival-tavern-mem')
    const view = rivalTavernCard.render(seed, remembered)
    // Both the compete-memory snippet and the system-tag snippet have
    // specificity 1 (one condition each); FNV tie-break decides which
    // wins. Accept either valid sim-anchored rung.
    expect([
      'The price cut from before is still being measured against theirs.',
      'An unnamed competitor is bleeding patronage off the books.',
    ]).toContain(view.body[0])
  })

  it('preserves choice mechanical truth (verb, shape, target options)', () => {
    const state = createInitialTavernState()
    const seed = rivalTavernSeed(systemRivalRef())
    const view = rivalTavernCard.render(seed, state)
    expect(view.choices.length).toBe(seed.responseSlots.length)
    for (const choice of view.choices) {
      const slot = seed.responseSlots.find((s) => s.id === choice.slotId)!
      expect(slot.allowedVerbs).toContain(choice.verb)
      expect(slot.shape).toBe(choice.shape)
    }
  })

  it('tags and severity flow from the seed', () => {
    const state = createInitialTavernState()
    const seed = rivalTavernSeed(systemRivalRef(), 'rival-tavern-tag', { severity: 75 })
    const view = rivalTavernCard.render(seed, state)
    expect(view.tag).toBe('rival_tavern')
    expect(view.severity).toBe(75)
  })

  it('is deterministic — same seed + state ⇒ identical CardView', () => {
    const state = createInitialTavernState()
    const seed = rivalTavernSeed(systemRivalRef(), 'rival-tavern-deterministic')
    const a = rivalTavernCard.render(seed, state)
    const b = rivalTavernCard.render(seed, structuredClone(state) as TavernState)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('does not mutate state', () => {
    const state = createInitialTavernState()
    const seed = rivalTavernSeed(systemRivalRef())
    const before = JSON.stringify(state)
    rivalTavernCard.render(seed, state)
    expect(JSON.stringify(state)).toBe(before)
  })
})

describe('rivalTavernCard — ownerless guarantee', () => {
  it('every pool is free of actor-voice conditions (the rival has no castAttributes)', () => {
    expect(poolHasActorCondition(rivalTavernTitlePool)).toBe(false)
    expect(poolHasActorCondition(rivalTavernEstablishingLinePool)).toBe(false)
    expect(poolHasActorCondition(rivalTavernReactionLinePool)).toBe(false)
    expect(poolHasActorCondition(rivalTavernMannerNotePool)).toBe(false)
    expect(poolHasActorCondition(rivalTavernChoiceLabelPool)).toBe(false)
  })
})
