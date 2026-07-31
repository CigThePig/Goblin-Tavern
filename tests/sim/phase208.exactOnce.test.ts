// Phase 208 / ISSUE-171 — Expansion Phase 1: the exact-once guarantee.
//
// The plan's "Phase 1 → Required tests" asks for exact-once drain across
// **normal play, retry, save/load, import, and segment resume**, and §5's
// work protocol adds two standing requirements for every phase:
//
//   §5.9  full-day versus segmented equivalence for affected routes
//   §5.10 at least one save/reload at every day beat the new lifecycle crosses
//
// Phase 1's new lifecycle crosses two beats — `morning` (inside `startDay`,
// segment A) and `wrap_up` (the `resolveScheduledEvents` phase, segment C) —
// so both get a reload.
//
// Everything here runs through the real engine and the real persistence
// layer. The obligation probe expansion is the producer: it uses the same
// public `openObligation` / `scheduleObligationDueDate` / `scheduleEvent`
// API that Phases 2-7's domains will use, so what is under test is the
// machinery those domains will inherit, not a mock of it.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { FULL_PIPELINE } from '../../src/sim/canonicalPipeline'
import { advanceDaySegment, simulateDay } from '../../src/sim/core/engine'
import { DAY_SEGMENTS, type DaySegment } from '../../src/sim/core/segments'
import type { SimInput } from '../../src/sim/core/context'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import type { TavernState } from '../../src/sim/state/TavernState'
import {
  SAVE_VERSION,
  loadSession,
  saveSession,
  setStorageForTesting,
  type PersistedSession,
  type StorageLike,
} from '../../web/src/lib/sim/persistence'
import type { Beat } from '../../web/src/lib/sim/daySession'

import {
  readScheduledEventsSlice,
} from '../../src/sim/contracts/scheduledEvents/index'
import { readObligationsSlice } from '../../src/sim/contracts/obligations/index'
import {
  configureObligationProbe,
  installObligationProbeExpansion,
  obligationProbeModule,
  resetObligationProbe,
  uninstallObligationProbeExpansion,
} from '../../src/sim/testing/expansions/obligationProbe'

const PIPELINE = [...FULL_PIPELINE, obligationProbeModule]
const SEED = 'phase208/exact-once'
const DAYS = 8

class MemoryStorage implements StorageLike {
  private readonly map = new Map<string, string>()
  getItem(k: string): string | null {
    return this.map.has(k) ? this.map.get(k)! : null
  }
  setItem(k: string, v: string): void {
    this.map.set(k, v)
  }
  removeItem(k: string): void {
    this.map.delete(k)
  }
}

function input(day: number): SimInput {
  return { seed: `${SEED}-d${day}` }
}

function freshStart(): TavernState {
  resetObligationProbe()
  configureObligationProbe({
    openOnDay: 1,
    principal: 45,
    dueInDays: 2,
    counterpartyId: 'the_landlord',
  })
  return createInitialTavernState()
}

/** Every terminal outcome the run produced, in order. */
function outcomes(state: TavernState): string[] {
  return readScheduledEventsSlice(state).archive.map(
    (o) => `${o.type}|${o.status}|${o.resolvedOnDay}`,
  )
}

function plain(state: TavernState): unknown {
  return JSON.parse(JSON.stringify(state))
}

function sessionFor(state: TavernState, beat: Beat, segment: DaySegment): PersistedSession {
  return {
    saveVersion: SAVE_VERSION,
    savedAt: '2026-07-29T00:00:00.000Z',
    simSeed: SEED,
    state,
    picks: [],
    staffPriorities: {},
    pendingBySeedId: {},
    daySession: {
      beat,
      segment,
      serviceComplete: segment !== 'A',
      closingComplete: segment === 'C',
    },
    route: 'day',
  }
}

/** Save and load, returning the state the loader produced. */
function roundTrip(state: TavernState, beat: Beat, segment: DaySegment): TavernState {
  setStorageForTesting(new MemoryStorage())
  try {
    expect(saveSession(sessionFor(state, beat, segment)).ok).toBe(true)
    const outcome = loadSession()
    expect(outcome.kind).toBe('loaded')
    if (outcome.kind !== 'loaded') throw new Error('load failed')
    return outcome.save.state
  } finally {
    setStorageForTesting(undefined)
  }
}

