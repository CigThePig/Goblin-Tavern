<!--
  PressuresDashboard — all 21 pressures grouped by category.

  Source of truth: `gameStore.state.pressures` (the compact on-state
  shape). Categories come from the pressures ReportSection's `data`
  if available, otherwise from the canonical id constants.

  Tap a row → open the cause drilldown sheet keyed off that pressure
  id. Drilldown wiring is owned by the parent (this component just
  bubbles the id up via `onselect`).
-->
<script lang="ts">
  import PressureCard from './PressureCard.svelte'
  import { gameStore } from '../sim/gameStore.svelte'
  import {
    PRESSURE_IDS,
    EXPANDED_PRESSURE_IDS,
    EXPANDED_PRESSURE_CATEGORIES,
    type PressureCategory,
  } from '../../../../src/sim/modules/pressures/pressureTypes'
  import type { PressureState } from '../../../../src/sim/state/TavernState'

  let {
    onselect,
  }: {
    onselect?: (id: string) => void
  } = $props()

  const CATEGORY_ORDER: PressureCategory[] = ['core', 'social', 'market', 'arc']
  const CATEGORY_LABELS: Record<PressureCategory, string> = {
    core: 'Core',
    social: 'Social',
    market: 'Market',
    arc: 'Arc',
  }

  type Bucket = { category: PressureCategory; pressures: PressureState[] }

  const buckets = $derived.by<Bucket[]>(() => {
    const all = gameStore.state.pressures
    const result: Record<PressureCategory, PressureState[]> = {
      core: [],
      social: [],
      market: [],
      arc: [],
    }
    for (const id of PRESSURE_IDS) {
      const p = all[id]
      if (p) result.core.push(p)
    }
    for (const id of EXPANDED_PRESSURE_IDS) {
      const p = all[id]
      if (p) {
        const cat = EXPANDED_PRESSURE_CATEGORIES[id]
        result[cat].push(p)
      }
    }
    // Sort each bucket by value desc so the hottest pressure leads.
    for (const cat of CATEGORY_ORDER) {
      result[cat].sort((a, b) => b.value - a.value)
    }
    return CATEGORY_ORDER.map((category) => ({ category, pressures: result[category] }))
  })
</script>

<section class="dashboard" aria-label="Pressures dashboard">
  {#each buckets as bucket (bucket.category)}
    {#if bucket.pressures.length > 0}
      <section class="bucket" aria-label={`${CATEGORY_LABELS[bucket.category]} pressures`}>
        <h3 class="bucket-label section-label">{CATEGORY_LABELS[bucket.category]}</h3>
        <div class="bucket-body">
          {#each bucket.pressures as p (p.id)}
            <PressureCard pressure={p} {onselect} />
          {/each}
        </div>
      </section>
    {/if}
  {/each}
</section>

<style>
  .dashboard {
    display: flex;
    flex-direction: column;
    gap: var(--sp-md);
  }

  .bucket {
    display: flex;
    flex-direction: column;
    gap: var(--sp-xs);
  }

  .bucket-label {
    color: var(--accent);
    margin-bottom: 2px;
  }

  .bucket-body {
    display: flex;
    flex-direction: column;
    gap: 2px;
    background: var(--surface);
    border-radius: var(--radius-md);
    border: var(--border-faint);
    padding: var(--sp-xs);
  }
</style>
