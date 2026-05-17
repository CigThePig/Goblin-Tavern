<!--
  Glossary — searchable definition lookup for sim terms.

  Wraps the static `GLOSSARY_TERMS` (src/reports/glossary.ts) in the
  generic BottomSheet primitive. The `anchorTerm` prop scrolls to a
  specific entry on open — useful when a TermLabel chip opens the
  sheet at the term it represents.
-->
<script lang="ts">
  import BottomSheet from './BottomSheet.svelte'
  import {
    GLOSSARY_TERMS,
    GLOSSARY_CATEGORY_LABELS,
    termsByCategory,
    searchTerms,
  } from '../../../../src/reports/glossary'
  import type { GlossaryCategory, GlossaryTerm } from '../../../../src/reports/types'

  let {
    open,
    onclose,
    anchorTerm,
  }: {
    open: boolean
    onclose: () => void
    anchorTerm?: string | undefined
  } = $props()

  let query = $state('')
  const grouped = termsByCategory()
  const CATEGORY_ORDER: GlossaryCategory[] = ['pressure', 'reputation', 'mechanic']

  const filtered = $derived.by<GlossaryTerm[]>(() => {
    if (query.trim().length === 0) return GLOSSARY_TERMS
    return searchTerms(query)
  })

  const filteredByCategory = $derived.by<Record<GlossaryCategory, GlossaryTerm[]>>(() => {
    if (query.trim().length === 0) return grouped
    const result: Record<GlossaryCategory, GlossaryTerm[]> = {
      pressure: [],
      reputation: [],
      mechanic: [],
    }
    for (const t of filtered) result[t.category].push(t)
    return result
  })

  // Scroll to anchor when opening or when anchor changes.
  let sheetBody = $state<HTMLDivElement | null>(null)
  $effect(() => {
    if (!open || !anchorTerm) return
    queueMicrotask(() => {
      const el = document.getElementById(`glossary-term-${anchorTerm}`)
      if (el) el.scrollIntoView({ block: 'center', behavior: 'auto' })
    })
  })
</script>

<BottomSheet {open} title="Glossary" {onclose}>
  <div class="glossary" bind:this={sheetBody}>
    <input
      type="search"
      class="search"
      placeholder="Search terms…"
      aria-label="Search glossary"
      bind:value={query}
    />

    {#each CATEGORY_ORDER as category (category)}
      {#if filteredByCategory[category].length > 0}
        <section class="bucket" aria-label={GLOSSARY_CATEGORY_LABELS[category]}>
          <h3 class="bucket-label tag">{GLOSSARY_CATEGORY_LABELS[category]}</h3>
          <ul class="terms">
            {#each filteredByCategory[category] as term (term.id)}
              <li
                id={`glossary-term-${term.id}`}
                class="term"
                class:anchor={term.id === anchorTerm}
              >
                <p class="term-label">{term.label}</p>
                <p class="term-one">{term.oneLine}</p>
                {#if term.longer}
                  <p class="term-long">{term.longer}</p>
                {/if}
              </li>
            {/each}
          </ul>
        </section>
      {/if}
    {/each}

    {#if filtered.length === 0}
      <p class="quiet">no terms match "{query}"</p>
    {/if}
  </div>
</BottomSheet>

<style>
  .glossary {
    display: flex;
    flex-direction: column;
    gap: var(--sp-md);
  }

  .search {
    width: 100%;
    background: var(--ink-deep);
    color: var(--text);
    border: var(--border-faint);
    border-radius: var(--radius-sm);
    padding: 10px var(--sp-sm);
    font-family: var(--font-body);
    font-size: 15px;
  }

  .search:focus-visible {
    outline: 1px solid var(--accent);
    outline-offset: 1px;
  }

  .bucket {
    display: flex;
    flex-direction: column;
    gap: var(--sp-xs);
  }

  .bucket-label {
    color: var(--accent);
  }

  .terms {
    display: flex;
    flex-direction: column;
    gap: var(--sp-sm);
  }

  .term {
    padding: var(--sp-sm);
    border-radius: var(--radius-sm);
    background: var(--ink-deep);
    border: var(--border-faint);
    transition: border-color var(--m-fast) var(--ease);
  }

  .term.anchor {
    border-color: var(--accent);
  }

  .term-label {
    font-family: var(--font-body);
    font-weight: 500;
    color: var(--text);
    font-size: 15px;
  }

  .term-one {
    color: var(--text-dim);
    font-size: 14px;
    margin-top: 2px;
  }

  .term-long {
    color: var(--text-faint);
    font-size: 13px;
    margin-top: var(--sp-xs);
    line-height: 1.5;
  }

  .quiet {
    color: var(--text-faint);
    font-style: italic;
    text-align: center;
    padding: var(--sp-lg) 0;
  }
</style>