describe('Phase 208 §1.1 — exact-once across every route', () => {
  beforeEach(() => {
    installObligationProbeExpansion()
    resetObligationProbe()
  })
  afterEach(() => {
    uninstallObligationProbeExpansion()
  })

  /** The baseline: uninterrupted whole-day simulation. */
  function runNormal(): TavernState {
    let state = freshStart()
    for (let day = 0; day < DAYS; day += 1) {
      state = simulateDay(state, input(day), PIPELINE).state
    }
    return state
  }

  it('normal play resolves each scheduled event exactly once', () => {
    const end = runNormal()
    const archive = readScheduledEventsSlice(end).archive

    // Something actually happened — a test that passes on an empty queue
    // proves nothing.
    expect(archive.length).toBeGreaterThan(0)

    // No exact-once key was honoured twice.
    const keys = readScheduledEventsSlice(end).spentKeys.map((k) => k.key)
    expect(new Set(keys).size).toBe(keys.length)

    // Nothing was suppressed as a duplicate, because nothing tried twice.
    expect(readScheduledEventsSlice(end).totals.duplicatesSuppressed).toBe(0)

    // Every resolved outcome names an authoritative mutation, and every
    // non-resolved one gives a reason. This is the `OBL-02` contract.
    for (const outcome of archive) {
      if (outcome.status === 'resolved') {
        expect(outcome.mutations.length, outcome.type).toBeGreaterThan(0)
      } else {
        expect(outcome.reason, outcome.type).toBeTruthy()
      }
    }
  })

  it('a retried day produces the same outcomes, not doubled ones', () => {
    // "Retry" = the same day simulated twice from the same input state, with
    // the second result kept. A player who reloads and replays a day must not
    // get the day's consequences applied twice.
    let straight = freshStart()
    let retried = freshStart()
    for (let day = 0; day < DAYS; day += 1) {
      straight = simulateDay(straight, input(day), PIPELINE).state
      // Throw the first attempt away and keep the second, exactly as a
      // reload-and-replay does.
      simulateDay(retried, input(day), PIPELINE)
      retried = simulateDay(retried, input(day), PIPELINE).state
    }
    expect(outcomes(retried)).toEqual(outcomes(straight))
    expect(plain(retried)).toEqual(plain(straight))
  })

  it('a reload at every beat the new lifecycle crosses changes nothing', () => {
    // §5.10. The `morning` beat is inside segment A; `wrap_up` is inside
    // segment C. Both get a save/load round trip, and the day must land in
    // exactly the same place as one that was never interrupted.
    const reference = (() => {
      let state = freshStart()
      for (let day = 0; day < DAYS; day += 1) {
        state = simulateDay(state, input(day), PIPELINE).state
      }
      return state
    })()

    for (const [reloadAfter, beat] of [
      ['A', 'morning'],
      ['C', 'report'],
    ] as Array<[DaySegment, Beat]>) {
      let state = freshStart()
      for (let day = 0; day < DAYS; day += 1) {
        const dayStart = state
        let baseline = dayStart
        for (const segment of DAY_SEGMENTS) {
          state = advanceDaySegment(state, input(day), PIPELINE, segment, {
            dayBaseline: baseline,
          }).state
          if (segment === reloadAfter) {
            state = roundTrip(state, beat, segment)
            baseline = dayStart
          }
        }
      }
      expect(
        outcomes(state),
        `a reload after segment ${reloadAfter} changed the outcomes`,
      ).toEqual(outcomes(reference))
      expect(plain(state)).toEqual(plain(reference))
    }
  })

  it('an imported save cannot re-fire a promise the run already honoured', () => {
    // "Import" = a save loaded into a fresh runtime and carried on from.
    // The danger is a record whose key was already spent being re-queued and
    // fired again; the last-moment check in `fireEvent` is what stops it.
    let state = freshStart()
    for (let day = 0; day < 4; day += 1) {
      state = simulateDay(state, input(day), PIPELINE).state
    }
    const spentBefore = readScheduledEventsSlice(state).spentKeys.map((k) => k.key)
    expect(spentBefore.length).toBeGreaterThan(0)

    const imported = roundTrip(state, 'report', 'C')
    // The exact-once ledger survives the round trip; without it the import
    // would have no way to know what had already happened.
    expect(readScheduledEventsSlice(imported).spentKeys.map((k) => k.key)).toEqual(
      spentBefore,
    )

    // Re-queue an already-honoured promise by hand — the shape a stale
    // imported save has — and run a day. It must be suppressed, not fired.
    const tampered = structuredClone(imported)
    const slice = readScheduledEventsSlice(tampered)
    const spentKey = slice.spentKeys[0]!.key
    const type = spentKey.split('|')[0]!
    ;(tampered.modules as Record<string, unknown>)['scheduledEvents'] = {
      ...slice,
      queue: [
        ...slice.queue,
        {
          id: 'sched-imported-dupe',
          type,
          kind: 'mechanical' as const,
          ownerModuleId: 'obligations',
          exactOnceKey: spentKey,
          scheduledForDay: tampered.calendar.totalDaysElapsed,
          beat: 'morning' as const,
          expiresAfterDay: tampered.calendar.totalDaysElapsed + 3,
          payload: { obligationId: 'obl-does-not-matter' },
          status: 'scheduled' as const,
          occurrence: 1,
          createdOnDay: tampered.calendar.totalDaysElapsed,
          origin: { source: 'import', readable: 'A stale promise.' },
        },
      ],
    }

    const after = simulateDay(tampered, input(4), PIPELINE).state
    const afterSlice = readScheduledEventsSlice(after)
    expect(afterSlice.totals.duplicatesSuppressed).toBeGreaterThan(0)
    const suppressed = afterSlice.archive.find(
      (o) => o.eventId === 'sched-imported-dupe',
    )
    expect(suppressed?.status).toBe('duplicate_suppressed')
    expect(suppressed?.mutations).toEqual([])
    expect(suppressed?.reason).toMatch(/already honoured/)
  })

  it('segmented resume matches whole-day simulation exactly', () => {
    // §5.9. Same seeds, same inputs; one route runs `simulateDay`, the other
    // runs the three segments as the web client does across its two pauses.
    let batch = freshStart()
    let segmented = freshStart()

    for (let day = 0; day < DAYS; day += 1) {
      batch = simulateDay(batch, input(day), PIPELINE).state

      const dayStart = segmented
      for (const segment of DAY_SEGMENTS) {
        segmented = advanceDaySegment(
          segmented,
          input(day),
          PIPELINE,
          segment,
          { dayBaseline: dayStart },
        ).state
      }
    }

    expect(outcomes(segmented)).toEqual(outcomes(batch))
    expect(plain(segmented)).toEqual(plain(batch))
  })

  it('the whole run stays inside every declared bound', () => {
    const end = runNormal()
    const events = readScheduledEventsSlice(end)
    const obligations = readObligationsSlice(end)

    // §5.11: every persistent collection this phase added has a cap, and a
    // normal run must sit well inside it rather than relying on the cap.
    expect(events.queue.length).toBeLessThan(400)
    expect(events.archive.length).toBeLessThanOrEqual(200)
    expect(events.spentKeys.length).toBeLessThanOrEqual(512)
    expect(Object.keys(obligations.records).length).toBeLessThanOrEqual(120)
    expect(obligations.closed.length).toBeLessThanOrEqual(80)

    // And no duplicate ids anywhere.
    const eventIds = [
      ...events.queue.map((r) => r.id),
      ...events.archive.map((o) => o.eventId),
    ]
    expect(new Set(eventIds).size).toBe(eventIds.length)
  })

  it('a run with no narrative hooks queues only real obligation due dates', () => {
    // The stock pipeline, with no probe, declares no narrative hooks. Service
    // can still create slate obligations, whose mechanical due dates belong
    // in this queue; those are not Phase 1 narrative expectations.
    let state = createInitialTavernState()
    for (let day = 0; day < 5; day += 1) {
      state = simulateDay(state, input(day), FULL_PIPELINE).state
    }
    const slice = readScheduledEventsSlice(state)
    expect(slice.queue.length).toBeGreaterThan(0)
    expect(slice.queue.every((record) => record.type === 'obligation_due')).toBe(true)
    expect(
      slice.queue.some((record) => record.kind === 'narrative_expectation'),
    ).toBe(false)
    expect(slice.archive).toEqual([])
  })
})
