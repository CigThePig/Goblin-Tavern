import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { runProgressionLab } from '../../scripts/progression-lab'
import { advanceDaySegment, simulateDay } from '../../src/sim/core/engine'
import { FULL_PIPELINE } from '../../src/sim/canonicalPipeline'
import type { TavernState } from '../../src/sim/state/TavernState'
import { ensureAmbitionProgression } from '../../src/sim/state/migrations'
import { saveSession, loadSession, setStorageForTesting, SAVE_VERSION, type PersistedSession } from '../../web/src/lib/sim/persistence'

const plain = (state: TavernState) => JSON.parse(JSON.stringify(state))
function reload(state: TavernState, beat: 'morning' | 'plan' | 'service' | 'closing' | 'report', segment: 'A' | 'B' | 'C'): TavernState {
  const map = new Map<string, string>()
  setStorageForTesting({ getItem: k => map.get(k) ?? null, setItem: (k, v) => { map.set(k,v) }, removeItem: k => { map.delete(k) } })
  const session: PersistedSession = { saveVersion: SAVE_VERSION, savedAt: '2026-09-06T00:00:00.000Z', simSeed: 'ambition-resume', state, picks: [], staffPriorities: {}, pendingBySeedId: {}, daySession: { beat, segment, serviceComplete: segment !== 'A', closingComplete: segment === 'C' }, route: 'tavern', subroutes: { tavern: 'ambitions' } }
  expect(saveSession(session).ok).toBe(true)
  const loaded = loadSession()
  if (loaded.kind !== 'loaded') throw new Error(`Save could not be loaded: ${loaded.kind}`)
  expect(loaded.save.subroutes?.tavern).toBe('ambitions')
  return loaded.save.state
}
afterEach(() => setStorageForTesting(undefined))

describe('progression remains authoritative across segments and reloads', () => {
  let baseline: TavernState
  beforeAll(() => { baseline = runProgressionLab(12, 'progression-lab', 'venture_supplier_compact').state }, 60000)
  it('crosses all five beats with byte-equivalent state and finishes like an uninterrupted full day', () => {
    expect(baseline.ventures.venture_supplier_compact?.progress).toBe(1)
    const input = { seed: 'ambition-resume', ownerActions: [{ actionId: 'work_on_venture', targetId: 'venture_supplier_compact:invest' }] }
    const whole = simulateDay(baseline, input, FULL_PIPELINE).state
    const a = advanceDaySegment(baseline, input, FULL_PIPELINE, 'A').state
    const morning = reload(a, 'morning', 'A')
    expect(plain(morning)).toEqual(plain(a))
    const plan = reload(morning, 'plan', 'A')
    const b = advanceDaySegment(plan, input, FULL_PIPELINE, 'B', { dayBaseline: baseline }).state
    const service = reload(b, 'service', 'B')
    expect(plain(service)).toEqual(plain(b))
    const closing = reload(service, 'closing', 'B')
    const c = advanceDaySegment(closing, input, FULL_PIPELINE, 'C', { dayBaseline: baseline }).state
    const report = reload(c, 'report', 'C')
    expect(plain(report)).toEqual(plain(whole))
    expect(report.ventures.venture_supplier_compact?.stage).toBe('prove')
  })
  it('migrates legacy ventures and mastery without resetting their progress or adding backdated reputation', () => {
    const legacy = plain(baseline) as TavernState
    delete legacy.modules.ventures
    delete legacy.modules.tavernIdentity
    const migrated = ensureAmbitionProgression(legacy)
    expect(migrated.ventures).toEqual(legacy.ventures)
    expect(migrated.arcs).toEqual(legacy.arcs)
    expect(migrated.modules.tavernIdentity).toEqual({ evidence: {}, lastObservedDay: -1 })
    expect(ensureAmbitionProgression(migrated)).toEqual(migrated)
  })
})
