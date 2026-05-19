// Phase 120 / ISSUE-059 — CauseDrilldown smoke test.
//
// CauseDrilldown wraps `causesForPath` in `safeProject` so a throw
// renders a small in-sheet "Causes unavailable" panel instead of
// unmounting the reports surface through the App boundary.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/svelte'

const mocks = vi.hoisted(() => ({
  causesForPath: vi.fn(),
  realCausesForPath: undefined as undefined | ((...args: unknown[]) => unknown),
}))

vi.mock('../../../src/reports/index', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  mocks.realCausesForPath = actual['causesForPath'] as (
    ...args: unknown[]
  ) => unknown
  mocks.causesForPath.mockImplementation((...args) =>
    mocks.realCausesForPath!(...args),
  )
  return { ...actual, causesForPath: mocks.causesForPath }
})

const { default: CauseDrilldown } = await import(
  '../../../web/src/lib/components/CauseDrilldown.svelte'
)
const { gameStore } = await import('../../../web/src/lib/sim/gameStore.svelte')

describe('CauseDrilldown — projection failure (Phase 120 / ISSUE-059)', () => {
  beforeEach(() => {
    gameStore.reset('test-seed')
    mocks.causesForPath.mockImplementation((...args) =>
      mocks.realCausesForPath!(...args),
    )
  })

  afterEach(() => {
    cleanup()
  })

  it('renders the Causes unavailable panel when causesForPath throws', () => {
    mocks.causesForPath.mockImplementation(() => {
      throw new Error('cause lookup broke')
    })
    render(CauseDrilldown, {
      props: {
        open: true,
        path: 'pressures.crowd_pressure',
        onclose: () => {},
      },
    })
    expect(screen.getByText(/causes unavailable/i)).toBeTruthy()
    expect(screen.getByText(/cause lookup broke/)).toBeTruthy()
  })

  it('falls through to the empty placeholder when no path is selected', () => {
    render(CauseDrilldown, {
      props: { open: true, path: undefined, onclose: () => {} },
    })
    expect(screen.getByText(/no path selected/i)).toBeTruthy()
  })
})
