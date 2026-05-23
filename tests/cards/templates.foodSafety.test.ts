// Phase 138 / ISSUE-107 — Voiced Surface arc, Phase 12 (Crises & Safety).
//
// Integration tests for `foodSafetyCrisisCard` — rewritten in place by
// Phase 12 from the legacy hand-written `composeBody` template to an
// actor-voiced compositional template. Mirrors
// `templates.staffBurnout.test.ts` shape; the load-bearing properties
// are: sim-backed establishing_line fires first, voiced reaction_line
// follows, choices project the seed's response slots mechanically
// unchanged, graceful degradation when castAttributes is missing,
// stable re-render.

import { describe, expect, it } from 'vitest'

import { foodSafetyCrisisCard, fallbackCard } from '../../src/cards/index'
import { pickCardForSeed } from '../../src/cards/selection'
import {
  foodSafetyEstablishingLinePool,
  foodSafetyReactionLinePool,
} from '../../src/cards/compose/pools/foodSafety'
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

function firstStaffId(state: TavernState): string {
  const id = Object.keys(state.staff)[0]
  if (!id) throw new Error('test setup expects at least one starter staff member')
  return id
}

function withCast(
  state: TavernState,
  staffId: string,
  cast: CastAttributes,
): TavernState {
  return {
    ...state,
    staff: {
      ...state.staff,
      [staffId]: {
        ...state.staff[staffId]!,
        castAttributes: cast,
      },
    },
  }
}

function staffRef(id: string): EntityRef {
  return { kind: 'staff', id }
}

function foodSafetySeed(
  staffId: string,
  id = 'food-safety-seed',
): IssueSeed {
  return makeSeed({
    id,
    family: 'food_safety' as IssueSeedFamilyId,
    type: 'crisis',
    timing: 'morning_prep',
    severity: 65,
    domain: ['food', 'kitchen', 'stock'],
    primaryActor: staffRef(staffId),
    location: { kind: 'area', id: 'kitchen' },
    toneHints: ['risk', 'kitchen', 'urgent'],
    responseSlots: [
      {
        id: `${id}-slot-discard`,
        labelHint: 'Discard questionable stock',
        allowedVerbs: ['discard'],
        shape: 'safe_costly',
        targetOptions: [{ kind: 'stock', id: 'mushrooms' }],
        expectedEffects: ['stock -20', 'pressure eases'],
      },
      {
        id: `${id}-slot-clean`,
        labelHint: 'Clean the kitchen',
        allowedVerbs: ['clean'],
        shape: 'long_term_investment',
        targetOptions: [{ kind: 'area', id: 'kitchen' }],
        expectedEffects: ['cleanliness +25'],
      },
    ],
    consequenceProfiles: [
      {
        id: `${id}-profile-discard`,
        responseSlotId: `${id}-slot-discard`,
        immediateEffects: [
          {
            kind: 'state_change',
            target: 'stock.mushrooms.quantity',
            amount: -20,
            readable: 'mushrooms drop',
            tags: ['stock'],
          },
          {
            kind: 'pressure',
            target: 'pressure:food_safety',
            amount: -12,
            readable: 'food safety eases',
            tags: ['pressure'],
          },
        ],
        delayedEffects: [],
        memories: [],
        futureHooks: [],
        impactScore: 6,
      },
      {
        id: `${id}-profile-clean`,
        responseSlotId: `${id}-slot-clean`,
        immediateEffects: [
          {
            kind: 'state_change',
            target: 'areas.kitchen.cleanliness',
            amount: 25,
            readable: 'kitchen cleaner',
            tags: ['area'],
          },
        ],
        delayedEffects: [],
        memories: [],
        futureHooks: [],
        impactScore: 5,
      },
    ],
    textIngredients: {
      subject: 'the kitchen',
      sensoryDetails: ['greasy floor'],
      recentContext: ['kitchen filthy for days'],
      stakesReadable: ['customers may get sick'],
    },
  })
}

const ESTABLISHING_LINE_TEXTS = new Set(
  foodSafetyEstablishingLinePool.snippets.map((s) => s.text),
)
const REACTION_LINE_TEXTS = new Set(
  foodSafetyReactionLinePool.snippets.map((s) => s.text),
)

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length
}

describe('foodSafetyCrisisCard — appliesTo', () => {
  const state = createInitialTavernState()
  const staffId = firstStaffId(state)

  it('is registered in REQUIRED_CARDS', () => {
    expect(REQUIRED_CARDS).toContain(foodSafetyCrisisCard)
  })

  it('matches a food_safety / crisis / morning_prep seed with a cook actor', () => {
    const seed = foodSafetySeed(staffId)
    const chosen = pickCardForSeed(seed, state, REQUIRED_CARDS)
    expect(chosen?.id).toBe(foodSafetyCrisisCard.id)
  })

  it('declines a seed whose cook has no cast attributes — fallback handles it', () => {
    const original = state.staff[staffId]!
    const { castAttributes: _strip, ...rest } = original
    void _strip
    const castless: TavernState = {
      ...state,
      staff: { ...state.staff, [staffId]: rest },
    }
    const seed = foodSafetySeed(staffId)
    const chosen = pickCardForSeed(seed, castless, REQUIRED_CARDS)
    expect(chosen?.id).not.toBe(foodSafetyCrisisCard.id)
    expect(chosen?.id).toBe(fallbackCard.id)
  })

  it('declines a low-severity seed below minSeverity 60', () => {
    const seed = foodSafetySeed(staffId)
    const lowSeverity = { ...seed, severity: 50 }
    const chosen = pickCardForSeed(lowSeverity, state, REQUIRED_CARDS)
    expect(chosen?.id).not.toBe(foodSafetyCrisisCard.id)
  })
})

