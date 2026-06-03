<!--
  YesterdayDigest — Phase 96.

  A compact "what closed yesterday" block surfaced on Beat 1 (morning).
  Pure presentation: reads a pre-projected `YesterdayDigestData`. Two
  lines max; the whole block is a single tap target that navigates to
  Reports → Today so the player can drill in.
-->
<script lang="ts">
  import Icon from './Icon.svelte'
  import MetricLink from './links/MetricLink.svelte'
  import type {
    YesterdayDigestData,
    YesterdayDigestDirection,
  } from '../../../../src/reports/yesterdayDigest'

  let {
    digest,
    onopen,
  }: {
    digest: YesterdayDigestData
    onopen?: () => void
  } = $props()

  function stakeIcon(d: YesterdayDigestDirection) {
    return d === 'loss' ? 'stake-loss' : d === 'gain' ? 'stake-gain' : 'stake-risk'
  }
  function stakeColor(d: YesterdayDigestDirection) {
    return d === 'loss'
      ? 'var(--loss)'
      : d === 'gain'
        ? 'var(--gain)'
        : 'var(--text-faint)'
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onopen?.()
    }
  }
</script>

<div class="digest-wrap">
  <button
    type="button"
    class="digest"
    onclick={onopen}
    onkeydown={handleKeydown}
    aria-label="Yesterday's summary — open daily report"
  >
    <span class="head tag">Yesterday · Day {digest.closedDayOrdinal}</span>
    <span class="lines">
      <span class="line">
        <span class="icon" style="color: {stakeColor(digest.coin.direction)};">
          <Icon name={stakeIcon(digest.coin.direction)} size={12} />
        </span>
        <span class="text">{digest.coin.readable}</span>
      </span>
      {#if digest.secondary}
        <span class="line">
          <span class="icon" style="color: {stakeColor(digest.secondary.direction)};">
            <Icon name={stakeIcon(digest.secondary.direction)} size={12} />
          </span>
          <span class="text">{digest.secondary.readable}</span>
        </span>
      {/if}
    </span>
  </button>

  {#if digest.watch}
    <!-- Phase 195 / ISSUE-162 — forward-looking "Today's watch" cue. Sits
         beneath the tap-through digest (so it isn't part of that button)
         and links straight to the pressure's drilldown. -->
    <p class="watch" data-testid="todays-watch">
      <span class="watch-label tag">Today's watch</span>
      <span class="watch-line">
        <span class="icon" style="color: var(--text-faint);">
          <Icon name="stake-risk" size={12} />
        </span>
        <MetricLink kind="pressure" id={digest.watch.pressureId}>
          {digest.watch.readable}
        </MetricLink>
      </span>
    </p>
  {/if}
</div>

<style>
  .digest-wrap {
    display: flex;
    flex-direction: column;
    gap: var(--sp-xs);
  }

  .digest {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: var(--sp-xs);
    width: 100%;
    background: var(--surface);
    border: var(--border-faint);
    border-left: 2px solid var(--candle-soft);
    border-radius: var(--radius-md);
    padding: var(--sp-sm) var(--sp-md);
    color: var(--text-dim);
    text-align: left;
    transition: border-color var(--m-fast) var(--ease);
  }

  .digest:hover,
  .digest:focus-visible {
    border-color: var(--accent);
    border-left-color: var(--accent);
  }

  .head {
    color: var(--accent-soft);
    letter-spacing: 0.06em;
  }

  .lines {
    display: flex;
    flex-direction: column;
    gap: var(--sp-xxs);
  }

  .line {
    display: inline-flex;
    align-items: center;
    gap: var(--sp-xs);
  }

  .icon {
    display: inline-flex;
    flex-shrink: 0;
  }

  .text {
    font-family: var(--font-body);
    font-size: 14px;
    line-height: 1.35;
    color: var(--text-dim);
  }

  /* Phase 195 — Today's watch cue. Quieter than the digest; a label + a
     single linked line. */
  .watch {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 0 var(--sp-xs);
  }

  .watch-label {
    color: var(--text-faint);
    letter-spacing: 0.06em;
  }

  .watch-line {
    display: inline-flex;
    align-items: center;
    gap: var(--sp-xs);
    font-size: 13px;
    line-height: 1.35;
    color: var(--text-dim);
  }
</style>
