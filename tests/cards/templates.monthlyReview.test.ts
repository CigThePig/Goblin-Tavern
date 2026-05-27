// Phase 140 / ISSUE-109 — Voiced Surface arc, Phase 14 (Periodic & Narrative Beats).
//
// Integration tests for `monthlyReviewCard` — rewritten in place from
// the legacy hand-written template (`composeBody` + raw `${label}
// ${value} (${trend})` pressure dumps) to a compositional template.
// Narrator-voiced — the seed's primaryActor is a `{ kind: 'other',
// id: 'month:${monthKey}' }` ref with no castAttributes (audit pass 1
// §5.3 — periods are not characters). Variety comes from state
// perturbation (pressure trends across landlord / debt /
// reputation_drift / staff_burnout / etc., prior-monthly memories,
// calendar tags, severity, repeat count).

import { describe, expect, it } from 'vitest'

import {
  monthlyReviewCard,
  fallbackCard,
} from '../../src/cards/index'
import { pickCardForSeed } from '../../src/cards/selection'
import {
  monthlyReviewChoiceLabelPool,
  monthlyReviewEstablishingLinePool,
  monthlyReviewMannerNotePool,
  monthlyReviewReactionLinePool,
  monthlyReviewTitlePool,
} from '../../src/cards/compose/pools/monthlyReview'
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

