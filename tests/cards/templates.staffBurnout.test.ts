// Phase 133 / ISSUE-102 — Voiced Surface arc, Phase 7 (Staff & Personnel).
//
// Integration tests for `staffBurnoutCard` — the third compositional
// card (after drinkOrder and staffAside) and the first Voiced Surface
// migration that replaces a legacy hand-written template. Mirrors
// `templates.staffAside.test.ts` shape; the load-bearing properties
// are: sim-backed establishing_line fires first, voiced reaction_line
// follows, choices project the seed's response slots mechanically
// unchanged, graceful degradation when castAttributes is missing,
// stable re-render.

import { describe, expect, it } from 'vitest'

import {
  staffBurnoutCard,
  fallbackCard,
} from '../../src/cards/index'
import { pickCardForSeed } from '../../src/cards/selection'
import {
  staffBurnoutEstablishingLinePool,
  staffBurnoutReactionLinePool,
} from '../../src/cards/compose/pools/staffBurnout'
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

function staffBurnoutSeed(
  staffId: string,
  id = 'staff-burnout-seed',
): IssueSeed {
  return makeSeed({
    id,
    family: 'staff_burnout' as IssueSeedFamilyId,
    type: 'staff_request',
    timing: 'morning_prep',
    severity: 55,
    domain: ['staff'],
    primaryActor: staffRef(staffId),
    responseSlots: [
      {
        id: `${id}-slot-pay`,
        labelHint: `Pay a bonus`,
        allowedVerbs: ['pay'],
        shape: 'safe_costly',
        targetOptions: [staffRef(staffId)],
        expectedEffects: ['morale +15', 'coin -15'],
      },
      {
        id: `${id}-slot-ignore`,
        labelHint: 'Push through',
        allowedVerbs: ['ignore'],
        shape: 'risky_profitable',
        targetOptions: [staffRef(staffId)],
        expectedEffects: ['no cost', 'risk staff quitting'],
      },
    ],
    consequenceProfiles: [
      {
        id: `${id}-profile-pay`,
        responseSlotId: `${id}-slot-pay`,
        immediateEffects: [
          {
            kind: 'state_change',
            target: `staff.${staffId}.morale`,
            amount: 15,
            readable: 'boost morale',
            tags: ['staff'],
          },
          {
            kind: 'state_change',
            target: 'coin',
            amount: -15,
            readable: 'pay bonus cost',
            tags: ['coin'],
          },
        ],
        delayedEffects: [],
        memories: [],
        futureHooks: [],
        impactScore: 7,
      },
      {
        id: `${id}-profile-ignore`,
        responseSlotId: `${id}-slot-ignore`,
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
      subject: 'looks ready to snap',
      sensoryDetails: ['hunched shoulders', 'dark eyes'],
      recentContext: ['heavy week of service'],
    },
  })
}

const ESTABLISHING_LINE_TEXTS = new Set(
  staffBurnoutEstablishingLinePool.snippets.map((s) => s.text),
)
const REACTION_LINE_TEXTS = new Set(
  staffBurnoutReactionLinePool.snippets.map((s) => s.text),
)

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length
}

describe('staffBurnoutCard — appliesTo', () => {
  const state = createInitialTavernState()
  const staffId = firstStaffId(state)

  it('is registered in REQUIRED_CARDS', () => {
    expect(REQUIRED_CARDS).toContain(staffBurnoutCard)
  })

  it('matches a staff_burnout / staff_request / morning_prep seed with a staff actor', () => {
    const seed = staffBurnoutSeed(staffId)
    const chosen = pickCardForSeed(seed, state, REQUIRED_CARDS)
    expect(chosen?.id).toBe(staffBurnoutCard.id)
  })

  it('declines a seed whose actor has no cast attributes — fallback handles it', () => {
    const original = state.staff[staffId]!
    const { castAttributes: _strip, ...rest } = original
    void _strip
    const castless: TavernState = {
      ...state,
      staff: { ...state.staff, [staffId]: rest },
    }
    const seed = staffBurnoutSeed(staffId)
    const chosen = pickCardForSeed(seed, castless, REQUIRED_CARDS)
    expect(chosen?.id).not.toBe(staffBurnoutCard.id)
    expect(chosen?.id).toBe(fallbackCard.id)
  })

  it('does not match staff_identity / relationship_test (that is staffAside territory)', () => {
    const seed = makeSeed({
      id: 'staff-identity-not-burnout',
      family: 'staff_identity' as IssueSeedFamilyId,
      type: 'relationship_test',
      timing: 'morning_prep',
      primaryActor: staffRef(staffId),
    })
    const chosen = pickCardForSeed(seed, state, REQUIRED_CARDS)
    expect(chosen?.id).not.toBe(staffBurnoutCard.id)
  })
})

