<!--
  CommissionExpeditionSheet — dedicated form for the commission_expedition
  owner action. Picks runner, mode (open/targeted), duration, and target
  (tier or specific ingredient). Cost preview live. Queues a pick with
  structured `options` that the engine validates.
-->
<script lang="ts">
  import BottomSheet from '../BottomSheet.svelte'
  import { gameStore } from '../../sim/gameStore.svelte'
  import { stockRegistry } from '../../../../../src/sim/registries/stockRegistry'
  import { actionRegistry } from '../../../../../src/sim/registries/actionRegistry'
  import { COMMISSION_EXPEDITION_ACTION_ID } from '../../../../../src/sim/modules/expeditions/commissionExpedition'
  import type {
    AdventurerRow,
    SupplyPipelineData,
  } from '../../../../../src/reports/tavernOverviewProjection'

  let {
    open,
    pipeline,
    onclose,
  }: { open: boolean; pipeline: SupplyPipelineData; onclose: () => void } = $props()

  type Mode = 'open' | 'targeted'
  type Tier = 'uncommon' | 'rare' | 'legendary'
  const DURATIONS = [3, 5, 7] as const
  const TIERS: Tier[] = ['uncommon', 'rare', 'legendary']

  let runnerId = $state<string | null>(null)
  let mode = $state<Mode>('open')
  let tier = $state<Tier>('uncommon')
  let ingredientId = $state<string | null>(null)
  let days = $state<(typeof DURATIONS)[number]>(5)

  const availableRunners = $derived(
    pipeline.hireableAdventurers.filter((a: AdventurerRow) => !a.isBusy),
  )

  const runner = $derived<AdventurerRow | null>(
    runnerId ? pipeline.hireableAdventurers.find((a) => a.id === runnerId) ?? null : null,
  )

  const cost = $derived(runner ? runner.wageBase * days : 0)

  // Rare ingredients catalog from the registry (uncommon / rare / legendary).
  const ingredientCatalog = $derived.by(() => {
    return stockRegistry
      .all()
      .filter((s) => s.defaultState.rarity && s.defaultState.rarity !== 'common')
      .sort((a, b) => a.label.localeCompare(b.label))
      .map((s) => ({
        id: s.id,
        label: s.label,
        rarity: s.defaultState.rarity,
        inStock: gameStore.state.stock[s.id]?.quantity ?? 0,
      }))
  })

  const enoughCoin = $derived(gameStore.state.coin >= cost)

  const canQueue = $derived(
    runner !== null && (mode === 'open' || ingredientId !== null) && enoughCoin,
  )

  const disabledReason = $derived.by(() => {
    if (!runner) return 'pick an adventurer'
    if (mode === 'targeted' && !ingredientId) return 'pick an ingredient'
    if (!enoughCoin) return `need ${cost} coin (have ${gameStore.state.coin})`
    return undefined
  })

  function reset() {
    runnerId = null
    mode = 'open'
    tier = 'uncommon'
    ingredientId = null
    days = 5
  }

  function pickRunner(id: string) {
    runnerId = id
  }

  function selectMode(m: Mode) {
    mode = m
  }

  function selectTier(t: Tier) {
    tier = t
    ingredientId = null
  }

  function selectIngredient(id: string) {
    ingredientId = id
  }

  function selectDuration(d: (typeof DURATIONS)[number]) {
    days = d
  }

  let queueError = $state<string | undefined>(undefined)

  function queue() {
    if (!canQueue || !runner) return
    const def = actionRegistry.get(COMMISSION_EXPEDITION_ACTION_ID)
    const options: Record<string, unknown> = {
      mode,
      daysTotal: days,
    }
    if (mode === 'open') {
      options['targetTier'] = tier
    } else if (ingredientId) {
      options['targetIngredientId'] = ingredientId
    }
    // Phase 90 / ISSUE-050 — Commission goes through tryAddPick so the
    // action-point budget gate matches the central picker. Surface the
    // reason inline if it fails (typically a budget conflict).
    const result = gameStore.tryAddPick({
      actionId: COMMISSION_EXPEDITION_ACTION_ID,
      label: def?.label ?? 'Commission Expedition',
      category: 'immediate',
      targetType: 'global',
      targetId: runner.id,
      targetLabel: runner.name,
      actionPointCost: def?.actionPointCost ?? 1,
      options,
    })
    if (!result.ok) {
      queueError = result.reason
      return
    }
    queueError = undefined
    reset()
    onclose()
  }
</script>

