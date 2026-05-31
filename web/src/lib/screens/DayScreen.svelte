<!--
  DayScreen — the 5-beat day loop, now bracketing three real engine
  segments (Phase 186 / Day-Clock Cluster 5).

  Beats → segments:
    1. morning   — Segment A output: at-a-glance + forecast-as-expected +
                   pressures + morning_prep cards + choice-bearing periodic
                   cards (debt_rent, monthly_review). Opening the morning
                   RUNS Segment A (`gameStore.beginDay`).
    2. plan      — Pause 1: owner action picker + staff priority sheet.
    3. service   — "Run service" RUNS Segment B (`gameStore.runService`);
                   during_service deck shows emergent cards as produced.
    4. closing   — Pause 2 continues: closing deck.
    5. report    — "End day" RUNS Segment C (`gameStore.endDay`), applying
                   the day's responses and building the report. Weekly/
                   monthly digests are read-only report sections.

  Phase 186 / Day-Clock Cluster 5 — the day used to be one end-of-day
  `simulateDay`, which (after Cluster 1 made seed generation segment-local)
  resolved the player's responses against the PREVIOUS day's seeds and
  silently no-op'd. The beats now bracket the engine's real segments, so
  morning/service/closing cards are produced this day and resolved this
  day. Card placement is honest: foreseeable standing conditions in the
  morning, emergent events only once service has run (contract §3.1).

  Player decisions accumulate in `pendingBySeedId` (response intents per
  seed), `picks` (owner actions, consumed by Segment B), and
  `staffPriorities` (sticky). Morning + service + closing responses flush
  into Segment C when the player taps End Day.

  Phase 96 lifted `beat`, `pendingBySeedId`, and the two deck-complete
  flags onto `gameStore` so a refresh resumes on the same beat with
  intents preserved; Cluster 5 adds the `segment` position so the resume
  lands on the right engine segment. The morning beat also offers a Quick
  Day shortcut when Segment A produced zero morning seeds (game-loop
  §3.7), and a "Yesterday" digest when a previous day's report exists
  (game-loop §2.3).