describe('staffBurnoutCard — render output', () => {
  it('body[0] is the sim-backed establishing line; body[1] is the voiced reaction', () => {
    const state = createInitialTavernState()
    const staffId = firstStaffId(state)
    const seed = staffBurnoutSeed(staffId)
    const view = staffBurnoutCard.render(seed, state)
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
    const seed = staffBurnoutSeed(staffId)
    const view = staffBurnoutCard.render(seed, state)
    // Legacy template lifted these as body lines; the new template
    // composes through pools instead.
    for (const line of view.body) {
      expect(line).not.toBe('hunched shoulders')
      expect(line).not.toBe('dark eyes')
      expect(line).not.toBe('heavy week of service')
      // No raw "morale X, stress Y" meter line either.
      expect(line).not.toMatch(/morale \d+, stress \d+/)
    }
  })

  it('title centres on the named staff member and never truncates with "…"', () => {
    const state = createInitialTavernState()
    const staffId = firstStaffId(state)
    const seed = staffBurnoutSeed(staffId)
    const view = staffBurnoutCard.render(seed, state)
    const display = state.staff[staffId]!.name.display
    expect(view.title.toLowerCase()).toContain(display.split(' ')[0]!.toLowerCase())
    expect(view.title).not.toContain('…')
    expect(view.title).not.toContain('...')
    // Subject==label duplication is impossible here because the title
    // pool snippets never restate the display name.
    const titleWithoutDisplay = view.title
      .toLowerCase()
      .replace(display.toLowerCase(), '')
    expect(titleWithoutDisplay.toLowerCase()).not.toContain(display.toLowerCase())
  })

  it('falls back to the unconditional snippets when no axes match', () => {
    const state = createInitialTavernState()
    const staffId = firstStaffId(state)
    const neutral: CastAttributes = {
      specialty: 'meat_dishes',
      blindspot: 'pastry',
      affinities: [],
      voice: {
        axes: { terseness: 1, warmth: 1, formality: 1, floridity: 1 },
      },
    }
    const flat = withCast(state, staffId, neutral)
    const seed = staffBurnoutSeed(staffId)
    const view = staffBurnoutCard.render(seed, flat)
    // body[0]: sim-backed establishing line. Initial state has
    // staff.stress=0 (low band) AND staff.fatigue=0 (low band), so the
    // Phase-150 spec-2 combo `est_low_stress_low_fatigue` wins over the
    // single-condition `est_low_stress` snippet.
    // body[1]: reaction fallback (no axis sharp enough)
    expect(view.body[0]).toBe(
      'They stand at the rota easy, the week still ahead of them.',
    )
    expect(view.body[1]).toBe('I came in early. The room asks for steadier hands.')
  })

  it('picks a two-axis snippet when both extremes land', () => {
    const state = createInitialTavernState()
    const staffId = firstStaffId(state)
    const cast: CastAttributes = {
      specialty: 'meat_dishes',
      blindspot: 'pastry',
      affinities: [],
      voice: {
        axes: { terseness: 2, warmth: 0, formality: 1, floridity: 1 },
      },
    }
    const sharp = withCast(state, staffId, cast)
    const seed = staffBurnoutSeed(staffId, 'burnout-sharp')
    const view = staffBurnoutCard.render(seed, sharp)
    expect(view.body[1]).toBe("Say what's needed. I'll handle it.")
    // The manner_note `mnr_terse_cold` fires on the same conditions.
    expect(view.body[2]).toBe('They roll their sleeves and wait.')
  })

  it('emits valid choices whose verbs are in seed.responseSlots.allowedVerbs', () => {
    const state = createInitialTavernState()
    const staffId = firstStaffId(state)
    const seed = staffBurnoutSeed(staffId)
    const view = staffBurnoutCard.render(seed, state)
    expect(view.choices.length).toBeGreaterThan(0)
    for (const choice of view.choices) {
      const slot = seed.responseSlots.find((s) => s.id === choice.slotId)
      expect(slot, `slot ${choice.slotId} resolves`).toBeDefined()
      expect(slot!.allowedVerbs).toContain(choice.verb)
    }
  })

  it('preserves choice mechanical truth: verb, shape, targetId, preview count unchanged by composition', () => {
    const state = createInitialTavernState()
    const staffId = firstStaffId(state)
    const seed = staffBurnoutSeed(staffId)
    const view = staffBurnoutCard.render(seed, state)
    for (const choice of view.choices) {
      const slot = seed.responseSlots.find((s) => s.id === choice.slotId)!
      const profile = seed.consequenceProfiles.find(
        (p) => p.responseSlotId === slot.id,
      )!
      expect(slot.allowedVerbs).toContain(choice.verb)
      expect(slot.shape).toBe(choice.shape)
      // maxPreview is 2 on the template; profile.immediateEffects may be larger.
      expect(choice.previewEffects.length).toBeLessThanOrEqual(2)
      expect(choice.previewEffects.length).toBeLessThanOrEqual(
        profile.immediateEffects.length,
      )
    }
  })

  it('tags and severity flow from the seed', () => {
    const state = createInitialTavernState()
    const staffId = firstStaffId(state)
    const seed = staffBurnoutSeed(staffId)
    const view = staffBurnoutCard.render(seed, state)
    expect(view.tag).toBe('staff_burnout')
    expect(view.severity).toBe(55)
  })

  it('is deterministic — same seed + state ⇒ identical CardView', () => {
    const state = createInitialTavernState()
    const staffId = firstStaffId(state)
    const seed = staffBurnoutSeed(staffId)
    const a = staffBurnoutCard.render(seed, state)
    const b = staffBurnoutCard.render(seed, structuredClone(state) as TavernState)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('does not mutate state', () => {
    const state = createInitialTavernState()
    const staffId = firstStaffId(state)
    const seed = staffBurnoutSeed(staffId)
    const before = JSON.stringify(state)
    staffBurnoutCard.render(seed, state)
    expect(JSON.stringify(state)).toBe(before)
  })
})

describe('staffBurnoutCard — voice variance across three profiles', () => {
  it('produces three distinct reaction lines (body[1]) for three distinct voices', () => {
    const state = createInitialTavernState()
    const staffId = firstStaffId(state)
    const profiles: CastAttributes[] = [
      {
        specialty: 'meat_dishes',
        blindspot: 'pastry',
        affinities: [],
        voice: {
          axes: { terseness: 2, warmth: 0, formality: 1, floridity: 1 },
        },
      },
      {
        specialty: 'meat_dishes',
        blindspot: 'pastry',
        affinities: [],
        voice: {
          axes: { terseness: 1, warmth: 2, formality: 0, floridity: 1 },
        },
      },
      {
        specialty: 'meat_dishes',
        blindspot: 'pastry',
        affinities: [],
        voice: {
          axes: { terseness: 1, warmth: 1, formality: 1, floridity: 1 },
          verbalTic: 'qualifies_everything',
        },
      },
    ]
    const reactions = profiles.map((cast, i) => {
      const installed = withCast(state, staffId, cast)
      const view = staffBurnoutCard.render(
        staffBurnoutSeed(staffId, `variance-${i}`),
        installed,
      )
      return view.body[1]
    })
    expect(new Set(reactions).size).toBe(3)
  })
})
