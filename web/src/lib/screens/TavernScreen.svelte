<!--
  TavernScreen — top-level Tavern tab.

  Sub-nav: Areas | Stock | Recipes | Staff | Projects

  Each panel reads from a slice of `buildTavernOverview(state)`. Quick
  actions inside detail sheets and policy/recipe toggles queue picks
  via `gameStore`; the sticky `ActionQueueChip` opens the existing
  `ActionPicker` for editing.
-->
<script lang="ts">
  import AreasPanel from '../components/tavern/AreasPanel.svelte'
  import StockPanel from '../components/tavern/StockPanel.svelte'
  import RecipesPanel from '../components/tavern/RecipesPanel.svelte'
  import StaffPanel from '../components/tavern/StaffPanel.svelte'
  import ProjectsPanel from '../components/tavern/ProjectsPanel.svelte'
  import ActionQueueChip from '../components/tavern/ActionQueueChip.svelte'
  import ActionPicker from '../components/ActionPicker.svelte'
  import { gameStore } from '../sim/gameStore.svelte'
  import { buildTavernOverview } from '../../../../src/reports/index'
  import type { TavernOverviewData } from '../../../../src/reports/tavernOverviewProjection'

  type Subview = 'areas' | 'stock' | 'recipes' | 'staff' | 'projects'

  const TABS: { id: Subview; label: string }[] = [
    { id: 'areas', label: 'Areas' },
    { id: 'stock', label: 'Stock' },
    { id: 'recipes', label: 'Recipes' },
    { id: 'staff', label: 'Staff' },
    { id: 'projects', label: 'Projects' },
  ]

  // Phase 93 / ISSUE-053 — Subview lives on the store and persists
  // through the save envelope so Continue lands on the same tab.
  const subview = $derived(gameStore.tavernSubview)
  function setSubview(s: Subview) {
    gameStore.setTavernSubview(s)
  }
  let pickerOpen = $state(false)

  const data = $derived<TavernOverviewData>(buildTavernOverview(gameStore.state))
</script>

<main class="tavern">
  <nav class="subnav" aria-label="Tavern section">
    {#each TABS as tab (tab.id)}
      <button
        type="button"
        class="subtab"
        class:active={subview === tab.id}
        aria-current={subview === tab.id ? 'page' : undefined}
        onclick={() => setSubview(tab.id)}
      >
        {tab.label}
      </button>
    {/each}
  </nav>

  <section class="content">
    {#if subview === 'areas'}
      <AreasPanel data={data.areas} />
    {:else if subview === 'stock'}
      <StockPanel data={data.stock} />
    {:else if subview === 'recipes'}
      <RecipesPanel data={data.recipes} />
    {:else if subview === 'staff'}
      <StaffPanel data={data.staff} />
    {:else if subview === 'projects'}
      <ProjectsPanel data={data.projects} />
    {/if}
  </section>
</main>

<ActionQueueChip onopen={() => (pickerOpen = true)} />
<ActionPicker open={pickerOpen} onclose={() => (pickerOpen = false)} />

<style>
  .tavern {
    display: flex;
    flex-direction: column;
    gap: var(--sp-md);
    padding: var(--sp-md);
    padding-bottom: calc(var(--nav-h) + var(--sp-xxl));
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
    transition: color var(--m-fast) var(--ease),
      background var(--m-fast) var(--ease);
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
</style>
