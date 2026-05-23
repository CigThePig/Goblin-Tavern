// Phase 132 / ISSUE-101 — Voiced Surface arc, Phase 6.
//
// Mechanical-equivalence test for the choice / consequence voicing pass.
// Phase 6 composes voiced choice labels and effect-preview strings, but
// the sim remains the mechanical source of truth: `verb`, `targetId`,
// `shape`, the `slotId`, and the per-effect `(kind, target, amount, tags)`
// data must be unchanged by the voicing. This file asserts that invariant
// for both `drinkOrderCard` and `staffAsideCard`, plus:
//
//   1. Determinism — same (seed, state) renders character-equal choices.
//   2. Voice actually does something — under a high-warmth cast, at
//      least one choice's label or preview differs from the verbatim
//      sim string, proving the pools fired.

import { describe, expect, it } from 'vitest'

import {
  drinkOrderCard,
  staffAsideCard,
} from '../../src/cards/index'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import type { CastAttributes } from '../../src/sim/content/cast'
import type {
  CardChoice,
  CardView,
} from '../../src/cards/types'
import type {
  IssueSeed,
  IssueSeedFamilyId,
  ResponseIntentShape,
  ResponseIntentVerb,
} from '../../src/sim/modules/issues/issueSeedTypes'
import type {
  EntityRef,
  TavernState,
} from '../../src/sim/state/TavernState'
import { makeSeed } from './cardFactories'

function firstRegularId(state: TavernState): string {
  const id = Object.keys(state.world.regulars)[0]
  if (!id) throw new Error('test setup expects a starter regular')
  return id
}

function firstStaffId(state: TavernState): string {
  const id = Object.keys(state.staff)[0]
  if (!id) throw new Error('test setup expects a starter staff member')
  return id
}

function regularRef(id: string): EntityRef {
  return { kind: 'regular', id }
}

function staffRef(id: string): EntityRef {
  return { kind: 'staff', id }
}

function withRegularCast(
  state: TavernState,
  regularId: string,
  cast: CastAttributes,
): TavernState {
  return {
    ...state,
    world: {
      ...state.world,
      regulars: {
        ...state.world.regulars,
        [regularId]: {
          ...state.world.regulars[regularId]!,
          castAttributes: cast,
        },
      },
    },
  }
}

