<!--
  FactionDetailSheet — detail sheet for a single faction. Phase 93.
-->
<script lang="ts">
  import BottomSheet from '../BottomSheet.svelte'
  import MeterBar from '../tavern/MeterBar.svelte'
  import QuickActions from '../tavern/QuickActions.svelte'
  import TermLabel from '../TermLabel.svelte'
  import AttributionList from './AttributionList.svelte'
  import type { FactionRow } from '../../../../../src/reports/worldOverviewProjection'

  let {
    faction,
    open,
    onclose,
  }: { faction: FactionRow | null; open: boolean; onclose: () => void } = $props()
</script>

<BottomSheet {open} title={faction?.label ?? 'Faction'} {onclose}>
  {#snippet children()}
    {#if faction}
      <p class="lede">
        <span class="adj">{faction.relationNoun}</span>
        {#if faction.cultureLabel}
          · <span class="culture">{faction.cultureLabel}</span>
        {/if}
      </p>

      <section class="block">
        <p class="block-label tag">Meters</p>
        <div class="meters">
          <MeterBar
            label="relationship"
            value={faction.relationship}
            mode="wellness"
          />
          <MeterBar label="trust" value={faction.trust} mode="wellness" />
          <MeterBar
            label="influence"
            value={faction.influence}
            mode="pressure"
          />
          <MeterBar label="fear" value={faction.fear} mode="pressure" />
        </div>
        <p class="terms tag">
          <TermLabel term="relationship" /> · <TermLabel term="influence" /> ·
          <TermLabel term="trust_fear" label="Trust & Fear" />
        </p>
      </section>

      <AttributionList
        title="What others believe about them"
        rows={faction.attributionsAgainst}
        perspective="against"
      />

      {#if faction.activeFlags.length > 0}
        <section class="block">
          <p class="block-label tag">Active flags</p>
          <p class="tags">{faction.activeFlags.join(' · ')}</p>
        </section>
      {/if}

      <QuickActions
        actions={faction.applicableActions}
        targetId={faction.id}
        targetLabel={faction.label}
      />
    {/if}
  {/snippet}
</BottomSheet>

<style>
  .lede {
    color: var(--text-dim);
    margin-bottom: var(--sp-md);
    font-style: italic;
  }

  .adj {
    color: var(--accent);
    text-transform: capitalize;
  }

  .culture {
    color: var(--text);
    font-style: normal;
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

  .meters {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--sp-xs) var(--sp-md);
  }

  .terms {
    color: var(--text-faint);
  }

  .tags {
    color: var(--text-dim);
  }
</style>
