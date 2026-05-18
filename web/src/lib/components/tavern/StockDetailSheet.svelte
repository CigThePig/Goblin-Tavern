<!--
  StockDetailSheet — detail sheet for a stock item.
-->
<script lang="ts">
  import BottomSheet from '../BottomSheet.svelte'
  import MeterBar from './MeterBar.svelte'
  import QuickActions from './QuickActions.svelte'
  import TermLabel from '../TermLabel.svelte'
  import type { StockRow } from '../../../../../src/reports/tavernOverviewProjection'

  let {
    item,
    open,
    onclose,
  }: { item: StockRow | null; open: boolean; onclose: () => void } = $props()
</script>

<BottomSheet {open} title={item?.label ?? 'Stock'} {onclose}>
  {#snippet children()}
    {#if item}
      <div class="lede">
        <span class="rarity tag rarity-{item.rarity}">{item.rarity}</span>
        <span class="qty mono">×{item.quantity}</span>
      </div>

      <section class="block">
        <p class="block-label tag">Condition</p>
        <div class="meters">
          <MeterBar label="quality" value={item.quality} mode="wellness" />
          <MeterBar label={'freshness'} value={item.freshness} mode="wellness" />
          <MeterBar label="spoilage" value={item.spoilage} mode="pressure" />
        </div>
        <p class="terms tag">
          <TermLabel term="freshness" /> · <TermLabel term="spoilage" />
        </p>
      </section>

      <section class="block">
        <p class="block-label tag">Trade</p>
        <dl class="kv">
          <div><dt>base price</dt><dd class="mono">{item.basePrice}c</dd></div>
          <div><dt>sale price</dt><dd class="mono">{item.salePrice}c</dd></div>
          <div>
            <dt>margin</dt>
            <dd class="mono">{item.salePrice - item.basePrice}c</dd>
          </div>
        </dl>
      </section>

      {#if item.storageAreaLabel}
        <section class="block">
          <p class="block-label tag">Storage</p>
          <p class="storage">{item.storageAreaLabel}</p>
        </section>
      {/if}

      {#if item.tags.length > 0}
        <section class="block">
          <p class="block-label tag">Tags</p>
          <p class="tags">{item.tags.join(' · ')}</p>
        </section>
      {/if}

      <QuickActions
        actions={item.applicableActions}
        targetId={item.id}
        targetLabel={item.label}
      />
    {/if}
  {/snippet}
</BottomSheet>

<style>
  .lede {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--sp-sm);
    margin-bottom: var(--sp-md);
  }

  .qty {
    color: var(--accent);
    font-size: 17px;
  }

  .rarity {
    padding: 2px 8px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--candle-soft) 14%, transparent);
    text-transform: capitalize;
  }

  .rarity-uncommon {
    color: var(--moss);
    background: color-mix(in srgb, var(--moss) 14%, transparent);
  }

  .rarity-rare {
    color: var(--accent);
    background: color-mix(in srgb, var(--accent) 14%, transparent);
  }

  .rarity-legendary {
    color: var(--rust);
    background: color-mix(in srgb, var(--rust) 16%, transparent);
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
    display: flex;
    flex-direction: column;
    gap: var(--sp-xs);
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
  }

  .storage,
  .tags {
    color: var(--text-dim);
  }
</style>
