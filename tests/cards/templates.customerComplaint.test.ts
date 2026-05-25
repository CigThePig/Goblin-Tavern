// Phase 134 / ISSUE-103 — Voiced Surface arc, Phase 8 (Regulars & Complaints).
//
// Integration tests for `customerComplaintCard` — the cohort half of
// the Phase 8 cluster (the named-regular case is `regularComplaintCard`).
// The card now centres on a customer group (e.g. "the merchants")
// rather than a named regular. Mirrors `templates.staffBurnout.test.ts`.

import { describe, expect, it } from 'vitest'

import {
  customerComplaintCard,
  fallbackCard,
} from '../../src/cards/index'
import { pickCardForSeed } from '../../src/cards/selection'
import {
  customerComplaintEstablishingLinePool,
  customerComplaintReactionLinePool,
} from '../../src/cards/compose/pools/customerComplaint'
import { REQUIRED_CARDS } from '../../src/cards/templates/index'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import type { CustomerGroupCastAttributes } from '../../src/sim/content/cast'
import type {
  IssueSeed,
  IssueSeedFamilyId,
} from '../../src/sim/modules/issues/issueSeedTypes'
import type {
  EntityRef,
  TavernState,
} from '../../src/sim/state/TavernState'
import { makeSeed } from './cardFactories'

function firstGroupId(state: TavernState): string {
  const id = Object.keys(state.customerGroups)[0]
  if (!id)
    throw new Error('test setup expects at least one starter customer group')
  return id
}

function withCast(
  state: TavernState,
  groupId: string,
  cast: CustomerGroupCastAttributes,
): TavernState {
  return {
    ...state,
    customerGroups: {
      ...state.customerGroups,
      [groupId]: {
        ...state.customerGroups[groupId]!,
        castAttributes: cast,
      },
    },
  }
}

function withSatisfaction(
  state: TavernState,
  groupId: string,
  satisfaction: number,
): TavernState {
  return {
    ...state,
    customerGroups: {
      ...state.customerGroups,
      [groupId]: {
        ...state.customerGroups[groupId]!,
        satisfaction,
      },
    },
  }
}

// Phase 151 / ISSUE-119 — hold cohort loyalty at the mid band so a test
// that only intends to vary satisfaction (or test the bare fallback)
// isn't pulled into the new corner-combo / state-keyed-reaction rungs.
// Starter cohorts carry loyalty 20-70; the first is `adventurers` at 30
// = low.
function withLoyalty(
  state: TavernState,
  groupId: string,
  loyalty: number,
): TavernState {
  return {
    ...state,
    customerGroups: {
      ...state.customerGroups,
      [groupId]: {
        ...state.customerGroups[groupId]!,
        loyalty,
      },
    },
  }
}

function groupRef(id: string): EntityRef {
  return { kind: 'customer_group', id }
}

function customerComplaintSeed(
  groupId: string,
  id = 'customer-complaint-seed',
): IssueSeed {
  return makeSeed({
    id,
    family: 'customer_complaint' as IssueSeedFamilyId,
    type: 'complaint',
    timing: 'during_service',
    severity: 55,
    domain: ['customers', 'reputation', 'service'],
    primaryActor: groupRef(groupId),
    responseSlots: [
      {
        id: `${id}-discount`,
        labelHint: `Offer a discount`,
        allowedVerbs: ['discount'],
        shape: 'safe_costly',
        targetOptions: [groupRef(groupId)],
        expectedEffects: ['raise satisfaction', 'lose coin'],
      },
      {
        id: `${id}-public_apology`,
        labelHint: `Make a public apology`,
        allowedVerbs: ['appease', 'confess'],
        shape: 'relationship_sacrifice',
        targetOptions: [groupRef(groupId)],
        expectedEffects: ['raise satisfaction', 'staff feels overruled'],
      },
    ],
    consequenceProfiles: [
      {
        id: `${id}-discount-profile`,
        responseSlotId: `${id}-discount`,
        immediateEffects: [
          {
            kind: 'state_change',
            target: `customerGroups.${groupId}.satisfaction`,
            amount: 10,
            readable: 'Discount appeases',
            tags: ['customer'],
          },
          {
            kind: 'state_change',
            target: 'coin',
            amount: -10,
            readable: 'Discount cost',
            tags: ['coin'],
          },
        ],
        delayedEffects: [],
        memories: [],
        futureHooks: [],
        impactScore: 5,
      },
      {
        id: `${id}-apology-profile`,
        responseSlotId: `${id}-public_apology`,
        immediateEffects: [
          {
            kind: 'cause',
            target: `customer:${groupId}`,
            amount: 12,
            readable: 'satisfaction climbs',
            tags: ['customer'],
          },
        ],
        delayedEffects: [],
        memories: [],
        futureHooks: [],
        impactScore: 6,
      },
    ],
    textIngredients: {
      subject: 'eye the filthy floor',
      problemNoun: 'cold welcome',
      sensoryDetails: ['pursed lips', 'half-finished mugs'],
      actorOpinions: { [groupId]: 'eye the filthy floor' },
      recentContext: ['main room dirty all week'],
    },
  })
}