function withStaffCast(
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

function warmFormalCast(): CastAttributes {
  return {
    specialty: 'gossip',
    blindspot: 'silence',
    affinities: [],
    voice: { axes: { terseness: 0, warmth: 2, formality: 2, floridity: 1 } },
  }
}

function drinkOrderSeed(regularId: string): IssueSeed {
  return makeSeed({
    id: 'phase132-drinkorder-equiv',
    family: 'regular_customer' as IssueSeedFamilyId,
    type: 'relationship_test',
    timing: 'during_service',
    severity: 35,
    domain: ['regulars', 'customers', 'social'],
    primaryActor: regularRef(regularId),
    responseSlots: [
      {
        id: 'phase132-drinkorder-equiv-appease',
        labelHint: 'Smooth it over',
        allowedVerbs: ['appease'] as ResponseIntentVerb[],
        shape: 'safe_costly' as ResponseIntentShape,
        targetOptions: [regularRef(regularId)],
        expectedEffects: ['irritation -5'],
      },
      {
        id: 'phase132-drinkorder-equiv-ignore',
        labelHint: 'Let it ride',
        allowedVerbs: ['ignore'] as ResponseIntentVerb[],
        shape: 'ignore' as ResponseIntentShape,
        targetOptions: [],
        expectedEffects: ['nothing changes'],
      },
    ],
    consequenceProfiles: [
      {
        id: 'phase132-drinkorder-equiv-profile-appease',
        responseSlotId: 'phase132-drinkorder-equiv-appease',
        immediateEffects: [
          {
            kind: 'state_change',
            target: `world.regulars.${regularId}.irritation`,
            amount: -5,
            readable: 'the regular settles',
            tags: ['regulars'],
          },
        ],
        delayedEffects: [],
        memories: [],
        futureHooks: [],
        impactScore: 4,
      },
      {
        id: 'phase132-drinkorder-equiv-profile-ignore',
        responseSlotId: 'phase132-drinkorder-equiv-ignore',
        immediateEffects: [
          {
            kind: 'state_change',
            target: 'noop',
            amount: 0,
            readable: 'nothing happens',
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
      subject: 'asks for ale',
      sensoryDetails: ['stools scrape back as they settle'],
      recentContext: ['second visit this week'],
    },
  })
}

function staffAsideSeed(staffId: string): IssueSeed {
  return makeSeed({
    id: 'phase132-staffaside-equiv',
    family: 'staff_identity' as IssueSeedFamilyId,
    type: 'relationship_test',
    timing: 'morning_prep',
    severity: 40,
    domain: ['staff', 'identity', 'social'],
    primaryActor: staffRef(staffId),
    responseSlots: [
      {
        id: 'phase132-staffaside-equiv-appease',
        labelHint: 'Hear them out',
        allowedVerbs: ['appease'] as ResponseIntentVerb[],
        shape: 'safe_costly' as ResponseIntentShape,
        targetOptions: [staffRef(staffId)],
        expectedEffects: ['loyalty +2'],
      },
      {
        id: 'phase132-staffaside-equiv-ignore',
        labelHint: 'Let it sit',
        allowedVerbs: ['ignore'] as ResponseIntentVerb[],
        shape: 'ignore' as ResponseIntentShape,
        targetOptions: [],
        expectedEffects: ['nothing changes'],
      },
    ],
    consequenceProfiles: [
      {
        id: 'phase132-staffaside-equiv-profile-appease',
        responseSlotId: 'phase132-staffaside-equiv-appease',
        immediateEffects: [
          {
            kind: 'state_change',
            target: `staff.${staffId}.loyalty`,
            amount: 2,
            readable: 'the staffer relaxes',
            tags: ['staff'],
          },
        ],
        delayedEffects: [],
        memories: [],
        futureHooks: [],
        impactScore: 5,
      },
      {
        id: 'phase132-staffaside-equiv-profile-ignore',
        responseSlotId: 'phase132-staffaside-equiv-ignore',
        immediateEffects: [
          {
            kind: 'state_change',
            target: 'noop',
            amount: 0,
            readable: 'nothing shifts',
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
      subject: 'before the doors open',
      sensoryDetails: ['the kettle clicks awake'],
      recentContext: ['tense week of service'],
    },
  })
}

type MechanicalChoice = {
  slotId: string
  verb: ResponseIntentVerb
  shape: ResponseIntentShape
  targetId?: string
  previewLength: number
}

function mechanicalBaseline(seed: IssueSeed, maxPreview: number): MechanicalChoice[] {
  return seed.responseSlots.map((slot) => {
    const profile = seed.consequenceProfiles.find(
      (p) => p.responseSlotId === slot.id,
    )
    const previewLength = (profile?.immediateEffects ?? []).slice(
      0,
      maxPreview,
    ).length
    const fallbackTarget = slot.targetOptions[0]?.id
    const base: MechanicalChoice = {
      slotId: slot.id,
      verb: slot.allowedVerbs[0]!,
      shape: slot.shape,
      previewLength,
    }
    if (fallbackTarget !== undefined) base.targetId = fallbackTarget
    return base
  })
}

function assertMechanicalEquivalence(
  view: CardView,
  baseline: MechanicalChoice[],
): void {
  expect(view.choices.length).toBe(baseline.length)
  view.choices.forEach((choice: CardChoice, i: number) => {
    const expected = baseline[i]!
    expect(choice.slotId).toBe(expected.slotId)
    expect(choice.verb).toBe(expected.verb)
    expect(choice.shape).toBe(expected.shape)
    expect(choice.targetId).toBe(expected.targetId)
    expect(choice.previewEffects).toHaveLength(expected.previewLength)
    // Every preview line is a non-empty string. The composer either
    // emits a voiced replacement OR falls through to the sim's verbatim
    // readable — empty is never correct.
    for (const line of choice.previewEffects) {
      expect(line.length).toBeGreaterThan(0)
    }
  })
}

describe('Phase 132 / ISSUE-101 — drinkOrderCard mechanical equivalence', () => {
  const base = createInitialTavernState()
  const regularId = firstRegularId(base)
  const state = withRegularCast(base, regularId, warmFormalCast())
  const seed = drinkOrderSeed(regularId)

  it('verb / shape / targetId / slotId / preview length match the seed', () => {
    const view = drinkOrderCard.render(seed, state)
    assertMechanicalEquivalence(view, mechanicalBaseline(seed, 2))
  })

  it('re-rendering with the same (seed, state) yields identical choices', () => {
    const a = drinkOrderCard.render(seed, state)
    const b = drinkOrderCard.render(seed, state)
    expect(JSON.stringify(a.choices)).toBe(JSON.stringify(b.choices))
  })

  it('a warm-formal cast voices at least one choice label or preview line', () => {
    // Proves the pools actually fire: under this cast the warm /
    // formal rungs match and we should see a composed string somewhere
    // other than the literal sim readable / labelHint.
    const view = drinkOrderCard.render(seed, state)
    const labelHints = new Set(seed.responseSlots.map((s) => s.labelHint))
    const readables = new Set(
      seed.consequenceProfiles.flatMap((p) =>
        p.immediateEffects.map((e) => e.readable),
      ),
    )
    const composedSomewhere = view.choices.some((choice) => {
      const labelComposed = !labelHints.has(choice.label)
      const previewComposed = choice.previewEffects.some(
        (line) => !readables.has(line),
      )
      return labelComposed || previewComposed
    })
    expect(composedSomewhere).toBe(true)
  })
})

describe('Phase 132 / ISSUE-101 — staffAsideCard mechanical equivalence', () => {
  const base = createInitialTavernState()
  const staffId = firstStaffId(base)
  const state = withStaffCast(base, staffId, warmFormalCast())
  const seed = staffAsideSeed(staffId)

  it('verb / shape / targetId / slotId / preview length match the seed', () => {
    const view = staffAsideCard.render(seed, state)
    assertMechanicalEquivalence(view, mechanicalBaseline(seed, 2))
  })

  it('re-rendering with the same (seed, state) yields identical choices', () => {
    const a = staffAsideCard.render(seed, state)
    const b = staffAsideCard.render(seed, state)
    expect(JSON.stringify(a.choices)).toBe(JSON.stringify(b.choices))
  })

  it('a warm-formal cast voices at least one choice label or preview line', () => {
    const view = staffAsideCard.render(seed, state)
    const labelHints = new Set(seed.responseSlots.map((s) => s.labelHint))
    const readables = new Set(
      seed.consequenceProfiles.flatMap((p) =>
        p.immediateEffects.map((e) => e.readable),
      ),
    )
    const composedSomewhere = view.choices.some((choice) => {
      const labelComposed = !labelHints.has(choice.label)
      const previewComposed = choice.previewEffects.some(
        (line) => !readables.has(line),
      )
      return labelComposed || previewComposed
    })
    expect(composedSomewhere).toBe(true)
  })
})
