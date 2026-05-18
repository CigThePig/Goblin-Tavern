<!--
  SuppliersPanel — World > Suppliers list. Phase 93.

  Sorted by relationship desc / reliability desc. Each row shows
  display name, supplier type, relationship + reliability meters
  (wellness), and goods count.
-->
<script lang="ts">
  import MeterBar from '../tavern/MeterBar.svelte'
  import SupplierDetailSheet from './SupplierDetailSheet.svelte'
  import type {
    SupplierRow,
    SuppliersPanelData,
  } from '../../../../../src/reports/worldOverviewProjection'

  let { data }: { data: SuppliersPanelData } = $props()

  let selected = $state<SupplierRow | null>(null)
</script>

<section class="panel" aria-label="Suppliers">
  {#if data.rows.length === 0}
    <p class="empty">No suppliers yet.</p>
  {:else}
    <ul class="rows">
      {#each data.rows as row (row.id)}
        <li>
          <button class="row" type="button" onclick={() => (selected = row)}>
            <header class="head">
              <span class="name">{row.name}</span>
              <span class="chev" aria-hidden="true">›</span>
            </header>
            <p class="sub tag">
              {row.supplierType.replace(/_/g, ' ')}
              {#if row.factionLabel}· {row.factionLabel}{/if}
            </p>
            <div class="meters">
              <MeterBar
                label="relationship"
                value={row.relationship}
                mode="wellness"
              />
              <MeterBar
                label="reliability"
                value={row.reliability}
                mode="wellness"
              />
            </div>
            <p class="foot tag">
              {row.goods.length} {row.goods.length === 1 ? 'good' : 'goods'}
              {#if row.daysSinceLastDelivery !== undefined}
                · last delivered {row.daysSinceLastDelivery}d ago
              {/if}
            </p>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<SupplierDetailSheet
  supplier={selected}
  open={selected !== null}
  onclose={() => (selected = null)}
/>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    gap: var(--sp-md);
  }

  .empty {
    color: var(--text-faint);
    font-style: italic;
    text-align: center;
    padding: var(--sp-xl) var(--sp-md);
  }

  .rows {
    display: flex;
    flex-direction: column;
    gap: var(--sp-sm);
  }

  .row {
    display: flex;
    flex-direction: column;
    gap: var(--sp-xs);
    padding: var(--sp-sm) var(--sp-md);
    width: 100%;
    text-align: left;
    background: var(--surface);
    border: var(--border-faint);
    border-radius: var(--radius-md);
    min-height: 96px;
    transition: border-color var(--m-fast) var(--ease);
  }

  .row:hover,
  .row:focus-visible {
    border-color: var(--accent);
  }

  .head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: var(--sp-xs);
  }

  .name {
    color: var(--text);
    font-size: 16px;
  }

  .chev {
    color: var(--text-faint);
  }

  .sub {
    color: var(--text-dim);
    text-transform: capitalize;
  }

  .meters {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--sp-xs) var(--sp-md);
  }

  .foot {
    color: var(--text-faint);
  }
</style>
