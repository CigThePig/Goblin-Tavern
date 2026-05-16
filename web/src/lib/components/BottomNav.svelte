<script lang="ts">
  import Icon from './Icon.svelte'

  export type Route = 'day' | 'reports' | 'tavern' | 'world'

  let {
    active,
    onnavigate,
  }: { active: Route; onnavigate: (r: Route) => void } = $props()

  const tabs: { id: Route; label: string; icon: 'day' | 'reports' | 'tavern' | 'world' }[] = [
    { id: 'day', label: 'Day', icon: 'day' },
    { id: 'reports', label: 'Reports', icon: 'reports' },
    { id: 'tavern', label: 'Tavern', icon: 'tavern' },
    { id: 'world', label: 'World', icon: 'world' },
  ]
</script>

<nav class="bottom-nav" aria-label="Primary">
  {#each tabs as tab (tab.id)}
    <button
      class="tab"
      class:active={active === tab.id}
      aria-current={active === tab.id ? 'page' : undefined}
      onclick={() => onnavigate(tab.id)}
    >
      <Icon name={tab.icon} size={20} />
      <span class="label">{tab.label}</span>
    </button>
  {/each}
</nav>

<style>
  .bottom-nav {
    position: sticky;
    bottom: 0;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
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

  .tab.active::after {
    content: '';
    position: absolute;
    bottom: 6px;
    width: 16px;
    height: 1px;
    background: var(--accent);
  }

  .label {
    font-family: var(--font-body);
    font-variant: small-caps;
    letter-spacing: 0.06em;
    font-size: 12px;
  }
</style>
