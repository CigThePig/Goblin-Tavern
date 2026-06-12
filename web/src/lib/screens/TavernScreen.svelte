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
  import { safeProject, type ProjectionSlot } from '../sim/projectionSlot'

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

  // Phase 120 / ISSUE-059 — Wrap the cross-module projection so a throw
  // surfaces a screen-local "unavailable" panel instead of unmounting
  // the whole AppShell through the top-level boundary.
  const data: ProjectionSlot<TavernOverviewData> = $derived.by(() =>
    safeProject(() => buildTavernOverview(gameStore.state)),
  )
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
    {#if data.ok === 'success'}
      {#if subview === 'areas'}
        <AreasPanel data={data.data.areas} />
      {:else if subview === 'stock'}
        <StockPanel data={data.data.stock} />
      {:else if subview === 'recipes'}
        <RecipesPanel data={data.data.recipes} />
      {:else if subview === 'staff'}
        <StaffPanel data={data.data.staff} />
      {:else if subview === 'projects'}
        <ProjectsPanel data={data.data.projects} />
      {/if}
    {:else if data.ok === 'error'}
      <div class="panel-error" role="alert" aria-label="Tavern overview unavailable">
        <p class="panel-error-title">Tavern overview unavailable</p>
        <p class="panel-error-message mono">{data.error}</p>
      </div>
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

  /* Phase 120 / ISSUE-059 — projection failure fallback. */
  .panel-error {
    display: flex;
    flex-direction: column;
    gap: var(--sp-xs);
    padding: var(--sp-md);
    background: color-mix(in srgb, var(--loss) 8%, transparent);
    border: 1px solid color-mix(in srgb, var(--loss) 40%, transparent);
    border-radius: var(--radius-md);
  }
  .panel-error-title {
    color: var(--text);
    font-weight: 600;
    font-size: 14px;
  }
  .panel-error-message {
    color: var(--text-dim);
    font-size: 12px;
    line-height: 1.4;
    word-break: break-word;
    padding: var(--sp-xs) var(--sp-sm);
    background: var(--bg);
    border-radius: var(--radius-sm);
  }
</style>
