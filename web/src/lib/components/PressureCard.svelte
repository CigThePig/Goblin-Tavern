<!--
  PressureCard — single pressure row with label, bar, value, trend.
  Reused by DailyReport "what's building" and PressuresDashboard.

  Tap-to-drill is opt-in via `onselect`. The label tap-target also
  routes through `onselect` so the whole row feels tappable on mobile.
-->
<script lang="ts">
  import Icon from './Icon.svelte'
  import { pressureColor } from '../design/tokens'
  import type { ReportPressureLine } from '../../../../src/reports/types'
  import type { PressureState } from '../../../../src/sim/state/TavernState'

  /**
   * Either a projected ReportPressureLine (from the daily report) or a
   * compact PressureState (from `state.pressures`). Both expose
   * label/value/trend; we render with the richer fields when present.
   */
  type Input =
    | (ReportPressureLine & { kind?: 'projected' })
    | (PressureState & { kind?: 'state'; previousValue?: number; severity?: number })

  let {
    pressure,
    onselect,
    interactive = true,
  }: {
    pressure: Input
    onselect?: ((id: string) => void) | undefined
    interactive?: boolean
  } = $props()

  const trendValue = $derived(asProjected(pressure)?.delta ?? (pressure as PressureState).trend ?? 0)

  function asProjected(p: Input): ReportPressureLine | undefined {
    if ((p as ReportPressureLine).delta !== undefined && (p as ReportPressureLine).trend !== undefined) {
      // distinguish projected (trend is 'rising'|'stable'|'falling') from state (trend is number)
      const t = (p as ReportPressureLine).trend
      if (t === 'rising' || t === 'stable' || t === 'falling') return p as ReportPressureLine
    }
    return undefined
  }

  function trendIconFor(t: number): 'trend-up' | 'trend-flat' | 'trend-down' {
    if (t > 0.5) return 'trend-up'
    if (t < -0.5) return 'trend-down'
    return 'trend-flat'
  }

  function fillPct(value: number): string {
    return `${Math.max(2, Math.min(100, value))}%`
  }

  function handleClick() {
    if (!interactive || !onselect) return
    onselect(pressure.id)
  }
</script>

<button
  class="row"
  type="button"
  disabled={!interactive || !onselect}
  class:tappable={interactive && !!onselect}
  onclick={handleClick}
  aria-label={`${pressure.label} pressure detail`}
>
  <span class="label">{pressure.label}</span>
  <div class="bar-track">
    <div
      class="bar-fill"
      style="width: {fillPct(pressure.value)}; background: {pressureColor(pressure.value)};"
    ></div>
  </div>
  <span class="value mono">{Math.round(pressure.value)}</span>
  <span class="trend" style="color: {pressureColor(pressure.value)};">
    <Icon name={trendIconFor(trendValue)} size={14} />
  </span>
</button>

<style>
  .row {
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) minmax(60px, 1.6fr) auto auto;
    align-items: center;
    gap: var(--sp-sm);
    padding: var(--sp-xs) var(--sp-sm);
    background: transparent;
    border-radius: var(--radius-sm);
    width: 100%;
    text-align: left;
    color: inherit;
    min-height: 36px;
    transition: background var(--m-fast) var(--ease);
  }

  .row.tappable:hover,
  .row.tappable:focus-visible {
    background: color-mix(in srgb, var(--accent) 8%, transparent);
  }

  .row:disabled {
    cursor: default;
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
    background: color-mix(in srgb, var(--text) 18%, transparent);
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
