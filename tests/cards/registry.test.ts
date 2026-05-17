import { describe, expect, it } from 'vitest'

import {
  Registry,
} from '../../src/sim/registries/Registry'
import {
  appliesToMatches,
  compareCards,
  pickCardForSeed,
  specificity,
} from '../../src/cards/selection'
import {
  REQUIRED_CARDS,
  FALLBACK_CARD_ID,
  cardRegistry,
  pickCard,
} from '../../src/cards/index'
import type { CardDefinition } from '../../src/cards/types'

import { makeSeed, makeTavernState } from './cardFactories'

describe('cards/registry — registration', () => {
  it('registers all required cards on import', () => {
    const ids = new Set(cardRegistry.all().map((c) => c.id))
    for (const c of REQUIRED_CARDS) {
      expect(ids.has(c.id)).toBe(true)
    }
  })

  it('includes the fallback under the well-known id', () => {
    expect(cardRegistry.has(FALLBACK_CARD_ID)).toBe(true)
  })

  it('Registry rejects duplicate ids', () => {
    const local = new Registry<CardDefinition>()
    const card: CardDefinition = {
      id: 'x',
      appliesTo: {},
      render: () => ({ title: 'x', body: [], stakes: [], choices: [] }),
    }
    local.register(card)
    expect(() => local.register(card)).toThrow(/Duplicate registry id/)
  })
})

describe('cards/selection — appliesToMatches', () => {
  it('matches when all constraints pass', () => {
    const seed = makeSeed({
      family: 'food_safety',
      type: 'crisis',
      timing: 'during_service',
      severity: 80,
      cardWorthiness: 70,
    })
    const state = makeTavernState()
    expect(
      appliesToMatches(
        {
          seedFamilies: ['food_safety'],
          seedTypes: ['crisis'],
          timings: ['during_service'],
          minSeverity: 60,
          minCardWorthiness: 50,
        },
        seed,
        state,
      ),
    ).toBe(true)
  })

  it('rejects when family mismatches', () => {
    const seed = makeSeed({ family: 'food_safety' })
    expect(
      appliesToMatches({ seedFamilies: ['maintenance'] }, seed, makeTavernState()),
    ).toBe(false)
  })

  it('rejects when severity is below threshold', () => {
    const seed = makeSeed({ severity: 40 })
    expect(
      appliesToMatches({ minSeverity: 60 }, seed, makeTavernState()),
    ).toBe(false)
  })

  it('rejects when cardWorthiness is below threshold', () => {
    const seed = makeSeed({ cardWorthiness: 20 })
    expect(
      appliesToMatches({ minCardWorthiness: 50 }, seed, makeTavernState()),
    ).toBe(false)
  })

  it('honours the custom predicate', () => {
    const seed = makeSeed({ id: 'pick-me' })
    expect(
      appliesToMatches(
        { custom: (s) => s.id === 'pick-me' },
        seed,
        makeTavernState(),
      ),
    ).toBe(true)
    expect(
      appliesToMatches(
        { custom: (s) => s.id === 'no-match' },
        seed,
        makeTavernState(),
      ),
    ).toBe(false)
  })

  it('matches empty appliesTo against every seed', () => {
    const seed = makeSeed()
    expect(appliesToMatches({}, seed, makeTavernState())).toBe(true)
  })
})

describe('cards/selection — specificity scoring', () => {
  it('scores array constraints by entry count', () => {
    expect(specificity({})).toBe(0)
    expect(specificity({ seedFamilies: ['food_safety'] })).toBe(1)
    expect(specificity({ seedFamilies: ['food_safety', 'maintenance'] })).toBe(2)
  })

  it('scores numeric thresholds as 1 each', () => {
    expect(specificity({ minSeverity: 50, minCardWorthiness: 30 })).toBe(2)
  })

  it('weighs custom predicates higher than simple constraints', () => {
    const simple = specificity({ seedFamilies: ['food_safety'] })
    const withCustom = specificity({
      seedFamilies: ['food_safety'],
      custom: () => true,
    })
    expect(withCustom).toBeGreaterThan(simple)
  })
})

describe('cards/selection — pickCardForSeed ordering', () => {
  function render(): { title: string; body: string[]; stakes: never[]; choices: never[] } {
    return { title: '', body: [], stakes: [], choices: [] }
  }

  it('priority desc wins over specificity', () => {
    const high: CardDefinition = {
      id: 'high',
      appliesTo: {},
      priority: 90,
      render,
    }
    const specific: CardDefinition = {
      id: 'specific',
      appliesTo: {
        seedFamilies: ['food_safety'],
        seedTypes: ['crisis'],
        timings: ['during_service'],
      },
      priority: 50,
      render,
    }
    const seed = makeSeed()
    const picked = pickCardForSeed(seed, makeTavernState(), [high, specific])
    expect(picked?.id).toBe('high')
  })

  it('specificity breaks priority ties', () => {
    const general: CardDefinition = {
      id: 'general',
      appliesTo: {},
      priority: 50,
      render,
    }
    const specific: CardDefinition = {
      id: 'specific',
      appliesTo: {
        seedFamilies: ['food_safety'],
        seedTypes: ['crisis'],
      },
      priority: 50,
      render,
    }
    const seed = makeSeed()
    const picked = pickCardForSeed(seed, makeTavernState(), [general, specific])
    expect(picked?.id).toBe('specific')
  })

  it('id asc breaks specificity ties', () => {
    const a: CardDefinition = {
      id: 'a',
      appliesTo: { seedFamilies: ['food_safety'] },
      priority: 50,
      render,
    }
    const b: CardDefinition = {
      id: 'b',
      appliesTo: { seedFamilies: ['food_safety'] },
      priority: 50,
      render,
    }
    const seed = makeSeed()
    const picked = pickCardForSeed(seed, makeTavernState(), [b, a])
    expect(picked?.id).toBe('a')
  })

  it('compareCards is a stable comparator', () => {
    const a: CardDefinition = { id: 'a', appliesTo: {}, priority: 1, render }
    const b: CardDefinition = { id: 'b', appliesTo: {}, priority: 1, render }
    expect(compareCards(a, b)).toBeLessThan(0)
    expect(compareCards(b, a)).toBeGreaterThan(0)
    expect(compareCards(a, a)).toBe(0)
  })
})

describe('cards/registry — pickCard end-to-end', () => {
  it('renders a food-safety crisis through the crisis template', () => {
    const seed = makeSeed({
      family: 'food_safety',
      type: 'crisis',
      timing: 'during_service',
      severity: 80,
    })
    const view = pickCard(seed, makeTavernState())
    expect(view.title).toMatch(/spoiled stew/i)
    expect(view.severity).toBe(80)
    expect(view.tag).toBe('food_safety')
    expect(view.choices.length).toBeGreaterThan(0)
  })

  it('renders an unmatched seed through the fallback', () => {
    const seed = makeSeed({
      family: 'rumour_crisis',
      type: 'rumour',
      timing: 'morning_prep',
      severity: 30,
    })
    const view = pickCard(seed, makeTavernState())
    expect(view.title.length).toBeGreaterThan(0)
    expect(view.choices.length).toBeGreaterThan(0)
  })
})
