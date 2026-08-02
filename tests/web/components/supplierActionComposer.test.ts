// Expansion Phase 6 / ISSUE-176 — the supplier form assembles the payloads
// the generic action picker cannot: order quantity/counterplay, amendment
// quantity, partial payment amount, and scheduled-payment timing.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte'

import { FULL_PIPELINE } from '../../../src/sim/canonicalPipeline'
import { simulateDay } from '../../../src/sim/core/engine'
import { buildWorldOverview } from '../../../src/reports/worldOverviewProjection'
import { createInitialTavernState } from '../../../src/sim/state/defaults'
import type { TavernState } from '../../../src/sim/state/TavernState'
import { withCoin } from '../../../src/sim/testing/stateFactories'
import { listPurchaseOrders } from '../../../src/sim/modules/suppliers/state'
import SupplierActionComposer from '../../../web/src/lib/components/world/SupplierActionComposer.svelte'
import { gameStore, type ComposerRequest } from '../../../web/src/lib/sim/gameStore.svelte'

function ready(): TavernState {
  return withCoin(createInitialTavernState(), 3_000)
}

function withReliableSupplier(
  state: TavernState,
  supplierId: string,
  relationship = 95,
): TavernState {
  const supplier = state.world.suppliers[supplierId]!
  return {
    ...state,
    world: {
      ...state.world,
      suppliers: {
        ...state.world.suppliers,
        [supplierId]: { ...supplier, reliability: 100, relationship },
      },
    },
  }
}

function simulate(
  state: TavernState,
  seed: string,
  ownerActions: Array<{
    actionId: string
    targetId?: string
    amount?: number
    options?: Record<string, unknown>
  }> = [],
): TavernState {
  return simulateDay(
    state,
    { seed, ...(ownerActions.length > 0 ? { ownerActions } : {}) },
    FULL_PIPELINE,
  ).state
}

function stateWithOpenOrder(): TavernState {
  return simulate(withReliableSupplier(ready(), 'silken_road_caravan'), 'supplier-ui-order', [
    {
      actionId: 'place_supplier_order',
      targetId: 'silken_road_caravan:ingredients',
      amount: 20,
    },
  ])
}

function stateWithInvoice(): TavernState {
  let state = withReliableSupplier(ready(), 'brakka_mushroom_cart')
  state = simulate(state, 'supplier-ui-invoice-order', [
    {
      actionId: 'place_supplier_order',
      targetId: 'brakka_mushroom_cart:mushrooms',
      amount: 20,
    },
  ])
  state = simulate(state, 'supplier-ui-invoice-delivery')
  return state
}

function renderComposer(request: ComposerRequest, state: TavernState) {
  gameStore.state = state
  const onclose = vi.fn()
  render(SupplierActionComposer, {
    props: {
      open: true,
      data: buildWorldOverview(state).suppliers,
      request,
      onclose,
    },
  })
  return onclose
}

describe('SupplierActionComposer — natural player payloads', () => {
  beforeEach(() => {
    gameStore.reset('supplier-action-composer')
  })

  afterEach(() => {
    cleanup()
  })

  it('queues quantity plus rush, substitution, and split order options', async () => {
    const onclose = renderComposer(
      {
        composer: 'supplier',
        actionId: 'place_supplier_order',
        targetId: 'gildlock_brewhouse:ale',
      },
      ready(),
    )

    await fireEvent.input(screen.getByLabelText(/^quantity$/i), {
      target: { value: '12' },
    })
    await fireEvent.click(screen.getByLabelText(/rush delivery/i))
    await fireEvent.click(screen.getByLabelText(/allow related or lower-grade/i))
    await fireEvent.click(screen.getByLabelText(/split across suppliers/i))
    await fireEvent.click(screen.getByRole('button', { name: /^queue$/i }))

    expect(gameStore.picks).toHaveLength(1)
    expect(gameStore.picks[0]).toMatchObject({
      actionId: 'place_supplier_order',
      targetId: 'gildlock_brewhouse:ale',
      amount: 12,
      options: {
        onCredit: false,
        rush: true,
        allowSubstitution: true,
        split: true,
      },
    })
    expect(onclose).toHaveBeenCalledOnce()
  })

  it('queues an amended total quantity for a real open order', async () => {
    const state = stateWithOpenOrder()
    const order = listPurchaseOrders(state, { open: true })[0]!
    renderComposer(
      {
        composer: 'supplier',
        actionId: 'amend_supplier_order',
        targetId: order.id,
      },
      state,
    )

    await fireEvent.input(screen.getByLabelText(/new total quantity/i), {
      target: { value: '11' },
    })
    await fireEvent.click(screen.getByRole('button', { name: /^queue$/i }))

    expect(gameStore.picks[0]).toMatchObject({
      actionId: 'amend_supplier_order',
      targetId: order.id,
      amount: 11,
    })
  })

  it('queues a partial invoice payment amount', async () => {
    const state = stateWithInvoice()
    const supplier = buildWorldOverview(state).suppliers.rows.find(
      (row) => row.id === 'brakka_mushroom_cart',
    )!
    expect(supplier.invoices.length).toBeGreaterThan(0)
    renderComposer(
      {
        composer: 'supplier',
        actionId: 'pay_supplier_invoice',
        targetId: supplier.id,
      },
      state,
    )

    await fireEvent.input(screen.getByLabelText(/^amount$/i), {
      target: { value: '2' },
    })
    await fireEvent.click(screen.getByRole('button', { name: /^queue$/i }))

    expect(gameStore.picks[0]).toMatchObject({
      actionId: 'pay_supplier_invoice',
      targetId: supplier.id,
      amount: 2,
    })
  })

  it('queues a scheduled amount and its promised day offset', async () => {
    const state = stateWithInvoice()
    renderComposer(
      {
        composer: 'supplier',
        actionId: 'schedule_supplier_payment',
        targetId: 'brakka_mushroom_cart',
      },
      state,
    )

    await fireEvent.input(screen.getByLabelText(/^amount$/i), {
      target: { value: '3' },
    })
    await fireEvent.input(screen.getByLabelText(/days from now/i), {
      target: { value: '5' },
    })
    await fireEvent.click(screen.getByRole('button', { name: /^queue$/i }))

    expect(gameStore.picks[0]).toMatchObject({
      actionId: 'schedule_supplier_payment',
      targetId: 'brakka_mushroom_cart',
      amount: 3,
      options: { inDays: 5 },
    })
  })
})
