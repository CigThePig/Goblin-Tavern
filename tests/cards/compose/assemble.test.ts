// Phase 123 / ISSUE-092 — Living Cast arc, Phase C.
//
// Unit tests for `assembleSlots` and `pickSnippet`. The framework's
// determinism + graceful-degradation guarantees are the load-bearing
// properties: Phase D adds the broader six-gate structural harness, but
// these two have to hold from day one or no compositional card is safe
// to ship.

import { describe, expect, it } from 'vitest'

import {
  assembleSlots,
  pickSnippet,
  specificityOf,
} from '../../../src/cards/compose/assemble'
import type {
  SlotSpec,
  Snippet,
  SnippetPool,
} from '../../../src/cards/compose/types'
import { createInitialTavernState } from '../../../src/sim/state/defaults'
import type { IssueSeed } from '../../../src/sim/modules/issues/issueSeedTypes'
import type { TavernState } from '../../../src/sim/state/TavernState'
import { makeSeed } from '../cardFactories'

function poolOf(slotId: string, snippets: Snippet[]): SnippetPool {
  return { slotId, snippets }
}

function slotOf(spec: { id: string; pool: SnippetPool; optional?: boolean }): SlotSpec {
  const slot: SlotSpec = { id: spec.id, role: 'aside', pool: spec.pool }
  if (spec.optional !== undefined) slot.optional = spec.optional
  return slot
}

function baseSeed(id = 'test-seed'): IssueSeed {
  return makeSeed({ id, family: 'regular_customer', type: 'relationship_test', timing: 'during_service' })
}

describe('specificityOf', () => {
  it('uses the conditions length when no override is set', () => {
    expect(specificityOf({ id: 'x', text: 'x', conditions: [] })).toBe(0)
    expect(
      specificityOf({
        id: 'x',
        text: 'x',
        conditions: [
          { kind: 'seedFamily', anyOf: ['regular_customer'] },
          { kind: 'timing', anyOf: ['during_service'] },
        ],
      }),
    ).toBe(2)
  })

  it('honours an explicit override', () => {
    expect(
      specificityOf({ id: 'x', text: 'x', conditions: [], specificity: 5 }),
    ).toBe(5)
  })
})

describe('pickSnippet — degradation and ordering', () => {
  const state = createInitialTavernState()
  const seed = baseSeed()

  it('returns the unconditional fallback when no other snippet matches', () => {
    const slot = slotOf({
      id: 'a',
      pool: poolOf('a', [
        { id: 'fallback', text: 'plain', conditions: [] },
        {
          id: 'never',
          text: 'never fires',
          conditions: [{ kind: 'severityAtLeast', value: 9999 }],
        },
      ]),
    })
    expect(pickSnippet(slot, seed, state)).toBe('plain')
  })

  it('higher-specificity matches beat the fallback', () => {
    const slot = slotOf({
      id: 'b',
      pool: poolOf('b', [
        { id: 'fallback', text: 'plain', conditions: [] },
        {
          id: 'specific',
          text: 'specific',
          conditions: [
            { kind: 'seedFamily', anyOf: ['regular_customer'] },
            { kind: 'timing', anyOf: ['during_service'] },
          ],
        },
      ]),
    })
    expect(pickSnippet(slot, seed, state)).toBe('specific')
  })

  it('returns undefined for an optional slot with no matches', () => {
    const slot = slotOf({
      id: 'c',
      optional: true,
      pool: poolOf('c', [
        {
          id: 'never',
          text: 'never fires',
          conditions: [{ kind: 'severityAtLeast', value: 9999 }],
        },
      ]),
    })
    expect(pickSnippet(slot, seed, state)).toBeUndefined()
  })

  it('returns undefined when the pool is empty', () => {
    const slot = slotOf({ id: 'd', pool: poolOf('d', []) })
    expect(pickSnippet(slot, seed, state)).toBeUndefined()
  })
})

