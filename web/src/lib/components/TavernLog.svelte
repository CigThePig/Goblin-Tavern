<!--
  TavernLog — the Reports → Log screen.

  Phase 94 deliverable: a filterable timeline view of `state.history`.
  Pure presentation; component-local filter state. The projection
  (`buildTavernLog`) does the heavy lifting in
  `src/reports/tavernLogProjection.ts`.

  Layout (top → bottom):
    · sticky filter toolbar (day-range pills · search · category chips · tag chips · clear)
    · "{filtered} of {total} entries" meta line
    · timeline list, grouped by absoluteDay with sticky day headers
    · per-row: category chip · summary · tag pills · actor/location chips

  Chip-tap UX:
    · row category chip → toggle that category filter
    · tag pill → toggle that tag filter
    · actor/location chip → set the entity filter to that ref
  All filters compose with AND; "Clear filters" resets everything.
-->
<script lang="ts">
  import TermLabel from './TermLabel.svelte'
  import { gameStore } from '../sim/gameStore.svelte'
  import { idLabel } from '../../../../src/reports/labels/idLabel'
  import {
    buildTavernLog,
    HISTORY_CATEGORY_LABELS,
  } from '../../../../src/reports/index'
  import type {
    HistoryCategory,
    TavernLogChipRef,
    TavernLogData,
    TavernLogDayRange,
    TavernLogFilters,
  } from '../../../../src/reports/index'

  type EntityFilter = TavernLogChipRef

  const RANGE_OPTIONS: { id: TavernLogDayRange; label: string }[] = [
    { id: 'today', label: 'Today' },
    { id: 'last_7', label: 'Last 7' },
    { id: 'last_28', label: 'Last 28' },
    { id: 'all', label: 'All' },
  ]

  function initialDayRange(): TavernLogDayRange {
    return gameStore.state.calendar.totalDaysElapsed >= 7 ? 'last_7' : 'all'
  }

  let categories = $state<Set<HistoryCategory>>(new Set())
  let tagSet = $state<Set<string>>(new Set())
  let dayRange = $state<TavernLogDayRange>(initialDayRange())
  let search = $state('')
  let entityFilter = $state<EntityFilter | undefined>(undefined)

  const filters = $derived.by<TavernLogFilters>(() => {
    const out: TavernLogFilters = { dayRange }
    if (categories.size > 0) out.categories = [...categories]
    if (tagSet.size > 0) out.tags = [...tagSet]
    const trimmed = search.trim()
    if (trimmed.length > 0) out.search = trimmed
    if (entityFilter) out.entity = { kind: entityFilter.kind, id: entityFilter.id }
    return out
  })

  const data = $derived<TavernLogData>(buildTavernLog(gameStore.state, filters))

  function toggleCategory(id: HistoryCategory) {
    const next = new Set(categories)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    categories = next
  }

  function toggleTag(tag: string) {
    const next = new Set(tagSet)
    if (next.has(tag)) next.delete(tag)
    else next.add(tag)
    tagSet = next
  }

  function setEntity(ref: TavernLogChipRef) {
    entityFilter = ref
  }

  function clearEntity() {
    entityFilter = undefined
  }

  function clearFilters() {
    categories = new Set()
    tagSet = new Set()
    dayRange = initialDayRange()
    search = ''
    entityFilter = undefined
  }
</script>

