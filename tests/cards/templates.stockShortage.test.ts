// Phase 135 / ISSUE-104 — Voiced Surface arc, Phase 9 (Suppliers, Stock & Debt).
//
// Integration tests for `stockShortageCard` — first dedicated card for
// the stock_shortage family. Narrator-voiced (no primaryActor on the
// seed), so every snippet pool is free of `voiceAxis` / `verbalTic`
// conditions. Variety comes from state perturbation (pressures rising,
// memories, calendar tags, severity).

import { describe, expect, it } from 'vitest'

import {
  stockShortageCard,
  fallbackCard,
} from '../../src/cards/index'
import { pickCardForSeed } from '../../src/cards/selection'
import {
  stockShortageChoiceLabelPool,
  stockShortageEstablishingLinePool,
  stockShortageMannerNotePool,
  stockShortageReactionLinePool,
  stockShortageTitlePool,
} from '../../src/cards/compose/pools/stockShortage'
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

function stockShortageSeed(
  id = 'stock-shortage-seed',
  overrides: { severity?: number; toneHints?: string[]; domain?: string[] } = {},
): IssueSeed {
  return makeSeed({
    id,
    family: 'stock_shortage' as IssueSeedFamilyId,
    type: 'warning',
    timing: 'morning_prep',
    severity: overrides.severity ?? 50,
    domain: overrides.domain ?? ['stock', 'customers'],
    toneHints: overrides.toneHints ?? ['warning'],
    responseSlots: [
      {
        id: `${id}-restock`,
        labelHint: 'Restock ale',
        allowedVerbs: ['buy'],
        shape: 'safe_costly',
        targetOptions: [{ kind: 'stock', id: 'ale' }],
        expectedEffects: ['raise ale quantity', 'spend coin'],
      },
      {
        id: `${id}-ignore`,
        labelHint: 'Ignore the shortage',
        allowedVerbs: ['ignore'],
        shape: 'ignore',
        targetOptions: [],
        expectedEffects: ['no immediate change'],
      },
    ],
    consequenceProfiles: [
      {
        id: `${id}-restock-profile`,
        responseSlotId: `${id}-restock`,
        immediateEffects: [
          {
            kind: 'state_change',
            target: 'stock.ale.quantity',
            amount: 60,
            readable: 'add ale to stock',
            tags: ['stock'],
          },
          {
            kind: 'state_change',
            target: 'coin',
            amount: -30,
            readable: 'spend coin restocking',
            tags: ['coin'],
          },
        ],
        delayedEffects: [],
        memories: [],
        futureHooks: [],
        impactScore: 7,
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
      subject: 'ale stock',
      problemNoun: 'low stock',
      sensoryDetails: ['empty kegs', 'thirsty regulars'],
      recentContext: ['ale sales heavy this week'],
    },
  })
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
        ...(state.pressures[pressureId] ?? {
          id: pressureId,
          label: pressureId,
          tags: [],
          topCauses: [],
        }),
        value,
        trend: 1,
        tags: state.pressures[pressureId]?.tags ?? [],
        topCauses: state.pressures[pressureId]?.topCauses ?? [],
      },
    },
  }
}

function withMemory(state: TavernState, memoryId: string, tags: string[]): TavernState {
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

const ESTABLISHING_TEXTS = new Set(
  stockShortageEstablishingLinePool.snippets.map((s) => s.text),
)
const REACTION_TEXTS = new Set(
  stockShortageReactionLinePool.snippets.map((s) => s.text),
)
const TITLE_TEXTS = new Set(stockShortageTitlePool.snippets.map((s) => s.text))

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length
}

function poolHasActorCondition(pool: SnippetPool): boolean {
  return pool.snippets.some((snippet) =>
    snippet.conditions.some((c: SnippetCondition) =>
      c.kind === 'voiceAxis' || c.kind === 'verbalTic' || c.kind === 'actorTrait',
    ),
  )
}

describe('stockShortageCard — appliesTo', () => {
  const state = createInitialTavernState()

  it('is registered in REQUIRED_CARDS', () => {
    expect(REQUIRED_CARDS).toContain(stockShortageCard)
  })

  it('matches a stock_shortage / warning / morning_prep seed', () => {
    const seed = stockShortageSeed()
    const chosen = pickCardForSeed(seed, state, REQUIRED_CARDS)
    expect(chosen?.id).toBe(stockShortageCard.id)
  })

  it('does not match a different family (the legacy supplier_offer family)', () => {
    const seed = makeSeed({
      family: 'supplier_relationship' as IssueSeedFamilyId,
      type: 'supplier_offer',
      timing: 'morning_prep',
    })
    const chosen = pickCardForSeed(seed, state, REQUIRED_CARDS)
    expect(chosen?.id).not.toBe(stockShortageCard.id)
  })

  it('falls back when no template can be selected at all (unknown family + timing)', () => {
    const seed = makeSeed({
      family: 'stock_shortage' as IssueSeedFamilyId,
      type: 'warning',
      // mismatched timing — neither morning_prep nor any other template
      // claims this combination, so selection falls to fallbackCard.
      timing: 'closing',
    })
    const chosen = pickCardForSeed(seed, state, REQUIRED_CARDS)
    expect(chosen?.id).not.toBe(stockShortageCard.id)
    expect(chosen?.id).toBe(fallbackCard.id)
  })
})

