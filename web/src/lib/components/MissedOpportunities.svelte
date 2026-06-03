<!--
  Phase 97 — MissedOpportunities

  Renders the daily report's "What you could have done" block. Each row
  is a hypothetical-mood teaching moment computed by the projection in
  `src/reports/missedOpportunityProjection.ts`. Pure presentation: it
  doesn't compute anything; the parent owns the dismissal callback.

  Renders nothing when the input list is empty. Each row exposes:
    - a small marker glyph (↺)
    - the primary readable
    - the optional secondary rationale
    - a dismiss button (✕) with its own tap target
-->
<script lang="ts">
  import TermLabel from './TermLabel.svelte'
  import EntityLink from './links/EntityLink.svelte'
  import { entityKindFromRefKind } from './links/types'
  import type { MissedOpportunityLine } from '../../../../src/reports/types'

  let {
    opportunities,
    ondismiss,
  }: {
    opportunities: MissedOpportunityLine[]
    ondismiss: (id: string) => void
  } = $props()
</script>

{#if opportunities.length > 0}
  <section class="block missed" aria-label="Missed opportunities">
    <h2 class="block-label section-label">
      <TermLabel term="missed_opportunity" label="What you could have done" />
    </h2>
    <ul class="missed-list">
      {#each opportunities as o (o.id)}
        <li class="missed-row" role="group" aria-label="Missed opportunity">
          <span class="missed-mark" aria-hidden="true">↺</span>
          <div class="missed-body">
            <span class="missed-line">{o.readable}</span>
            {#if o.secondary}
              <span class="missed-sub chip">{o.secondary}</span>
            {/if}
            <!-- Phase 195 / ISSUE-162 — jump to the entity the miss was
                 about. Only when the projection carries a structured ref
                 with a linkable detail surface; prose is never parsed. -->
            {#if o.targetRef && o.targetLabel}
              {@const kind = entityKindFromRefKind(o.targetRef.kind)}
              {#if kind}
                <span class="missed-jump">
                  <EntityLink
                    {kind}
                    id={o.targetRef.id}
                    label={`→ ${o.targetLabel}`}
                  />
                </span>
              {/if}
            {/if}
          </div>
          <button
            class="dismiss"
            type="button"
            aria-label="Dismiss missed opportunity"
            onclick={() => ondismiss(o.id)}
          >
            ✕
          </button>
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
  }

  .block-label {
    color: var(--accent);
    margin-bottom: 2px;
  }

  .missed {
    background: color-mix(in srgb, var(--surface) 60%, transparent);
    border-radius: var(--radius-md);
    padding: var(--sp-sm);
  }

  .missed-list {
    display: flex;
    flex-direction: column;
    gap: var(--sp-xs);
  }

  .missed-row {
    display: grid;
    grid-template-columns: 20px 1fr 36px;
    gap: var(--sp-xs);
    align-items: start;
    min-height: 48px;
    padding: 4px 0;
  }

  .missed-mark {
    font-family: var(--font-mono);
    color: var(--accent-soft);
    text-align: center;
    line-height: 1.5;
    font-size: 14px;
  }

  .missed-body {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .missed-line {
    color: var(--text-dim);
    font-size: 15px;
    line-height: 1.4;
  }

  .missed-sub {
    color: var(--text-faint);
    font-size: 13px;
    line-height: 1.4;
  }

  /* Phase 195 — entity jump affordance. */
  .missed-jump {
    margin-top: 2px;
    font-size: 13px;
  }

  .dismiss {
    background: transparent;
    border: none;
    color: var(--text-faint);
    cursor: pointer;
    font-family: var(--font-mono);
    font-size: 16px;
    padding: 0;
    align-self: start;
    min-width: 36px;
    min-height: 36px;
    border-radius: var(--radius-sm);
    transition: color var(--m-fast) var(--ease), background var(--m-fast) var(--ease);
  }

  .dismiss:hover,
  .dismiss:focus-visible {
    color: var(--text);
    background: color-mix(in srgb, var(--accent) 8%, transparent);
  }
</style>
