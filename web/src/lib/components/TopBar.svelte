<script lang="ts">
  import Icon from './Icon.svelte'
  import { gameStore } from '../sim/gameStore.svelte'
  import { glossaryStore } from '../glossary/glossaryStore.svelte'
  import { relativeTime } from '../sim/persistence'

  const cal = $derived(gameStore.state.calendar)
  const dayLabel = $derived(
    `Day ${cal.day} · Week ${cal.week} · Month ${cal.month} · ${formatDayType(cal.dayType)}`,
  )
  const coin = $derived(gameStore.state.coin)

  // Phase 96 — Welcome-back pill. Shown only when a save was just
  // restored AND the wall-clock gap since the last save is ≥ 4h. The
  // store flips `savedSnapshotJustLoaded` off on the first beat
  // advance (or on the 30s auto-dismiss in App.svelte), so this is
  // an intentionally short-lived surface.
  const welcomeBack = $derived.by(() => {
    if (!gameStore.savedSnapshotJustLoaded) return undefined
    if (!gameStore.lastSavedAt) return undefined
    return relativeTime(gameStore.lastSavedAt, new Date())
  })

  function formatDayType(d: string): string {
    return d
      .split('_')
      .map((w) => w[0]!.toUpperCase() + w.slice(1))
      .join(' ')
  }

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
    <span class="day-line">{dayLabel}</span>
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
    <div class="coin mono">
      <Icon name="coin" size={14} />
      <span>{coin}</span>
    </div>
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
    background: var(--ink);
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
    text-align: center;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }

  .day-line {
    font-family: var(--font-body);
    font-variant: small-caps;
    letter-spacing: 0.05em;
    font-size: 13px;
    color: var(--text-dim);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    display: inline-block;
    max-width: 100%;
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
