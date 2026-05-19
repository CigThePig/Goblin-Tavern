// Phase 119+120 / ISSUE-058+059 — CommissionExpeditionSheet smoke tests.
//
// Coverage:
// 1. Renders the four step sections (runner / mode / target / duration)
//    with the Queue button initially disabled (no runner picked).
// 2. Picking a runner + open mode + a duration enables the Queue button
//    and surfaces a live cost preview.
// 3. ISSUE-059 — when the stockRegistry read throws, the targeted mode
//    block shows an inline aria-live note with the error message
//    instead of an empty ingredient list.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte'

const mocks = vi.hoisted(() => ({
  stockRegistryAll: vi.fn(),
  realStockRegistryAll: undefined as undefined | ((...args: unknown[]) => unknown),
}))

vi.mock('../../../src/sim/registries/stockRegistry', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  const real = actual['stockRegistry'] as { all: (...args: unknown[]) => unknown }
  mocks.realStockRegistryAll = real.all.bind(real)
  mocks.stockRegistryAll.mockImplementation((...args) =>
    mocks.realStockRegistryAll!(...args),
  )
  return {
    ...actual,
    stockRegistry: { ...real, all: mocks.stockRegistryAll },
  }
})

const { default: CommissionExpeditionSheet } = await import(
  '../../../web/src/lib/components/tavern/CommissionExpeditionSheet.svelte'
)
const { gameStore } = await import('../../../web/src/lib/sim/gameStore.svelte')

const FIXTURE_RUNNER = {
  id: 'adv1',
  name: 'Lurka',
  wageBase: 3,
  experience: 5,
  reliability: 60,
  relationship: 0,
  specialty: undefined,
  isBusy: false,
} as const

const EMPTY_PIPELINE = {
  activeExpeditions: [],
  hireableAdventurers: [FIXTURE_RUNNER],
  recentCompletions: [],
  canCommission: { eligible: true, reason: undefined },
} as const

describe('CommissionExpeditionSheet — smoke (Phase 119+120 / ISSUE-058+059)', () => {
  beforeEach(() => {
    gameStore.reset('test-seed')
    mocks.stockRegistryAll.mockImplementation((...args) =>
      mocks.realStockRegistryAll!(...args),
    )
  })

  afterEach(() => {
    cleanup()
  })

  it('Queue button is disabled until a runner is picked', () => {
    render(CommissionExpeditionSheet, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      props: { open: true, pipeline: EMPTY_PIPELINE as any, onclose: () => {} },
    })
    const queue = screen.getByRole('button', { name: /^queue$/i })
    expect(queue.hasAttribute('disabled')).toBe(true)
    // The 'reason' tag should explain why.
    expect(screen.getByText(/pick an adventurer/i)).toBeTruthy()
  })

  it('picking a runner enables the Queue button and shows cost preview', async () => {
    render(CommissionExpeditionSheet, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      props: { open: true, pipeline: EMPTY_PIPELINE as any, onclose: () => {} },
    })
    const runnerBtn = screen.getByRole('button', { name: /lurka/i })
    await fireEvent.click(runnerBtn)
    // Open mode is the default → cost preview appears + Queue enables.
    expect(screen.getByText(/cost:\s*15c/i)).toBeTruthy() // wage 3 × default 5 days
    const queue = screen.getByRole('button', { name: /^queue$/i })
    expect(queue.hasAttribute('disabled')).toBe(false)
  })

  it('stockRegistry throw renders an inline note in the targeted-mode catalog', async () => {
    mocks.stockRegistryAll.mockImplementation(() => {
      throw new Error('catalog projection broke')
    })
    render(CommissionExpeditionSheet, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      props: { open: true, pipeline: EMPTY_PIPELINE as any, onclose: () => {} },
    })
    // Switch to targeted mode so the catalog block renders.
    const targetedBtn = screen.getByRole('button', { name: /^targeted$/i })
    await fireEvent.click(targetedBtn)
    expect(screen.getByText(/couldn't load the ingredient catalog/i)).toBeTruthy()
    expect(screen.getByText(/catalog projection broke/)).toBeTruthy()
  })
})
