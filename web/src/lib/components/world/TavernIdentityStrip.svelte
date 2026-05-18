<!--
  TavernIdentityStrip — header strip above the World sub-nav.

  Phase 93 §2 of the plan. Surfaces non-prescriptive "identity hints"
  rather than a class label: founding day, top atmosphere tags, count
  of house rules and known-for adjectives. Collapsed to a single line
  by default; tap to expand and reveal the full lists.

  Phase 95 — Voice & Identity Pass. Identity is now populated daily by
  `tavernIdentityModule`; the strip carries non-empty content from day
  zero. Two new sections — "Voices" (aggregated public attributions)
  and "Nicknames" (sturdy nickname rumours) — surface the §9.5 option-2
  "identity-as-perception" layer.
-->
<script lang="ts">
  import TermLabel from '../TermLabel.svelte'
  import type { TavernIdentityData } from '../../../../../src/reports/worldOverviewProjection'

  let { data }: { data: TavernIdentityData } = $props()

  let expanded = $state(false)

  // The lede prefers atmosphere tags but falls back to known-for so
  // a day-one strip with only "cheap goblin food" still reads.
  const summaryTags = $derived.by(() => {
    if (data.atmosphereTags.length > 0) return data.atmosphereTags.slice(0, 3)
    if (data.knownFor.length > 0) return data.knownFor.slice(0, 3)
    return []
  })

  const hasIdentityContent = $derived(
    data.knownFor.length > 0 ||
      data.houseRules.length > 0 ||
      data.atmosphereTags.length > 0 ||
      data.attributionHints.length > 0 ||
      data.nicknames.length > 0,
  )
</script>

<section class="strip" aria-label="Tavern identity">
  <button
    class="head"
    type="button"
    onclick={() => (expanded = !expanded)}
    aria-expanded={expanded}
  >
    <div class="lede">
      <span class="display heading">The Crooked Keg</span>
      <span class="age tag">day {data.daysOpen} open</span>
    </div>
    <div class="hints">
      {#if data.nicknames.length > 0}
        <span class="hint nickname">"{data.nicknames[0]}"</span>
      {:else if summaryTags.length > 0}
        <span class="hint">{summaryTags.join(' · ')}</span>
      {:else}
        <span class="hint quiet">no atmosphere recorded yet</span>
      {/if}
      <span class="chev" aria-hidden="true">{expanded ? '▾' : '▸'}</span>
    </div>
  </button>

  {#if expanded}
    <div class="expand">
      <div class="kv">
        <p class="kv-label tag">
          <TermLabel term="tavern_identity" label="Identity" />
        </p>
        <p class="kv-value">founded on day {data.foundingDay}</p>
      </div>

      {#if data.atmosphereTags.length > 0}
        <div class="kv">
          <p class="kv-label tag">
            <TermLabel term="atmosphere" label="Atmosphere" />
          </p>
          <p class="kv-value">{data.atmosphereTags.join(' · ')}</p>
        </div>
      {/if}

      {#if data.knownFor.length > 0}
        <div class="kv">
          <p class="kv-label tag">
            <TermLabel term="known_for" label="Known for" />
          </p>
          <p class="kv-value">{data.knownFor.join(' · ')}</p>
        </div>
      {/if}

      {#if data.houseRules.length > 0}
        <div class="kv">
          <p class="kv-label tag">
            <TermLabel term="house_rules" label="House rules" />
          </p>
          <ul class="rules">
            {#each data.houseRules as rule, i (i)}
              <li>{rule}</li>
            {/each}
          </ul>
        </div>
      {/if}

      {#if data.attributionHints.length > 0}
        <div class="kv">
          <p class="kv-label tag">
            <TermLabel term="attribution_hint" label="Voices" />
          </p>
          <ul class="rules voices">
            {#each data.attributionHints as hint, i (i)}
              <li>{hint}</li>
            {/each}
          </ul>
        </div>
      {/if}

      {#if data.nicknames.length > 0}
        <div class="kv">
          <p class="kv-label tag">
            <TermLabel term="nickname" label="Nicknames" />
          </p>
          <p class="kv-value nicknames">
            {#each data.nicknames as name, i (i)}
              {#if i > 0} · {/if}"{name}"
            {/each}
          </p>
        </div>
      {/if}

      {#if !hasIdentityContent}
        <p class="kv-value quiet">No identity content yet. Run a day to populate.</p>
      {/if}
    </div>
  {/if}
</section>

<style>
  .strip {
    background: var(--surface);
    border: var(--border-faint);
    border-radius: var(--radius-md);
    overflow: hidden;
  }

  .head {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 4px;
    padding: var(--sp-sm) var(--sp-md);
    width: 100%;
    text-align: left;
    background: transparent;
    border: none;
    color: inherit;
    cursor: pointer;
  }

  .head:hover,
  .head:focus-visible {
    background: color-mix(in srgb, var(--accent) 6%, transparent);
  }

  .lede {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: var(--sp-sm);
  }

  .heading {
    font-size: 16px;
    letter-spacing: 0.06em;
    color: var(--accent);
  }

  .age {
    color: var(--text-faint);
    font-variant-numeric: tabular-nums;
  }

  .hints {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: var(--sp-xs);
  }

  .hint {
    color: var(--text-dim);
    font-style: italic;
    font-size: 13px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .hint.quiet {
    color: var(--text-faint);
  }

  .hint.nickname {
    color: var(--accent-soft);
    font-style: italic;
  }

  .chev {
    color: var(--text-faint);
    flex-shrink: 0;
  }

  .expand {
    padding: var(--sp-sm) var(--sp-md);
    border-top: var(--border-faint);
    display: flex;
    flex-direction: column;
    gap: var(--sp-sm);
  }

  .kv {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .kv-label {
    color: var(--accent);
  }

  .kv-value {
    color: var(--text-dim);
    font-size: 14px;
  }

  .kv-value.quiet {
    color: var(--text-faint);
    font-style: italic;
  }

  .rules {
    color: var(--text-dim);
    font-size: 14px;
    padding-left: var(--sp-md);
    margin-top: 2px;
  }

  .rules li {
    list-style: disc;
  }

  .rules.voices li {
    list-style: circle;
    font-style: italic;
  }

  .nicknames {
    font-style: italic;
    color: var(--accent-soft);
  }
</style>
