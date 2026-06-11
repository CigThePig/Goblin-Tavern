// Phase 186 / Day-Clock Cluster 5 — segmented day flow at the store
// boundary.
//
// Cluster 2 proved the engine's three segments compose to exactly one
// `simulateDay` (tests/sim/phase186.segmentedEngine.test.ts). This file
// proves the WEB STORE drives those segments correctly:
//
//   - beginDay / runService / endDay advance the segment + calendar and
//     drain the owner-action queue at the right moment;
//   - GATE B (contract §4.2) holds through the store: the daily report's
//     full-day diff spans start-of-day → end-of-day even though the three
//     segments run in separate runtimes — because the store threads the
//     start-of-day `dayBaseline`;
//   - a mid-day refresh (serialize → validate → hydrate) resumes against
//     the right segment AND keeps the full-day diff whole;
//   - a pre-Cluster-5 save (no `segment` field) at a closed-day report
//     beat resumes at a consistent position (the mid-day reset is
//     Cluster 7's — see phase186.cluster7Migration.test.ts).

import { beforeEach, describe, expect, it } from 'vitest'

import { simulateDay } from '../../src/sim/core/engine'
import { FULL_PIPELINE } from '../../src/sim/canonicalPipeline'
import type { TavernState } from '../../src/sim/state/TavernState'
import { gameStore } from '../../web/src/lib/sim/gameStore.svelte'
import { validatePersistedSession } from '../../web/src/lib/sim/persistence'

// Plain (non-proxied) clone of the store's current state — the engine's
// structuredClone rejects Svelte's deep proxy, and TavernState is plain
// JSON, so a JSON round-trip is the simplest way to snapshot it here.
function plainState(): TavernState {
  return JSON.parse(JSON.stringify(gameStore.state)) as TavernState
}

