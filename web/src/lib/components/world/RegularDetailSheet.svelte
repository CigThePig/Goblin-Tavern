<!--
  RegularDetailSheet — detail sheet for a single regular.

  Phase 93. Shows full identity, meters, favorite stock with current
  quantity, recent memories, two attribution blocks (what they
  believe / what others believe about them), and applicable owner
  actions queued through the shared action queue.
-->
<script lang="ts">
  import BottomSheet from '../BottomSheet.svelte'
  import MeterBar from '../tavern/MeterBar.svelte'
  import QuickActions from '../tavern/QuickActions.svelte'
  import TermLabel from '../TermLabel.svelte'
  import AttributionList from './AttributionList.svelte'
  import RecentMemoryList from './RecentMemoryList.svelte'
  import type { RegularRow } from '../../../../../src/reports/worldOverviewProjection'

  let {
    regular,
    open,
    onclose,
  }: { regular: RegularRow | null; open: boolean; onclose: () => void } = $props()
</script>

<BottomSheet {open} title={regular?.name ?? 'Regular'} {onclose}>
  {#snippet children()}
    {#if regular}
      <p class="lede">
        <span class="group">{regular.customerGroupLabel}</span>
        {#if regular.cultureLabel}
          · <span class="culture">{regular.cultureLabel}</span>
        {/if}
        {#if regular.factionLabel}
          · <span class="faction">{regular.factionLabel}</span>
        {/if}
      </p>

      <section class="block">
        <p class="block-label tag">Meters</p>
        <div class="meters">
          <MeterBar label="loyalty" value={regular.loyalty} mode="wellness" />
          <MeterBar
            label="irritation"
            value={regular.irritation}
            mode="pressure"
          />
        </div>
        <p class="terms tag">
          <TermLabel term="loyalty" /> · <TermLabel term="irritation" />
        </p>
      </section>

      <section class="block">
        <p class="block-label tag">History</p>
        <dl class="kv">
          <div>
            <dt>visits</dt>
            <dd class="mono">{regular.visits}</dd>
          </div>
          <div>
            <dt>first seen</dt>
            <dd class="mono">day {regular.firstSeenDay}</dd>
          </div>
          <div>
            <dt>last seen</dt>
            <dd class="mono">
              {regular.daysSinceLastSeen === 0
                ? 'today'
                : `${regular.daysSinceLastSeen}d ago`}
            </dd>
          </div>
        </dl>
      </section>

      {#if regular.favoriteStockLabel}
        <section class="block">
          <p class="block-label tag">Favourite</p>
          <p class="favourite">
            {regular.favoriteStockLabel}
            {#if regular.favoriteStockOnHand !== undefined}
              <span class="onhand tag">— {regular.favoriteStockOnHand} on hand</span>
            {/if}
          </p>
        </section>
      {/if}

      <RecentMemoryList rows={regular.recentMemories} title="Recent memories" />

      <AttributionList
        title="What they believe"
        rows={regular.attributionsHeld}
        perspective="held"
      />
      <AttributionList
        title="What others believe about them"
        rows={regular.attributionsAgainst}
        perspective="against"
      />

      {#if regular.activeFlags.length > 0}
        <section class="block">
          <p class="block-label tag">Active flags</p>
          <p class="tags">{regular.activeFlags.join(' · ')}</p>
        </section>
      {/if}

      <QuickActions
        actions={regular.applicableActions}
        targetId={regular.id}
        targetLabel={regular.name}
      />
    {/if}
  {/snippet}
</BottomSheet>

<style>
  .lede {
    color: var(--text-dim);
    margin-bottom: var(--sp-md);
  }

  .group,
  .culture,
  .faction {
    color: var(--text);
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

  .favourite {
    color: var(--text);
  }

  .onhand {
    color: var(--text-faint);
    margin-left: 4px;
  }

  .tags {
    color: var(--text-dim);
  }
</style>
