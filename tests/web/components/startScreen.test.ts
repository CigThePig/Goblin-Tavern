// Phase 119 / ISSUE-058 — StartScreen smoke tests.
//
// Coverage:
// 1. Without an existing save: "Open the Tavern" button is the only CTA,
//    clicking it fires the `onstart` prop callback.
// 2. With an existing save: "Continue" button shows the day number;
//    "Start over" button also appears.
// 3. Banner copy renders when the `banner` prop is set.
// 4. Difficulty chips write through to `prefsStore.preferences.lastDifficulty`.
// 5. Advanced toggle expands/collapses (aria-expanded flips).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte'

const { default: StartScreen } = await import(
  '../../../web/src/lib/screens/StartScreen.svelte'
)
const { gameStore } = await import('../../../web/src/lib/sim/gameStore.svelte')
const { prefsStore } = await import('../../../web/src/lib/prefs/prefsStore.svelte')

describe('StartScreen — smoke (Phase 119 / ISSUE-058)', () => {
  beforeEach(() => {
    gameStore.reset('test-seed')
    prefsStore.setLastDifficulty('standard')
  })

  afterEach(() => {
    cleanup()
  })

  it('no existing save: shows Open the Tavern and fires onstart on click', async () => {
    const onstart = vi.fn()
    render(StartScreen, { props: { onstart } })
    const cta = screen.getByRole('button', { name: /open the tavern/i })
    await fireEvent.click(cta)
    expect(onstart).toHaveBeenCalledOnce()
    // Continue is absent without an existing save.
    expect(screen.queryByRole('button', { name: /^continue/i })).toBeNull()
  })

  it('with existing save: renders Continue with day number and Start over', () => {
    const existingSave = { day: 12, lastSavedAt: new Date().toISOString() }
    render(StartScreen, {
      props: {
        onstart: () => {},
        oncontinue: () => {},
        existingSave,
      },
    })
    expect(screen.getByRole('button', { name: /continue.*day 12/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /start over/i })).toBeTruthy()
  })

  it('renders banner copy when banner prop is set', () => {
    render(StartScreen, {
      props: {
        onstart: () => {},
        banner: "We couldn't read your last save. Start over to play.",
      },
    })
    expect(
      screen.getByText(/We couldn't read your last save/i),
    ).toBeTruthy()
  })

  it('advanced toggle expands and difficulty chip writes to prefsStore', async () => {
    render(StartScreen, { props: { onstart: () => {} } })
    const adv = screen.getByRole('button', { name: /advanced/i })
    expect(adv.getAttribute('aria-expanded')).toBe('false')
    await fireEvent.click(adv)
    expect(adv.getAttribute('aria-expanded')).toBe('true')

    // Difficulty chip — pick Hard.
    const hard = screen.getByRole('button', { name: /^hard$/i })
    await fireEvent.click(hard)
    expect(prefsStore.preferences.lastDifficulty).toBe('hard')
    expect(hard.getAttribute('aria-pressed')).toBe('true')
  })
})
