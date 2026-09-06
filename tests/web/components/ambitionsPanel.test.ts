import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/svelte'
import TavernScreen from '../../../web/src/lib/screens/TavernScreen.svelte'
import { gameStore } from '../../../web/src/lib/sim/gameStore.svelte'

describe('Ambitions management', () => {
  beforeEach(() => { gameStore.reset('ambitions-ui'); gameStore.beginDay(); gameStore.setTavernSubview('ambitions') })
  afterEach(cleanup)
  it('can find a real opening, queue it, remove it, and disclose later paths', async () => {
    render(TavernScreen)
    expect(screen.getByRole('button', { name: 'Ambitions' }).getAttribute('aria-current')).toBe('page')
    const licence = screen.getByRole('article', { name: 'Acquire a liquor licence' })
    await fireEvent.click(within(licence).getByRole('button', { name: 'Take it up · 30 min' }))
    expect(gameStore.picks.some(p => p.actionId === 'start_venture')).toBe(true)
    expect(screen.getByRole('status').textContent).toContain('today')
    await fireEvent.click(within(licence).getByRole('button', { name: 'Queued · remove' }))
    expect(gameStore.picks).toHaveLength(0)
    await fireEvent.click(screen.getByRole('button', { name: /show other paths/i }))
    expect(screen.getByText('A standing supplier compact')).toBeTruthy()
  })
  it('shows real work costs and keeps abandonment behind a deliberate confirmation', async () => {
    gameStore.tryAddPick({ actionId: 'start_venture', targetId: 'venture_liquor_license', targetType: 'composite', label: 'Licence', category: 'project', timeCost: 30 })
    gameStore.runService()
    gameStore.endDay()
    gameStore.setBeat('morning')
    gameStore.beginDay()
    render(TavernScreen)
    const licence = screen.getByRole('article', { name: 'Acquire a liquor licence' })
    expect(within(licence).getByRole('progressbar').getAttribute('max')).toBe('2')
    await fireEvent.click(within(licence).getByText('End this ambition'))
    const abandon = within(licence).getByRole('button', { name: 'Abandon this ambition' })
    await fireEvent.click(abandon)
    expect(gameStore.picks.some(p => p.actionId === 'abandon_venture')).toBe(false)
    await fireEvent.click(within(licence).getByRole('button', { name: 'Confirm abandonment' }))
    expect(gameStore.picks.some(p => p.actionId === 'abandon_venture')).toBe(true)
  })
})
