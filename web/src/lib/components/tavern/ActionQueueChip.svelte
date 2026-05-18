<!--
  ActionQueueChip — sticky bottom chip showing the current owner-action
  queue from the Tavern screen. Tap to open the ActionPicker.

  Only renders when gameStore.picks is non-empty. Turns blood-tinted
  when over the action-point budget (the engine rejects overflow on
  apply, but the player should see it coming).
-->
<script lang="ts">
  import { gameStore, ACTION_POINT_BUDGET } from '../../sim/gameStore.svelte'

  let { onopen }: { onopen: () => void } = $props()

  const count = $derived(gameStore.picks.length)
  const points = $derived(gameStore.actionPointsQueued)
  const overBudget = $derived(points > ACTION_POINT_BUDGET)
</script>

{#if count > 0}
  <button
    type="button"
    class="chip"
    class:over={overBudget}
    onclick={onopen}
    aria-label={overBudget
      ? 'Over the daily action budget — open action queue to trim'
      : 'Open action queue'}
  >
    <span class="label tag">
      {overBudget ? 'Over budget' : 'Action queue'}
    </span>
    <span class="counts mono">
      {points} / {ACTION_POINT_BUDGET}
      {#if count !== points}
        <span class="extra">({count} picks)</span>
      {/if}
    </span>
  </button>
{/if}

<style>
  .chip {
    position: fixed;
    left: 50%;
    transform: translateX(-50%);
    bottom: calc(var(--nav-h) + var(--sp-sm) + env(safe-area-inset-bottom, 0px));
    display: inline-flex;
    align-items: center;
    gap: var(--sp-sm);
    padding: 10px 18px;
    border-radius: 999px;
    background: var(--surface);
    border: 1px solid var(--accent);
    color: var(--accent);
    box-shadow: var(--shadow-md);
    min-height: 44px;
    z-index: 20;
    transition: background var(--m-fast) var(--ease),
      border-color var(--m-fast) var(--ease),
      color var(--m-fast) var(--ease);
  }

  .chip:hover,
  .chip:focus-visible {
    background: color-mix(in srgb, var(--accent) 14%, var(--surface));
  }

  .chip.over {
    border-color: var(--loss);
    color: var(--loss);
  }

  .label {
    color: inherit;
  }

  .counts {
    color: var(--text);
    font-variant-numeric: tabular-nums;
  }

  .chip.over .counts {
    color: var(--loss);
  }

  .extra {
    color: var(--text-faint);
    margin-left: 4px;
  }
</style>
