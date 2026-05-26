// Phase 156 / ISSUE-124 — Legible Surface arc, Phase 11
// (Periodic & Narrative cluster, final Movement VI phase).
//
// Exhaustive matrix-cell reachability tests for the two compositional
// templates this phase deepens: monthlyReviewCard (narrator-voiced;
// matrix cells on `(pressure × memory)` / `(dual pressure)` /
// `(severity × pressure × memory|repeat)`) and seasonalArcCard
// (narrator-voiced; matrix on `(theme × memory)` / `(theme × severity ×
// pressure)` / `(dual pressure)` / top-rung `(climax × severity ×
// pressure)` / `(theme × pressure × memory)`).
//
// Both families are narrator-voiced — `monthly_review`'s primaryActor
// is a `month` ref (no castAttributes) and `seasonal_arc`'s is a
// `local_event` ref (Path A) or `undefined` (Path B). Variety comes
// from state perturbation, not voice axes. Every matrix combo carries
// ≥1 state-lookup primitive (`pressureRising` / `memoryPresent` /
// `repeatCount`) so simCoherence passes — `hasTag`,
// `severityAtLeast`, and `seedType` are not state-lookup kinds on
// their own.

import { describe, expect, it } from 'vitest'

import {
  monthlyReviewCard,
  seasonalArcCard,
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
import { makeSeed } from '../cardFactories'

// ─── Shared helpers ─────────────────────────────────────────────────

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

// Repeat-count of N for a given subject tag is read against memories
// flow via `repeatCountByTag`. Add ≥N memories tagged with the subject.
function withRepeats(
  state: TavernState,
  subjectTag: string,
  count = 3,
): TavernState {
  let next = state
  for (let i = 0; i < count; i++) {
    next = withMemory(next, `repeat-${subjectTag}-${i}`, [subjectTag])
  }
  return next
}

// ─── monthly_review fixtures ────────────────────────────────────────

function monthlyReviewSeed(
  id: string,
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
  })
}

describe('monthlyReviewCard — pressure × memory combos', () => {
  const tests: {
    label: string
    pressure: string
    memoryTag: string
    substring: string
  }[] = [
    {
      label: 'landlord × rent-memory',
      pressure: 'landlord',
      memoryTag: 'rent',
      substring: 'rent paid last month',
    },
    {
      label: 'landlord × reserves-memory',
      pressure: 'landlord',
      memoryTag: 'reserves',
      substring: 'reserves already held back',
    },
    {
      label: 'debt × rent-memory',
      pressure: 'debt',
      memoryTag: 'rent',
      substring: 'shortfall widens',
    },
    {
      label: 'rival_tavern_pressure × rival-memory',
      pressure: 'rival_tavern_pressure',
      memoryTag: 'rival',
      substring: 'rival house is taking',
    },
    {
      label: 'landlord × cellar-memory',
      pressure: 'landlord',
      memoryTag: 'cellar',
      substring: 'cellar investment shows',
    },
  ]
  for (const { label, pressure, memoryTag, substring } of tests) {
    it(`opens with the spec-2 cell for ${label}`, () => {
      let state = createInitialTavernState()
      state = withRisingPressure(state, pressure, 50)
      state = withMemory(state, `mem-${pressure}-${memoryTag}`, [memoryTag])
      const seed = monthlyReviewSeed(`monthly-${pressure}-${memoryTag}`)
      const view = monthlyReviewCard.render(seed, state)
      expect(view.body[0]).toContain(substring)
    })
  }
})

describe('monthlyReviewCard — dual-pressure combos', () => {
  it('opens with the debt × landlord dual-pressure cell', () => {
    let state = createInitialTavernState()
    state = withRisingPressure(state, 'debt', 50)
    state = withRisingPressure(state, 'landlord', 50)
    const seed = monthlyReviewSeed('monthly-debt-landlord-dual')
    const view = monthlyReviewCard.render(seed, state)
    expect(view.body[0]).toContain('Debt and landlord columns')
  })

  it('opens with the customer_complaint × reputation_drift dual-pressure cell', () => {
    let state = createInitialTavernState()
    state = withRisingPressure(state, 'customer_complaint', 50)
    state = withRisingPressure(state, 'reputation_drift', 50)
    const seed = monthlyReviewSeed('monthly-complaint-rep-dual')
    const view = monthlyReviewCard.render(seed, state)
    expect(view.body[0]).toContain('Complaints climb')
  })

  it('opens with the staff_burnout × landlord dual-pressure cell', () => {
    let state = createInitialTavernState()
    state = withRisingPressure(state, 'staff_burnout', 50)
    state = withRisingPressure(state, 'landlord', 50)
    const seed = monthlyReviewSeed('monthly-staff-landlord-dual')
    const view = monthlyReviewCard.render(seed, state)
    expect(view.body[0]).toContain('staff edge thickens')
  })
})