const ESTABLISHING_LINE_TEXTS = new Set(
  customerComplaintEstablishingLinePool.snippets.map((s) => s.text),
)
const REACTION_LINE_TEXTS = new Set(
  customerComplaintReactionLinePool.snippets.map((s) => s.text),
)

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length
}

describe('customerComplaintCard — appliesTo', () => {
  const state = createInitialTavernState()
  const groupId = firstGroupId(state)

  it('is registered in REQUIRED_CARDS', () => {
    expect(REQUIRED_CARDS).toContain(customerComplaintCard)
  })

  it('matches a customer_complaint / complaint / during_service seed with a customer_group actor', () => {
    const seed = customerComplaintSeed(groupId)
    const chosen = pickCardForSeed(seed, state, REQUIRED_CARDS)
    expect(chosen?.id).toBe(customerComplaintCard.id)
  })

  it('declines a seed whose actor has no cast attributes — fallback handles it', () => {
    const original = state.customerGroups[groupId]!
    const { castAttributes: _strip, ...rest } = original
    void _strip
    const castless: TavernState = {
      ...state,
      customerGroups: { ...state.customerGroups, [groupId]: rest },
    }
    const seed = customerComplaintSeed(groupId)
    const chosen = pickCardForSeed(seed, castless, REQUIRED_CARDS)
    expect(chosen?.id).not.toBe(customerComplaintCard.id)
    expect(chosen?.id).toBe(fallbackCard.id)
  })

  it('does not match regular_customer family (that is regularComplaint territory)', () => {
    expect(customerComplaintCard.appliesTo.seedFamilies).toEqual([
      'customer_complaint',
    ])
    expect(customerComplaintCard.appliesTo.seedFamilies).not.toContain(
      'regular_customer',
    )
  })
})

