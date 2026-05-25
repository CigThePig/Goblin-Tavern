// Phase 151 / ISSUE-119 — Legible Surface arc, Phase 6
// (Regulars & Complaints cluster).
//
// Exhaustive matrix-cell reachability tests for the two complaint
// compositional templates (regularComplaint, customerComplaint), plus
// state-keyed sensory deepening proofs for drinkOrder (relationship_test
// branch — no establishing_line slot, so the matrix lives in the
// mannerNote pool only).
//
// For each complaint template this file enumerates hand-picked
// `(seed, state)` fixtures covering the 4 irritation×loyalty /
// satisfaction×loyalty corner combos + a representative
// pressure × signal top rung, and asserts the establishing line
// resolves to the matrix-cell snippet (matched by a distinctive
// substring only the combo cell contains). Proves the authored cells
// are reachable, not just present in the pool.
//
// Mirrors the Phase 149 / Phase 150 matrix-coverage approach: when
// both top-salient facts of a corner resolve, the spec-2 combo snippet
// wins specificity over both single-condition snippets AND over the
// multi-fact join.

import { describe, expect, it } from 'vitest'

import {
  customerComplaintCard,
  drinkOrderCard,
  regularComplaintCard,
} from '../../../src/cards/index'
import type {
  EntityRef,
  TavernState,
} from '../../../src/sim/state/TavernState'
import { createInitialTavernState } from '../../../src/sim/state/defaults'
import type {
  IssueSeed,
  IssueSeedFamilyId,
} from '../../../src/sim/modules/issues/issueSeedTypes'
import type {
  CastAttributes,
  CustomerGroupCastAttributes,
} from '../../../src/sim/content/cast'
import { makeSeed } from '../cardFactories'

// ─── Shared helpers ─────────────────────────────────────────────────

function firstRegularId(state: TavernState): string {
  const id = Object.keys(state.world.regulars)[0]
  if (!id) throw new Error('test setup expects at least one starter regular')
  return id
}

function firstGroupId(state: TavernState): string {
  const id = Object.keys(state.customerGroups)[0]
  if (!id) throw new Error('test setup expects at least one starter customer group')
  return id
}

function regularRef(id: string): EntityRef {
  return { kind: 'regular', id }
}

function groupRef(id: string): EntityRef {
  return { kind: 'customer_group', id }
}

// Neutral cast — axes all at 1 so voice-extreme snippets (which require
// atLeast: 2 or atMost: 0) never fire; isolates state-keyed snippets.
const NEUTRAL_REGULAR_CAST: CastAttributes = {
  specialty: 'gossip',
  blindspot: 'war_story',
  affinities: [],
  voice: { axes: { terseness: 1, warmth: 1, formality: 1, floridity: 1 } },
}

const NEUTRAL_COHORT_CAST: CustomerGroupCastAttributes = {
  voice: { axes: { terseness: 1, warmth: 1, formality: 1, floridity: 1 } },
}

function withNeutralRegularVoice(
  state: TavernState,
  regularId: string,
): TavernState {
  return {
    ...state,
    world: {
      ...state.world,
      regulars: {
        ...state.world.regulars,
        [regularId]: {
          ...state.world.regulars[regularId]!,
          castAttributes: NEUTRAL_REGULAR_CAST,
        },
      },
    },
  }
}

function withNeutralCohortVoice(
  state: TavernState,
  groupId: string,
): TavernState {
  return {
    ...state,
    customerGroups: {
      ...state.customerGroups,
      [groupId]: {
        ...state.customerGroups[groupId]!,
        castAttributes: NEUTRAL_COHORT_CAST,
      },
    },
  }
}

function withRegularMeters(
  state: TavernState,
  regularId: string,
  partial: { irritation?: number; loyalty?: number },
): TavernState {
  const original = state.world.regulars[regularId]!
  return {
    ...state,
    world: {
      ...state.world,
      regulars: {
        ...state.world.regulars,
        [regularId]: {
          ...original,
          ...(partial.irritation !== undefined ? { irritation: partial.irritation } : {}),
          ...(partial.loyalty !== undefined ? { loyalty: partial.loyalty } : {}),
        },
      },
    },
  }
}

