<!--
  CommissionExpeditionSheet — dedicated form for the commission_expedition
  owner action. Picks runner, mode (open/targeted), target (tier or specific
  ingredient), ROUTE, party, loadout and terms. Cost preview live. Queues a
  pick with structured `options` that the engine validates.

  Expansion Phase 9 §9.3 — the duration picker that used to live here is
  gone. A trip's length is a property of where it goes, and the sim derives
  it from the route; offering the player a 3/5/7-day segment control was
  offering a choice the engine had stopped reading, and pricing the
  commission off it made the preview wrong as well. The route picker that
  replaced it is the same decision made honestly, and it carries the four
  other decisions §9.3 added along with it.
-->
<script lang="ts">
  import BottomSheet from '../BottomSheet.svelte'
  import { gameStore } from '../../sim/gameStore.svelte'
  import { stockRegistry } from '../../../../../src/sim/registries/stockRegistry'
  import { actionRegistry } from '../../../../../src/sim/registries/actionRegistry'
  import {
    COMMISSION_EXPEDITION_ACTION_ID,
    MAX_PARTY_SIZE,
    commissionCosts,
  } from '../../../../../src/sim/modules/expeditions/commissionExpedition'
  import {
    availableRoutes,
    getExpeditionsModuleState,
  } from '../../../../../src/sim/modules/expeditions/index'
  import {
    routeProvisionsNeeded,
    routeTravelDays,
    type ExpeditionRoute,
  } from '../../../../../src/sim/content/expeditions/expeditionRoutes'
  import type { ExpeditionTermsKind } from '../../../../../src/sim/modules/expeditions/runState'
  import { safeProject, type ProjectionSlot } from '../../sim/projectionSlot'
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
  const TIERS: Tier[] = ['uncommon', 'rare', 'legendary']
  const TERMS: { id: ExpeditionTermsKind; label: string; hint: string }[] = [
    { id: 'flat_fee', label: 'flat fee', hint: 'paid in full whatever comes back' },
    { id: 'share_of_haul', label: 'share', hint: 'cheap up front, a cut of the haul' },
    { id: 'hazard_bonus', label: 'hazard', hint: 'more if the going was bad' },
  ]

  let runnerId = $state<string | null>(null)
  let mode = $state<Mode>('open')
  let tier = $state<Tier>('uncommon')
  let ingredientId = $state<string | null>(null)
  let routeId = $state<string | null>(null)
  let partySize = $state(1)
  let terms = $state<ExpeditionTermsKind>('flat_fee')
  let extraProvisions = $state(0)
  let medicine = $state(0)
  let gear = $state(0)

  const availableRunners = $derived(
    pipeline.hireableAdventurers.filter((a: AdventurerRow) => !a.isBusy),
  )

  const runner = $derived<AdventurerRow | null>(
    runnerId ? pipeline.hireableAdventurers.find((a) => a.id === runnerId) ?? null : null,
  )

  /** The tier this commission is really asking for, whichever mode it used. */
  const wantedTier = $derived.by<Tier | null>(() => {
    if (mode === 'open') return tier
    if (!ingredientId) return null
    const rarity = ingredientCatalog.find((i) => i.id === ingredientId)?.rarity
    return rarity === 'uncommon' || rarity === 'rare' || rarity === 'legendary'
      ? rarity
      : null
  })

  // Only routes the house KNOWS, and only ones that can fill the request.
  // A route that cannot yield the target is not a worse bet, it is a trip
  // nobody can make good on, and the engine refuses it — so the form does
  // not offer it either.
  const routeChoices = $derived.by<ExpeditionRoute[]>(() => {
    const known = getExpeditionsModuleState(gameStore.state).knownDiscoveries
    const routes = availableRoutes(gameStore.state, known)
    return wantedTier ? routes.filter((r) => r.yields.includes(wantedTier)) : routes
  })

  const route = $derived<ExpeditionRoute | null>(
    routeChoices.find((r) => r.id === routeId) ?? routeChoices[0] ?? null,
  )

  const maxParty = $derived(Math.min(MAX_PARTY_SIZE, Math.max(1, availableRunners.length)))
  const party = $derived(Math.min(partySize, maxParty))

  const baseProvisions = $derived(route ? routeProvisionsNeeded(route, party) : 0)
  /**
   * The spare rations actually being bought, clamped to what the engine will
   * accept for the CURRENT route and party.
   *
   * `extraProvisions` is a stepper value, so it survives a change of route or
   * party size — buy spare for a three-runner trip down the Underdeep, then
   * drop to one runner on the Market Road, and the stepper still holds the
   * old number. `readProvisions` in the sim clamps the total to twice what
   * the route asks for, so without clamping here too the sheet priced and
   * coin-gated rations the commission was never going to buy: the charge
   * shown was wrong, and a player with exactly enough coin for the real
   * commission could be refused the queue.
   */
  const spareProvisions = $derived(Math.min(extraProvisions, baseProvisions))
  const provisions = $derived(baseProvisions + spareProvisions)

  const costs = $derived(
    runner && route
      ? commissionCosts(runner, route, party, { provisions, medicine, gear }, terms)
      : null,
  )
  const cost = $derived(costs?.total ?? 0)

  // Rare ingredients catalog from the registry (uncommon / rare / legendary).
  // Phase 120 / ISSUE-059 — Wrap the registry read so a throw renders a
  // small inline note instead of bubbling through the App boundary and
  // unmounting the sheet's parent screen.
  type IngredientRow = {
    id: string
    label: string
    rarity: string | undefined
    inStock: number
  }
  const ingredientCatalogSlot: ProjectionSlot<IngredientRow[]> = $derived.by(() =>
    safeProject(() =>
      stockRegistry
        .all()
        .filter((s) => s.defaultState.rarity && s.defaultState.rarity !== 'common')
        .sort((a, b) => a.label.localeCompare(b.label))
        .map((s) => ({
          id: s.id,
          label: s.label,
          rarity: s.defaultState.rarity,
          inStock: gameStore.state.stock[s.id]?.quantity ?? 0,
        })),
    ),
  )
  const ingredientCatalog = $derived(
    ingredientCatalogSlot.ok === 'success' ? ingredientCatalogSlot.data : [],
  )

  const enoughCoin = $derived(gameStore.state.coin >= cost)

  const canQueue = $derived(
    runner !== null &&
      (mode === 'open' || ingredientId !== null) &&
      route !== null &&
      enoughCoin,
  )

  const disabledReason = $derived.by(() => {
    if (!runner) return 'pick an adventurer'
    if (mode === 'targeted' && !ingredientId) return 'pick an ingredient'
    if (!route) {
      return wantedTier
        ? `nobody knows a way to anything ${wantedTier} yet`
        : 'there is nowhere to send anybody'
    }
    if (!enoughCoin) return `need ${cost} coin (have ${gameStore.state.coin})`
    return undefined
  })

  function reset() {
    runnerId = null
    mode = 'open'
    tier = 'uncommon'
    ingredientId = null
    routeId = null
    partySize = 1
    terms = 'flat_fee'
    extraProvisions = 0
    medicine = 0
    gear = 0
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
    // The route list is filtered by the target, so a route picked for the
    // old target is not necessarily on offer for the new one.
    routeId = null
  }

  function selectIngredient(id: string) {
    ingredientId = id
    routeId = null
  }

  function selectRoute(id: string) {
    routeId = id
  }

  function selectTerms(kind: ExpeditionTermsKind) {
    terms = kind
  }

  function step(value: number, by: number, max: number): number {
    return Math.max(0, Math.min(max, value + by))
  }

  let queueError = $state<string | undefined>(undefined)

  function queue() {
    if (!canQueue || !runner) return
    const def = actionRegistry.get(COMMISSION_EXPEDITION_ACTION_ID)
    const options: Record<string, unknown> = {
      mode,
      routeId: route?.id,
      partySize: party,
      terms,
      provisions,
      medicine,
      gear,
    }
    if (mode === 'open') {
      options['targetTier'] = tier
    } else if (ingredientId) {
      options['targetIngredientId'] = ingredientId
    }
    // Phase 90 / ISSUE-050 — Commission goes through tryAddPick so the
    // time budget gate matches the central picker. Surface the
    // reason inline if it fails (typically a budget conflict).
    const result = gameStore.tryAddPick({
      actionId: COMMISSION_EXPEDITION_ACTION_ID,
      label: def?.label ?? 'Commission Expedition',
      category: 'immediate',
      targetType: 'global',
      targetId: runner.id,
      targetLabel: runner.name,
      timeCost: def?.timeCost ?? 1,
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
      <p class="block-label section-label">1 · Pick a runner</p>
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
      <p class="block-label section-label">2 · Mode</p>
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
        <p class="block-label section-label">3 · Target tier</p>
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
        <p class="block-label section-label">3 · Target ingredient</p>
        {#if ingredientCatalogSlot.ok === 'error'}
          <p class="quiet" role="status" aria-live="polite">
            Couldn't load the ingredient catalog ({ingredientCatalogSlot.error}).
          </p>
        {:else if ingredientCatalog.length === 0}
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
                  <span class="i-meta chip">{ing.rarity} · stock {ing.inStock}</span>
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </section>
    {/if}

    <section class="block">
      <p class="block-label section-label">4 · Where they go</p>
      {#if routeChoices.length === 0}
        <p class="quiet">
          {wantedTier
            ? `Nobody knows a way to anything ${wantedTier} yet.`
            : 'There is nowhere to send anybody.'}
        </p>
      {:else}
        <ul class="routes">
          {#each routeChoices as r (r.id)}
            <li>
              <button
                type="button"
                class="route"
                class:active={r.id === route?.id}
                onclick={() => selectRoute(r.id)}
              >
                <header class="r-head">
                  <span class="r-name">{r.label}</span>
                  <span class="r-wage mono">{routeTravelDays(r) + 1}d</span>
                </header>
                <p class="r-stats mono">
                  danger {r.danger} · yields {r.yields.join('/')} · word
                  {r.wordDelayDays}d
                </p>
                <p class="r-stats">{r.readable}</p>
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    </section>

    <section class="block">
      <p class="block-label section-label">5 · Party &amp; loadout</p>
      <div class="steppers">
        <div class="stepper">
          <span class="s-label">runners</span>
          <button
            type="button"
            aria-label="fewer runners"
            onclick={() => (partySize = step(party, -1, maxParty) || 1)}>−</button
          >
          <span class="mono s-value">{party}</span>
          <button
            type="button"
            aria-label="more runners"
            onclick={() => (partySize = step(party, 1, maxParty))}>+</button
          >
        </div>
        <div class="stepper">
          <span class="s-label">spare rations</span>
          <button
            type="button"
            aria-label="fewer rations"
            onclick={() => (extraProvisions = step(spareProvisions, -2, baseProvisions))}
            >−</button
          >
          <span class="mono s-value">{spareProvisions}</span>
          <button
            type="button"
            aria-label="more rations"
            onclick={() => (extraProvisions = step(spareProvisions, 2, baseProvisions))}
            >+</button
          >
        </div>
        <div class="stepper">
          <span class="s-label">medicine</span>
          <button
            type="button"
            aria-label="less medicine"
            onclick={() => (medicine = step(medicine, -1, 3))}>−</button
          >
          <span class="mono s-value">{medicine}</span>
          <button
            type="button"
            aria-label="more medicine"
            onclick={() => (medicine = step(medicine, 1, 3))}>+</button
          >
        </div>
        <div class="stepper">
          <span class="s-label">gear</span>
          <button
            type="button"
            aria-label="less gear"
            onclick={() => (gear = step(gear, -1, 3))}>−</button
          >
          <span class="mono s-value">{gear}</span>
          <button
            type="button"
            aria-label="more gear"
            onclick={() => (gear = step(gear, 1, 3))}>+</button
          >
        </div>
      </div>
      <p class="quiet-note mono">
        carrying {provisions} rations ({baseProvisions} is what the route asks for)
      </p>
    </section>

    <section class="block">
      <p class="block-label section-label">6 · Terms</p>
      <div class="seg">
        {#each TERMS as t (t.id)}
          <button
            type="button"
            class="seg-opt"
            class:active={terms === t.id}
            onclick={() => selectTerms(t.id)}
          >
            {t.label}
          </button>
        {/each}
      </div>
      <p class="quiet-note">{TERMS.find((t) => t.id === terms)?.hint}</p>
    </section>

    {#if runner && route && costs}
      <p class="cost-preview mono">
        cost: {cost}c ({costs.advance}c advance + {costs.loadout}c supplies)
        · {costs.agreed - costs.advance}c owed on return
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
  .ingredients,
  .routes {
    display: flex;
    flex-direction: column;
    gap: var(--sp-xs);
  }

  .runner,
  .ingredient,
  .route {
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
  .ingredient:focus-visible,
  .route:hover,
  .route:focus-visible {
    border-color: var(--accent);
  }

  .runner.active,
  .ingredient.active,
  .route.active {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 14%, transparent);
  }

  .r-head,
  .ingredient {
    display: flex;
  }

  .steppers {
    display: flex;
    flex-direction: column;
    gap: var(--sp-xs);
  }

  .stepper {
    display: flex;
    align-items: center;
    gap: var(--sp-sm);
  }

  .s-label {
    flex: 1;
    color: var(--text-dim);
    font-size: 14px;
  }

  .s-value {
    min-width: 2ch;
    text-align: center;
    color: var(--text);
  }

  .stepper button {
    min-width: 44px;
    min-height: 44px;
    background: var(--surface-raised);
    border: 1px solid color-mix(in srgb, var(--candle-soft) 30%, transparent);
    border-radius: var(--radius-sm);
    color: var(--text);
  }

  .stepper button:hover,
  .stepper button:focus-visible {
    border-color: var(--accent);
  }

  .quiet-note {
    color: var(--text-faint);
    font-size: 13px;
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
