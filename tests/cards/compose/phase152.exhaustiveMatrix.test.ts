// Phase 152 / ISSUE-120 — Legible Surface arc, Phase 7
// (Factions & Culture cluster).
//
// Exhaustive matrix-cell reachability tests for the two compositional
// templates this phase deepens: factionRequest (relationship × influence
// 2-meter space, 9 cells) and cultureConflict (tension × comfort ×
// familiarity 3-meter space — the arc's first 3-meter cube).
//
// For each template this file enumerates hand-picked `(seed, state)`
// fixtures covering the matrix corners (and one pressure × signal top
// rung) and asserts the establishing line resolves to the matrix-cell
// snippet (matched by a distinctive substring only the combo cell
// contains). Proves the authored cells are reachable, not just present
// in the pool.
//
// Mirrors the Phase 149 / 150 / 151 matrix-coverage approach: when
// both (or all three) top-salient facts of a corner resolve, the
// authored combo snippet wins specificity over single-condition
// snippets AND over the multi-fact join.

import { describe, expect, it } from 'vitest'

import {
  cultureConflictCard,
  factionRequestCard,
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
import type { FactionCastAttributes } from '../../../src/sim/content/cast'
import { makeSeed } from '../cardFactories'

// ─── Shared helpers ─────────────────────────────────────────────────

function firstFactionId(state: TavernState): string {
  const id = Object.keys(state.world.factions)[0]
  if (!id) throw new Error('test setup expects at least one starter faction')
  return id
}

function firstCultureId(state: TavernState): string {
  const id = Object.keys(state.world.cultures)[0]
  if (!id) throw new Error('test setup expects at least one starter culture')
  return id
}

function factionRef(id: string): EntityRef {
  return { kind: 'faction', id }
}

function cultureRef(id: string): EntityRef {
  return { kind: 'culture', id }
}

// Neutral cast — axes all at 1 so voice-extreme snippets (which
// require atLeast: 2 or atMost: 0) never fire; isolates state-keyed
// snippets. cultureConflict is narrator-voiced so no cohort helper is
// needed there.
const NEUTRAL_FACTION_CAST: FactionCastAttributes = {
  specialty: 'ceremony',
  blindspot: 'patience',
  affinities: [],
  voice: { axes: { terseness: 1, warmth: 1, formality: 1, floridity: 1 } },
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

function withCultureMeters(
  state: TavernState,
  cultureId: string,
  partial: { tension?: number; comfort?: number; familiarity?: number },
): TavernState {
  const original = state.world.cultures[cultureId]!
  return {
    ...state,
    world: {
      ...state.world,
      cultures: {
        ...state.world.cultures,
        [cultureId]: {
          ...original,
          ...(partial.tension !== undefined ? { tension: partial.tension } : {}),
          ...(partial.comfort !== undefined ? { comfort: partial.comfort } : {}),
          ...(partial.familiarity !== undefined
            ? { familiarity: partial.familiarity }
            : {}),
        },
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

// ─── faction_request fixtures ───────────────────────────────────────

function factionRequestSeed(
  factionId: string,
  id = 'faction-matrix-seed',
): IssueSeed {
  return makeSeed({
    id,
    family: 'faction_request' as IssueSeedFamilyId,
    type: 'social_conflict',
    timing: 'during_service',
    severity: 45,
    domain: ['factions', 'social'],
    primaryActor: factionRef(factionId),
  })
}

describe('factionRequest — exhaustive relationship × influence matrix cells', () => {
  // Band thresholds: low (<40), mid (40–69), high (≥70). The faction
  // generator picks by `|relationship − 50| + 0.5×influence` minus
  // recency, not a single-axis threshold, so all 9 cells of the matrix
  // are reachable. Author the 4 corner combos the design distinguishes
  // (low/high × low/high) — mid bands fall back to single-condition
  // snippets.
  const tests: {
    label: string
    relationship: number
    influence: number
    substring: string
  }[] = [
    {
      label: 'high × high (powerful ally arriving warmly)',
      relationship: 85,
      influence: 85,
      substring: 'rests on the latch',
    },
    {
      label: 'high × low (small friendly house)',
      relationship: 85,
      influence: 20,
      substring: 'small house that brings what little',
    },
    {
      label: 'low × high (weight without welcome)',
      relationship: 20,
      influence: 85,
      substring: 'Weight without welcome',
    },
    {
      label: 'low × low (small grievance that will calcify)',
      relationship: 20,
      influence: 20,
      substring: 'breeds next year',
    },
  ]
  for (const { label, relationship, influence, substring } of tests) {
    it(`opens with the combo cell for ${label}`, () => {
      const base = createInitialTavernState()
      const factionId = firstFactionId(base)
      const neutral = withNeutralFactionVoice(base, factionId)
      const state = withFactionMeters(neutral, factionId, {
        relationship,
        influence,
      })
      const view = factionRequestCard.render(
        factionRequestSeed(factionId, `faction-${relationship}-${influence}`),
        state,
      )
      expect(view.body[0]).toContain(substring)
    })
  }

  it('opens with low-relationship × faction_anger-rising top rung when both fire', () => {
    const base = createInitialTavernState()
    const factionId = firstFactionId(base)
    let state = withNeutralFactionVoice(base, factionId)
    // Park influence in mid so the relationship × influence corner
    // combos do not out-rank the pressure rung; relationship low +
    // faction_anger rising is the intended fixture.
    state = withFactionMeters(state, factionId, { relationship: 20, influence: 50 })
    state = withRisingPressure(state, 'faction_anger')
    const view = factionRequestCard.render(
      factionRequestSeed(factionId, 'faction-rel-anger-rung'),
      state,
    )
    // `est_relationship_anger`: "Cold relations, and their anger
    // steepening toward this door."
    expect(view.body[0]).toContain('steepening toward this door')
  })
})

// ─── culture_conflict fixtures ──────────────────────────────────────

function cultureConflictSeed(
  cultureId: string,
  id = 'culture-matrix-seed',
): IssueSeed {
  return makeSeed({
    id,
    family: 'culture_conflict' as IssueSeedFamilyId,
    type: 'social_conflict',
    timing: 'during_service',
    severity: 50,
    domain: ['cultures', 'social'],
    toneHints: ['culture', 'tension'],
    primaryActor: cultureRef(cultureId),
  })
}

describe('cultureConflict — spec-3 cube corners (tension=high × comfort × familiarity)', () => {
  // The seed generator picks by highest tension; the 4 spec-3 corners
  // all fix tension=high and span the comfort × familiarity 2×2 face
  // of the cube. Each combo carries all three banded conditions and
  // out-ranks single-condition snippets and spec-2 supports.
  const tests: {
    label: string
    comfort: number
    familiarity: number
    substring: string
  }[] = [
    {
      label: 'low comfort × low familiarity (alien room, alien crowd)',
      comfort: 20,
      familiarity: 20,
      substring: 'never tried to read them',
    },
    {
      label: 'low comfort × high familiarity (well-known crowd in wrong room)',
      comfort: 20,
      familiarity: 85,
      substring: 'never been theirs',
    },
    {
      label: 'high comfort × low familiarity (settled but opaque)',
      comfort: 85,
      familiarity: 20,
      substring: 'outburst to land cold',
    },
    {
      label: 'high comfort × high familiarity (trusted crowd suddenly strange)',
      comfort: 85,
      familiarity: 85,
      substring: 'suddenly unfamiliar',
    },
  ]
  for (const { label, comfort, familiarity, substring } of tests) {
    it(`opens with the spec-3 cube corner for ${label}`, () => {
      const base = createInitialTavernState()
      const cultureId = firstCultureId(base)
      const state = withCultureMeters(base, cultureId, {
        tension: 85,
        comfort,
        familiarity,
      })
      const view = cultureConflictCard.render(
        cultureConflictSeed(cultureId, `culture-cube-${comfort}-${familiarity}`),
        state,
      )
      expect(view.body[0]).toContain(substring)
    })
  }
})

describe('cultureConflict — spec-2 tension × comfort supports (familiarity-mid)', () => {
  // When familiarity is mid (no spec-3 cube cell matches), the spec-2
  // tension × comfort combos cover the (mid+high tension) × (low+high
  // comfort) edges. Each carries the two band conditions; mid
  // familiarity leaves the third meter unresolved.
  const tests: {
    label: string
    tension: number
    comfort: number
    substring: string
  }[] = [
    {
      label: 'mid tension × low comfort (quiet drift)',
      tension: 50,
      comfort: 20,
      substring: 'not angry, just not welcome',
    },
    {
      label: 'mid tension × high comfort (rumble in a cheerful corner)',
      tension: 50,
      comfort: 85,
      substring: 'rumble in a cheerful corner',
    },
    {
      label: 'high tension × low comfort (stirred and unsettled)',
      tension: 85,
      comfort: 20,
      substring: 'never settled here in the first place',
    },
    {
      label: 'high tension × high comfort (at home and furious)',
      tension: 85,
      comfort: 85,
      substring: 'stirred to anger inside it',
    },
  ]
  for (const { label, tension, comfort, substring } of tests) {
    it(`opens with the spec-2 support for ${label}`, () => {
      const base = createInitialTavernState()
      const cultureId = firstCultureId(base)
      const state = withCultureMeters(base, cultureId, {
        tension,
        comfort,
        familiarity: 50,
      })
      const view = cultureConflictCard.render(
        cultureConflictSeed(cultureId, `culture-supp-${tension}-${comfort}`),
        state,
      )
      expect(view.body[0]).toContain(substring)
    })
  }

  it('opens with high-tension × cultural_tension-rising top rung when familiarity and comfort are mid', () => {
    const base = createInitialTavernState()
    const cultureId = firstCultureId(base)
    let state = withCultureMeters(base, cultureId, {
      tension: 85,
      comfort: 50,
      familiarity: 50,
    })
    state = withRisingPressure(state, 'cultural_tension')
    const view = cultureConflictCard.render(
      cultureConflictSeed(cultureId, 'culture-tension-pressure-rung'),
      state,
    )
    // `est_tension_pressure`: "On edge in the room, and the wider
    // tension only climbing."
    expect(view.body[0]).toContain('wider tension only climbing')
  })
})

// ─── State-varying reaction proof ───────────────────────────────────
//
// The Phase 7 plan requires reaction/sensory lines to vary with state,
// not just voice. These tests render the same template under two
// distinct states (neutral voice / pinned-mid baseline held constant)
// and assert body[1] differs.

describe('factionRequest — reaction_line varies with state, not just voice', () => {
  it('high-influence faction and a grudge-memory faction produce different reactions', () => {
    const base = createInitialTavernState()
    const factionId = firstFactionId(base)
    const neutral = withNeutralFactionVoice(base, factionId)
    // Hold relationship mid (50) in both fixtures so body[1] differs
    // only on the second mutation. Influence mid in the memory fixture
    // so no influence-keyed reaction snippet fires there.
    const highInfluence = withFactionMeters(neutral, factionId, {
      relationship: 50,
      influence: 85,
    })
    const grudgeBase = withFactionMeters(neutral, factionId, {
      relationship: 50,
      influence: 50,
    })
    const grudge = withMemory(grudgeBase, 'faction-grudge', ['grudge'])
    const highView = factionRequestCard.render(
      factionRequestSeed(factionId, 'faction-high-inf'),
      highInfluence,
    )
    const grudgeView = factionRequestCard.render(
      factionRequestSeed(factionId, 'faction-grudge'),
      grudge,
    )
    expect(highView.body[1]).not.toBe(grudgeView.body[1])
  })
})

describe('cultureConflict — reaction_line varies with state', () => {
  it('low-comfort culture and a low-familiarity culture produce different reactions', () => {
    const base = createInitialTavernState()
    const cultureId = firstCultureId(base)
    // Hold tension mid (50) in both fixtures. Vary only the second
    // meter so body[1] differences are attributable to that mutation.
    const lowComfort = withCultureMeters(base, cultureId, {
      tension: 50,
      comfort: 20,
      familiarity: 50,
    })
    const lowFamiliarity = withCultureMeters(base, cultureId, {
      tension: 50,
      comfort: 50,
      familiarity: 20,
    })
    const comfortView = cultureConflictCard.render(
      cultureConflictSeed(cultureId, 'culture-low-comfort'),
      lowComfort,
    )
    const familiarityView = cultureConflictCard.render(
      cultureConflictSeed(cultureId, 'culture-low-familiarity'),
      lowFamiliarity,
    )
    expect(comfortView.body[1]).not.toBe(familiarityView.body[1])
  })
})

// ─── Determinism + re-render stability ──────────────────────────────

describe('factions & culture matrix cells — re-render stability', () => {
  it('factionRequest high × high combo is byte-identical on re-render', () => {
    const base = createInitialTavernState()
    const factionId = firstFactionId(base)
    let state = withNeutralFactionVoice(base, factionId)
    state = withFactionMeters(state, factionId, { relationship: 85, influence: 85 })
    const seed = factionRequestSeed(factionId, 'faction-stable')
    const a = factionRequestCard.render(seed, state)
    const b = factionRequestCard.render(seed, state)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('cultureConflict spec-3 cube corner is byte-identical on re-render', () => {
    const base = createInitialTavernState()
    const cultureId = firstCultureId(base)
    const state = withCultureMeters(base, cultureId, {
      tension: 85,
      comfort: 20,
      familiarity: 20,
    })
    const seed = cultureConflictSeed(cultureId, 'culture-stable')
    const a = cultureConflictCard.render(seed, state)
    const b = cultureConflictCard.render(seed, state)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })
})
