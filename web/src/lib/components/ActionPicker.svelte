<!--
  ActionPicker — owner-action picker bottom sheet.

  Tabbed by category (immediate / project / policy / social). Per-row:
  label, action-point cost, tap-to-pick. Actions targeting a specific
  entity (area, staff, supplier, ...) push a second-level target picker.
  Global actions add immediately.

  Picked actions appear as chips at the top; tap to remove. The 3-point
  budget is the sticky chip at the bottom. Submitting calls `onsubmit`
  with the SimInputOwnerAction[] for `gameStore.runDay`.
-->
<script lang="ts">
  import BottomSheet from './BottomSheet.svelte'
  import { gameStore } from '../sim/gameStore.svelte'
  import {
    ACTION_POINT_BUDGET,
    categoryLabel,
    getActionCategories,
    listActionsByCategory,
    listValidTargets,
    nextPickId,
    totalActionPoints,
    type PickedAction,
  } from '../sim/actionBuilder'
  import type { OwnerActionDefinition } from '../../../../src/sim/registries/actionRegistry'
  import type {
    ActionTarget,
    OwnerActionCategory,
  } from '../../../../src/sim/modules/ownerActions/types'

  let {
    open,
    picks,
    onclose,
    onchange,
  }: {
    open: boolean
    picks: PickedAction[]
    onclose: () => void
    onchange: (next: PickedAction[]) => void
  } = $props()

  const categories = getActionCategories()
  let tab = $state<OwnerActionCategory>('immediate')

  // Target picker overlay state (within the sheet body).
  let targetingFor = $state<OwnerActionDefinition | null>(null)
  let targetOptions = $state<ActionTarget[]>([])

  const pointsUsed = $derived(totalActionPoints(picks))
  const pointsLeft = $derived(ACTION_POINT_BUDGET - pointsUsed)

  const actionsForTab = $derived(listActionsByCategory(tab))

  function selectTab(c: OwnerActionCategory) {
    tab = c
    targetingFor = null
  }

  function addPick(p: PickedAction) {
    onchange([...picks, p])
  }

  function removePick(pickId: string) {
    onchange(picks.filter((p) => p.pickId !== pickId))
  }

  function tapAction(def: OwnerActionDefinition) {
    if (pointsLeft < def.actionPointCost) return
    // Global or target-less action: add immediately.
    if (!def.targetType || def.targetType === 'global') {
      addPick({
        pickId: nextPickId(),
        actionId: def.id,
        label: def.label,
        category: def.category,
        targetType: def.targetType,
        actionPointCost: def.actionPointCost,
      })
      return
    }
    // Targeted action: open target picker.
    const targets = listValidTargets(def, gameStore.state)
    if (targets.length === 0) return
    if (targets.length === 1) {
      const t = targets[0]!
      addPick({
        pickId: nextPickId(),
        actionId: def.id,
        label: def.label,
        category: def.category,
        targetType: def.targetType,
        targetId: t.id,
        targetLabel: t.label,
        actionPointCost: def.actionPointCost,
      })
      return
    }
    targetingFor = def
    targetOptions = targets
  }

  function chooseTarget(t: ActionTarget) {
    if (!targetingFor) return
    addPick({
      pickId: nextPickId(),
      actionId: targetingFor.id,
      label: targetingFor.label,
      category: targetingFor.category,
      targetType: targetingFor.targetType,
      targetId: t.id,
      targetLabel: t.label,
      actionPointCost: targetingFor.actionPointCost,
    })
    targetingFor = null
    targetOptions = []
  }

  function cancelTargeting() {
    targetingFor = null
    targetOptions = []
  }

  // Disabled reason for a candidate action row.
  function disabledReason(def: OwnerActionDefinition): string | undefined {
    if (def.actionPointCost > pointsLeft) return 'budget full'
    if (
      def.targetType &&
      def.targetType !== 'global' &&
      listValidTargets(def, gameStore.state).length === 0
    ) {
      return 'no valid targets'
    }
    return undefined
  }
</script>

