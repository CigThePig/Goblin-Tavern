<!--
  ProjectsPanel — the Tavern > Projects tab. Hosts active projects,
  available project starters, policies, and recent social moves.

  Project rows use inline <details> for per-row deeper info instead of
  bottom sheets (the data is small enough). Policies toggle inline.
  Available project starters queue via the standard pick path.
-->
<script lang="ts">
  import TermLabel from '../TermLabel.svelte'
  import MeterBar from './MeterBar.svelte'
  import { gameStore } from '../../sim/gameStore.svelte'
  import { actionRegistry } from '../../../../../src/sim/registries/actionRegistry'
  import { categoryLabel } from '../../sim/actionBuilder'
  import { idLabel } from '../../../../../src/reports/labels/idLabel'
  import type {
    AvailableProjectRow,
    PolicyRow,
    ProjectPanelData,
    ProjectRow,
    SocialActionRow,
    ApplicableActionRef,
  } from '../../../../../src/reports/tavernOverviewProjection'

  let { data }: { data: ProjectPanelData } = $props()

  function isQueued(actionId: string, targetId?: string): boolean {
    return gameStore.isQueued(actionId, targetId)
  }

  let liveReason = $state<string | undefined>(undefined)

  function tryQueue(pick: Parameters<typeof gameStore.tryAddPick>[0]): boolean {
    const result = gameStore.tryAddPick(pick)
    liveReason = result.ok ? undefined : result.reason
    return result.ok
  }

  function queueAction(ref: ApplicableActionRef, targetId?: string, targetLabel?: string) {
    if (isQueued(ref.actionId, targetId)) {
      gameStore.removePicksFor(ref.actionId, targetId)
      liveReason = undefined
      return
    }
    if (ref.disabledReason !== undefined) return
    const def = actionRegistry.get(ref.actionId)
    tryQueue({
      actionId: ref.actionId,
      label: ref.label,
      category: ref.category,
      targetType: def?.targetType,
      ...(targetId !== undefined ? { targetId } : {}),
      ...(targetLabel !== undefined ? { targetLabel } : {}),
      actionPointCost: ref.actionPointCost,
    })
  }

  function queueAvailableProject(row: AvailableProjectRow) {
    if (row.disabledReason !== undefined) return
    if (row.validTargets.length === 0) {
      tryQueue({
        actionId: row.actionId,
        label: row.label,
        category: 'project',
        targetType: row.targetType as never,
        actionPointCost: 1,
      })
      return
    }
    const target = row.validTargets[0]!
    tryQueue({
      actionId: row.actionId,
      label: row.label,
      category: 'project',
      targetType: row.targetType as never,
      targetId: target.id,
      targetLabel: target.label,
      actionPointCost: 1,
    })
  }

  function togglePolicy(row: PolicyRow) {
    if (!row.toggleActionId) return
    if (isQueued(row.toggleActionId)) {
      gameStore.removePicksFor(row.toggleActionId)
      liveReason = undefined
      return
    }
    if (row.toggleDisabledReason !== undefined) return
    const def = actionRegistry.get(row.toggleActionId)
    tryQueue({
      actionId: row.toggleActionId,
      label: row.toggleActionLabel ?? row.toggleActionId,
      category: 'policy',
      targetType: def?.targetType ?? 'global',
      actionPointCost: def?.actionPointCost ?? 1,
    })
  }
</script>

