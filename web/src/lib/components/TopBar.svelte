<script lang="ts">
  import Icon from './Icon.svelte'
  import { gameStore } from '../sim/gameStore.svelte'

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
</script>

<header class="topbar">
  <div class="mark">
    <Icon name="mark" size={26} label="Goblin Tavern" />
  </div>
  <div class="day">
    <span class="day-line">{dayLabel}</span>
  </div>
  <div class="coin mono">
    <Icon name="coin" size={14} />
    <span>{coin}</span>
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

  .coin {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--accent);
  }
</style>