-->
<script lang="ts">
  import { untrack } from 'svelte'
  import PressureRibbon from '../components/PressureRibbon.svelte'
  import Icon from '../components/Icon.svelte'
  import CardRenderer from '../cards/CardRenderer.svelte'
  import CardDeck from '../components/CardDeck.svelte'
  import BeatTransition from '../components/BeatTransition.svelte'
  import ActionPicker from '../components/ActionPicker.svelte'
  import StaffPrioritySheet from '../components/StaffPrioritySheet.svelte'
  import DailyReport from '../components/DailyReport.svelte'
  import YesterdayDigest from '../components/YesterdayDigest.svelte'
  import { renderCard } from '../cards/realCardRegistry'
  import { formatDuration } from '../sim/actionBuilder'
  import { gameStore } from '../sim/gameStore.svelte'
  import { prefsStore } from '../prefs/prefsStore.svelte'
  import { buildIntent, buildIgnoreIntent } from '../sim/intentBuilder'
  import { buildDailyReport } from '../../../../src/reports/index'
  import {
    projectYesterdayDigest,
    type YesterdayDigestData,
  } from '../../../../src/reports/yesterdayDigest'
  // Phase 142 / ISSUE-111 — Voiced Surface arc, Phase 16. Day-screen
  // empty-state lines flow through the compose-runtime section composers
  // that replaced the retired Phase-95 `composeEmpty` tone-pool helper.
  // Each section keys deterministically off `(closedDayOrdinal, beat)`
  // so the same calendar day reads the same line across the three beats
  // on a refresh.
  import {
    composeClosingEmptyLine,
    composeMorningEmptyLine,
    composeServiceEmptyLine,
  } from '../../../../src/reports/index'
  import type { CardChoice } from '../cards/types'
  import type { IssueSeed } from '../cards/types'
  import type { ResponseIntent } from '../../../../src/sim/modules/issues/issueSeedTypes'
  import type { PendingChoice } from '../sim/daySession'
  import type { DailyReportData } from '../../../../src/reports/types'
  import { safeProject, type ProjectionSlot } from '../sim/projectionSlot'

  // Phase 96 — Beat & pending state read from the store so they survive
  // a reload. The store resets the per-day session state when a new day
  // opens in Segment A (`beginDay`).
  const beat = $derived(gameStore.beat)
  const picks = $derived(gameStore.picks)
  const staffPriorities = $derived(gameStore.staffPriorities)
  const pendingBySeedId = $derived(gameStore.pendingBySeedId)
  const serviceComplete = $derived(gameStore.serviceComplete)

  // Phase 186 / Day-Clock Cluster 5 — open the day whenever the morning
  // beat is shown but no day is in progress (`segment === 'C'`, the
  // "ready" state). `beginDay` runs Segment A — setup, world advance,
  // morning seed generation, traffic forecast — and is idempotent (only
  // opens from 'C'), so this fires exactly once per day: on fresh start,
  // after Next day, and on a hydrated save that resumed at a brand-new
  // morning. `untrack` keeps the engine's state writes from re-triggering
  // the effect; the guard read of `beat`/`segment` is the only dependency.
  // A Segment-A throw is pinned to `runError` so the morning beat's
  // existing banner surfaces it instead of bubbling to the App boundary.
  $effect(() => {
    if (gameStore.beat === 'morning' && gameStore.segment === 'C') {
      untrack(() => {
        try {
          gameStore.beginDay()
        } catch (err) {
          gameStore.runError = {
            message: err instanceof Error ? err.message : String(err),
            ...(err instanceof Error && err.stack ? { stack: err.stack } : {}),
          }
        }
      })
    }
  })

  let pickerOpen = $state(false)
  let staffSheetOpen = $state(false)
  // `transitioning` is the only beat-local view bit — it's a pacing
  // animation flag. Restoring it on hydration would mean replaying a
  // half-finished service transition, which is a UX bug. Stays local.
  let transitioning = $state(false)

  // ── Derived seed slices ───────────────────────────────────────────
  // Phase 186 / Day-Clock Cluster 4 — periodic-choice re-homing
  // (contract §3.5). Choice-bearing periodic seeds (`end_week`/`end_month`,
  // e.g. `debt_rent`, `monthly_review`) now surface at the MORNING pause —
  // where the player can still act on "pay rent or risk eviction" or the
  // month-end review — instead of being buried in the closing deck. They
  // are produced in the engine's morning generation pass (issueSeedModule
  // `generateWith: ['morning_prep']`), so they are present at the morning
  // beat. Informational weekly/monthly digests remain read-only report
  // sections (`weeklyDigest`/`monthlyDigest`, rendered by DailyReport).
  //
  // Filtering the already-rank-sorted `todaysSeeds` (rather than
  // concatenating per-timing slices) keeps morning cards in global
  // severity/urgency rank, so a high-severity `debt_rent` is not buried
  // beneath lower-severity standing conditions.
  const MORNING_TIMINGS = ['morning_prep', 'end_week', 'end_month']
  const morningSeeds = $derived(
    gameStore.todaysSeeds.filter((s) => MORNING_TIMINGS.includes(s.timing)),
  )
  const serviceSeeds = $derived(gameStore.seedsForTiming('during_service'))
  const closingSeeds = $derived(gameStore.seedsForTiming('closing'))

  // Phase 96 — Quick Day eligibility. The morning beat surfaces the
  // single-tap shortcut when the engine produced zero valid seeds
  // across all five timing slots. Picks may still be queued (e.g. from
  // the Tavern → Restock surface); the button label morphs to surface
  // that intent rather than silently dropping it.
  const todaysSeedCount = $derived(gameStore.todaysSeeds.length)
  const quickDayAvailable = $derived(
    beat === 'morning' && todaysSeedCount === 0,
  )
  const quickDayLabel = $derived.by(() => {
    if (picks.length === 0) return 'Quick Day'
    if (picks.length === 1) return 'Quick Day · 1 action queued'
    return `Quick Day · ${picks.length} actions queued`
  })

  const morningCards = $derived(
    morningSeeds.map((seed) => ({
      seed,
      view: renderCard(seed, gameStore.state),
      pending: pendingBySeedId[seed.id],
    })),
  )

  const staffCount = $derived(Object.keys(gameStore.state.staff).length)

  // Phase 186 / Day-Clock Cluster 5 — forecast-as-expected (contract
  // §3.6). `forecastTraffic` runs at the end of Segment A, so by the
  // morning beat the day's projected turnout genuinely exists — "expected,
  // before your moves," not a settled number. The player's Pause-1 owner
  // actions then change actual turnout in Segment B. Summed across groups;
  // `undefined` until a forecast exists (e.g. before the day is opened).
  const forecastExpected = $derived.by(() => {
    const slot = gameStore.state.modules['customers'] as
      | { forecasts?: { expected?: number }[] }
      | undefined
    const forecasts = slot?.forecasts
    if (!forecasts || forecasts.length === 0) return undefined
    return forecasts.reduce((n, f) => n + (f.expected ?? 0), 0)
  })

  const stockSummary = $derived.by(() => {
    const entries = Object.values(gameStore.state.stock)
    const shown = entries.slice(0, 3)
    const more = entries.length - shown.length
    const parts = shown.map((s) => `${s.label.toLowerCase()} ${s.quantity}`)
    if (more > 0) parts.push(`+${more} more`)
    return parts.join(' · ')
  })

  // Phase 97 / ISSUE-057 — Discriminated union so a throw inside
  // `buildDailyReport` is observable instead of silently hiding the
  // report block. `'empty'` means no day has been simulated yet;
  // `'error'` carries the thrown message so the fallback panel can
  // surface it. `'success'` keeps the renderer pure. Phase 119+120 /
  // ISSUE-058+059 lifted the type and helper into `../sim/projectionSlot`
  // for reuse across the web layer.
  const dailyReport: ProjectionSlot<DailyReportData> = $derived.by(() => {
    const result = gameStore.latestResult
    if (!result) return { ok: 'empty' }
    return safeProject(() =>
      buildDailyReport(result, gameStore.state, {
        ...(gameStore.previousCalendar ? { previousCalendar: gameStore.previousCalendar } : {}),
        dismissedMissedOpportunityIds: gameStore.dismissedMissedOpportunityIds,
      }),
    )
  })

  // Phase 96 — Morning yesterday digest. Only shows when the engine
  // has a previous day to summarise. Derived from the same
  // DailyReportData the Report screen would render. Phase 120 /
  // ISSUE-059 wraps the inner `projectYesterdayDigest` call so a throw
  // surfaces a tiny inline fallback instead of bubbling through the
  // App boundary and unmounting the entire morning beat. The projection
  // legitimately returns `undefined` for a quiet day; we collapse that
  // to the 'empty' branch so the consumer's three-way check stays clean.
  const yesterdayDigest: ProjectionSlot<YesterdayDigestData> = $derived.by(() => {
    if (beat !== 'morning') return { ok: 'empty' }
    if (dailyReport.ok !== 'success') return { ok: 'empty' }
    const slot = safeProject(() => projectYesterdayDigest(dailyReport.data))
    if (slot.ok === 'success' && slot.data === undefined) return { ok: 'empty' }
    return slot as ProjectionSlot<YesterdayDigestData>
  })

  const nextDayLabel = $derived.by(() => {
    if (dailyReport.ok !== 'success') return 'Next day'
    if (dailyReport.data.header.isEndOfMonth) return 'Close the month'
    if (dailyReport.data.header.isEndOfWeek) return 'Close the week'
    return 'Next day'
  })

  // Phase 142 / ISSUE-111 — Voiced Surface arc, Phase 16. Day-screen
  // empty-state lines: the compose-runtime section composers key off
  // the same `closedDayOrdinal` the daily-report sections use, so the
  // same calendar day reads the same line through all three beats on
  // a refresh. Calendar tags (`isEndOfWeek` / `isEndOfMonth`) feed into
  // the snippet pools as `hasTag` gates.
  const closedDayOrdinal = $derived(gameStore.state.calendar.totalDaysElapsed)
  const isEndOfWeek = $derived(gameStore.state.calendar.dayOfWeek === 7)
  const isEndOfMonth = $derived(
    isEndOfWeek && gameStore.state.calendar.week === 4,
  )
  const morningEmpty = $derived(
    composeMorningEmptyLine({
      state: gameStore.state,
      closedDayOrdinal,
      isEndOfWeek,
    }) ?? '',
  )
  const serviceEmpty = $derived(
    composeServiceEmptyLine({
      state: gameStore.state,
      closedDayOrdinal,
      isEndOfWeek,
    }) ?? '',
  )
  const closingEmpty = $derived(
    composeClosingEmptyLine({
      state: gameStore.state,
      closedDayOrdinal,
      isEndOfWeek,
      isEndOfMonth,
    }) ?? '',
  )

  // ── Beat transitions ──────────────────────────────────────────────
  function captureRunError(err: unknown) {
    gameStore.runError = {
      message: err instanceof Error ? err.message : String(err),
      ...(err instanceof Error && err.stack ? { stack: err.stack } : {}),
    }
  }

  function startPlanning() {
    gameStore.setBeat('plan')
  }

  function startService() {
    // Pause 1 → commit the morning plan and RUN Segment B: apply the
    // queued owner actions + staff priorities, run service, recompute
    // closing. Emergent during_service/closing cards are produced here.
    // On a sim throw, pin the error and stay on the plan beat (the plan
    // beat renders the run-error banner) rather than advancing into an
    // empty service.
    try {
      gameStore.runService()
    } catch (err) {
      captureRunError(err)
      return
    }
    // Pacing transition; 600ms feels like "service runs" without being
    // a loading screen. Reduced-motion users skip the wait.
    transitioning = true
    gameStore.setBeat('service')
  }

  function endTransition() {
    transitioning = false
  }

  function startClosing() {
    gameStore.setBeat('closing')
  }

  // Phase 98 — Confirm-end-day preference. When on, the End Day button
  // shows an in-place "Are you sure?" instead of firing immediately.
  let confirmingEndDay = $state(false)

  function endDay() {
    if (prefsStore.preferences.confirmEndDay && !confirmingEndDay) {
      confirmingEndDay = true
      return
    }
    confirmingEndDay = false
    // Pause 2 → RUN Segment C. Bundle the day's responses — to morning,
    // service, AND closing cards (Cluster 1 made resolution same-day;
    // these all resolve against seeds produced earlier today). Segment C
    // applies them, runs the rollups, and builds the report. Picks and
    // staffPriorities were already consumed by Segment B.
    const intents: ResponseIntent[] = []
    for (const seed of [...morningSeeds, ...serviceSeeds, ...closingSeeds]) {
      const pending = pendingBySeedId[seed.id]
      if (!pending) continue
      if (pending.kind === 'ignore') {
        intents.push(buildIgnoreIntent(seed))
      } else {
        intents.push(buildIntent(seed, pending.choice))
      }
    }
    // Phase 97 / ISSUE-057 — Catch any throw from the engine (invariants,
    // validation, hook crashes). Without this the click handler dies
    // before `setBeat('report')` runs and the button appears to do
    // nothing. On error: pin the message so the banner renders; do NOT
    // advance the beat. On success: advance.
    try {
      gameStore.endDay({ responseIntents: intents })
      gameStore.setBeat('report')
    } catch (err) {
      captureRunError(err)
    }
  }

  function cancelEndDay() {
    confirmingEndDay = false
  }

  // Phase 96 / Day-Clock Cluster 5 — Quick Day path. Runs Segment B
  // (applying any picks queued from other surfaces + sticky staff
  // priorities), then: if service surfaced emergent cards, drop the
  // player into the service beat so the moment isn't buried (contract
  // §3.1); otherwise run Segment C and jump to the report. Honest about
  // emergence — Quick Day can no longer promise a card-free day, because
  // service produces its cards when it runs, not the night before.
  function runQuickDay() {
    try {
      gameStore.runService()
      const emergent =
        gameStore.seedsForTiming('during_service').length > 0 ||
        gameStore.seedsForTiming('closing').length > 0
      if (emergent) {
        gameStore.setBeat('service')
        return
      }
      gameStore.endDay({ responseIntents: [] })
      gameStore.setBeat('report')
    } catch (err) {
      captureRunError(err)
    }
  }

  function retryEndDay() {
    gameStore.clearRunError()
    endDay()
  }

  function dismissRunError() {
    gameStore.clearRunError()
  }

  // Next day — just show the morning beat. The begin-day `$effect` opens
  // the new day (Segment A) since `segment` is 'C' here.
  function nextDay() {
    gameStore.setBeat('morning')
  }

  function openTodayReport() {
    // YesterdayDigest tap-through. Routes to Reports tab via the store
    // so the App-level navigate effect picks it up on next render.
    gameStore.setRoute('reports')
  }

  // ── Card resolution callbacks ─────────────────────────────────────
  function resolveSeed(seedId: string, pending: PendingChoice) {
    gameStore.resolveSeed(seedId, pending)
  }

  function morningChooseFor(seed: IssueSeed) {
    return (slotId: string, choice: CardChoice) => {
      resolveSeed(seed.id, { kind: 'choice', slotId, verb: choice.verb, choice })
    }
  }
  function morningIgnoreFor(seed: IssueSeed) {
    return () => {
      resolveSeed(seed.id, { kind: 'ignore' })
    }
  }

  function onServiceComplete() {
    gameStore.setServiceComplete(true)
  }
  function onClosingComplete() {
    gameStore.setClosingComplete(true)
  }