describe('Phase 186 / Cluster 5 — segmented day store flow', () => {
  beforeEach(() => {
    gameStore.reset('cluster5-seed')
  })

  it('beginDay → runService → endDay advances segment, beat-agnostic state, and the calendar', () => {
    expect(gameStore.segment).toBe('C') // ready to open
    const day0 = gameStore.state.calendar.totalDaysElapsed

    gameStore.beginDay()
    expect(gameStore.segment).toBe('A')
    // Segment A does NOT advance the calendar (advanceCalendar is in C).
    expect(gameStore.state.calendar.totalDaysElapsed).toBe(day0)

    gameStore.runService()
    expect(gameStore.segment).toBe('B')
    expect(gameStore.state.calendar.totalDaysElapsed).toBe(day0)

    const result = gameStore.endDay({ responseIntents: [] })
    expect(gameStore.segment).toBe('C')
    expect(result).toBeDefined()
    // Segment C advanced the calendar by exactly one day.
    expect(gameStore.state.calendar.totalDaysElapsed).toBe(day0 + 1)
    expect(gameStore.latestResult).toBe(result)
  })

  it('the segment methods are idempotent — a stray repeat is a no-op', () => {
    gameStore.beginDay()
    const afterBegin = plainState()
    // beginDay from 'A' must not re-run Segment A (which would clear and
    // regenerate the surface and double-advance the world).
    expect(gameStore.beginDay()).toBeUndefined()
    expect(plainState()).toEqual(afterBegin)

    // endDay from 'A' (Segment B hasn't run) must not close the day.
    expect(gameStore.segment).toBe('A')
    gameStore.endDay({ responseIntents: [] })
    expect(gameStore.segment).toBe('A')
  })

  it('runService drains the owner-action queue; staff priorities persist', () => {
    gameStore.setStaffPriority('does-not-exist', 'rest') // sticky, ignored by engine
    const added = gameStore.tryAddPick({
      actionId: 'buy_mugs',
      label: 'Buy Mugs',
      category: 'immediate',
      targetType: 'stock',
      targetId: 'mugs',
      targetLabel: 'Mugs',
      timeCost: 30,
    })
    expect(added.ok).toBe(true)

    gameStore.beginDay()
    expect(gameStore.picks.length).toBe(1) // not consumed until Segment B
    gameStore.runService()
    expect(gameStore.picks.length).toBe(0) // consumed by Segment B
    // Staff priorities are sticky across the day.
    expect(gameStore.staffPriorities['does-not-exist']).toBe('rest')
  })

  it('GATE B — the store full-day diff equals a single simulateDay diff', () => {
    // Oracle: one full-day `simulateDay` from the same baseline + input.
    const baseline = plainState()
    const day0 = baseline.calendar.totalDaysElapsed
    const input = {
      seed: `cluster5-seed-d${day0}`,
      ownerActions: [],
      staffPriorities: {},
    }
    const single = simulateDay(baseline, input, FULL_PIPELINE)
    const singleDay = single.diffs.find((d) => d.boundary === 'day')

    // Segmented store run (A → B → C), no picks/responses, same seed.
    const segmented = gameStore.runDay({})
    const segmentedDay = segmented.diffs.find((d) => d.boundary === 'day')

    expect(singleDay).toBeDefined()
    expect(segmentedDay).toBeDefined()
    // If GATE B were broken (per-segment diff shattering), the store diff
    // would only carry Segment C's changes. Threading the start-of-day
    // baseline keeps it whole: identical to the single full-day diff.
    expect(segmentedDay!.changes).toEqual(singleDay!.changes)
  })

  it('mid-day refresh — serialize at Segment B, hydrate, finish the day', () => {
    // dayBaseline is no longer written to the save (2026-06-11 audit §1):
    // persisting a second full TavernState mid-day doubled save size and
    // crossed the Firefox/Safari ~5 MB quota from day ~22. After reload
    // the baseline falls back to the post-B state, so the full-day diff
    // covers only Segment C (documented post-reload partial-diff edge).

    const baseline = plainState()
    const day0 = baseline.calendar.totalDaysElapsed

    // Drive to mid-day (Segment B done) and save there.
    gameStore.beginDay()
    gameStore.runService()
    gameStore.setBeat('closing')
    const session = gameStore.serializeForSave()
    expect(session.daySession.segment).toBe('B')
    // dayBaseline is intentionally absent — see audit §1.
    expect(session.dayBaseline).toBeUndefined()

    // Simulate a refresh: round-trip the save through the loader and
    // hydrate a "fresh" store.
    const outcome = validatePersistedSession(
      JSON.parse(JSON.stringify(session)),
    )
    expect(outcome.kind).toBe('loaded')
    if (outcome.kind !== 'loaded') return
    expect(outcome.save.dayBaseline).toBeUndefined()

    gameStore.reset('other-seed') // prove hydrate fully replaces state
    gameStore.hydrateFromSave(outcome.save)
    expect(gameStore.segment).toBe('B')
    expect(gameStore.beat).toBe('closing')

    // Finish the day after the refresh — the day must close correctly even
    // with a partial diff baseline (Segment C only). The result must carry
    // a day diff and the day counter must advance.
    const finished = gameStore.endDay({ responseIntents: [] })
    expect(gameStore.state.calendar.totalDaysElapsed).toBe(day0 + 1)
    const finishedDay = finished!.diffs.find((d) => d.boundary === 'day')
    expect(finishedDay).toBeDefined()
  })

  it('opening the next day does NOT relabel the just-closed day report', () => {
    // Regression: previousCalendar (the just-closed day's calendar, used
    // to label the daily report) must reflect the CLOSED day, not the
    // next day's start. Capturing it in beginDay would overwrite it the
    // moment the next morning opens — while latestResult still describes
    // the prior day — mislabelling the report shown on the Reports tab.
    gameStore.runDay({}) // close a day
    const closedReportCalendar = gameStore.previousCalendar
    expect(closedReportCalendar).toBeDefined()
    const closedOrdinal = gameStore.state.calendar.totalDaysElapsed

    gameStore.beginDay() // open the next day
    // The new day's segment A may advance day-of-month/tags in state, but
    // the prior report's label anchor must be untouched.
    expect(gameStore.previousCalendar).toEqual(closedReportCalendar)
    // And the closed-day ordinal the report reads (state.totalDaysElapsed,
    // unchanged by Segment A) still points at the day that closed.
    expect(gameStore.state.calendar.totalDaysElapsed).toBe(closedOrdinal)
  })

  it('a pre-Cluster-5 save at a closed-day report beat resumes at segment C', () => {
    // A closed-day report beat is a clean boundary: no Segment A is owed,
    // so the legacy save resumes at 'C' (ready to begin the next day).
    // The in-flight (mid-day) reset is exercised in
    // tests/web/phase186.cluster7Migration.test.ts.
    gameStore.runDay({}) // close a day so latestResult/state are populated
    const session = gameStore.serializeForSave() as Record<string, unknown>
    const daySession = { ...(session.daySession as Record<string, unknown>) }
    delete daySession.segment
    daySession.beat = 'report'
    session.daySession = daySession

    const outcome = validatePersistedSession(JSON.parse(JSON.stringify(session)))
    expect(outcome.kind).toBe('loaded')
    if (outcome.kind !== 'loaded') return
    expect(outcome.save.daySession.beat).toBe('report')
    expect(outcome.save.daySession.segment).toBe('C')
  })
})
