<!--
  EntityLink — Phase 190a / ISSUE-157a.

  Wraps a structured reference to an entity (a staff member, stock item,
  faction, …) and makes it tappable. On tap it routes to the entity's
  home sub-view and hands the id forward as a transient routing target;
  the destination panel consumes the target on mount to auto-open the
  relevant detail sheet (the panel-side consumption lands with the
  consumer wiring, phase 190b).

  Graceful fallback (arc §Cross-cutting constraints): a non-empty id that
  does not resolve to a live entity renders as plain text — no click, no
  error, no console warn. An empty id is a valid navigation hint (land on
  the home tab, no auto-open).

  Visual contract — see `global.css` (.entity-link): hover-only
  border-bottom, distinct from `TermLabel`'s resting dotted underline.
-->
<script lang="ts">
  import { gameStore } from '../../sim/gameStore.svelte'
  import { ENTITY_ROUTING, entityExists, type EntityKind } from './types'

  let {
    kind,
    id,
    label,
    variant = 'inline',
  }: {
    kind: EntityKind
    id: string
    label: string
    variant?: 'inline' | 'chip'
  } = $props()

  // An empty id is still a valid link (home tab, no auto-open); a
  // non-empty id must resolve, or we degrade to plain text.
  const linkable = $derived(id === '' || entityExists(gameStore.state, kind, id))

  function go(e: MouseEvent) {
    e.stopPropagation()
    const dest = ENTITY_ROUTING[kind]
    gameStore.setRoute(dest.route, { target: id, kind })
  }
</script>

{#if linkable}
  <button
    class="entity-link"
    class:chip={variant === 'chip'}
    type="button"
    onclick={go}
  >
    {label}
  </button>
{:else}
  <span class="entity-link-plain">{label}</span>
{/if}
