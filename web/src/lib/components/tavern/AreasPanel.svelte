<!--
  AreasPanel — the Tavern > Areas list.

  One row per AreaState. Each row shows the worst-meter adjective, four
  compact meter bars (cleanliness inverted to "dirty", damage, smell,
  risk), and the trait chips. Tap a row → detail sheet.
-->
<script lang="ts">
  import MeterBar from './MeterBar.svelte'
  import AreaDetailSheet from './AreaDetailSheet.svelte'
  import { humanizeId } from '../../../../../src/reports/labels/idLabel'
  import type { AreaPanelData, AreaRow } from '../../../../../src/reports/tavernOverviewProjection'

  let { data }: { data: AreaPanelData } = $props()

  let selected = $state<AreaRow | null>(null)

  function open(row: AreaRow) {
    selected = row
  }
  function close() {
    selected = null
  }
</script>

<section class="panel" aria-label="Areas">
  <ul class="rows">
    {#each data.rows as row (row.id)}
      <li>
        <button class="row" type="button" onclick={() => open(row)}>
          <header class="head">
            <span class="label">{row.label}</span>
            <span class="adj tag">{row.conditionAdjective}</span>
            <span class="chev" aria-hidden="true">›</span>
          </header>
          <div class="meters">
            <MeterBar label="dirty" value={100 - row.cleanliness} mode="pressure" />
            <MeterBar label="damage" value={row.damage} mode="pressure" />
            <MeterBar label="smell" value={row.smell} mode="pressure" />
            <MeterBar label="risk" value={row.risk} mode="pressure" />
          </div>
          {#if row.traits.length > 0}
            <div class="traits">
              {#each row.traits as trait (trait.id)}
                <span class="trait tag">{trait.label}</span>
              {/each}
            </div>
          {/if}
          {#if row.activeProblems.length > 0}
            <p class="problems">
              ⚠ {row.activeProblems.map((p) => humanizeId(p)).join(', ')}
            </p>
          {/if}
        </button>
      </li>
    {/each}
  </ul>
</section>

<AreaDetailSheet area={selected} open={selected !== null} onclose={close} />

<style>
  .panel {
    display: flex;
    flex-direction: column;
    gap: var(--sp-md);
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
    transition: border-color var(--m-fast) var(--ease);
    min-height: 88px;
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
    font-family: var(--font-body);
    font-size: 16px;
    color: var(--text);
  }

  .adj {
    color: var(--accent-soft);
  }

  .chev {
    color: var(--text-faint);
    font-size: 16px;
  }

  .meters {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--sp-xs) var(--sp-md);
    margin-top: 2px;
  }

  .traits {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 4px;
  }

  .trait {
    color: var(--text-dim);
    background: color-mix(in srgb, var(--candle-soft) 14%, transparent);
    padding: 2px 8px;
    border-radius: 999px;
  }

  .problems {
    color: var(--loss);
    font-style: italic;
    font-size: 13px;
    margin-top: 2px;
  }
</style>
