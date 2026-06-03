<!--
  RumoursPanel — World > Rumours list. Phase 93.

  Sorted by strength desc / lastSpreadDay desc. Each row shows
  rumour label, accuracy badge, strength meter (pressure), and a
  small footer with first-heard / last-spread context.
-->
<script lang="ts">
  import MeterBar from '../tavern/MeterBar.svelte'
  import AccuracyBadge from './AccuracyBadge.svelte'
  import RumourDetailSheet from './RumourDetailSheet.svelte'
  import type {
    RumourRow,
    RumoursPanelData,
  } from '../../../../../src/reports/worldOverviewProjection'

  let { data }: { data: RumoursPanelData } = $props()

  let selected = $state<RumourRow | null>(null)
</script>

<section class="panel" aria-label="Rumours">
  {#if data.rows.length === 0}
    <p class="empty">No rumours circulating.</p>
  {:else}
    <ul class="rows">
      {#each data.rows as row (row.id)}
        <li>
          <button class="row" type="button" onclick={() => (selected = row)}>
            <header class="head">
              <span class="label">{row.label}</span>
              <span class="chev" aria-hidden="true">›</span>
            </header>
            <div class="meta">
              <AccuracyBadge accuracy={row.accuracy} />
              {#if row.targetLabel}
                <span class="target chip">about {row.targetLabel}</span>
              {/if}
            </div>
            <MeterBar label="strength" value={row.strength} mode="pressure" />
            <p class="foot chip">
              first heard {row.daysSinceFirstHeard}d ago
              · last spread {row.daysSinceLastSpread === 0
                ? 'today'
                : `${row.daysSinceLastSpread}d ago`}
            </p>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<RumourDetailSheet
  rumour={selected}
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

  .label {
    color: var(--text);
    font-size: 15px;
    line-height: 1.4;
  }

  .chev {
    color: var(--text-faint);
    flex-shrink: 0;
  }

  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-xs);
    align-items: baseline;
  }

  .target {
    color: var(--text-faint);
    font-style: italic;
  }

  .foot {
    color: var(--text-faint);
  }
</style>
