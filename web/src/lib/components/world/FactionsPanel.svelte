<!--
  FactionsPanel — World > Factions list. Phase 93.

  Sorted by influence desc / relationship desc. Each row shows
  label, the deterministic relationship noun pulled from the
  faction-relations descriptor pool, and the four-meter snapshot.
-->
<script lang="ts">
  import MeterBar from '../tavern/MeterBar.svelte'
  import FactionDetailSheet from './FactionDetailSheet.svelte'
  import type {
    FactionRow,
    FactionsPanelData,
  } from '../../../../../src/reports/worldOverviewProjection'

  let { data }: { data: FactionsPanelData } = $props()

  let selected = $state<FactionRow | null>(null)
</script>

<section class="panel" aria-label="Factions">
  {#if data.rows.length === 0}
    <p class="empty">No factions in play yet.</p>
  {:else}
    <ul class="rows">
      {#each data.rows as row (row.id)}
        <li>
          <button class="row" type="button" onclick={() => (selected = row)}>
            <header class="head">
              <span class="name">{row.label}</span>
              <span class="noun adj chip">{row.relationNoun}</span>
              <span class="chev" aria-hidden="true">›</span>
            </header>
            {#if row.cultureLabel}
              <p class="sub chip">{row.cultureLabel}</p>
            {/if}
            <div class="meters">
              <MeterBar
                label="relationship"
                value={row.relationship}
                mode="wellness"
              />
              <MeterBar label="trust" value={row.trust} mode="wellness" />
              <MeterBar label="influence" value={row.influence} mode="pressure" />
              <MeterBar label="fear" value={row.fear} mode="pressure" />
            </div>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<FactionDetailSheet
  faction={selected}
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
    display: grid;
    grid-template-columns: 1fr auto auto;
    align-items: baseline;
    gap: var(--sp-xs);
  }

  .name {
    color: var(--text);
    font-size: 16px;
  }

  .noun {
    color: var(--accent-soft);
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
</style>
