<!--
  AreasPanel — the Tavern > Areas list.

  One row per AreaState. Each row shows the worst-meter adjective, four
  compact meter bars (cleanliness inverted to "dirty", damage, smell,
  risk), and the trait chips. Tap a row → detail sheet.

  Expansion Phase 2 §"Player-facing work" — each row also carries the two
  physical facts that were previously invisible: whether anything is being
  built here (and how far along), and how much of the room is out of use.
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

  /** The live build in this room, if any. One site per room at a time. */
  function building(row: AreaRow) {
    return row.upgrades.find(
      (u) => u.status === 'in_progress' || u.status === 'paused',
    )
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
            <span class="adj chip">{row.conditionAdjective}</span>
            {#if row.activeProblems.length > 0}
              <span class="problem-badge chip" aria-label="{row.activeProblems.length} active problems">
                ⚠ {row.activeProblems.length}
              </span>
            {/if}
            {#if row.blockedPercent > 0}
              <span
                class="blocked-badge chip"
                aria-label="{row.blockedPercent} percent of this room is out of use"
              >
                {row.blockedPercent}% closed
              </span>
            {/if}
            <span class="chev" aria-hidden="true">›</span>
          </header>
          <div class="single-meter">
            <MeterBar label={worst.label} value={worst.value} mode="pressure" />
          </div>
          {#if building(row)}
            {@const site = building(row)!}
            <p class="site chip">
              building {site.label} — {site.progress ?? 0}/{site.requiredProgress ?? 0} labour
              {#if site.stalledReason}· stalled{/if}
            </p>
          {/if}
          {#if row.traits.length > 0}
            <div class="traits">
              {#each row.traits as trait (trait.id)}
                <span class="trait chip">{trait.label}</span>
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

  .blocked-badge,
  .site {
    color: var(--text-warn, var(--text-dim));
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
