<!--
  MetricLink — Phase 190a / ISSUE-157a.

  Wraps a metric value (coin, a pressure, a reputation axis, an inventory
  count) and opens its `CauseDrilldown` on tap via the global
  `drilldownStore`. Removes the asymmetry where dashboard pressure rows
  drill down but the same number elsewhere is dead text.

  Falls back to plain (non-interactive) content when the metric needs an
  id but none is given.

  Visual contract — see `global.css` (.metric-link): hover-only
  border-bottom, distinct from `TermLabel`.
-->
<script lang="ts">
  import type { Snippet } from 'svelte'
  import { drilldownStore } from '../../sim/drilldownStore.svelte'
  import { metricDrilldownPath, type MetricKind } from './types'

  let {
    kind,
    id,
    children,
  }: {
    kind: MetricKind
    id?: string
    children: Snippet
  } = $props()

  const path = $derived(metricDrilldownPath(kind, id))

  function go(e: MouseEvent) {
    e.stopPropagation()
    if (path) drilldownStore.show(path)
  }
</script>

{#if path}
  <button class="metric-link" type="button" onclick={go}>
    {@render children()}
  </button>
{:else}
  <span class="metric-link-plain">{@render children()}</span>
{/if}
