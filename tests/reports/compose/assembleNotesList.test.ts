// Phase 141 / ISSUE-110 — Voiced Surface arc, Phase 15 (Reports Prose).
//
// Unit tests for the multi-line `assembleNotesList` analogue of
// `assembleSlots`. Load-bearing properties:
//   1. Slots that resolve to a snippet emit one note line each.
//   2. Slots that resolve to `undefined` (no matching snippet, no
//      unconditional fallback) are filtered out — silence beats forced
//      copy, matching the optional-slot behaviour of `assembleSlots`.
//   3. Output order matches the input slot order; no shuffling, no
//      dedupe at the runtime layer (the dedupe gate runs at author
//      time, not at projection time).
//   4. Determinism across re-render: same seed + state + slot list ⇒
//      same string array, every render.

import { describe, expect, it } from 'vitest'

import { assembleNotesList } from '../../../src/cards/compose/reports/assembleNotesList'
import { buildReportSeed } from '../../../src/cards/compose/reports/reportSeed'
import type {
  SlotSpec,
  Snippet,
  SnippetPool,
} from '../../../src/cards/compose/types'
import { createInitialTavernState } from '../../../src/sim/state/defaults'

function poolOf(slotId: string, snippets: Snippet[]): SnippetPool {
  return { slotId, snippets }
}

function noteSlot(spec: { id: string; pool: SnippetPool }): SlotSpec {
  return {
    id: spec.id,
    role: 'aside',
    pool: spec.pool,
    optional: true,
    claimMode: 'sim_backed',
  }
}

const FIXED_SEED = buildReportSeed({
  sectionId: 'test.section',
  periodKey: 'W01',
  timing: 'end_week',
})
const FIXED_STATE = createInitialTavernState()

describe('assembleNotesList', () => {
  it('returns an empty array when no slots fire', () => {
    const slot = noteSlot({
      id: 'note_a',
      pool: poolOf('note_a', [
        {
          id: 'a',
          text: 'only fires when rent_due_soon',
          conditions: [{ kind: 'hasTag', tag: 'rent_due_soon' }],
        },
      ]),
    })
    const out = assembleNotesList([slot], FIXED_SEED, FIXED_STATE)
    expect(out).toEqual([])
  })

  it('emits one note per fired slot, in input order', () => {
    const slotA = noteSlot({
      id: 'note_a',
      pool: poolOf('note_a', [
        { id: 'a', text: 'A always fires.', conditions: [] },
      ]),
    })
    const slotB = noteSlot({
      id: 'note_b',
      pool: poolOf('note_b', [
        { id: 'b', text: 'B always fires.', conditions: [] },
      ]),
    })
    const slotC = noteSlot({
      id: 'note_c',
      pool: poolOf('note_c', [
        { id: 'c', text: 'C always fires.', conditions: [] },
      ]),
    })
    const out = assembleNotesList(
      [slotA, slotB, slotC],
      FIXED_SEED,
      FIXED_STATE,
    )
    expect(out).toEqual(['A always fires.', 'B always fires.', 'C always fires.'])
  })

  it('filters out slots whose pool has no matching snippet', () => {
    const fireSlot = noteSlot({
      id: 'note_fire',
      pool: poolOf('note_fire', [
        { id: 'f', text: 'fires.', conditions: [] },
      ]),
    })
    const silentSlot = noteSlot({
      id: 'note_silent',
      pool: poolOf('note_silent', [
        {
          id: 's',
          text: 'never matches.',
          conditions: [{ kind: 'hasTag', tag: 'nonexistent' }],
        },
      ]),
    })
    const out = assembleNotesList(
      [silentSlot, fireSlot, silentSlot],
      FIXED_SEED,
      FIXED_STATE,
    )
    expect(out).toEqual(['fires.'])
  })

  it('preserves duplicate snippet text across slots (no runtime dedupe)', () => {
    // Two slots, each picking the same text. Runtime returns both;
    // dedupe is enforced at author time by the dedupe gate, not by
    // the projection layer.
    const slotA = noteSlot({
      id: 'note_a',
      pool: poolOf('note_a', [
        { id: 'a', text: 'identical line.', conditions: [] },
      ]),
    })
    const slotB = noteSlot({
      id: 'note_b',
      pool: poolOf('note_b', [
        { id: 'b', text: 'identical line.', conditions: [] },
      ]),
    })
    const out = assembleNotesList([slotA, slotB], FIXED_SEED, FIXED_STATE)
    expect(out).toEqual(['identical line.', 'identical line.'])
  })

  it('is deterministic across two calls with the same inputs', () => {
    const slot = noteSlot({
      id: 'note_a',
      pool: poolOf('note_a', [
        { id: 'a1', text: 'variant one.', conditions: [] },
        { id: 'a2', text: 'variant two.', conditions: [] },
      ]),
    })
    const first = assembleNotesList([slot], FIXED_SEED, FIXED_STATE)
    const second = assembleNotesList([slot], FIXED_SEED, FIXED_STATE)
    expect(first).toEqual(second)
  })
})
