<!--
  DailyReport — the Beat 5 / Reports → Today renderer.

  Shape locked by `docs/plans/game-loop-and-ux.md §3.6` and the locked
  decisions in `docs/plans/phase-89-reports-layer.md`. The component
  itself is pure presentation: it never reads simulation state outside
  the projected `DailyReportData` it receives.

  Cause and pressure drilldowns are owned by this component because
  they share state (one bottom sheet, swapped path).
-->
<script lang="ts">
  import CauseDrilldown from './CauseDrilldown.svelte'
  import MissedOpportunities from './MissedOpportunities.svelte'
  import PressureCard from './PressureCard.svelte'
  import TermLabel from './TermLabel.svelte'
  import { gameStore } from '../sim/gameStore.svelte'
  import type {
    DailyReportData,
    ReportDiffLine,
    ReportReputationDelta,
    ReportResolvedIntent,
  } from '../../../../src/reports/types'

  let {
    report,
  }: {
    report: DailyReportData
  } = $props()

  function dismissMissedOpportunity(id: string) {
    gameStore.dismissMissedOpportunity(id)
  }

  let drilldownPath = $state<string | undefined>(undefined)
  let drilldownOpen = $state(false)

  function openDiffDrilldown(line: ReportDiffLine) {
    drilldownPath = line.path
    drilldownOpen = true
  }

  function openPressureDrilldown(id: string) {
    drilldownPath = `pressures.${id}`
    drilldownOpen = true
  }

  function closeDrilldown() {
    drilldownOpen = false
  }

  function signed(n: number): string {
    if (n > 0) return `+${n}`
    if (n < 0) return `${n}`
    return '·'
  }

  function repDirection(d: ReportReputationDelta): 'gain' | 'loss' | 'neutral' {
    if (d.delta > 0) return 'gain'
    if (d.delta < 0) return 'loss'
    return 'neutral'
  }

  function diffMark(d: ReportDiffLine): string {
    if (d.direction === 'gain') return '+'
    if (d.direction === 'loss') return '−'
    return '·'
  }

  function verbReadable(intent: ReportResolvedIntent): string {
    return `${intent.verb} · ${intent.subject}`
  }
</script>

