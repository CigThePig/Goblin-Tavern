<!--
  RegularsPanel — World > Regulars list. Phase 93.

  Sorted by loyalty desc / lastSeenDay desc. Each row shows display
  name, customer group, loyalty (wellness) + irritation (pressure)
  meters, and a small footer with visit count and days since last
  seen. Tap a row → RegularDetailSheet.
-->
<script lang="ts">
  import MeterBar from '../tavern/MeterBar.svelte'
  import RegularDetailSheet from './RegularDetailSheet.svelte'
  import type {
    RegularRow,
    RegularsPanelData,
  } from '../../../../../src/reports/worldOverviewProjection'

  let { data }: { data: RegularsPanelData } = $props()

  let selected = $state<RegularRow | null>(null)
</script>

<section class="panel" aria-label="Regulars">
  {#if data.rows.length === 0}
    <p class="empty">
      No regulars yet. They emerge when customer groups return repeatedly.
    </p>
  {:else}
    <ul class="rows">
      {#each data.rows as row (row.id)}
        <li>
          <button class="row" type="button" onclick={() => (selected = row)}>
            <header class="head">
              <span class="name">{row.name}</span>
              <span class="chev" aria-hidden="true">›</span>
            </header>
            <p class="sub chip">
              {row.customerGroupLabel}
              {#if row.cultureLabel}· {row.cultureLabel}{/if}
              {#if row.factionLabel}· {row.factionLabel}{/if}
            </p>
            <div class="meters">
              <MeterBar label="loyalty" value={row.loyalty} mode="wellness" />
              <MeterBar
                label="irritation"
                value={row.irritation}
                mode="pressure"
              />
            </div>
            <p class="foot chip">
              {row.visits} {row.visits === 1 ? 'visit' : 'visits'}
              · last seen
              {row.daysSinceLastSeen === 0
                ? 'today'
                : `${row.daysSinceLastSeen}d ago`}
            </p>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<RegularDetailSheet
  regular={selected}
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
