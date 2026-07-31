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
        <p class="block-label section-label">Meters</p>
        <div class="meters">
          <MeterBar label="loyalty" value={regular.loyalty} mode="wellness" />
          <MeterBar
            label="irritation"
            value={regular.irritation}
            mode="pressure"
          />
          {#if regular.ownerStanding !== undefined}
            <MeterBar
              label="standing"
              value={regular.ownerStanding}
              mode="wellness"
            />
          {/if}
        </div>
        <p class="terms chip">
          <TermLabel term="loyalty" /> · <TermLabel term="irritation" />
          {#if regular.ownerStanding !== undefined}
            · <TermLabel term="owner_standing" />
          {/if}
        </p>
      </section>

      <!-- Expansion Phase 4 §4.3 — the state that decides whether they come in
           at all, and what they want when they do. Shown ahead of the meters'
           history because it is what the player can act on. -->
      {#if regular.stoppedVisiting}
        <section class="block lapsed">
          <p class="block-label section-label">
            <TermLabel term="lapsed_regular" />
          </p>
          <p class="lapsed-reason">
            Has stopped coming in since day {regular.stoppedVisiting.sinceDay} —
            {regular.stoppedVisiting.reason}.
          </p>
        </section>
      {/if}

      {#if regular.openRequest}
        <section class="block request">
          <p class="block-label section-label">
            <TermLabel term="regular_request" />
          </p>
          <p class="request-text">{regular.openRequest.readable}</p>
          <p class="chip">Expires day {regular.openRequest.expiresOnDay}</p>
        </section>
      {/if}

      {#if regular.slateOwed > 0}
        <section class="block">
          <p class="block-label section-label">
            <TermLabel term="patron_tab" />
          </p>
          <p class="favourite">{regular.slateOwed} coin on the slate</p>
        </section>
      {/if}

      <section class="block">
        <p class="block-label section-label">History</p>
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

      {#if regular.favoriteStockLabel || regular.favoriteRecipeLabel || regular.favoriteAreaLabel}
        <section class="block">
          <p class="block-label section-label">Their usual</p>
          {#if regular.favoriteRecipeLabel}
            <p class="favourite">
              {regular.favoriteRecipeLabel}
              <span class="onhand chip">
                — {regular.favoriteRecipeAvailable ? 'on the menu' : 'not available'}
              </span>
            </p>
          {/if}
          {#if regular.favoriteStockLabel}
            <p class="favourite">
              {regular.favoriteStockLabel}
              {#if regular.favoriteStockOnHand !== undefined}
                <span class="onhand chip">— {regular.favoriteStockOnHand} on hand</span>
              {/if}
            </p>
          {/if}
          {#if regular.favoriteAreaLabel}
            <p class="favourite">
              <span class="onhand chip">sits in {regular.favoriteAreaLabel}</span>
            </p>
          {/if}
        </section>
      {/if}

      {#if regular.serviceMemory.length > 0}
        <section class="block">
          <p class="block-label section-label">What they remember</p>
          <ul class="memory">
            {#each regular.serviceMemory.slice(-5).reverse() as entry (entry.onDay + entry.kind + entry.readable)}
              <li class:good={entry.weight > 0} class:bad={entry.weight < 0}>
                {entry.readable}
                <span class="chip">day {entry.onDay}</span>
              </li>
            {/each}
          </ul>
        </section>
      {/if}

      {#if regular.wordOfMouth && (regular.wordOfMouth.recommendations > 0 || regular.wordOfMouth.criticisms > 0)}
        <section class="block">
          <p class="block-label section-label">Word of mouth</p>
          <p class="chip">
            spoke well {regular.wordOfMouth.recommendations}× · spoke against
            {regular.wordOfMouth.criticisms}×
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
          <p class="block-label section-label">Active flags</p>
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

  .lapsed .lapsed-reason {
    color: var(--danger, var(--text));
  }

  .request .request-text {
    color: var(--text);
  }

  .memory {
    display: flex;
    flex-direction: column;
    gap: var(--sp-xxs, 2px);
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .memory li {
    color: var(--text-dim);
  }

  .memory li.good {
    color: var(--text);
  }

  .memory li.bad {
    color: var(--warn, var(--text-dim));
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
