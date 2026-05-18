<!--
  QuickActions — list of applicable owner actions for a tavern row.

  Used inside detail sheets. Tapping queues the action via gameStore.addPick;
  tapping an already-queued action removes it. Disabled actions render with
  their reason italicized. Action point cost is shown on the right.
-->
<script lang="ts">
  import { gameStore } from '../../sim/gameStore.svelte'
  import { actionRegistry } from '../../../../../src/sim/registries/actionRegistry'
  import { categoryLabel } from '../../sim/actionBuilder'
  import type { ApplicableActionRef } from '../../../../../src/reports/tavernOverviewProjection'

  let {
    actions,
    targetId,
    targetLabel,
  }: {
    actions: ApplicableActionRef[]
    /** Target id this row represents. Forwarded into the pick. */
    targetId?: string
    /** Human label for the target. Used on the pick chip in the picker. */
    targetLabel?: string
  } = $props()

  function isQueued(actionId: string): boolean {
    return gameStore.isQueued(actionId, targetId)
  }

  function toggle(ref: ApplicableActionRef) {
    if (isQueued(ref.actionId)) {
      gameStore.removePicksFor(ref.actionId, targetId)
      return
    }
    if (ref.disabledReason !== undefined) return
    const def = actionRegistry.get(ref.actionId)
    gameStore.addPick({
      actionId: ref.actionId,
      label: ref.label,
      category: ref.category,
      targetType: def?.targetType,
      ...(targetId !== undefined ? { targetId } : {}),
      ...(targetLabel !== undefined ? { targetLabel } : {}),
      actionPointCost: ref.actionPointCost,
    })
  }
</script>

{#if actions.length > 0}
  <div class="block">
    <p class="block-label tag">Quick actions</p>
    <ul class="list">
      {#each actions as ref (ref.actionId)}
        {@const queued = isQueued(ref.actionId)}
        <li>
          <button
            type="button"
            class="action"
            class:queued
            disabled={!queued && ref.disabledReason !== undefined}
            onclick={() => toggle(ref)}
          >
            <span class="head">
              <span class="label">{ref.label}</span>
              <span class="cost mono">
                {#if ref.actionPointCost === 0}
                  free
                {:else}
                  {ref.actionPointCost} pt
                {/if}
              </span>
            </span>
            <span class="meta">
              <span class="cat tag">{categoryLabel(ref.category)}</span>
              {#if queued}
                <span class="queued-pill tag">queued · tap to remove</span>
              {:else if ref.disabledReason}
                <span class="reason">{ref.disabledReason}</span>
              {/if}
            </span>
          </button>
        </li>
      {/each}
    </ul>
  </div>
{/if}

<style>
  .block {
    display: flex;
    flex-direction: column;
    gap: var(--sp-xs);
    margin-top: var(--sp-md);
  }

  .block-label {
    color: var(--accent);
  }

  .list {
    display: flex;
    flex-direction: column;
    gap: var(--sp-xs);
  }

  .action {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 2px;
    padding: var(--sp-sm) var(--sp-md);
    width: 100%;
    text-align: left;
    background: var(--surface-raised);
    border: 1px solid color-mix(in srgb, var(--candle-soft) 30%, transparent);
    border-radius: var(--radius-sm);
    min-height: 48px;
    transition: border-color var(--m-fast) var(--ease),
      background var(--m-fast) var(--ease);
  }

  .action:not(:disabled):hover,
  .action:not(:disabled):focus-visible {
    border-color: var(--accent);
  }

  .action.queued {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 12%, transparent);
  }

  .action:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: var(--sp-xs);
  }

  .label {
    color: var(--text);
    font-family: var(--font-body);
    font-size: 15px;
  }

  .cost {
    color: var(--accent-soft);
  }

  .meta {
    display: flex;
    justify-content: space-between;
    gap: var(--sp-xs);
    align-items: baseline;
  }

  .cat {
    color: var(--text-faint);
  }

  .queued-pill {
    color: var(--accent);
  }

  .reason {
    font-family: var(--font-body);
    font-style: italic;
    font-size: 12px;
    color: var(--loss);
  }
</style>
