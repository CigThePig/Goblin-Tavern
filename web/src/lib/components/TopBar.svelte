<!--
  TopBar — Phase 192 / ISSUE-159 reframe.

  Was a calendar chronicle (`Day · Week · Month · <day-type>`); now a
  stakes summary — the one element visible on every screen carries the
  player's most actionable context:

    [mark]   Day N · <top pressure | "tavern steady">   [coin][time][?]

  - Center: day ordinal (tap → calendar peek popover) + the #1 pressure
    as a MetricLink chip, or "tavern steady" when nothing is rising.
  - Day-type badge: inline only when the day is non-baseline (not a
    `quiet_day`).
  - Right: coin MetricLink, a time-remaining chip (the phase-186 time
    economy — no AP), and the glossary button.
  - Welcome-back pill (Phase 96) behaviour is preserved.
-->
<script lang="ts">
  import Icon from './Icon.svelte'
  import TermLabel from './TermLabel.svelte'
  import MetricLink from './links/MetricLink.svelte'
  import {
    gameStore,
    DAY_MINUTES,
    formatDuration,
  } from '../sim/gameStore.svelte'
  import { topPressures } from '../sim/topPressures'
  import { glossaryStore } from '../glossary/glossaryStore.svelte'
  import { relativeTime } from '../sim/persistence'
  import { idLabel } from '../../../../src/reports/labels/idLabel'

  // Calendar cadence — mirrored locally (the calendar module keeps these
  // private and this component is web-only). Used only for the peek's
  // "days until milestone" line.
  const DAYS_PER_WEEK = 7
  const DAYS_PER_MONTH = 28
  // The unremarkable baseline day; its badge is chrome, so we omit it and
  // let the badge mean something on the six notable day types.
  const BASELINE_DAY_TYPE = 'quiet_day'

  const cal = $derived(gameStore.state.calendar)
  const dayOrdinal = $derived(`Day ${cal.day}`)
  const fullDate = $derived(
    `Day ${cal.day} · Week ${cal.week} · Month ${cal.month}`,
  )
  const dayTypeLabel = $derived(idLabel('dayType', cal.dayType))
  const dayTypeTermId = $derived(`dayType_${cal.dayType}`)
  const showBadge = $derived(cal.dayType !== BASELINE_DAY_TYPE)
  const coin = $derived(gameStore.state.coin)

  // The #1 pressure row — the same selection the PressureRibbon uses,
  // capped to one (the topbar is a summary, not the dashboard).
  const topPressure = $derived(topPressures(gameStore.state.pressures, 1)[0])

  function trendIcon(t: number): 'trend-up' | 'trend-flat' | 'trend-down' {
    if (t > 0.5) return 'trend-up'
    if (t < -0.5) return 'trend-down'
    return 'trend-flat'
  }

  // ── Time-remaining chip (time economy, phase 186 — no AP) ──────────
  const timeRemaining = $derived(DAY_MINUTES - gameStore.minutesQueued)
  // Hidden in the report beat; non-interactive in the morning (planning
  // hasn't begun); interactive once the player can spend time.
  const timeChipVisible = $derived(gameStore.beat !== 'report')
  const timeChipInteractive = $derived(
    gameStore.beat === 'plan' ||
      gameStore.beat === 'service' ||
      gameStore.beat === 'closing',
  )

  function openPicker() {
    gameStore.requestActionPicker()
  }

  // ── Calendar peek popover ──────────────────────────────────────────
  let peekOpen = $state(false)
  let peekEl: HTMLDivElement | undefined = $state(undefined)
  let dayChipEl: HTMLButtonElement | undefined = $state(undefined)

  const daysToWeekEnd = $derived(DAYS_PER_WEEK - cal.dayOfWeek)
  const daysToMonthEnd = $derived(DAYS_PER_MONTH - cal.day)

  function milestoneLine(days: number): string {
    if (days <= 0) return 'today'
    return days === 1 ? 'tomorrow' : `in ${days} days`
  }

  function togglePeek() {
    peekOpen = !peekOpen
  }

  function onDocumentPointer(e: MouseEvent) {
    if (!peekOpen) return
    const target = e.target as Node | null
    if (peekEl && target && peekEl.contains(target)) return
    if (dayChipEl && target && dayChipEl.contains(target)) return
    peekOpen = false
  }

  function onKey(e: KeyboardEvent) {
    if (peekOpen && e.key === 'Escape') peekOpen = false
  }

  $effect(() => {
    if (!peekOpen || typeof document === 'undefined') return
    document.addEventListener('click', onDocumentPointer, true)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('click', onDocumentPointer, true)
      document.removeEventListener('keydown', onKey)
    }
  })

  // ── Welcome-back pill (Phase 96) — unchanged ──────────────────────
  // Shown only when a save was just restored AND the wall-clock gap since
  // the last save is ≥ 4h. The store flips `savedSnapshotJustLoaded` off
  // on the first beat advance (or the 30s auto-dismiss in App.svelte).
  const welcomeBack = $derived.by(() => {
    if (!gameStore.savedSnapshotJustLoaded) return undefined
    if (!gameStore.lastSavedAt) return undefined
    return relativeTime(gameStore.lastSavedAt, new Date())
  })

  function openGlossary() {
    glossaryStore.show()
  }

  function dismissPill() {
    gameStore.dismissWelcomeBack()
  }
