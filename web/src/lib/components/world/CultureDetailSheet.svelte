<!--
  CultureDetailSheet — detail sheet for a single culture. Phase 93.
-->
<script lang="ts">
  import BottomSheet from '../BottomSheet.svelte'
  import MeterBar from '../tavern/MeterBar.svelte'
  import TermLabel from '../TermLabel.svelte'
  import type { CultureRow } from '../../../../../src/reports/worldOverviewProjection'

  let {
    culture,
    open,
    onclose,
  }: { culture: CultureRow | null; open: boolean; onclose: () => void } = $props()
</script>

<BottomSheet {open} title={culture?.label ?? 'Culture'} {onclose}>
  {#snippet children()}
    {#if culture}
      <p class="lede">naming profile: <span class="mono">{culture.namingProfileId}</span></p>

      <section class="block">
        <p class="block-label tag">Meters</p>
        <div class="meters">
          <MeterBar
            label="familiarity"
            value={culture.familiarity}
            mode="wellness"
          />
          <MeterBar label="comfort" value={culture.comfort} mode="wellness" />
          <MeterBar label="tension" value={culture.tension} mode="pressure" />
        </div>
        <p class="terms tag">
          <TermLabel
            term="familiarity_comfort_tension"
            label="Familiarity · Comfort · Tension"
          />
        </p>
      </section>

      <section class="block">
        <p class="block-label tag">Members in your world</p>
        <dl class="kv">
          <div>
            <dt>regulars</dt>
            <dd class="mono">{culture.members.regulars}</dd>
          </div>
          <div>
            <dt>suppliers</dt>
            <dd class="mono">{culture.members.suppliers}</dd>
          </div>
          <div>
            <dt>factions</dt>
            <dd class="mono">{culture.members.factions}</dd>
          </div>
          <div>
            <dt>notable NPCs</dt>
            <dd class="mono">{culture.members.npcs}</dd>
          </div>
        </dl>
      </section>

      {#if culture.preferredStockTags.length > 0}
        <section class="block">
          <p class="block-label tag">Preferred stock</p>
          <p class="tags">{culture.preferredStockTags.join(' · ')}</p>
        </section>
      {/if}

      {#if culture.dislikedTags.length > 0}
        <section class="block">
          <p class="block-label tag">Disliked tags</p>
          <p class="tags">{culture.dislikedTags.join(' · ')}</p>
        </section>
      {/if}

      {#if culture.importantCalendarTags.length > 0}
        <section class="block">
          <p class="block-label tag">Calendar markers</p>
          <p class="tags">{culture.importantCalendarTags.join(' · ')}</p>
        </section>
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

  .meters {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
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
  }

  .tags {
    color: var(--text-dim);
  }
</style>
