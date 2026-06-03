<!--
  RecentMemoryList — compact memory list used on the Regular detail
  sheet. Phase 93.

  Each row shows the memory label, its age in days, and a small
  strength meter. The list is already capped at five entries by the
  projection.
-->
<script lang="ts">
  import MeterBar from '../tavern/MeterBar.svelte'
  import type { MemoryRow } from '../../../../../src/reports/worldOverviewProjection'

  let { rows, title }: { rows: MemoryRow[]; title: string } = $props()
</script>

{#if rows.length > 0}
  <section class="block">
    <p class="block-label section-label">{title}</p>
    <ul class="list">
      {#each rows as row (row.id)}
        <li class="row">
          <header class="head">
            <span class="label">{row.label}</span>
            <span class="age chip">{row.ageDays}d</span>
          </header>
          <MeterBar label="strength" value={row.strength} mode="pressure" />
        </li>
      {/each}
    </ul>
  </section>
{/if}

<style>
  .block {
    display: flex;
    flex-direction: column;
    gap: var(--sp-xs);
    margin-top: var(--sp-md);
  }

  .block-label {
    color: var(--accent);
  }

  .list {
    display: flex;
    flex-direction: column;
    gap: var(--sp-sm);
  }

  .row {
    padding: var(--sp-xs) var(--sp-sm);
    background: var(--surface-raised);
    border-radius: var(--radius-sm);
    border: var(--border-faint);
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: var(--sp-xs);
  }

  .label {
    color: var(--text);
    font-size: 14px;
  }

  .age {
    color: var(--text-faint);
    font-variant-numeric: tabular-nums;
  }
</style>
