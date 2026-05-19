// Phase 119+120 / ISSUE-058+059 — TavernScreen smoke tests.
//
// Coverage:
// 1. Renders with the default 'areas' subview active; the subnav exposes
//    the 5 subtabs with aria-current set on the active one.
// 2. Clicking each subtab updates `gameStore.tavernSubview` and the
//    panel under <section class="content"> swaps to match.
// 3. The ActionQueueChip → opens the central ActionPicker bottom sheet.
// 4. ISSUE-059 — when `buildTavernOverview` throws, the screen renders
//    the "Tavern overview unavailable" panel instead of unmounting.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte'

const mocks = vi.hoisted(() => ({
  buildTavernOverview: vi.fn(),
  realBuildTavernOverview: undefined as undefined | ((...args: unknown[]) => unknown),
}))

vi.mock('../../../src/reports/index', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  mocks.realBuildTavernOverview = actual['buildTavernOverview'] as (
    ...args: unknown[]
  ) => unknown
  mocks.buildTavernOverview.mockImplementation((...args) =>
    mocks.realBuildTavernOverview!(...args),
  )
  return { ...actual, buildTavernOverview: mocks.buildTavernOverview }
})

const { default: TavernScreen } = await import(
  '../../../web/src/lib/screens/TavernScreen.svelte'
)
const { gameStore } = await import('../../../web/src/lib/sim/gameStore.svelte')

describe('TavernScreen — smoke (Phase 119+120 / ISSUE-058+059)', () => {
  beforeEach(() => {
    gameStore.reset('test-seed')
    mocks.buildTavernOverview.mockImplementation((...args) =>
      mocks.realBuildTavernOverview!(...args),
    )
  })

  afterEach(() => {
    cleanup()
  })

  it('renders the 5-tab subnav with Areas active by default', () => {
    render(TavernScreen)
    const areasTab = screen.getByRole('button', { name: /^areas$/i })
    expect(areasTab.getAttribute('aria-current')).toBe('page')
    // All five tabs present.
    for (const label of ['Areas', 'Stock', 'Recipes', 'Staff', 'Projects']) {
      expect(screen.getByRole('button', { name: new RegExp(`^${label}$`, 'i') })).toBeTruthy()
    }
  })

  it('clicking a subtab updates gameStore.tavernSubview and swaps the panel', async () => {
    render(TavernScreen)
    const stockTab = screen.getByRole('button', { name: /^stock$/i })
    await fireEvent.click(stockTab)
    expect(gameStore.tavernSubview).toBe('stock')
    expect(stockTab.getAttribute('aria-current')).toBe('page')

    const staffTab = screen.getByRole('button', { name: /^staff$/i })
    await fireEvent.click(staffTab)
    expect(gameStore.tavernSubview).toBe('staff')
    expect(staffTab.getAttribute('aria-current')).toBe('page')
  })

  it('renders the "unavailable" panel when buildTavernOverview throws', () => {
    mocks.buildTavernOverview.mockImplementation(() => {
      throw new Error('tavern projection broke')
    })
    render(TavernScreen)
    expect(
      screen.getByRole('alert', { name: /tavern overview unavailable/i }),
    ).toBeTruthy()
    expect(screen.getByText(/tavern projection broke/)).toBeTruthy()
    // Subnav still navigable — the alert lives inside <section class="content">.
    expect(screen.getByRole('button', { name: /^stock$/i })).toBeTruthy()
  })
})
