<!--
  Phase 98 — Help section of the More screen.

  Short intro paragraph plus quick-jump buttons into the existing
  Glossary at named anchors. The glossary is the source of truth for
  in-game terms — we route there rather than duplicating definitions.
-->
<script lang="ts">
  import { glossaryStore } from '../../glossary/glossaryStore.svelte'
  import { gameStore } from '../../sim/gameStore.svelte'

  const helpAnchors: { id: string; label: string }[] = [
    { id: 'action_points', label: 'Owner time' },
    { id: 'pressure', label: 'Pressures' },
    { id: 'autosave', label: 'Autosave' },
    { id: 'save_slots', label: 'Save slots' },
    { id: 'settings', label: 'Settings' },
    { id: 'font_scale', label: 'Font scale' },
    { id: 'missed_opportunity', label: 'Missed opportunities' },
    { id: 'quick_day', label: 'Quick Day' },
    { id: 'tavern_log', label: 'Tavern Log' },
  ]

  function openAt(id: string) {
    glossaryStore.show(id)
  }

  const version = $derived(gameStore.state.meta.simVersion)
</script>

<section class="help-section" aria-labelledby="help-h">
  <h2 id="help-h" class="display heading-row">Help</h2>

  <p class="lede">
    You run a small, sour tavern at the edge of a goblin road. Each day picks a
    handful of decisions out of everything happening; everything else the
    simulation handles for you.
  </p>

  <p class="lede dim">
    Tap a term below to see what it means. The same chips appear inline
    throughout the game — tap any one anywhere to open the glossary.
  </p>

  <div class="anchor-grid">
    {#each helpAnchors as a (a.id)}
      <button class="anchor-chip" type="button" onclick={() => openAt(a.id)}>
        {a.label}
      </button>
    {/each}
  </div>

  <div class="version-row chip">
    Sim version <span class="mono">{version}</span>
  </div>
</section>

<style>
  .help-section {
    display: flex;
    flex-direction: column;
    gap: var(--sp-sm);
    padding: var(--sp-md);
    background: var(--surface);
    border: var(--border-faint);
    border-radius: var(--radius-sm);
  }

  .heading-row {
    font-size: var(--type-heading);
    color: var(--text);
    margin-bottom: var(--sp-xs);
  }

  .lede {
    color: var(--text);
    font-size: 14px;
    line-height: 1.55;
  }

  .lede.dim {
    color: var(--text-dim);
  }

  .anchor-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: var(--sp-xxs);
  }

  .anchor-chip {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--text-dim);
    background: var(--bg);
    border: 1px solid var(--candle-soft);
    border-radius: var(--radius-sm);
    padding: 10px var(--sp-xs);
    min-height: 40px;
    text-align: left;
    transition:
      background var(--m-fast) var(--ease),
      color var(--m-fast) var(--ease),
      border-color var(--m-fast) var(--ease);
  }

  .anchor-chip:hover,
  .anchor-chip:focus-visible {
    color: var(--accent);
    border-color: var(--accent);
  }

  .version-row {
    padding-top: var(--sp-xs);
    border-top: var(--border-faint);
    color: var(--text-faint);
  }
</style>
