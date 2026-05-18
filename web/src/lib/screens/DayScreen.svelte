<!--
  DayScreen — the 5-beat day loop.

  Beats:
    1. morning   — at-a-glance + pressures + morning_prep cards
    2. plan      — owner action picker + staff priority sheet
    3. service   — during_service deck (or skip-light)
    4. closing   — closing + end_week + end_month deck
    5. report    — minimal diff dialog (Phase 89 owns the full report)

  Player decisions accumulate in `pendingByseedId` (response intents per
  seed) and `picks` (owner actions) plus `staffPriorities` (sticky
  across days). All three flush into a single `gameStore.runDay(...)`
  call when the player taps End Day. The engine sees one
  `simulateDay` per game-day.

  Phase 96 lifted `beat`, `pendingBySeedId`, and the two deck-complete
  flags onto `gameStore` so a refresh resumes on the same beat with
  intents preserved. The morning beat also offers a Quick Day shortcut
  when the sim produced zero valid seeds across all five timing slots
  (game-loop §3.7), and a "Yesterday" digest when a previous day's
  report exists (game-loop §2.3).
-->
<script lang="ts">
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
  import { gameStore } from '../sim/gameStore.svelte'
  import { buildIntent, buildIgnoreIntent } from '../sim/intentBuilder'
  import { buildDailyReport } from '../../../../src/reports/index'
  import { projectYesterdayDigest } from '../../../../src/reports/yesterdayDigest'
  // Phase 95 — Voice composer. The day-screen empty-state lines
  // pull from the same `composeEmpty` pool the report header uses,
  // deterministically keyed by (tavernId, day, beat).
  import { composeEmpty } from '../../../../src/cards/voice/index'
  import type { CardChoice } from '../cards/types'
  import type { IssueSeed } from '../cards/types'
  import type { ResponseIntent } from '../../../../src/sim/modules/issues/issueSeedTypes'
  import type { PendingChoice } from '../sim/daySession'

  // Phase 96 — Beat & pending state read from the store so they survive
  // a reload. The store also resets these on `runDay()`.
  const beat = $derived(gameStore.beat)
  const picks = $derived(gameStore.picks)
  const staffPriorities = $derived(gameStore.staffPriorities)
  const pendingBySeedId = $derived(gameStore.pendingBySeedId)
  const serviceComplete = $derived(gameStore.serviceComplete)

  let pickerOpen = $state(false)
  let staffSheetOpen = $state(false)
  // `transitioning` is the only beat-local view bit — it's a pacing
  // animation flag. Restoring it on hydration would mean replaying a
  // half-finished service transition, which is a UX bug. Stays local.
  let transitioning = $state(false)

  // ── Derived seed slices ───────────────────────────────────────────
  const morningSeeds = $derived(gameStore.seedsForTiming('morning_prep'))
  const serviceSeeds = $derived(gameStore.seedsForTiming('during_service'))
  const closingSeeds = $derived([
    ...gameStore.seedsForTiming('closing'),
    ...gameStore.seedsForTiming('end_week'),
    ...gameStore.seedsForTiming('end_month'),
  ])

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
  const stockSummary = $derived.by(() => {
    const entries = Object.values(gameStore.state.stock)
    const shown = entries.slice(0, 3)
    const more = entries.length - shown.length
    const parts = shown.map((s) => `${s.label.toLowerCase()} ${s.quantity}`)
    if (more > 0) parts.push(`+${more} more`)
    return parts.join(' · ')
  })

  const dailyReport = $derived.by(() => {
    const result = gameStore.latestResult
    if (!result) return undefined
    return buildDailyReport(result, gameStore.state, {
      ...(gameStore.previousCalendar ? { previousCalendar: gameStore.previousCalendar } : {}),
    })
  })

  // Phase 96 — Morning yesterday digest. Only shows when the engine
  // has a previous day to summarise. Derived from the same
  // DailyReportData the Report screen would render.
  const yesterdayDigest = $derived.by(() => {
    if (beat !== 'morning') return undefined
    if (!dailyReport) return undefined
    return projectYesterdayDigest(dailyReport)
  })

  const nextDayLabel = $derived.by(() => {
    if (dailyReport?.header.isEndOfMonth) return 'Close the month'
    if (dailyReport?.header.isEndOfWeek) return 'Close the week'
    return 'Next day'
  })

  // Phase 95 — Voice for empty-state lines. Key uses the calendar day
  // ordinal so a single calendar day reads the same line through all
  // three beats unless the player relaunches the app on a new day.
  const voiceKeyBase = $derived(
    `${gameStore.state.meta.tavernId}.d${gameStore.state.calendar.totalDaysElapsed}`,
  )
  const morningEmpty = $derived(composeEmpty('morning', `${voiceKeyBase}.morning`))
  const serviceEmpty = $derived(composeEmpty('service', `${voiceKeyBase}.service`))
  const closingEmpty = $derived(composeEmpty('closing', `${voiceKeyBase}.closing`))

  // ── Beat transitions ──────────────────────────────────────────────
  function startPlanning() {
    gameStore.setBeat('plan')
  }

  function startService() {
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

  function endDay() {
    // Bundle every player input into one simulateDay call. This is the
    // single mutation point per game-day. Picks and staffPriorities are
    // already on the store; runDay reads them automatically.
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
    gameStore.runDay({ responseIntents: intents })
    gameStore.setBeat('report')
  }

  // Phase 96 — Quick Day path. Skips Beats 2-4 entirely. Submits any
  // picks the player queued from other surfaces (Tavern panels, etc.)
  // along with sticky staff priorities.
  function runQuickDay() {
    gameStore.runDay({ responseIntents: [] })
    gameStore.setBeat('report')
  }

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
    </section>

    {#if yesterdayDigest}
      <section class="block" aria-label="Yesterday">
        <YesterdayDigest digest={yesterdayDigest} onopen={openTodayReport} />
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
        Pick up to 3 owner actions, set staff priorities. Service runs after.
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
              <span class="picks-cost">({p.actionPointCost} pt)</span>
            </li>
          {/each}
        </ul>
      {/if}
    </section>

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

    <section class="block actions">
      <button class="primary" type="button" onclick={endDay}>
        End day
      </button>
    </section>
  {/if}

  <!-- ─── Beat 5: Report ─────────────────────────────────────────── -->
  {#if beat === 'report' && dailyReport}
    <DailyReport report={dailyReport} />

    <section class="block actions">
      <button class="primary" type="button" onclick={nextDay}>
        {nextDayLabel}
      </button>
    </section>
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

  /* ─── Report styling lives in DailyReport.svelte ─────────────────── */
</style>
