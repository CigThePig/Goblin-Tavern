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