describe('customerComplaintCard — render output', () => {
  it('body[0] is the sim-backed establishing line; body[1] is the voiced reaction', () => {
    const state = createInitialTavernState()
    const groupId = firstGroupId(state)
    const seed = customerComplaintSeed(groupId)
    const view = customerComplaintCard.render(seed, state)
    expect(view.body[0]).toBeDefined()
    expect(view.body[1]).toBeDefined()
    expect(ESTABLISHING_LINE_TEXTS.has(view.body[0]!)).toBe(true)
    expect(REACTION_LINE_TEXTS.has(view.body[1]!)).toBe(true)
    expect(wordCount(view.body[0]!)).toBeLessThanOrEqual(14)
    expect(wordCount(view.body[1]!)).toBeLessThanOrEqual(12)
  })

  it('body never surfaces raw textIngredients fragments', () => {
    const state = createInitialTavernState()
    const groupId = firstGroupId(state)
    const seed = customerComplaintSeed(groupId)
    const view = customerComplaintCard.render(seed, state)
    for (const line of view.body) {
      expect(line).not.toBe('eye the filthy floor')
      expect(line).not.toBe('pursed lips')
      expect(line).not.toBe('half-finished mugs')
      expect(line).not.toBe('main room dirty all week')
      expect(line).not.toMatch(/satisfaction \d+, loyalty \d+/)
    }
  })

  it('title centres on the customer group and never truncates with "…"', () => {
    const state = createInitialTavernState()
    const groupId = firstGroupId(state)
    const seed = customerComplaintSeed(groupId)
    const view = customerComplaintCard.render(seed, state)
    const label = state.customerGroups[groupId]!.label
    expect(view.title.toLowerCase()).toContain(
      label.split(' ')[0]!.toLowerCase(),
    )
    expect(view.title).not.toContain('…')
    expect(view.title).not.toContain('...')
    // Subject==label duplication is impossible here because the title
    // pool snippets never restate the group label.
    const titleWithoutLabel = view.title
      .toLowerCase()
      .replace(label.toLowerCase(), '')
    expect(titleWithoutLabel.toLowerCase()).not.toContain(label.toLowerCase())
  })

  it('falls back to the unconditional snippets when no axes match', () => {
    const state = createInitialTavernState()
    const groupId = firstGroupId(state)
    const neutral: CustomerGroupCastAttributes = {
      voice: { axes: { terseness: 1, warmth: 1, formality: 1, floridity: 1 } },
    }
    // Hold loyalty mid AND satisfaction mid so neither the Phase-6
    // state-keyed reaction snippets (signalEquals loyalty=low /
    // satisfaction=low) nor the corner combos fire; the unconditional
    // fallback is the only candidate.
    const flat = withSatisfaction(
      withLoyalty(withCast(state, groupId, neutral), groupId, 50),
      groupId,
      50,
    )
    const seed = customerComplaintSeed(groupId)
    const view = customerComplaintCard.render(seed, flat)
    expect(REACTION_LINE_TEXTS.has(view.body[1]!)).toBe(true)
    expect(view.body[1]).toBe('The mugs grow cold while the silence grows louder.')
  })

  it('picks a sim-backed snippet when the group has low satisfaction (loyalty mid)', () => {
    const state = createInitialTavernState()
    const groupId = firstGroupId(state)
    // Hold loyalty mid so the single-condition `est_low_satisfaction`
    // snippet wins specificity — the Phase-6 corner combos
    // (est_low_sat_low_loy / est_low_sat_high_loy) only fire when
    // loyalty also resolves to low or high.
    const grumpy = withSatisfaction(
      withLoyalty(state, groupId, 50),
      groupId,
      25,
    )
    const seed = customerComplaintSeed(groupId, 'low-satisfaction')
    const view = customerComplaintCard.render(seed, grumpy)
    expect(view.body[0]).toBe("Their satisfaction's been bottoming out all evening.")
  })

  it('picks a two-axis snippet when both extremes land', () => {
    const state = createInitialTavernState()
    const groupId = firstGroupId(state)
    const cast: CustomerGroupCastAttributes = {
      voice: { axes: { terseness: 2, warmth: 0, formality: 1, floridity: 1 } },
    }
    const sharp = withCast(state, groupId, cast)
    const seed = customerComplaintSeed(groupId, 'cohort-sharp')
    const view = customerComplaintCard.render(seed, sharp)
    expect(view.body[1]).toBe("We've waited long enough. Settle it.")
    // The manner_note `mnr_terse_cold` fires on the same conditions.
    expect(view.body[2]).toBe('They cross their arms and wait.')
  })

  it('emits valid choices whose verbs are in seed.responseSlots.allowedVerbs', () => {
    const state = createInitialTavernState()
    const groupId = firstGroupId(state)
    const seed = customerComplaintSeed(groupId)
    const view = customerComplaintCard.render(seed, state)
    expect(view.choices.length).toBeGreaterThan(0)
    for (const choice of view.choices) {
      const slot = seed.responseSlots.find((s) => s.id === choice.slotId)
      expect(slot, `slot ${choice.slotId} resolves`).toBeDefined()
      expect(slot!.allowedVerbs).toContain(choice.verb)
    }
  })

  it('preserves choice mechanical truth: verb, shape, targetId, preview count unchanged by composition', () => {
    const state = createInitialTavernState()
    const groupId = firstGroupId(state)
    const seed = customerComplaintSeed(groupId)
    const view = customerComplaintCard.render(seed, state)
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
    const groupId = firstGroupId(state)
    const seed = customerComplaintSeed(groupId)
    const view = customerComplaintCard.render(seed, state)
    expect(view.tag).toBe('customer_complaint')
    expect(view.severity).toBe(55)
  })

  it('is deterministic — same seed + state ⇒ identical CardView', () => {
    const state = createInitialTavernState()
    const groupId = firstGroupId(state)
    const seed = customerComplaintSeed(groupId)
    const a = customerComplaintCard.render(seed, state)
    const b = customerComplaintCard.render(seed, structuredClone(state) as TavernState)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('does not mutate state', () => {
    const state = createInitialTavernState()
    const groupId = firstGroupId(state)
    const seed = customerComplaintSeed(groupId)
    const before = JSON.stringify(state)
    customerComplaintCard.render(seed, state)
    expect(JSON.stringify(state)).toBe(before)
  })
})

describe('customerComplaintCard — voice variance across three profiles', () => {
  it('produces three distinct reaction lines (body[1]) for three distinct voices', () => {
    const state = createInitialTavernState()
    const groupId = firstGroupId(state)
    const profiles: CustomerGroupCastAttributes[] = [
      {
        voice: { axes: { terseness: 2, warmth: 0, formality: 1, floridity: 1 } },
      },
      {
        voice: { axes: { terseness: 1, warmth: 2, formality: 0, floridity: 1 } },
      },
      {
        voice: {
          axes: { terseness: 1, warmth: 1, formality: 1, floridity: 1 },
          verbalTic: 'qualifies_everything',
        },
      },
    ]
    const reactions = profiles.map((cast, i) => {
      const installed = withCast(state, groupId, cast)
      const view = customerComplaintCard.render(
        customerComplaintSeed(groupId, `variance-${i}`),
        installed,
      )
      return view.body[1]
    })
    expect(new Set(reactions).size).toBe(3)
  })
})
