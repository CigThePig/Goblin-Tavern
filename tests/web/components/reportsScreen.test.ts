// Phase 97 / ISSUE-057 — ReportsScreen component test.
//
// Only the failure-path test lives here for now. The happy-path
// behaviour (DailyReport rendering with a real result) is covered by
// `tests/reports/dailyReportProjection.voice.test.ts` at the projection
// level. What's specific to this screen is the discriminated-union
// fallback: when a projection throws, the user sees an error panel
// instead of a blank subview.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/svelte'

const mocks = vi.hoisted(() => ({
  buildDailyReport: vi.fn(),
  realBuildDailyReport: undefined as undefined | ((...args: unknown[]) => unknown),
  realSimulateDay: undefined as undefined | ((...args: unknown[]) => unknown),
}))

vi.mock('../../../src/reports/index', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  mocks.realBuildDailyReport = actual['buildDailyReport'] as (...args: unknown[]) => unknown
  mocks.buildDailyReport.mockImplementation((...args) =>
    mocks.realBuildDailyReport!(...args),
  )
  return { ...actual, buildDailyReport: mocks.buildDailyReport }
})

vi.mock('../../../src/sim/core/engine', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  mocks.realSimulateDay = actual['simulateDay'] as (...args: unknown[]) => unknown
  return actual
})

const { default: ReportsScreen } = await import(
  '../../../web/src/lib/screens/ReportsScreen.svelte'
)
const { gameStore } = await import('../../../web/src/lib/sim/gameStore.svelte')

describe('ReportsScreen — projection failure fallback (Phase 97 / ISSUE-057)', () => {
  beforeEach(() => {
    gameStore.reset('test-seed')
    mocks.buildDailyReport.mockImplementation((...args) =>
      mocks.realBuildDailyReport!(...args),
    )
  })

  afterEach(() => {
    cleanup()
  })

  it('renders the unavailable panel when buildDailyReport throws', async () => {
    // Run one real day so `latestResult` is set — otherwise the Today
    // subview shows the empty placeholder, not the error path.
    gameStore.runDay({ responseIntents: [] })
    expect(gameStore.latestResult).toBeDefined()

    // Now make every subsequent projection throw.
    mocks.buildDailyReport.mockImplementation(() => {
      throw new Error('today projection broke')
    })

    gameStore.setReportsSubview('today')
    render(ReportsScreen)

    expect(screen.getByText(/report unavailable/i)).toBeTruthy()
    expect(screen.getByText(/today projection broke/)).toBeTruthy()
  })
})
