<!--
  ReportsScreen — top-level Reports tab.

  Sub-nav: Today | Pressures | Weekly | Monthly | Log

  Today renders the daily report for `gameStore.latestResult`.
  Pressures renders the all-21 dashboard.
  Weekly / Monthly read the persistent sim-side overviews from their
  respective projections (Phases 90 / 91). Log renders `state.history`
  via `buildTavernLog` with filter chips for category, tag, day range,
  search, and "involving" entity (Phase 94).
-->
<script lang="ts">
  import DailyReport from '../components/DailyReport.svelte'
  import PressuresDashboard from '../components/PressuresDashboard.svelte'
  import WeeklyOverview from '../components/WeeklyOverview.svelte'
  import MonthlyOverview from '../components/MonthlyOverview.svelte'
  import TavernLog from '../components/TavernLog.svelte'
  import CauseDrilldown from '../components/CauseDrilldown.svelte'
  import { gameStore } from '../sim/gameStore.svelte'
  import {
    buildDailyReport,
    buildMonthlyOverview,
    buildWeeklyOverview,
  } from '../../../../src/reports/index'
  import type { DailyReportData } from '../../../../src/reports/types'
  import type { WeeklyOverviewData } from '../../../../src/reports/weeklyOverviewProjection'
  import type { MonthlyOverviewData } from '../../../../src/reports/monthlyOverviewProjection'
  import { safeProject, type ProjectionSlot } from '../sim/projectionSlot'

  type Subview = 'today' | 'pressures' | 'weekly' | 'monthly' | 'log'

  const TABS: { id: Subview; label: string }[] = [
    { id: 'today', label: 'Today' },
    { id: 'pressures', label: 'Pressures' },
    { id: 'weekly', label: 'Weekly' },
    { id: 'monthly', label: 'Monthly' },
    { id: 'log', label: 'Log' },
  ]

  // Phase 93 / ISSUE-053 — Subview lives on the store and is persisted
  // through the save envelope so Continue lands on the same tab.
  const subview = $derived(gameStore.reportsSubview)
  function setSubview(s: Subview) {
    gameStore.setReportsSubview(s)
  }

  // Phase 97 / ISSUE-057 — Discriminated unions so a throw from any of
  // the three projections renders an inline error panel instead of
  // silently blanking the section. 'empty' covers "no day has been
  // simulated yet" (only meaningful for the daily report). Phase 119+120
  // / ISSUE-058+059 lifted the type and helper into a shared module so
  // every wrapped derived across the web layer uses the same shape.
  const report: ProjectionSlot<DailyReportData> = $derived.by(() => {
    const result = gameStore.latestResult
    if (!result) return { ok: 'empty' }
    return safeProject(() =>
      buildDailyReport(result, gameStore.state, {
        ...(gameStore.previousCalendar ? { previousCalendar: gameStore.previousCalendar } : {}),
        dismissedMissedOpportunityIds: gameStore.dismissedMissedOpportunityIds,
      }),
    )
  })

  const weeklyOverview: ProjectionSlot<WeeklyOverviewData> = $derived.by(() =>
    safeProject(() => buildWeeklyOverview(gameStore.state)),
  )
  const monthlyOverview: ProjectionSlot<MonthlyOverviewData> = $derived.by(() =>
    safeProject(() => buildMonthlyOverview(gameStore.state)),
  )

  let pressureDrilldownPath = $state<string | undefined>(undefined)
  let pressureDrilldownOpen = $state(false)

  function openPressureDrilldown(id: string) {
    pressureDrilldownPath = `pressures.${id}`
    pressureDrilldownOpen = true
  }

  function closePressureDrilldown() {
    pressureDrilldownOpen = false
  }

  function navigateToPressures() {
    setSubview('pressures')
  }
</script>

