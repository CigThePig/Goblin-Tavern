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
        <p class="block-label section-label">Meters</p>
        <div class="meters">
          <MeterBar label="dirty" value={100 - area.cleanliness} mode="pressure" />
          <MeterBar label="mess" value={area.mess} mode="pressure" />
          <MeterBar label="damage" value={area.damage} mode="pressure" />
          <MeterBar label="smell" value={area.smell} mode="pressure" />
          <MeterBar label="risk" value={area.risk} mode="pressure" />
        </div>
      </section>

      <!-- Expansion Phase 2 §2.1 — the room's physical size, what its
           fittings added, and how much of it is out of use right now. -->
      {#if area.capacity.length > 0 || area.blockedPercent > 0}
        <section class="block">
          <p class="block-label section-label">
            <TermLabel term="area_capacity" label="Capacity" />
          </p>
          <ul class="capacity">
            {#each area.capacity as row (row.kind)}
              <li>
                <span class="cap-kind">{row.kind}</span>
                <span class="mono">{row.usable}/{row.total}</span>
                {#if row.fromFittings > 0}
                  <span class="chip">+{row.fromFittings} from fittings</span>
                {/if}
              </li>
            {/each}
          </ul>
          {#if area.blockedPercent > 0}
            <p class="blocked">{area.blockedPercent}% of the room is out of use</p>
          {/if}
        </section>
      {/if}

      {#if area.traits.length > 0}
        <section class="block">
          <p class="block-label section-label">
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
                  <p class="trait-tags chip">{trait.tags.join(' · ')}</p>
                {/if}
              </li>
            {/each}
          </ul>
        </section>
      {/if}

      {#if area.atmosphere.length > 0}
        <section class="block">
          <p class="block-label section-label">
            <TermLabel term="atmosphere" label="Atmosphere" />
          </p>
          <p class="atmosphere">{area.atmosphere.join(' · ')}</p>
        </section>
      {/if}

      <!-- Expansion Phase 2 §"Player-facing work" — every upgrade this room
           allows, with its quote or the specific reason it cannot start, and
           the live construction / damage / upkeep state of what is built.
           Actions are queued through the standard pick path, so the planner
           never applies anything itself. -->
      {#if area.upgrades.length > 0}
        <section class="block">
          <p class="block-label section-label">
            <TermLabel term="area_upgrade" label="Upgrades" />
          </p>
          <ul class="upgrades">
            {#each area.upgrades as upgrade (upgrade.id)}
              <li class="upgrade">
                <header class="up-head">
                  <span class="up-label">{upgrade.label}</span>
                  <span class="up-status chip">{upgrade.status.replace(/_/g, ' ')}</span>
                </header>
                {#if upgrade.description}
                  <p class="up-desc">{upgrade.description}</p>
                {/if}

                {#if (upgrade.status === 'in_progress' || upgrade.status === 'paused') && upgrade.requiredProgress}
                  <MeterBar
                    label="labour"
                    value={Math.min(upgrade.requiredProgress, upgrade.progress ?? 0)}
                    max={upgrade.requiredProgress}
                    mode="wellness"
                  />
                  {#if upgrade.stalledReason}
                    <p class="up-warn">Stalled — {upgrade.stalledReason}</p>
                  {/if}
                {/if}

                {#if upgrade.status === 'installed'}
                  <p class="up-meta chip">
                    {#if upgrade.installedAtDay !== undefined}installed day {upgrade.installedAtDay}{/if}
                    {#if upgrade.condition !== undefined} · condition {upgrade.condition}{/if}
                  </p>
                  {#if upgrade.upkeepOverdueDays !== undefined && upgrade.upkeepOverdueDays > 0}
                    <p class="up-warn">
                      Service {upgrade.upkeepOverdueDays}
                      {upgrade.upkeepOverdueDays === 1 ? 'day' : 'days'} overdue — it is wearing out
                    </p>
                  {:else if upgrade.upkeepDueDay !== undefined}
                    <p class="up-meta chip">service due day {upgrade.upkeepDueDay}</p>
                  {/if}
                {/if}

                {#if upgrade.status === 'damaged' || upgrade.status === 'disabled' || upgrade.status === 'cancelled'}
                  <p class="up-warn">
                    {upgrade.disabledReason ?? 'Out of service'}
                    {#if upgrade.condition !== undefined} (condition {upgrade.condition}){/if}
                  </p>
                {/if}

                {#if upgrade.quote}
                  <dl class="quote">
                    <div><dt>Coin</dt><dd class="mono">{upgrade.quote.coin}</dd></div>
                    <div>
                      <dt><TermLabel term="site_labour" label="Labour" /></dt>
                      <dd class="mono">
                        {upgrade.quote.labourRequired}
                        {#if upgrade.quote.expectedDays !== null}
                          · ~{upgrade.quote.expectedDays}d
                        {:else}
                          · no one on site
                        {/if}
                      </dd>
                    </div>
                    {#if upgrade.quote.materials.length > 0}
                      <div>
                        <dt>Materials</dt>
                        <dd>
                          {#each upgrade.quote.materials as line (line.stockId)}
                            <span class="mat" class:short={line.short > 0}>
                              {line.required} {line.label} ({line.held} held)
                            </span>
                          {/each}
                        </dd>
                      </div>
                    {/if}
                    {#if upgrade.quote.upkeep}
                      <div>
                        <dt>Upkeep</dt>
                        <dd>
                          {upgrade.quote.upkeep.coin} coin every
                          {upgrade.quote.upkeep.intervalDays} days
                        </dd>
                      </div>
                    {/if}
                    {#if upgrade.quote.blocksPercentWhileBuilding > 0}
                      <div>
                        <dt>While building</dt>
                        <dd>{upgrade.quote.blocksPercentWhileBuilding}% of the room closes</dd>
                      </div>
                    {/if}
                    {#if upgrade.quote.replacesLabel}
                      <div><dt>Replaces</dt><dd>{upgrade.quote.replacesLabel}</dd></div>
                    {/if}
                  </dl>
                  {#if !upgrade.quote.affordable && upgrade.quote.affordabilityReason}
                    <p class="up-warn">{upgrade.quote.affordabilityReason}</p>
                  {/if}
                {:else if upgrade.blockedReason}
                  <p class="up-reason">{upgrade.blockedReason}</p>
                {/if}
              </li>
            {/each}
          </ul>
        </section>
      {/if}

      {#if area.activeProblems.length > 0}
        <section class="block">
          <p class="block-label section-label">Active problems</p>
          <p class="problems">{area.activeProblems.join(', ')}</p>
        </section>
      {/if}

      {#if area.recentMemoryCount > 0}
        <p class="meta chip">
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

  .capacity {
    display: flex;
    flex-direction: column;
    gap: var(--sp-xs);
  }

  .capacity li {
    display: flex;
    align-items: baseline;
    gap: var(--sp-xs);
  }

  .cap-kind {
    color: var(--text-dim);
    text-transform: capitalize;
  }

  .blocked,
  .up-warn {
    color: var(--text-warn, var(--text-dim));
  }

  .up-reason {
    color: var(--text-dim);
  }

  .quote {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-top: var(--sp-xs);
  }

  .quote div {
    display: flex;
    gap: var(--sp-xs);
  }

  .quote dt {
    color: var(--text-dim);
    min-width: 7em;
  }

  .mat {
    margin-right: var(--sp-xs);
  }

  .mat.short {
    color: var(--text-warn, var(--text-dim));
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
