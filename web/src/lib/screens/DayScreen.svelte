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
  import MetricLink from '../components/links/MetricLink.svelte'
  import EntityLink from '../components/links/EntityLink.svelte'
  import { entityKindFromTargetType } from '../components/links/types'
  import CardRenderer from '../cards/CardRenderer.svelte'
  import CardDeck from '../components/CardDeck.svelte'
  import BeatTransition from '../components/BeatTransition.svelte'
  import ActionPicker from '../components/ActionPicker.svelte'
  import StaffPrioritySheet from '../components/StaffPrioritySheet.svelte'
  import DailyReport from '../components/DailyReport.svelte'
  import YesterdayDigest from '../components/YesterdayDigest.svelte'
  import { renderCard } from '../cards/realCardRegistry'
  import {
    committedCoinCost,
    committedOwnerTimeCost,
    gateChoicesByCoin,
    gateChoicesByTime,
  } from '../cards/affordability'
  import { selectionLabelOf } from '../sim/selectionLabel'
  import { formatDuration } from '../sim/actionBuilder'
  import { staffPriorityRegistry } from '../../../../src/sim/registries/staffPriorityRegistry'
  import { gameStore, type ActionPickerRequest } from '../sim/gameStore.svelte'
  import { prefsStore } from '../prefs/prefsStore.svelte'
  import { buildResponseIntents } from '../sim/intentBuilder'
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
  // Phase 195 / ISSUE-162 — context for the most recent open request: the
  // tab to preselect + whether to scroll the Suggested section into view.
  // Set when a drilldown "Plan an action" CTA opens the picker; the TopBar
  // path leaves it at its defaults.
  let pickerRequest = $state<ActionPickerRequest | undefined>(undefined)

  // Phase 192 / ISSUE-159 — the global TopBar time chip (and the phase-195
  // drilldown CTA) route here and flag a request to open the ActionPicker
  // (the picker is screen-local). Consume-once: a later re-render finds the
  // flag cleared and does not re-open.
  $effect(() => {
    const req = gameStore.consumeActionPickerRequest()
    if (req) {
      pickerRequest = req
      pickerOpen = true
    }
  })
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

  // Phase 200 / audit Wave 1 (`P7-EXP-001`) — a choice the till cannot
  // cover is disabled here, before the player commits, rather than
  // silently refused at End Day. Priced against the choices already
  // committed today, with the same cost function the sim enforces.
  const morningCards = $derived(
    morningSeeds.map((seed) => ({
      seed,
      // Phase 203 / audit Wave 4 (`P6-COMP-005`) — and the same gate for
      // the day clock, which owner actions and card choices share.
      view: gateChoicesByTime(
        gateChoicesByCoin(renderCard(seed, gameStore.state), seed, {
          coin: gameStore.state.coin,
          committed: committedCoinCost(
            gameStore.todaysSeeds,
            pendingBySeedId,
            seed.id,
          ),
        }),
        seed,
        {
          queuedMinutes: gameStore.minutesQueued,
          committed: committedOwnerTimeCost(
            gameStore.todaysSeeds,
            pendingBySeedId,
            seed.id,
          ),
        },
      ),
      pending: pendingBySeedId[seed.id],
    })),
  )

  const staffCount = $derived(Object.keys(gameStore.state.staff).length)

  // Phase 202 / audit Wave 3 (`P6-COMP-004`) — name the staff member and
  // the focus they are on, so the plan beat answers "what did I set?"
  // without opening the sheet.
  const staffPrioritySummary = $derived.by(() => {
    const entries = Object.entries(staffPriorities)
    if (entries.length === 0) return 'using defaults'
    const named = entries.slice(0, 2).map(([staffId, priorityId]) => {
      const member = gameStore.state.staff[staffId]
      const who = member?.name.display ?? staffId
      const focus = staffPriorityRegistry.has(priorityId)
        ? staffPriorityRegistry.get(priorityId).label
        : priorityId
      return `${who}: ${focus}`
    })
    const rest = entries.length - named.length
    return rest > 0 ? `${named.join(' · ')} +${rest}` : named.join(' · ')
  })

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

  // Phase 190b / ISSUE-157b — the at-a-glance stock summary is now a
  // structured list so each chip can be an individual `EntityLink` onto
  // its `StockDetailSheet` (the joined string was a dead end). `moreCount`
  // becomes an id-less link to Tavern → Stock (no auto-open).
  const stockChips = $derived(
    Object.values(gameStore.state.stock)
      .slice(0, 3)
      .map((s) => ({ id: s.id, label: `${s.label.toLowerCase()} ${s.quantity}` })),
  )
  const stockMoreCount = $derived(
    Math.max(0, Object.keys(gameStore.state.stock).length - stockChips.length),
  )

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
      // Phase 201 / audit Wave 2 (`P4-SEAM-002`, `P6-COMP-006`) — a daily
      // report describes ONE day and must project from that day's state.
      // Passing the live store state made a closed report follow the next
      // morning: its missed opportunities became today's cards and its
      // resolved-choice ledger emptied.
      buildDailyReport(result, gameStore.closedDayState ?? gameStore.state, {
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
    //
    // Phase 2 (teleology) — build against the store's RESOLVABLE seed set
    // (visible hand ∪ surfaced-but-displaced), not the three visible-hand
    // slices. On a crowded day Segment B can displace a seed from the
    // budgeted hand after the player chose against its card; iterating only
    // `morningSeeds/serviceSeeds/closingSeeds` would skip that seed and the
    // pending choice would be silently dropped (no intent → the engine's
    // `getResolvableSeedsToday` lookup is never reached). `resolvableSeeds`
    // keeps the displaced seed's choice resolvable.
    const intents: ResponseIntent[] = buildResponseIntents(
      gameStore.resolvableSeeds,
      pendingBySeedId,
    )
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
    <!-- Phase 195 / ISSUE-162 — yesterday's outcome leads the morning: it
         is more decision-relevant than today's static counts, so the digest
         (with its optional "Today's watch" cue) renders ABOVE the
         at-a-glance row. -->
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

    <section class="block" aria-label="At a glance">
      <!-- Phase 190b — every glance figure is a tap target: coin opens the
           coin drilldown; "N staff" lands on Tavern → Staff (no specific
           id, so no sheet auto-opens); each stock chip opens its
           StockDetailSheet; "+N more" lands on Tavern → Stock. -->
      <div class="glance">
        <span class="glance-item">
          <span class="glance-label">Coin</span>
          <span class="glance-value mono">
            <Icon name="coin" size={13} />
            <MetricLink kind="coin">{gameStore.state.coin}</MetricLink>
          </span>
        </span>
        <span class="glance-item">
          <span class="glance-label">Staff</span>
          <span class="glance-value mono">
            <Icon name="staff" size={13} />
            <EntityLink kind="staff" id="" label={`${staffCount} staff`} />
          </span>
        </span>
        <span class="glance-item glance-stock">
          <span class="glance-label">Stock</span>
          <span class="glance-value mono stock-glance">
            <Icon name="stock" size={13} />
            {#each stockChips as chip, i (chip.id)}
              {#if i > 0}<span class="sep" aria-hidden="true">·</span>{/if}
              <EntityLink kind="stock" id={chip.id} label={chip.label} />
            {/each}
            {#if stockMoreCount > 0}
              <span class="sep" aria-hidden="true">·</span>
              <EntityLink kind="stock" id="" label={`+${stockMoreCount} more`} />
            {/if}
          </span>
        </span>
      </div>
      {#if forecastExpected !== undefined}
        <!-- Phase 186 / Cluster 5 — forecast-as-expected (§3.6). Framed
             as a guess that the morning plan will move, never a settled
             number. -->
        <p class="forecast chip">
          ~{forecastExpected} guests expected · before your moves
        </p>
      {/if}
    </section>

    <section class="block" aria-label="Pressures">
      <h2 class="block-label section-label">Rising</h2>
      <PressureRibbon />
    </section>

    <section class="block" aria-label="Morning">
      <h2 class="block-label section-label">Morning</h2>
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
                <!-- Phase 190b — the pending tag re-opens the decision:
                     decisions stay uncommitted until End Day, so tapping
                     clears the pending choice and the card's choices below
                     go live again for revision. -->
                <button
                  class="pending chip"
                  type="button"
                  onclick={() => gameStore.clearSeed(seed.id)}
                  aria-label="Revise this decision"
                  title="Revise"
                >
                  <!-- Phase 202 / audit Wave 3 (`P6-COMP-001`) — the
                       player's wording, plus the finality answer. -->
                  <strong>{selectionLabelOf(pending)}</strong>
                  <span class="selection-status"
                    >Selected — revisable until End Day</span
                  >
                  <span class="revise-hint" aria-hidden="true">↺</span>
                </button>
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
        <!-- Phase 196 / ISSUE-163 — Quick Day reads as a real peer to "Plan
             the day" (the `.primary` outline treatment) rather than an italic
             footnote, so a card-free morning presents two genuine choices.
             Eligibility is unchanged; this is styling only. -->
        <button class="primary quick-day" type="button" onclick={runQuickDay}>
          {quickDayLabel}
        </button>
      {/if}
    </section>
  {/if}

  <!-- ─── Beat 2: Plan ────────────────────────────────────────────── -->
  {#if beat === 'plan'}
    <section class="block" aria-label="Planning summary">
      <h2 class="block-label section-label">Plan the day</h2>
      <p class="lede">
        Spend your day on owner actions, set staff priorities. Service runs after.
      </p>
    </section>

    <section class="block">
      <!-- Phase 190b — the whole plan row is the tap target. Each row is a
           single button (keyboard + pointer accessible, no nested
           interactive); the right-side "Pick"/"Set" text is the action
           hint that used to be a separate button. -->
      <div class="plan-rows">
        <button
          class="plan-row tappable"
          type="button"
          onclick={() => (pickerOpen = true)}
        >
          <span class="plan-main">
            <span class="plan-title">Owner actions</span>
            <span class="plan-sub chip">
              {picks.length === 0
                ? 'none yet'
                : picks.length === 1
                  ? '1 action picked'
                  : `${picks.length} actions picked`}
            </span>
          </span>
          <span class="plan-hint">{picks.length === 0 ? 'Pick' : 'Edit'}</span>
        </button>

        <button
          class="plan-row tappable"
          type="button"
          onclick={() => (staffSheetOpen = true)}
        >
          <span class="plan-main">
            <span class="plan-title">Staff priorities</span>
            <!-- Phase 202 / audit Wave 3 (`P6-COMP-004`) — "1 customised"
                 told the player nothing about who was doing what. -->
            <span class="plan-sub chip">
              {staffPrioritySummary}
            </span>
          </span>
          <span class="plan-hint">Set</span>
        </button>
      </div>

      {#if picks.length > 0}
        <ul class="picks-list mono">
          {#each picks as p (p.pickId)}
            <li>
              · {p.label}{#if p.targetLabel}: {@const k = p.targetType
                ? entityKindFromTargetType(p.targetType)
                : undefined}{#if k && p.targetId}<EntityLink
                  kind={k}
                  id={p.targetId}
                  label={p.targetLabel}
                />{:else}{p.targetLabel}{/if}{/if}
              <span class="picks-cost">({formatDuration(p.timeCost)})</span>
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
      <h2 class="block-label section-label">Service</h2>
      {#if gameStore.serviceOutcome}
        <!-- The day has already happened by this beat (Segment B ran on
             "Run service") — show its headline instead of letting the
             topbar coin jump unexplained. -->
        <div class="service-outcome" data-testid="service-outcome">
          <span class="outcome-stat">
            <Icon name="staff" size={14} />
            <span class="mono">{gameStore.serviceOutcome.patrons}</span>
            <span class="outcome-label">patrons</span>
          </span>
          <span class="outcome-stat" class:gain={gameStore.serviceOutcome.netCoin > 0} class:loss={gameStore.serviceOutcome.netCoin < 0}>
            <Icon name="coin" size={14} />
            <span class="mono">
              {gameStore.serviceOutcome.netCoin > 0 ? '+' : ''}{gameStore.serviceOutcome.netCoin}
            </span>
            <span class="outcome-label">coin</span>
          </span>
          {#if gameStore.serviceOutcome.incidents > 0}
            <span class="outcome-stat loss">
              <Icon name="stake-risk" size={14} />
              <span class="mono">{gameStore.serviceOutcome.incidents}</span>
              <span class="outcome-label">
                {gameStore.serviceOutcome.incidents === 1 ? 'incident' : 'incidents'}
              </span>
            </span>
          {/if}
        </div>
      {/if}
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
      <h2 class="block-label section-label">Closing</h2>
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
<ActionPicker
  open={pickerOpen}
  onclose={() => (pickerOpen = false)}
  previousReport={dailyReport.ok === 'success' ? dailyReport.data : undefined}
  requestedTab={pickerRequest?.tab}
  focusSuggested={pickerRequest?.focusSuggested ?? false}
  preferredTargetId={pickerRequest?.preferredTargetId}
  preferredTargetLabel={pickerRequest?.preferredTargetLabel}
  handoffReason={pickerRequest?.reason}
/>
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
    gap: var(--sp-md) var(--sp-lg);
    padding: var(--sp-sm) var(--sp-md);
    background: var(--surface);
    border-radius: var(--radius-md);
    color: var(--text-dim);
    border: var(--border-faint);
  }

  /* Each figure carries a micro-label so the strip reads as labelled
     stats, not anonymous mono fragments. */
  .glance-item {
    display: inline-flex;
    flex-direction: column;
    gap: 1px;
  }

  .glance-label {
    font-family: var(--font-body);
    font-variant: small-caps;
    letter-spacing: 0.06em;
    font-size: 11px;
    color: var(--text-faint);
  }

  .glance-value {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .glance-value :global(svg) {
    color: var(--accent-soft);
  }

  /* Phase 190b — stock chips wrap as a row of EntityLinks separated by
     middots; keep them on the same baseline as the icon. */
  .stock-glance {
    flex-wrap: wrap;
  }

  .stock-glance .sep {
    color: var(--text-faint);
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

  /* Service headline strip — the day's outcome at a glance, shown the
     moment service has run. */
  .service-outcome {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-md);
    padding: var(--sp-sm) var(--sp-md);
    background: var(--surface);
    border: var(--border-faint);
    border-radius: var(--radius-md);
  }

  .outcome-stat {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    color: var(--text-dim);
  }

  .outcome-stat .mono {
    color: var(--text);
    font-size: 15px;
  }

  .outcome-stat.gain .mono {
    color: var(--gain);
  }

  .outcome-stat.loss .mono {
    color: var(--loss);
  }

  .outcome-label {
    font-size: 13px;
    color: var(--text-faint);
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
    background: var(--bg);
    padding: 2px 8px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--candle-soft);
    /* Phase 190b — now a button: tapping re-opens the decision. */
    display: inline-flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    transition: border-color var(--m-fast) var(--ease),
      color var(--m-fast) var(--ease);
  }

  .pending:hover,
  .pending:focus-visible {
    border-color: var(--accent);
    color: var(--accent);
  }

  .pending strong {
    color: var(--accent);
    font-weight: 500;
  }

  .selection-status {
    display: block;
    font-size: 0.85em;
    opacity: 0.75;
  }

  .revise-hint {
    color: var(--text-faint);
    font-size: 11px;
  }

  .actions {
    flex-direction: row;
    gap: var(--sp-sm);
    align-items: center;
  }

  /* Filled primary — the one button that advances the game should be the
     brightest thing on screen. Ink-on-candle in dark mode, parchment-on-
     umber in light (both read off tokens). Ghost/secondary stay outlines,
     so the hierarchy is legible at a glance. */
  .primary {
    flex: 1;
    font-family: var(--font-display);
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    font-size: 14px;
    color: var(--bg);
    background: var(--accent);
    border: 1px solid var(--accent);
    border-radius: var(--radius-sm);
    padding: 14px;
    min-height: 48px;
    box-shadow: 0 2px 10px color-mix(in srgb, var(--accent) 25%, transparent);
    transition:
      background var(--m-fast) var(--ease),
      box-shadow var(--m-fast) var(--ease),
      transform var(--m-fast) var(--ease);
  }

  .primary:hover,
  .primary:focus-visible {
    background: color-mix(in srgb, var(--accent) 88%, white);
    box-shadow: 0 2px 16px color-mix(in srgb, var(--accent) 40%, transparent);
  }

  .primary:active {
    transform: translateY(1px);
    box-shadow: 0 1px 4px color-mix(in srgb, var(--accent) 25%, transparent);
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

  /* Phase 196 / ISSUE-163 — Quick Day is a peer affordance to "Plan the
     day", not a footnote: it keeps the `.primary` footprint (display
     font, full tap target) but stays an outline so the filled "Plan the
     day" remains the recommended default. Two real options, clear
     default. */
  .quick-day {
    color: var(--text);
    background: transparent;
    border-color: color-mix(in srgb, var(--candle-soft) 55%, transparent);
    box-shadow: none;
  }

  .quick-day:hover,
  .quick-day:focus-visible {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 12%, transparent);
    box-shadow: none;
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

  /* Phase 190b — the whole row is a single tap-target button (was a div
     with a nested button). Keeps the same visual layout; the right-side
     "Pick"/"Set" text is now an inline hint instead of a button. */
  .plan-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-md);
    padding: var(--sp-sm) var(--sp-md);
    width: 100%;
    text-align: left;
    background: var(--surface);
    border-radius: var(--radius-md);
    border: var(--border-faint);
    cursor: pointer;
    transition: border-color var(--m-fast) var(--ease);
  }

  .plan-row.tappable:hover,
  .plan-row.tappable:focus-visible {
    border-color: var(--accent);
  }

  .plan-main {
    display: flex;
    flex-direction: column;
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

  .plan-hint {
    flex-shrink: 0;
    font-family: var(--font-body);
    font-variant: small-caps;
    letter-spacing: 0.06em;
    font-size: 13px;
    color: var(--accent);
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
    background: var(--bg);
    border-radius: var(--radius-sm);
    border: 1px solid color-mix(in srgb, var(--candle-soft) 30%, transparent);
    max-width: 100%;
  }

  /* ─── Report styling lives in DailyReport.svelte ─────────────────── */
</style>
