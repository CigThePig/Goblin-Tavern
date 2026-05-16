<script lang="ts">
  import Icon from './Icon.svelte'
  import { gameStore } from '../sim/gameStore.svelte'
  import { pressureColor } from '../design/tokens'
  import type { PressureState } from '../../../../src/sim/state/TavernState'

  const top = $derived.by(() => {
    const all = Object.values(gameStore.state.pressures)
    return [...all]
      .filter((p) => p.value >= 10 || p.trend !== 0)
      .sort((a, b) => b.value - a.value || Math.abs(b.trend) - Math.abs(a.trend))
      .slice(0, 3)
  })

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

  .row {
    display: grid;
    grid-template-columns: 1fr 2fr auto auto;
    align-items: center;
    gap: var(--sp-sm);
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
