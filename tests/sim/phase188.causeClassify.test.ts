// Phase 188 / ISSUE-155 — Causal Establishing Line.
//
// Unit tests for the two pure cause helpers that the seed generator and
// the card's `dominantCause` condition both import, so the seed's stated
// cause and the card's cause line can never drift apart.

import { describe, expect, it } from 'vitest'

import {
  classifyCause,
  pickDominantCause,
} from '../../src/sim/modules/causes'
import type { CauseEntry } from '../../src/sim/state/TavernState'

const STAMP = { year: 1, month: 1, week: 1, day: 1, absoluteDay: 0 }

function cause(partial: Partial<CauseEntry>): CauseEntry {
  return {
    id: partial.id ?? 'c',
    timestamp: STAMP,
    source: partial.source ?? 'customers.satisfaction',
    sourceType: partial.sourceType ?? 'service',
    target: partial.target ?? 'customer:merchants.satisfaction',
    targetType: partial.targetType ?? 'customer',
    amount: partial.amount ?? -4,
    direction: partial.direction ?? 'decrease',
    weight: partial.weight ?? 8,
    readable: partial.readable ?? 'Merchants hit 2 shortage(s).',
    tags: partial.tags ?? ['service', 'satisfaction', 'merchants', 'shortage'],
    relatedActors: partial.relatedActors ?? [],
    relatedLocations: partial.relatedLocations ?? [],
    relatedSystems: partial.relatedSystems ?? [],
    ageDays: partial.ageDays ?? 0,
    ...(partial.expiresAfterDays !== undefined
      ? { expiresAfterDays: partial.expiresAfterDays }
      : {}),
  }
}

describe('classifyCause', () => {
  it('classifies the real shortage cause shape as "shortage"', () => {
    // The exact tag set `customers/satisfaction.ts` emits for a shortage.
    expect(
      classifyCause(
        cause({ tags: ['service', 'satisfaction', 'merchants', 'shortage'] }),
      ),
    ).toBe('shortage')
  })

  it('maps cleanliness / mess / filth tags to "cleanliness"', () => {
    expect(classifyCause(cause({ tags: ['area', 'cleanliness'] }))).toBe(
      'cleanliness',
    )
    expect(classifyCause(cause({ tags: ['mess'] }))).toBe('cleanliness')
    expect(classifyCause(cause({ tags: ['filth'] }))).toBe('cleanliness')
  })

  it('maps danger / violence tags to "danger"', () => {
    expect(classifyCause(cause({ tags: ['service', 'dangerous'] }))).toBe(
      'danger',
    )
    expect(classifyCause(cause({ tags: ['violence', 'brawl'] }))).toBe('danger')
  })

  it('maps rumour / bad_reputation tags to "rumour"', () => {
    expect(classifyCause(cause({ tags: ['rumour'] }))).toBe('rumour')
    expect(classifyCause(cause({ tags: ['social', 'bad_reputation'] }))).toBe(
      'rumour',
    )
  })

  it('maps price and service_capacity tags to "price" / "wait"', () => {
    expect(classifyCause(cause({ tags: ['price'] }))).toBe('price')
    expect(classifyCause(cause({ tags: ['service_capacity'] }))).toBe('wait')
  })

  it('prefers shortage over the broad service-family tags it co-carries', () => {
    // The shortage cause also carries `service`; `service` must not route
    // it to `wait`. Priority order resolves this deterministically.
    expect(
      classifyCause(cause({ tags: ['service', 'satisfaction', 'shortage'] })),
    ).toBe('shortage')
  })

  it('returns undefined for an unclassifiable cause (reputation pressure)', () => {
    expect(
      classifyCause(
        cause({ tags: ['pressure', 'reputation_drift', 'reputation', 'identity'] }),
      ),
    ).toBeUndefined()
  })

  it('returns undefined for an undefined cause', () => {
    expect(classifyCause(undefined)).toBeUndefined()
  })
})

describe('pickDominantCause', () => {
  it('selects the highest abs(amount)*weight among negative causes', () => {
    const small = cause({ id: 'small', amount: -2, weight: 2, tags: ['rumour'] }) // score 4
    const big = cause({ id: 'big', amount: -4, weight: 8, tags: ['shortage'] }) // score 32
    const picked = pickDominantCause([small, big])
    expect(picked?.id).toBe('big')
    expect(classifyCause(picked)).toBe('shortage')
  })

  it('never selects a positive / increase cause', () => {
    const positive = cause({
      id: 'pos',
      amount: 50,
      direction: 'increase',
      weight: 99,
      tags: ['shortage'],
    })
    const negative = cause({
      id: 'neg',
      amount: -1,
      direction: 'decrease',
      weight: 1,
      tags: ['cleanliness'],
    })
    expect(pickDominantCause([positive, negative])?.id).toBe('neg')
  })

  it('tie-breaks equal scores by lowest ageDays (most recent)', () => {
    const old = cause({ id: 'old', amount: -2, weight: 4, ageDays: 5 }) // score 8
    const fresh = cause({ id: 'fresh', amount: -2, weight: 4, ageDays: 0 }) // score 8
    expect(pickDominantCause([old, fresh])?.id).toBe('fresh')
  })

  it('returns undefined for an empty or all-positive cause list', () => {
    expect(pickDominantCause([])).toBeUndefined()
    expect(pickDominantCause(undefined)).toBeUndefined()
    expect(
      pickDominantCause([cause({ amount: 5, direction: 'increase' })]),
    ).toBeUndefined()
  })
})
