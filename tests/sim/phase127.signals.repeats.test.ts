// Phase 127 / ISSUE-096 — Voiced Surface arc, Phase 1.
//
// Window arithmetic + tag matching for `repeatCountByTag`. Backs the
// rewired `repeatCount` snippet condition. The window default is 28
// days (DEFAULT_REPEAT_WINDOW_DAYS); the boundary tests pin
// inside/outside the window.

import { describe, expect, it } from 'vitest'

import {
  DEFAULT_REPEAT_WINDOW_DAYS,
  repeatCountByTag,
} from '../../src/sim/signals'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import type { MemoryState, TavernState } from '../../src/sim/state/TavernState'

function memory(opts: {
  id: string
  tags: string[]
  absoluteDay: number
}): MemoryState {
  return {
    id: opts.id,
    type: 'fact',
    strength: 50,
    ageDays: 0,
    createdAt: {
      year: 1,
      month: 1,
      week: 1,
      day: 1,
      absoluteDay: opts.absoluteDay,
    },
    actors: [],
    locations: [],
    relatedSystems: [],
    tags: opts.tags,
  }
}

describe('repeatCountByTag', () => {
  const base = createInitialTavernState()

  it('returns 0 when no memories carry the tag', () => {
    expect(repeatCountByTag(base, 'never_recorded')).toBe(0)
  })

  it('counts every memory whose tags include the subjectTag', () => {
    const today = base.calendar.totalDaysElapsed
    const state: TavernState = {
      ...base,
      memories: [
        memory({ id: 'a', tags: ['ale'], absoluteDay: today }),
        memory({ id: 'b', tags: ['ale', 'service'], absoluteDay: today - 5 }),
        memory({ id: 'c', tags: ['food'], absoluteDay: today - 1 }),
        memory({ id: 'd', tags: ['ale'], absoluteDay: today - 10 }),
      ],
    }
    expect(repeatCountByTag(state, 'ale')).toBe(3)
    expect(repeatCountByTag(state, 'food')).toBe(1)
    expect(repeatCountByTag(state, 'service')).toBe(1)
  })

  it('drops memories outside the default window', () => {
    const today = base.calendar.totalDaysElapsed
    const state: TavernState = {
      ...base,
      memories: [
        memory({
          id: 'just-inside',
          tags: ['ale'],
          absoluteDay: today - DEFAULT_REPEAT_WINDOW_DAYS,
        }),
        memory({
          id: 'just-outside',
          tags: ['ale'],
          absoluteDay: today - DEFAULT_REPEAT_WINDOW_DAYS - 1,
        }),
      ],
    }
    expect(repeatCountByTag(state, 'ale')).toBe(1)
  })

  it('respects an explicit windowDays override', () => {
    const today = base.calendar.totalDaysElapsed
    const state: TavernState = {
      ...base,
      memories: [
        memory({ id: 'recent', tags: ['ale'], absoluteDay: today - 3 }),
        memory({ id: 'older', tags: ['ale'], absoluteDay: today - 10 }),
      ],
    }
    expect(repeatCountByTag(state, 'ale', 7)).toBe(1)
    expect(repeatCountByTag(state, 'ale', 14)).toBe(2)
  })

  it('is deterministic under structuredClone', () => {
    const today = base.calendar.totalDaysElapsed
    const state: TavernState = {
      ...base,
      memories: [memory({ id: 'a', tags: ['ale'], absoluteDay: today })],
    }
    expect(repeatCountByTag(state, 'ale')).toBe(
      repeatCountByTag(structuredClone(state), 'ale'),
    )
  })
})