<main class="reports">
  <nav class="subnav" aria-label="Reports section">
    {#each TABS as tab (tab.id)}
      <button
        type="button"
        class="subtab"
        class:active={subview === tab.id}
        aria-current={subview === tab.id ? 'page' : undefined}
        onclick={() => setSubview(tab.id)}
      >
        {tab.label}
      </button>
    {/each}
  </nav>

  <section class="content">
    {#if subview === 'today'}
      {#if report.ok === 'success'}
        <DailyReport report={report.data} />
      {:else if report.ok === 'empty'}
        <p class="placeholder">
          Open the tavern and run a day to see today's report.
        </p>
      {:else}
        <div class="report-error" role="alert">
          <p class="report-error-title">Report unavailable</p>
          <p class="report-error-message mono">{report.error}</p>
        </div>
      {/if}
    {:else if subview === 'pressures'}
      <PressuresDashboard onselect={openPressureDrilldown} />
    {:else if subview === 'weekly'}
      {#if weeklyOverview.ok === 'success'}
        <WeeklyOverview data={weeklyOverview.data} />
      {:else if weeklyOverview.ok === 'error'}
        <div class="report-error" role="alert">
          <p class="report-error-title">Weekly overview unavailable</p>
          <p class="report-error-message mono">{weeklyOverview.error}</p>
        </div>
      {/if}
    {:else if subview === 'monthly'}
      {#if monthlyOverview.ok === 'success'}
        <MonthlyOverview
          data={monthlyOverview.data}
          onnavigatepressures={navigateToPressures}
        />
      {:else if monthlyOverview.ok === 'error'}
        <div class="report-error" role="alert">
          <p class="report-error-title">Monthly overview unavailable</p>
          <p class="report-error-message mono">{monthlyOverview.error}</p>
        </div>
      {/if}
    {:else if subview === 'log'}
      <TavernLog />
    {/if}
  </section>
</main>

<CauseDrilldown
  open={pressureDrilldownOpen}
  path={pressureDrilldownPath}
  onclose={closePressureDrilldown}
/>

<style>
  .reports {
    display: flex;
    flex-direction: column;
    gap: var(--sp-md);
    padding: var(--sp-md);
    padding-bottom: calc(var(--nav-h) + var(--sp-lg));
    max-width: var(--max-content);
    margin: 0 auto;
  }

  .subnav {
    display: flex;
    gap: 2px;
    background: var(--surface);
    border: var(--border-faint);
    border-radius: var(--radius-md);
    padding: 4px;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .subtab {
    flex: 1 0 auto;
    padding: 8px 12px;
    border-radius: var(--radius-sm);
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--text-faint);
    transition: color var(--m-fast) var(--ease), background var(--m-fast) var(--ease);
    min-height: 36px;
    white-space: nowrap;
  }

  .subtab:hover,
  .subtab:focus-visible {
    color: var(--text-dim);
  }

  .subtab.active {
    color: var(--accent);
    background: color-mix(in srgb, var(--accent) 10%, transparent);
  }

  .content {
    display: flex;
    flex-direction: column;
  }

  .placeholder {
    color: var(--text-faint);
    font-style: italic;
    text-align: center;
    padding: var(--sp-xl) var(--sp-md);
    background: var(--surface);
    border-radius: var(--radius-md);
    border: var(--border-faint);
    line-height: 1.6;
  }

  /* Phase 97 / ISSUE-057 — projection failure fallback. */
  .report-error {
    display: flex;
    flex-direction: column;
    gap: var(--sp-xs);
    padding: var(--sp-md);
    background: color-mix(in srgb, var(--loss) 8%, transparent);
    border: 1px solid color-mix(in srgb, var(--loss) 40%, transparent);
    border-radius: var(--radius-md);
  }

  .report-error-title {
    color: var(--text);
    font-weight: 600;
    font-size: 14px;
  }

  .report-error-message {
    color: var(--text-dim);
    font-size: 12px;
    line-height: 1.4;
    word-break: break-word;
    padding: var(--sp-xs) var(--sp-sm);
    background: var(--ink-deep);
    border-radius: var(--radius-sm);
  }
</style>
