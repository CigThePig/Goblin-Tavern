<!--
  RecipesPanel — the Tavern > Recipes list.

  Two sections: On menu, Available (off-menu). Each row shows a toggle
  pill that queues `toggle_recipe_menu` for that recipe. Row body tap
  opens the detail sheet with inputs / prep difficulty / etc.
-->
<script lang="ts">
  import RecipeDetailSheet from './RecipeDetailSheet.svelte'
  import TermLabel from '../TermLabel.svelte'
  import { gameStore } from '../../sim/gameStore.svelte'
  import { actionRegistry } from '../../../../../src/sim/registries/actionRegistry'
  import type {
    RecipePanelData,
    RecipeRow,
  } from '../../../../../src/reports/tavernOverviewProjection'

  let { data }: { data: RecipePanelData } = $props()

  let selected = $state<RecipeRow | null>(null)

  function open(row: RecipeRow) {
    selected = row
  }
  function close() {
    selected = null
  }

  function isToggleQueued(recipeId: string): boolean {
    return gameStore.isQueued('toggle_recipe_menu', recipeId)
  }

  function servedLabel(row: RecipeRow): string {
    const parts = [`prep ${row.prepDifficulty}`]
    if (row.timesServed > 0) parts.push(`served ${row.timesServed} times`)
    return parts.join(' · ')
  }

  let toggleError = $state<string | undefined>(undefined)

  function toggleMenu(row: RecipeRow, event: MouseEvent) {
    event.stopPropagation()
    if (isToggleQueued(row.id)) {
      gameStore.removePicksFor('toggle_recipe_menu', row.id)
      toggleError = undefined
      return
    }
    const def = actionRegistry.get('toggle_recipe_menu')
    // Phase 90 / ISSUE-050 — Funnel through tryAddPick so the menu
    // toggle respects the same budget gate the central picker enforces.
    const result = gameStore.tryAddPick({
      actionId: 'toggle_recipe_menu',
      label: def?.label ?? 'Toggle Recipe',
      category: 'immediate',
      targetType: 'recipe',
      targetId: row.id,
      targetLabel: row.label,
      actionPointCost: def?.actionPointCost ?? 0,
    })
    toggleError = result.ok ? undefined : result.reason
  }
</script>

