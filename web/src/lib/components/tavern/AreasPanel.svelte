<!--
  AreasPanel — the Tavern > Areas list.

  One row per AreaState. Each row shows the worst-meter adjective, four
  compact meter bars (cleanliness inverted to "dirty", damage, smell,
  risk), and the trait chips. Tap a row → detail sheet.
-->
<script lang="ts">
  import MeterBar from './MeterBar.svelte'
  import AreaDetailSheet from './AreaDetailSheet.svelte'
  import type { AreaPanelData, AreaRow } from '../../../../../src/reports/tavernOverviewProjection'

  let { data }: { data: AreaPanelData } = $props()

  let selected = $state<AreaRow | null>(null)

  type WorstMeter = { label: 'dirty' | 'damage' | 'smell' | 'risk'; value: number }

  function worstMeter(row: AreaRow): WorstMeter {
    const candidates: WorstMeter[] = [
      { label: 'dirty', value: 100 - row.cleanliness },
      { label: 'damage', value: row.damage },
      { label: 'smell', value: row.smell },
      { label: 'risk', value: row.risk },
    ]
    return candidates.reduce((a, b) => (b.value > a.value ? b : a))
  }

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
      {@const worst = worstMeter(row)}
      <li>
        <button class="row" type="button" onclick={() => open(row)}>
          <header class="head">
            <span class="label">{row.label}</span>
            <span class="adj tag">{row.conditionAdjective}</span>
            {#if row.activeProblems.length > 0}
              <span class="problem-badge tag" aria-label="{row.activeProblems.length} active problems">
                ⚠ {row.activeProblems.length}
              </span>
            {/if}
            <span class="chev" aria-hidden="true">›</span>
          </header>
          <div class="single-meter">
            <MeterBar label={worst.label} value={worst.value} mode="pressure" />
          </div>
          {#if row.traits.length > 0}
            <div class="traits">
              {#each row.traits as trait (trait.id)}
                <span class="trait tag">{trait.label}</span>
              {/each}
            </div>
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
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--sp-xs);
  }

  .label {
    font-family: var(--font-body);
    font-size: 16px;
    color: var(--text);
    margin-right: auto;
  }

  .adj {
    color: var(--accent-soft);
  }

  .chev {
    color: var(--text-faint);
    font-size: 16px;
  }

  .single-meter {
    margin-top: 2px;
  }

  .problem-badge {
    color: var(--loss);
    background: color-mix(in srgb, var(--loss) 14%, transparent);
    padding: 2px 8px;
    border-radius: 999px;
    font-weight: 600;
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
</style>