<section class="panel" aria-label="Projects">
  <!-- ── Active projects ────────────────────────────────────────── -->
  <section class="block">
    <h2 class="block-label tag">
      <TermLabel term="project" label="Active projects" /> ({data.active.length})
    </h2>
    {#if data.active.length === 0}
      <p class="quiet">No projects in flight. Start one below.</p>
    {:else}
      <ul class="rows">
        {#each data.active as project (project.id)}
          <li class="project">
            <header class="head">
              <span class="label">{project.label}</span>
              <span class="status tag status-{project.status}">
                {idLabel('projectStatus', project.status)}
              </span>
            </header>
            <p class="meta tag">
              {#if project.targetLabel}
                in {project.targetLabel} ·
              {/if}
              started day {project.startedAtDay}
              {#if project.daysElapsed > 0}
                · {project.daysElapsed}d ago
              {/if}
              · {project.coinInvested}c invested
            </p>
            <MeterBar
              label="day {project.progress} of {project.requiredProgress}"
              value={project.progress}
              max={project.requiredProgress}
              mode="wellness"
            />
            {#if project.effectsPreview.length > 0}
              <details class="effects">
                <summary class="tag">Effects on completion</summary>
                <ul>
                  {#each project.effectsPreview as effect (effect)}
                    <li class="effect">· {effect}</li>
                  {/each}
                </ul>
              </details>
            {/if}
            {#if project.applicableActions.length > 0}
              <div class="actions">
                {#each project.applicableActions as ref (ref.actionId)}
                  {@const queued = isQueued(ref.actionId, project.id)}
                  <button
                    type="button"
                    class="action-pill"
                    class:queued
                    disabled={!queued && ref.disabledReason !== undefined}
                    onclick={() => queueAction(ref, project.id, project.label)}
                  >
                    {ref.label}
                    {#if ref.actionPointCost > 0}
                      <span class="cost mono">{ref.actionPointCost}p</span>
                    {/if}
                    {#if queued}
                      <span class="q">·queued</span>
                    {:else if ref.disabledReason}
                      <span class="r">·{ref.disabledReason}</span>
                    {/if}
                  </button>
                {/each}
              </div>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  <!-- ── Available project starters ──────────────────────────────── -->
  {#if data.available.length > 0}
    <section class="block">
      <h2 class="block-label tag">Start a project</h2>
      <ul class="rows">
        {#each data.available as avail (avail.actionId)}
          {@const queued = isQueued(avail.actionId, avail.validTargets[0]?.id)}
          <li class="available">
            <header class="head">
              <span class="label">{avail.label}</span>
              <span class="cost mono">{avail.initialCostCoin ?? 0}c</span>
            </header>
            {#if avail.validTargets[0]?.hint}
              <p class="meta tag">{avail.validTargets[0].hint}</p>
            {/if}
            {#if avail.requiredProgress}
              <p class="meta tag">{avail.requiredProgress} progress to complete</p>
            {/if}
            <button
              type="button"
              class="action-pill"
              class:queued
              disabled={!queued && avail.disabledReason !== undefined}
              onclick={() => {
                if (queued) {
                  gameStore.removePicksFor(avail.actionId, avail.validTargets[0]?.id)
                } else {
                  queueAvailableProject(avail)
                }
              }}
            >
              {queued ? 'queued · tap to remove' : 'queue start'}
              {#if avail.disabledReason && !queued}
                <span class="r">·{avail.disabledReason}</span>
              {/if}
            </button>
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  <!-- ── Policies ────────────────────────────────────────────────── -->
  <section class="block">
    <h2 class="block-label tag">
      <TermLabel term="policy" label="Policies" />
    </h2>
    <ul class="rows">
      {#each data.policies as policy (policy.id)}
        {@const queued = policy.toggleActionId
          ? isQueued(policy.toggleActionId)
          : false}
        <li class="policy" class:on={policy.enabled}>
          <header class="head">
            <span class="label">{policy.label}</span>
            <span class="status tag" class:on={policy.enabled}>
              {policy.enabled ? 'On' : 'Off'}
            </span>
          </header>
          {#if policy.enabled && policy.daysActive > 0}
            <p class="meta tag">active for {policy.daysActive}d</p>
          {/if}
          {#if policy.effects.length > 0}
            <ul class="policy-effects">
              {#each policy.effects as effect (effect)}
                <li>· {effect}</li>
              {/each}
            </ul>
          {/if}
          {#if policy.toggleActionId}
            <button
              type="button"
              class="action-pill"
              class:queued
              disabled={!queued && policy.toggleDisabledReason !== undefined}
              onclick={() => togglePolicy(policy)}
            >
              {#if queued}
                queued · tap to cancel
              {:else}
                {policy.enabled ? 'Turn off' : 'Turn on'}
              {/if}
              {#if policy.toggleDisabledReason && !queued}
                <span class="r">·{policy.toggleDisabledReason}</span>
              {/if}
            </button>
          {/if}
        </li>
      {/each}
    </ul>
  </section>

  <!-- ── Recent social moves ─────────────────────────────────────── -->
  {#if data.recentSocial.length > 0}
    <section class="block">
      <h2 class="block-label tag">
        <TermLabel term="social_action" label="Recent social moves" />
      </h2>
      <ul class="social-rows">
        {#each data.recentSocial as social (social.id)}
          <li class="social outcome-{social.outcome}">
            <header class="s-head">
              <span class="s-label">{social.actionLabel}</span>
              <span class="s-outcome tag">{idLabel('socialOutcome', social.outcome)}</span>
            </header>
            <p class="s-meta tag">
              {social.targetLabel}
              · day {social.day}
              {#if social.daysAgo > 0}
                · {social.daysAgo}d ago
              {/if}
            </p>
            {#if social.notes.length > 0}
              <p class="s-notes">{social.notes.join(' · ')}</p>
            {/if}
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  {#if liveReason}
    <p class="live-reason">Couldn't queue: {liveReason}</p>
  {/if}
</section>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    gap: var(--sp-lg);
  }

  .block {
    display: flex;
    flex-direction: column;
    gap: var(--sp-sm);
  }

  .block-label {
    color: var(--accent);
  }

  .quiet {
    color: var(--text-faint);
    font-style: italic;
    padding: var(--sp-md);
    background: var(--surface);
    border-radius: var(--radius-md);
    border: var(--border-faint);
    text-align: center;
  }

  .rows,
  .social-rows {
    display: flex;
    flex-direction: column;
    gap: var(--sp-sm);
  }

  .project,
  .available,
  .policy {
    padding: var(--sp-sm) var(--sp-md);
    background: var(--surface);
    border: var(--border-faint);
    border-radius: var(--radius-md);
    display: flex;
    flex-direction: column;
    gap: var(--sp-xs);
  }

  .head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--sp-xs);
  }

  .label {
    color: var(--text);
    font-size: 16px;
  }

  .status {
    color: var(--text-faint);
    text-transform: capitalize;
  }

  .status-active {
    color: var(--accent);
  }

  .status-blocked {
    color: var(--loss);
  }

  .status.on {
    color: var(--accent);
  }

  .meta {
    color: var(--text-faint);
  }

  .effects {
    margin-top: 4px;
  }

  .effects > summary {
    cursor: pointer;
    color: var(--text-faint);
    list-style: none;
    padding: 4px 0;
  }

  .effects > summary::-webkit-details-marker {
    display: none;
  }

  .effects > ul {
    margin-top: 4px;
    color: var(--text-dim);
    font-size: 13px;
  }

  .effect {
    line-height: 1.5;
  }

  .policy-effects {
    color: var(--text-dim);
    font-size: 13px;
    line-height: 1.5;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-xs);
    margin-top: var(--sp-xs);
  }

  .action-pill {
    display: inline-flex;
    align-items: baseline;
    gap: 6px;
    padding: 6px 12px;
    font-family: var(--font-body);
    font-variant: small-caps;
    letter-spacing: 0.06em;
    font-size: 12px;
    color: var(--text-dim);
    border-radius: 999px;
    border: 1px solid color-mix(in srgb, var(--candle-soft) 40%, transparent);
    background: var(--surface-raised);
    min-height: 32px;
    transition: color var(--m-fast) var(--ease),
      border-color var(--m-fast) var(--ease),
      background var(--m-fast) var(--ease);
  }

  .action-pill:not(:disabled):hover,
  .action-pill:not(:disabled):focus-visible {
    color: var(--text);
    border-color: var(--accent);
  }

  .action-pill.queued {
    color: var(--accent);
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 14%, transparent);
  }

  .action-pill:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .cost {
    color: var(--accent-soft);
  }

  .q {
    color: var(--accent);
  }

  .r {
    color: var(--loss);
    font-style: italic;
  }

  .cost {
    color: var(--accent-soft);
    font-size: 13px;
  }

  /* Social */
  .social {
    padding: var(--sp-xs) var(--sp-sm);
    background: var(--surface-raised);
    border-radius: var(--radius-sm);
    border-left: 2px solid var(--accent-soft);
  }

  .outcome-improved {
    border-left-color: var(--gain);
  }

  .outcome-worsened {
    border-left-color: var(--loss);
  }

  .outcome-neutral {
    border-left-color: var(--text-faint);
  }

  .s-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--sp-xs);
  }

  .s-label {
    color: var(--text);
  }

  .s-outcome {
    color: var(--text-faint);
  }

  .s-meta {
    color: var(--text-faint);
  }

  .s-notes {
    color: var(--text-dim);
    font-size: 13px;
    margin-top: 2px;
  }

  .live-reason {
    color: var(--loss);
    font-size: 12px;
    line-height: 1.4;
  }
</style>
