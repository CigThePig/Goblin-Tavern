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
        <p class="block-label tag">Meters</p>
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
        <p class="terms tag">
          <TermLabel term="relationship" /> · <TermLabel term="reliability" />
        </p>
      </section>

      <section class="block">
        <p class="block-label tag">Terms</p>
        <dl class="kv">
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
      </section>

      {#if supplier.goods.length > 0}
        <section class="block">
          <p class="block-label tag">Goods provided</p>
          <ul class="goods">
            {#each supplier.goods as good (good.ingredientId)}
              <li class="good">
                <span class="good-label">{good.ingredientLabel}</span>
                <span class="good-meta mono">
                  {good.onHand} on hand · base {good.basePrice}c
                </span>
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
          <p class="block-label tag">Active flags</p>
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
    justify-content: space-between;
    align-items: baseline;
    padding: var(--sp-xs) var(--sp-sm);
    background: var(--surface-raised);
    border-radius: var(--radius-sm);
    border: var(--border-faint);
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
