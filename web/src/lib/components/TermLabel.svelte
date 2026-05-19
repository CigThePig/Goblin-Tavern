<!--
  TermLabel — inline chip wrapping a glossary term id.

  Renders the term's label visually with a subtle hint that it's
  tappable. On tap, opens the global Glossary sheet anchored at the
  term. Falls back to plain text when the term id is unknown.

  Phase 98 — When `prefsStore.preferences.showFirstEncounterHints` is
  on AND the term hasn't been seen yet AND the player is within the
  introductory week, the chip pulses and an inline popover surfaces
  the term's one-line definition. The popover serializes via the
  prefs store so only one is visible at a time.
-->
<script lang="ts">
  import { getTerm } from '../../../../src/reports/glossary'
  import { glossaryStore } from '../glossary/glossaryStore.svelte'
  import { prefsStore } from '../prefs/prefsStore.svelte'
  import { shouldShowFirstEncounterHint } from '../prefs/firstEncounter'
  import { gameStore } from '../sim/gameStore.svelte'
  import FirstEncounterHint from './FirstEncounterHint.svelte'

  let {
    term,
    label,
    hintEnabled = true,
  }: {
    term: string
    /** Override label; defaults to the term's stored label. */
    label?: string
    /** Caller can opt out of the first-encounter hint for chips that
     *  appear inside crowded layouts (e.g. inside the glossary itself). */
    hintEnabled?: boolean
  } = $props()

  const entry = $derived(getTerm(term))
  const displayLabel = $derived(label ?? entry?.label ?? term)

  let chipEl: HTMLButtonElement | undefined = $state(undefined)

  const showHint = $derived.by(() => {
    if (!hintEnabled) return false
    if (!entry) return false
    return shouldShowFirstEncounterHint(
      term,
      prefsStore.preferences,
      gameStore.state.calendar.day,
    )
  })

  const pulsing = $derived(showHint && prefsStore.currentlyShowingHint === term)

  function open(e: MouseEvent) {
    if (!entry) return
    e.stopPropagation()
    glossaryStore.show(term)
  }
</script>

{#if entry}
  <span class="term-chip-wrap">
    <button
      bind:this={chipEl}
      class="term-chip"
      class:first-encounter-pulse={pulsing}
      type="button"
      onclick={open}
      aria-label={`Define ${displayLabel}`}
    >
      {displayLabel}
    </button>
    {#if showHint}
      <FirstEncounterHint termId={term} anchor={chipEl} />
    {/if}
  </span>
{:else}
  <span class="term-chip-plain">{displayLabel}</span>
{/if}

<style>
  .term-chip-wrap {
    position: relative;
    display: inline-block;
  }

  .term-chip {
    font: inherit;
    color: inherit;
    background: transparent;
    border-bottom: 1px dotted color-mix(in srgb, var(--accent) 50%, transparent);
    padding: 0;
    cursor: help;
    transition: color var(--m-fast) var(--ease), border-color var(--m-fast) var(--ease);
  }

  .term-chip:hover,
  .term-chip:focus-visible {
    color: var(--accent);
    border-bottom-color: var(--accent);
  }

  .term-chip-plain {
    color: inherit;
  }
</style>
