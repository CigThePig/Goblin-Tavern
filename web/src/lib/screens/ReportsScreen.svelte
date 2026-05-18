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

  type Subview = 'today' | 'pressures' | 'weekly' | 'monthly' | 'log'

  const TABS: { id: Subview; label: string }[] = [
    { id: 'today', label: 'Today' },
    { id: 'pressures', label: 'Pressures' },
    { id: 'weekly', label: 'Weekly' },
    { id: 'monthly', label: 'Monthly' },
    { id: 'log', label: 'Log' },
  ]

  let subview = $state<Subview>('today')

  const report = $derived.by<DailyReportData | undefined>(() => {
    const result = gameStore.latestResult
    if (!result) return undefined
    return buildDailyReport(result, gameStore.state, {
      ...(gameStore.previousCalendar ? { previousCalendar: gameStore.previousCalendar } : {}),
    })
  })

  const weeklyOverview = $derived<WeeklyOverviewData>(buildWeeklyOverview(gameStore.state))
  const monthlyOverview = $derived<MonthlyOverviewData>(
    buildMonthlyOverview(gameStore.state),
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
    subview = 'pressures'
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
        onclick={() => (subview = tab.id)}
      >
        {tab.label}
      </button>
    {/each}
  </nav>

  <section class="content">
    {#if subview === 'today'}
      {#if report}
        <DailyReport {report} />
      {:else}
        <p class="placeholder">
          Open the tavern and run a day to see today's report.
        </p>
      {/if}
    {:else if subview === 'pressures'}
      <PressuresDashboard onselect={openPressureDrilldown} />
    {:else if subview === 'weekly'}
      <WeeklyOverview data={weeklyOverview} />
    {:else if subview === 'monthly'}
      <MonthlyOverview
        data={monthlyOverview}
        onnavigatepressures={navigateToPressures}
      />
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
    font-variant: small-caps;
    letter-spacing: 0.06em;
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
</style>
