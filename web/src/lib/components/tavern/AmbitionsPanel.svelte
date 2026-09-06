<script lang="ts">
  import { buildAmbitionsOverview, type AmbitionControl } from '../../../../../src/reports/ambitionsOverview'
  import { actionRegistry } from '../../../../../src/sim/registries/actionRegistry'
  import { gameStore, formatDuration } from '../../sim/gameStore.svelte'
  const data = $derived(buildAmbitionsOverview(gameStore.state))
  let selected = $state<Record<string, string>>({})
  let message = $state('')
  let confirmAbandon = $state<string | undefined>(undefined)
  let showLater = $state(false)
  const liveRows = $derived(data.rows.filter(r => !['locked','dead','abandoned','parked'].includes(r.status)))
  const laterRows = $derived(data.rows.filter(r => ['locked','dead','abandoned','parked'].includes(r.status)))
  function queue(control: AmbitionControl) {
    if (gameStore.isQueued(control.actionId, control.targetId)) {
      gameStore.removePicksFor(control.actionId, control.targetId)
      message = 'Removed from the plan.'; return
    }
    if (control.actionId === 'abandon_venture' && confirmAbandon !== control.targetId) { confirmAbandon = control.targetId; return }
    const ventureId = control.targetId.split(':')[0]!
    const alternative = gameStore.picks.find(p => p.actionId === control.actionId && p.targetId?.split(':')[0] === ventureId)
    if (alternative) {
      if (control.actionId === 'start_venture') selected[ventureId] = alternative.targetId!
      message = 'Another choice for this ambition is already planned. Remove it before choosing a different one.'
      return
    }
    const def = actionRegistry.get(control.actionId)
    const result = gameStore.tryAddPick({ actionId: def.id, label: def.label, category: def.category, targetType: def.targetType, targetId: control.targetId, targetLabel: control.label, timeCost: control.minutes })
    message = result.ok ? `Queued for ${gameStore.planningHorizon === 'today' ? 'today’s' : 'tomorrow’s'} service.` : result.reason
    confirmAbandon = undefined
  }
</script>

