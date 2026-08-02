<!--
  SupplierDetailSheet — detail sheet for a single supplier.

  Phase 93. Shows identity, all four meters, goods provided with
  current tavern stock and base price, last delivery, attributions
  others hold against the supplier, and quick actions.
-->
<script lang="ts">
  import BottomSheet from '../BottomSheet.svelte'
  import MeterBar from '../tavern/MeterBar.svelte'
  import QuickActions from '../tavern/QuickActions.svelte'
  import TermLabel from '../TermLabel.svelte'
  import AttributionList from './AttributionList.svelte'
  import type { SupplierRow } from '../../../../../src/reports/worldOverviewProjection'

  let {
    supplier,
    open,
    onclose,
  }: { supplier: SupplierRow | null; open: boolean; onclose: () => void } = $props()

  const priceBiasLabel = $derived.by(() => {
    if (!supplier) return ''
    const bias = supplier.priceBias
    const formatted = bias.toFixed(2)
    if (bias > 1) return `${formatted}× (markup)`
    if (bias < 1) return `${formatted}× (discount)`
    return `${formatted}× (neutral)`
  })
</script>

<BottomSheet {open} title={supplier?.name ?? 'Supplier'} {onclose}>
  {#snippet children()}
    {#if supplier}
      <p class="lede">
        <span class="type">{supplier.supplierType.replace(/_/g, ' ')}</span>
        {#if supplier.factionLabel}
          · <span class="faction">{supplier.factionLabel}</span>
        {/if}
        {#if supplier.cultureLabel}
          · <span class="culture">{supplier.cultureLabel}</span>
        {/if}
      </p>

      <section class="block">
        <p class="block-label section-label">Meters</p>
        <div class="meters">
          <MeterBar
            label="relationship"
            value={supplier.relationship}
            mode="wellness"
          />
          <MeterBar
            label="reliability"
            value={supplier.reliability}
            mode="wellness"
          />
        </div>
        <p class="terms chip">
          <TermLabel term="relationship" /> · <TermLabel term="reliability" />
        </p>
      </section>

      <section class="block">
        <p class="block-label section-label">Terms</p>
        <dl class="kv">
          <div>
            <dt>credit</dt>
            <dd class="mono">
              {supplier.credit.status}
              {#if supplier.credit.status === 'approved'}
                · {supplier.credit.available}/{supplier.credit.limit}c free · net {supplier.credit.netTermDays}d
              {/if}
            </dd>
          </div>
          {#if supplier.credit.status !== 'approved'}
            <div>
              <dt>why</dt>
              <dd>{supplier.credit.eligibilityReason}</dd>
            </div>
          {/if}
          <div>
            <dt>deposit</dt>
            <dd class="mono">{supplier.credit.depositPercent}%</dd>
          </div>
          {#if supplier.credit.termsAdjustment !== 1}
            <div>
              <dt>negotiated</dt>
              <dd class="mono">
                ×{supplier.credit.termsAdjustment.toFixed(2)}
                {#if supplier.credit.termsAdjustmentUntilDay !== undefined}
                  · to day {supplier.credit.termsAdjustmentUntilDay}
                {/if}
              </dd>
            </div>
          {/if}
          <div>
            <dt>paid on time</dt>
            <dd class="mono">
              {supplier.credit.onTimePayments} on time · {supplier.credit.latePayments} late
            </dd>
          </div>
          <div>
            <dt>deliveries</dt>
            <dd class="mono">
              {supplier.credit.ordersDelivered} kept · {supplier.credit.ordersMissed} short or missed
            </dd>
          </div>
          <div>
            <dt>debt tolerance</dt>
            <dd class="mono">{supplier.debtTolerance}</dd>
          </div>
          <div>
            <dt>price bias</dt>
            <dd class="mono">{priceBiasLabel}</dd>
          </div>
          {#if supplier.lastDeliveryDay !== undefined}
            <div>
              <dt>last delivery</dt>
              <dd class="mono">
                day {supplier.lastDeliveryDay}
                {#if supplier.daysSinceLastDelivery !== undefined}
                  · {supplier.daysSinceLastDelivery}d ago
                {/if}
              </dd>
            </div>
          {/if}
        </dl>
        {#if supplier.refusingUntilDay !== undefined}
          <p class="warn chip">
            Not taking orders until day {supplier.refusingUntilDay}.
          </p>
        {/if}
      </section>

      {#if supplier.openOrders.length > 0}
        <section class="block">
          <p class="block-label section-label">Open orders</p>
          <ul class="orders">
            {#each supplier.openOrders as order (order.id)}
              <li class="order">
                <p class="order-head">
                  <span>{order.outstanding} {order.stockLabel}</span>
                  <span class="mono dim">
                    day {order.promisedOnDay}
                    {#if order.daysUntilDue <= 0}· due{/if}
                  </span>
                </p>
                <p class="chip dim mono">
                  {order.unitPrice}c/unit · quality {order.quality} · {order.paymentTerms}
                  {#if order.prepaid > 0}· {order.prepaid}c paid{/if}
                  {#if order.rush}· rush{/if}
                  {#if order.attempts > 0}· {order.attempts} attempt(s){/if}
                </p>
                <QuickActions
                  actions={order.applicableActions}
                  targetId={order.id}
                  targetLabel={`${order.stockLabel} order`}
                />
              </li>
            {/each}
          </ul>
        </section>
      {/if}

      {#if supplier.invoices.length > 0}
        <section class="block">
          <p class="block-label section-label">Invoices</p>
          <ul class="orders">
            {#each supplier.invoices as invoice (invoice.id)}
              <li class="order">
                <p class="order-head">
                  <span class="mono">{invoice.outstanding}c</span>
                  <span
                    class="mono"
                    class:loss={invoice.status !== 'active' &&
                      invoice.status !== 'pending'}
                  >
                    due day {invoice.dueOnDay} · {invoice.status}
                  </span>
                </p>
                {#if invoice.escalation > 0}
                  <p class="chip loss">escalation {invoice.escalation}</p>
                {/if}
              </li>
            {/each}
          </ul>
        </section>
      {/if}

      {#if supplier.goods.length > 0}
        <section class="block">
          <p class="block-label section-label">Goods provided</p>
          <ul class="goods">
            {#each supplier.goods as good (good.ingredientId)}
              <li class="good">
                <p class="good-head">
                  <span class="good-label">{good.ingredientLabel}</span>
                  <span class="good-meta mono">
                    {good.onHand} on hand · base {good.basePrice}c
                  </span>
                </p>
                {#if good.quote}
                  <p class="chip dim mono">
                    {good.quote.quantity} @ {good.quote.unitPrice}c =
                    {good.quote.totalPrice}c · day {good.quote.deliveryDay} ·
                    quality {good.quote.quality} · {good.quote.paymentTerms}
                  </p>
                  <p class="chip dim">
                    {good.quote.dueAtPlacement}c now, {good.quote
                      .invoicedOnDelivery}c on delivery
                    {#if good.quote.missChancePercent > 0}
                      · {good.quote.missChancePercent}% miss risk
                    {/if}
                  </p>
                  {#each good.quote.factors as factor (factor)}
                    <p class="chip factor">{factor}</p>
                  {/each}
                {:else if good.quoteRefusal}
                  <p class="chip warn">{good.quoteRefusal}</p>
                {/if}
                <QuickActions
                  actions={good.applicableActions}
                  targetId={`${supplier.id}:${good.ingredientId}`}
                  targetLabel={`${good.ingredientLabel} from ${supplier.name}`}
                />
              </li>
            {/each}
          </ul>
        </section>
      {/if}

      <AttributionList
        title="What others believe about them"
        rows={supplier.attributionsAgainst}
        perspective="against"
      />

      {#if supplier.activeFlags.length > 0}
        <section class="block">
          <p class="block-label section-label">Active flags</p>
          <p class="tags">{supplier.activeFlags.join(' · ')}</p>
        </section>
      {/if}

      <QuickActions
        actions={supplier.applicableActions}
        targetId={supplier.id}
        targetLabel={supplier.name}
      />
    {/if}
  {/snippet}
</BottomSheet>

<style>
  .lede {
    color: var(--text-dim);
    margin-bottom: var(--sp-md);
    text-transform: capitalize;
  }

  .block {
    display: flex;
    flex-direction: column;
    gap: var(--sp-xs);
    margin-top: var(--sp-md);
  }

  .block-label {
    color: var(--accent);
  }

  .meters {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--sp-xs) var(--sp-md);
  }

  .terms {
    color: var(--text-faint);
  }

  .kv {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .kv > div {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: var(--sp-md);
  }

  .kv dt {
    color: var(--text-faint);
    font-family: var(--font-body);
    font-variant: small-caps;
    letter-spacing: 0.06em;
    font-size: 13px;
  }

  .kv dd {
    color: var(--text);
    margin: 0;
    font-variant-numeric: tabular-nums;
  }

  .goods {
    display: flex;
    flex-direction: column;
    gap: var(--sp-xs);
  }

  .good {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: var(--sp-xs) var(--sp-sm);
    background: var(--surface-raised);
    border-radius: var(--radius-sm);
    border: var(--border-faint);
  }

  .good-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: var(--sp-sm);
  }

  .orders {
    display: flex;
    flex-direction: column;
    gap: var(--sp-xs);
  }

  .order {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: var(--sp-xs) var(--sp-sm);
    background: var(--surface-raised);
    border-radius: var(--radius-sm);
    border: var(--border-faint);
  }

  .order-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: var(--sp-sm);
  }

  .dim {
    color: var(--text-faint);
  }

  .warn {
    color: var(--warn, var(--text-dim));
  }

  .loss {
    color: var(--loss, var(--text-dim));
  }

  .factor {
    color: var(--text-faint);
  }

  .good-label {
    color: var(--text);
  }

  .good-meta {
    color: var(--text-faint);
  }

  .tags {
    color: var(--text-dim);
  }
</style>
