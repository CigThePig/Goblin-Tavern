// Phase 188 / ISSUE-155 — Causal Establishing Line.
//
// The customer_complaint body must LEAD with the event the sim
// attributed (`seed.causes`) when one is classifiable, and degrade
// byte-identically to the pre-change output when none is. These tests
// also pin the `dominantCause` condition, its registration in the
// simCoherence gate, and the seed generator's cause-derived
// recentContext / problemNoun.

import { describe, expect, it } from 'vitest'

import { customerComplaintCard } from '../../../src/cards/index'
import { customerComplaintCauseLinePool } from '../../../src/cards/compose/pools/customerComplaint'
import { evalCondition } from '../../../src/cards/compose/conditions'
import { __internal as simCoherenceInternal } from '../../../src/cards/compose/gates/simCoherence'
import { createInitialTavernState } from '../../../src/sim/state/defaults'
import { simulateDay } from '../../../src/sim/core/engine'
import { FULL_PIPELINE } from '../../../src/sim/canonicalPipeline'
import { getIssueSeeds } from '../../../src/sim/modules/issues/index'
import { withCustomerGroup } from '../../../src/sim/testing/stateFactories'
import type {
  IssueSeed,
  IssueSeedFamilyId,
} from '../../../src/sim/modules/issues/issueSeedTypes'
import type {
  CauseEntry,
  EntityRef,
  TavernState,
} from '../../../src/sim/state/TavernState'
import { makeSeed } from '../cardFactories'

const STAMP = { year: 1, month: 1, week: 1, day: 1, absoluteDay: 0 }

function groupRef(id: string): EntityRef {
  return { kind: 'customer_group', id }
}

function firstGroupId(state: TavernState): string {
  const id = Object.keys(state.customerGroups)[0]
  if (!id) throw new Error('test setup expects a starter customer group')
  return id
}

function shortageCause(groupId: string): CauseEntry {
  // The exact shape `customers/satisfaction.ts` emits for a shortage.
  return {
    id: 'shortage-cause',
    timestamp: STAMP,
    source: 'customers.satisfaction',
    sourceType: 'service',
    target: `customer:${groupId}.satisfaction`,
    targetType: 'customer',
    amount: -4,
    direction: 'decrease',
    weight: 8,
    readable: `Merchants hit 2 shortage(s).`,
    tags: ['service', 'satisfaction', groupId, 'shortage'],
    relatedActors: [groupRef(groupId)],
    relatedLocations: [],
    relatedSystems: ['customers', 'stock'],
    ageDays: 0,
  }
}

function complaintSeed(
  groupId: string,
  causes: CauseEntry[],
  id = 'complaint-188',
): IssueSeed {
  return {
    ...makeSeed({
      id,
      family: 'customer_complaint' as IssueSeedFamilyId,
      type: 'complaint',
      timing: 'during_service',
      severity: 55,
      primaryActor: groupRef(groupId),
    }),
    causes,
  }
}

describe('dominantCause condition', () => {
  const state = createInitialTavernState()
  const groupId = firstGroupId(state)

  it('matches when the dominant negative cause classifies into anyOf', () => {
    const seed = complaintSeed(groupId, [shortageCause(groupId)])
    expect(
      evalCondition({ kind: 'dominantCause', anyOf: ['shortage'] }, seed, state),
    ).toBe(true)
    expect(
      evalCondition(
        { kind: 'dominantCause', anyOf: ['cleanliness', 'wait'] },
        seed,
        state,
      ),
    ).toBe(false)
  })

  it('returns false when seed.causes carries no classifiable negative cause', () => {
    const seed = complaintSeed(groupId, [])
    expect(
      evalCondition({ kind: 'dominantCause', anyOf: ['shortage'] }, seed, state),
    ).toBe(false)
  })
})

describe('simCoherence registration', () => {
  it('lists dominantCause as a state-lookup kind so sim_backed cause snippets pass', () => {
    expect(simCoherenceInternal.STATE_LOOKUP_KINDS).toContain('dominantCause')
  })

  it('every cause_line snippet carries exactly one dominantCause condition and no fallback', () => {
    for (const snippet of customerComplaintCauseLinePool.snippets) {
      expect(snippet.conditions.length).toBe(1)
      expect(snippet.conditions[0]!.kind).toBe('dominantCause')
    }
    // No unconditional fallback — an optional sim_backed slot omits.
    expect(
      customerComplaintCauseLinePool.snippets.some(
        (s) => s.conditions.length === 0,
      ),
    ).toBe(false)
  })
})

describe('customerComplaint body — cause line leads', () => {
  it('leads the body with the shortage cause line; standing line is the second beat', () => {
    const state = createInitialTavernState()
    const groupId = firstGroupId(state)
    const seed = complaintSeed(groupId, [shortageCause(groupId)])
    const view = customerComplaintCard.render(seed, state)
    expect(view.body[0]).toBe("What they came in for, we'd run dry of.")
    // The standing / band line still appears as the second beat.
    expect(view.body[1]).toBeDefined()
    expect(view.body[1]).not.toBe(view.body[0])
    expect(view.body.length).toBeLessThanOrEqual(3)
  })

  it('is byte-identical to the no-cause-line output when no cause classifies', () => {
    const state = createInitialTavernState()
    const groupId = firstGroupId(state)
    // A non-classifiable (reputation pressure) cause — and an empty list —
    // both omit the cause_line, so the body matches the pre-Phase-188 shape.
    const reputationCause: CauseEntry = {
      ...shortageCause(groupId),
      id: 'rep',
      tags: ['pressure', 'reputation_drift', 'reputation', 'identity'],
      readable: '1 reputation axis/axes pushing past 70.',
    }
    const withRepCause = customerComplaintCard.render(
      complaintSeed(groupId, [reputationCause], 'rep-seed'),
      state,
    )
    const withNoCause = customerComplaintCard.render(
      complaintSeed(groupId, [], 'rep-seed'),
      state,
    )
    expect(withRepCause.body).toEqual(withNoCause.body)
  })
})

describe('seed generator — cause-derived textIngredients', () => {
  it('recentContext reflects the dominant cause readable, not the hardcoded string', () => {
    // Drive a real complaint through the pipeline (alpha, day 2). The
    // dominant cause is deterministic given the seed.
    let s = withCustomerGroup(createInitialTavernState(), 'merchants', {
      satisfaction: 20,
      patronage: 40,
    })
    let complaint: IssueSeed | undefined
    for (let day = 1; day <= 4 && !complaint; day++) {
      const r = simulateDay(s, { seed: 'alpha' }, FULL_PIPELINE)
      s = r.state
      complaint = getIssueSeeds(s, { family: 'customer_complaint' })[0]
    }
    expect(complaint, 'a complaint fires within four days').toBeDefined()
    const ctx = complaint!.textIngredients.recentContext ?? []
    expect(ctx).not.toContain('main room dirty all week')
    expect(complaint!.textIngredients.problemNoun).not.toBe(undefined)
  })
})