<section class="ambitions" aria-label="Tavern ambitions">
  <header class="intro">
    <p class="eyebrow">Beyond tonight</p>
    <h2>What is this place becoming?</h2>
    <p>Choose what deserves your time. Each ambition draws on the people, work and resources of the house.</p>
    <div class="counts"><span><strong>{data.activeCount}</strong> underway</span><span><strong>{data.availableCount}</strong> openings</span><span>Planning for <strong>{gameStore.planningHorizon}</strong></span></div>
  </header>
  {#if message}<p class="notice" role="status">{message}</p>{/if}
  <div class="venture-list">
    {#each liveRows as row (row.id)}
      <article class="venture" class:established={row.status === 'completed'} aria-label={row.label}>
        <div class="row-head"><span class="status">{row.statusLabel}</span>{#if row.partner}<span class="partner">{row.partner}</span>{/if}</div>
        <h3>{row.label}</h3>
        <p>{row.summary}</p>
        {#if row.status === 'active' || row.status === 'paused'}
          <ol class="stages" aria-label="Milestones">
            {#each row.stages as stage}<li class:current={stage.current} class:complete={stage.complete}>{#if stage.complete}<span aria-label="Complete">✓ </span>{/if}{stage.label}</li>{/each}
          </ol>
          <div class="progress-label"><strong>{row.stageLabel}</strong><span>{row.progress} / {row.required} work sessions</span></div>
          <progress value={row.progress} max={row.required || 1} aria-label={`${row.stageLabel} progress`}></progress>
        {/if}
        {#if row.status !== 'completed'}<p class="detail">{row.description}</p>{/if}
        <div class="benefit"><span>{row.status === 'completed' ? 'What it changed' : 'What it can change'}</span><p>{row.benefit}</p>{#if row.outcome}<p>{row.outcome}</p>{/if}</div>
        {#if row.blockers.length}<ul class="blockers" aria-label="Requirements">{#each row.blockers as blocker}<li>{blocker}</li>{/each}</ul>{/if}
        {#if row.starts.length}
          {@const targetId = selected[row.id] ?? row.starts[0]!.id}
          <div class="start-row">
            {#if row.starts.length > 1}<label>Choose the partner<select aria-label={`Partner for ${row.label}`} value={selected[row.id] ?? row.starts[0]!.id} onchange={e => selected[row.id] = e.currentTarget.value}>{#each row.starts as option}<option value={option.id}>{option.label.split(' · ').slice(1).join(' · ')}</option>{/each}</select></label>{/if}
            <button type="button" class="commit" class:queued={gameStore.isQueued('start_venture', targetId)} onclick={() => queue({ actionId: 'start_venture', targetId, label: row.label, minutes: 30, coin: 0 })}>{gameStore.isQueued('start_venture', targetId) ? 'Queued · remove' : 'Take it up · 30 min'}</button>
          </div>
        {/if}
        <div class="controls">
          {#each row.controls as control (`${control.actionId}:${control.targetId}`)}
            {@const queued = gameStore.isQueued(control.actionId, control.targetId)}
            {#if control.actionId !== 'abandon_venture'}
              <button type="button" class:commit={control.actionId === 'work_on_venture'} class:queued disabled={!queued && !!control.blocked} onclick={() => queue(control)}>
                <span>{queued ? 'Queued · remove' : control.label}</span>
                {#if control.minutes || control.coin}<small>{formatDuration(control.minutes)}{#if control.coin} · {control.coin} coin{/if}{#if control.material} · {control.material}{/if}</small>{/if}
                {#if control.blocked && !queued}<small>{control.blocked}</small>{/if}
              </button>
            {:else}
              <details class="abandon"><summary>End this ambition</summary><p>Abandonment is permanent. Paid work is not refunded. You can set it aside instead.</p><button type="button" class="danger" onclick={() => queue(control)}>{queued ? 'Remove abandonment from plan' : confirmAbandon === row.id ? 'Confirm abandonment' : 'Abandon this ambition'}</button>{#if confirmAbandon === row.id}<button type="button" onclick={() => confirmAbandon = undefined}>Keep it</button>{/if}</details>
            {/if}
          {/each}
        </div>
      </article>
    {/each}
  </div>
  {#if laterRows.length}<button type="button" class="later-toggle" aria-expanded={showLater} onclick={() => showLater = !showLater}>{showLater ? 'Hide' : 'Show'} other paths · {laterRows.length}</button>{#if showLater}<ul class="later-list">{#each laterRows as row}<li><h3>{row.label}</h3><span class="status">{row.statusLabel}</span><p>{row.description}</p></li>{/each}</ul>{/if}{/if}
  <section class="identity" aria-label="Earned identity">
    <p class="eyebrow">Word around the quarter</p><h2>A reputation takes repetition.</h2>
    {#if data.nicknames.length}<ul class="nicknames">{#each data.nicknames as name}<li><strong>“{name.label}”</strong><span>Heard from {name.source}</span></li>{/each}</ul>{:else}<p>A nickname needs at least {data.nicknameDays} days of public evidence and 25 witnessed visits. It comes from the crowd.</p>{/if}
    {#if data.evidence.length}<ul class="evidence">{#each data.evidence as evidence}<li><strong>{evidence.label}</strong><span>{evidence.publicDays} days of public evidence · {evidence.witnesses} witnessed visits</span></li>{/each}</ul>{:else}<p>The house is still making its first impression.</p>{/if}
  </section>
  <section class="people" aria-label="Staff development">
    <p class="eyebrow">People make the house</p><h2>Paths of their own</h2>
    <p>Working shifts, training, morale and relationships shape staff development. Rest days preserve progress.</p>
    {#if data.arcs.length}<ul>{#each data.arcs as arc (arc.id)}<li><div><h3>{arc.label}</h3><span class="status">{arc.status === 'failed' ? 'Ended' : arc.stageLabel}</span></div>{#if arc.reason}<p>{arc.reason}</p>{/if}</li>{/each}</ul>{:else}<p>No staff path has begun yet.</p>{/if}
    <button type="button" onclick={() => gameStore.setTavernSubview('staff')}>Manage the workforce</button>
  </section>
</section>

<style>
  .ambitions { display: grid; gap: 1.5rem; font-size: 1rem; line-height: 1.5; }
  .intro { padding: 1.25rem; border-top: 3px solid var(--accent); background: var(--surface); }
  .eyebrow, .status { color: var(--accent); font-size: .875rem; }
  .eyebrow { text-transform: uppercase; letter-spacing: .1em; margin-bottom: .5rem; }
  h2 { font-family: var(--font-display); font-size: 1.45rem; line-height: 1.25; margin-bottom: .75rem; color: var(--text); }
  h3 { font-family: var(--font-display); font-size: 1.1rem; line-height: 1.4; color: var(--text); margin-bottom: .5rem; }
  p { color: var(--text-dim); }
  .counts { display: flex; flex-wrap: wrap; gap: .5rem 1.25rem; margin-top: 1rem; font-size: .875rem; color: var(--text-dim); }
  .counts strong { color: var(--text); }
  .venture-list { display: grid; gap: 1rem; }
  .venture { background: var(--surface); border: var(--border-faint); border-radius: var(--radius-md); padding: 1.1rem; }
  .established { border-color: var(--gain); }
  .row-head { display: flex; flex-wrap: wrap; justify-content: space-between; gap: .5rem; margin-bottom: .5rem; }
  .partner { color: var(--text-dim); font-size: .875rem; }
  .stages { display: flex; flex-wrap: wrap; list-style: none; gap: .5rem 1rem; margin: 1rem 0; padding: 0; color: var(--text-dim); font-size: .875rem; }
  .stages li { border-bottom: 2px solid var(--surface-raised, var(--bg)); padding-bottom: .4rem; }
  .stages .current { color: var(--accent); border-color: var(--accent); }
  .stages .complete { color: var(--gain); }
  .progress-label { display: flex; flex-wrap: wrap; justify-content: space-between; gap: .35rem; font-size: .875rem; color: var(--text-dim); }
  progress { width: 100%; height: .6rem; accent-color: var(--accent); margin: .5rem 0; }
  .detail { margin-top: .75rem; }
  .benefit { margin-top: 1rem; border-left: 2px solid var(--accent); padding-left: .8rem; }
  .benefit > span { color: var(--accent); font-size: .875rem; }
  .blockers { padding-left: 1.2rem; margin: .75rem 0; color: var(--text-dim); }
  .controls { display: flex; flex-wrap: wrap; gap: .5rem; margin-top: 1rem; align-items: start; }
  button, select { font: inherit; font-size: .875rem; border: var(--border-faint); border-radius: var(--radius-sm); padding: .7rem .9rem; color: var(--text); min-height: 44px; background: var(--bg); text-align: left; }
  button { cursor: pointer; } button small { display: block; font-size: .875rem; font-weight: normal; margin-top: .15rem; }
  button:hover:not(:disabled), button:focus-visible, select:focus-visible, summary:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  button:disabled { opacity: .65; cursor: default; }
  .commit { border-color: var(--accent); color: var(--accent); }
  .queued { background: color-mix(in srgb, var(--accent) 14%, var(--bg)); }
  .start-row { display: grid; gap: .65rem; margin-top: 1rem; }
  label { display: grid; gap: .35rem; font-size: .875rem; color: var(--text-dim); }
  select { width: 100%; min-width: 0; }
  .abandon { flex-basis: 100%; margin-top: .5rem; color: var(--text-dim); font-size: .875rem; }
  summary { cursor: pointer; padding: .6rem 0; min-height: 44px; }
  .abandon p { margin: .5rem 0; }.danger { color: var(--loss); }
  .later-toggle { justify-self: start; }.later-list { display: grid; gap: 1rem; list-style: none; padding: 0; }
  .identity, .people { border-top: var(--border-faint); padding-top: 1.5rem; }
  .nicknames, .evidence, .people ul { list-style: none; padding: 0; display: grid; gap: .75rem; margin: 1rem 0; }
  .nicknames li, .evidence li { display: flex; flex-wrap: wrap; gap: .25rem .75rem; justify-content: space-between; }
  .nicknames strong { color: var(--accent); }.nicknames span, .evidence span { color: var(--text-dim); font-size: .875rem; }
  .people li { background: var(--surface); border: var(--border-faint); padding: 1rem; border-radius: var(--radius-sm); }
  .people li > div { display: flex; flex-wrap: wrap; justify-content: space-between; gap: .5rem; }
  .notice { position: sticky; top: var(--topbar-h, 0); z-index: 2; background: var(--bg); color: var(--accent); padding: .75rem; border: 1px solid var(--accent); }
  @media (max-width: 420px) { .intro, .venture { padding: .85rem; } .controls > button { width: 100%; } }
</style>
