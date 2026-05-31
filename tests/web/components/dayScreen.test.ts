// Phase 97 / ISSUE-057 — DayScreen component tests.
// Phase 186 / Day-Clock Cluster 5 — rewired for the segmented day. The
// day now advances as three engine segments (`advanceDaySegment`) driven
// by the beats: Segment A opens the morning, Segment B runs at "Run
// service", Segment C runs at "End day". These tests still guard the
// error-recovery behaviour ISSUE-057 introduced, now against the
// per-segment engine calls.
//
// What we're covering:
//
// 1. Happy path — open the day, run service, End day at closing → beat
//    advances to 'report' and the DailyReport renders.
//
// 2. Segment C (End day) throws — assert the run-error banner appears,
//    beat does NOT advance, Retry clears the error and recovers.
//
// 3. `projectYesterdayDigest` throws — morning beat renders the inline
//    digest fallback without unmounting the rest of the morning.
//
// 4. `buildDailyReport` throws AFTER a successful Segment C — beat
//    advances but the "Report unavailable" fallback renders, and Next
//    day still works.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte'

// Hoisted mocks so vi.mock() can reach them. `vi.hoisted` is the
// vitest 1.x escape hatch that makes the function reference available
// to the mock factory below.
const mocks = vi.hoisted(() => ({
  advanceDaySegment: vi.fn(),
  buildDailyReport: vi.fn(),
  projectYesterdayDigest: vi.fn(),
  realAdvanceDaySegment: undefined as undefined | ((...args: unknown[]) => unknown),
  realBuildDailyReport: undefined as undefined | ((...args: unknown[]) => unknown),
  realProjectYesterdayDigest: undefined as
    | undefined
    | ((...args: unknown[]) => unknown),
}))

vi.mock('../../../src/sim/core/engine', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  mocks.realAdvanceDaySegment = actual['advanceDaySegment'] as (
    ...args: unknown[]
  ) => unknown
  // Default: pass through to the real engine. Tests override via
  // mocks.advanceDaySegment.mockImplementationOnce(...) when they want a throw.
  mocks.advanceDaySegment.mockImplementation((...args) =>
    mocks.realAdvanceDaySegment!(...args),
  )
  return { ...actual, advanceDaySegment: mocks.advanceDaySegment }
})

vi.mock('../../../src/reports/index', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  mocks.realBuildDailyReport = actual['buildDailyReport'] as (...args: unknown[]) => unknown
  mocks.buildDailyReport.mockImplementation((...args) =>
    mocks.realBuildDailyReport!(...args),
  )
  return { ...actual, buildDailyReport: mocks.buildDailyReport }
})

// Phase 120 / ISSUE-059 — the morning yesterday digest now uses safeProject
// around projectYesterdayDigest. Mock it so we can force a throw and
// verify the inline fallback renders without unmounting the morning view.
vi.mock('../../../src/reports/yesterdayDigest', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  mocks.realProjectYesterdayDigest = actual['projectYesterdayDigest'] as (
    ...args: unknown[]
  ) => unknown
  mocks.projectYesterdayDigest.mockImplementation((...args) =>
    mocks.realProjectYesterdayDigest!(...args),
  )
  return { ...actual, projectYesterdayDigest: mocks.projectYesterdayDigest }
})

// Imports must come AFTER vi.mock so the mocks are applied.
const { default: DayScreen } = await import('../../../web/src/lib/screens/DayScreen.svelte')
const { gameStore } = await import('../../../web/src/lib/sim/gameStore.svelte')

// Walk the day's first two segments so the player sits at the closing
// beat ready to End day (Segment C). Done programmatically rather than
// clicking "Run service" to avoid the 600ms BeatTransition timer.
function advanceToClosing(): void {
  gameStore.beginDay() // Segment A
  gameStore.runService() // Segment B
  gameStore.setBeat('closing')
}

