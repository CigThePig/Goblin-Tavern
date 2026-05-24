// Phase 135 / ISSUE-104 — Voiced Surface arc, Phase 9 (Suppliers, Stock & Debt).
//
// Integration tests for `debtRentCard` — first dedicated card for the
// debt_rent family. Narrator-voiced (the seed has no primaryActor —
// landlord is `systemRef`, audit pass 1 §5.3), so every snippet pool is
// free of `voiceAxis` / `verbalTic` conditions. Variety comes from
// state perturbation (debt / landlord pressure trending, memories,
// calendar tags, severity). Timing is `end_month`, distinct from
// supplier and stock_shortage (both morning_prep).

import { describe, expect, it } from 'vitest'

import {
  debtRentCard,
  fallbackCard,
} from '../../src/cards/index'
import { pickCardForSeed } from '../../src/cards/selection'
import {
  debtRentChoiceLabelPool,
  debtRentEstablishingLinePool,
  debtRentMannerNotePool,
  debtRentReactionLinePool,
  debtRentTitlePool,
} from '../../src/cards/compose/pools/debtRent'
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

function debtRentSeed(
  id = 'debt-rent-seed',
  overrides: { severity?: number; toneHints?: string[]; domain?: string[] } = {},
): IssueSeed {
  return makeSeed({
    id,
    family: 'debt_rent' as IssueSeedFamilyId,
    type: 'debt_pressure',
    timing: 'end_month',
    severity: overrides.severity ?? 50,
    domain: overrides.domain ?? ['economy', 'monthly', 'landlord'],
    toneHints: overrides.toneHints ?? ['debt', 'pressure'],
    responseSlots: [
      {
        id: `${id}-pay`,
        labelHint: 'Pay what we owe',
        allowedVerbs: ['pay'],
        shape: 'safe_costly',
        targetOptions: [{ kind: 'system', id: 'landlord' }],
        expectedEffects: ['clear arrears', 'spend coin'],
      },
      {
        id: `${id}-borrow`,
        labelHint: 'Borrow coin',
        allowedVerbs: ['borrow'],
        shape: 'risky_profitable',
        targetOptions: [{ kind: 'system', id: 'lender' }],
        expectedEffects: ['gain coin', 'create future debt'],
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
            amount: -30,
            readable: 'pay rent',
            tags: ['coin', 'rent'],
          },
          {
            kind: 'pressure',
            target: 'pressure:landlord',
            amount: -15,
            readable: 'lower landlord pressure',
            tags: ['pressure'],
          },
        ],
        delayedEffects: [],
        memories: [],
        futureHooks: [],
        impactScore: 7,
      },
      {
        id: `${id}-borrow-profile`,
        responseSlotId: `${id}-borrow`,
        immediateEffects: [
          {
            kind: 'state_change',
            target: 'coin',
            amount: 40,
            readable: 'borrowed coin',
            tags: ['coin'],
          },
        ],
        delayedEffects: [],
        memories: [],
        futureHooks: [],
        impactScore: 3,
      },
    ],
    textIngredients: {
      subject: 'rent due',
      problemNoun: 'shrinking coin pile',
      sensoryDetails: ['scratched ledger', 'thin coin stack'],
      recentContext: ['coin tight for weeks'],
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
  debtRentEstablishingLinePool.snippets.map((s) => s.text),
)
const REACTION_TEXTS = new Set(
  debtRentReactionLinePool.snippets.map((s) => s.text),
)
const TITLE_TEXTS = new Set(debtRentTitlePool.snippets.map((s) => s.text))

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

describe('debtRentCard — appliesTo', () => {
  const state = createInitialTavernState()

  it('is registered in REQUIRED_CARDS', () => {
    expect(REQUIRED_CARDS).toContain(debtRentCard)
  })

  it('matches a debt_rent / debt_pressure / end_month seed', () => {
    const seed = debtRentSeed()
    const chosen = pickCardForSeed(seed, state, REQUIRED_CARDS)
    expect(chosen?.id).toBe(debtRentCard.id)
  })

  it('does not match a morning_prep timing (falls back)', () => {
    const seed = debtRentSeed('debt-rent-wrong-timing')
    const mismatched: IssueSeed = { ...seed, timing: 'morning_prep' }
    const chosen = pickCardForSeed(mismatched, state, REQUIRED_CARDS)
    expect(chosen?.id).not.toBe(debtRentCard.id)
    expect(chosen?.id).toBe(fallbackCard.id)
  })
})

describe('debtRentCard — render output', () => {
  it('body[0] is the sim-backed establishing line; body[1] is the flavor reaction', () => {
    const state = createInitialTavernState()
    const seed = debtRentSeed()
    const view = debtRentCard.render(seed, state)
    expect(view.body[0]).toBeDefined()
    expect(view.body[1]).toBeDefined()
    expect(ESTABLISHING_TEXTS.has(view.body[0]!)).toBe(true)
    expect(REACTION_TEXTS.has(view.body[1]!)).toBe(true)
    expect(wordCount(view.body[0]!)).toBeLessThanOrEqual(14)
    expect(wordCount(view.body[1]!)).toBeLessThanOrEqual(12)
  })

  it('body never surfaces raw textIngredients fragments or mechanical readouts', () => {
    const state = createInitialTavernState()
    const seed = debtRentSeed()
    const view = debtRentCard.render(seed, state)
    for (const line of view.body) {
      expect(line).not.toBe('scratched ledger')
      expect(line).not.toBe('thin coin stack')
      expect(line).not.toBe('coin tight for weeks')
      expect(line.toLowerCase()).not.toBe('shrinking coin pile')
      expect(line).not.toMatch(/debt \d+/i)
      expect(line).not.toMatch(/landlord \d+/i)
    }
  })

  it('title has no actor-display prefix (no colon-delimited owner mention)', () => {
    const state = createInitialTavernState()
    const seed = debtRentSeed()
    const view = debtRentCard.render(seed, state)
    expect(view.title).not.toContain(':')
    expect(TITLE_TEXTS.has(view.title)).toBe(true)
    expect(view.title).not.toContain('…')
    expect(view.title).not.toContain('...')
  })

  it('establishing_line fires the rising-debt snippet when the debt pressure trends positive', () => {
    const state = createInitialTavernState()
    const rising = withRisingPressure(state, 'debt')
    const seed = debtRentSeed('debt-rent-rising')
    const view = debtRentCard.render(seed, rising)
    expect(view.body[0]).toBe('The debt column has been climbing every week of the month.')
  })

  it('establishing_line fires the landlord snippet when the landlord pressure trends positive', () => {
    const state = createInitialTavernState()
    const rising = withRisingPressure(state, 'landlord')
    const seed = debtRentSeed('debt-rent-landlord-rising')
    const view = debtRentCard.render(seed, rising)
    expect(view.body[0]).toBe("The landlord's patience has been thinning since the last visit.")
  })

  it('reaction_line picks the rent_due_soon snippet when seed carries the tag', () => {
    const state = createInitialTavernState()
    const seed = debtRentSeed('debt-rent-soon', {
      toneHints: ['debt', 'pressure', 'rent_due_soon'],
    })
    const view = debtRentCard.render(seed, state)
    expect(view.body[1]).toBe('There are only days left to find the rent.')
  })

  it('establishing_line surfaces the risk-memory fact when an eviction memory is present', () => {
    const state = createInitialTavernState()
    const stressed = withMemory(state, 'eviction_threat_possible', ['landlord', 'risk'])
    const seed = debtRentSeed('debt-rent-evict')
    const view = debtRentCard.render(seed, stressed)
    // Phase 149 / ISSUE-117 — the establishing_line slot opts into
    // `saliencePolicy: 'multi'`. The injected memory carries both
    // `landlord` and `risk` tags; both reads resolve. `memory risk`
    // sits ahead of `memory landlord` in the debt_rent salience table,
    // so the risk-memory snippet wins the primary pick. The line should
    // carry evidence of the eviction fact regardless of whether a
    // secondary snippet appends after (both `est_risk_memory` and a
    // joined pair satisfy the contract — what matters is that the
    // salient fact opens the line).
    expect(view.body[0]).toBeDefined()
    expect(view.body[0]).toContain('eviction warning')
  })

  it('emits valid choices whose verbs are in seed.responseSlots.allowedVerbs', () => {
    const state = createInitialTavernState()
    const seed = debtRentSeed()
    const view = debtRentCard.render(seed, state)
    expect(view.choices.length).toBeGreaterThan(0)
    for (const choice of view.choices) {
      const slot = seed.responseSlots.find((s) => s.id === choice.slotId)
      expect(slot, `slot ${choice.slotId} resolves`).toBeDefined()
      expect(slot!.allowedVerbs).toContain(choice.verb)
    }
  })

  it('preserves choice mechanical truth: verb, shape, preview count unchanged by composition', () => {
    const state = createInitialTavernState()
    const seed = debtRentSeed()
    const view = debtRentCard.render(seed, state)
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
    const seed = debtRentSeed('debt-rent-tag', { severity: 70 })
    const view = debtRentCard.render(seed, state)
    expect(view.tag).toBe('debt_rent')
    expect(view.severity).toBe(70)
  })

  it('is deterministic — same seed + state ⇒ identical CardView', () => {
    const state = createInitialTavernState()
    const seed = debtRentSeed()
    const a = debtRentCard.render(seed, state)
    const b = debtRentCard.render(seed, structuredClone(state) as TavernState)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('does not mutate state', () => {
    const state = createInitialTavernState()
    const seed = debtRentSeed()
    const before = JSON.stringify(state)
    debtRentCard.render(seed, state)
    expect(JSON.stringify(state)).toBe(before)
  })
})

describe('debtRentCard — ownerless guarantee', () => {
  it('every pool is free of actor-voice conditions (no actor would resolve)', () => {
    expect(poolHasActorCondition(debtRentTitlePool)).toBe(false)
    expect(poolHasActorCondition(debtRentEstablishingLinePool)).toBe(false)
    expect(poolHasActorCondition(debtRentReactionLinePool)).toBe(false)
    expect(poolHasActorCondition(debtRentMannerNotePool)).toBe(false)
    expect(poolHasActorCondition(debtRentChoiceLabelPool)).toBe(false)
  })
})