describe('pickSnippet — deterministic tie-break', () => {
  const state = createInitialTavernState()

  it('same seed + slot resolves to the same snippet across calls', () => {
    const slot = slotOf({
      id: 'tie',
      pool: poolOf('tie', [
        {
          id: 'a',
          text: 'A',
          conditions: [{ kind: 'seedFamily', anyOf: ['regular_customer'] }],
        },
        {
          id: 'b',
          text: 'B',
          conditions: [{ kind: 'seedFamily', anyOf: ['regular_customer'] }],
        },
        {
          id: 'c',
          text: 'C',
          conditions: [{ kind: 'seedFamily', anyOf: ['regular_customer'] }],
        },
      ]),
    })
    const seed = baseSeed('seed-tie')
    const first = pickSnippet(slot, seed, state)
    for (let i = 0; i < 9; i += 1) {
      expect(pickSnippet(slot, seed, state)).toBe(first)
    }
  })

  it('survives structuredClone of state (cards-contract §5 rule 10)', () => {
    const slot = slotOf({
      id: 'clone-tie',
      pool: poolOf('clone-tie', [
        { id: 'a', text: 'A', conditions: [{ kind: 'severityAtLeast', value: 0 }] },
        { id: 'b', text: 'B', conditions: [{ kind: 'severityAtLeast', value: 0 }] },
      ]),
    })
    const seed = baseSeed('seed-clone-tie')
    const a = pickSnippet(slot, seed, state)
    const b = pickSnippet(slot, seed, structuredClone(state) as TavernState)
    expect(a).toBe(b)
  })

  it('different seed ids can pick different snippets from the same tie set', () => {
    // We don't *require* difference — FNV may collide for two specific
    // ids — but we do require that the picker reads the seed id (i.e.
    // the same pool with the same state never coerces to one snippet).
    const slot = slotOf({
      id: 'tie-2',
      pool: poolOf('tie-2', [
        { id: 'a', text: 'A', conditions: [{ kind: 'severityAtLeast', value: 0 }] },
        { id: 'b', text: 'B', conditions: [{ kind: 'severityAtLeast', value: 0 }] },
        { id: 'c', text: 'C', conditions: [{ kind: 'severityAtLeast', value: 0 }] },
        { id: 'd', text: 'D', conditions: [{ kind: 'severityAtLeast', value: 0 }] },
      ]),
    })
    const seen = new Set<string | undefined>()
    for (const id of ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta']) {
      seen.add(pickSnippet(slot, baseSeed(id), createInitialTavernState()))
    }
    expect(seen.size).toBeGreaterThan(1)
  })
})

describe('assembleSlots', () => {
  const state = createInitialTavernState()

  it('fills each slot independently and preserves slot ids', () => {
    const slots: SlotSpec[] = [
      slotOf({
        id: 'one',
        pool: poolOf('one', [{ id: 'fb', text: 'first', conditions: [] }]),
      }),
      slotOf({
        id: 'two',
        pool: poolOf('two', [{ id: 'fb', text: 'second', conditions: [] }]),
      }),
    ]
    const filled = assembleSlots(slots, baseSeed(), state)
    expect(filled['one']).toBe('first')
    expect(filled['two']).toBe('second')
  })

  it('omits optional slots that resolve to nothing', () => {
    const slots: SlotSpec[] = [
      slotOf({
        id: 'required',
        pool: poolOf('required', [{ id: 'fb', text: 'fallback', conditions: [] }]),
      }),
      slotOf({
        id: 'aside',
        optional: true,
        pool: poolOf('aside', [
          {
            id: 'no',
            text: 'never',
            conditions: [{ kind: 'severityAtLeast', value: 9999 }],
          },
        ]),
      }),
    ]
    const filled = assembleSlots(slots, baseSeed(), state)
    expect(filled['required']).toBe('fallback')
    expect(filled['aside']).toBeUndefined()
  })

  it('is deterministic across structured-clone of state', () => {
    const slots: SlotSpec[] = [
      slotOf({
        id: 'a',
        pool: poolOf('a', [
          { id: 'p', text: 'P', conditions: [{ kind: 'severityAtLeast', value: 0 }] },
          { id: 'q', text: 'Q', conditions: [{ kind: 'severityAtLeast', value: 0 }] },
        ]),
      }),
    ]
    const a = assembleSlots(slots, baseSeed('det'), state)
    const b = assembleSlots(slots, baseSeed('det'), structuredClone(state) as TavernState)
    expect(a).toEqual(b)
  })
})
