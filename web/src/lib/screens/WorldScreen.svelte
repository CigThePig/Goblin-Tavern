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

  type Subview = 'regulars' | 'suppliers' | 'factions' | 'cultures' | 'npcs' | 'rumours'

  const TABS: { id: Subview; label: string }[] = [
    { id: 'regulars', label: 'Regulars' },
    { id: 'suppliers', label: 'Suppliers' },
    { id: 'factions', label: 'Factions' },
    { id: 'cultures', label: 'Cultures' },
    { id: 'npcs', label: 'NPCs' },
    { id: 'rumours', label: 'Rumours' },
  ]

  let subview = $state<Subview>('regulars')
  let pickerOpen = $state(false)

  const data = $derived<WorldOverviewData>(buildWorldOverview(gameStore.state))

  function countFor(id: Subview): number {
    switch (id) {
      case 'regulars': return data.regulars.count
      case 'suppliers': return data.suppliers.count
      case 'factions': return data.factions.count
      case 'cultures': return data.cultures.count
      case 'npcs': return data.npcs.count
      case 'rumours': return data.rumours.count
    }
  }
</script>

<main class="world">
  <TavernIdentityStrip data={data.identity} />

  <nav class="subnav" aria-label="World section">
    {#each TABS as tab (tab.id)}
      {@const c = countFor(tab.id)}
      <button
        type="button"
        class="subtab"
        class:active={subview === tab.id}
        class:empty={c === 0}
        aria-current={subview === tab.id ? 'page' : undefined}
        onclick={() => (subview = tab.id)}
      >
        <span class="label">{tab.label}</span>
        <span class="count mono">{c === 0 ? '—' : c}</span>
      </button>
    {/each}
  </nav>

  <section class="content">
    {#if subview === 'regulars'}
      <RegularsPanel data={data.regulars} />
    {:else if subview === 'suppliers'}
      <SuppliersPanel data={data.suppliers} />
    {:else if subview === 'factions'}
      <FactionsPanel data={data.factions} />
    {:else if subview === 'cultures'}
      <CulturesPanel data={data.cultures} />
    {:else if subview === 'npcs'}
      <NpcsPanel data={data.npcs} />
    {:else if subview === 'rumours'}
      <RumoursPanel data={data.rumours} />
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
</style>
