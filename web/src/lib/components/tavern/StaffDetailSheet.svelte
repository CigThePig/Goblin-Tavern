<!--
  StaffDetailSheet — detail sheet for a single staff member.
-->
<script lang="ts">
  import BottomSheet from '../BottomSheet.svelte'
  import MeterBar from './MeterBar.svelte'
  import QuickActions from './QuickActions.svelte'
  import TermLabel from '../TermLabel.svelte'
  import { gameStore } from '../../sim/gameStore.svelte'
  import type { StaffPanelRow } from '../../../../../src/reports/tavernOverviewProjection'

  let {
    staff,
    open,
    onclose,
  }: { staff: StaffPanelRow | null; open: boolean; onclose: () => void } = $props()

  function setPriority(staffId: string, event: Event) {
    const next = (event.target as HTMLSelectElement).value
    gameStore.setStaffPriority(staffId, next || undefined)
  }
</script>

<BottomSheet {open} title={staff?.name ?? 'Staff'} {onclose}>
  {#snippet children()}
    {#if staff}
      <p class="lede">
        <span class="role">{staff.roleLabel}</span>
        {#if staff.unavailable}
          · <span class="out">unavailable</span>
        {/if}
      </p>

      <section class="block">
        <p class="block-label tag">Meters</p>
        <div class="meters">
          <MeterBar label="skill" value={staff.skill} mode="wellness" />
          <MeterBar label="morale" value={staff.morale} mode="wellness" />
          <MeterBar label="stress" value={staff.stress} mode="pressure" />
          <MeterBar label="fatigue" value={staff.fatigue} mode="pressure" />
          <MeterBar label="loyalty" value={staff.loyalty} mode="wellness" />
        </div>
        <p class="terms tag">
          <TermLabel term="morale" /> · <TermLabel term="stress" /> ·
          <TermLabel term="fatigue" /> · <TermLabel term="loyalty" />
        </p>
      </section>

      <section class="block">
        <p class="block-label tag">Wages</p>
        <p class="wage mono">
          {staff.wage}c per week
          ·
          {#if staff.paidThisWeek}
            <span class="paid">paid this week</span>
          {:else}
            <span class="unpaid">unpaid this week</span>
          {/if}
        </p>
      </section>

      <section class="block">
        <p class="block-label tag">Priority</p>
        <select
          class="prio"
          value={staff.currentPriority ?? ''}
          onchange={(e) => setPriority(staff.id, e)}
        >
          <option value="">(role default)</option>
          {#each staff.allowedPriorities as p (p.id)}
            <option value={p.id}>{p.label}</option>
          {/each}
        </select>
        <p class="hint tag">Sticky across days — engine fallback if left default.</p>
      </section>

      {#if staff.workStyle || staff.stressResponse || staff.personalityTags.length > 0}
        <section class="block">
          <p class="block-label tag">Identity</p>
          <dl class="kv">
            {#if staff.workStyle}
              <div>
                <dt>work style</dt>
                <dd>{staff.workStyle.replace(/_/g, ' ')}</dd>
              </div>
            {/if}
            {#if staff.stressResponse}
              <div>
                <dt>stress response</dt>
                <dd>{staff.stressResponse.replace(/_/g, ' ')}</dd>
              </div>
            {/if}
          </dl>
          {#if staff.personalityTags.length > 0}
            <p class="tags">{staff.personalityTags.join(' · ')}</p>
          {/if}
        </section>
      {/if}

      {#if staff.activeFlags.length > 0}
        <section class="block">
          <p class="block-label tag">Active flags</p>
          <p class="tags">{staff.activeFlags.join(' · ')}</p>
        </section>
      {/if}

      <QuickActions
        actions={staff.applicableActions}
        targetId={staff.id}
        targetLabel={staff.name}
      />
    {/if}
  {/snippet}
</BottomSheet>

<style>
  .lede {
    color: var(--text-dim);
    margin-bottom: var(--sp-md);
  }

  .role {
    text-transform: capitalize;
  }

  .out {
    color: var(--loss);
    font-style: italic;
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

  .wage {
    color: var(--text);
  }

  .paid {
    color: var(--gain);
  }

  .unpaid {
    color: var(--loss);
  }

  .prio {
    width: 100%;
    padding: 10px 12px;
    font-family: var(--font-body);
    font-size: 15px;
    color: var(--text);
    background: var(--surface-raised);
    border: 1px solid color-mix(in srgb, var(--candle-soft) 40%, transparent);
    border-radius: var(--radius-sm);
    min-height: 44px;
  }

  .prio:focus-visible {
    border-color: var(--accent);
  }

  .hint {
    color: var(--text-faint);
    font-style: italic;
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
    text-transform: capitalize;
  }

  .tags {
    color: var(--text-dim);
    margin-top: 4px;
  }
</style>
