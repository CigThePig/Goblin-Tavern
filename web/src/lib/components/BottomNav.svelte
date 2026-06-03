<script lang="ts">
  import Icon from './Icon.svelte'
  import type { Route } from '../sim/persistence'
  import { gameStore } from '../sim/gameStore.svelte'

  let {
    active,
    onnavigate,
  }: { active: Route; onnavigate: (r: Route) => void } = $props()

  const tabs: { id: Route; label: string; icon: 'day' | 'reports' | 'tavern' | 'world' | 'more' }[] = [
    { id: 'day', label: 'Day', icon: 'day' },
    { id: 'reports', label: 'Reports', icon: 'reports' },
    { id: 'tavern', label: 'Tavern', icon: 'tavern' },
    { id: 'world', label: 'World', icon: 'world' },
    { id: 'more', label: 'More', icon: 'more' },
  ]

  // Phase 196 / ISSUE-163 — Day is where the game advances; the other tabs
  // are reference. The dot is a "you have work waiting in Day" cue that
  // earns its place because picks are a cross-screen queue (Tavern panels
  // enqueue them). Only show it when the player has navigated away — once
  // they're on the Day tab the work is in front of them, so the cue retires.
  const dayDot = $derived(active !== 'day' && gameStore.hasUnresolvedDayWork)
</script>

<nav class="bottom-nav" aria-label="Primary">
  {#each tabs as tab (tab.id)}
    <button
      class="tab"
      class:active={active === tab.id}
      class:day-tab={tab.id === 'day'}
      aria-current={active === tab.id ? 'page' : undefined}
      onclick={() => onnavigate(tab.id)}
    >
      <span class="icon-wrap">
        <Icon name={tab.icon} size={20} />
        {#if tab.id === 'day' && dayDot}
          <span class="work-dot" aria-hidden="true"></span>
        {/if}
      </span>
      <span class="label">{tab.label}</span>
    </button>
  {/each}
</nav>

<style>
  .bottom-nav {
    position: sticky;
    bottom: 0;
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    height: var(--nav-h);
    background: var(--ink);
    border-top: var(--border-faint);
    padding-bottom: env(safe-area-inset-bottom, 0);
    z-index: 10;
  }

  .tab {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    color: var(--text-faint);
    transition: color var(--m-fast) var(--ease);
    position: relative;
    min-height: 44px;
  }

  .tab:hover {
    color: var(--text-dim);
  }

  .tab.active {
    color: var(--accent);
  }

  /* Phase 196 — Day is the tab where the game advances; the rest are
     reference. It always carries the accent, faded when inactive and full
     when active, so its primacy reads at a glance without changing the
     5-tab layout. `.tab.active` (higher specificity) wins for the active
     case, lighting it to full accent. */
  .day-tab {
    color: color-mix(in srgb, var(--accent) 55%, transparent);
  }

  .day-tab:hover {
    color: var(--accent);
  }

  .tab.active::after {
    content: '';
    position: absolute;
    bottom: 6px;
    width: 16px;
    height: 1px;
    background: var(--accent);
  }

  /* Wrap so the unresolved-work dot can anchor to the icon, not the label. */
  .icon-wrap {
    position: relative;
    display: inline-flex;
  }

  /* Phase 196 — "work waiting in Day" cue. Small accent dot pinned to the
     icon's top-right; only rendered when the player has navigated away from
     Day with queued picks or unresolved cards. */
  .work-dot {
    position: absolute;
    top: -2px;
    right: -3px;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--accent);
    border: 1px solid var(--ink);
  }

  /* Phase 194 — primary nav labels read as actions, not atmosphere:
     sentence case, no small-caps, so they parse at a glance. */
  .label {
    font-family: var(--font-body);
    font-size: 12px;
  }
</style>