<BottomSheet {open} title="Plan the day" {onclose}>
  {#snippet children()}
    {#if targetingFor}
      <div class="targeting">
        <header class="targeting-head">
          <button class="back" type="button" onclick={cancelTargeting}>
            ← Back
          </button>
          <div>
            <p class="targeting-label display">{targetingFor.label}</p>
            <p class="targeting-hint tag">choose a target</p>
          </div>
        </header>
        <ul class="targets">
          {#each targetOptions as t (t.id)}
            <li>
              <button class="target" type="button" onclick={() => chooseTarget(t)}>
                <span class="target-label">{t.label}</span>
                {#if t.hint}<span class="target-hint tag">{t.hint}</span>{/if}
              </button>
            </li>
          {/each}
        </ul>
      </div>
    {:else}
      {#if picks.length > 0}
        <div class="chips" aria-label="Picked actions">
          {#each picks as p (p.pickId)}
            <button
              type="button"
              class="chip"
              aria-label="Remove {p.label}"
              onclick={() => removePick(p.pickId)}
            >
              <span class="chip-label">
                {p.label}{#if p.targetLabel}: {p.targetLabel}{/if}
              </span>
              <span class="chip-x">×</span>
            </button>
          {/each}
        </div>
      {/if}

      <div class="tabs" role="tablist" aria-label="Action categories">
        {#each categories as c (c)}
          <button
            type="button"
            class="tab"
            class:active={tab === c}
            role="tab"
            aria-selected={tab === c ? 'true' : 'false'}
            onclick={() => selectTab(c)}
          >
            {categoryLabel(c)}
          </button>
        {/each}
      </div>

      <ul class="actions">
        {#if actionsForTab.length === 0}
          <li class="empty tag">no actions in this category</li>
        {/if}
        {#each actionsForTab as def (def.id)}
          {@const reason = disabledReason(def)}
          <li>
            <button
              type="button"
              class="action"
              disabled={!!reason}
              onclick={() => tapAction(def)}
            >
              <span class="action-head">
                <span class="action-label">{def.label}</span>
                <span class="action-cost mono">{def.actionPointCost} pt</span>
              </span>
              {#if reason}
                <span class="action-reason tag">{reason}</span>
              {/if}
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  {/snippet}

  {#snippet footer()}
    <div class="foot-row">
      <span class="budget mono" aria-live="polite">
        action points: {pointsUsed} / {ACTION_POINT_BUDGET}
      </span>
      <button class="confirm" type="button" onclick={onclose}>
        Done
      </button>
    </div>
  {/snippet}
</BottomSheet>

<style>
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-xs);
    margin-bottom: var(--sp-md);
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--accent) 14%, transparent);
    border: 1px solid var(--accent);
    color: var(--text);
    font-family: var(--font-body);
    font-size: 13px;
    min-height: 32px;
  }

  .chip-x {
    color: var(--text-faint);
  }

  .tabs {
    display: flex;
    gap: var(--sp-xs);
    margin-bottom: var(--sp-md);
    border-bottom: var(--border-faint);
  }

  .tab {
    font-family: var(--font-body);
    font-variant: small-caps;
    letter-spacing: 0.06em;
    font-size: 13px;
    color: var(--text-faint);
    padding: 8px 12px;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    min-height: 40px;
  }

  .tab.active {
    color: var(--accent);
    border-bottom-color: var(--accent);
  }

  .actions {
    display: flex;
    flex-direction: column;
    gap: var(--sp-xs);
  }

  .empty {
    text-align: center;
    padding: var(--sp-lg);
    color: var(--text-faint);
  }

  .action {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    padding: var(--sp-sm) var(--sp-md);
    width: 100%;
    text-align: left;
    background: var(--surface-raised);
    border: 1px solid color-mix(in srgb, var(--candle-soft) 30%, transparent);
    border-radius: var(--radius-sm);
    min-height: 56px;
    transition: border-color var(--m-fast) var(--ease);
  }

  .action:not(:disabled):hover,
  .action:not(:disabled):focus-visible {
    border-color: var(--accent);
  }

  .action:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .action-head {
    display: flex;
    justify-content: space-between;
    width: 100%;
    align-items: baseline;
  }

  .action-label {
    color: var(--text);
    font-family: var(--font-body);
    font-size: 16px;
  }

  .action-cost {
    color: var(--accent-soft);
  }

  .action-reason {
    color: var(--loss);
  }

  .foot-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-sm);
  }

  .budget {
    color: var(--text-dim);
  }

  .confirm {
    font-family: var(--font-display);
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    font-size: 13px;
    color: var(--accent);
    border: 1px solid var(--accent);
    border-radius: var(--radius-sm);
    padding: 10px 18px;
    min-height: 44px;
  }

  .confirm:hover,
  .confirm:focus-visible {
    background: color-mix(in srgb, var(--accent) 12%, transparent);
  }

  /* Target picker overlay */
  .targeting-head {
    display: flex;
    align-items: center;
    gap: var(--sp-sm);
    margin-bottom: var(--sp-md);
  }

  .back {
    font-family: var(--font-body);
    font-size: 14px;
    color: var(--text-faint);
    padding: 6px 10px;
    border-radius: var(--radius-sm);
    border: 1px solid color-mix(in srgb, var(--ash) 30%, transparent);
    min-height: 40px;
  }

  .targeting-label {
    font-size: 15px;
    color: var(--text);
  }

  .targeting-hint {
    color: var(--text-faint);
  }

  .targets {
    display: flex;
    flex-direction: column;
    gap: var(--sp-xs);
  }

  .target {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    padding: var(--sp-sm) var(--sp-md);
    width: 100%;
    text-align: left;
    background: var(--surface-raised);
    border: 1px solid color-mix(in srgb, var(--candle-soft) 30%, transparent);
    border-radius: var(--radius-sm);
    min-height: 48px;
  }

  .target:hover,
  .target:focus-visible {
    border-color: var(--accent);
  }

  .target-label {
    color: var(--text);
    font-family: var(--font-body);
    font-size: 15px;
  }

  .target-hint {
    color: var(--text-faint);
  }
</style>
