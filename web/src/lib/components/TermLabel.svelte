<!--
  TermLabel — inline chip wrapping a glossary term id.

  Renders the term's label visually with a subtle hint that it's
  tappable. On tap, opens the global Glossary sheet anchored at the
  term. Falls back to plain text when the term id is unknown.
-->
<script lang="ts">
  import { getTerm } from '../../../../src/reports/glossary'
  import { glossaryStore } from '../glossary/glossaryStore.svelte'

  let {
    term,
    label,
  }: {
    term: string
    /** Override label; defaults to the term's stored label. */
    label?: string
  } = $props()

  const entry = $derived(getTerm(term))
  const displayLabel = $derived(label ?? entry?.label ?? term)

  function open() {
    if (!entry) return
    glossaryStore.show(term)
  }
</script>

{#if entry}
  <button
    class="term-chip"
    type="button"
    onclick={open}
    aria-label={`Define ${displayLabel}`}
  >
    {displayLabel}
  </button>
{:else}
  <span class="term-chip-plain">{displayLabel}</span>
{/if}

<style>
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
