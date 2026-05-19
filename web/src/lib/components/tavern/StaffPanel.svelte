<!--
  StaffPanel — the Tavern > Staff roster.
-->
<script lang="ts">
  import MeterBar from './MeterBar.svelte'
  import StaffDetailSheet from './StaffDetailSheet.svelte'
  import type {
    StaffPanelData,
    StaffPanelRow,
  } from '../../../../../src/reports/tavernOverviewProjection'

  let { data }: { data: StaffPanelData } = $props()

  let selected = $state<StaffPanelRow | null>(null)

  function open(row: StaffPanelRow) {
    selected = row
  }
  function close() {
    selected = null
  }
</script>

<section class="panel" aria-label="Staff">
  <p class="summary tag">
    {data.rows.length} {data.rows.length === 1 ? 'staff member' : 'staff'}
    {#if data.unpaidCount > 0}
      · <span class="warn">{data.unpaidCount} unpaid this week</span>
    {/if}
  </p>
  {#if data.rows.length === 0}
    <p class="quiet">
      You have no staff. Hire from the World → Hireable list.
    </p>
  {:else}
    <ul class="rows">
      {#each data.rows as row (row.id)}
        <li>
          <button class="row" type="button" onclick={() => open(row)}>
            <header class="head">
              <span class="label">{row.name}</span>
              {#if row.unavailable}
                <span class="out tag">out</span>
              {/if}
              <span class="chev" aria-hidden="true">›</span>
            </header>
            <p class="role tag">
              {row.roleLabel} · skill {row.skill} · {row.wage}c/wk
              {#if row.paidThisWeek}
                · paid
              {:else}
                · <span class="unpaid">unpaid</span>
              {/if}
            </p>
            <div class="meters">
              <MeterBar label="morale" value={row.morale} mode="wellness" />
              <MeterBar label="stress" value={row.stress} mode="pressure" />
              <MeterBar label="fatigue" value={row.fatigue} mode="pressure" />
            </div>
            {#if row.currentPriorityLabel}
              <p class="priority tag">priority: {row.currentPriorityLabel}</p>
            {/if}
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<StaffDetailSheet staff={selected} open={selected !== null} onclose={close} />

<style>
  .panel {
    display: flex;
    flex-direction: column;
    gap: var(--sp-sm);
  }

  .summary {
    color: var(--text-faint);
  }

  .warn {
    color: var(--risk);
  }

  .quiet {
    color: var(--text-faint);
    font-style: italic;
    padding: var(--sp-md);
    background: var(--surface);
    border-radius: var(--radius-md);
    border: var(--border-faint);
    text-align: center;
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

  .label {
    color: var(--text);
    font-size: 16px;
  }

  .out {
    color: var(--loss);
  }

  .chev {
    color: var(--text-faint);
  }

  .role {
    color: var(--text-dim);
    text-transform: capitalize;
  }

  .unpaid {
    color: var(--loss);
  }

  .meters {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--sp-xs) var(--sp-md);
  }

  .priority {
    color: var(--accent-soft);
  }
</style>
