// Phase 98 — Export / import round-trip tests.
//
// The pure parts of the export/import pipeline are testable without a
// DOM: `makeExportFilename` is deterministic and `parseImportedSession`
// runs the same validation pipeline as the autosave path. The
// `exportSessionToFile` function touches `document` and is verified
// manually.

import { describe, expect, it } from 'vitest'

import {
  makeExportFilename,
  parseImportedSession,
} from '../../web/src/lib/sim/exportImport'
import {
  SAVE_VERSION,
  type PersistedSession,
} from '../../web/src/lib/sim/persistence'
import { createInitialTavernState } from '../../src/sim/state/defaults'

function makeSession(day = 14): PersistedSession {
  const state = createInitialTavernState()
  state.calendar.totalDaysElapsed = day
  return {
    saveVersion: SAVE_VERSION,
    savedAt: '2026-05-18T12:00:00.000Z',
    simSeed: 'tests/export',
    state,
    picks: [],
    staffPriorities: {},
    pendingBySeedId: {},
    daySession: { beat: 'morning', serviceComplete: false, closingComplete: false },
    route: 'day',
  }
}

describe('makeExportFilename', () => {
  it('encodes the day and the current date', () => {
    const session = makeSession(14)
    const filename = makeExportFilename(session, new Date(2026, 4, 18))
    expect(filename).toBe('goblin-tavern-day-14-20260518.json')
  })

  it('pads single-digit days and months in the date', () => {
    const session = makeSession(3)
    const filename = makeExportFilename(session, new Date(2026, 0, 5))
    expect(filename).toBe('goblin-tavern-day-3-20260105.json')
  })
})

describe('parseImportedSession', () => {
  it('round-trips a freshly-serialized session', () => {
    const session = makeSession(5)
    const text = JSON.stringify(session)
    const out = parseImportedSession(text)
    expect(out.ok).toBe(true)
    if (!out.ok) return
    expect(out.session.simSeed).toBe('tests/export')
    expect(out.session.state.calendar.totalDaysElapsed).toBe(5)
  })

  it('rejects malformed JSON with a friendly reason', () => {
    const out = parseImportedSession('{this is not json')
    expect(out.ok).toBe(false)
    if (out.ok) return
    expect(out.reason).toMatch(/json/i)
  })

  it('rejects a payload missing saveVersion', () => {
    const out = parseImportedSession(JSON.stringify({ state: {} }))
    expect(out.ok).toBe(false)
  })

  it('reports incompatible saves with a clear message', () => {
    const session = makeSession(1)
    const blob = JSON.parse(JSON.stringify(session)) as { saveVersion: number }
    blob.saveVersion = SAVE_VERSION + 99
    const out = parseImportedSession(JSON.stringify(blob))
    expect(out.ok).toBe(false)
    if (out.ok) return
    expect(out.reason).toMatch(/version/i)
  })

  it('rejects a schema-busted payload (coin is not a number)', () => {
    const session = makeSession(1)
    const blob = JSON.parse(JSON.stringify(session)) as { state: { coin: unknown } }
    blob.state.coin = 'pickle'
    const out = parseImportedSession(JSON.stringify(blob))
    expect(out.ok).toBe(false)
  })
})
