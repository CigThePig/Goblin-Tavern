<!--
  CulturesPanel — World > Cultures list. Phase 93.

  Sorted by familiarity desc. Each row shows label, familiarity
  (wellness), comfort (wellness), tension (pressure), and a
  member-count strip.
-->
<script lang="ts">
  import MeterBar from '../tavern/MeterBar.svelte'
  import CultureDetailSheet from './CultureDetailSheet.svelte'
  import type {
    CultureRow,
    CulturesPanelData,
  } from '../../../../../src/reports/worldOverviewProjection'

  let { data }: { data: CulturesPanelData } = $props()

  let selected = $state<CultureRow | null>(null)

  function memberSummary(m: CultureRow['members']): string {
    const parts: string[] = []
    if (m.regulars > 0) parts.push(`${m.regulars} regulars`)
    if (m.suppliers > 0) parts.push(`${m.suppliers} suppliers`)
    if (m.factions > 0) parts.push(`${m.factions} factions`)
    if (m.npcs > 0) parts.push(`${m.npcs} NPCs`)
    return parts.length > 0 ? parts.join(' · ') : 'no members'
  }
</script>

<section class="panel" aria-label="Cultures">
  {#if data.rows.length === 0}
    <p class="empty">No cultures recognised yet.</p>
  {:else}
    <ul class="rows">
      {#each data.rows as row (row.id)}
        <li>
          <button class="row" type="button" onclick={() => (selected = row)}>
            <header class="head">
              <span class="name">{row.label}</span>
              <span class="chev" aria-hidden="true">›</span>
            </header>
            <p class="sub chip">{memberSummary(row.members)}</p>
            <div class="meters">
              <MeterBar
                label="familiarity"
                value={row.familiarity}
                mode="wellness"
              />
              <MeterBar label="comfort" value={row.comfort} mode="wellness" />
              <MeterBar label="tension" value={row.tension} mode="pressure" />
            </div>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<CultureDetailSheet
  culture={selected}
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
    grid-template-columns: repeat(3, 1fr);
    gap: var(--sp-xs) var(--sp-md);
  }
</style>
