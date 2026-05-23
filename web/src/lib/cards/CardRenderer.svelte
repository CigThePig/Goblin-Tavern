<script lang="ts">
  import Icon from '../components/Icon.svelte'
  import { prefsStore } from '../prefs/prefsStore.svelte'
  import type { CardView, CardChoice } from './types'

  let {
    card,
    onchoose,
    onignore,
  }: {
    card: CardView
    onchoose?: (slotId: string, choice: CardChoice) => void
    onignore?: () => void
  } = $props()

  // Phase 98 — Show the seed-family tag in the card corner unless the
  // player has hidden it via Preferences. The data is always available;
  // visibility is a player preference.
  const showSeedTag = $derived(prefsStore.preferences.showSeedTags)

  const stakeIcon = (d: 'loss' | 'gain' | 'risk') =>
    d === 'loss' ? 'stake-loss' : d === 'gain' ? 'stake-gain' : 'stake-risk'

  const stakeColor = (d: 'loss' | 'gain' | 'risk') =>
    d === 'loss' ? 'var(--loss)' : d === 'gain' ? 'var(--gain)' : 'var(--risk)'

  const showSeal = $derived((card.severity ?? 0) >= 70)

  // ISSUE-047 — when the seed already models an `ignore`-verb slot, that
  // slot (rendered as a normal choice) IS the player's "do nothing"
  // option; the generic Ignore would be a sneakier alternative whose
  // matcher path differs. Hide the generic button so the player must
  // pick the modeled choice and its real consequences.
  const hasIgnoreChoice = $derived(card.choices.some((c) => c.verb === 'ignore'))

  function shapeLabel(s: string): string {
    return s.replace(/_/g, ' ')
  }
</script>

<article class="card rise-in" aria-label={card.title}>
  <header class="head">
    <h2 class="title display">{card.title}</h2>
    {#if card.tag && showSeedTag}
      <span class="tag">{card.tag}</span>
    {/if}
    {#if showSeal}
      <span class="seal" aria-label="High-severity">
        <Icon name="seal" size={14} />
      </span>
    {/if}
  </header>

  {#if card.body.length > 0}
    <div class="body">
      {#each card.body as line, i (i)}
        <p class="line">{line}</p>
      {/each}
    </div>
  {/if}

  {#if card.stakes.length > 0}
    <div class="stakes" aria-label="Stakes">
      {#each card.stakes as s (s.readable)}
        <div class="stake">
          <span class="stake-icon" style="color: {stakeColor(s.direction)};">
            <Icon name={stakeIcon(s.direction)} size={14} />
          </span>
          <span class="stake-text">{s.readable}</span>
        </div>
      {/each}
    </div>
  {/if}

  <div class="choices">
    {#each card.choices as c (c.slotId)}
      <button
        type="button"
        class="choice"
        disabled={!!c.disabledReason}
        onclick={() => onchoose?.(c.slotId, c)}
      >
        <span class="choice-label">{c.label}</span>
        <span class="choice-meta tag">
          {c.verb} · {shapeLabel(c.shape)}
        </span>
        {#if c.previewEffects.length > 0}
          <ul class="preview mono">
            {#each c.previewEffects as e, i (i)}
              <li>{e}</li>
            {/each}
          </ul>
        {/if}
        {#if c.disabledReason}
          <p class="disabled-reason"><em>{c.disabledReason}</em></p>
        {/if}
      </button>
    {/each}

    {#if !hasIgnoreChoice}
      <button class="choice ignore" type="button" onclick={() => onignore?.()}>
        <span class="choice-label">Ignore</span>
        <span class="choice-meta tag">do nothing</span>
      </button>
    {/if}
  </div>
</article>

<style>
  .card {
    background: var(--surface-raised);
    border: var(--border);
    border-radius: var(--radius-md);
    padding: var(--sp-md);
    box-shadow: var(--shadow-md);
    position: relative;
    display: flex;
    flex-direction: column;
    gap: var(--sp-md);
  }

  .head {
    display: flex;
    align-items: baseline;
    gap: var(--sp-sm);
    flex-wrap: wrap;
    padding-right: 24px; /* leave room for seal */
  }

  .title {
    font-size: 20px;
    letter-spacing: 0.06em;
    color: var(--text);
    flex: 1;
    min-width: 0;
  }

  .tag {
    font-variant: small-caps;
    letter-spacing: 0.06em;
    color: var(--text-faint);
    font-size: 11px;
  }

  .seal {
    position: absolute;
    top: var(--sp-sm);
    right: var(--sp-sm);
    color: var(--seal);
  }

  .body {
    display: flex;
    flex-direction: column;
    gap: var(--sp-xxs);
  }

  .line {
    font-family: var(--font-body);
    font-size: var(--type-body);
    line-height: var(--line-body);
    color: var(--text-dim);
  }

  .stakes {
    display: flex;
    flex-direction: column;
    gap: var(--sp-xxs);
    padding: var(--sp-xs) var(--sp-sm);
    border-left: 2px solid var(--candle-soft);
    background: color-mix(in srgb, var(--ink-deep) 50%, transparent);
    border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  }

  .stake {
    display: flex;
    align-items: flex-start;
    gap: var(--sp-xs);
  }

  .stake-icon {
    display: inline-flex;
    margin-top: 2px;
    flex-shrink: 0;
  }

  .stake-text {
    font-size: 14px;
    color: var(--text-dim);
    line-height: 1.4;
  }

  .choices {
    display: flex;
    flex-direction: column;
    gap: var(--sp-xs);
  }

  .choice {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--sp-xxs);
    padding: var(--sp-sm) var(--sp-md);
    background: var(--ink);
    border: 1px solid color-mix(in srgb, var(--candle-soft) 50%, transparent);
    border-radius: var(--radius-sm);
    color: var(--text);
    text-align: left;
    min-height: 56px;
    transition:
      border-color var(--m-fast) var(--ease),
      background var(--m-fast) var(--ease);
  }

  .choice:not(:disabled):hover,
  .choice:not(:disabled):focus-visible {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 6%, var(--ink));
  }

  .choice:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .choice-label {
    font-family: var(--font-body);
    font-size: 16px;
    color: var(--text);
  }

  .choice-meta {
    color: var(--accent-soft);
  }

  .preview {
    margin-top: 2px;
    color: var(--text-faint);
    font-size: 13px;
  }

  .preview li {
    padding: 1px 0;
  }

  .preview li::before {
    content: '· ';
    color: var(--candle-soft);
  }

  .disabled-reason {
    color: var(--loss);
    font-size: 13px;
  }

  .ignore {
    background: transparent;
    border-color: color-mix(in srgb, var(--ash) 30%, transparent);
    color: var(--text-faint);
    min-height: 44px;
    align-items: center;
    flex-direction: row;
    justify-content: space-between;
  }

  .ignore:hover,
  .ignore:focus-visible {
    color: var(--text-dim);
    border-color: var(--ash);
    background: transparent;
  }
</style>
