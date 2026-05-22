// Phase 126 / ISSUE-095 — Living Cast arc, Phase F (first situation).
//
// Integration tests for `staffAsideCard` — the second compositional card
// and the first Phase-F scale-out beyond the drink_order spike. Proves
// the runtime end-to-end: a real staff_identity / relationship_test /
// morning_prep seed with a real staff member renders a composed CardView
// whose body[0] is one of the committed `aside_line` snippet texts,
// whose title centres on the named staff member, and whose choices
// project the seed's response slots. Graceful degradation when
// castAttributes is missing is the other load-bearing property — and
// the parallel to `templates.drinkOrder.test.ts` is intentional, mirror
// for mirror.

import { describe, expect, it } from 'vitest'

import {
  staffAsideCard,
  fallbackCard,
} from '../../src/cards/index'
import { pickCardForSeed } from '../../src/cards/selection'
import { asideLinePool } from '../../src/cards/compose/pools/staffAside'
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

function staffAsideSeed(
  staffId: string,
  id = 'staff-aside-seed',
): IssueSeed {
  return makeSeed({
    id,
    family: 'staff_identity' as IssueSeedFamilyId,
    type: 'relationship_test',
    timing: 'morning_prep',
    severity: 45,
    domain: ['staff', 'identity', 'social'],
    primaryActor: staffRef(staffId),
    responseSlots: [
      {
        id: `${id}-slot-comfort`,
        labelHint: 'Hear them out',
        allowedVerbs: ['appease'],
        shape: 'safe_costly',
        targetOptions: [staffRef(staffId)],
        expectedEffects: ['loyalty +4'],
      },
      {
        id: `${id}-slot-ignore`,
        labelHint: 'Open the doors',
        allowedVerbs: ['ignore'],
        shape: 'ignore',
        targetOptions: [],
        expectedEffects: ['nothing changes'],
      },
    ],
    consequenceProfiles: [
      {
        id: `${id}-profile-a`,
        responseSlotId: `${id}-slot-comfort`,
        immediateEffects: [
          {
            kind: 'state_change',
            target: `staff.${staffId}.loyalty`,
            amount: 4,
            readable: 'they settle a little',
            tags: ['staff'],
          },
        ],
        delayedEffects: [],
        memories: [],
        futureHooks: [],
        impactScore: 5,
      },
      {
        id: `${id}-profile-b`,
        responseSlotId: `${id}-slot-ignore`,
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
      subject: 'before the doors open',
      sensoryDetails: ['the kettle clicks awake'],
      recentContext: ['tense week of service'],
    },
  })
}

const ASIDE_LINE_TEXTS = new Set(asideLinePool.snippets.map((s) => s.text))

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length
}

describe('staffAsideCard — appliesTo', () => {
  const state = createInitialTavernState()
  const staffId = firstStaffId(state)

  it('is registered in REQUIRED_CARDS', () => {
    expect(REQUIRED_CARDS).toContain(staffAsideCard)
  })

  it('matches a staff_identity / relationship_test / morning_prep seed with a staff actor', () => {
    const seed = staffAsideSeed(staffId)
    const chosen = pickCardForSeed(seed, state, REQUIRED_CARDS)
    expect(chosen?.id).toBe(staffAsideCard.id)
  })

  it('declines a seed whose actor has no cast attributes — fallback handles it', () => {
    // Strip cast attributes off the staff member. The staffAsideCard's
    // custom predicate insists on populated CastAttributes; without
    // them, the template steps aside and the fallback renders.
    const original = state.staff[staffId]!
    const { castAttributes: _strip, ...rest } = original
    void _strip
    const castless: TavernState = {
      ...state,
      staff: { ...state.staff, [staffId]: rest },
    }
    const seed = staffAsideSeed(staffId)
    const chosen = pickCardForSeed(seed, castless, REQUIRED_CARDS)
    expect(chosen?.id).not.toBe(staffAsideCard.id)
    expect(chosen?.id).toBe(fallbackCard.id)
  })
})