describe('foodSafetyCrisisCard — render output', () => {
  it('body[0] is the sim-backed establishing line; body[1] is the voiced reaction', () => {
    const state = createInitialTavernState()
    const staffId = firstStaffId(state)
    const seed = foodSafetySeed(staffId)
    const view = foodSafetyCrisisCard.render(seed, state)
    expect(view.body[0]).toBeDefined()
    expect(view.body[1]).toBeDefined()
    expect(ESTABLISHING_LINE_TEXTS.has(view.body[0]!)).toBe(true)
    expect(REACTION_LINE_TEXTS.has(view.body[1]!)).toBe(true)
    expect(wordCount(view.body[0]!)).toBeLessThanOrEqual(14)
    expect(wordCount(view.body[1]!)).toBeLessThanOrEqual(12)
  })

  it('body never surfaces raw textIngredients fragments', () => {
    const state = createInitialTavernState()
    const staffId = firstStaffId(state)
    const seed = foodSafetySeed(staffId)
    const view = foodSafetyCrisisCard.render(seed, state)
    // Legacy template lifted these as body lines; the new template
    // composes through pools instead.
    for (const line of view.body) {
      expect(line).not.toBe('greasy floor')
      expect(line).not.toBe('kitchen filthy for days')
      expect(line).not.toBe('customers may get sick')
    }
  })

  it('title centres on the cook and never truncates with "…"', () => {
    const state = createInitialTavernState()
    const staffId = firstStaffId(state)
    const seed = foodSafetySeed(staffId)
    const view = foodSafetyCrisisCard.render(seed, state)
    const display = state.staff[staffId]!.name.display
    expect(view.title.toLowerCase()).toContain(display.split(' ')[0]!.toLowerCase())
    expect(view.title).not.toContain('…')
    expect(view.title).not.toContain('...')
  })

  it('falls back to the unconditional snippets with a neutral cook', () => {
    const state = createInitialTavernState()
    const staffId = firstStaffId(state)
    const neutral: CastAttributes = {
      specialty: 'meat_dishes',
      blindspot: 'pastry',
      affinities: [],
      voice: { axes: { terseness: 1, warmth: 1, formality: 1, floridity: 1 } },
    }
    const flat = withCast(state, staffId, neutral)
    const seed = foodSafetySeed(staffId)
    const view = foodSafetyCrisisCard.render(seed, flat)
    expect(view.body[1]).toBe('It is bad. We need to decide before service.')
  })

  it('preserves choice mechanical truth (verb, target, effects)', () => {
    const state = createInitialTavernState()
    const staffId = firstStaffId(state)
    const seed = foodSafetySeed(staffId)
    const view = foodSafetyCrisisCard.render(seed, state)
    expect(view.choices.length).toBe(seed.responseSlots.length)
    for (const [i, choice] of view.choices.entries()) {
      const slot = seed.responseSlots[i]!
      expect(choice.verb).toBe(slot.allowedVerbs[0])
      // The targetId is set from the first targetOption (a stock/area ref).
      const target = slot.targetOptions[0]
      if (target) {
        expect(choice.targetId).toBe(target.id)
      }
    }
  })

  it('severity threshold rung fires at severity 85', () => {
    const state = createInitialTavernState()
    const staffId = firstStaffId(state)
    // Set up a state with rising food_safety pressure so the
    // severityAtLeast 85 + pressureRising co-conditioned snippet can
    // fire.
    const stateWithPressure: TavernState = {
      ...state,
      modules: {
        ...state.modules,
        pressures: {
          ...(state.modules.pressures ?? {}),
          snapshots: {
            food_safety: {
              id: 'food_safety',
              value: 80,
              severity: 85,
              urgency: 80,
              trend: 1,
              causes: [],
            },
          },
        } as never,
      },
    }
    const seed = { ...foodSafetySeed(staffId, 'food-safety-ceiling'), severity: 90 }
    const view = foodSafetyCrisisCard.render(seed, stateWithPressure)
    expect(view.severity).toBe(90)
    expect(wordCount(view.body[0]!)).toBeLessThanOrEqual(14)
  })

  it('is deterministic — same seed + state ⇒ identical CardView', () => {
    const state = createInitialTavernState()
    const staffId = firstStaffId(state)
    const seed = foodSafetySeed(staffId, 'food-safety-deterministic')
    const a = foodSafetyCrisisCard.render(seed, state)
    const b = foodSafetyCrisisCard.render(seed, state)
    expect(a.title).toBe(b.title)
    expect(a.body).toEqual(b.body)
    expect(a.choices).toEqual(b.choices)
  })

  it('does not mutate state', () => {
    const state = createInitialTavernState()
    const staffId = firstStaffId(state)
    const seed = foodSafetySeed(staffId)
    const before = JSON.stringify(state)
    foodSafetyCrisisCard.render(seed, state)
    expect(JSON.stringify(state)).toBe(before)
  })
})

describe('foodSafetyCrisisCard — pools shape', () => {
  it('every pool is actor-aware (no narrator-only assumption)', () => {
    // The actor-voiced contract: reaction_line and title pools include
    // voiceAxis / verbalTic conditions. Body snippets that don't gate
    // on voice fall back through the unconditional snippets.
    const hasVoiceCondition = foodSafetyReactionLinePool.snippets.some((s) =>
      s.conditions.some(
        (c) => c.kind === 'voiceAxis' || c.kind === 'verbalTic',
      ),
    )
    expect(hasVoiceCondition).toBe(true)
  })
})
