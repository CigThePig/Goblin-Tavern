<script lang="ts">
  import Icon from '../components/Icon.svelte'
  import { prefsStore } from '../prefs/prefsStore.svelte'
  import type { CardView, CardChoice, CardContextLine } from './types'

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

  // Snippet pools emit lowercase prose fragments ("coin would leave the
  // till by a step") next to capitalized ones — normalize to sentence
  // case at the display boundary so a card's preview list reads evenly.
  const sentenceCase = (s: string) =>
    s.length > 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s

  // ISSUE-047 — when the seed already models an `ignore`-verb slot, that
  // slot (rendered as a normal choice) IS the player's "do nothing"
  // option; the generic Ignore would be a sneakier alternative whose
  // matcher path differs. Hide the generic button so the player must
  // pick the modeled choice and its real consequences.
  const hasIgnoreChoice = $derived(card.choices.some((c) => c.verb === 'ignore'))

  const displayContextSections = $derived(
    [
      { label: 'Why now', lines: card.context?.whyNow ?? [] },
      { label: 'Because', lines: card.context?.causes ?? [] },
      { label: 'History', lines: card.context?.history ?? [] },
      { label: 'At stake', lines: card.context?.future ?? [] },
    ]
      .map((section) => ({
        ...section,
        lines: section.lines.slice(0, 2) as CardContextLine[],
      }))
      .filter((section) => section.lines.length > 0),
  )
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

  {#if displayContextSections.length > 0}
    <section class="context" aria-label="Card context">
      {#each displayContextSections as section (section.label)}
        <div class="context-section">
          <h3 class="context-label">{section.label}</h3>
          <ul class="context-lines">
            {#each section.lines as line (line.kind + line.source + line.readable)}
              <li>{line.readable}</li>
            {/each}
          </ul>
        </div>
      {/each}
    </section>
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
        {#if c.previewEffects.length > 0}
          <ul class="preview" aria-label="Narrative effects">
            {#each c.previewEffects as e, i (i)}
              <li>{sentenceCase(e)}</li>
            {/each}
          </ul>
        {/if}
        {#if c.mechanicalEffects && c.mechanicalEffects.length > 0}
          <ul class="mechanical-preview" aria-label="Mechanical effects">
            {#each c.mechanicalEffects as e, i (i)}
              <li class="mechanical-chip mono">{e}</li>
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
        <span class="choice-meta chip">do nothing</span>
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

  .context {
    display: flex;
    flex-direction: column;
    gap: var(--sp-xs);
    padding: var(--sp-xs) var(--sp-sm);
    border-left: 2px solid color-mix(in srgb, var(--accent-soft) 45%, transparent);
    background: rgba(0, 0, 0, 0.14);
    border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  }

  .context-section {
    display: grid;
    grid-template-columns: minmax(68px, max-content) 1fr;
    gap: var(--sp-xs);
    align-items: start;
  }

  .context-label {
    margin: 0;
    color: var(--text-faint);
    font-size: 11px;
    font-variant: small-caps;
    letter-spacing: 0.06em;
  }

  .context-lines {
    margin: 0;
    color: var(--text-dim);
    font-size: 13px;
    line-height: 1.35;
  }

  .context-lines li {
    padding-bottom: 1px;
  }

  .context-lines li::before {
    content: '· ';
    color: var(--accent-soft);
  }

  .stakes {
    display: flex;
    flex-direction: column;
    gap: var(--sp-xxs);
    padding: var(--sp-xs) var(--sp-sm);
    border-left: 2px solid var(--candle-soft);
    background: rgba(0, 0, 0, 0.2);
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
    background: var(--surface);
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
    background: color-mix(in srgb, var(--accent) 6%, var(--surface));
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

  /* Narrative previews read as prose (body italic), so they are visually
     distinct from the mechanical chips below; mono is reserved for
     figures. Snippet pools emit lowercase fragments — capitalize at the
     display boundary. */
  .preview {
    margin-top: 2px;
    color: var(--text-faint);
    font-family: var(--font-body);
    font-style: italic;
    font-size: 13.5px;
    line-height: 1.4;
  }

  .preview li {
    padding: 1px 0;
  }

  .preview li::before {
    content: '· ';
    color: var(--candle-soft);
  }

  .mechanical-preview {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 2px;
  }

  .mechanical-chip {
    border: 1px solid color-mix(in srgb, var(--accent-soft) 45%, transparent);
    border-radius: 999px;
    padding: 2px 7px;
    color: var(--accent-soft);
    background: color-mix(in srgb, var(--accent) 8%, transparent);
    font-size: 12px;
    line-height: 1.35;
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