describe('staffAsideCard — render output', () => {
  it('body[0] is one of the committed aside_line snippet texts', () => {
    const state = createInitialTavernState()
    const staffId = firstStaffId(state)
    const seed = staffAsideSeed(staffId)
    const view = staffAsideCard.render(seed, state)
    expect(view.body[0]).toBeDefined()
    expect(ASIDE_LINE_TEXTS.has(view.body[0]!)).toBe(true)
    // Body lines must respect the 12-word ingredient budget.
    expect(wordCount(view.body[0]!)).toBeLessThanOrEqual(12)
  })

  it('title centres on the named staff member and never truncates with "…"', () => {
    const state = createInitialTavernState()
    const staffId = firstStaffId(state)
    const seed = staffAsideSeed(staffId)
    const view = staffAsideCard.render(seed, state)
    const display = state.staff[staffId]!.name.display
    // Phase 131 / ISSUE-100 — title is a composed slot; template glue
    // prepends the display name with no clamping. Long names extend
    // the title rather than truncating with "…".
    expect(view.title.toLowerCase()).toContain(display.split(' ')[0]!.toLowerCase())
    expect(view.title).not.toContain('…')
    expect(view.title).not.toContain('...')
  })

  it('renders the same title for the same seed (compositional determinism)', () => {
    const state = createInitialTavernState()
    const staffId = firstStaffId(state)
    const seed = staffAsideSeed(staffId)
    const a = staffAsideCard.render(seed, state)
    const b = staffAsideCard.render(seed, state)
    expect(a.title).toBe(b.title)
  })

  it('falls back to the unconditional snippet when no axes match', () => {
    const state = createInitialTavernState()
    const staffId = firstStaffId(state)
    // Force the staff member onto neutral axes — no specific condition
    // can match.
    const neutral: CastAttributes = {
      specialty: 'meat_dishes',
      blindspot: 'pastry',
      affinities: [],
      voice: {
        axes: { terseness: 1, warmth: 1, formality: 1, floridity: 1 },
      },
    }
    const flat = withCast(state, staffId, neutral)
    const seed = staffAsideSeed(staffId)
    const view = staffAsideCard.render(seed, flat)
    expect(view.body[0]).toBe("Morning. I'm ready when you are.")
  })

  it('picks a two-axis snippet when both extremes land', () => {
    const state = createInitialTavernState()
    const staffId = firstStaffId(state)
    // terseness=2 AND warmth=0 — only `aside_terse_cold` should win
    // (specificity 2; no other top-rung snippet matches this profile).
    const cast: CastAttributes = {
      specialty: 'meat_dishes',
      blindspot: 'pastry',
      affinities: [],
      voice: {
        axes: { terseness: 2, warmth: 0, formality: 1, floridity: 1 },
      },
    }
    const sharp = withCast(state, staffId, cast)
    const seed = staffAsideSeed(staffId, 'aside-sharp')
    const view = staffAsideCard.render(seed, sharp)
    expect(view.body[0]).toBe("What's wrong. Say it and I'll handle it.")
    // The manner_note `manner_cold_sleeves` fires on the same conditions.
    expect(view.body[1]).toBe('They roll their sleeves before answering.')
  })

  it('picks a tic snippet when only the verbal tic distinguishes the actor', () => {
    const state = createInitialTavernState()
    const staffId = firstStaffId(state)
    const cast: CastAttributes = {
      specialty: 'meat_dishes',
      blindspot: 'pastry',
      affinities: [],
      voice: {
        axes: { terseness: 1, warmth: 1, formality: 1, floridity: 1 },
        verbalTic: 'qualifies_everything',
      },
    }
    const ticActor = withCast(state, staffId, cast)
    const seed = staffAsideSeed(staffId, 'aside-tic')
    const view = staffAsideCard.render(seed, ticActor)
    expect(view.body[0]).toBe("It's fine, I think. Mostly. Probably.")
    expect(view.body[1]).toBe('They wipe the same spot twice.')
  })

  it('emits valid choices whose verbs are in seed.responseSlots.allowedVerbs', () => {
    const state = createInitialTavernState()
    const staffId = firstStaffId(state)
    const seed = staffAsideSeed(staffId)
    const view = staffAsideCard.render(seed, state)
    expect(view.choices.length).toBeGreaterThan(0)
    for (const choice of view.choices) {
      const slot = seed.responseSlots.find((s) => s.id === choice.slotId)
      expect(slot, `slot ${choice.slotId} resolves`).toBeDefined()
      expect(slot!.allowedVerbs).toContain(choice.verb)
    }
  })

  it('tags and severity flow from the seed', () => {
    const state = createInitialTavernState()
    const staffId = firstStaffId(state)
    const seed = staffAsideSeed(staffId)
    const view = staffAsideCard.render(seed, state)
    expect(view.tag).toBe('staff_identity')
    expect(view.severity).toBe(45)
  })

  it('is deterministic — same seed + state ⇒ identical CardView', () => {
    const state = createInitialTavernState()
    const staffId = firstStaffId(state)
    const seed = staffAsideSeed(staffId)
    const a = staffAsideCard.render(seed, state)
    const b = staffAsideCard.render(seed, structuredClone(state) as TavernState)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('does not mutate state', () => {
    const state = createInitialTavernState()
    const staffId = firstStaffId(state)
    const seed = staffAsideSeed(staffId)
    const before = JSON.stringify(state)
    staffAsideCard.render(seed, state)
    expect(JSON.stringify(state)).toBe(before)
  })
})

describe('staffAsideCard — voice variance across three profiles', () => {
  // The "Phase F succeeded" structural proof: three hand-picked staff
  // profiles produce three DISTINCT body[0] lines. This is what "the
  // same character speaks consistently across situations" means at the
  // template level — different voices land different lines, the
  // assembler does the work, no runtime branching is required.

  it('produces three distinct body[0] lines for three distinct voices', () => {
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
    const bodies = profiles.map((cast, i) => {
      const installed = withCast(state, staffId, cast)
      const view = staffAsideCard.render(
        staffAsideSeed(staffId, `variance-${i}`),
        installed,
      )
      return view.body[0]
    })
    expect(new Set(bodies).size).toBe(3)
  })
})