function withGroupMeters(
  state: TavernState,
  groupId: string,
  partial: { satisfaction?: number; loyalty?: number },
): TavernState {
  const original = state.customerGroups[groupId]!
  return {
    ...state,
    customerGroups: {
      ...state.customerGroups,
      [groupId]: {
        ...original,
        ...(partial.satisfaction !== undefined ? { satisfaction: partial.satisfaction } : {}),
        ...(partial.loyalty !== undefined ? { loyalty: partial.loyalty } : {}),
      },
    },
  }
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

// ─── regular_customer (regularComplaint) fixtures ───────────────────

function regularComplaintSeed(
  regularId: string,
  id = 'regular-complaint-matrix',
): IssueSeed {
  return makeSeed({
    id,
    family: 'regular_customer' as IssueSeedFamilyId,
    type: 'complaint',
    timing: 'during_service',
    severity: 60,
    domain: ['regulars', 'customers', 'social'],
    primaryActor: regularRef(regularId),
  })
}

describe('regularComplaint — exhaustive irritation × loyalty matrix cells', () => {
  // Band thresholds: low (<40), mid (40–69), high (≥70). The seed
  // generator picks regulars with `irritation > 60`, so the
  // low-irritation row never resolves at runtime — author the 4
  // corners the design distinguishes (mid/high × low/high).
  const tests: {
    label: string
    irritation: number
    loyalty: number
    substring: string
  }[] = [
    {
      label: 'high × high (years of loyalty crashing into the moment)',
      irritation: 85,
      loyalty: 85,
      substring: 'Years between us',
    },
    {
      label: 'high × low (the relationship over)',
      irritation: 85,
      loyalty: 20,
      substring: "Door's already in their hand",
    },
    {
      label: 'mid × high (still loyal, but patience thinning)',
      irritation: 50,
      loyalty: 85,
      substring: 'patience is thinning',
    },
    {
      label: 'mid × low (slow drift)',
      irritation: 50,
      loyalty: 20,
      substring: 'visits getting shorter',
    },
  ]
  for (const { label, irritation, loyalty, substring } of tests) {
    it(`opens with the combo cell for ${label}`, () => {
      const base = createInitialTavernState()
      const regularId = firstRegularId(base)
      const neutral = withNeutralRegularVoice(base, regularId)
      const state = withRegularMeters(neutral, regularId, { irritation, loyalty })
      const view = regularComplaintCard.render(
        regularComplaintSeed(regularId, `regular-${irritation}-${loyalty}`),
        state,
      )
      expect(view.body[0]).toContain(substring)
    })
  }

  it('opens with loyalty=low × regular_customer_loss-rising top rung when irritation is out of the matrix band', () => {
    const base = createInitialTavernState()
    const regularId = firstRegularId(base)
    let state = withNeutralRegularVoice(base, regularId)
    // Set irritation in the low band (< 40) so no irritation-keyed
    // snippet matches — only loyalty + pressure-rising candidates
    // remain. The seed generator never fires regularComplaint for low
    // irritation, but this test bypasses the generator to isolate the
    // pure loyalty × loss rung. `est_loyalty_loss` (spec 2) wins over
    // the single-condition `est_low_loyalty` (spec 1).
    state = withRegularMeters(state, regularId, { irritation: 10, loyalty: 20 })
    state = withRisingPressure(state, 'regular_customer_loss')
    const view = regularComplaintCard.render(
      regularComplaintSeed(regularId, 'regular-loyalty-loss-rung'),
      state,
    )
    // `est_loyalty_loss`: "Loyalty thinning, and the regulars drifting from the door."
    expect(view.body[0]).toContain('regulars drifting from the door')
  })
})

// ─── customer_complaint (customerComplaint) fixtures ────────────────

function customerComplaintSeed(
  groupId: string,
  id = 'customer-complaint-matrix',
): IssueSeed {
  return makeSeed({
    id,
    family: 'customer_complaint' as IssueSeedFamilyId,
    type: 'complaint',
    timing: 'during_service',
    severity: 55,
    domain: ['customers', 'reputation', 'service'],
    primaryActor: groupRef(groupId),
  })
}

describe('customerComplaint — exhaustive satisfaction × loyalty matrix cells', () => {
  const tests: {
    label: string
    satisfaction: number
    loyalty: number
    substring: string
  }[] = [
    {
      label: 'low × low (the cohort walking out)',
      satisfaction: 20,
      loyalty: 20,
      substring: 'eyes already on the door',
    },
    {
      label: 'low × high (loyal cohort surprised by the stumble)',
      satisfaction: 20,
      loyalty: 85,
      substring: 'Loyal regulars watching us stumble',
    },
    {
      label: 'mid × low (drifting anyway)',
      satisfaction: 50,
      loyalty: 20,
      substring: 'Nothing in particular holds them',
    },
    {
      label: 'mid × high (forgiven a hundred nights)',
      satisfaction: 50,
      loyalty: 85,
      substring: 'A hundred forgiven nights',
    },
  ]
  for (const { label, satisfaction, loyalty, substring } of tests) {
    it(`opens with the combo cell for ${label}`, () => {
      const base = createInitialTavernState()
      const groupId = firstGroupId(base)
      const neutral = withNeutralCohortVoice(base, groupId)
      const state = withGroupMeters(neutral, groupId, { satisfaction, loyalty })
      const view = customerComplaintCard.render(
        customerComplaintSeed(groupId, `cohort-${satisfaction}-${loyalty}`),
        state,
      )
      expect(view.body[0]).toContain(substring)
    })
  }

  it('opens with satisfaction=low × reputation_drift-rising top rung', () => {
    const base = createInitialTavernState()
    const groupId = firstGroupId(base)
    let state = withNeutralCohortVoice(base, groupId)
    // Hold loyalty mid so the satisfaction × loyalty corner combos do
    // not out-rank the pressure rung — satisfaction low + reputation
    // rising is the intended fixture.
    state = withGroupMeters(state, groupId, { satisfaction: 25, loyalty: 50 })
    state = withRisingPressure(state, 'reputation_drift')
    const view = customerComplaintCard.render(
      customerComplaintSeed(groupId, 'cohort-sat-reputation'),
      state,
    )
    // `est_sat_reputation`: "Their mood drops as the talk about us turns sour outside."
    expect(view.body[0]).toContain('talk about us turns sour')
  })
})

// ─── State-varying reaction proof ───────────────────────────────────
//
// The Phase 6 plan requires reaction/sensory lines to vary with state,
// not just voice. These tests render the same template under two
// distinct states (neutral voice held constant) and assert body[1]
// differs.

describe('regularComplaint — reaction_line varies with state, not just voice', () => {
  it('high-irritation regular and a loss-pressure regular produce different reactions', () => {
    const base = createInitialTavernState()
    const regularId = firstRegularId(base)
    const neutral = withNeutralRegularVoice(base, regularId)
    // Hold loyalty mid in both fixtures so the body[1] difference is
    // driven only by the second state mutation.
    const angry = withRegularMeters(neutral, regularId, { irritation: 85, loyalty: 50 })
    const driftingBase = withRegularMeters(neutral, regularId, { irritation: 50, loyalty: 50 })
    const drifting = withRisingPressure(driftingBase, 'regular_customer_loss')
    const angryView = regularComplaintCard.render(
      regularComplaintSeed(regularId, 'regular-angry'),
      angry,
    )
    const driftingView = regularComplaintCard.render(
      regularComplaintSeed(regularId, 'regular-drifting'),
      drifting,
    )
    expect(angryView.body[1]).not.toBe(driftingView.body[1])
  })
})

describe('customerComplaint — reaction_line varies with state', () => {
  it('low-satisfaction cohort and a complaint-memory cohort produce different reactions', () => {
    const base = createInitialTavernState()
    const groupId = firstGroupId(base)
    const neutral = withNeutralCohortVoice(base, groupId)
    // Hold loyalty mid in both so body[1] difference is driven only by
    // the second state mutation.
    const lowSat = withGroupMeters(neutral, groupId, { satisfaction: 25, loyalty: 50 })
    const memoryBase = withGroupMeters(neutral, groupId, { satisfaction: 50, loyalty: 50 })
    const withComplaintMemory = withMemory(memoryBase, 'past_complaint', ['complaint'])
    const lowSatView = customerComplaintCard.render(
      customerComplaintSeed(groupId, 'cohort-low-sat-reaction'),
      lowSat,
    )
    const memoryView = customerComplaintCard.render(
      customerComplaintSeed(groupId, 'cohort-complaint-memory-reaction'),
      withComplaintMemory,
    )
    expect(lowSatView.body[1]).not.toBe(memoryView.body[1])
  })
})

// ─── drinkOrder state-keyed mannerNote proof ────────────────────────
//
// drinkOrder has no establishing_line slot (the order_line is the
// regular's voice, not a fact-stating slot), but the relationship_test
// branch still benefits from a manner that reflects the regular's
// standing. Phase 6 adds 4 state-keyed snippets to its mannerNote pool;
// these tests prove two of them fire on the expected meters.

function drinkOrderSeed(
  regularId: string,
  id = 'drink-order-matrix',
): IssueSeed {
  return makeSeed({
    id,
    family: 'regular_customer' as IssueSeedFamilyId,
    type: 'relationship_test',
    timing: 'during_service',
    severity: 35,
    domain: ['regulars', 'customers', 'social'],
    primaryActor: regularRef(regularId),
  })
}

describe('drinkOrder — manner_note varies with the regular\'s standing', () => {
  it('high-loyalty regular and low-loyalty regular produce different manner beats (neutral voice)', () => {
    const base = createInitialTavernState()
    const regularId = firstRegularId(base)
    const neutral = withNeutralRegularVoice(base, regularId)
    // Hold irritation low so drinkOrder remains the matched template
    // (relationship_test fires when irritation ≤ 60) and the manner
    // varies purely on loyalty.
    const loyal = withRegularMeters(neutral, regularId, { irritation: 10, loyalty: 85 })
    const fading = withRegularMeters(neutral, regularId, { irritation: 10, loyalty: 20 })
    const loyalView = drinkOrderCard.render(
      drinkOrderSeed(regularId, 'drink-loyal'),
      loyal,
    )
    const fadingView = drinkOrderCard.render(
      drinkOrderSeed(regularId, 'drink-fading'),
      fading,
    )
    // body shape for drinkOrder is [order_line, manner_note?]. The
    // manner_note lives at body[1] when present.
    expect(loyalView.body[1]).toBeDefined()
    expect(fadingView.body[1]).toBeDefined()
    expect(loyalView.body[1]).not.toBe(fadingView.body[1])
  })
})

// ─── Determinism + re-render stability ──────────────────────────────

describe('regulars & complaints matrix cells — re-render stability', () => {
  it('regularComplaint high × high combo is byte-identical on re-render', () => {
    const base = createInitialTavernState()
    const regularId = firstRegularId(base)
    let state = withNeutralRegularVoice(base, regularId)
    state = withRegularMeters(state, regularId, { irritation: 85, loyalty: 85 })
    const seed = regularComplaintSeed(regularId, 'regular-stable')
    const a = regularComplaintCard.render(seed, state)
    const b = regularComplaintCard.render(seed, state)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('customerComplaint low × low combo is byte-identical on re-render', () => {
    const base = createInitialTavernState()
    const groupId = firstGroupId(base)
    let state = withNeutralCohortVoice(base, groupId)
    state = withGroupMeters(state, groupId, { satisfaction: 20, loyalty: 20 })
    const seed = customerComplaintSeed(groupId, 'cohort-stable')
    const a = customerComplaintCard.render(seed, state)
    const b = customerComplaintCard.render(seed, state)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })
})
