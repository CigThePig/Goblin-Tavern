<!--
  WorldScreen — top-level World tab. Phase 93.

  Header: TavernIdentityStrip (collapsible) — non-prescriptive identity
  hints rather than a class label.

  Sub-nav (6 tabs, horizontally scrollable on narrow screens):
    Regulars · Suppliers · Factions · Cultures · NPCs · Rumours

  Each sub-panel reads from a slice of `buildWorldOverview(state)`.
  The shared `ActionQueueChip` + `ActionPicker` pair lives at the
  bottom so social actions queued from a detail sheet land in the
  same queue the Tavern and Day screens use.
-->
<script lang="ts">
  import RegularsPanel from '../components/world/RegularsPanel.svelte'
  import SuppliersPanel from '../components/world/SuppliersPanel.svelte'
  import FactionsPanel from '../components/world/FactionsPanel.svelte'
  import CulturesPanel from '../components/world/CulturesPanel.svelte'
  import NpcsPanel from '../components/world/NpcsPanel.svelte'
  import RumoursPanel from '../components/world/RumoursPanel.svelte'
  import TavernIdentityStrip from '../components/world/TavernIdentityStrip.svelte'
  import ActionQueueChip from '../components/tavern/ActionQueueChip.svelte'
  import ActionPicker from '../components/ActionPicker.svelte'
  import { gameStore } from '../sim/gameStore.svelte'
  import { buildWorldOverview } from '../../../../src/reports/index'
  import type { WorldOverviewData } from '../../../../src/reports/worldOverviewProjection'
  import { safeProject, type ProjectionSlot } from '../sim/projectionSlot'

  type Subview = 'regulars' | 'suppliers' | 'factions' | 'cultures' | 'npcs' | 'rumours'

  const TABS: { id: Subview; label: string }[] = [
    { id: 'regulars', label: 'Regulars' },
    { id: 'suppliers', label: 'Suppliers' },
    { id: 'factions', label: 'Factions' },
    { id: 'cultures', label: 'Cultures' },
    { id: 'npcs', label: 'NPCs' },
    { id: 'rumours', label: 'Rumours' },
  ]

  // Phase 93 / ISSUE-053 — Subview lives on the store and persists
  // through the save envelope so Continue lands on the same tab.
  const subview = $derived(gameStore.worldSubview)
  function setSubview(s: Subview) {
    gameStore.setWorldSubview(s)
  }
  let pickerOpen = $state(false)

  // Phase 120 / ISSUE-059 — Wrap the cross-module projection so a throw
  // surfaces a screen-local "unavailable" panel instead of unmounting
  // the whole AppShell through the top-level boundary. Tab counts
  // collapse to 0 (rendered as `—`) on the error branch.
  const data: ProjectionSlot<WorldOverviewData> = $derived.by(() =>
    safeProject(() => buildWorldOverview(gameStore.state)),
  )

  function countFor(id: Subview): number {
    if (data.ok !== 'success') return 0
    switch (id) {
      case 'regulars': return data.data.regulars.count
      case 'suppliers': return data.data.suppliers.count
      case 'factions': return data.data.factions.count
      case 'cultures': return data.data.cultures.count
      case 'npcs': return data.data.npcs.count
      case 'rumours': return data.data.rumours.count
    }
  }
</script>

<main class="world">
  {#if data.ok === 'success'}
    <TavernIdentityStrip data={data.data.identity} />
  {/if}

  <nav class="subnav" aria-label="World section">
    {#each TABS as tab (tab.id)}
      {@const c = countFor(tab.id)}
      <button
        type="button"
        class="subtab"
        class:active={subview === tab.id}
        class:empty={c === 0}
        aria-current={subview === tab.id ? 'page' : undefined}
        onclick={() => setSubview(tab.id)}
      >
        <span class="label">{tab.label}</span>
        <span class="count mono">{c === 0 ? '—' : c}</span>
      </button>
    {/each}
  </nav>

  <section class="content">
    {#if data.ok === 'success'}
      {#if subview === 'regulars'}
        <RegularsPanel data={data.data.regulars} />
      {:else if subview === 'suppliers'}
        <SuppliersPanel data={data.data.suppliers} />
      {:else if subview === 'factions'}
        <FactionsPanel data={data.data.factions} />
      {:else if subview === 'cultures'}
        <CulturesPanel data={data.data.cultures} />
      {:else if subview === 'npcs'}
        <NpcsPanel data={data.data.npcs} />
      {:else if subview === 'rumours'}
        <RumoursPanel data={data.data.rumours} />
      {/if}
    {:else if data.ok === 'error'}
      <div class="panel-error" role="alert" aria-label="World overview unavailable">
        <p class="panel-error-title">World overview unavailable</p>
        <p class="panel-error-message mono">{data.error}</p>
      </div>
    {/if}
  </section>
</main>

<ActionQueueChip onopen={() => (pickerOpen = true)} />
<ActionPicker open={pickerOpen} onclose={() => (pickerOpen = false)} />

<style>
  .world {
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
    flex: 0 0 auto;
    display: inline-flex;
    align-items: baseline;
    gap: 6px;
    padding: 8px 10px;
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

  .subtab .count {
    font-variant-numeric: tabular-nums;
    color: var(--text-faint);
  }

  .subtab.active .count {
    color: var(--accent);
  }

  .subtab.empty {
    opacity: 0.6;
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
    background: var(--ink-deep);
    border-radius: var(--radius-sm);
  }
</style>
