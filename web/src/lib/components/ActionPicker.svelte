<!--
  ActionPicker — owner-action picker bottom sheet.

  Tabbed by category (immediate / project / policy / social). Per-row:
  label, time cost, tap-to-pick. Actions targeting a specific
  entity (area, staff, supplier, ...) push a second-level target picker.
  Global actions add immediately.

  Picked actions appear as chips at the top; tap to remove. The daily
  time budget is the sticky chip at the bottom. Submitting calls `onsubmit`
  with the SimInputOwnerAction[] for `gameStore.runDay`.
-->
<script lang="ts">
  import BottomSheet from './BottomSheet.svelte'
  import TermLabel from './TermLabel.svelte'
  import { gameStore } from '../sim/gameStore.svelte'
  import {
    DAY_MINUTES,
    actionDisabledReason,
    categoryLabel,
    formatDuration,
    getActionCategories,
    listActionsByCategory,
    listPolicyToggleRows,
    listValidTargets,
    nextPickId,
    totalQueuedMinutes,
    type PickedAction,
    type PolicyToggleRow,
  } from '../sim/actionBuilder'
  import type { OwnerActionDefinition } from '../../../../src/sim/registries/actionRegistry'
  import type {
    ActionTarget,
    OwnerActionCategory,
  } from '../../../../src/sim/modules/ownerActions/types'

  let {
    open,
    onclose,
  }: {
    open: boolean
    onclose: () => void
  } = $props()

  const categories = getActionCategories()
  let tab = $state<OwnerActionCategory>('immediate')

  // Target picker overlay state (within the sheet body).
  let targetingFor = $state<OwnerActionDefinition | null>(null)
  let targetOptions = $state<ActionTarget[]>([])

  // Phase 92 — picks live on gameStore so any screen can read/write them.
  const picks = $derived(gameStore.picks)
  const minutesUsed = $derived(totalQueuedMinutes(picks))
  const pointsLeft = $derived(DAY_MINUTES - minutesUsed)

  const actionsForTab = $derived(listActionsByCategory(tab))

  // Phase 117 — Policy toggles render as one row per policy instead
  // of paired enable/disable definitions. Only computed when the
  // Policies tab is active, but cheap enough to derive eagerly.
  const policyRows = $derived(
    listPolicyToggleRows({
      state: gameStore.state,
      pointsLeft,
      picks,
    }),
  )

  function selectTab(c: OwnerActionCategory) {
    tab = c
    targetingFor = null
  }

  function addPick(p: PickedAction) {
    gameStore.setPicks([...gameStore.picks, p])
  }

  function removePick(pickId: string) {
    gameStore.removePick(pickId)
  }

  function tapAction(def: OwnerActionDefinition) {
    // ISSUE-048 — mirror the disabled check so a targeted action that
    // fails `canApply` for every candidate target doesn't open the
    // target sub-sheet only for the player to discover dead options.
    if (actionDisabledReason(def, gameStore.state, pointsLeft) !== undefined) return
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

  // Disabled reason for a candidate action row. Thin closure over
  // `pointsLeft` so Svelte reactivity wires through; the actual check
  // lives in `actionDisabledReason` (see web/src/lib/sim/actionBuilder).
  function disabledReason(def: OwnerActionDefinition): string | undefined {
    return actionDisabledReason(def, gameStore.state, pointsLeft)
  }

  // Phase 117 — Policy toggle tap handler.
  function tapPolicyRow(row: PolicyToggleRow) {
    if (row.disabledReason) return
    if (row.queued) {
      // The toggle for *this* direction is queued; cancelling restores
      // the player's intent that the policy stay in its current state.
      const target = picks.find((p) => p.actionId === row.actionId)
      if (target) removePick(target.pickId)
      return
    }
    // If the inverse direction is queued (player flipped, then is
    // flipping back), remove the inverse pick to reach the same end
    // state without spending two points.
    const inverseId = row.enabled
      ? `enable_${row.policyId}`
      : `disable_${row.policyId}`
    const inversePick = picks.find((p) => p.actionId === inverseId)
    if (inversePick) {
      removePick(inversePick.pickId)
      return
    }
    addPick({
      pickId: nextPickId(),
      actionId: row.actionId,
      label: row.enabled ? `Turn off ${row.label}` : `Turn on ${row.label}`,
      category: 'policy',
      targetType: 'policy',
      targetId: row.policyId,
      targetLabel: row.label,
      actionPointCost: row.actionPointCost,
    })
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
              aria-label={p.targetLabel
                ? `Remove ${p.label} on ${p.targetLabel}`
                : `Remove ${p.label}`}
              onclick={() => removePick(p.pickId)}
            >
              <span class="chip-label">{p.label}</span>
              {#if p.targetLabel}
                <span class="chip-target">{p.targetLabel}</span>
              {/if}
              <span class="chip-x" aria-hidden="true">×</span>
            </button>
          {/each}
        </div>
      {:else}
        <p class="unspent tag" aria-live="polite">
          Your day is unspent. Tap Done to skip planning.
        </p>
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

      {#if tab === 'policy'}
        <ul class="actions">
          {#each policyRows as row (row.policyId)}
            <li>
              <button
                type="button"
                class="action policy-row"
                class:queued={row.queued}
                disabled={!!row.disabledReason}
                onclick={() => tapPolicyRow(row)}
                aria-pressed={row.enabled}
              >
                <span class="action-head">
                  <span class="action-label">{row.label}</span>
                  <span class="policy-state" data-state={row.enabled ? 'on' : 'off'}>
                    {#if row.queued}
                      → {row.enabled ? 'off' : 'on'}
                    {:else}
                      {row.enabled ? 'on' : 'off'}
                    {/if}
                  </span>
                </span>
                {#if row.effects}
                  <span class="policy-effect tag">{row.effects}</span>
                {/if}
                {#if row.disabledReason}
                  <span class="action-reason tag">{row.disabledReason}</span>
                {:else if row.conflictNote}
                  <span class="action-reason tag conflict">{row.conflictNote}</span>
                {/if}
              </button>
            </li>
          {/each}
        </ul>
      {:else}
        <ul class="actions">
          {#if actionsForTab.length === 0}
            <li class="empty tag">
              Nothing to do in this tab right now. Try Immediate.
            </li>
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
                  <span class="action-cost mono">
                    {def.actionPointCost === 0
                      ? 'free'
                      : formatDuration(def.actionPointCost)}
                  </span>
                </span>
                {#if reason}
                  <span class="action-reason tag">{reason}</span>
                {/if}
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    {/if}
  {/snippet}

  {#snippet footer()}
    <div class="foot-row">
      <span class="budget mono" aria-live="polite">
        <TermLabel term="action_points" label="time" />: {formatDuration(
          minutesUsed,
        )} / {formatDuration(DAY_MINUTES)}
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

  .chip-target {
    color: var(--text-faint);
    font-style: italic;
    font-size: 12px;
  }
  .chip-target::before {
    content: '·';
    margin-right: 4px;
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

  .unspent {
    padding: var(--sp-sm) var(--sp-md);
    color: var(--text-faint);
    text-align: center;
    margin: 0;
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

  .action-reason.conflict {
    color: var(--risk);
  }

  .policy-row.queued {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 8%, transparent);
  }

  .policy-state {
    font-family: var(--font-body);
    font-variant: small-caps;
    letter-spacing: 0.08em;
    font-size: 12px;
    padding: 4px 10px;
    border-radius: 999px;
    min-width: 56px;
    text-align: center;
  }

  .policy-state[data-state='on'] {
    color: var(--accent);
    border: 1px solid var(--accent);
    background: color-mix(in srgb, var(--accent) 14%, transparent);
  }

  .policy-state[data-state='off'] {
    color: var(--text-faint);
    border: 1px solid color-mix(in srgb, var(--ash) 30%, transparent);
  }

  .policy-row.queued .policy-state {
    color: var(--text);
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 18%, transparent);
  }

  .policy-effect {
    color: var(--text-faint);
    font-style: italic;
    font-size: 12px;
    line-height: 1.4;
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