describe('monthlyReviewCard — severity top-rung cells', () => {
  it('opens with the severity × landlord × rent-memory 3-cond top rung', () => {
    let state = createInitialTavernState()
    state = withRisingPressure(state, 'landlord', 50)
    state = withMemory(state, 'rent-mem-top', ['rent'])
    const seed = monthlyReviewSeed('monthly-severity-landlord-rent', {
      severity: 75,
    })
    const view = monthlyReviewCard.render(seed, state)
    expect(view.body[0]).toContain('Crisis at the rent line')
  })

  it('opens with the severity × debt × repeat 3-cond deepest rung', () => {
    let state = createInitialTavernState()
    state = withRisingPressure(state, 'debt', 50)
    state = withRepeats(state, 'monthly', 3)
    const seed = monthlyReviewSeed('monthly-severity-debt-repeat', {
      severity: 80,
    })
    const view = monthlyReviewCard.render(seed, state)
    expect(view.body[0]).toContain('Critical shortfall')
  })
})

// ─── seasonal_arc fixtures ──────────────────────────────────────────

function arcRef(id: string): EntityRef {
  return { kind: 'local_event', id }
}

function seasonalArcSeed(
  id: string,
  overrides: {
    severity?: number
    theme?: string
    type?: 'arc_milestone' | 'festival_preparation'
    primaryActor?: EntityRef
  } = {},
): IssueSeed {
  const theme = overrides.theme ?? 'festival_approaching'
  return makeSeed({
    id,
    family: 'seasonal_arc' as IssueSeedFamilyId,
    type: overrides.type ?? 'festival_preparation',
    timing: 'morning_prep',
    severity: overrides.severity ?? 45,
    domain: ['arcs', 'calendar'],
    toneHints: ['arc', 'calendar', theme],
    ...(overrides.primaryActor ? { primaryActor: overrides.primaryActor } : {}),
  })
}

describe('seasonalArcCard — theme × memory combos', () => {
  const tests: {
    label: string
    theme: string
    memoryTag: string
    substring: string
  }[] = [
    {
      label: 'blight × arc-memory',
      theme: 'mushroom_blight',
      memoryTag: 'arc',
      substring: 'mushroom blight bites',
    },
    {
      label: 'payday × arc-memory',
      theme: 'miner_payday_boom',
      memoryTag: 'arc',
      substring: 'Miner payday floods',
    },
    {
      label: 'inspection × arc-memory',
      theme: 'inspection_campaign',
      memoryTag: 'arc',
      substring: 'inspection sweep is on',
    },
    {
      label: 'rival_expansion × arc-memory',
      theme: 'rival_tavern_expansion',
      memoryTag: 'arc',
      substring: 'rival expansion presses in',
    },
    {
      label: 'festival × festival-memory',
      theme: 'festival_approaching',
      memoryTag: 'festival',
      substring: 'festival gathers on the calendar',
    },
  ]
  for (const { label, theme, memoryTag, substring } of tests) {
    it(`opens with the spec-2 cell for ${label}`, () => {
      let state = createInitialTavernState()
      state = withMemory(state, `arc-mem-${theme}`, [memoryTag])
      const seed = seasonalArcSeed(`arc-${theme}-${memoryTag}`, {
        theme,
        primaryActor: arcRef(theme),
      })
      const view = seasonalArcCard.render(seed, state)
      expect(view.body[0]).toContain(substring)
    })
  }
})

describe('seasonalArcCard — theme × severity × pressure combos', () => {
  it('opens with the blight × severity 70 × arc_escalation 3-cond cell', () => {
    let state = createInitialTavernState()
    state = withRisingPressure(state, 'arc_escalation', 50)
    const seed = seasonalArcSeed('arc-blight-severity', {
      theme: 'mushroom_blight',
      severity: 75,
      primaryActor: arcRef('mushroom_blight'),
    })
    const view = seasonalArcCard.render(seed, state)
    expect(view.body[0]).toContain('blight has cut deep')
  })

  it('opens with the inspection × severity 70 × arc_escalation 3-cond cell', () => {
    let state = createInitialTavernState()
    state = withRisingPressure(state, 'arc_escalation', 50)
    const seed = seasonalArcSeed('arc-inspection-severity', {
      theme: 'inspection_campaign',
      severity: 75,
      primaryActor: arcRef('inspection_campaign'),
    })
    const view = seasonalArcCard.render(seed, state)
    expect(view.body[0]).toContain('inspection sweep has reached')
  })
})

