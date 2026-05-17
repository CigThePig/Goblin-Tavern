<script lang="ts">
  import Icon from './Icon.svelte'
  import { gameStore } from '../sim/gameStore.svelte'
  import { glossaryStore } from '../glossary/glossaryStore.svelte'

  const cal = $derived(gameStore.state.calendar)
  const dayLabel = $derived(
    `Day ${cal.day} · Week ${cal.week} · Month ${cal.month} · ${formatDayType(cal.dayType)}`,
  )
  const coin = $derived(gameStore.state.coin)

  function formatDayType(d: string): string {
    return d
      .split('_')
      .map((w) => w[0]!.toUpperCase() + w.slice(1))
      .join(' ')
  }

  function openGlossary() {
    glossaryStore.show()
  }
</script>

<header class="topbar">
  <div class="mark">
    <Icon name="mark" size={26} label="Goblin Tavern" />
  </div>
  <div class="day">
    <span class="day-line">{dayLabel}</span>
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
