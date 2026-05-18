<!--
  AreaDetailSheet — detail bottom sheet for a single area row.
-->
<script lang="ts">
  import BottomSheet from '../BottomSheet.svelte'
  import MeterBar from './MeterBar.svelte'
  import QuickActions from './QuickActions.svelte'
  import TermLabel from '../TermLabel.svelte'
  import type { AreaRow } from '../../../../../src/reports/tavernOverviewProjection'

  let {
    area,
    open,
    onclose,
  }: { area: AreaRow | null; open: boolean; onclose: () => void } = $props()
</script>

<BottomSheet {open} title={area?.label ?? 'Area'} {onclose}>
  {#snippet children()}
    {#if area}
      <p class="lede">
        <span class="adj">{area.conditionAdjective}</span> — condition <span class="mono">{area.condition}</span>
      </p>

      <section class="block">
        <p class="block-label tag">Meters</p>
        <div class="meters">
          <MeterBar label="dirty" value={100 - area.cleanliness} mode="pressure" />
          <MeterBar label="mess" value={area.mess} mode="pressure" />
          <MeterBar label="damage" value={area.damage} mode="pressure" />
          <MeterBar label="smell" value={area.smell} mode="pressure" />
          <MeterBar label="risk" value={area.risk} mode="pressure" />
        </div>
      </section>

      {#if area.traits.length > 0}
        <section class="block">
          <p class="block-label tag">
            <TermLabel term="area_trait" label="Traits" />
          </p>
          <ul class="traits">
            {#each area.traits as trait (trait.id)}
              <li>
                <p class="trait-label">{trait.label}</p>
                {#if trait.description}
                  <p class="trait-desc">{trait.description}</p>
                {/if}
                {#if trait.tags.length > 0}
                  <p class="trait-tags tag">{trait.tags.join(' · ')}</p>
                {/if}
              </li>
            {/each}
          </ul>
        </section>
      {/if}

      {#if area.atmosphere.length > 0}
        <section class="block">
          <p class="block-label tag">
            <TermLabel term="atmosphere" label="Atmosphere" />
          </p>
          <p class="atmosphere">{area.atmosphere.join(' · ')}</p>
        </section>
      {/if}

      {#if area.upgrades.length > 0}
        <section class="block">
          <p class="block-label tag">
            <TermLabel term="area_upgrade" label="Upgrades" />
          </p>
          <ul class="upgrades">
            {#each area.upgrades as upgrade (upgrade.id)}
              <li class="upgrade">
                <header class="up-head">
                  <span class="up-label">{upgrade.label}</span>
                  <span class="up-status tag">{upgrade.status.replace(/_/g, ' ')}</span>
                </header>
                {#if upgrade.description}
                  <p class="up-desc">{upgrade.description}</p>
                {/if}
                {#if upgrade.status === 'in_progress' && upgrade.buildDays}
                  <MeterBar
                    label="progress"
                    value={Math.min(upgrade.buildDays, upgrade.progress ?? 0)}
                    max={upgrade.buildDays}
                    mode="wellness"
                  />
                {/if}
                {#if upgrade.status === 'installed' && upgrade.installedAtDay !== undefined}
                  <p class="up-meta tag">installed day {upgrade.installedAtDay}</p>
                {/if}
              </li>
            {/each}
          </ul>
        </section>
      {/if}

      {#if area.activeProblems.length > 0}
        <section class="block">
          <p class="block-label tag">Active problems</p>
          <p class="problems">{area.activeProblems.join(', ')}</p>
        </section>
      {/if}

      {#if area.recentMemoryCount > 0}
        <p class="meta tag">
          {area.recentMemoryCount} recent
          {area.recentMemoryCount === 1 ? 'memory' : 'memories'} reference this area
        </p>
      {/if}

      <QuickActions
        actions={area.applicableActions}
        targetId={area.id}
        targetLabel={area.label}
      />
    {/if}
  {/snippet}
</BottomSheet>

<style>
  .lede {
    font-style: italic;
    color: var(--text-dim);
    margin-bottom: var(--sp-md);
  }

  .adj {
    color: var(--accent);
    text-transform: capitalize;
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

  .traits {
    display: flex;
    flex-direction: column;
    gap: var(--sp-sm);
  }

  .trait-label {
    color: var(--text);
    font-size: 15px;
  }

  .trait-desc {
    color: var(--text-dim);
    font-style: italic;
    font-size: 14px;
    margin-top: 2px;
  }

  .trait-tags {
    color: var(--text-faint);
    margin-top: 2px;
  }

  .atmosphere {
    color: var(--text-dim);
  }

  .upgrades {
    display: flex;
    flex-direction: column;
    gap: var(--sp-sm);
  }

  .upgrade {
    padding: var(--sp-xs) var(--sp-sm);
    background: var(--surface-raised);
    border-radius: var(--radius-sm);
    border: var(--border-faint);
  }

  .up-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--sp-xs);
  }

  .up-label {
    color: var(--text);
  }

  .up-status {
    color: var(--text-faint);
    text-transform: capitalize;
  }

  .up-desc {
    color: var(--text-dim);
    font-style: italic;
    font-size: 13px;
    margin: 4px 0;
  }

  .up-meta {
    color: var(--text-faint);
    margin-top: 4px;
  }

  .problems {
    color: var(--loss);
    font-style: italic;
  }

  .meta {
    color: var(--text-faint);
    margin-top: var(--sp-md);
  }
</style>