</script>

<header class="topbar">
  <div class="mark">
    <Icon name="mark" size={26} label="Goblin Tavern" />
  </div>

  <div class="day">
    <div class="day-line">
      <button
        type="button"
        class="day-chip"
        bind:this={dayChipEl}
        onclick={togglePeek}
        aria-haspopup="dialog"
        aria-expanded={peekOpen}
        aria-label="Open calendar peek"
      >
        {dayOrdinal}
      </button>
      <span class="sep">·</span>
      {#if topPressure}
        <MetricLink kind="pressure" id={topPressure.id}>
          <span class="pressure-chip" data-testid="topbar-pressure">
            <span class="pressure-label">{topPressure.label}</span>
            <span class="pressure-value mono">{Math.round(topPressure.value)}</span>
            <Icon name={trendIcon(topPressure.trend)} size={12} />
          </span>
        </MetricLink>
      {:else}
        <span class="steady" data-testid="topbar-steady">tavern steady</span>
      {/if}
      {#if showBadge}
        <span class="badge" data-testid="topbar-daytype">
          <TermLabel term={dayTypeTermId} label={dayTypeLabel} />
        </span>
      {/if}
    </div>

    {#if peekOpen}
      <div
        class="peek"
        role="dialog"
        aria-label="Calendar"
        bind:this={peekEl}
        data-testid="topbar-peek"
      >
        <p class="peek-date mono">{fullDate}</p>
        <p class="peek-daytype">
          <TermLabel term={dayTypeTermId} label={dayTypeLabel} />
        </p>
        <dl class="peek-milestones">
          <div>
            <dt>End of week</dt>
            <dd>{milestoneLine(daysToWeekEnd)}</dd>
          </div>
          <div>
            <dt>End of month</dt>
            <dd>{milestoneLine(daysToMonthEnd)}</dd>
          </div>
        </dl>
      </div>
    {/if}

    {#if welcomeBack}
      <button
        type="button"
        class="welcome"
        onclick={dismissPill}
        aria-label="Dismiss welcome message"
      >
        welcome back · {welcomeBack.phrase}
      </button>
    {/if}
  </div>

  <div class="right">
    <MetricLink kind="coin">
      <span class="coin mono">
        <Icon name="coin" size={14} />
        <span>{coin}</span>
      </span>
    </MetricLink>

    {#if timeChipVisible}
      {#if timeChipInteractive}
        <button
          type="button"
          class="time"
          onclick={openPicker}
          aria-label="Open action planner — {formatDuration(timeRemaining)} left today"
          data-testid="topbar-time"
        >
          <Icon name="day" size={13} />
          <span class="mono">{formatDuration(timeRemaining)}</span>
        </button>
      {:else}
        <span class="time time-static" data-testid="topbar-time">
          <Icon name="day" size={13} />
          <span class="mono">{formatDuration(timeRemaining)}</span>
        </span>
      {/if}
    {/if}

    <button
      type="button"
      class="help"
      aria-label="Open glossary"
      onclick={openGlossary}
    >
      ?
    </button>
  </div>
</header>

<style>
  .topbar {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: var(--sp-md);
    align-items: center;
    height: var(--topbar-h);
    padding: 0 var(--sp-md);
    /* Semantic token (not raw --ink) so parchment mode gets a light bar
       with dark text instead of dark-on-dark chrome. */
    background: var(--surface);
    border-bottom: var(--border-faint);
    position: sticky;
    top: 0;
    z-index: 10;
  }

  .mark {
    color: var(--accent);
    display: flex;
    align-items: center;
  }

  .day {
    position: relative;
    text-align: center;
    overflow: visible;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    min-width: 0;
  }

  .day-line {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    max-width: 100%;
    min-width: 0;
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--text-dim);
    white-space: nowrap;
    overflow: hidden;
  }

  /* The pressure chip is the only flexible element on the line: it
     shrinks (its label ellipsizes) before anything else clips, so the
     day ordinal and day-type badge always render whole. Previously the
     badge — the LAST flex item — was what got cut ("Supplie…"). */
  .day-line :global(.metric-link) {
    flex: 0 1 auto;
    min-width: 0;
    overflow: hidden;
  }

  .sep {
    flex-shrink: 0;
    color: var(--text-faint);
  }

  .day-chip {
    flex-shrink: 0;
    font: inherit;
    font-variant: small-caps;
    letter-spacing: 0.05em;
    color: var(--text-dim);
    background: transparent;
    border: none;
    border-bottom: 1px dotted transparent;
    padding: 0;
    cursor: pointer;
    transition:
      color var(--m-fast) var(--ease),
      border-color var(--m-fast) var(--ease);
  }

  .day-chip:hover,
  .day-chip:focus-visible {
    color: var(--text);
    border-bottom-color: color-mix(in srgb, var(--accent) 35%, transparent);
    outline: none;
  }

  .pressure-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--text);
    max-width: 100%;
    min-width: 0;
  }

  .pressure-label {
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 11ch;
    /* Keep at least a recognisable stem ("Food S…", "Landl…") — the
       label is the stakes summary; two letters is worse than no chip. */
    min-width: 6ch;
    flex: 0 1 auto;
  }

  /* Narrow phones: tighten the line and drop the trend glyph before
     letting the label squeeze below readability. */
  @media (max-width: 480px) {
    .day-line {
      font-size: 12px;
      gap: 4px;
    }

    .pressure-chip :global(svg) {
      display: none;
    }
  }

  .pressure-value {
    flex-shrink: 0;
    color: var(--text-dim);
  }

  .steady {
    font-style: italic;
    color: var(--text-dim);
  }

  .badge {
    flex-shrink: 0;
    font-variant: small-caps;
    letter-spacing: 0.05em;
    font-size: 11px;
    color: var(--accent-soft);
    background: color-mix(in srgb, var(--accent) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
    border-radius: 999px;
    padding: 0 7px;
  }

  /* ── Calendar peek popover ── */
  .peek {
    position: absolute;
    top: calc(100% + 6px);
    left: 50%;
    transform: translateX(-50%);
    z-index: 30;
    min-width: 200px;
    text-align: left;
    background: var(--surface);
    border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-md);
    padding: var(--sp-sm) var(--sp-md);
    display: flex;
    flex-direction: column;
    gap: var(--sp-xs);
  }

  .peek-date {
    margin: 0;
    color: var(--text);
    font-variant-numeric: tabular-nums;
  }

  .peek-daytype {
    margin: 0;
    font-size: 13px;
  }

  .peek-milestones {
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .peek-milestones div {
    display: flex;
    justify-content: space-between;
    gap: var(--sp-md);
    font-size: 12px;
  }

  .peek-milestones dt {
    color: var(--text-dim);
  }

  .peek-milestones dd {
    margin: 0;
    color: var(--text);
  }

  .welcome {
    font-family: var(--font-body);
    font-variant: small-caps;
    letter-spacing: 0.06em;
    font-size: 11px;
    color: var(--accent-soft);
    background: color-mix(in srgb, var(--accent) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent);
    border-radius: 999px;
    padding: 1px 8px;
    min-height: 18px;
    transition: opacity var(--m-fast) var(--ease);
  }

  .welcome:hover,
  .welcome:focus-visible {
    color: var(--accent);
    border-color: var(--accent);
  }

  .right {
    display: inline-flex;
    align-items: center;
    gap: var(--sp-sm);
  }

  .coin {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--accent);
  }

  .time {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--text-dim);
    background: transparent;
    border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
    border-radius: 999px;
    padding: 2px 9px;
    min-height: 24px;
    transition:
      color var(--m-fast) var(--ease),
      border-color var(--m-fast) var(--ease);
  }

  button.time:hover,
  button.time:focus-visible {
    color: var(--accent);
    border-color: var(--accent);
    outline: none;
  }

  .time-static {
    border-style: dashed;
    border-color: color-mix(in srgb, var(--accent) 18%, transparent);
  }

  .help {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 1px solid color-mix(in srgb, var(--accent) 50%, transparent);
    color: var(--text-faint);
    font-family: var(--font-body);
    font-size: 14px;
    line-height: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: color var(--m-fast) var(--ease), border-color var(--m-fast) var(--ease);
  }

  .help:hover,
  .help:focus-visible {
    color: var(--accent);
    border-color: var(--accent);
  }
</style>
