<!--
  AttributionList — shared block for "what they believe" and
  "what others believe about them" sections in World detail sheets.

  Phase 93. Renders an `AttributionRow[]` returned from the world
  overview projection. Each row shows the readable text, the
  attribution type as a small tag (blame / credit / suspicion /
  gratitude / resentment / trust / distrust), an accuracy badge, and a
  strength meter. Suppresses itself when the list is empty.
-->
<script lang="ts">
  import MeterBar from '../tavern/MeterBar.svelte'
  import AccuracyBadge from './AccuracyBadge.svelte'
  import type { AttributionRow } from '../../../../../src/reports/worldOverviewProjection'

  let {
    title,
    rows,
    perspective,
  }: {
    title: string
    rows: AttributionRow[]
    /**
     * 'held' renders perceiver context implicit (the entity holds this).
     * 'against' surfaces the perceiver's display label as a hint.
     */
    perspective: 'held' | 'against'
  } = $props()
</script>

{#if rows.length > 0}
  <section class="block">
    <p class="block-label tag">{title}</p>
    <ul class="list">
      {#each rows as row (row.id)}
        <li class="row">
          <p class="readable">{row.readable}</p>
          <div class="meta">
            <span class="type tag">{row.attributionType}</span>
            <AccuracyBadge accuracy={row.accuracy} />
            {#if perspective === 'against'}
              <span class="from tag">— {row.perceiverLabel}</span>
            {:else}
              <span class="to tag">— about {row.targetLabel}</span>
            {/if}
          </div>
          <MeterBar label="strength" value={row.strength} mode="pressure" />
        </li>
      {/each}
    </ul>
  </section>
{/if}

<style>
  .block {
    display: flex;
    flex-direction: column;
    gap: var(--sp-xs);
    margin-top: var(--sp-md);
  }

  .block-label {
    color: var(--accent);
  }

  .list {
    display: flex;
    flex-direction: column;
    gap: var(--sp-sm);
  }

  .row {
    padding: var(--sp-sm);
    background: var(--surface-raised);
    border-radius: var(--radius-sm);
    border: var(--border-faint);
    display: flex;
    flex-direction: column;
    gap: var(--sp-xs);
  }

  .readable {
    color: var(--text);
    font-size: 14px;
    line-height: 1.45;
  }

  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: baseline;
  }

  .type {
    color: var(--accent-soft);
    text-transform: capitalize;
  }

  .from,
  .to {
    color: var(--text-faint);
    font-style: italic;
  }
</style>
