// Phase 150 / ISSUE-118 — Legible Surface arc, Phase 5
// (Staff & Personnel cluster).
//
// Exhaustive matrix-cell reachability tests for the two staff
// compositional templates (staffAside, staffBurnout). For each, this
// file enumerates hand-picked `(seed, state)` fixtures covering the
// 9-cell stress × fatigue matrix corners + the pressure × signal /
// memory top rungs, and asserts the establishing line resolves to the
// matrix cell snippet (matched by a distinctive substring only the
// combo cell contains). Proves the authored cells are reachable, not
// just present in the pool.
//
// Mirrors the Phase 149 supplier/stock/debt matrix-coverage approach:
// when both top-salient facts of a corner resolve, the spec-2 combo
// snippet wins specificity over both single-condition snippets AND
// over the multi-fact join.

import { describe, expect, it } from 'vitest'

import {
  staffAsideCard,
  staffBurnoutCard,
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
import type { CastAttributes } from '../../../src/sim/content/cast'
import { makeSeed } from '../cardFactories'

function firstStaffId(state: TavernState): string {
  const id = Object.keys(state.staff)[0]
  if (!id) throw new Error('test setup expects at least one starter staff member')
  return id
}

function staffRef(id: string): EntityRef {
  return { kind: 'staff', id }
}

// Neutral voice + neutral specialty so voice-axis-gated snippets (which
// require atLeast: 2 or atMost: 0) never fire and we can prove state-
// keyed snippets vary independently of voice — same pattern as the
// Phase-149 `withNeutralSupplierVoice` helper.
const NEUTRAL_STAFF_CAST: CastAttributes = {
  specialty: 'meat_dishes',
  blindspot: 'pastry',
  affinities: [],
  voice: { axes: { terseness: 1, warmth: 1, formality: 1, floridity: 1 } },
}

function withNeutralStaffVoice(
  state: TavernState,
  staffId: string,
): TavernState {
  return {
    ...state,
    staff: {
      ...state.staff,
      [staffId]: {
        ...state.staff[staffId]!,
        castAttributes: NEUTRAL_STAFF_CAST,
      },
    },
  }
}

function withStaffMeters(
  state: TavernState,
  staffId: string,
  partial: { stress?: number; fatigue?: number },
): TavernState {
  const original = state.staff[staffId]!
  return {
    ...state,
    staff: {
      ...state.staff,
      [staffId]: {
        ...original,
        ...(partial.stress !== undefined ? { stress: partial.stress } : {}),
        ...(partial.fatigue !== undefined ? { fatigue: partial.fatigue } : {}),
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

// ─── staff_identity (staffAside) fixtures ───────────────────────────

function staffAsideSeed(staffId: string, id = 'staff-aside-matrix'): IssueSeed {
  return makeSeed({
    id,
    family: 'staff_identity' as IssueSeedFamilyId,
    type: 'relationship_test',
    timing: 'morning_prep',
    severity: 45,
    domain: ['staff', 'identity', 'social'],
    primaryActor: staffRef(staffId),
  })
}

describe('staffAside — exhaustive stress × fatigue matrix cells', () => {
  // Stress band thresholds: low (<40), mid (40–69), high (≥70). Use 20
  // and 85 for the corner combos; both are unambiguously inside their
  // bands.
  const tests: {
    label: string
    stress: number
    fatigue: number
    substring: string
  }[] = [
    {
      label: 'low × low (fresh morning)',
      stress: 20,
      fatigue: 20,
      substring: 'has not landed on them yet',
    },
    {
      label: 'low × high (calm but worn)',
      stress: 20,
      fatigue: 85,
      substring: 'shows in their shoulders',
    },
    {
      label: 'high × low (tense but rested)',
      stress: 85,
      fatigue: 20,
      substring: 'pulled tight before the door',
    },
    {
      label: 'high × high (exhausted and tight)',
      stress: 85,
      fatigue: 85,
      substring: 'long week sits heavy',
    },
  ]
  for (const { label, stress, fatigue, substring } of tests) {
    it(`opens with the combo cell for ${label}`, () => {
      const base = createInitialTavernState()
      const staffId = firstStaffId(base)
      const neutral = withNeutralStaffVoice(base, staffId)
      const state = withStaffMeters(neutral, staffId, { stress, fatigue })
      const view = staffAsideCard.render(staffAsideSeed(staffId), state)
      expect(view.body[0]).toContain(substring)
    })
  }

  it('opens with fatigue × burnout-rising combo when both fire', () => {
    const base = createInitialTavernState()
    const staffId = firstStaffId(base)
    let state = withNeutralStaffVoice(base, staffId)
    state = withStaffMeters(state, staffId, { fatigue: 85 })
    state = withRisingPressure(state, 'staff_burnout')
    const view = staffAsideCard.render(staffAsideSeed(staffId, 'aside-fatigue-burnout'), state)
    // `est_fatigue_burnout`: "Slow steps, and the load already crowding into the morning."
    expect(view.body[0]).toContain('already crowding into the morning')
  })
})

// ─── staff_burnout (staffBurnout) fixtures ──────────────────────────

function staffBurnoutSeed(staffId: string, id = 'staff-burnout-matrix'): IssueSeed {
  return makeSeed({
    id,
    family: 'staff_burnout' as IssueSeedFamilyId,
    type: 'staff_request',
    timing: 'morning_prep',
    severity: 55,
    domain: ['staff'],
    primaryActor: staffRef(staffId),
  })
}

describe('staffBurnout — exhaustive stress × fatigue matrix cells', () => {
  const tests: {
    label: string
    stress: number
    fatigue: number
    substring: string
  }[] = [
    {
      label: 'low × low (week still ahead)',
      stress: 20,
      fatigue: 20,
      substring: 'week still ahead of them',
    },
    {
      label: 'low × high (calm but worn)',
      stress: 20,
      fatigue: 85,
      substring: 'run of long shifts',
    },
    {
      label: 'high × low (tense but rested)',
      stress: 85,
      fatigue: 20,
      substring: 'wound tight at the rota',
    },
    {
      label: 'high × high (worn through)',
      stress: 85,
      fatigue: 85,
      substring: 'long week wearing them through',
    },
  ]
  for (const { label, stress, fatigue, substring } of tests) {
    it(`opens with the combo cell for ${label}`, () => {
      const base = createInitialTavernState()
      const staffId = firstStaffId(base)
      const neutral = withNeutralStaffVoice(base, staffId)
      const state = withStaffMeters(neutral, staffId, { stress, fatigue })
      const view = staffBurnoutCard.render(staffBurnoutSeed(staffId), state)
      expect(view.body[0]).toContain(substring)
    })
  }

  it('opens with fatigue × bonus-memory combo when both fire', () => {
    const base = createInitialTavernState()
    const staffId = firstStaffId(base)
    let state = withNeutralStaffVoice(base, staffId)
    state = withStaffMeters(state, staffId, { fatigue: 85 })
    state = withMemory(state, 'last_payday_bonus', ['bonus'])
    const view = staffBurnoutCard.render(staffBurnoutSeed(staffId, 'burnout-fatigue-bonus'), state)
    // `est_fatigue_bonus`: "Bone-tired, even with the bonus still warm in their pocket."
    expect(view.body[0]).toContain('still warm in their pocket')
  })
})

// ─── State-varying reaction proof ───────────────────────────────────
//
// The Phase 5 plan requires reaction/aside lines to vary with state,
// not just voice. These tests render the same template under two
// distinct states (neutral voice held constant) and assert the
// body[1] differs.

describe('staffAside — aside_line varies with state, not just voice', () => {
  it('high-stress staff and low-stress staff produce different aside_line lines (neutral voice)', () => {
    const base = createInitialTavernState()
    const staffId = firstStaffId(base)
    const neutral = withNeutralStaffVoice(base, staffId)
    const tense = withStaffMeters(neutral, staffId, { stress: 85, fatigue: 20 })
    const steady = withStaffMeters(neutral, staffId, { stress: 20, fatigue: 20 })
    const tenseView = staffAsideCard.render(staffAsideSeed(staffId, 'aside-tense'), tense)
    const steadyView = staffAsideCard.render(staffAsideSeed(staffId, 'aside-steady'), steady)
    expect(tenseView.body[1]).not.toBe(steadyView.body[1])
  })
})

describe('staffBurnout — reaction_line varies with state', () => {
  it('high-fatigue + bonus-memory state produces a different reaction than the bare fallback', () => {
    const base = createInitialTavernState()
    const staffId = firstStaffId(base)
    const neutral = withNeutralStaffVoice(base, staffId)
    let primed = withStaffMeters(neutral, staffId, { fatigue: 85 })
    primed = withMemory(primed, 'last_payday_bonus', ['bonus'])
    const baseView = staffBurnoutCard.render(staffBurnoutSeed(staffId, 'burnout-base'), neutral)
    const primedView = staffBurnoutCard.render(staffBurnoutSeed(staffId, 'burnout-primed'), primed)
    expect(baseView.body[1]).not.toBe(primedView.body[1])
  })
})

// ─── Determinism + re-render stability ──────────────────────────────

describe('staff matrix cells — re-render stability', () => {
  it('staffAside high × high combo is byte-identical on re-render', () => {
    const base = createInitialTavernState()
    const staffId = firstStaffId(base)
    let state = withNeutralStaffVoice(base, staffId)
    state = withStaffMeters(state, staffId, { stress: 85, fatigue: 85 })
    const seed = staffAsideSeed(staffId, 'aside-stable')
    const a = staffAsideCard.render(seed, state)
    const b = staffAsideCard.render(seed, state)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('staffBurnout fatigue × bonus combo is byte-identical on re-render', () => {
    const base = createInitialTavernState()
    const staffId = firstStaffId(base)
    let state = withNeutralStaffVoice(base, staffId)
    state = withStaffMeters(state, staffId, { fatigue: 85 })
    state = withMemory(state, 'last_payday_bonus', ['bonus'])
    const seed = staffBurnoutSeed(staffId, 'burnout-stable')
    const a = staffBurnoutCard.render(seed, state)
    const b = staffBurnoutCard.render(seed, state)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })
})
