<!--
  NpcsPanel — World > Notable NPCs list. Phase 93.

  Sorted by lastSeenDay desc / firstSeenDay desc. Each row shows
  display name, NPC kind, and culture / faction / group associations
  as small chips.
-->
<script lang="ts">
  import NpcDetailSheet from './NpcDetailSheet.svelte'
  import type {
    NpcRow,
    NpcsPanelData,
  } from '../../../../../src/reports/worldOverviewProjection'

  let { data }: { data: NpcsPanelData } = $props()

  let selected = $state<NpcRow | null>(null)
</script>

<section class="panel" aria-label="Notable NPCs">
  {#if data.rows.length === 0}
    <p class="empty">No notable figures have crossed paths yet.</p>
  {:else}
    <ul class="rows">
      {#each data.rows as row (row.id)}
        <li>
          <button class="row" type="button" onclick={() => (selected = row)}>
            <header class="head">
              <span class="name">{row.name}</span>
              <span class="kind chip">{row.kind.replace(/_/g, ' ')}</span>
              <span class="chev" aria-hidden="true">›</span>
            </header>
            <p class="sub chip">
              {#if row.factionLabel}{row.factionLabel}{/if}
              {#if row.factionLabel && row.cultureLabel}·{/if}
              {#if row.cultureLabel}{row.cultureLabel}{/if}
              {#if row.customerGroupLabel}
                {#if row.factionLabel || row.cultureLabel}·{/if}
                {row.customerGroupLabel}
              {/if}
            </p>
            <p class="foot chip">
              first seen day {row.firstSeenDay}
              {#if row.daysSinceLastSeen !== undefined}
                · last seen
                {row.daysSinceLastSeen === 0
                  ? 'today'
                  : `${row.daysSinceLastSeen}d ago`}
              {/if}
            </p>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<NpcDetailSheet
  npc={selected}
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
    min-height: 80px;
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

  .kind {
    color: var(--accent-soft);
    text-transform: capitalize;
  }

  .chev {
    color: var(--text-faint);
  }

  .sub {
    color: var(--text-dim);
  }

  .foot {
    color: var(--text-faint);
  }
</style>