<section class="panel" aria-label="Recipes">
  <section class="block">
    <h2 class="block-label tag">
      <TermLabel term="on_menu" label="On menu" /> ({data.onMenu.length})
    </h2>
    {#if data.onMenu.length === 0}
      <p class="quiet">
        No recipes on the menu. Customers will have nothing to order.
        Stew, Ale, and Mushrooms are good starters.
      </p>
    {:else}
      <ul class="rows">
        {#each data.onMenu as row (row.id)}
          {@const queued = isToggleQueued(row.id)}
          <li class="row">
            <div
              class="row-body"
              role="button"
              tabindex="0"
              onclick={() => open(row)}
              onkeydown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') open(row)
              }}
            >
              <header class="head">
                <span class="label">{row.label}</span>
              </header>
              <div class="meta">
                <span class="ing mono">
                  {row.inputs
                    .map((i) => `${i.quantity}× ${i.ingredientLabel}`)
                    .join(', ')}
                </span>
                <span class="tier tag rarity-{row.demandTier}">{row.demandTier}</span>
              </div>
              <p class="meta-line tag">{servedLabel(row)}</p>
              {#if row.blocked}
                <p class="blocked">⚠ {row.blockedReason}</p>
              {/if}
            </div>
            <button
              type="button"
              class="toggle on"
              class:queued
              onclick={(e) => toggleMenu(row, e)}
            >
              {queued ? '→ off (queued)' : 'on menu'}
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  {#if data.available.length > 0}
    <section class="block">
      <h2 class="block-label tag">
        Available ({data.available.length})
      </h2>
      <ul class="rows">
        {#each data.available as row (row.id)}
          {@const queued = isToggleQueued(row.id)}
          <li class="row">
            <div
              class="row-body"
              role="button"
              tabindex="0"
              onclick={() => open(row)}
              onkeydown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') open(row)
              }}
            >
              <header class="head">
                <span class="label">{row.label}</span>
              </header>
              <div class="meta">
                <span class="ing mono">
                  {row.inputs
                    .map((i) => `${i.quantity}× ${i.ingredientLabel}`)
                    .join(', ')}
                </span>
                <span class="tier tag rarity-{row.demandTier}">{row.demandTier}</span>
              </div>
              <p class="meta-line tag">{servedLabel(row)}</p>
              {#if row.blocked}
                <p class="blocked">⚠ {row.blockedReason}</p>
              {/if}
            </div>
            <button
              type="button"
              class="toggle off"
              class:queued
              onclick={(e) => toggleMenu(row, e)}
            >
              {queued ? '→ on (queued)' : 'off menu'}
            </button>
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  {#if toggleError}
    <p class="live-reason">Couldn't queue: {toggleError}</p>
  {/if}
</section>

<RecipeDetailSheet recipe={selected} open={selected !== null} onclose={close} />

<style>
  .panel {
    display: flex;
    flex-direction: column;
    gap: var(--sp-lg);
  }

  .block {
    display: flex;
    flex-direction: column;
    gap: var(--sp-sm);
  }

  .block-label {
    color: var(--accent);
  }

  .quiet {
    color: var(--text-faint);
    font-style: italic;
    padding: var(--sp-md);
    background: var(--surface);
    border-radius: var(--radius-md);
    border: var(--border-faint);
    text-align: center;
  }

  .rows {
    display: flex;
    flex-direction: column;
    gap: var(--sp-sm);
  }

  .row {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: var(--sp-sm);
    padding: var(--sp-sm) var(--sp-md);
    width: 100%;
    background: var(--surface);
    border: var(--border-faint);
    border-radius: var(--radius-md);
    min-height: 72px;
    align-items: center;
    transition: border-color var(--m-fast) var(--ease);
  }

  .row:has(.row-body:hover),
  .row:has(.row-body:focus-visible) {
    border-color: var(--accent);
  }

  .row-body {
    display: flex;
    flex-direction: column;
    gap: var(--sp-xs);
    text-align: left;
    cursor: pointer;
  }

  .head {
    display: flex;
    align-items: center;
    gap: var(--sp-sm);
  }

  .label {
    color: var(--text);
    font-size: 16px;
  }

  .toggle {
    font-family: var(--font-body);
    font-variant: small-caps;
    letter-spacing: 0.06em;
    font-size: 12px;
    padding: 6px 12px;
    border-radius: 999px;
    border: 1px solid color-mix(in srgb, var(--candle-soft) 40%, transparent);
    transition: color var(--m-fast) var(--ease),
      border-color var(--m-fast) var(--ease),
      background var(--m-fast) var(--ease);
    min-height: 32px;
    white-space: nowrap;
  }

  .toggle.on {
    color: var(--accent);
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 10%, transparent);
  }

  .toggle.off {
    color: var(--text-faint);
  }

  .toggle:hover,
  .toggle:focus-visible {
    color: var(--text);
    border-color: var(--accent);
  }

  .toggle.queued {
    color: var(--text);
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 18%, transparent);
  }

  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-xs);
    align-items: baseline;
  }

  .ing {
    color: var(--text-dim);
  }

  .tier {
    padding: 2px 8px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--candle-soft) 14%, transparent);
    text-transform: capitalize;
  }

  .rarity-uncommon {
    color: var(--moss);
    background: color-mix(in srgb, var(--moss) 14%, transparent);
  }

  .rarity-rare {
    color: var(--accent);
    background: color-mix(in srgb, var(--accent) 14%, transparent);
  }

  .rarity-legendary {
    color: var(--rust);
    background: color-mix(in srgb, var(--rust) 16%, transparent);
  }

  .meta-line {
    color: var(--text-faint);
    margin: 2px 0 0;
    font-size: 12px;
  }

  .blocked {
    color: var(--loss);
    font-style: italic;
    font-size: 13px;
  }

  .live-reason {
    color: var(--loss);
    font-size: 12px;
    line-height: 1.4;
  }
</style>