describe('stockShortageCard — render output', () => {
  it('body[0] is the sim-backed establishing line; body[1] is the flavor reaction', () => {
    const state = createInitialTavernState()
    const seed = stockShortageSeed()
    const view = stockShortageCard.render(seed, state)
    expect(view.body[0]).toBeDefined()
    expect(view.body[1]).toBeDefined()
    expect(ESTABLISHING_TEXTS.has(view.body[0]!)).toBe(true)
    expect(REACTION_TEXTS.has(view.body[1]!)).toBe(true)
    expect(wordCount(view.body[0]!)).toBeLessThanOrEqual(14)
    expect(wordCount(view.body[1]!)).toBeLessThanOrEqual(12)
  })

  it('body never surfaces raw textIngredients fragments or mechanical readouts', () => {
    const state = createInitialTavernState()
    const seed = stockShortageSeed()
    const view = stockShortageCard.render(seed, state)
    for (const line of view.body) {
      expect(line).not.toBe('empty kegs')
      expect(line).not.toBe('thirsty regulars')
      expect(line).not.toBe('ale sales heavy this week')
      expect(line.toLowerCase()).not.toBe('low stock')
      expect(line).not.toMatch(/quantity \d+/)
    }
  })

  it('title has no actor-display prefix (no colon-delimited owner mention)', () => {
    const state = createInitialTavernState()
    const seed = stockShortageSeed()
    const view = stockShortageCard.render(seed, state)
    expect(view.title).not.toContain(':')
    expect(TITLE_TEXTS.has(view.title)).toBe(true)
    expect(view.title).not.toContain('…')
    expect(view.title).not.toContain('...')
  })

  it('establishing_line fires the rising-pressure snippet when stock_shortage pressure trends positive', () => {
    const state = createInitialTavernState()
    const rising = withRisingPressure(state, 'stock_shortage')
    const seed = stockShortageSeed('stock-shortage-rising')
    const view = stockShortageCard.render(seed, rising)
    expect(view.body[0]).toBe('The shelves have been thinning faster than the deliveries can catch.')
  })

  it('reaction_line picks a tag-specific snippet when seed tones name it', () => {
    const state = createInitialTavernState()
    const seed = stockShortageSeed('stock-shortage-busy', {
      toneHints: ['urgent', 'high_demand'],
    })
    const view = stockShortageCard.render(seed, state)
    // Both `urgent` and `high_demand` are single-condition middle-rung
    // gates; FNV tie-break decides which fires. Either is a sim-coherent
    // tag-driven reaction — both beat the fallback "morning asks what
    // the cellar can spare today" line.
    expect([
      'The room will be loud by midday; the kegs will not last.',
      'This will not keep until tomorrow; the morning needs an answer.',
    ]).toContain(view.body[1])
  })

  it('reaction_line picks the high_demand snippet when only that tag is set', () => {
    const state = createInitialTavernState()
    const seed = stockShortageSeed('stock-shortage-high-demand-only', {
      toneHints: ['high_demand'],
    })
    const view = stockShortageCard.render(seed, state)
    expect(view.body[1]).toBe('The room will be loud by midday; the kegs will not last.')
  })

  it('establishing_line fires the memory snippet when a deception memory is present', () => {
    const state = createInitialTavernState()
    const dirty = withMemory(state, 'watered_ale_recently', ['ale', 'deception'])
    const seed = stockShortageSeed('stock-shortage-watered')
    const view = stockShortageCard.render(seed, dirty)
    expect(view.body[0]).toBe('The stretched batch from last week is still on the slate.')
  })

  it('emits valid choices whose verbs are in seed.responseSlots.allowedVerbs', () => {
    const state = createInitialTavernState()
    const seed = stockShortageSeed()
    const view = stockShortageCard.render(seed, state)
    expect(view.choices.length).toBeGreaterThan(0)
    for (const choice of view.choices) {
      const slot = seed.responseSlots.find((s) => s.id === choice.slotId)
      expect(slot, `slot ${choice.slotId} resolves`).toBeDefined()
      expect(slot!.allowedVerbs).toContain(choice.verb)
    }
  })

  it('preserves choice mechanical truth: verb, shape, preview count unchanged by composition', () => {
    const state = createInitialTavernState()
    const seed = stockShortageSeed()
    const view = stockShortageCard.render(seed, state)
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
    const seed = stockShortageSeed('stock-shortage-tag', { severity: 65 })
    const view = stockShortageCard.render(seed, state)
    expect(view.tag).toBe('stock_shortage')
    expect(view.severity).toBe(65)
  })

  it('is deterministic — same seed + state ⇒ identical CardView', () => {
    const state = createInitialTavernState()
    const seed = stockShortageSeed()
    const a = stockShortageCard.render(seed, state)
    const b = stockShortageCard.render(seed, structuredClone(state) as TavernState)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('does not mutate state', () => {
    const state = createInitialTavernState()
    const seed = stockShortageSeed()
    const before = JSON.stringify(state)
    stockShortageCard.render(seed, state)
    expect(JSON.stringify(state)).toBe(before)
  })
})

describe('stockShortageCard — ownerless guarantee', () => {
  it('every pool is free of actor-voice conditions (no actor would resolve)', () => {
    expect(poolHasActorCondition(stockShortageTitlePool)).toBe(false)
    expect(poolHasActorCondition(stockShortageEstablishingLinePool)).toBe(false)
    expect(poolHasActorCondition(stockShortageReactionLinePool)).toBe(false)
    expect(poolHasActorCondition(stockShortageMannerNotePool)).toBe(false)
    expect(poolHasActorCondition(stockShortageChoiceLabelPool)).toBe(false)
  })
})
