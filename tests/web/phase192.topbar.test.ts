// @vitest-environment jsdom
//
// Phase 192 / ISSUE-159 — TopBar stakes reframe (web).
//
// Covers the acceptance criteria:
//   - Center branches between the #1 pressure MetricLink chip and the
//     "tavern steady" fallback; no inline `Week N · Month N`.
//   - The pressure chip is a working MetricLink (opens the global
//     drilldown at `pressures.<id>`).
//   - The day-type badge appears only for a non-baseline day type.
//   - The day chip opens the calendar peek popover (full date + milestone
//     line); Escape closes it.
//   - Time-chip beat gating: hidden in report, non-interactive span in
//     morning, interactive button (requesting the picker) in plan/
//     service/closing.
//   - Welcome-back pill (Phase 96) still renders.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte'
import { tick } from 'svelte'

const { gameStore } = await import('../../web/src/lib/sim/gameStore.svelte')
const { drilldownStore } = await import(
  '../../web/src/lib/sim/drilldownStore.svelte'
)
const { default: TopBar } = await import(
  '../../web/src/lib/components/TopBar.svelte'
)

/** Plant a top pressure so the topbar surfaces it as the #1 row. */
function makeTopPressure(id: string, label: string, value = 80, trend = 1): void {
  gameStore.state.pressures[id] = {
    id,
    label,
    value,
    trend,
    tags: [],
    topCauses: [],
  }
}

/** Clear every pressure so the center falls back to "tavern steady". */
function clearPressures(): void {
  for (const id of Object.keys(gameStore.state.pressures)) {
    delete gameStore.state.pressures[id]
  }
}

beforeEach(() => {
  gameStore.reset('phase192-seed')
  clearPressures()
  gameStore.setPicks([])
  gameStore.actionPickerRequested = false
  drilldownStore.close()
  drilldownStore.path = undefined
})

afterEach(() => {
  cleanup()
})

describe('TopBar center content (Phase 192)', () => {
  it('renders the #1 pressure as a chip and drops inline Week/Month', async () => {
    makeTopPressure('food_safety', 'Food Safety', 67)
    render(TopBar)
    await tick()

    const chip = screen.getByTestId('topbar-pressure')
    expect(chip.textContent).toContain('Food Safety')
    expect(chip.textContent).toContain('67')
    // The calendar chronicle is gone from the standing header.
    expect(screen.queryByText(/Week \d+ · Month \d+/)).toBeNull()
  })

  it('shows "tavern steady" when no pressure is rising', async () => {
    clearPressures()
    render(TopBar)
    await tick()

    expect(screen.getByTestId('topbar-steady').textContent?.trim()).toBe(
      'tavern steady',
    )
    expect(screen.queryByTestId('topbar-pressure')).toBeNull()
  })

  it('surfaces only one pressure even when several are rising', async () => {
    makeTopPressure('food_safety', 'Food Safety', 80, 1)
    makeTopPressure('debt', 'Debt', 40, 1)
    render(TopBar)
    await tick()

    // Highest value wins; only one chip is ever rendered.
    expect(screen.getAllByTestId('topbar-pressure')).toHaveLength(1)
    expect(screen.getByTestId('topbar-pressure').textContent).toContain(
      'Food Safety',
    )
  })

  it('opens the pressure drilldown when the chip is tapped', async () => {
    makeTopPressure('violence', 'Violence', 70)
    render(TopBar)
    await tick()

    await fireEvent.click(screen.getByTestId('topbar-pressure'))
    expect(drilldownStore.path).toBe('pressures.violence')
    expect(drilldownStore.open).toBe(true)
  })
})

describe('TopBar day-type badge (Phase 192)', () => {
  it('omits the badge on the baseline quiet day', async () => {
    gameStore.state.calendar.dayType = 'quiet_day'
    render(TopBar)
    await tick()
    expect(screen.queryByTestId('topbar-daytype')).toBeNull()
  })

  it('shows the badge on a non-baseline day type', async () => {
    gameStore.state.calendar.dayType = 'market_day'
    render(TopBar)
    await tick()
    expect(screen.getByTestId('topbar-daytype').textContent).toContain('Market')
  })
})

describe('TopBar calendar peek (Phase 192)', () => {
  it('opens on the day chip and shows the full date + milestones', async () => {
    gameStore.state.calendar.day = 3
    gameStore.state.calendar.week = 1
    gameStore.state.calendar.month = 1
    gameStore.state.calendar.dayOfWeek = 3
    render(TopBar)
    await tick()

    expect(screen.queryByTestId('topbar-peek')).toBeNull()
    await fireEvent.click(screen.getByLabelText('Open calendar peek'))

    const peek = screen.getByTestId('topbar-peek')
    expect(peek.textContent).toContain('Day 3 · Week 1 · Month 1')
    expect(peek.textContent).toMatch(/End of week/)
    expect(peek.textContent).toMatch(/End of month/)
  })

  it('closes on Escape', async () => {
    render(TopBar)
    await tick()
    await fireEvent.click(screen.getByLabelText('Open calendar peek'))
    const peek = screen.getByTestId('topbar-peek')
    expect(peek).toBeTruthy()

    // Keydown bubbles to the document-level Escape listener.
    await fireEvent.keyDown(peek, { key: 'Escape' })
    await tick()
    expect(screen.queryByTestId('topbar-peek')).toBeNull()
  })
})

describe('TopBar time chip beat gating (Phase 192)', () => {
  it('is hidden in the report beat', async () => {
    gameStore.setBeat('report')
    render(TopBar)
    await tick()
    expect(screen.queryByTestId('topbar-time')).toBeNull()
  })

  it('is a non-interactive span in the morning beat', async () => {
    gameStore.setBeat('morning')
    render(TopBar)
    await tick()
    const chip = screen.getByTestId('topbar-time')
    expect(chip.tagName).toBe('SPAN')
  })

  it('is an interactive button that requests the picker in plan', async () => {
    gameStore.setBeat('plan')
    render(TopBar)
    await tick()
    const chip = screen.getByTestId('topbar-time')
    expect(chip.tagName).toBe('BUTTON')

    await fireEvent.click(chip)
    expect(gameStore.actionPickerRequested).toBe(true)
    expect(gameStore.route).toBe('day')
  })

  it('is interactive in service and closing beats too', async () => {
    for (const beat of ['service', 'closing'] as const) {
      gameStore.setBeat(beat)
      render(TopBar)
      await tick()
      expect(screen.getByTestId('topbar-time').tagName).toBe('BUTTON')
      cleanup()
    }
  })
})

describe('TopBar welcome-back pill (Phase 192 — preserved)', () => {
  it('renders when a save was just loaded with a known timestamp', async () => {
    gameStore.savedSnapshotJustLoaded = true
    gameStore.lastSavedAt = new Date(Date.now() - 5 * 3600_000).toISOString()
    render(TopBar)
    await tick()
    expect(screen.getByLabelText('Dismiss welcome message')).toBeTruthy()
  })
})
