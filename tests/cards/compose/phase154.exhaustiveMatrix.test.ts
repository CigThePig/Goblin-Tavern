// Phase 154 / ISSUE-122 — Legible Surface arc, Phase 9
// (Crises & Safety cluster).
//
// Exhaustive matrix-cell reachability tests for the three compositional
// templates this phase deepens: foodSafetyCrisis (area.cleanliness ×
// staff.stress × staff.fatigue 3-meter cross-role cube), violence
// (customer_group.rowdiness × customer_group.satisfaction × area.damage
// 3-meter cross-role cube), and inspection (faction.relationship ×
// faction.influence × area.cleanliness 3-meter cross-role cube).
//
// For each template this file enumerates hand-picked `(seed, state)`
// fixtures covering the spec-3 cube corners and spec-2 supports and
// asserts the establishing line resolves to the matrix-cell snippet
// (matched by a distinctive substring only the combo cell contains).
// Proves the authored cells are reachable, not just present in the pool.
//
// Mirrors the Phase 149 / 150 / 151 / 152 / 153 matrix-coverage shape:
// when all (or both) top-salient facts of a corner resolve, the
// authored combo snippet wins specificity over single-condition
// snippets AND over the multi-fact join.

import { describe, expect, it } from 'vitest'

import {
  foodSafetyCrisisCard,
  inspectionCard,
  violenceCard,
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
import type {
  CustomerGroupCastAttributes,
  FactionCastAttributes,
} from '../../../src/sim/content/cast'
import { makeSeed } from '../cardFactories'

// ─── Shared helpers ─────────────────────────────────────────────────

function firstStaffId(state: TavernState): string {
  const id = Object.keys(state.staff)[0]
  if (!id) throw new Error('test setup expects at least one starter staff member')
  return id
}

function firstCustomerGroupId(state: TavernState): string {
  const id = Object.keys(state.customerGroups)[0]
  if (!id) {
    throw new Error('test setup expects at least one starter customer group')
  }
  return id
}

function firstFactionId(state: TavernState): string {
  const id = Object.keys(state.world.factions)[0]
  if (!id) throw new Error('test setup expects at least one starter faction')
  return id
}

function staffRef(id: string): EntityRef {
  return { kind: 'staff', id }
}

function customerGroupRef(id: string): EntityRef {
  return { kind: 'customer_group', id }
}

function factionRef(id: string): EntityRef {
  return { kind: 'faction', id }
}

// Neutral cast — axes all at 1 so voice-extreme reaction/manner
// snippets (which require atLeast: 2 or atMost: 0) never fire; isolates
// state-keyed snippets from voice perturbation.
const NEUTRAL_STAFF_CAST: CastAttributes = {
  specialty: 'meat_dishes',
  blindspot: 'pastry',
  affinities: [],
  voice: { axes: { terseness: 1, warmth: 1, formality: 1, floridity: 1 } },
}

const NEUTRAL_GROUP_CAST: CustomerGroupCastAttributes = {
  voice: { axes: { terseness: 1, warmth: 1, formality: 1, floridity: 1 } },
}

const NEUTRAL_FACTION_CAST: FactionCastAttributes = {
  specialty: 'ceremony',
  blindspot: 'patience',
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

function withNeutralGroupVoice(
  state: TavernState,
  groupId: string,
): TavernState {
  return {
    ...state,
    customerGroups: {
      ...state.customerGroups,
      [groupId]: {
        ...state.customerGroups[groupId]!,
        castAttributes: NEUTRAL_GROUP_CAST,
      },
    },
  }
}

function withNeutralFactionVoice(
  state: TavernState,
  factionId: string,
): TavernState {
  return {
    ...state,
    world: {
      ...state.world,
      factions: {
        ...state.world.factions,
        [factionId]: {
          ...state.world.factions[factionId]!,
          castAttributes: NEUTRAL_FACTION_CAST,
        },
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

function withGroupMeters(
  state: TavernState,
  groupId: string,
  partial: {
    rowdiness?: number
    satisfaction?: number
    loyalty?: number
  },
): TavernState {
  const original = state.customerGroups[groupId]!
  return {
    ...state,
    customerGroups: {
      ...state.customerGroups,
      [groupId]: {
        ...original,
        ...(partial.rowdiness !== undefined ? { rowdiness: partial.rowdiness } : {}),
        ...(partial.satisfaction !== undefined
          ? { satisfaction: partial.satisfaction }
          : {}),
        ...(partial.loyalty !== undefined ? { loyalty: partial.loyalty } : {}),
      },
    },
  }
}

function withFactionMeters(
  state: TavernState,
  factionId: string,
  partial: { relationship?: number; influence?: number },
): TavernState {
  const original = state.world.factions[factionId]!
  return {
    ...state,
    world: {
      ...state.world,
      factions: {
        ...state.world.factions,
        [factionId]: {
          ...original,
          ...(partial.relationship !== undefined
            ? { relationship: partial.relationship }
            : {}),
          ...(partial.influence !== undefined
            ? { influence: partial.influence }
            : {}),
        },
      },
    },
  }
}

function withAreaMeters(
  state: TavernState,
  areaId: string,
  partial: { damage?: number; cleanliness?: number; condition?: number },
): TavernState {
  return {
    ...state,
    areas: {
      ...state.areas,
      [areaId]: {
        ...state.areas[areaId]!,
        ...(partial.damage !== undefined ? { damage: partial.damage } : {}),
        ...(partial.cleanliness !== undefined
          ? { cleanliness: partial.cleanliness }
          : {}),
        ...(partial.condition !== undefined
          ? { condition: partial.condition }
          : {}),
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

// ─── food_safety fixtures ───────────────────────────────────────────

function foodSafetySeed(
  staffId: string,
  id = 'food-safety-matrix-seed',
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
    toneHints: ['risk', 'kitchen'],
  })
}

describe('foodSafetyCrisisCard — spec-3 cube corners (cleanliness=low × stress × fatigue)', () => {
  // The picker drives off `100 − cleanliness` for the kitchen vector;
  // the 4 spec-3 corners fix `area.cleanliness=low` and span
  // `staff.stress × staff.fatigue` 2×2 on the cook actor. Each combo
  // carries all three banded conditions and out-ranks single-condition
  // snippets and spec-2 supports.
  const tests: {
    label: string
    stress: number
    fatigue: number
    substring: string
  }[] = [
    {
      label: 'high stress × high fatigue (worst case: grim kitchen + frayed worn cook)',
      stress: 85,
      fatigue: 85,
      substring: 'past her last good hour',
    },
    {
      label: 'high stress × low fatigue (sharp cook, grim kitchen)',
      stress: 85,
      fatigue: 20,
      substring: 'sharp-eyed cook bracing',
    },
    {
      label: 'low stress × high fatigue (weary calm cook, grim kitchen)',
      stress: 20,
      fatigue: 85,
      substring: 'weary cook moves slow',
    },
    {
      label: 'low stress × low fatigue (unhurried cook, grim kitchen)',
      stress: 20,
      fatigue: 20,
      substring: 'unhurried cook',
    },
  ]
  for (const { label, stress, fatigue, substring } of tests) {
    it(`opens with the spec-3 cube corner for ${label}`, () => {
      const base = createInitialTavernState()
      const staffId = firstStaffId(base)
      let state = withNeutralStaffVoice(base, staffId)
      state = withAreaMeters(state, 'kitchen', { cleanliness: 25 })
      state = withStaffMeters(state, staffId, { stress, fatigue })
      const view = foodSafetyCrisisCard.render(
        foodSafetySeed(staffId, `food-cube-${stress}-${fatigue}`),
        state,
      )
      expect(view.body[0]).toContain(substring)
    })
  }
})

describe('foodSafetyCrisisCard — spec-2 supports (off-extreme cube cells)', () => {
  // When the third meter is mid (no spec-3 cube cell matches), spec-2
  // combos cover the picker's main axes.
  const tests: {
    label: string
    overrides: {
      cleanliness?: number
      stress?: number
      fatigue?: number
    }
    pressureInspection?: boolean
    substring: string
  }[] = [
    {
      label: 'low cleanliness × high stress (fatigue mid)',
      overrides: { cleanliness: 25, stress: 85, fatigue: 50 },
      substring: 'strung tight before the doors',
    },
    {
      label: 'low cleanliness × high fatigue (stress mid)',
      overrides: { cleanliness: 25, stress: 50, fatigue: 85 },
      substring: 'running on yesterday and a half',
    },
    {
      label: 'high stress × high fatigue (cleanliness mid)',
      overrides: { cleanliness: 50, stress: 85, fatigue: 85 },
      substring: 'wrung out and braced at once',
    },
    {
      label: 'low cleanliness × inspection-pressure rising',
      overrides: { cleanliness: 25, stress: 50, fatigue: 50 },
      pressureInspection: true,
      substring: 'inspector has been gathering momentum',
    },
  ]
  for (const { label, overrides, pressureInspection, substring } of tests) {
    it(`opens with the spec-2 support for ${label}`, () => {
      const base = createInitialTavernState()
      const staffId = firstStaffId(base)
      let state = withNeutralStaffVoice(base, staffId)
      if (overrides.cleanliness !== undefined) {
        state = withAreaMeters(state, 'kitchen', { cleanliness: overrides.cleanliness })
      }
      state = withStaffMeters(state, staffId, {
        ...(overrides.stress !== undefined ? { stress: overrides.stress } : {}),
        ...(overrides.fatigue !== undefined ? { fatigue: overrides.fatigue } : {}),
      })
      if (pressureInspection) {
        state = withRisingPressure(state, 'inspection', 60)
      }
      const view = foodSafetyCrisisCard.render(
        foodSafetySeed(staffId, `food-supp-${label.replace(/\s+/g, '-')}`),
        state,
      )
      expect(view.body[0]).toContain(substring)
    })
  }

  it('opens with the inspection_relevant × warning-memory top rung', () => {
    const base = createInitialTavernState()
    const staffId = firstStaffId(base)
    let state = withNeutralStaffVoice(base, staffId)
    // Park kitchen meters mid so the cube corners and other spec-2
    // combos do not out-rank the top rung.
    state = withAreaMeters(state, 'kitchen', {
      cleanliness: 50,
      damage: 50,
    })
    state = withStaffMeters(state, staffId, { stress: 50, fatigue: 50 })
    state = withMemory(state, 'food-warning', ['food_safety', 'warning'])
    const seed = {
      ...foodSafetySeed(staffId, 'food-inspection-warning'),
      toneHints: ['inspection_relevant'],
    }
    const view = foodSafetyCrisisCard.render(seed, state)
    // `est_inspection_tag_warning`: "An inspector-flagged morning, and
    // the warning is already on record."
    expect(view.body[0]).toContain('inspector-flagged morning')
  })
})

// ─── violence fixtures ──────────────────────────────────────────────

function violenceSeed(
  groupId: string,
  id = 'violence-matrix-seed',
): IssueSeed {
  return makeSeed({
    id,
    family: 'violence' as IssueSeedFamilyId,
    type: 'customer_incident',
    timing: 'during_service',
    severity: 55,
    domain: ['customers', 'service'],
    primaryActor: customerGroupRef(groupId),
    location: { kind: 'area', id: 'main_room' },
    toneHints: ['violence', 'rowdy'],
  })
}

describe('violenceCard — spec-3 cube corners (rowdiness=high × satisfaction × damage)', () => {
  // The picker scores `patronage + rowdiness`; the 4 spec-3 corners
  // fix `rowdiness=high` and span `satisfaction × area.damage` 2×2.
  const tests: {
    label: string
    satisfaction: number
    damage: number
    substring: string
  }[] = [
    {
      label: 'high satisfaction × high damage (rowdy happy + breaking things)',
      satisfaction: 85,
      damage: 85,
      substring: 'loudest pitch of welcome',
    },
    {
      label: 'high satisfaction × low damage (rowdy happy, room still intact)',
      satisfaction: 85,
      damage: 10,
      substring: 'rowdier than the room can quite carry',
    },
    {
      label: 'low satisfaction × high damage (rowdy sour + damage)',
      satisfaction: 20,
      damage: 85,
      substring: 'door-frame splinters are theirs',
    },
    {
      label: 'low satisfaction × low damage (rowdy sour, fight not started)',
      satisfaction: 20,
      damage: 10,
      substring: 'spoiling for a fight',
    },
  ]
  for (const { label, satisfaction, damage, substring } of tests) {
    it(`opens with the spec-3 cube corner for ${label}`, () => {
      const base = createInitialTavernState()
      const groupId = firstCustomerGroupId(base)
      let state = withNeutralGroupVoice(base, groupId)
      state = withGroupMeters(state, groupId, { rowdiness: 85, satisfaction })
      state = withAreaMeters(state, 'main_room', { damage })
      const view = violenceCard.render(
        violenceSeed(groupId, `violence-cube-${satisfaction}-${damage}`),
        state,
      )
      expect(view.body[0]).toContain(substring)
    })
  }
})

describe('violenceCard — spec-2 supports (off-extreme cube cells)', () => {
  const tests: {
    label: string
    rowdiness: number
    satisfaction: number
    damage: number
    substring: string
  }[] = [
    {
      label: 'high rowdiness × high satisfaction (damage mid)',
      rowdiness: 85,
      satisfaction: 85,
      damage: 50,
      substring: 'louder than this room is built for',
    },
    {
      label: 'high rowdiness × low satisfaction (damage mid)',
      rowdiness: 85,
      satisfaction: 20,
      damage: 50,
      substring: 'came in sour and has not warmed',
    },
    {
      label: 'high rowdiness × high damage (satisfaction mid)',
      rowdiness: 85,
      satisfaction: 50,
      damage: 85,
      substring: 'wearing the marks of it',
    },
    {
      label: 'low satisfaction × high damage (rowdiness mid)',
      rowdiness: 50,
      satisfaction: 20,
      damage: 85,
      substring: 'furniture is already splintered',
    },
  ]
  for (const { label, rowdiness, satisfaction, damage, substring } of tests) {
    it(`opens with the spec-2 support for ${label}`, () => {
      const base = createInitialTavernState()
      const groupId = firstCustomerGroupId(base)
      let state = withNeutralGroupVoice(base, groupId)
      state = withGroupMeters(state, groupId, { rowdiness, satisfaction })
      state = withAreaMeters(state, 'main_room', { damage })
      const view = violenceCard.render(
        violenceSeed(groupId, `violence-supp-${rowdiness}-${satisfaction}-${damage}`),
        state,
      )
      expect(view.body[0]).toContain(substring)
    })
  }

  it('opens with the low-satisfaction × brawl-memory top rung', () => {
    const base = createInitialTavernState()
    const groupId = firstCustomerGroupId(base)
    let state = withNeutralGroupVoice(base, groupId)
    // Park rowdiness mid (50) and damage mid so the cube corners do
    // not out-rank the top rung.
    state = withGroupMeters(state, groupId, {
      rowdiness: 50,
      satisfaction: 20,
    })
    state = withAreaMeters(state, 'main_room', { damage: 50 })
    state = withMemory(state, 'violence-brawl', ['violence', 'brawl'])
    const view = violenceCard.render(
      violenceSeed(groupId, 'violence-low-sat-brawl'),
      state,
    )
    // `est_low_sat_brawl_memory`: "A sour table on a hall that has
    // already seen worse."
    expect(view.body[0]).toContain('already seen worse')
  })
})

// ─── inspection fixtures ────────────────────────────────────────────

function inspectionSeed(
  factionId: string,
  id = 'inspection-matrix-seed',
): IssueSeed {
  return makeSeed({
    id,
    family: 'inspection' as IssueSeedFamilyId,
    type: 'inspection_threat',
    timing: 'morning_prep',
    severity: 55,
    domain: ['inspection', 'food', 'areas'],
    primaryActor: factionRef(factionId),
    location: { kind: 'area', id: 'main_room' },
    toneHints: ['inspection'],
  })
}

describe('inspectionCard — spec-3 cube corners (relationship=low × influence × cleanliness)', () => {
  // Cross-role cube: fixed extreme on primaryActor (faction.relationship
  // =low), 2×2 face on faction.influence (primaryActor) × area.cleanliness
  // (location).
  const tests: {
    label: string
    influence: number
    cleanliness: number
    substring: string
  }[] = [
    {
      label: 'high influence × high cleanliness (powerful sour inspector, clean room)',
      influence: 85,
      cleanliness: 85,
      substring: 'gives no excuses',
    },
    {
      label: 'high influence × low cleanliness (worst case)',
      influence: 85,
      cleanliness: 25,
      substring: 'closes places',
    },
    {
      label: 'low influence × high cleanliness (small grudge, clean room)',
      influence: 20,
      cleanliness: 85,
      substring: 'backing thin',
    },
    {
      label: 'low influence × low cleanliness (small grievance, grubby room)',
      influence: 20,
      cleanliness: 25,
      substring: 'longer grievance',
    },
  ]
  for (const { label, influence, cleanliness, substring } of tests) {
    it(`opens with the spec-3 cube corner for ${label}`, () => {
      const base = createInitialTavernState()
      const factionId = firstFactionId(base)
      let state = withNeutralFactionVoice(base, factionId)
      state = withFactionMeters(state, factionId, {
        relationship: 20,
        influence,
      })
      state = withAreaMeters(state, 'main_room', { cleanliness })
      const view = inspectionCard.render(
        inspectionSeed(factionId, `inspection-cube-${influence}-${cleanliness}`),
        state,
      )
      expect(view.body[0]).toContain(substring)
    })
  }
})

describe('inspectionCard — spec-2 supports (off-extreme cube cells)', () => {
  const tests: {
    label: string
    relationship: number
    influence: number
    cleanliness: number
    condition?: number
    substring: string
  }[] = [
    {
      label: 'low relationship × high influence (cleanliness mid)',
      relationship: 20,
      influence: 85,
      cleanliness: 50,
      substring: 'here this morning by appointment',
    },
    {
      label: 'low relationship × low cleanliness (influence mid)',
      relationship: 20,
      influence: 50,
      cleanliness: 25,
      substring: 'not helping the case',
    },
    {
      label: 'high influence × low cleanliness (relationship mid)',
      relationship: 50,
      influence: 85,
      cleanliness: 25,
      substring: 'will not stand reading',
    },
    {
      label: 'low relationship × low condition (cleanliness mid)',
      relationship: 20,
      influence: 50,
      cleanliness: 50,
      condition: 25,
      substring: 'holding together by habit',
    },
  ]
  for (const {
    label,
    relationship,
    influence,
    cleanliness,
    condition,
    substring,
  } of tests) {
    it(`opens with the spec-2 support for ${label}`, () => {
      const base = createInitialTavernState()
      const factionId = firstFactionId(base)
      let state = withNeutralFactionVoice(base, factionId)
      state = withFactionMeters(state, factionId, { relationship, influence })
      state = withAreaMeters(state, 'main_room', {
        cleanliness,
        ...(condition !== undefined ? { condition } : {}),
      })
      const view = inspectionCard.render(
        inspectionSeed(
          factionId,
          `inspection-supp-${relationship}-${influence}-${cleanliness}`,
        ),
        state,
      )
      expect(view.body[0]).toContain(substring)
    })
  }

  it('opens with the low-relationship × inspection-pressure top rung', () => {
    const base = createInitialTavernState()
    const factionId = firstFactionId(base)
    let state = withNeutralFactionVoice(base, factionId)
    // Park influence and cleanliness mid so the cube corners do not
    // out-rank the pressure rung.
    state = withFactionMeters(state, factionId, {
      relationship: 20,
      influence: 50,
    })
    state = withAreaMeters(state, 'main_room', { cleanliness: 50 })
    state = withRisingPressure(state, 'inspection', 60)
    const view = inspectionCard.render(
      inspectionSeed(factionId, 'inspection-rel-pressure'),
      state,
    )
    // `est_low_rel_inspection_pressure`: "Cold relations on a morning
    // the slate has been steepening for days."
    expect(view.body[0]).toContain('steepening for days')
  })
})

// ─── State-varying reaction proof ───────────────────────────────────

describe('foodSafetyCrisisCard — reaction_line varies with state, not just voice', () => {
  it('high-stress cook and a high-fatigue cook produce different reactions', () => {
    const base = createInitialTavernState()
    const staffId = firstStaffId(base)
    const neutral = withNeutralStaffVoice(base, staffId)
    const stressed = withStaffMeters(neutral, staffId, { stress: 85, fatigue: 20 })
    const tired = withStaffMeters(neutral, staffId, { stress: 20, fatigue: 85 })
    const stressView = foodSafetyCrisisCard.render(
      foodSafetySeed(staffId, 'food-stressed'),
      stressed,
    )
    const tiredView = foodSafetyCrisisCard.render(
      foodSafetySeed(staffId, 'food-tired'),
      tired,
    )
    expect(stressView.body[1]).not.toBe(tiredView.body[1])
  })
})

describe('violenceCard — reaction_line varies with state, not just voice', () => {
  it('high-rowdiness cohort and a low-satisfaction cohort produce different reactions', () => {
    const base = createInitialTavernState()
    const groupId = firstCustomerGroupId(base)
    const neutral = withNeutralGroupVoice(base, groupId)
    // Hold one meter constant and vary the other so body[1]
    // differences are attributable.
    const rowdy = withGroupMeters(neutral, groupId, {
      rowdiness: 85,
      satisfaction: 50,
    })
    const sour = withGroupMeters(neutral, groupId, {
      rowdiness: 50,
      satisfaction: 20,
    })
    const rowdyView = violenceCard.render(
      violenceSeed(groupId, 'violence-rowdy-only'),
      rowdy,
    )
    const sourView = violenceCard.render(
      violenceSeed(groupId, 'violence-sour-only'),
      sour,
    )
    expect(rowdyView.body[1]).not.toBe(sourView.body[1])
  })
})

describe('inspectionCard — reaction_line varies with state, not just voice', () => {
  it('low-relationship inspector and a high-influence inspector produce different reactions', () => {
    const base = createInitialTavernState()
    const factionId = firstFactionId(base)
    const neutral = withNeutralFactionVoice(base, factionId)
    const sour = withFactionMeters(neutral, factionId, {
      relationship: 20,
      influence: 50,
    })
    const heavy = withFactionMeters(neutral, factionId, {
      relationship: 50,
      influence: 85,
    })
    const sourView = inspectionCard.render(
      inspectionSeed(factionId, 'inspection-sour'),
      sour,
    )
    const heavyView = inspectionCard.render(
      inspectionSeed(factionId, 'inspection-heavy'),
      heavy,
    )
    expect(sourView.body[1]).not.toBe(heavyView.body[1])
  })
})

// ─── Determinism + re-render stability ──────────────────────────────

describe('crises & safety matrix cells — re-render stability', () => {
  it('foodSafetyCrisis cube corner is byte-identical on re-render', () => {
    const base = createInitialTavernState()
    const staffId = firstStaffId(base)
    let state = withNeutralStaffVoice(base, staffId)
    state = withAreaMeters(state, 'kitchen', { cleanliness: 25 })
    state = withStaffMeters(state, staffId, { stress: 85, fatigue: 85 })
    const seed = foodSafetySeed(staffId, 'food-stable')
    const a = foodSafetyCrisisCard.render(seed, state)
    const b = foodSafetyCrisisCard.render(seed, state)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('violence cube corner is byte-identical on re-render', () => {
    const base = createInitialTavernState()
    const groupId = firstCustomerGroupId(base)
    let state = withNeutralGroupVoice(base, groupId)
    state = withGroupMeters(state, groupId, {
      rowdiness: 85,
      satisfaction: 20,
    })
    state = withAreaMeters(state, 'main_room', { damage: 85 })
    const seed = violenceSeed(groupId, 'violence-stable')
    const a = violenceCard.render(seed, state)
    const b = violenceCard.render(seed, state)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('inspection cube corner is byte-identical on re-render', () => {
    const base = createInitialTavernState()
    const factionId = firstFactionId(base)
    let state = withNeutralFactionVoice(base, factionId)
    state = withFactionMeters(state, factionId, {
      relationship: 20,
      influence: 85,
    })
    state = withAreaMeters(state, 'main_room', { cleanliness: 25 })
    const seed = inspectionSeed(factionId, 'inspection-stable')
    const a = inspectionCard.render(seed, state)
    const b = inspectionCard.render(seed, state)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })
})