function monthlyReviewSeed(
  id = 'monthly-review-seed',
  overrides: { severity?: number; toneHints?: string[]; domain?: string[] } = {},
): IssueSeed {
  return makeSeed({
    id,
    family: 'monthly_review' as IssueSeedFamilyId,
    type: 'monthly_review',
    timing: 'end_month',
    severity: overrides.severity ?? 40,
    domain: overrides.domain ?? ['monthly', 'economy', 'reputation'],
    toneHints: overrides.toneHints ?? ['summary', 'monthly'],
    primaryActor: { kind: 'other', id: 'month:1' },
    responseSlots: [
      {
        id: `${id}-pay`,
        labelHint: 'Pay the landlord on time',
        allowedVerbs: ['pay'],
        shape: 'safe_costly',
        targetOptions: [{ kind: 'system', id: 'landlord' }],
        expectedEffects: ['lower landlord pressure', 'spend coin'],
      },
      {
        id: `${id}-upgrade`,
        labelHint: 'Invest in the cellar',
        allowedVerbs: ['upgrade'],
        shape: 'long_term_investment',
        targetOptions: [{ kind: 'area', id: 'cellar' }],
        expectedEffects: ['improve cellar'],
      },
      {
        id: `${id}-delay`,
        labelHint: 'Hold reserves through next month',
        allowedVerbs: ['delay'],
        shape: 'compromise',
        targetOptions: [{ kind: 'system', id: 'reserves' }],
        expectedEffects: ['lower debt'],
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
            amount: -25,
            readable: 'lower landlord pressure',
            tags: ['pressure', 'landlord'],
          },
        ],
        delayedEffects: [],
        memories: [],
        futureHooks: [],
        impactScore: 7,
      },
      {
        id: `${id}-upgrade-profile`,
        responseSlotId: `${id}-upgrade`,
        immediateEffects: [
          {
            kind: 'state_change',
            target: 'areas.cellar.condition',
            amount: 12,
            readable: 'cellar improves',
            tags: ['area', 'cellar'],
          },
        ],
        delayedEffects: [],
        memories: [],
        futureHooks: [],
        impactScore: 5,
      },
      {
        id: `${id}-delay-profile`,
        responseSlotId: `${id}-delay`,
        immediateEffects: [
          {
            kind: 'pressure',
            target: 'pressure:debt',
            amount: -4,
            readable: 'reserves held',
            tags: ['pressure', 'debt'],
          },
        ],
        delayedEffects: [],
        memories: [],
        futureHooks: [],
        impactScore: 3,
      },
    ],
    textIngredients: {
      subject: 'month 1',
      sensoryDetails: ['ledger closed', 'lamps trimmed'],
      recentContext: ['net coin change -10'],
      stakesReadable: ['rent may slip', 'coin reserves at stake'],
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
  monthlyReviewEstablishingLinePool.snippets.map((s) => s.text),
)
const REACTION_TEXTS = new Set(
  monthlyReviewReactionLinePool.snippets.map((s) => s.text),
)
const TITLE_TEXTS = new Set(monthlyReviewTitlePool.snippets.map((s) => s.text))

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

describe('monthlyReviewCard — appliesTo', () => {
  const state = createInitialTavernState()

  it('is registered in REQUIRED_CARDS', () => {
    expect(REQUIRED_CARDS).toContain(monthlyReviewCard)
  })

  it('matches a monthly_review / monthly_review / end_month seed', () => {
    const seed = monthlyReviewSeed()
    const chosen = pickCardForSeed(seed, state, REQUIRED_CARDS)
    expect(chosen?.id).toBe(monthlyReviewCard.id)
  })

  it('does not match a morning_prep timing (falls back)', () => {
    const seed = monthlyReviewSeed('monthly-review-wrong-timing')
    const mismatched: IssueSeed = { ...seed, timing: 'morning_prep' }
    const chosen = pickCardForSeed(mismatched, state, REQUIRED_CARDS)
    expect(chosen?.id).not.toBe(monthlyReviewCard.id)
    expect(chosen?.id).toBe(fallbackCard.id)
  })
})

describe('monthlyReviewCard — render output', () => {
  it('body[0] is the sim-backed establishing line; body[1] is the flavor reaction', () => {
    const state = createInitialTavernState()
    const seed = monthlyReviewSeed()
    const view = monthlyReviewCard.render(seed, state)
    expect(view.body[0]).toBeDefined()
    expect(view.body[1]).toBeDefined()
    expect(ESTABLISHING_TEXTS.has(view.body[0]!)).toBe(true)
    expect(REACTION_TEXTS.has(view.body[1]!)).toBe(true)
    expect(wordCount(view.body[0]!)).toBeLessThanOrEqual(14)
    expect(wordCount(view.body[1]!)).toBeLessThanOrEqual(12)
  })

  it('body never surfaces raw textIngredients or mechanical pressure readouts', () => {
    const state = createInitialTavernState()
    const seed = monthlyReviewSeed()
    const view = monthlyReviewCard.render(seed, state)
    for (const line of view.body) {
      expect(line).not.toBe('ledger closed')
      expect(line).not.toBe('lamps trimmed')
      expect(line).not.toBe('net coin change -10')
      expect(line).not.toMatch(/debt \d+/i)
      expect(line).not.toMatch(/landlord \d+/i)
      expect(line).not.toMatch(/\(\+\d+\)/)
      expect(line).not.toMatch(/\(-\d+\)/)
    }
  })

  it('title is prefixed with the fixed "Month in review:" frame', () => {
    const state = createInitialTavernState()
    const seed = monthlyReviewSeed()
    const view = monthlyReviewCard.render(seed, state)
    expect(view.title.startsWith('Month in review: ')).toBe(true)
    const snippet = view.title.slice('Month in review: '.length)
    expect(TITLE_TEXTS.has(snippet)).toBe(true)
    expect(view.title).not.toContain('…')
    expect(view.title).not.toContain('...')
  })

  it('establishing_line fires the rising-landlord snippet when landlord pressure trends positive', () => {
    const state = createInitialTavernState()
    const rising = withRisingPressure(state, 'landlord')
    const seed = monthlyReviewSeed('monthly-review-landlord-rising')
    const view = monthlyReviewCard.render(seed, rising)
    expect(view.body[0]).toBe(
      'The landlord column has thickened with each pass this month.',
    )
  })

  it('establishing_line fires the rising-debt snippet when debt pressure trends positive', () => {
    const state = createInitialTavernState()
    const rising = withRisingPressure(state, 'debt')
    const seed = monthlyReviewSeed('monthly-review-debt-rising')
    const view = monthlyReviewCard.render(seed, rising)
    expect(view.body[0]).toBe(
      'The shortfall on the page has been widening week by week.',
    )
  })

  // Phase 162 / ISSUE-130 — Legible Surface Phase 17, iteration #1.
  // The "rent_due_soon snippet when seed carries the tag" test was
  // removed alongside the snippet it covered. `rxn_rent_due_soon` was
  // authored in Phase 140 expecting the monthly_review seed to thread
  // the `rent_due_soon` calendar tag through seed.domain / toneHints,
  // but the seed at `issueSeedGenerators.ts:3844-3868` never did — so
  // the snippet was dead in production from the start. The test only
  // passed by manually injecting the tag through toneHints, which is
  // not a real production state shape. Snippet + test pruned per the
  // Phase 156 / ISSUE-124 plan deferral.

  it('establishing_line fires a memory snippet when a rent memory is present', () => {
    const state = createInitialTavernState()
    const remembered = withMemory(state, 'rent_paid_1', ['rent', 'paid', 'monthly'])
    const seed = monthlyReviewSeed('monthly-review-rent-mem')
    const view = monthlyReviewCard.render(seed, remembered)
    // The 'rent' memory snippet has specificity 1; the unconditional
    // fallback has specificity 0. FNV tie-break with the fallback
    // shouldn't fire because the rent memory wins on specificity.
    expect(view.body[0]).toBe(
      'Last month closed with rent settled; this one wants the same.',
    )
  })

  it('emits valid choices whose verbs are in seed.responseSlots.allowedVerbs', () => {
    const state = createInitialTavernState()
    const seed = monthlyReviewSeed()
    const view = monthlyReviewCard.render(seed, state)
    expect(view.choices.length).toBeGreaterThan(0)
    for (const choice of view.choices) {
      const slot = seed.responseSlots.find((s) => s.id === choice.slotId)
      expect(slot, `slot ${choice.slotId} resolves`).toBeDefined()
      expect(slot!.allowedVerbs).toContain(choice.verb)
    }
  })

  it('preserves choice mechanical truth: verb, shape, preview count unchanged by composition', () => {
    const state = createInitialTavernState()
    const seed = monthlyReviewSeed()
    const view = monthlyReviewCard.render(seed, state)
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
    const seed = monthlyReviewSeed('monthly-review-tag', { severity: 75 })
    const view = monthlyReviewCard.render(seed, state)
    expect(view.tag).toBe('monthly_review')
    expect(view.severity).toBe(75)
  })

  it('is deterministic — same seed + state ⇒ identical CardView', () => {
    const state = createInitialTavernState()
    const seed = monthlyReviewSeed('monthly-review-deterministic')
    const a = monthlyReviewCard.render(seed, state)
    const b = monthlyReviewCard.render(seed, structuredClone(state) as TavernState)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('does not mutate state', () => {
    const state = createInitialTavernState()
    const seed = monthlyReviewSeed()
    const before = JSON.stringify(state)
    monthlyReviewCard.render(seed, state)
    expect(JSON.stringify(state)).toBe(before)
  })
})

describe('monthlyReviewCard — ownerless guarantee', () => {
  it('every pool is free of actor-voice conditions (no actor with castAttributes would resolve)', () => {
    expect(poolHasActorCondition(monthlyReviewTitlePool)).toBe(false)
    expect(poolHasActorCondition(monthlyReviewEstablishingLinePool)).toBe(false)
    expect(poolHasActorCondition(monthlyReviewReactionLinePool)).toBe(false)
    expect(poolHasActorCondition(monthlyReviewMannerNotePool)).toBe(false)
    expect(poolHasActorCondition(monthlyReviewChoiceLabelPool)).toBe(false)
  })
})
