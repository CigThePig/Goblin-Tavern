// Phase 119+120 / ISSUE-058+059 — WorldScreen smoke tests.
//
// Coverage:
// 1. Renders with the default 'regulars' subview active; all 6 subtabs
//    present in the subnav.
// 2. Clicking subtabs updates `gameStore.worldSubview` and the active
//    aria-current flips.
// 3. ISSUE-059 — when `buildWorldOverview` throws, the screen renders
//    the "World overview unavailable" panel and the subnav remains
//    navigable.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte'

const mocks = vi.hoisted(() => ({
  buildWorldOverview: vi.fn(),
  realBuildWorldOverview: undefined as undefined | ((...args: unknown[]) => unknown),
}))

vi.mock('../../../src/reports/index', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  mocks.realBuildWorldOverview = actual['buildWorldOverview'] as (
    ...args: unknown[]
  ) => unknown
  mocks.buildWorldOverview.mockImplementation((...args) =>
    mocks.realBuildWorldOverview!(...args),
  )
  return { ...actual, buildWorldOverview: mocks.buildWorldOverview }
})

const { default: WorldScreen } = await import(
  '../../../web/src/lib/screens/WorldScreen.svelte'
)
const { gameStore } = await import('../../../web/src/lib/sim/gameStore.svelte')

describe('WorldScreen — smoke (Phase 119+120 / ISSUE-058+059)', () => {
  beforeEach(() => {
    gameStore.reset('test-seed')
    mocks.buildWorldOverview.mockImplementation((...args) =>
      mocks.realBuildWorldOverview!(...args),
    )
  })

  afterEach(() => {
    cleanup()
  })

  it('renders the 6-tab subnav with Regulars active by default', () => {
    render(WorldScreen)
    const regularsTab = screen.getByRole('button', { name: /regulars/i })
    expect(regularsTab.getAttribute('aria-current')).toBe('page')
    for (const label of ['Regulars', 'Suppliers', 'Factions', 'Cultures', 'NPCs', 'Rumours']) {
      expect(screen.getByRole('button', { name: new RegExp(label, 'i') })).toBeTruthy()
    }
  })

  it('clicking a subtab updates gameStore.worldSubview', async () => {
    render(WorldScreen)
    const factionsTab = screen.getByRole('button', { name: /factions/i })
    await fireEvent.click(factionsTab)
    expect(gameStore.worldSubview).toBe('factions')
    expect(factionsTab.getAttribute('aria-current')).toBe('page')

    const npcsTab = screen.getByRole('button', { name: /npcs/i })
    await fireEvent.click(npcsTab)
    expect(gameStore.worldSubview).toBe('npcs')
  })

  it('renders the "unavailable" panel when buildWorldOverview throws', () => {
    mocks.buildWorldOverview.mockImplementation(() => {
      throw new Error('world projection broke')
    })
    render(WorldScreen)
    expect(
      screen.getByRole('alert', { name: /world overview unavailable/i }),
    ).toBeTruthy()
    expect(screen.getByText(/world projection broke/)).toBeTruthy()
    // Subnav still rendered — error is screen-local, not App-wide.
    expect(screen.getByRole('button', { name: /suppliers/i })).toBeTruthy()
  })
})
