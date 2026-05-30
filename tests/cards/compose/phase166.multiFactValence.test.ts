// Phase 166 / ISSUE-134 — Faithful Surface arc, Phase 4.
//
// The multi-fact establishing-line join must refuse to staple two
// oppositely-signed facts into one line ("their patience snapped — and
// they've never been more loyal"). When the primary fact reads as
// distress and the only orthogonal secondary reads as calm (or vice
// versa), the join drops the secondary and renders the primary alone.
// Silence beats a self-contradicting line.
//
// Exercised on the `regular_customer` salience table, whose first two
// reads have opposite polarity: regular.irritation is lower-is-better
// (high = distress) and regular.loyalty is higher-is-better (high =
// calm). The supplier-based join tests in phase146 only ever pair two
// higher-is-better meters, so they can't surface this case.

import { describe, expect, it } from 'vitest'

import { pickSnippet } from '../../../src/cards/compose/assemble'
import { staffBurnoutCard } from '../../../src/cards/templates/staffBurnout'
import { createInitialTavernState } from '../../../src/sim/state/defaults'
import type { CastAttributes } from '../../../src/sim/content/cast'
import type { SlotSpec, SnippetPool } from '../../../src/cards/compose/types'
import type { TavernState } from '../../../src/sim/state/TavernState'
import type {
  IssueSeed,
  IssueSeedFamilyId,
} from '../../../src/sim/modules/issues/issueSeedTypes'
import { makeSeed, makeTavernState } from '../cardFactories'

function firstRegularId(state: TavernState): string {
  const id = Object.keys(state.world.regulars)[0]
  if (!id) throw new Error('test state has no regulars')
  return id
}

function withRegular(
  state: TavernState,
  regularId: string,
  partial: { irritation?: number; loyalty?: number },
): TavernState {
  const existing = state.world.regulars[regularId]
  if (!existing) throw new Error(`withRegular: unknown regular ${regularId}`)
  return {
    ...state,
    world: {
      ...state.world,
      regulars: {
        ...state.world.regulars,
        [regularId]: {
          ...existing,
          ...(partial.irritation !== undefined ? { irritation: partial.irritation } : {}),
          ...(partial.loyalty !== undefined ? { loyalty: partial.loyalty } : {}),
        },
      },
    },
  }
}

function regularSeed(regularId: string): IssueSeed {
  return makeSeed({
    id: 'valence-seed',
    family: 'regular_customer' as IssueSeedFamilyId,
    type: 'relationship_test',
    timing: 'during_service',
    severity: 45,
    domain: ['regulars'],
    primaryActor: { kind: 'regular', id: regularId },
  })
}

// Pool with an irritation-high snippet (distress), a loyalty-high
// snippet (calm), and a loyalty-low snippet (distress). Plus the
// unconditional fallback.
const POOL: SnippetPool = {
  slotId: 'establishing_line',
  snippets: [
    { id: 'fallback', text: 'A regular settles in.', conditions: [] },
    {
      id: 'irritation_high',
      text: 'Their patience snapped a while back.',
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'regular.irritation', equals: 'high' },
      ],
    },
    {
      id: 'loyalty_high',
      text: "they've never been steadier with us.",
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'regular.loyalty', equals: 'high' },
      ],
    },
    {
      id: 'loyalty_low',
      text: 'and their goodwill is just about gone.',
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'regular.loyalty', equals: 'low' },
      ],
    },
  ],
}

function multiSlot(): SlotSpec {
  return {
    id: 'establishing_line',
    role: 'utterance',
    wordBudget: 20,
    multiFactBudget: 40,
    multiFactJoin: ' — ',
    saliencePolicy: 'multi',
    claimMode: 'sim_backed',
    pool: POOL,
  }
}

describe('Phase 166 — multi-fact join drops oppositely-signed secondaries', () => {
  it('distress primary + calm secondary ⇒ primary alone (no staple)', () => {
    let state = makeTavernState({})
    const regularId = firstRegularId(state)
    // irritation high (distress) + loyalty high (calm) — opposite signs.
    state = withRegular(state, regularId, { irritation: 90, loyalty: 90 })
    const picked = pickSnippet(multiSlot(), regularSeed(regularId), state)
    expect(picked).toBe('Their patience snapped a while back.')
    expect(picked).not.toContain(' — ')
    expect(picked).not.toContain('steadier')
  })

  it('distress primary + distress secondary ⇒ both stapled (orthogonal, same sign)', () => {
    let state = makeTavernState({})
    const regularId = firstRegularId(state)
    // irritation high (distress) + loyalty low (distress) — same sign.
    state = withRegular(state, regularId, { irritation: 90, loyalty: 10 })
    const picked = pickSnippet(multiSlot(), regularSeed(regularId), state)
    expect(picked).toContain('Their patience snapped a while back.')
    expect(picked).toContain('goodwill is just about gone')
    expect(picked).toContain(' — ')
  })

  it('is deterministic across repeated calls', () => {
    let state = makeTavernState({})
    const regularId = firstRegularId(state)
    state = withRegular(state, regularId, { irritation: 90, loyalty: 90 })
    const slot = multiSlot()
    const seed = regularSeed(regularId)
    const first = pickSnippet(slot, seed, state)
    for (let i = 0; i < 20; i++) {
      expect(pickSnippet(slot, seed, state)).toBe(first)
    }
  })
})

