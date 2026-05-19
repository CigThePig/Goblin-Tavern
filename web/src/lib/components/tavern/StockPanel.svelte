<!--
  StockPanel — the Tavern > Stock list with Supply Pipeline section.
-->
<script lang="ts">
  import MeterBar from './MeterBar.svelte'
  import StockDetailSheet from './StockDetailSheet.svelte'
  import CommissionExpeditionSheet from './CommissionExpeditionSheet.svelte'
  import TermLabel from '../TermLabel.svelte'
  import { idLabel } from '../../../../../src/reports/labels/idLabel'
  import type {
    StockPanelData,
    StockRow,
  } from '../../../../../src/reports/tavernOverviewProjection'

  let { data }: { data: StockPanelData } = $props()

  let selected = $state<StockRow | null>(null)
  let commissionOpen = $state(false)

  function open(row: StockRow) {
    selected = row
  }
  function close() {
    selected = null
  }
</script>

<section class="panel" aria-label="Stock">
  <!-- ── Inventory ─────────────────────────────────────────────── -->
  <section class="block">
    <p class="summary tag">
      {data.inventory.rows.length}
      {data.inventory.rows.length === 1 ? 'item' : 'items'}
      {#if data.inventory.lowStockCount > 0}
        · <span class="warn">{data.inventory.lowStockCount} low</span>
      {/if}
      {#if data.inventory.spoilingCount > 0}
        · <span class="warn">{data.inventory.spoilingCount} spoiling</span>
      {/if}
      {#if data.inventory.rows.length > 0 && data.inventory.lowStockCount === 0 && data.inventory.spoilingCount === 0}
        · <span class="ok">No shortages — supply is keeping up with demand.</span>
      {/if}
    </p>
    {#if data.inventory.rows.length === 0}
      <p class="quiet">Storage is quiet.</p>
    {:else}
      <ul class="rows">
        {#each data.inventory.rows as row (row.id)}
          <li>
            <button class="row" type="button" onclick={() => open(row)}>
              <header class="head">
                <span class="label">{row.label}</span>
                <span class="qty mono">×{row.quantity}</span>
                <span class="chev" aria-hidden="true">›</span>
              </header>
              <div class="meters">
                <MeterBar label="quality" value={row.quality} mode="wellness" />
                <MeterBar label="freshness" value={row.freshness} mode="wellness" />
              </div>
              <div class="meta">
                <span class="rarity tag rarity-{row.rarity}">{row.rarity}</span>
                <span class="price mono">{row.salePrice}c each</span>
                {#if row.storageAreaLabel}
                  <span class="storage tag">in {row.storageAreaLabel}</span>
                {/if}
                {#if row.isLow}<span class="warn-pill tag">low</span>{/if}
                {#if row.isSpoiling}<span class="warn-pill tag">spoiling</span>{/if}
                {#if row.isUpkeepConsumed}
                  <span class="upkeep-pill tag">
                    <TermLabel term="upkeep" label="used for upkeep" />
                  </span>
                {/if}
              </div>
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  <!-- ── Supply Pipeline ────────────────────────────────────────── -->
  <section class="block">
    <h2 class="block-label tag">Supply pipeline</h2>

    <section class="sub">
      <p class="sub-label tag">
        <TermLabel term="expedition" label="Active expeditions" />
      </p>
      {#if data.supplyPipeline.activeExpeditions.length === 0}
        <p class="quiet small">No expeditions in flight.</p>
      {:else}
        <ul class="exp-rows">
          {#each data.supplyPipeline.activeExpeditions as exp (exp.id)}
            <li class="exp">
              <header class="exp-head">
                <span class="exp-name">{exp.runnerName}</span>
                <span class="exp-mode tag">{exp.mode}</span>
              </header>
              <p class="exp-target tag">
                {#if exp.mode === 'targeted'}
                  fetching {exp.targetIngredientLabel ?? exp.targetIngredientId ?? '?'}
                {:else if exp.targetTier}
                  any {exp.targetTier} ingredient
                {:else}
                  open run
                {/if}
                · paid {exp.costPaid}c
              </p>
              <MeterBar
                label="day {exp.daysElapsed} of {exp.daysTotal}"
                value={exp.daysElapsed}
                max={exp.daysTotal}
                mode="wellness"
              />
            </li>
          {/each}
        </ul>
      {/if}
    </section>

    <section class="sub">
      <p class="sub-label tag">
        <TermLabel term="adventurer" label="Hireable adventurers" />
      </p>
      <ul class="adv-rows">
        {#each data.supplyPipeline.hireableAdventurers as adv (adv.id)}
          <li class="adv" class:busy={adv.isBusy}>
            <header class="adv-head">
              <span class="adv-name">{adv.name}</span>
              <span class="adv-status tag">
                {adv.isBusy ? 'on expedition' : 'available'}
              </span>
            </header>
            <p class="adv-stats mono">
              exp {adv.experience} · rel {adv.reliability} · friend {adv.relationship}
              · {adv.wageBase}c/day
              {#if adv.specialty}
                · {adv.specialty}
              {/if}
            </p>
          </li>
        {/each}
      </ul>
    </section>

    <button
      type="button"
      class="cta"
      disabled={!data.supplyPipeline.canCommission.eligible}
      onclick={() => (commissionOpen = true)}
    >
      Commission expedition
    </button>
    {#if !data.supplyPipeline.canCommission.eligible}
      <p class="reason">
        {data.supplyPipeline.canCommission.reason ?? 'unavailable'}
      </p>
    {/if}

    {#if data.supplyPipeline.recentCompletions.length > 0}
      <details class="recent">
        <summary class="sub-label tag">
          Recent completions ({data.supplyPipeline.recentCompletions.length})
        </summary>
        <ul class="completions">
          {#each data.supplyPipeline.recentCompletions as rec (rec.id)}
            <li class="completion outcome-{rec.outcome}">
              <header class="comp-head">
                <span class="comp-name">{rec.runnerName}</span>
                <span class="comp-outcome tag">{idLabel('expeditionOutcome', rec.outcome)}</span>
              </header>
              <p class="comp-meta tag">
                day {rec.resolvedDay}
                {#if rec.daysSinceClose > 0}
                  · {rec.daysSinceClose}d ago
                {/if}
              </p>
              {#if rec.returnedIngredients.length > 0}
                <p class="comp-haul">
                  brought back
                  {rec.returnedIngredients
                    .map((i) => `${i.quantity}× ${i.ingredientLabel}`)
                    .join(', ')}
                </p>
              {/if}
            </li>
          {/each}
        </ul>
      </details>
    {/if}
  </section>
</section>

<StockDetailSheet item={selected} open={selected !== null} onclose={close} />
<CommissionExpeditionSheet
  open={commissionOpen}
  pipeline={data.supplyPipeline}
  onclose={() => (commissionOpen = false)}
/>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    gap: var(--sp-lg);
  }

  .block {
    display: flex;
    flex-direction: column;
    gap: var(--sp-sm);
  }

  .block-label {
    color: var(--accent);
  }

  .summary {
    color: var(--text-faint);
  }

  .warn {
    color: var(--risk);
  }

  .ok {
    color: var(--text-faint);
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

  .quiet.small {
    padding: var(--sp-sm);
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
    min-height: 88px;
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
    gap: var(--sp-sm);
  }

  .label {
    color: var(--text);
    font-size: 16px;
  }

  .qty {
    color: var(--accent);
    font-size: 16px;
  }

  .chev {
    color: var(--text-faint);
  }

  .meters {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--sp-xs) var(--sp-md);
  }

  .meta {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--sp-xs);
    margin-top: 2px;
  }

  .rarity {
    padding: 2px 8px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--candle-soft) 14%, transparent);
  }

  .rarity-uncommon {
    color: var(--moss);
    background: color-mix(in srgb, var(--moss) 14%, transparent);
  }

  .rarity-rare {
    color: var(--accent);
    background: color-mix(in srgb, var(--accent) 14%, transparent);
  }

  .rarity-legendary {
    color: var(--rust);
    background: color-mix(in srgb, var(--rust) 16%, transparent);
  }

  .price {
    color: var(--text-dim);
  }

  .storage {
    color: var(--text-faint);
  }

  .warn-pill {
    color: var(--risk);
    background: color-mix(in srgb, var(--risk) 12%, transparent);
    padding: 2px 8px;
    border-radius: 999px;
  }

  .upkeep-pill {
    color: var(--text-faint);
    background: color-mix(in srgb, var(--candle-soft) 10%, transparent);
    padding: 2px 8px;
    border-radius: 999px;
    font-style: italic;
  }

  /* Supply pipeline */
  .sub {
    margin-top: var(--sp-sm);
    display: flex;
    flex-direction: column;
    gap: var(--sp-xs);
  }

  .sub-label {
    color: var(--text-dim);
  }

  .exp-rows {
    display: flex;
    flex-direction: column;
    gap: var(--sp-xs);
  }

  .exp {
    padding: var(--sp-sm) var(--sp-md);
    background: var(--surface);
    border: var(--border-faint);
    border-radius: var(--radius-md);
  }

  .exp-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--sp-xs);
  }

  .exp-name {
    color: var(--text);
    font-size: 15px;
  }

  .exp-mode {
    color: var(--text-faint);
  }

  .exp-target {
    color: var(--text-dim);
    margin: 4px 0 var(--sp-xs);
  }

  .adv-rows {
    display: flex;
    flex-direction: column;
    gap: var(--sp-xs);
  }

  .adv {
    padding: var(--sp-sm) var(--sp-md);
    background: var(--surface);
    border: var(--border-faint);
    border-radius: var(--radius-md);
  }

  .adv.busy {
    opacity: 0.6;
  }

  .adv-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--sp-xs);
  }

  .adv-name {
    color: var(--text);
  }

  .adv-status {
    color: var(--text-faint);
  }

  .adv.busy .adv-status {
    color: var(--accent-soft);
  }

  .adv-stats {
    color: var(--text-dim);
    margin-top: 2px;
  }

  .cta {
    margin-top: var(--sp-sm);
    font-family: var(--font-display);
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    font-size: 13px;
    color: var(--accent);
    border: 1px solid var(--accent);
    border-radius: var(--radius-sm);
    padding: 12px;
    min-height: 44px;
    transition: background var(--m-fast) var(--ease);
  }

  .cta:not(:disabled):hover,
  .cta:not(:disabled):focus-visible {
    background: color-mix(in srgb, var(--accent) 12%, transparent);
  }

  .cta:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .reason {
    color: var(--loss);
    font-style: italic;
    font-size: 13px;
    text-align: center;
  }

  .recent {
    margin-top: var(--sp-sm);
  }

  .recent > summary {
    cursor: pointer;
    padding: var(--sp-xs) 0;
    list-style: none;
  }

  .recent > summary::-webkit-details-marker {
    display: none;
  }

  .completions {
    display: flex;
    flex-direction: column;
    gap: var(--sp-xs);
    margin-top: var(--sp-xs);
  }

  .completion {
    padding: var(--sp-xs) var(--sp-sm);
    background: var(--surface-raised);
    border-radius: var(--radius-sm);
    border-left: 2px solid var(--accent-soft);
  }

  .outcome-success {
    border-left-color: var(--gain);
  }

  .outcome-partial {
    border-left-color: var(--accent);
  }

  .outcome-failure {
    border-left-color: var(--risk);
  }

  .outcome-runner_lost {
    border-left-color: var(--loss);
  }

  .comp-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--sp-xs);
  }

  .comp-name {
    color: var(--text);
  }

  .comp-outcome {
    color: var(--text-faint);
    text-transform: capitalize;
  }

  .comp-meta {
    color: var(--text-faint);
  }

  .comp-haul {
    color: var(--text-dim);
    font-size: 13px;
    margin-top: 2px;
  }
</style>
