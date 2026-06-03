<!--
  RecipeDetailSheet — detail sheet for a single recipe.
-->
<script lang="ts">
  import BottomSheet from '../BottomSheet.svelte'
  import QuickActions from './QuickActions.svelte'
  import TermLabel from '../TermLabel.svelte'
  import type { RecipeRow } from '../../../../../src/reports/tavernOverviewProjection'

  let {
    recipe,
    open,
    onclose,
  }: { recipe: RecipeRow | null; open: boolean; onclose: () => void } = $props()
</script>

<BottomSheet {open} title={recipe?.label ?? 'Recipe'} {onclose}>
  {#snippet children()}
    {#if recipe}
      <div class="lede">
        <span class="badge" class:on={recipe.onMenu}>
          {recipe.onMenu ? 'on menu' : 'off menu'}
        </span>
        <span class="tier chip rarity-{recipe.demandTier}">{recipe.demandTier}</span>
      </div>

      <section class="block">
        <p class="block-label section-label">Inputs</p>
        <ul class="inputs">
          {#each recipe.inputs as input (input.ingredientId)}
            {@const ok = input.available >= input.quantity}
            <li class="input" class:short={!ok}>
              <span class="input-label">{input.ingredientLabel}</span>
              <span class="input-qty mono">
                need {input.quantity}, have {input.available}
              </span>
            </li>
          {/each}
        </ul>
        {#if recipe.blocked}
          <p class="blocked">⚠ {recipe.blockedReason}</p>
        {/if}
      </section>

      <section class="block">
        <p class="block-label section-label">Profile</p>
        <dl class="kv">
          <div>
            <dt><TermLabel term="prep_difficulty" /></dt>
            <dd class="mono">{recipe.prepDifficulty}</dd>
          </div>
          <div>
            <dt><TermLabel term="demand_tier" /></dt>
            <dd class="mono">{recipe.demandTier}</dd>
          </div>
          <div>
            <dt>times served</dt>
            <dd class="mono">{recipe.timesServed}</dd>
          </div>
          <div>
            <dt>last served</dt>
            <dd class="mono">
              {recipe.daysSinceLastServed === 0
                ? 'today'
                : `${recipe.daysSinceLastServed}d ago`}
            </dd>
          </div>
        </dl>
      </section>

      {#if recipe.culturalTags.length > 0}
        <section class="block">
          <p class="block-label section-label">Cultural tags</p>
          <p class="tags">{recipe.culturalTags.join(' · ')}</p>
        </section>
      {/if}

      {#if recipe.tags.length > 0}
        <section class="block">
          <p class="block-label section-label">Tags</p>
          <p class="tags">{recipe.tags.join(' · ')}</p>
        </section>
      {/if}

      <QuickActions
        actions={recipe.applicableActions}
        targetId={recipe.id}
        targetLabel={recipe.label}
      />
    {/if}
  {/snippet}
</BottomSheet>

<style>
  .lede {
    display: flex;
    align-items: baseline;
    gap: var(--sp-sm);
    margin-bottom: var(--sp-md);
  }

  .badge {
    font-family: var(--font-body);
    font-variant: small-caps;
    letter-spacing: 0.06em;
    font-size: 12px;
    color: var(--text-faint);
    padding: 4px 12px;
    border-radius: 999px;
    border: 1px solid color-mix(in srgb, var(--candle-soft) 40%, transparent);
  }

  .badge.on {
    color: var(--accent);
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 10%, transparent);
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

  .block {
    display: flex;
    flex-direction: column;
    gap: var(--sp-xs);
    margin-top: var(--sp-md);
  }

  .block-label {
    color: var(--accent);
  }

  .inputs {
    display: flex;
    flex-direction: column;
    gap: var(--sp-xs);
  }

  .input {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: var(--sp-md);
    padding: var(--sp-xs) var(--sp-sm);
    background: var(--surface-raised);
    border-radius: var(--radius-sm);
  }

  .input-label {
    color: var(--text);
  }

  .input-qty {
    color: var(--text-dim);
  }

  .input.short .input-qty {
    color: var(--loss);
  }

  .blocked {
    color: var(--loss);
    font-style: italic;
    font-size: 13px;
  }

  .kv {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .kv > div {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: var(--sp-md);
  }

  .kv dt {
    color: var(--text-faint);
    font-family: var(--font-body);
    font-variant: small-caps;
    letter-spacing: 0.06em;
    font-size: 13px;
  }

  .kv dd {
    color: var(--text);
    margin: 0;
  }

  .tags {
    color: var(--text-dim);
  }
</style>