<BottomSheet {open} title="Commission expedition" {onclose}>
  {#snippet children()}
    <section class="block">
      <p class="block-label tag">1 · Pick a runner</p>
      {#if availableRunners.length === 0}
        <p class="quiet">No adventurers available right now.</p>
      {:else}
        <ul class="runners">
          {#each availableRunners as adv (adv.id)}
            <li>
              <button
                type="button"
                class="runner"
                class:active={adv.id === runnerId}
                onclick={() => pickRunner(adv.id)}
              >
                <header class="r-head">
                  <span class="r-name">{adv.name}</span>
                  <span class="r-wage mono">{adv.wageBase}c/day</span>
                </header>
                <p class="r-stats mono">
                  exp {adv.experience} · rel {adv.reliability} · friend {adv.relationship}
                  {#if adv.specialty}
                    · {adv.specialty}
                  {/if}
                </p>
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    </section>

    <section class="block">
      <p class="block-label tag">2 · Mode</p>
      <div class="seg">
        <button
          type="button"
          class="seg-opt"
          class:active={mode === 'open'}
          onclick={() => selectMode('open')}
        >
          Open
        </button>
        <button
          type="button"
          class="seg-opt"
          class:active={mode === 'targeted'}
          onclick={() => selectMode('targeted')}
        >
          Targeted
        </button>
      </div>
    </section>

    {#if mode === 'open'}
      <section class="block">
        <p class="block-label tag">3 · Target tier</p>
        <div class="seg">
          {#each TIERS as t (t)}
            <button
              type="button"
              class="seg-opt"
              class:active={tier === t}
              onclick={() => selectTier(t)}
            >
              {t}
            </button>
          {/each}
        </div>
      </section>
    {:else}
      <section class="block">
        <p class="block-label tag">3 · Target ingredient</p>
        {#if ingredientCatalog.length === 0}
          <p class="quiet">No rare ingredients in the registry.</p>
        {:else}
          <ul class="ingredients">
            {#each ingredientCatalog as ing (ing.id)}
              <li>
                <button
                  type="button"
                  class="ingredient"
                  class:active={ing.id === ingredientId}
                  onclick={() => selectIngredient(ing.id)}
                >
                  <span class="i-label">{ing.label}</span>
                  <span class="i-meta tag">{ing.rarity} · stock {ing.inStock}</span>
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </section>
    {/if}

    <section class="block">
      <p class="block-label tag">4 · Duration</p>
      <div class="seg">
        {#each DURATIONS as d (d)}
          <button
            type="button"
            class="seg-opt"
            class:active={days === d}
            onclick={() => selectDuration(d)}
          >
            {d}d
          </button>
        {/each}
      </div>
    </section>

    {#if runner}
      <p class="cost-preview mono">
        cost: {cost}c (wage {runner.wageBase}/day × {days}d)
        · you have {gameStore.state.coin}c
      </p>
    {/if}
  {/snippet}

  {#snippet footer()}
    <div class="foot">
      {#if disabledReason}
        <p class="reason">{disabledReason}</p>
      {/if}
      {#if queueError}
        <p class="reason">Couldn't queue: {queueError}</p>
      {/if}
      <button
        type="button"
        class="confirm"
        disabled={!canQueue}
        onclick={queue}
      >
        Queue
      </button>
    </div>
  {/snippet}
</BottomSheet>

<style>
  .block {
    display: flex;
    flex-direction: column;
    gap: var(--sp-xs);
    margin-bottom: var(--sp-md);
  }

  .block-label {
    color: var(--accent);
  }

  .quiet {
    color: var(--text-faint);
    font-style: italic;
    padding: var(--sp-sm);
    background: var(--surface-raised);
    border-radius: var(--radius-sm);
  }

  .runners,
  .ingredients {
    display: flex;
    flex-direction: column;
    gap: var(--sp-xs);
  }

  .runner,
  .ingredient {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: var(--sp-sm) var(--sp-md);
    width: 100%;
    text-align: left;
    background: var(--surface-raised);
    border: 1px solid color-mix(in srgb, var(--candle-soft) 30%, transparent);
    border-radius: var(--radius-sm);
    min-height: 44px;
    transition: border-color var(--m-fast) var(--ease),
      background var(--m-fast) var(--ease);
  }

  .runner:hover,
  .runner:focus-visible,
  .ingredient:hover,
  .ingredient:focus-visible {
    border-color: var(--accent);
  }

  .runner.active,
  .ingredient.active {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 14%, transparent);
  }

  .r-head,
  .ingredient {
    display: flex;
  }

  .r-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }

  .r-name,
  .i-label {
    color: var(--text);
    font-size: 15px;
  }

  .r-wage {
    color: var(--accent-soft);
  }

  .r-stats,
  .i-meta {
    color: var(--text-dim);
  }

  .ingredient {
    flex-direction: row;
    justify-content: space-between;
    align-items: baseline;
  }

  .i-meta {
    color: var(--text-faint);
  }

  .seg {
    display: flex;
    gap: 2px;
    background: var(--surface-raised);
    border-radius: var(--radius-sm);
    padding: 2px;
    border: 1px solid color-mix(in srgb, var(--candle-soft) 30%, transparent);
  }

  .seg-opt {
    flex: 1;
    padding: 8px 10px;
    font-family: var(--font-body);
    font-variant: small-caps;
    letter-spacing: 0.06em;
    font-size: 13px;
    color: var(--text-faint);
    border-radius: var(--radius-sm);
    min-height: 40px;
    text-transform: capitalize;
    transition: color var(--m-fast) var(--ease),
      background var(--m-fast) var(--ease);
  }

  .seg-opt:hover,
  .seg-opt:focus-visible {
    color: var(--text-dim);
  }

  .seg-opt.active {
    color: var(--accent);
    background: color-mix(in srgb, var(--accent) 10%, transparent);
  }

  .cost-preview {
    margin-top: var(--sp-sm);
    color: var(--text-dim);
    text-align: center;
  }

  .foot {
    display: flex;
    flex-direction: column;
    gap: var(--sp-xs);
    align-items: stretch;
  }

  .reason {
    color: var(--loss);
    font-style: italic;
    font-size: 13px;
    text-align: center;
  }

  .confirm {
    font-family: var(--font-display);
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    font-size: 14px;
    color: var(--accent);
    border: 1px solid var(--accent);
    border-radius: var(--radius-sm);
    padding: 12px;
    min-height: 44px;
    transition: background var(--m-fast) var(--ease);
  }

  .confirm:not(:disabled):hover,
  .confirm:not(:disabled):focus-visible {
    background: color-mix(in srgb, var(--accent) 14%, transparent);
  }

  .confirm:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
</style>