<main class="log" aria-label="Tavern Log">
  <header class="filter-bar" aria-label="Log filters">
    <div class="row range-row" role="group" aria-label="Day range">
      {#each RANGE_OPTIONS as opt (opt.id)}
        <button
          type="button"
          class="range-pill"
          class:active={dayRange === opt.id}
          aria-pressed={dayRange === opt.id}
          onclick={() => (dayRange = opt.id)}
        >
          {opt.label}
        </button>
      {/each}
    </div>

    <input
      class="search"
      type="search"
      placeholder="Search summaries…"
      aria-label="Search log summaries"
      bind:value={search}
    />

    <div class="row chip-row category-row" role="group" aria-label="Category filters">
      {#each data.categoryFacets as facet (facet.id)}
        <button
          type="button"
          class="chip cat-chip"
          class:active={categories.has(facet.id)}
          class:empty={facet.totalCount === 0}
          data-category={facet.id}
          aria-pressed={categories.has(facet.id)}
          onclick={() => toggleCategory(facet.id)}
        >
          <TermLabel term={`history_${facet.id}`} label={facet.label} />
          <span class="count mono">{facet.totalCount}</span>
        </button>
      {/each}
    </div>

    {#if data.tagFacets.length > 0}
      <div class="row chip-row tag-row" role="group" aria-label="Tag filters">
        {#each data.tagFacets as facet (facet.tag)}
          <button
            type="button"
            class="chip tag-chip"
            class:active={tagSet.has(facet.tag)}
            aria-pressed={tagSet.has(facet.tag)}
            onclick={() => toggleTag(facet.tag)}
          >
            {idLabel('logFacet', facet.tag)} <span class="count mono">{facet.totalCount}</span>
          </button>
        {/each}
      </div>
    {/if}

    {#if entityFilter || data.activeFilterCount > 0}
      <div class="row applied-row">
        {#if entityFilter}
          <span class="entity-active">
            <span class="entity-prefix tag">involving</span>
            <span class="entity-name">{entityFilter.label}</span>
            <button
              type="button"
              class="entity-clear"
              aria-label="Clear entity filter"
              onclick={clearEntity}
            >×</button>
          </span>
        {/if}
        <button type="button" class="clear-all" onclick={clearFilters}>
          Clear filters
        </button>
      </div>
    {/if}

    <p class="meta mono tag dim" aria-live="polite">
      {data.filteredCount} of {data.totalEntries} entries
    </p>
  </header>

  {#if data.emptyReason === 'no_history'}
    <p class="placeholder">No history yet — run a day to start the log.</p>
  {:else if data.emptyReason === 'filtered_out'}
    <p class="placeholder">
      No entries match the current filters.
      <button type="button" class="inline-link" onclick={clearFilters}>Clear filters</button>
    </p>
  {:else}
    <ol class="timeline">
      {#each data.groups as group (group.absoluteDay)}
        <li class="day-group">
          <header class="day-header">
            <span class="day-title display">Day {group.absoluteDay}</span>
            <span class="day-coord tag dim">
              Y{group.year} · M{group.month} · W{group.week} · d{group.day}
            </span>
            <span class="day-count mono">{group.rowCount}</span>
          </header>
          <ol class="day-rows">
            {#each data.rows.slice(group.rowStart, group.rowEnd) as row (row.id)}
              <li class="entry" data-category={row.category}>
                <button
                  type="button"
                  class="row-cat-chip"
                  data-category={row.category}
                  aria-label={`Filter to ${HISTORY_CATEGORY_LABELS[row.category]} category`}
                  onclick={() => toggleCategory(row.category)}
                >
                  {HISTORY_CATEGORY_LABELS[row.category]}
                </button>
                <p class="summary">{row.summary}</p>
                {#if row.tags.length > 0}
                  <div class="tags">
                    <!--
                      Phase 204 / audit Wave 5 (`P2-RT-003`) — keyed on
                      row+index. The projection deduplicates tags, so the
                      tag string is unique in practice; keying on the
                      index means a stray duplicate can never abort the
                      render and take the Log down again.
                    -->
                    {#each row.tags as t, i (`${row.id}:${i}`)}
                      <button
                        type="button"
                        class="tag-pill"
                        class:active={tagSet.has(t)}
                        onclick={() => toggleTag(t)}
                      >{idLabel('logFacet', t)}</button>
                    {/each}
                  </div>
                {/if}
                {#if row.actorChips.length > 0 || row.locationChips.length > 0}
                  <div class="entities">
                    {#each row.actorChips as ch (`a:${ch.kind}:${ch.id}`)}
                      <button
                        type="button"
                        class="entity-chip actor"
                        onclick={() => setEntity(ch)}
                      >{ch.label}</button>
                    {/each}
                    {#each row.locationChips as ch (`l:${ch.kind}:${ch.id}`)}
                      <button
                        type="button"
                        class="entity-chip location"
                        onclick={() => setEntity(ch)}
                      >{ch.label}</button>
                    {/each}
                  </div>
                {/if}
              </li>
            {/each}
          </ol>
        </li>
      {/each}
    </ol>
  {/if}
</main>

<style>
  .log {
    display: flex;
    flex-direction: column;
    gap: var(--sp-md);
  }

  /* ── Filter toolbar ─────────────────────────────────────────────── */
  .filter-bar {
    position: sticky;
    top: 0;
    z-index: 2;
    display: flex;
    flex-direction: column;
    gap: var(--sp-xs);
    padding: var(--sp-sm) var(--sp-xs);
    margin: 0 calc(-1 * var(--sp-xs));
    background: color-mix(in srgb, var(--surface) 96%, transparent);
    backdrop-filter: blur(6px);
    border-bottom: var(--border-faint);
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .chip-row {
    overflow-x: auto;
    flex-wrap: nowrap;
    -webkit-overflow-scrolling: touch;
    padding-bottom: 2px;
  }

  .range-row {
    gap: 2px;
    background: var(--surface);
    border: var(--border-faint);
    border-radius: var(--radius-md);
    padding: 3px;
  }

  .range-pill {
    flex: 1 0 auto;
    min-height: 36px;
    padding: 6px 10px;
    border-radius: var(--radius-sm);
    color: var(--text-faint);
    font-family: var(--font-body);
    font-variant: small-caps;
    letter-spacing: 0.06em;
    font-size: 13px;
    transition: color var(--m-fast) var(--ease), background var(--m-fast) var(--ease);
  }

  .range-pill:hover,
  .range-pill:focus-visible {
    color: var(--text-dim);
  }

  .range-pill.active {
    color: var(--accent);
    background: color-mix(in srgb, var(--accent) 10%, transparent);
  }

  .search {
    width: 100%;
    padding: 8px 12px;
    border-radius: var(--radius-md);
    background: var(--surface);
    border: var(--border-faint);
    color: var(--text);
    font-family: var(--font-mono);
    font-size: 14px;
    min-height: 36px;
  }

  .search:focus-visible {
    border-color: var(--accent);
    outline: none;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    min-height: 32px;
    border-radius: var(--radius-sm);
    border: var(--border-faint);
    background: var(--surface);
    color: var(--text-dim);
    font-family: var(--font-body);
    font-variant: small-caps;
    letter-spacing: 0.04em;
    font-size: 13px;
    white-space: nowrap;
    transition: color var(--m-fast) var(--ease), background var(--m-fast) var(--ease),
      border-color var(--m-fast) var(--ease);
  }

  .chip:hover,
  .chip:focus-visible {
    color: var(--text);
  }

  .chip.empty {
    opacity: 0.45;
  }

  .chip .count {
    font-variant-numeric: tabular-nums;
    color: var(--text-faint);
    font-size: 12px;
  }

  .cat-chip.active {
    color: var(--accent);
    border-color: color-mix(in srgb, var(--accent) 50%, transparent);
    background: color-mix(in srgb, var(--accent) 12%, transparent);
  }

  /* Category-specific accent tints. Cards-contract §3.5 — we name what's
     in state, we never assign meanings the sim doesn't carry. */
  .cat-chip[data-category='pressure'] {
    color: color-mix(in srgb, var(--risk) 70%, var(--text-dim));
  }
  .cat-chip[data-category='memory'] {
    color: color-mix(in srgb, var(--accent) 60%, var(--text-dim));
  }

  .tag-chip {
    font-variant: normal;
    letter-spacing: 0;
    font-family: var(--font-mono);
    font-size: 12px;
  }

  .tag-chip.active {
    color: var(--accent);
    border-color: color-mix(in srgb, var(--accent) 50%, transparent);
    background: color-mix(in srgb, var(--accent) 12%, transparent);
  }

  .applied-row {
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .entity-active {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px 4px 10px;
    background: color-mix(in srgb, var(--accent) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--accent) 50%, transparent);
    border-radius: var(--radius-sm);
    color: var(--accent);
    font-size: 13px;
  }

  .entity-prefix {
    color: var(--text-faint);
    font-variant: small-caps;
    letter-spacing: 0.08em;
  }

  .entity-name {
    font-family: var(--font-body);
  }

  .entity-clear {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: transparent;
    color: var(--text-dim);
    font-size: 16px;
    line-height: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .entity-clear:hover,
  .entity-clear:focus-visible {
    background: color-mix(in srgb, var(--text) 12%, transparent);
    color: var(--text);
  }

  .clear-all {
    padding: 6px 12px;
    border-radius: var(--radius-sm);
    border: var(--border-faint);
    background: var(--surface);
    color: var(--text-dim);
    font-family: var(--font-body);
    font-variant: small-caps;
    letter-spacing: 0.06em;
    font-size: 13px;
    min-height: 32px;
  }

  .clear-all:hover,
  .clear-all:focus-visible {
    color: var(--accent);
    border-color: color-mix(in srgb, var(--accent) 50%, transparent);
  }

  .meta {
    margin: 0;
    padding-top: 2px;
    text-align: right;
    font-size: 12px;
  }

  .meta.dim {
    color: var(--text-faint);
  }

  /* ── Placeholders ───────────────────────────────────────────────── */
  .placeholder {
    color: var(--text-faint);
    font-style: italic;
    text-align: center;
    padding: var(--sp-xl) var(--sp-md);
    background: var(--surface);
    border-radius: var(--radius-md);
    border: var(--border-faint);
    line-height: 1.6;
  }

  .inline-link {
    color: var(--accent);
    text-decoration: underline;
    font-style: italic;
    padding: 0 4px;
  }

  /* ── Timeline ───────────────────────────────────────────────────── */
  .timeline {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--sp-md);
  }

  .day-group {
    display: flex;
    flex-direction: column;
    gap: var(--sp-xs);
  }

  .day-header {
    position: sticky;
    /* Sticks below the filter toolbar; toolbar height varies, so use a
       generous fixed offset that fits the toolbar's chip rows. */
    top: 196px;
    z-index: 1;
    display: flex;
    align-items: baseline;
    gap: var(--sp-sm);
    padding: 6px var(--sp-xs);
    background: color-mix(in srgb, var(--surface) 92%, transparent);
    backdrop-filter: blur(4px);
    border-bottom: var(--border-faint);
    font-family: var(--font-display);
    font-variant: small-caps;
    letter-spacing: 0.06em;
  }

  .day-title {
    color: var(--text);
    font-size: 16px;
  }

  .day-coord {
    flex: 1 1 auto;
    color: var(--text-faint);
    font-family: var(--font-body);
    font-size: 12px;
    letter-spacing: 0.04em;
  }

  .day-count {
    color: var(--text-faint);
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }

  .day-rows {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--sp-xs);
  }

  .entry {
    display: flex;
    flex-direction: column;
    gap: var(--sp-xxs);
    padding: var(--sp-sm);
    background: var(--surface);
    border: var(--border-faint);
    border-radius: var(--radius-md);
    border-left-width: 3px;
  }

  .entry[data-category='owner_action'] {
    border-left-color: var(--accent);
  }
  .entry[data-category='service'] {
    border-left-color: color-mix(in srgb, var(--text-dim) 80%, transparent);
  }
  .entry[data-category='weekly'] {
    border-left-color: color-mix(in srgb, var(--accent) 60%, var(--candle-soft));
  }
  .entry[data-category='monthly'] {
    border-left-color: var(--candle-soft);
  }
  .entry[data-category='state_change'] {
    border-left-color: color-mix(in srgb, var(--text-faint) 80%, transparent);
  }
  .entry[data-category='memory'] {
    border-left-color: color-mix(in srgb, var(--accent) 50%, var(--text-dim));
  }
  .entry[data-category='pressure'] {
    border-left-color: var(--rust);
  }
  .entry[data-category='system'] {
    border-left-color: var(--text-faint);
  }

  .row-cat-chip {
    align-self: flex-start;
    padding: 3px 8px;
    border-radius: var(--radius-sm);
    background: color-mix(in srgb, var(--surface-raised) 60%, transparent);
    color: var(--text-dim);
    font-family: var(--font-body);
    font-variant: small-caps;
    letter-spacing: 0.06em;
    font-size: 11px;
    min-height: 24px;
  }

  .row-cat-chip[data-category='owner_action'] {
    color: var(--accent);
  }
  .row-cat-chip[data-category='weekly'] {
    color: color-mix(in srgb, var(--accent) 80%, var(--text));
  }
  .row-cat-chip[data-category='monthly'] {
    color: var(--candle-soft);
  }
  .row-cat-chip[data-category='memory'] {
    color: color-mix(in srgb, var(--accent) 70%, var(--text-dim));
  }
  .row-cat-chip[data-category='pressure'] {
    color: var(--rust);
  }

  .summary {
    margin: 0;
    color: var(--text);
    font-family: var(--font-body);
    font-size: 15px;
    line-height: 1.5;
  }

  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 2px;
  }

  .tag-pill {
    padding: 2px 7px;
    border-radius: var(--radius-sm);
    background: color-mix(in srgb, var(--surface-raised) 50%, transparent);
    border: 1px solid color-mix(in srgb, var(--candle-soft) 25%, transparent);
    color: var(--text-faint);
    font-family: var(--font-mono);
    font-size: 11px;
    min-height: 22px;
    line-height: 1.4;
  }

  .tag-pill:hover,
  .tag-pill:focus-visible {
    color: var(--text-dim);
    border-color: color-mix(in srgb, var(--accent) 40%, transparent);
  }

  .tag-pill.active {
    color: var(--accent);
    border-color: color-mix(in srgb, var(--accent) 60%, transparent);
    background: color-mix(in srgb, var(--accent) 15%, transparent);
  }

  .entities {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 2px;
  }

  .entity-chip {
    padding: 3px 8px;
    border-radius: var(--radius-sm);
    background: color-mix(in srgb, var(--accent) 8%, transparent);
    border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
    color: color-mix(in srgb, var(--accent) 70%, var(--text));
    font-family: var(--font-body);
    font-size: 12px;
    font-variant: small-caps;
    letter-spacing: 0.04em;
    min-height: 24px;
  }

  .entity-chip:hover,
  .entity-chip:focus-visible {
    background: color-mix(in srgb, var(--accent) 16%, transparent);
    color: var(--accent);
  }

  .entity-chip.location {
    background: color-mix(in srgb, var(--text-faint) 12%, transparent);
    border-color: color-mix(in srgb, var(--text-faint) 35%, transparent);
    color: var(--text-dim);
  }

  .entity-chip.location:hover,
  .entity-chip.location:focus-visible {
    background: color-mix(in srgb, var(--text-faint) 18%, transparent);
    color: var(--text);
  }
</style>
