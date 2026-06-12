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
    humanizeActionReason,
    listActionsByCategory,
    listPolicyToggleRows,
    listValidTargets,
    totalQueuedMinutes,
    type PickedAction,
    type PolicyToggleRow,
  } from '../sim/actionBuilder'
  import {
    quoteOwnerAction,
    type OwnerActionQuote,
  } from '../../../../src/sim/modules/ownerActions/quoteOwnerAction'
  import type { OwnerActionDefinition } from '../../../../src/sim/registries/actionRegistry'
  import type {
    ActionTarget,
    OwnerActionCategory,
  } from '../../../../src/sim/modules/ownerActions/types'
  import { suggestActions } from '../sim/suggestActions'
  import type { DailyReportData } from '../../../../src/reports/types'

  let {
    open,
    onclose,
    previousReport,
    requestedTab,
    focusSuggested = false,
  }: {
    open: boolean
    onclose: () => void
    /**
     * Phase 193 — yesterday's report, used to suggest restocking after a
     * stock loss. Optional; absence simply drops the loss-based trigger.
     */
    previousReport?: DailyReportData | undefined
    /**
     * Phase 195 — when a drilldown "Plan an action" CTA opens the picker it
     * names the category tab to preselect, and may ask to scroll the
     * Suggested section into view. Both are consumed once, on open.
     */
    requestedTab?: OwnerActionCategory | undefined
    focusSuggested?: boolean
  } = $props()

  const categories = getActionCategories()
  let tab = $state<OwnerActionCategory>('immediate')

  // Phase 195 — apply the CTA context exactly once per open. Tracking the
  // previous `open` value (a plain local, not reactive state) means the
  // effect acts only on the false→true edge, so a later in-sheet tab change
  // is not stomped by a re-render.
  let suggestedEl = $state<HTMLElement>()
  let wasOpen = false
  $effect(() => {
    if (open && !wasOpen) {
      if (requestedTab) {
        tab = requestedTab
        targetingFor = null
      }
      if (focusSuggested) {
        // Defer to after the Suggested section paints. jsdom has no
        // scrollIntoView, so guard the call for the component tests.
        requestAnimationFrame(() => {
          if (typeof suggestedEl?.scrollIntoView === 'function') {
            suggestedEl.scrollIntoView({ block: 'start', behavior: 'smooth' })
          }
        })
      }
    }
    wasOpen = open
  })

  // Target picker overlay state (within the sheet body).
  let targetingFor = $state<OwnerActionDefinition | null>(null)
  let targetOptions = $state<ActionTarget[]>([])

  // Phase 92 — picks live on gameStore so any screen can read/write them.
  const picks = $derived(gameStore.picks)
  const minutesUsed = $derived(totalQueuedMinutes(picks))
  const pointsLeft = $derived(DAY_MINUTES - minutesUsed)

  const actionsForTab = $derived(listActionsByCategory(tab))

  // Phase 193 — suggestions tie picker choices to rising pressures and
  // yesterday's losses. Reactive over `picks`, so a suggestion drops out
  // the moment it is queued. The picker stays the only suggestion surface.
  const suggestions = $derived(
    suggestActions(gameStore.state, picks, previousReport),
  )

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


  function quoteForInput(input: {
    actionId: string
    targetId?: string
    amount?: number
    options?: Record<string, unknown>
  }): OwnerActionQuote | undefined {
    const quote = quoteOwnerAction(gameStore.state, input)
    if (
      !quote.summary &&
      !quote.cost?.coin &&
      !quote.stockChanges?.length &&
      !quote.statChanges?.length &&
      !quote.risks?.length &&
      !quote.warnings?.length
    ) {
      return undefined
    }
    return quote
  }

  function quoteForAction(def: OwnerActionDefinition): OwnerActionQuote | undefined {
    if (!def.targetType || def.targetType === 'global') {
      return quoteForInput({ actionId: def.id })
    }
    const targets = listValidTargets(def, gameStore.state)
    if (targets.length !== 1) return undefined
    return quoteForInput({ actionId: def.id, targetId: targets[0]!.id })
  }

  function quoteForTarget(t: ActionTarget): OwnerActionQuote | undefined {
    if (!targetingFor) return undefined
    return quoteForInput({ actionId: targetingFor.id, targetId: t.id })
  }

  function quoteForPick(p: PickedAction): OwnerActionQuote | undefined {
    return quoteForInput({
      actionId: p.actionId,
      ...(p.targetId !== undefined ? { targetId: p.targetId } : {}),
      ...(p.amount !== undefined ? { amount: p.amount } : {}),
      ...(p.options !== undefined ? { options: p.options } : {}),
    })
  }

  function addPick(p: Omit<PickedAction, 'pickId'>) {
    gameStore.tryAddPick(p)
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
        actionId: def.id,
        label: def.label,
        category: def.category,
        targetType: def.targetType,
        timeCost: def.timeCost,
      })
      return
    }
    // Targeted action: open target picker.
    const targets = listValidTargets(def, gameStore.state)
    if (targets.length === 0) return
    if (targets.length === 1) {
      const t = targets[0]!
      addPick({
        actionId: def.id,
        label: def.label,
        category: def.category,
        targetType: def.targetType,
        targetId: t.id,
        targetLabel: t.label,
        timeCost: def.timeCost,
      })
      return
    }
    targetingFor = def
    targetOptions = targets
  }

  function chooseTarget(t: ActionTarget) {
    if (!targetingFor) return
    addPick({
      actionId: targetingFor.id,
      label: targetingFor.label,
      category: targetingFor.category,
      targetType: targetingFor.targetType,
      targetId: t.id,
      targetLabel: t.label,
      timeCost: targetingFor.timeCost,
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
    const reason = actionDisabledReason(def, gameStore.state, pointsLeft)
    // Engine rejection strings are machine-facing; translate at the
    // display boundary so ids never reach the player.
    return reason === undefined ? undefined : humanizeActionReason(reason)
  }

  // Quote warnings come through the same engine-validation channel as the
  // disabled reason, so after humanization the two often collapse to the
  // same sentence. Dedupe (against the reason and each other) so a blocked
  // action explains itself once.
  function visibleWarnings(
    quote: OwnerActionQuote | undefined,
    reason: string | undefined,
  ): string[] {
    if (!quote?.warnings?.length) return []
    const seen = new Set<string>(reason ? [reason] : [])
    const out: string[] = []
    for (const w of quote.warnings) {
      const h = humanizeActionReason(w)
      if (seen.has(h)) continue
      seen.add(h)
      out.push(h)
    }
    return out
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
      actionId: row.actionId,
      label: row.enabled ? `Turn off ${row.label}` : `Turn on ${row.label}`,
      category: 'policy',
      targetType: 'policy',
      targetId: row.policyId,
      targetLabel: row.label,
      timeCost: row.timeCost,
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
            <p class="targeting-hint chip">choose a target</p>
          </div>
        </header>
        <ul class="targets">
          {#each targetOptions as t (t.id)}
            {@const quote = quoteForTarget(t)}
            <li>
              <button class="target" type="button" onclick={() => chooseTarget(t)}>
                <span class="target-label">{t.label}</span>
                {#if t.hint}<span class="target-hint chip">{t.hint}</span>{/if}
                {#if quote}
                  <span class="quote">
                    {#if quote.summary}<span class="quote-line">{quote.summary}</span>{/if}
                    {#each visibleWarnings(quote, undefined) as warning}<span class="quote-warning chip">{warning}</span>{/each}
                    {#each quote.risks ?? [] as risk}<span class="quote-risk chip">{risk}</span>{/each}
                  </span>
                {/if}
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
              class="pick-pill"
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
        <div class="queued-quotes" aria-label="Queued action quotes">
          {#each picks as p (p.pickId)}
            {@const quote = quoteForPick(p)}
            {#if quote?.summary || quote?.warnings?.length}
              <p class="queued-quote chip">
                <span>{p.label}{p.targetLabel ? ` · ${p.targetLabel}` : ''}: {quote?.summary}</span>
                {#each visibleWarnings(quote, undefined) as warning}<span class="quote-warning">{warning}</span>{/each}
              </p>
            {/if}
          {/each}
        </div>
      {:else}
        <p class="unspent chip" aria-live="polite">
          Your day is unspent. Tap Done to skip planning.
        </p>
      {/if}

      {#if suggestions.length > 0}
        <div class="suggested" aria-label="Suggested actions" bind:this={suggestedEl}>
          <p class="suggested-head section-label">Suggested</p>
          <ul class="actions">
            {#each suggestions as s (s.action.id)}
              {@const reason = disabledReason(s.action)}
              {@const quote = quoteForAction(s.action)}
              <li>
                <button
                  type="button"
                  class="action suggested-action"
                  disabled={!!reason}
                  onclick={() => tapAction(s.action)}
                >
                  <span class="action-head">
                    <span class="action-label">{s.action.label}</span>
                    <span class="action-cost mono">
                      {s.action.timeCost === 0
                        ? 'free'
                        : formatDuration(s.action.timeCost)}
                    </span>
                  </span>
                  {#if s.action.effectsPreview}
                    <span class="action-effect chip">{s.action.effectsPreview}</span>
                  {/if}
                  {#if quote}
                    <span class="quote">
                      {#if quote.summary}<span class="quote-line">{quote.summary}</span>{/if}
                      {#each visibleWarnings(quote, reason) as warning}<span class="quote-warning chip">{warning}</span>{/each}
                      {#each quote.risks ?? [] as risk}<span class="quote-risk chip">{risk}</span>{/each}
                    </span>
                  {/if}
                  <span class="suggested-reason chip">{s.reason}</span>
                  {#if reason}
                    <span class="action-reason chip">{reason}</span>
                  {/if}
                </button>
              </li>
            {/each}
          </ul>
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
                  <span class="policy-effect chip">{row.effects}</span>
                {/if}
                {#if row.disabledReason}
                  <span class="action-reason chip">{row.disabledReason}</span>
                {:else if row.conflictNote}
                  <span class="action-reason chip conflict">{row.conflictNote}</span>
                {/if}
              </button>
            </li>
          {/each}
        </ul>
      {:else}
        <ul class="actions">
          {#if actionsForTab.length === 0}
            <li class="empty chip">
              Nothing to do in this tab right now. Try Immediate.
            </li>
          {/if}
          {#each actionsForTab as def (def.id)}
            {@const reason = disabledReason(def)}
            {@const quote = quoteForAction(def)}
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
                    {def.timeCost === 0
                      ? 'free'
                      : formatDuration(def.timeCost)}
                  </span>
                </span>
                {#if def.effectsPreview}
                  <span class="action-effect chip">{def.effectsPreview}</span>
                {/if}
                {#if quote}
                  <span class="quote">
                    {#if quote.summary}<span class="quote-line">{quote.summary}</span>{/if}
                    {#each visibleWarnings(quote, reason) as warning}<span class="quote-warning chip">{warning}</span>{/each}
                    {#each quote.risks ?? [] as risk}<span class="quote-risk chip">{risk}</span>{/each}
                  </span>
                {/if}
                {#if reason}
                  <span class="action-reason chip">{reason}</span>
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

  /* Renamed from `.chip` in phase 194 so the global `.chip` utility can be
     used freely on this component's functional labels without inheriting
     the queued-pick pill's box. */
  .pick-pill {
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


  .queued-quotes {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin: calc(-1 * var(--sp-xs)) 0 var(--sp-md);
  }

  .queued-quote {
    display: flex;
    flex-direction: column;
    gap: 2px;
    color: var(--text-faint);
    line-height: 1.35;
  }

  .quote {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    align-items: center;
    color: var(--text-dim);
    font-size: 12px;
    line-height: 1.4;
  }

  .quote-line {
    color: var(--text-dim);
  }

  .quote-warning {
    color: var(--loss);
  }

  .quote-risk {
    color: var(--risk);
  }

  .tabs {
    display: flex;
    gap: var(--sp-xs);
    margin-bottom: var(--sp-md);
    border-bottom: var(--border-faint);
  }

  .tab {
    font-family: var(--font-body);
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

  .policy-effect,
  .action-effect {
    color: var(--text-faint);
    font-style: italic;
    font-size: 12px;
    line-height: 1.4;
  }

  /* Phase 193 — Suggested section sits above the tab strip. */
  .suggested {
    margin-bottom: var(--sp-md);
  }

  .suggested-head {
    color: var(--accent-soft);
    font-variant: small-caps;
    letter-spacing: 0.08em;
    margin: 0 0 var(--sp-xs);
  }

  .suggested-action {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 6%, var(--surface-raised));
  }

  .suggested-reason {
    color: var(--accent-soft);
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
    color: var(--bg);
    background: var(--accent);
    border: 1px solid var(--accent);
    border-radius: var(--radius-sm);
    padding: 10px 18px;
    min-height: 44px;
    transition: background var(--m-fast) var(--ease);
  }

  .confirm:hover,
  .confirm:focus-visible {
    background: color-mix(in srgb, var(--accent) 88%, white);
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