<section class="report" aria-label="Daily report">
  <!-- ── Header ────────────────────────────────────────────────── -->
  <header class="block header">
    <p class="tag block-label">{report.header.dayLabel}</p>
    <p class="head-line display">
      Day {report.header.closedDayOrdinal} closed
    </p>
    {#if report.header.headerVoice}
      <p class="head-voice">{report.header.headerVoice}</p>
    {/if}
    <div class="head-stats">
      <span class="stat">
        <span class="stat-label tag">Coin</span>
        <span class="stat-value mono">
          {report.coinBefore} → {report.coinAfter}
          <span class="stat-delta" data-dir={report.coinDelta > 0 ? 'gain' : report.coinDelta < 0 ? 'loss' : 'neutral'}>
            ({signed(report.coinDelta)})
          </span>
        </span>
      </span>
      {#if report.reputationDeltas.length > 0}
        <div class="rep-strip">
          {#each report.reputationDeltas.slice(0, 4) as d (d.axis)}
            <span class="rep-pill" data-dir={repDirection(d)}>
              {signed(d.delta)} <TermLabel term={d.axis} label={d.label.toLowerCase()} />
            </span>
          {/each}
        </div>
      {/if}
    </div>
  </header>

  <!-- ── Weekly digest (boundary days only) ─────────────────────── -->
  {#if report.weeklyDigest}
    <section class="block">
      <h2 class="block-label tag">Week digest</h2>
      <details class="digest">
        <summary class="digest-summary">{report.weeklyDigest.title}</summary>
        <pre class="digest-body mono">{report.weeklyDigest.lines.join('\n')}</pre>
      </details>
    </section>
  {/if}

  <!-- ── Monthly digest (boundary days only) ────────────────────── -->
  {#if report.monthlyDigest}
    <section class="block">
      <h2 class="block-label tag">Month digest</h2>
      <details class="digest">
        <summary class="digest-summary">{report.monthlyDigest.title}</summary>
        <pre class="digest-body mono">{report.monthlyDigest.lines.join('\n')}</pre>
      </details>
    </section>
  {/if}

  <!-- ── Significant changes ────────────────────────────────────── -->
  {#if report.topDiffs.length > 0}
    <section class="block">
      <h2 class="block-label tag">Significant changes</h2>
      <ul class="diff-list">
        {#each report.topDiffs as d (d.path)}
          <li>
            <button class="diff-row" type="button" onclick={() => openDiffDrilldown(d)}>
              <span class="diff-mark" data-dir={d.direction}>{diffMark(d)}</span>
              <span class="diff-text">{d.readable}</span>
              <span class="diff-chevron tag">↗</span>
            </button>
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  <!-- ── What happened ──────────────────────────────────────────── -->
  {#if report.ownerActionsApplied.length > 0 || report.resolvedIntents.length > 0 || report.serviceLines.length > 0}
    <section class="block">
      <h2 class="block-label tag">What happened</h2>
      <ul class="ledger">
        {#each report.ownerActionsApplied as a (a.actionId + '-' + (a.targetId ?? ''))}
          <li class="ledger-row">
            <span class="ledger-mark accent">★</span>
            <div class="ledger-body">
              <span class="ledger-line">
                {a.label}{#if a.targetId} · {a.targetId}{/if}
                <span class="ledger-cost tag">({a.actionPointCost} pt)</span>
              </span>
              {#if a.effects.length > 0}
                <span class="ledger-sub tag">{a.effects.slice(0, 2).join(' · ')}</span>
              {/if}
            </div>
          </li>
        {/each}
        {#each report.resolvedIntents as r (r.intentId)}
          <li class="ledger-row">
            <span class="ledger-mark">→</span>
            <div class="ledger-body">
              <span class="ledger-line">you chose: {verbReadable(r)}</span>
            </div>
          </li>
        {/each}
        {#each report.serviceLines as s, i (i)}
          <li class="ledger-row">
            <span class="ledger-mark dim">·</span>
            <div class="ledger-body">
              <span class="ledger-line dim">{s.readable}</span>
            </div>
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  <!-- ── What you could have done (Phase 97) ───────────────────── -->
  {#if report.missedOpportunities && report.missedOpportunities.length > 0}
    <MissedOpportunities
      opportunities={report.missedOpportunities}
      ondismiss={dismissMissedOpportunity}
    />
  {/if}

  <!-- ── What's building ────────────────────────────────────────── -->
  {#if report.risingPressures.length > 0}
    <section class="block">
      <h2 class="block-label tag">What's building</h2>
      <div class="pressures">
        {#each report.risingPressures as p (p.id)}
          <PressureCard pressure={p} onselect={openPressureDrilldown} />
        {/each}
      </div>
    </section>
  {/if}

  <!-- ── What might happen ──────────────────────────────────────── -->
  {#if report.futureHooks.length > 0}
    <section class="block hooks">
      <h2 class="block-label tag">What might happen</h2>
      <ul class="hook-list">
        {#each report.futureHooks as h (h.memoryId)}
          <li class="hook">
            <span class="hook-mark"><TermLabel term="future_hook" label="◇" /></span>
            <span class="hook-text">{h.readable}</span>
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  {#if report.isQuiet}
    <section class="block">
      <p class="quiet">{report.quietLine ?? 'a quiet day. nothing crossed a threshold.'}</p>
    </section>
  {/if}
</section>

<CauseDrilldown open={drilldownOpen} path={drilldownPath} onclose={closeDrilldown} />

<style>
  .report {
    display: flex;
    flex-direction: column;
    gap: var(--sp-lg);
  }

  .block {
    display: flex;
    flex-direction: column;
    gap: var(--sp-xs);
  }

  .block-label {
    color: var(--accent);
    margin-bottom: 2px;
  }

  .header {
    gap: var(--sp-sm);
  }

  .head-line {
    font-size: 22px;
    letter-spacing: 0.08em;
    color: var(--text);
  }

  .head-voice {
    color: var(--text-dim);
    font-style: italic;
    font-size: 14px;
    line-height: 1.4;
    margin-top: -2px;
  }

  .head-stats {
    display: flex;
    flex-direction: column;
    gap: var(--sp-xs);
  }

  .stat {
    display: flex;
    align-items: center;
    gap: var(--sp-xs);
  }

  .stat-label {
    color: var(--text-faint);
  }

  .stat-value {
    color: var(--text);
  }

  .stat-delta[data-dir='gain'] {
    color: var(--gain);
  }
  .stat-delta[data-dir='loss'] {
    color: var(--loss);
  }
  .stat-delta[data-dir='neutral'] {
    color: var(--text-faint);
  }

  .rep-strip {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-xs);
  }

  .rep-pill {
    display: inline-flex;
    gap: 4px;
    padding: 2px 8px;
    background: var(--surface);
    border-radius: var(--radius-sm);
    border: var(--border-faint);
    font-family: var(--font-mono);
    font-size: 13px;
    color: var(--text-dim);
  }

  .rep-pill[data-dir='gain'] {
    color: var(--gain);
    border-color: color-mix(in srgb, var(--gain) 40%, transparent);
  }
  .rep-pill[data-dir='loss'] {
    color: var(--loss);
    border-color: color-mix(in srgb, var(--loss) 40%, transparent);
  }

  .digest {
    background: var(--surface);
    border: var(--border-faint);
    border-radius: var(--radius-md);
    padding: var(--sp-sm);
  }

  .digest-summary {
    font-family: var(--font-body);
    font-style: italic;
    color: var(--text-dim);
    cursor: pointer;
  }

  .digest-body {
    margin-top: var(--sp-sm);
    color: var(--text-faint);
    white-space: pre-wrap;
    font-size: 12px;
    line-height: 1.5;
    max-height: 240px;
    overflow-y: auto;
  }

  .diff-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .diff-row {
    display: grid;
    grid-template-columns: 16px 1fr auto;
    align-items: baseline;
    gap: var(--sp-xs);
    width: 100%;
    text-align: left;
    color: inherit;
    padding: 6px var(--sp-xs);
    border-radius: var(--radius-sm);
    transition: background var(--m-fast) var(--ease);
  }

  .diff-row:hover,
  .diff-row:focus-visible {
    background: color-mix(in srgb, var(--accent) 8%, transparent);
  }

  .diff-mark {
    font-family: var(--font-mono);
    text-align: center;
  }

  .diff-mark[data-dir='gain'] {
    color: var(--gain);
  }
  .diff-mark[data-dir='loss'] {
    color: var(--loss);
  }
  .diff-mark[data-dir='neutral'] {
    color: var(--text-faint);
  }

  .diff-text {
    color: var(--text-dim);
    font-size: 15px;
    line-height: 1.4;
  }

  .diff-chevron {
    color: var(--text-faint);
  }

  .ledger {
    display: flex;
    flex-direction: column;
    gap: var(--sp-xs);
  }

  .ledger-row {
    display: grid;
    grid-template-columns: 18px 1fr;
    gap: var(--sp-xs);
    align-items: baseline;
  }

  .ledger-mark {
    font-family: var(--font-mono);
    color: var(--text-faint);
    text-align: center;
  }

  .ledger-mark.accent {
    color: var(--accent);
  }

  .ledger-mark.dim {
    color: var(--text-faint);
  }

  .ledger-body {
    display: flex;
    flex-direction: column;
  }

  .ledger-line {
    color: var(--text-dim);
    font-size: 15px;
  }

  .ledger-line.dim {
    color: var(--text-faint);
  }

  .ledger-cost {
    color: var(--text-faint);
    margin-left: 4px;
  }

  .ledger-sub {
    color: var(--text-faint);
    margin-top: 2px;
  }

  .pressures {
    background: var(--surface);
    border: var(--border-faint);
    border-radius: var(--radius-md);
    padding: var(--sp-xs);
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .hooks {
    background: color-mix(in srgb, var(--surface) 60%, transparent);
    border-radius: var(--radius-md);
    padding: var(--sp-sm);
  }

  .hook-list {
    display: flex;
    flex-direction: column;
    gap: var(--sp-xs);
  }

  .hook {
    display: grid;
    grid-template-columns: 18px 1fr;
    gap: var(--sp-xs);
    align-items: baseline;
  }

  .hook-mark {
    color: var(--accent-soft);
    font-size: 12px;
  }

  .hook-text {
    color: var(--text-faint);
    font-style: italic;
    font-size: 14px;
    line-height: 1.5;
  }

  .quiet {
    color: var(--text-faint);
    font-style: italic;
    text-align: center;
    padding: var(--sp-lg) var(--sp-md);
    background: var(--surface);
    border-radius: var(--radius-md);
    border: var(--border-faint);
  }
</style>
