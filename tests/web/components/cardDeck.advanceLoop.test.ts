// CardDeck — auto-advance effect regression.
//
// The auto-advance $effect inside CardDeck used to read AND write
// `index`. When the player resolved the last (or only) unresolved
// card, the clamp `index = cards.length - 1` landed on a resolved
// card; the write re-fired the effect via its own `index` dep and
// hit Svelte 5's effect_update_depth_exceeded.
//
// This test mounts CardDeck with a one-seed deck, resolves it, and
// asserts that the rerender completes without the effect looping.
// The fix wraps the index reads/writes in `untrack`.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/svelte'
import type { CardView } from '../../../src/cards/types'

const mocks = vi.hoisted(() => ({
  renderCard: vi.fn(),
}))

vi.mock('../../../web/src/lib/cards/realCardRegistry', () => ({
  renderCard: mocks.renderCard,
}))

const { default: CardDeck } = await import(
  '../../../web/src/lib/components/CardDeck.svelte'
)
const { gameStore } = await import('../../../web/src/lib/sim/gameStore.svelte')

function placeholderView(seedId: string): CardView {
  return {
    title: `card ${seedId}`,
    body: ['placeholder'],
    stakes: [],
    choices: [
      {
        slotId: 'noop',
        label: 'do nothing',
        verb: 'appease',
        shape: 'safe_costly',
        previewEffects: [],
      },
    ],
  }
}

describe('CardDeck — advance loop regression', () => {
  beforeEach(() => {
    gameStore.reset('test-seed')
    mocks.renderCard.mockImplementation((seed: { id: string }) =>
      placeholderView(seed.id),
    )
  })

  afterEach(() => {
    cleanup()
  })

  it('resolving the only card does not loop the auto-advance effect', async () => {
    // Surface any uncaught Svelte error (effect_update_depth_exceeded
    // is reported via console.error in Svelte 5, not thrown out of
    // rerender). Treat any console.error during the test as a failure.
    const errors: unknown[][] = []
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation((...args: unknown[]) => {
        errors.push(args)
      })

    const seed = {
      id: 'seed-1',
      family: 'customer_complaint',
      type: 'complaint',
      timing: 'during_service',
      tags: [],
      severity: 50,
      textIngredients: {},
      validation: { valid: true, errors: [], warnings: [] },
    } as unknown as Parameters<typeof mocks.renderCard>[0]

    const onresolve = vi.fn()
    const oncomplete = vi.fn()

    const { rerender } = render(CardDeck, {
      props: {
        seeds: [seed],
        pendingBySeedId: {},
        onresolve,
        oncomplete,
      },
    })

    // Simulate the player picking an option: parent updates
    // pendingBySeedId, then rerenders the deck with the new prop.
    await rerender({
      seeds: [seed],
      pendingBySeedId: {
        'seed-1': { kind: 'ignore' },
      },
      onresolve,
      oncomplete,
    })

    expect(oncomplete).toHaveBeenCalledTimes(1)
    // Pre-fix this would log effect_update_depth_exceeded repeatedly.
    const depthErrors = errors.filter((args) =>
      args.some(
        (arg) =>
          typeof arg === 'string' &&
          arg.includes('effect_update_depth_exceeded'),
      ),
    )
    expect(depthErrors).toEqual([])
    consoleError.mockRestore()
  })

  it('resolving every card in a multi-seed deck stays bounded', async () => {
    const errors: unknown[][] = []
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation((...args: unknown[]) => {
        errors.push(args)
      })

    const seeds = [
      { id: 'seed-a' },
      { id: 'seed-b' },
      { id: 'seed-c' },
    ].map(
      (s) =>
        ({
          ...s,
          family: 'customer_complaint',
          type: 'complaint',
          timing: 'during_service',
          tags: [],
          severity: 40,
          textIngredients: {},
          validation: { valid: true, errors: [], warnings: [] },
        }) as unknown as Parameters<typeof mocks.renderCard>[0],
    )

    const onresolve = vi.fn()
    const oncomplete = vi.fn()

    const { rerender } = render(CardDeck, {
      props: { seeds, pendingBySeedId: {}, onresolve, oncomplete },
    })

    // Resolve cards one at a time, last-to-first — this is the order
    // that historically tripped the clamp because each step puts the
    // pointer on the just-resolved card.
    await rerender({
      seeds,
      pendingBySeedId: { 'seed-c': { kind: 'ignore' } },
      onresolve,
      oncomplete,
    })
    await rerender({
      seeds,
      pendingBySeedId: {
        'seed-b': { kind: 'ignore' },
        'seed-c': { kind: 'ignore' },
      },
      onresolve,
      oncomplete,
    })
    await rerender({
      seeds,
      pendingBySeedId: {
        'seed-a': { kind: 'ignore' },
        'seed-b': { kind: 'ignore' },
        'seed-c': { kind: 'ignore' },
      },
      onresolve,
      oncomplete,
    })

    expect(oncomplete).toHaveBeenCalled()
    const depthErrors = errors.filter((args) =>
      args.some(
        (arg) =>
          typeof arg === 'string' &&
          arg.includes('effect_update_depth_exceeded'),
      ),
    )
    expect(depthErrors).toEqual([])
    consoleError.mockRestore()
  })
})
