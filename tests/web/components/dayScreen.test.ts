// Phase 97 / ISSUE-057 — DayScreen component tests.
//
// These are the first Svelte component tests in this repo (everything
// else under `tests/web/` is data-layer). They live under
// `tests/web/components/` so vitest's `environmentMatchGlobs` config
// routes them through jsdom while the rest of the suite stays on the
// faster node default.
//
// What we're covering:
//
// 1. Happy path — fresh game, walk the beats, click End Day, assert
//    the beat advances to 'report' and the DailyReport renders.
//
// 2. `simulateDay` throws — assert the run-error banner appears with
//    the error message, beat does NOT advance, Retry clears the error.
//
// 3. `buildDailyReport` throws AFTER a successful sim — assert beat
//    advances but the fallback "Report unavailable" panel renders
//    instead of a blank screen, and Next day still works.
//
// The DayScreen → gameStore → simulateDay path is the entire end-of-day
// loop. Before ISSUE-057, any throw on that path looked exactly the
// same to the user: "the button did nothing". These tests guarantee
// the symptom is now an error message + recovery path, not silence.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte'

// Hoisted mocks so vi.mock() can reach them. `vi.hoisted` is the
// vitest 1.x escape hatch that makes the function reference available
// to the mock factory below.
const mocks = vi.hoisted(() => ({
  simulateDay: vi.fn(),
  buildDailyReport: vi.fn(),
  projectYesterdayDigest: vi.fn(),
  realSimulateDay: undefined as undefined | ((...args: unknown[]) => unknown),
  realBuildDailyReport: undefined as undefined | ((...args: unknown[]) => unknown),
  realProjectYesterdayDigest: undefined as
    | undefined
    | ((...args: unknown[]) => unknown),
}))

vi.mock('../../../src/sim/core/engine', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  mocks.realSimulateDay = actual['simulateDay'] as (...args: unknown[]) => unknown
  // Default: pass through to the real engine. Tests override via
  // mocks.simulateDay.mockImplementation(...) when they want a throw.
  mocks.simulateDay.mockImplementation((...args) => mocks.realSimulateDay!(...args))
  return { ...actual, simulateDay: mocks.simulateDay }
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

describe('DayScreen — end-of-day flow (Phase 97 / ISSUE-057)', () => {
  beforeEach(() => {
    gameStore.reset('test-seed')
    mocks.simulateDay.mockImplementation((...args) => mocks.realSimulateDay!(...args))
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

  it('happy path: walks to closing, clicks End day, beat advances to report', async () => {
    render(DayScreen)

    // Skip the picker/service beats — they're not the point of this
    // test. The engine accepts an empty intent set on any beat.
    gameStore.setBeat('closing')

    const endDayButton = await screen.findByRole('button', { name: /^end day$/i })
    await fireEvent.click(endDayButton)

    expect(gameStore.beat).toBe('report')
    expect(gameStore.runError).toBeUndefined()
    // The DailyReport renders a header with "Day N closed" — match
    // loosely so we don't couple to copy.
    expect(screen.getByText(/day\s+\d+\s+closed/i)).toBeTruthy()
  })

  it('simulateDay throws: banner renders, beat does NOT advance, Retry recovers', async () => {
    render(DayScreen)
    gameStore.setBeat('closing')

    mocks.simulateDay.mockImplementationOnce(() => {
      throw new Error('boom from test')
    })

    const endDayButton = await screen.findByRole('button', { name: /^end day$/i })
    await fireEvent.click(endDayButton)

    // Beat did not advance.
    expect(gameStore.beat).toBe('closing')

    // runError is pinned and the banner is visible.
    expect(gameStore.runError?.message).toBe('boom from test')
    expect(screen.getByRole('alert', { name: /end day failed/i })).toBeTruthy()
    expect(screen.getByText(/boom from test/)).toBeTruthy()

    // Retry restores the real path and advances the beat.
    const retryButton = screen.getByRole('button', { name: /^retry$/i })
    await fireEvent.click(retryButton)

    expect(gameStore.runError).toBeUndefined()
    expect(gameStore.beat).toBe('report')
  })

  it('projectYesterdayDigest throws: morning beat renders the digest fallback panel', async () => {
    // Run a real day so the morning beat has yesterday's report to digest.
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
    render(DayScreen)
    gameStore.setBeat('closing')

    // Make the *projection* fail. simulateDay still succeeds — the day
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
