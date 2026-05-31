// Phase 119 / ISSUE-058 — ActionPicker smoke tests.
//
// Coverage:
// 1. Renders the action-category tabs when open; the daily time budget
//    chip displays "0m / 6h" on a fresh start (Phase 186 Cluster 3).
// 2. Tapping an action row updates gameStore.picks (either adds the
//    action immediately or — for single-target actions like patch_roof —
//    auto-adds the single valid target).
// 3. Tapping a chip removes the pick.
// 4. Switching to the Policy tab shows policy rows instead of action
//    rows.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte'

const { default: ActionPicker } = await import(
  '../../../web/src/lib/components/ActionPicker.svelte'
)
const { gameStore } = await import('../../../web/src/lib/sim/gameStore.svelte')

describe('ActionPicker — smoke (Phase 119 / ISSUE-058)', () => {
  beforeEach(() => {
    gameStore.reset('test-seed')
  })

  afterEach(() => {
    cleanup()
  })

  it('renders the category tablist with Immediate active by default', () => {
    render(ActionPicker, { props: { open: true, onclose: () => {} } })
    const tabs = screen.getAllByRole('tab')
    // 4 categories: immediate, project, policy, social.
    expect(tabs.length).toBe(4)
    const immediate = screen.getByRole('tab', { name: /immediate/i })
    expect(immediate.getAttribute('aria-selected')).toBe('true')
    // Budget chip shows 0m / 6h initially (DAY_MINUTES = 360).
    expect(screen.getByText(/0m \/ 6h/)).toBeTruthy()
  })

  it('tapping a single-target action (Buy Mugs) auto-adds the pick', async () => {
    render(ActionPicker, { props: { open: true, onclose: () => {} } })
    expect(gameStore.picks.length).toBe(0)
    // Buy Mugs targets the single `mugs` stock entry → tapAction takes
    // the `targets.length === 1` branch and adds the pick directly.
    const buyMugs = screen.getByRole('button', { name: /buy mugs/i })
    await fireEvent.click(buyMugs)
    expect(gameStore.picks.length).toBe(1)
    expect(gameStore.picks[0]!.actionId).toBe('buy_mugs')
  })

  it('tapping a queued chip removes the pick', async () => {
    render(ActionPicker, { props: { open: true, onclose: () => {} } })
    const buyMugs = screen.getByRole('button', { name: /buy mugs/i })
    await fireEvent.click(buyMugs)
    expect(gameStore.picks.length).toBe(1)
    // The chip's aria-label is "Remove Buy Mugs ..." per the template.
    const chip = screen.getByRole('button', { name: /^Remove Buy Mugs/i })
    await fireEvent.click(chip)
    expect(gameStore.picks.length).toBe(0)
  })

  it('switching to Policies tab renders policy rows instead of actions', async () => {
    render(ActionPicker, { props: { open: true, onclose: () => {} } })
    const policyTab = screen.getByRole('tab', { name: /policies/i })
    await fireEvent.click(policyTab)
    expect(policyTab.getAttribute('aria-selected')).toBe('true')
    // Policy rows render as buttons with aria-pressed (the on/off state)
    // — action rows don't. Use that to confirm the tab swap.
    const pressed = screen
      .getAllByRole('button')
      .filter((b) => b.hasAttribute('aria-pressed'))
    expect(pressed.length).toBeGreaterThan(0)
  })
})
