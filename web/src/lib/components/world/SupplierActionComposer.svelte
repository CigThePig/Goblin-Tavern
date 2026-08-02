<!--
  SupplierActionComposer — the input-capable path for Phase 6 procurement.

  The generic action picker can choose an action and a target, but supplier
  orders and payments also need quantities, delivery options, and schedule
  timing. This sheet assembles those values and still queues through
  gameStore.tryAddPick, so the shared budget and engine validator remain the
  final authority.
-->
<script lang="ts">
  import BottomSheet from '../BottomSheet.svelte'
  import { gameStore, type ComposerRequest } from '../../sim/gameStore.svelte'
  import { actionRegistry } from '../../../../../src/sim/registries/actionRegistry'
  import { quoteSupplierOrder } from '../../../../../src/sim/modules/suppliers/quote'
  import type {
    SupplierOrderRow,
    SupplierRow,
    SuppliersPanelData,
  } from '../../../../../src/reports/worldOverviewProjection'

  type SupplierComposerAction =
    | 'place_supplier_order'
    | 'amend_supplier_order'
    | 'pay_supplier_invoice'
    | 'schedule_supplier_payment'

  const SUPPLIER_COMPOSER_ACTIONS = new Set<string>([
    'place_supplier_order',
    'amend_supplier_order',
    'pay_supplier_invoice',
    'schedule_supplier_payment',
  ])

  let {
    open,
    data,
    request,
    onclose,
  }: {
    open: boolean
    data: SuppliersPanelData
    request?: ComposerRequest | undefined
    onclose: () => void
  } = $props()

  let actionId = $state<SupplierComposerAction>('place_supplier_order')
  let supplierId = $state('')
  let stockId = $state('')
  let orderId = $state('')
  let amount = $state(40)
  let inDays = $state(3)
  let onCredit = $state(false)
  let rush = $state(false)
  let allowSubstitution = $state(false)
  let split = $state(false)
  let queueError = $state<string | undefined>(undefined)
  let initializedRequest: ComposerRequest | undefined

  const stockOptions = $derived.by(() =>
    Object.values(gameStore.state.stock)
      .map((stock) => ({ id: stock.id, label: stock.label }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  )

  const amendableOrders = $derived.by(() =>
    data.rows.flatMap((supplier) =>
      supplier.openOrders
        .filter((order) =>
          order.applicableActions.some(
            (action) =>
              action.actionId === 'amend_supplier_order' &&
              action.disabledReason === undefined,
          ),
        )
        .map((order) => ({ supplier, order })),
    ),
  )

  const suppliersOwed = $derived(
    data.rows.filter((supplier) => supplier.invoices.length > 0),
  )

  const selectedSupplier = $derived(
    data.rows.find((supplier) => supplier.id === supplierId),
  )
  const selectedOrder = $derived(
    amendableOrders.find((entry) => entry.order.id === orderId),
  )
  const outstandingForSupplier = $derived(
    selectedSupplier?.invoices.reduce(
      (sum, invoice) => sum + invoice.outstanding,
      0,
    ) ?? 0,
  )

  const quote = $derived.by(() => {
    if (actionId !== 'place_supplier_order' || !supplierId || !stockId) {
      return undefined
    }
    return quoteSupplierOrder(gameStore.state, {
      supplierId,
      stockId,
      quantity: Math.max(1, Math.floor(amount)),
      onCredit,
      rush,
      allowSubstitution,
    })
  })

  const title = $derived(
    actionId === 'place_supplier_order'
      ? 'Place supplier order'
      : actionId === 'amend_supplier_order'
        ? 'Amend supplier order'
        : actionId === 'pay_supplier_invoice'
          ? 'Pay supplier invoice'
          : 'Promise supplier payment',
  )

  const canQueue = $derived.by(() => {
    if (amount <= 0 || !Number.isFinite(amount)) return false
    if (actionId === 'place_supplier_order') {
      return (
        supplierId.length > 0 &&
        stockId.length > 0 &&
        quote !== undefined &&
        quote.refusal === undefined &&
        quote.dueAtPlacement <= gameStore.state.coin
      )
    }
    if (actionId === 'amend_supplier_order') return selectedOrder !== undefined
    if (!selectedSupplier || outstandingForSupplier <= 0) return false
    if (actionId === 'pay_supplier_invoice') return gameStore.state.coin > 0
    return inDays >= 1 && inDays <= 7
  })

  function firstStockFor(supplier: SupplierRow | undefined): string {
    return supplier?.goods[0]?.ingredientId ?? stockOptions[0]?.id ?? ''
  }

  function owedTo(supplier: SupplierRow | undefined): number {
    return (
      supplier?.invoices.reduce(
        (sum, invoice) => sum + invoice.outstanding,
        0,
      ) ?? 0
    )
  }

  function initialize(next: ComposerRequest) {
    actionId = SUPPLIER_COMPOSER_ACTIONS.has(next.actionId ?? '')
      ? (next.actionId as SupplierComposerAction)
      : 'place_supplier_order'
    queueError = undefined
    onCredit = false
    rush = false
    allowSubstitution = false
    split = false
    inDays = 3

    if (actionId === 'place_supplier_order') {
      const separator = next.targetId?.indexOf(':') ?? -1
      const requestedSupplier =
        separator > 0 ? next.targetId?.slice(0, separator) : undefined
      const requestedStock =
        separator > 0 ? next.targetId?.slice(separator + 1) : undefined
      const supplier =
        data.rows.find((row) => row.id === requestedSupplier) ?? data.rows[0]
      supplierId = supplier?.id ?? ''
      stockId =
        stockOptions.some((stock) => stock.id === requestedStock)
          ? requestedStock!
          : firstStockFor(supplier)
      amount = 40
      return
    }

    if (actionId === 'amend_supplier_order') {
      const entry =
        amendableOrders.find((candidate) => candidate.order.id === next.targetId) ??
        amendableOrders[0]
      orderId = entry?.order.id ?? ''
      supplierId = entry?.supplier.id ?? ''
      amount = entry?.order.ordered ?? 1
      return
    }

    const supplier =
      suppliersOwed.find((row) => row.id === next.targetId) ?? suppliersOwed[0]
    supplierId = supplier?.id ?? ''
    const owed = Math.max(1, Math.ceil(owedTo(supplier)))
    amount =
      actionId === 'pay_supplier_invoice'
        ? Math.max(1, Math.min(gameStore.state.coin, owed))
        : owed
  }

  $effect(() => {
    if (!open || !request || request === initializedRequest) return
    initializedRequest = request
    initialize(request)
  })

  function selectSupplier(id: string) {
    supplierId = id
    if (actionId === 'place_supplier_order') {
      const supplier = data.rows.find((row) => row.id === id)
      stockId = firstStockFor(supplier)
    } else {
      const supplier = data.rows.find((row) => row.id === id)
      const owed = Math.max(1, Math.ceil(owedTo(supplier)))
      amount =
        actionId === 'pay_supplier_invoice'
          ? Math.max(1, Math.min(gameStore.state.coin, owed))
          : owed
    }
  }

  function selectOrder(id: string) {
    orderId = id
    const entry = amendableOrders.find((candidate) => candidate.order.id === id)
    supplierId = entry?.supplier.id ?? ''
    amount = entry?.order.ordered ?? 1
  }

  function orderLabel(entry: {
    supplier: SupplierRow
    order: SupplierOrderRow
  }): string {
    return `${entry.supplier.name} — ${entry.order.ordered} ${entry.order.stockLabel} (day ${entry.order.promisedOnDay})`
  }

  function queue() {
    if (!canQueue) return
    const def = actionRegistry.get(actionId)
    const targetId =
      actionId === 'place_supplier_order'
        ? `${supplierId}:${stockId}`
        : actionId === 'amend_supplier_order'
          ? orderId
          : supplierId
    const targetLabel =
      actionId === 'place_supplier_order'
        ? `${gameStore.state.stock[stockId]?.label ?? stockId} from ${selectedSupplier?.name ?? supplierId}`
        : actionId === 'amend_supplier_order'
          ? selectedOrder?.order.stockLabel ?? orderId
          : selectedSupplier?.name ?? supplierId
    const options: Record<string, unknown> | undefined =
      actionId === 'place_supplier_order'
        ? { onCredit, rush, allowSubstitution, split }
        : actionId === 'schedule_supplier_payment'
          ? { inDays: Math.floor(inDays) }
          : undefined
    const result = gameStore.tryAddPick({
      actionId,
      label: def.label,
      category: def.category,
      targetType: def.targetType,
      targetId,
      targetLabel,
      amount: Math.floor(amount),
      timeCost: def.timeCost,
      ...(options ? { options } : {}),
    })
    if (!result.ok) {
      queueError = result.reason
      return
    }
    queueError = undefined
    onclose()
  }
</script>

<BottomSheet {open} {title} {onclose}>
  {#snippet children()}
    <div data-testid="supplier-action-composer">
      {#if actionId === 'place_supplier_order'}
        <section class="block">
          <label for="supplier-order-supplier" class="block-label section-label">
            Supplier
          </label>
          <select
            id="supplier-order-supplier"
            value={supplierId}
            onchange={(event) => selectSupplier(event.currentTarget.value)}
          >
            {#each data.rows as supplier (supplier.id)}
              <option value={supplier.id}>{supplier.name}</option>
            {/each}
          </select>
        </section>

        <section class="block">
          <label for="supplier-order-stock" class="block-label section-label">
            Good
          </label>
          <select id="supplier-order-stock" bind:value={stockId}>
            {#each stockOptions as stock (stock.id)}
              <option value={stock.id}>{stock.label}</option>
            {/each}
          </select>
        </section>

        <section class="block two">
          <label for="supplier-order-quantity" class="block-label section-label">
            Quantity
          </label>
          <input
            id="supplier-order-quantity"
            type="number"
            min="1"
            step="1"
            bind:value={amount}
          />
        </section>

        <fieldset class="block checks">
          <legend class="block-label section-label">Terms and counterplay</legend>
          <label><input type="checkbox" bind:checked={onCredit} /> Use credit</label>
          <label><input type="checkbox" bind:checked={rush} /> Rush delivery</label>
          <label>
            <input type="checkbox" bind:checked={allowSubstitution} />
            Allow related or lower-grade substitutes
          </label>
          <label><input type="checkbox" bind:checked={split} /> Split across suppliers</label>
        </fieldset>

        {#if quote?.refusal}
          <p class="notice loss" role="status">{quote.refusal.reason}</p>
        {:else if quote}
          <section class="quote" aria-label="Live supplier quote">
            <p class="quote-head mono">
              {quote.quantity} × {quote.unitPrice}c = {quote.totalPrice}c
            </p>
            <p class="chip">
              day {quote.deliveryDay} (+{quote.deliveryWindowDays}d window) ·
              quality {quote.quality} · {quote.paymentTerms}
            </p>
            <p class="chip">
              {quote.dueAtPlacement}c now · {quote.invoicedOnDelivery}c on delivery ·
              {Math.round(quote.missChance * 100)}% miss risk
            </p>
            {#if quote.substitutedFor}
              <p class="notice">The supplier will ship {quote.stockLabel} instead.</p>
            {/if}
            {#if split}
              <p class="notice">Any unfilled quantity will be offered to alternative suppliers.</p>
            {/if}
          </section>
        {/if}
      {:else if actionId === 'amend_supplier_order'}
        <section class="block">
          <label for="supplier-amend-order" class="block-label section-label">
            Open order
          </label>
          <select
            id="supplier-amend-order"
            value={orderId}
            onchange={(event) => selectOrder(event.currentTarget.value)}
          >
            {#each amendableOrders as entry (entry.order.id)}
              <option value={entry.order.id}>{orderLabel(entry)}</option>
            {/each}
          </select>
        </section>
        <section class="block two">
          <label for="supplier-amend-quantity" class="block-label section-label">
            New total quantity
          </label>
          <input
            id="supplier-amend-quantity"
            type="number"
            min="1"
            step="1"
            bind:value={amount}
          />
        </section>
      {:else}
        <section class="block">
          <label for="supplier-payment-supplier" class="block-label section-label">
            Supplier
          </label>
          <select
            id="supplier-payment-supplier"
            value={supplierId}
            onchange={(event) => selectSupplier(event.currentTarget.value)}
          >
            {#each suppliersOwed as supplier (supplier.id)}
              <option value={supplier.id}>
                {supplier.name} — {Math.ceil(owedTo(supplier))}c owed
              </option>
            {/each}
          </select>
        </section>
        <section class="block two">
          <label for="supplier-payment-amount" class="block-label section-label">
            Amount
          </label>
          <input
            id="supplier-payment-amount"
            type="number"
            min="1"
            step="1"
            bind:value={amount}
          />
        </section>
        {#if actionId === 'schedule_supplier_payment'}
          <section class="block two">
            <label for="supplier-payment-days" class="block-label section-label">
              Days from now
            </label>
            <input
              id="supplier-payment-days"
              type="number"
              min="1"
              max="7"
              step="1"
              bind:value={inDays}
            />
          </section>
        {/if}
        <p class="notice chip">
          {Math.ceil(outstandingForSupplier)}c outstanding
          {#if actionId === 'pay_supplier_invoice'}· {gameStore.state.coin}c in the till{/if}
        </p>
      {/if}
    </div>
  {/snippet}

  {#snippet footer()}
    <div class="footer">
      {#if queueError}
        <p class="loss" role="alert">Couldn't queue: {queueError}</p>
      {/if}
      <button type="button" class="confirm" disabled={!canQueue} onclick={queue}>
        Queue
      </button>
    </div>
  {/snippet}
</BottomSheet>

<style>
  .block {
    display: flex;
    flex-direction: column;
    gap: var(--sp-xs);
    margin-bottom: var(--sp-md);
  }

  .block-label {
    color: var(--accent);
  }

  .two {
    display: grid;
    grid-template-columns: 1fr minmax(88px, 0.4fr);
    align-items: center;
  }

  select,
  input[type='number'] {
    width: 100%;
    min-height: 42px;
    padding: 8px 10px;
    color: var(--text);
    background: var(--surface-raised);
    border: var(--border-faint);
    border-radius: var(--radius-sm);
    font: inherit;
  }

  .checks label {
    display: flex;
    align-items: center;
    gap: var(--sp-sm);
    min-height: 36px;
    color: var(--text-dim);
  }

  .checks input {
    inline-size: 18px;
    block-size: 18px;
    accent-color: var(--accent);
  }

  .quote,
  .notice {
    padding: var(--sp-sm) var(--sp-md);
    background: var(--surface-raised);
    border: var(--border-faint);
    border-radius: var(--radius-sm);
  }

  .quote {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .quote-head {
    color: var(--accent-soft);
  }

  .notice {
    color: var(--text-dim);
  }

  .loss {
    color: var(--loss);
  }

  .footer {
    display: flex;
    flex-direction: column;
    gap: var(--sp-xs);
  }

  .confirm {
    min-height: 44px;
    padding: 12px;
    color: var(--accent);
    border: 1px solid var(--accent);
    border-radius: var(--radius-sm);
    font-family: var(--font-display);
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .confirm:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }
</style>