describe('DayScreen — segmented day flow (Phase 97 / ISSUE-057, Phase 186 / Cluster 5)', () => {
  beforeEach(() => {
    gameStore.reset('test-seed')
    mocks.advanceDaySegment.mockImplementation((...args) =>
      mocks.realAdvanceDaySegment!(...args),
    )
    mocks.buildDailyReport.mockImplementation((...args) =>
      mocks.realBuildDailyReport!(...args),
    )
    mocks.projectYesterdayDigest.mockImplementation((...args) =>
      mocks.realProjectYesterdayDigest!(...args),
    )
  })

  afterEach(() => {
    cleanup()
  })

  it('happy path: open day, run service, End day at closing → report', async () => {
    advanceToClosing()
    expect(gameStore.segment).toBe('B')
    render(DayScreen)

    const endDayButton = await screen.findByRole('button', { name: /^end day$/i })
    await fireEvent.click(endDayButton)

    expect(gameStore.beat).toBe('report')
    expect(gameStore.segment).toBe('C')
    expect(gameStore.runError).toBeUndefined()
    // The DailyReport renders a header with "Day N closed" — match
    // loosely so we don't couple to copy.
    expect(screen.getByText(/day\s+\d+\s+closed/i)).toBeTruthy()
  })

  it('Segment C throws: banner renders, beat does NOT advance, Retry recovers', async () => {
    advanceToClosing()
    render(DayScreen)

    mocks.advanceDaySegment.mockImplementationOnce(() => {
      throw new Error('boom from test')
    })

    const endDayButton = await screen.findByRole('button', { name: /^end day$/i })
    await fireEvent.click(endDayButton)

    // Beat did not advance; the day is still mid-flight at Segment B.
    expect(gameStore.beat).toBe('closing')
    expect(gameStore.segment).toBe('B')

    // runError is pinned and the banner is visible.
    expect(gameStore.runError?.message).toBe('boom from test')
    expect(screen.getByRole('alert', { name: /end day failed/i })).toBeTruthy()
    expect(screen.getByText(/boom from test/)).toBeTruthy()

    // Retry restores the real path and advances the beat.
    const retryButton = screen.getByRole('button', { name: /^retry$/i })
    await fireEvent.click(retryButton)

    expect(gameStore.runError).toBeUndefined()
    expect(gameStore.beat).toBe('report')
    expect(gameStore.segment).toBe('C')
  })

  it('projectYesterdayDigest throws: morning beat renders the digest fallback panel', async () => {
    // Run a real full day so the morning beat has yesterday's report to digest.
    gameStore.runDay({ responseIntents: [] })
    expect(gameStore.latestResult).toBeDefined()

    // Mock the digest projection to throw on the next reactive read.
    mocks.projectYesterdayDigest.mockImplementation(() => {
      throw new Error('digest projection broke')
    })

    render(DayScreen)
    gameStore.setBeat('morning')

    // The digest-fallback section renders the error message in place
    // of the YesterdayDigest component. The rest of the morning beat
    // (At a glance, Pressures, Morning cards) stays live.
    expect(
      screen.getByRole('alert', { name: /yesterday unavailable/i }),
    ).toBeTruthy()
    expect(screen.getByText(/digest projection broke/)).toBeTruthy()
    // At-a-glance section still rendered (proof the morning beat
    // didn't unmount).
    expect(
      screen.getByRole('region', { name: /at a glance/i }) ||
        screen.getAllByLabelText(/at a glance/i)[0],
    ).toBeTruthy()
  })

  it('buildDailyReport throws: beat advances, fallback panel renders with Next day button', async () => {
    advanceToClosing()
    render(DayScreen)

    // Make the *projection* fail. Segment C still succeeds — the day
    // really did advance — but the report cannot be built.
    mocks.buildDailyReport.mockImplementation(() => {
      throw new Error('projection failed')
    })

    const endDayButton = await screen.findByRole('button', { name: /^end day$/i })
    await fireEvent.click(endDayButton)

    expect(gameStore.beat).toBe('report')
    // No run-error banner — the sim succeeded.
    expect(gameStore.runError).toBeUndefined()

    // Fallback panel renders with the error and a forward path.
    expect(screen.getByRole('region', { name: /report unavailable/i })).toBeTruthy()
    expect(screen.getByText(/projection failed/)).toBeTruthy()

    // Next day still works.
    const nextDayButton = screen.getByRole('button', { name: /^next day$/i })
    await fireEvent.click(nextDayButton)
    expect(gameStore.beat).toBe('morning')
  })
})
