<!--
  NpcDetailSheet — detail sheet for a single notable NPC. Phase 93.

  NPCs both hold attributions (they have opinions about staff,
  factions, etc.) and have attributions held about them (the tavern's
  inspector is feared by half the regulars). Both halves render.
-->
<script lang="ts">
  import BottomSheet from '../BottomSheet.svelte'
  import TermLabel from '../TermLabel.svelte'
  import AttributionList from './AttributionList.svelte'
  import type { NpcRow } from '../../../../../src/reports/worldOverviewProjection'

  let {
    npc,
    open,
    onclose,
  }: { npc: NpcRow | null; open: boolean; onclose: () => void } = $props()
</script>

<BottomSheet {open} title={npc?.name ?? 'Notable NPC'} {onclose}>
  {#snippet children()}
    {#if npc}
      <p class="lede">
        <TermLabel term="notable_npc" label={npc.kind.replace(/_/g, ' ')} />
        {#if npc.factionLabel}
          · <span>{npc.factionLabel}</span>
        {/if}
        {#if npc.cultureLabel}
          · <span>{npc.cultureLabel}</span>
        {/if}
        {#if npc.customerGroupLabel}
          · <span>{npc.customerGroupLabel}</span>
        {/if}
      </p>

      <section class="block">
        <p class="block-label tag">Appearances</p>
        <dl class="kv">
          <div>
            <dt>first seen</dt>
            <dd class="mono">day {npc.firstSeenDay}</dd>
          </div>
          {#if npc.lastSeenDay !== undefined}
            <div>
              <dt>last seen</dt>
              <dd class="mono">
                day {npc.lastSeenDay}
                {#if npc.daysSinceLastSeen !== undefined}
                  · {npc.daysSinceLastSeen}d ago
                {/if}
              </dd>
            </div>
          {/if}
        </dl>
      </section>

      <AttributionList
        title="What they believe"
        rows={npc.attributionsHeld}
        perspective="held"
      />
      <AttributionList
        title="What others believe about them"
        rows={npc.attributionsAgainst}
        perspective="against"
      />

      {#if npc.activeFlags.length > 0}
        <section class="block">
          <p class="block-label tag">Active flags</p>
          <p class="tags">{npc.activeFlags.join(' · ')}</p>
        </section>
      {/if}

      {#if npc.tags.length > 0}
        <p class="quiet tag">{npc.tags.join(' · ')}</p>
      {/if}
    {/if}
  {/snippet}
</BottomSheet>

<style>
  .lede {
    color: var(--text-dim);
    margin-bottom: var(--sp-md);
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
    font-variant-numeric: tabular-nums;
  }

  .tags {
    color: var(--text-dim);
  }

  .quiet {
    color: var(--text-faint);
    margin-top: var(--sp-md);
  }
</style>
