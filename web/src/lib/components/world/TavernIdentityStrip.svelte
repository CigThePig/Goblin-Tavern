<!--
  TavernIdentityStrip — header strip above the World sub-nav.

  Phase 93 §2 of the plan. Surfaces non-prescriptive "identity hints"
  rather than a class label: founding day, top atmosphere tags, count
  of house rules and known-for adjectives. Collapsed to a single line
  by default; tap to expand and reveal the full lists.
-->
<script lang="ts">
  import TermLabel from '../TermLabel.svelte'
  import type { TavernIdentityData } from '../../../../../src/reports/worldOverviewProjection'

  let { data }: { data: TavernIdentityData } = $props()

  let expanded = $state(false)

  const summaryTags = $derived(data.atmosphereTags.slice(0, 3))
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
      {#if summaryTags.length > 0}
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
          <p class="kv-label tag">Atmosphere</p>
          <p class="kv-value">{data.atmosphereTags.join(' · ')}</p>
        </div>
      {/if}

      {#if data.knownFor.length > 0}
        <div class="kv">
          <p class="kv-label tag">Known for</p>
          <p class="kv-value">{data.knownFor.join(' · ')}</p>
        </div>
      {/if}

      {#if data.houseRules.length > 0}
        <div class="kv">
          <p class="kv-label tag">House rules</p>
          <ul class="rules">
            {#each data.houseRules as rule, i (i)}
              <li>{rule}</li>
            {/each}
          </ul>
        </div>
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

  .rules {
    color: var(--text-dim);
    font-size: 14px;
    padding-left: var(--sp-md);
    margin-top: 2px;
  }

  .rules li {
    list-style: disc;
  }
</style>
