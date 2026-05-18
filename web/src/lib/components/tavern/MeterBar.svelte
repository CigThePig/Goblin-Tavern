<!--
  MeterBar — small horizontal meter for tavern panels.

  Shared between AreasPanel, StockPanel, StaffPanel and their detail
  sheets. Reads pressureColor() for tint by default; callers can
  override with `mode` for inverted scales (freshness, quality, morale —
  higher is better, so tint should be calm at high values).
-->
<script lang="ts">
  import { pressureColor } from '../../design/tokens'

  let {
    label,
    value,
    max = 100,
    mode = 'pressure',
  }: {
    label?: string
    value: number
    max?: number
    /**
     * 'pressure' — higher value is bad; tint warms with risk.
     * 'wellness' — higher value is good; tint cools with comfort.
     */
    mode?: 'pressure' | 'wellness'
  } = $props()

  const pct = $derived(Math.max(0, Math.min(100, (value / max) * 100)))
  const tint = $derived(
    mode === 'wellness' ? pressureColor(100 - pct) : pressureColor(pct),
  )
</script>

<div class="meter">
  {#if label}
    <div class="head">
      <span class="label tag">{label}</span>
      <span class="value mono">{Math.round(value)}</span>
    </div>
  {/if}
  <div class="track" aria-label={label} role="progressbar" aria-valuemin="0" aria-valuemax={max} aria-valuenow={Math.round(value)}>
    <div class="fill" style="width: {pct}%; background: {tint};"></div>
  </div>
</div>

<style>
  .meter {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: var(--sp-xs);
  }

  .label {
    color: var(--text-faint);
  }

  .value {
    color: var(--text-dim);
    font-variant-numeric: tabular-nums;
  }

  .track {
    height: 4px;
    background: color-mix(in srgb, var(--ash) 25%, transparent);
    border-radius: 2px;
    overflow: hidden;
  }

  .fill {
    height: 100%;
    transition: width var(--m-fast) var(--ease);
  }
</style>
