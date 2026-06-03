<script lang="ts">
  import Icon from './Icon.svelte'
  import MetricLink from './links/MetricLink.svelte'
  import { gameStore } from '../sim/gameStore.svelte'
  import { pressureColor } from '../design/tokens'
  import { buildPressureConsequenceLine } from '../../../../src/reports/index'
  import type { PressureState } from '../../../../src/sim/state/TavernState'

  const top = $derived.by(() => {
    const all = Object.values(gameStore.state.pressures)
    return [...all]
      .filter((p) => p.value >= 10 || p.trend !== 0)
      .sort((a, b) => b.value - a.value || Math.abs(b.trend) - Math.abs(a.trend))
      .slice(0, 3)
  })

  // Phase 191 — the sim's own "if ignored" line for any top-3 row that has
  // climbed into its (per-pressure, severity-driven) danger band. Below the
  // band the projection returns undefined and the row stays a bare bar.
  function consequenceFor(p: PressureState): string | undefined {
    return buildPressureConsequenceLine(p.id, gameStore.state)
  }

  function trendIcon(t: number): 'trend-up' | 'trend-flat' | 'trend-down' {
    if (t > 0.5) return 'trend-up'
    if (t < -0.5) return 'trend-down'
    return 'trend-flat'
  }

  function fillPct(p: PressureState): string {
    return `${Math.max(2, Math.min(100, p.value))}%`
  }
</script>

<section class="ribbon" aria-label="Top pressures">
  {#if top.length === 0}
    <p class="quiet mono">no pressures rising — the tavern holds steady</p>
  {:else}
    {#each top as p (p.id)}
      <!-- Phase 190b — the whole row opens the same `pressures.<id>`
           drilldown a PressureCard does. The grid `.row` lives inside the
           MetricLink carrier; the scoped :global rule below makes the
           carrier a full-width block so the layout is unchanged. -->
      {@const consequence = consequenceFor(p)}
      <MetricLink kind="pressure" id={p.id}>
        <div class="entry" data-danger={consequence ? 'true' : undefined}>
          <div class="row">
            <span class="label">{p.label}</span>
            <div class="bar-track">
              <div
                class="bar-fill"
                style="width: {fillPct(p)}; background: {pressureColor(p.value)};"
              ></div>
            </div>
            <span class="value mono">{Math.round(p.value)}</span>
            <span class="trend" style="color: {pressureColor(p.value)};">
              <Icon name={trendIcon(p.trend)} size={14} />
            </span>
          </div>
          {#if consequence}
            <p class="consequence" data-testid="pressure-consequence">
              {consequence}
            </p>
          {/if}
        </div>
      </MetricLink>
    {/each}
  {/if}
</section>

<style>
  .ribbon {
    background: var(--surface);
    border: var(--border-faint);
    border-radius: var(--radius-md);
    padding: var(--sp-sm) var(--sp-md);
    display: flex;
    flex-direction: column;
    gap: var(--sp-xs);
  }

  .quiet {
    color: var(--text-faint);
    font-style: italic;
    text-align: center;
    margin: var(--sp-xxs) 0;
  }

  /* Phase 190b — the MetricLink carrier wraps each row; make it a
     full-width block so the grid `.row` inside keeps its layout. The
     hover/focus underline treatment still comes from `.metric-link`. */
  .ribbon :global(.metric-link) {
    display: block;
    width: 100%;
    text-align: left;
    border-radius: var(--radius-sm);
    /* Row-level affordance is the background highlight below, not the
       inline-text dotted underline `.metric-link` uses elsewhere. */
    border-bottom: none;
  }

  .ribbon :global(.metric-link:hover),
  .ribbon :global(.metric-link:focus-visible) {
    background: color-mix(in srgb, var(--accent) 8%, transparent);
  }

  .entry {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .row {
    display: grid;
    grid-template-columns: 1fr 2fr auto auto;
    align-items: center;
    gap: var(--sp-sm);
    padding: 2px var(--sp-xs);
    border-radius: var(--radius-sm);
    transition: background var(--m-fast) var(--ease);
  }

  /* Phase 191 — the sim's "if ignored" line for a pressure that has
     entered its danger band. The line itself is the danger signal; a
     left rule in the risk palette gives it weight without a new colour
     for the bar (the bar fill already grades through rust → blood). */
  .consequence {
    margin: 0;
    padding-left: var(--sp-xs);
    border-left: 2px solid color-mix(in srgb, var(--risk) 70%, transparent);
    font-size: 12px;
    line-height: 1.35;
    color: var(--text-dim);
  }

  .entry[data-danger='true'] .label {
    color: var(--text);
  }

  .label {
    font-family: var(--font-body);
    font-size: 14px;
    color: var(--text-dim);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .bar-track {
    height: 4px;
    background: color-mix(in srgb, var(--ink-deep) 70%, var(--ash) 30%);
    border-radius: 2px;
    overflow: hidden;
  }

  .bar-fill {
    height: 100%;
    transition: width var(--m-slow) var(--ease);
    border-radius: 2px;
  }

  .value {
    color: var(--text);
    min-width: 24px;
    text-align: right;
  }

  .trend {
    display: inline-flex;
  }
</style>