</script>

{#if transitioning}
  <BeatTransition show={true} label="Service runs." oncomplete={endTransition} />
{/if}

<main class="day">
  <!-- ─── Beat 1: Morning ────────────────────────────────────────── -->
  {#if beat === 'morning'}
    <section class="block" aria-label="At a glance">
      <div class="glance mono">
        <span><Icon name="coin" size={13} /> {gameStore.state.coin}</span>
        <span><Icon name="staff" size={13} /> {staffCount} staff</span>
        <span><Icon name="stock" size={13} /> {stockSummary}</span>
      </div>
      {#if forecastExpected !== undefined}
        <!-- Phase 186 / Cluster 5 — forecast-as-expected (§3.6). Framed
             as a guess that the morning plan will move, never a settled
             number. -->
        <p class="forecast tag">
          ~{forecastExpected} guests expected · before your moves
        </p>
      {/if}
    </section>

    {#if yesterdayDigest.ok === 'success'}
      <section class="block" aria-label="Yesterday">
        <YesterdayDigest digest={yesterdayDigest.data} onopen={openTodayReport} />
      </section>
    {:else if yesterdayDigest.ok === 'error'}
      <section class="block digest-fallback" aria-label="Yesterday unavailable" role="alert">
        <p class="fallback-title">Yesterday digest unavailable</p>
        <p class="fallback-error mono">{yesterdayDigest.error}</p>
      </section>
    {/if}

    <section class="block" aria-label="Pressures">
      <h2 class="block-label tag">Rising</h2>
      <PressureRibbon />
    </section>

    <section class="block" aria-label="Morning">
      <h2 class="block-label tag">Morning</h2>
      {#if morningCards.length === 0}
        <p class="quiet">{morningEmpty}</p>
      {:else}
        <div class="card-stack">
          {#each morningCards as { seed, view, pending } (seed.id)}
            <div class="card-wrap" class:resolved={!!pending}>
              <CardRenderer
                card={view}
                onchoose={morningChooseFor(seed)}
                onignore={morningIgnoreFor(seed)}
              />
              {#if pending}
                <div class="pending tag">
                  {#if pending.kind === 'ignore'}
                    ignored
                  {:else}
                    noted: <strong>{pending.verb}</strong>
                  {/if}
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </section>

    {#if gameStore.runError}
      <!-- Phase 97 / ISSUE-057 — Same banner pattern as the closing
           beat so a thrown Quick Day call surfaces too. -->
      <section class="block run-error-banner" role="alert" aria-label="End day failed">
        <p class="banner-title">Couldn't run the day.</p>
        <p class="banner-message mono">{gameStore.runError.message}</p>
        <div class="banner-actions">
          <button class="secondary" type="button" onclick={dismissRunError}>Dismiss</button>
        </div>
      </section>
    {/if}

    <section class="block actions" aria-label="Continue">
      <button class="primary" type="button" onclick={startPlanning}>
        Plan the day
      </button>
      {#if quickDayAvailable}
        <button class="secondary quick-day" type="button" onclick={runQuickDay}>
          {quickDayLabel}
        </button>
      {/if}
    </section>
  {/if}

  <!-- ─── Beat 2: Plan ────────────────────────────────────────────── -->
  {#if beat === 'plan'}
    <section class="block" aria-label="Planning summary">
      <h2 class="block-label tag">Plan the day</h2>
      <p class="lede">
        Spend your day on owner actions, set staff priorities. Service runs after.
      </p>
    </section>

    <section class="block">
      <div class="plan-rows">
        <div class="plan-row">
          <div>
            <p class="plan-title">Owner actions</p>
            <p class="plan-sub tag">
              {picks.length === 0
                ? 'none yet'
                : picks.length === 1
                  ? '1 action picked'
                  : `${picks.length} actions picked`}
            </p>
          </div>
          <button class="secondary" type="button" onclick={() => (pickerOpen = true)}>
            {picks.length === 0 ? 'Pick' : 'Edit'}
          </button>
        </div>

        <div class="plan-row">
          <div>
            <p class="plan-title">Staff priorities</p>
            <p class="plan-sub tag">
              {Object.keys(staffPriorities).length === 0
                ? 'using defaults'
                : `${Object.keys(staffPriorities).length} customised`}
            </p>
          </div>
          <button class="secondary" type="button" onclick={() => (staffSheetOpen = true)}>
            Set
          </button>
        </div>
      </div>

      {#if picks.length > 0}
        <ul class="picks-list mono">
          {#each picks as p (p.pickId)}
            <li>
              · {p.label}{#if p.targetLabel}: {p.targetLabel}{/if}
              <span class="picks-cost">({formatDuration(p.actionPointCost)})</span>
            </li>
          {/each}
        </ul>
      {/if}
    </section>

    {#if gameStore.runError}
      <!-- Phase 186 / Cluster 5 — Segment B (Run service) runs from the
           plan beat, so surface a sim throw here too. -->
      <section class="block run-error-banner" role="alert" aria-label="Run service failed">
        <p class="banner-title">Couldn't run service.</p>
        <p class="banner-message mono">{gameStore.runError.message}</p>
        <div class="banner-actions">
          <button class="secondary" type="button" onclick={dismissRunError}>Dismiss</button>
        </div>
      </section>
    {/if}

    <section class="block actions">
      <button class="ghost" type="button" onclick={() => gameStore.setBeat('morning')}>
        ← back
      </button>
      <button class="primary" type="button" onclick={startService}>
        Run service
      </button>
    </section>
  {/if}

  <!-- ─── Beat 3: Service ────────────────────────────────────────── -->
  {#if beat === 'service' && !transitioning}
    <section class="block" aria-label="During service">
      <h2 class="block-label tag">Service</h2>
      {#if serviceSeeds.length === 0}
        <p class="quiet">{serviceEmpty}</p>
      {:else}
        <CardDeck
          seeds={serviceSeeds}
          {pendingBySeedId}
          onresolve={resolveSeed}
          oncomplete={onServiceComplete}
        />
      {/if}
    </section>

    <section class="block actions">
      <button class="primary" type="button" onclick={startClosing}>
        {serviceSeeds.length === 0 || serviceComplete ? 'Closing time →' : 'Skip to closing →'}
      </button>
    </section>
  {/if}

  <!-- ─── Beat 4: Closing ────────────────────────────────────────── -->
  {#if beat === 'closing'}
    <section class="block" aria-label="Closing">
      <h2 class="block-label tag">Closing</h2>
      {#if closingSeeds.length === 0}
        <p class="quiet">{closingEmpty}</p>
      {:else}
        <CardDeck
          seeds={closingSeeds}
          {pendingBySeedId}
          onresolve={resolveSeed}
          oncomplete={onClosingComplete}
        />
      {/if}
    </section>

    {#if gameStore.runError}
      <!-- Phase 97 / ISSUE-057 — Surface the actual sim throw to the
           player. Without this banner an exception in simulateDay
           appeared as "End Day did nothing". -->
      <section class="block run-error-banner" role="alert" aria-label="End day failed">
        <p class="banner-title">Couldn't end the day.</p>
        <p class="banner-message mono">{gameStore.runError.message}</p>
        <div class="banner-actions">
          <button class="secondary" type="button" onclick={retryEndDay}>Retry</button>
          <button class="ghost" type="button" onclick={dismissRunError}>Dismiss</button>
        </div>
      </section>
    {/if}

    <section class="block actions">
      {#if confirmingEndDay}
        <div class="confirm-row">
          <p class="confirm-text">Close out the day? Decisions you skipped are gone.</p>
          <div class="confirm-actions">
            <button class="primary" type="button" onclick={endDay}>End day</button>
            <button class="ghost" type="button" onclick={cancelEndDay}>Wait</button>
          </div>
        </div>
      {:else}
        <button class="primary" type="button" onclick={endDay}>
          End day
        </button>
      {/if}
    </section>
  {/if}

  <!-- ─── Beat 5: Report ─────────────────────────────────────────── -->
  {#if beat === 'report'}
    {#if dailyReport.ok === 'success'}
      <DailyReport report={dailyReport.data} />

      <section class="block actions">
        <button class="primary" type="button" onclick={nextDay}>
          {nextDayLabel}
        </button>
      </section>
    {:else if dailyReport.ok === 'empty'}
      <!-- Phase 97 / ISSUE-057 — Fallback when the report beat is
           reached without a SimResult. Should not happen under normal
           flow (runDay always sets latestResult), but a hydrated save
           or future state edge case might. Always offer a way forward. -->
      <section class="block report-fallback" aria-label="Day complete">
        <p class="fallback-title">Day complete.</p>
        <p class="fallback-sub">No report is available for this day.</p>
        <button class="primary" type="button" onclick={nextDay}>
          {nextDayLabel}
        </button>
      </section>
    {:else}
      <!-- Phase 97 / ISSUE-057 — buildDailyReport threw. Surface the
           message instead of a blank screen. Still give the player a
           Next day button so they can escape the broken report. -->
      <section class="block report-fallback report-fallback-error" aria-label="Report unavailable">
        <p class="fallback-title">Report unavailable</p>
        <p class="fallback-error mono">{dailyReport.error}</p>
        <p class="fallback-sub">The day did advance — only the summary failed to build.</p>
        <button class="primary" type="button" onclick={nextDay}>
          {nextDayLabel}
        </button>
      </section>
    {/if}
  {/if}
</main>

<!-- ─── Sheets ──────────────────────────────────────────────────── -->
<ActionPicker open={pickerOpen} onclose={() => (pickerOpen = false)} />
<StaffPrioritySheet open={staffSheetOpen} onclose={() => (staffSheetOpen = false)} />

<style>
  .day {
    display: flex;
    flex-direction: column;
    gap: var(--sp-lg);
    padding: var(--sp-md);
    padding-bottom: calc(var(--nav-h) + var(--sp-lg));
    max-width: var(--max-content);
    margin: 0 auto;
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

  .glance {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-md);
    padding: var(--sp-sm) var(--sp-md);
    background: var(--surface);
    border-radius: var(--radius-md);
    color: var(--text-dim);
    border: var(--border-faint);
  }

  .glance span {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .forecast {
    color: var(--text-faint);
    font-style: italic;
    margin-top: var(--sp-xs);
  }

  .lede {
    color: var(--text-dim);
    font-style: italic;
    font-size: 15px;
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

  .card-stack {
    display: flex;
    flex-direction: column;
    gap: var(--sp-md);
  }

  .card-wrap {
    position: relative;
    transition: opacity var(--m-fast) var(--ease);
  }

  .card-wrap.resolved {
    opacity: 0.7;
  }

  .pending {
    position: absolute;
    top: var(--sp-sm);
    right: var(--sp-xl);
    color: var(--accent-soft);
    background: var(--ink-deep);
    padding: 2px 8px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--candle-soft);
  }

  .pending strong {
    color: var(--accent);
    font-weight: 500;
  }

  .actions {
    flex-direction: row;
    gap: var(--sp-sm);
    align-items: center;
  }

  .primary {
    flex: 1;
    font-family: var(--font-display);
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    font-size: 14px;
    color: var(--accent);
    background: transparent;
    border: 1px solid var(--accent);
    border-radius: var(--radius-sm);
    padding: 14px;
    min-height: 48px;
    transition: background var(--m-fast) var(--ease);
  }

  .primary:hover,
  .primary:focus-visible {
    background: color-mix(in srgb, var(--accent) 12%, transparent);
  }

  .secondary {
    font-family: var(--font-body);
    font-size: 14px;
    color: var(--text);
    padding: 8px 14px;
    border-radius: var(--radius-sm);
    border: 1px solid color-mix(in srgb, var(--candle-soft) 50%, transparent);
    min-height: 40px;
    transition: border-color var(--m-fast) var(--ease);
  }

  .secondary:hover,
  .secondary:focus-visible {
    border-color: var(--accent);
  }

  .quick-day {
    flex: 1;
    text-align: center;
    color: var(--text-dim);
    font-style: italic;
  }

  .ghost {
    font-family: var(--font-body);
    font-size: 14px;
    color: var(--text-faint);
    padding: 8px 14px;
    min-height: 40px;
  }

  .ghost:hover,
  .ghost:focus-visible {
    color: var(--text);
  }

  .confirm-row {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--sp-xs);
    padding: var(--sp-sm);
    background: color-mix(in srgb, var(--loss) 8%, transparent);
    border: 1px solid color-mix(in srgb, var(--loss) 40%, transparent);
    border-radius: var(--radius-sm);
  }

  .confirm-text {
    color: var(--text-dim);
    font-size: 13px;
    line-height: 1.45;
    text-align: center;
  }

  .confirm-actions {
    display: flex;
    gap: var(--sp-xs);
  }

  .plan-rows {
    display: flex;
    flex-direction: column;
    gap: var(--sp-xs);
  }

  .plan-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-md);
    padding: var(--sp-sm) var(--sp-md);
    background: var(--surface);
    border-radius: var(--radius-md);
    border: var(--border-faint);
  }

  .plan-title {
    font-family: var(--font-body);
    color: var(--text);
    font-size: 16px;
  }

  .plan-sub {
    margin-top: 2px;
    color: var(--text-faint);
  }

  .picks-list {
    color: var(--text-dim);
    margin-top: var(--sp-sm);
    padding-left: var(--sp-md);
  }

  .picks-cost {
    color: var(--text-faint);
    margin-left: var(--sp-xxs);
  }

  /* ─── Phase 97 / ISSUE-057 — error banner and report fallback ─────── */
  .run-error-banner {
    padding: var(--sp-sm) var(--sp-md);
    background: color-mix(in srgb, var(--loss) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--loss) 45%, transparent);
    border-radius: var(--radius-md);
    gap: var(--sp-xs);
  }

  .banner-title {
    color: var(--text);
    font-weight: 600;
    font-size: 14px;
  }

  .banner-message {
    color: var(--text-dim);
    font-size: 12px;
    line-height: 1.4;
    word-break: break-word;
  }

  .banner-actions {
    display: flex;
    gap: var(--sp-xs);
    margin-top: var(--sp-xs);
  }

  .report-fallback {
    align-items: center;
    text-align: center;
    padding: var(--sp-lg) var(--sp-md);
    background: var(--surface);
    border-radius: var(--radius-md);
    border: var(--border-faint);
    gap: var(--sp-xs);
  }

  .report-fallback-error {
    background: color-mix(in srgb, var(--loss) 6%, transparent);
    border-color: color-mix(in srgb, var(--loss) 35%, transparent);
  }

  /* Phase 120 / ISSUE-059 — Morning yesterday digest fallback. Smaller
     and tighter than the report fallback since the digest itself is a
     small inline block. */
  .digest-fallback {
    padding: var(--sp-sm) var(--sp-md);
    background: color-mix(in srgb, var(--loss) 6%, transparent);
    border: 1px solid color-mix(in srgb, var(--loss) 35%, transparent);
    border-radius: var(--radius-md);
    gap: var(--sp-xs);
  }
  .digest-fallback .fallback-title {
    font-size: 14px;
  }

  .fallback-title {
    font-family: var(--font-display);
    color: var(--accent);
    font-size: 18px;
    letter-spacing: 0.04em;
  }

  .fallback-sub {
    color: var(--text-dim);
    font-style: italic;
    font-size: 14px;
  }

  .fallback-error {
    color: var(--text-dim);
    font-size: 12px;
    line-height: 1.4;
    word-break: break-word;
    padding: var(--sp-xs) var(--sp-sm);
    background: var(--ink-deep);
    border-radius: var(--radius-sm);
    border: 1px solid color-mix(in srgb, var(--candle-soft) 30%, transparent);
    max-width: 100%;
  }

  /* ─── Report styling lives in DailyReport.svelte ─────────────────── */
</style>