// Phase 172 / ISSUE-140 — Complete Surface arc, Phase 5. The Phase-166
// join classifies SIGNAL bands by meter valence but classified ALL
// pressures as neutral. That left a hole: `staff_burnout` rising IS the
// staff actor's own wellbeing deteriorating (the faithfulness gate's
// `actorDistressReading` already reads it as distress), so a calm signal
// primary ("Spry at the rota, the long shifts not catching them yet") was
// stapled to a `staff_burnout`-rising distress secondary ("the load's been
// creeping into their mornings") — a within-line self-contradiction the
// join's strictlyOpposed guard exists to refuse. The Phase-5 matrix fill
// (adding the calm `est_low_fatigue` primary to both staff pools) widened
// the surface enough to expose it on every staff card, but the
// pre-existing `est_low_stress` calm primary already triggered it.
//
// `SUBJECT_DISTRESS_PRESSURES` (assemble.ts) now classifies `staff_burnout`
// as a distress pole so the join refuses that staple. These cases pin the
// behaviour against the real staff_burnout salience table + pools.

const NEUTRAL_STAFF_CAST: CastAttributes = {
  specialty: 'meat_dishes',
  blindspot: 'pastry',
  affinities: [],
  voice: { axes: { terseness: 1, warmth: 1, formality: 1, floridity: 1 } },
}

function firstStaffId(state: TavernState): string {
  const id = Object.keys(state.staff)[0]
  if (!id) throw new Error('test state has no staff')
  return id
}

function withStaffState(
  state: TavernState,
  staffId: string,
  partial: { stress?: number; fatigue?: number },
): TavernState {
  return {
    ...state,
    staff: {
      ...state.staff,
      [staffId]: {
        ...state.staff[staffId]!,
        ...(partial.stress !== undefined ? { stress: partial.stress } : {}),
        ...(partial.fatigue !== undefined ? { fatigue: partial.fatigue } : {}),
        castAttributes: NEUTRAL_STAFF_CAST,
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

function staffBurnoutSeed(staffId: string): IssueSeed {
  return makeSeed({
    id: 'subj-distress-seed',
    family: 'staff_burnout' as IssueSeedFamilyId,
    type: 'staff_request',
    timing: 'morning_prep',
    severity: 55,
    domain: ['staff'],
    primaryActor: { kind: 'staff', id: staffId },
  })
}

describe('Phase 172 — subject-wellbeing pressures carry a distress pole in the join', () => {
  it('calm signal primary + rising staff_burnout ⇒ primary alone (no staple)', () => {
    const base = createInitialTavernState()
    const staffId = firstStaffId(base)
    // mid stress, low fatigue → calm `est_low_fatigue` primary; burnout
    // rising would otherwise staple a distress secondary onto it.
    let state = withStaffState(base, staffId, { stress: 55, fatigue: 20 })
    state = withRisingPressure(state, 'staff_burnout')
    const body = staffBurnoutCard.render(staffBurnoutSeed(staffId), state).body[0]!
    expect(body).not.toContain(' — ')
    expect(body.toLowerCase()).not.toContain('creeping')
    expect(body.toLowerCase()).not.toContain('climbing')
  })

  it('distress signal primary + rising staff_burnout ⇒ stapled (same sign, coherent)', () => {
    const base = createInitialTavernState()
    const staffId = firstStaffId(base)
    // high stress + high fatigue → distress primary; a distress burnout
    // secondary is the same sign, so the staple is coherent and kept.
    let state = withStaffState(base, staffId, { stress: 85, fatigue: 85 })
    state = withRisingPressure(state, 'staff_burnout')
    const body = staffBurnoutCard.render(staffBurnoutSeed(staffId), state).body[0]!
    expect(body).toContain(' — ')
  })
})
