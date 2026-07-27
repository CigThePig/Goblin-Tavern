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
  import EntityLink from './links/EntityLink.svelte'
  import { entityKindFromRefKind } from './links/types'
  import { gameStore, formatDuration } from '../sim/gameStore.svelte'
  import type {
    DailyReportData,
    DayArcEntry,
    ReportDiffLine,
    ReportReputationDelta,
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

  // Phase 186 / Cluster 6 — stable per-entry key for the day-arc list.
  function arcEntryKey(entry: DayArcEntry, i: number): string {
    if (entry.kind === 'owner_action') {
      return `oa-${entry.action.actionId}-${entry.action.targetId ?? ''}`
    }
    if (entry.kind === 'resolved_intent') return `ri-${entry.intent.intentId}`
    return `sv-${i}`
  }
</script>

<section class="report" aria-label="Daily report">
  <!-- ── Header ────────────────────────────────────────────────── -->
  <header class="block header">
    <p class="section-label block-label">{report.header.dayLabel}</p>
    <p class="head-line display">
      Day {report.header.closedDayOrdinal} closed
    </p>
    {#if report.header.headerVoice}
      <p class="head-voice">{report.header.headerVoice}</p>
    {/if}
    <div class="head-stats">
      <span class="stat">
        <span class="stat-label chip">Coin</span>
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

  <!-- ── The day's story (Phase 186 / Cluster 6) ─────────────────── -->
  <!-- The day runs as three real engine segments; the arc narrates it
       in that order — your morning moves, service running, the calls you
       made when the day asked — instead of a flat "what happened" lump.
       Movements with no entries are omitted upstream. -->
  {#each report.dayArc as movement (movement.id)}
    <section class="block">
      <h2 class="block-label section-label">{movement.title}</h2>
      {#if movement.voice}
        <p class="arc-voice">{movement.voice}</p>
      {/if}
      <ul class="ledger">
        {#each movement.entries as entry, i (arcEntryKey(entry, i))}
          {#if entry.kind === 'owner_action'}
            <li class="ledger-row">
              <span class="ledger-mark accent">★</span>
              <div class="ledger-body">
                <span class="ledger-line">
                  {entry.action.label}{#if entry.action.targetLabel || entry.action.targetId} · {entry.action.targetLabel ?? entry.action.targetId}{/if}
                  {#if entry.action.timeCost > 0}
                    <span class="ledger-cost chip">({formatDuration(entry.action.timeCost)})</span>
                  {/if}
                </span>
                {#if entry.action.effects.length > 0}
                  <span class="ledger-sub chip">{entry.action.effects.slice(0, 2).join(' · ')}</span>
                {/if}
              </div>
            </li>
          {:else if entry.kind === 'resolved_intent'}
            <!-- Phase 190b — the subject links to its detail surface when
                 the projection resolved it to a concrete entity
                 (`subjectRef`); a generic-noun subject stays plain text. -->
            {@const subjectKind = entry.intent.subjectRef
              ? entityKindFromRefKind(entry.intent.subjectRef.kind)
              : undefined}
            <li class="ledger-row">
              <span class="ledger-mark">→</span>
              <div class="ledger-body">
                <span class="ledger-line">
                  you chose: {entry.intent.verb} ·
                  {#if subjectKind && entry.intent.subjectRef}
                    <EntityLink
                      kind={subjectKind}
                      id={entry.intent.subjectRef.id}
                      label={entry.intent.subject}
                    />
                  {:else}
                    {entry.intent.subject}
                  {/if}
                </span>
              </div>
            </li>
          {:else}
            <li class="ledger-row">
              <span class="ledger-mark dim">·</span>
              <div class="ledger-body">
                <span class="ledger-line dim">{entry.line.readable}</span>
              </div>
            </li>
          {/if}
        {/each}
      </ul>
    </section>
  {/each}

  <!-- ── Significant changes ────────────────────────────────────── -->
  {#if report.groupedDiffs.coinAndReputation.length > 0}
    <section class="block">
      <h2 class="block-label section-label">Coin &amp; reputation</h2>
      <ul class="diff-list">
        {#each report.groupedDiffs.coinAndReputation as d (d.path)}
          <li>
            <button class="diff-row" type="button" onclick={() => openDiffDrilldown(d)}>
              <span class="diff-mark" data-dir={d.direction}>{diffMark(d)}</span>
              <span class="diff-text">{d.humanReadable}</span>
              <span class="diff-chevron chip">↗</span>
            </button>
          </li>
        {/each}
      </ul>
    </section>
  {/if}
  {#if report.groupedDiffs.stock.length > 0}
    <section class="block">
      <h2 class="block-label section-label">Stock</h2>
      <ul class="diff-list">
        {#each report.groupedDiffs.stock as d (d.path)}
          <li>
            <button class="diff-row" type="button" onclick={() => openDiffDrilldown(d)}>
              <span class="diff-mark" data-dir={d.direction}>{diffMark(d)}</span>
              <span class="diff-text">{d.humanReadable}</span>
              <span class="diff-chevron chip">↗</span>
            </button>
          </li>
        {/each}
      </ul>
    </section>
  {/if}
  {#if report.groupedDiffs.pressures.length > 0}
    <section class="block">
      <h2 class="block-label section-label">Pressures</h2>
      <ul class="diff-list">
        {#each report.groupedDiffs.pressures as d (d.path)}
          <li>
            <button class="diff-row" type="button" onclick={() => openDiffDrilldown(d)}>
              <span class="diff-mark" data-dir={d.direction}>{diffMark(d)}</span>
              <span class="diff-text">{d.humanReadable}</span>
              <span class="diff-chevron chip">↗</span>
            </button>
          </li>
        {/each}
      </ul>
    </section>
  {/if}
  {#if report.groupedDiffs.areas.length > 0}
    <section class="block">
      <h2 class="block-label section-label">Areas</h2>
      <ul class="diff-list">
        {#each report.groupedDiffs.areas as d (d.path)}
          <li>
            <button class="diff-row" type="button" onclick={() => openDiffDrilldown(d)}>
              <span class="diff-mark" data-dir={d.direction}>{diffMark(d)}</span>
              <span class="diff-text">{d.humanReadable}</span>
              <span class="diff-chevron chip">↗</span>
            </button>
          </li>
        {/each}
      </ul>
    </section>
  {/if}
  {#if report.groupedDiffs.other.length > 0}
    <section class="block">
      <h2 class="block-label section-label">Other</h2>
      <ul class="diff-list">
        {#each report.groupedDiffs.other as d (d.path)}
          <li>
            <button class="diff-row" type="button" onclick={() => openDiffDrilldown(d)}>
              <span class="diff-mark" data-dir={d.direction}>{diffMark(d)}</span>
              <span class="diff-text">{d.humanReadable}</span>
              <span class="diff-chevron chip">↗</span>
            </button>
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
      <h2 class="block-label section-label">What's building</h2>
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
      <h2 class="block-label section-label">What might happen</h2>
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

  <!-- ── Waiting on / came due ───────────────────────────────────── -->
  <!-- Phase 202 / audit Wave 3 (`P6-COMP-002`) — a promised later effect
       used to vanish at selection and return days later as an
       unexplained number. These two blocks are the lifecycle: what is
       still queued (with the choice that promised it and when it lands),
       and what landed or lapsed today, named with the decision it came
       from. -->
  {#if report.resolvedConsequences.length > 0}
    <section class="block hooks">
      <h2 class="block-label section-label">Came due today</h2>
      <ul class="hook-list">
        {#each report.resolvedConsequences as c (c.entryId)}
          <li class="hook">
            <span class="hook-mark">{c.status === 'applied' ? '◆' : '◇'}</span>
            <span class="hook-text">
              {c.originLabel} —
              {c.status === 'applied' ? 'came due' : 'lapsed unused'}
            </span>
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  {#if report.pendingConsequences.length > 0}
    <section class="block hooks">
      <h2 class="block-label section-label">Still waiting</h2>
      <ul class="hook-list">
        {#each report.pendingConsequences as c (c.entryId)}
          <li class="hook">
            <span class="hook-mark">◇</span>
            <span class="hook-text">
              {c.expectedEffect}
              <span class="hook-origin">
                from “{c.originLabel}” ·
                {#if c.status === 'expiring'}
                  last chance
                {:else if c.daysAway === 0}
                  tomorrow
                {:else}
                  in {c.daysAway} days
                {/if}
              </span>
            </span>
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  <!-- ── Week / month coda (boundary days only) ──────────────────── -->
  <!-- The longer-horizon digests close the report — the day's story
       first, then the zoom-out. Read-only by design (contract §3.5);
       choice-bearing periodic seeds surface at the morning pause. -->
  {#if report.weeklyDigest}
    <section class="block">
      <h2 class="block-label section-label">Week digest</h2>
      <details class="digest">
        <summary class="digest-summary">{report.weeklyDigest.title}</summary>
        <pre class="digest-body mono">{report.weeklyDigest.lines.join('\n')}</pre>
      </details>
    </section>
  {/if}
  {#if report.monthlyDigest}
    <section class="block">
      <h2 class="block-label section-label">Month digest</h2>
      <details class="digest">
        <summary class="digest-summary">{report.monthlyDigest.title}</summary>
        <pre class="digest-body mono">{report.monthlyDigest.lines.join('\n')}</pre>
      </details>
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

  /* Phase 186 / Cluster 6 — day-arc movement connective. */
  .arc-voice {
    color: var(--text-faint);
    font-style: italic;
    font-size: 14px;
    line-height: 1.4;
    margin-bottom: var(--sp-xs);
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

  .hook-origin {
    display: block;
    font-size: 0.85em;
    color: var(--text-faint);
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