describe('seasonalArcCard — dual-pressure + top rungs', () => {
  it('opens with the arc_escalation × festival_readiness dual-pressure cell', () => {
    let state = createInitialTavernState()
    state = withRisingPressure(state, 'arc_escalation', 50)
    state = withRisingPressure(state, 'festival_readiness', 50)
    const seed = seasonalArcSeed('arc-dual-pressure', {
      theme: 'festival_approaching',
      primaryActor: arcRef('festival_approaching'),
    })
    const view = seasonalArcCard.render(seed, state)
    expect(view.body[0]).toContain('Arc pressure climbs and festival readiness')
  })

  it('opens with the arc_milestone × severity × arc_escalation climax top rung', () => {
    // `festival_approaching` theme deliberately chosen: it has no
    // competing `(theme × severity × pressure)` spec-3 cell (only
    // `mushroom_blight` and `inspection_campaign` do), so the climax
    // cell is the unique spec-3 winner here. With festival_readiness
    // NOT rising and no festival memory, `est_festival_pressure_memory`
    // doesn't match either.
    let state = createInitialTavernState()
    state = withRisingPressure(state, 'arc_escalation', 50)
    const seed = seasonalArcSeed('arc-climax-severity', {
      type: 'arc_milestone',
      theme: 'festival_approaching',
      severity: 80,
      primaryActor: arcRef('festival_approaching'),
    })
    const view = seasonalArcCard.render(seed, state)
    expect(view.body[0]).toContain('arc has reached its climax')
  })

  it('opens with the festival × festival_readiness × festival-memory deepest rung', () => {
    let state = createInitialTavernState()
    state = withRisingPressure(state, 'festival_readiness', 50)
    state = withMemory(state, 'arc-festival-mem-deep', ['festival'])
    const seed = seasonalArcSeed('arc-festival-deep', {
      theme: 'festival_approaching',
      primaryActor: arcRef('festival_approaching'),
    })
    const view = seasonalArcCard.render(seed, state)
    expect(view.body[0]).toContain('festival nears; readiness climbs')
  })
})

// ─── State-varying reaction tests ──────────────────────────────────

describe('monthlyReviewCard — reaction_line varies with state', () => {
  it('a landlord-rising state and a debt-rising state produce different reactions', () => {
    const baseState = createInitialTavernState()
    const landlordState = withRisingPressure(baseState, 'landlord', 50)
    const debtState = withRisingPressure(baseState, 'debt', 50)
    const seed = monthlyReviewSeed('monthly-reaction-vary')
    const landlordView = monthlyReviewCard.render(seed, landlordState)
    const debtView = monthlyReviewCard.render(seed, debtState)
    expect(landlordView.body[1]).not.toBe(debtView.body[1])
    expect(landlordView.body[1]).toBeDefined()
    expect(debtView.body[1]).toBeDefined()
  })
})

describe('seasonalArcCard — reaction_line varies with state', () => {
  it('an arc_escalation + arc-memory state and a dual-pressure state produce different reactions', () => {
    // Each state forces a spec-2 new reaction (rxn_arc_memory_pressure
    // vs rxn_dual_pressure) so the comparison is not dominated by the
    // spec-1 theme-tag reaction (`rxn_festival`) that fires for every
    // festival_approaching-themed seed.
    const baseState = createInitialTavernState()
    let arcState = withRisingPressure(baseState, 'arc_escalation', 50)
    arcState = withMemory(arcState, 'arc-vary-mem', ['arc'])
    let dualState = withRisingPressure(baseState, 'arc_escalation', 50)
    dualState = withRisingPressure(dualState, 'festival_readiness', 50)
    const seed = seasonalArcSeed('arc-reaction-vary', {
      theme: 'festival_approaching',
      primaryActor: arcRef('festival_approaching'),
    })
    const arcView = seasonalArcCard.render(seed, arcState)
    const dualView = seasonalArcCard.render(seed, dualState)
    expect(arcView.body[1]).not.toBe(dualView.body[1])
    expect(arcView.body[1]).toBeDefined()
    expect(dualView.body[1]).toBeDefined()
  })
})

// ─── Re-render stability ───────────────────────────────────────────

describe('periodic & narrative matrix cells — re-render stability', () => {
  it('monthlyReview cell is byte-identical on re-render', () => {
    let state = createInitialTavernState()
    state = withRisingPressure(state, 'landlord', 50)
    state = withMemory(state, 'rent-stability', ['rent'])
    const seed = monthlyReviewSeed('monthly-stable')
    const a = monthlyReviewCard.render(seed, state)
    const b = monthlyReviewCard.render(seed, state)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('seasonalArc cell is byte-identical on re-render', () => {
    let state = createInitialTavernState()
    state = withRisingPressure(state, 'arc_escalation', 50)
    state = withMemory(state, 'arc-stable-mem', ['arc'])
    const seed = seasonalArcSeed('arc-stable', {
      theme: 'mushroom_blight',
      primaryActor: arcRef('mushroom_blight'),
    })
    const a = seasonalArcCard.render(seed, state)
    const b = seasonalArcCard.render(seed, state)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })
})
