<!--
  RumourDetailSheet — detail sheet for a single rumour. Phase 93.
-->
<script lang="ts">
  import BottomSheet from '../BottomSheet.svelte'
  import MeterBar from '../tavern/MeterBar.svelte'
  import TermLabel from '../TermLabel.svelte'
  import AccuracyBadge from './AccuracyBadge.svelte'
  import type { RumourRow } from '../../../../../src/reports/worldOverviewProjection'

  let {
    rumour,
    open,
    onclose,
  }: { rumour: RumourRow | null; open: boolean; onclose: () => void } = $props()
</script>

<BottomSheet {open} title="Rumour" {onclose}>
  {#snippet children()}
    {#if rumour}
      <p class="readable">{rumour.label}</p>

      <section class="block">
        <p class="block-label tag">
          <TermLabel term="accuracy" label="Accuracy" />
        </p>
        <AccuracyBadge accuracy={rumour.accuracy} />
      </section>

      <section class="block">
        <p class="block-label tag">Reach</p>
        <MeterBar label="strength" value={rumour.strength} mode="pressure" />
        <p class="terms tag">
          <TermLabel term="rumour" />
        </p>
      </section>

      <section class="block">
        <p class="block-label tag">Spread</p>
        <dl class="kv">
          <div>
            <dt>first heard</dt>
            <dd class="mono">
              day {rumour.firstHeardDay} · {rumour.daysSinceFirstHeard}d ago
            </dd>
          </div>
          <div>
            <dt>last spread</dt>
            <dd class="mono">
              day {rumour.lastSpreadDay} · {rumour.daysSinceLastSpread === 0
                ? 'today'
                : `${rumour.daysSinceLastSpread}d ago`}
            </dd>
          </div>
        </dl>
      </section>

      {#if rumour.sourceLabel || rumour.targetLabel || rumour.subjectLabel}
        <section class="block">
          <p class="block-label tag">Actors</p>
          <dl class="kv">
            {#if rumour.sourceLabel}
              <div>
                <dt>started by</dt>
                <dd>{rumour.sourceLabel}</dd>
              </div>
            {/if}
            {#if rumour.targetLabel}
              <div>
                <dt>aimed at</dt>
                <dd>{rumour.targetLabel}</dd>
              </div>
            {/if}
            {#if rumour.subjectLabel}
              <div>
                <dt>subject</dt>
                <dd>{rumour.subjectLabel}</dd>
              </div>
            {/if}
          </dl>
        </section>
      {/if}

      {#if rumour.involvedLabels.length > 0}
        <section class="block">
          <p class="block-label tag">Involved</p>
          <p class="tags">{rumour.involvedLabels.join(' · ')}</p>
        </section>
      {/if}

      {#if rumour.tags.length > 0}
        <p class="quiet tag">{rumour.tags.join(' · ')}</p>
      {/if}
    {/if}
  {/snippet}
</BottomSheet>

<style>
  .readable {
    color: var(--text);
    font-size: 15px;
    line-height: 1.5;
    margin-bottom: var(--sp-sm);
  }

  .block {
    display: flex;
    flex-direction: column;
    gap: var(--sp-xs);
    margin-top: var(--sp-md);
  }

  .block-label {
    color: var(--accent);
  }

  .terms {
    color: var(--text-faint);
  }

  .kv {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .kv > div {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: var(--sp-md);
  }

  .kv dt {
    color: var(--text-faint);
    font-family: var(--font-body);
    font-variant: small-caps;
    letter-spacing: 0.06em;
    font-size: 13px;
  }

  .kv dd {
    color: var(--text);
    margin: 0;
  }

  .tags {
    color: var(--text-dim);
  }

  .quiet {
    color: var(--text-faint);
    margin-top: var(--sp-md);
  }
</style>
