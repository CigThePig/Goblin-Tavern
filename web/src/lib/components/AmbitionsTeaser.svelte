<script lang="ts">
  import { gameStore } from '../sim/gameStore.svelte'
  import type { OpeningsModuleState } from '../../../../src/sim/modules/openings/types'
  const active = $derived(Object.values(gameStore.state.ventures).filter(v => v.status === 'active').length)
  const offered = $derived(Object.values((gameStore.state.modules.openings as OpeningsModuleState | undefined)?.openings ?? {}).filter(o => o.status === 'active' && !gameStore.state.ventures[o.blueprintId] && o.expiresAtDay >= gameStore.state.calendar.totalDaysElapsed).length)
  function open() { gameStore.setTavernSubview('ambitions'); gameStore.setRoute('tavern') }
</script>
{#if active || offered}
  <button type="button" class="ambitions-link" onclick={open} aria-label="Open tavern ambitions">
    <span><strong>Beyond tonight</strong><span>{active} ambitions underway · {offered} openings</span></span>
    <span class="action">Make a plan →</span>
  </button>
{/if}
<style>
  .ambitions-link { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: .75rem; width: 100%; min-height: 64px; text-align: left; background: var(--surface); border: var(--border-faint); border-left: 3px solid var(--accent); border-radius: var(--radius-sm); padding: .8rem 1rem; cursor: pointer; }
  .ambitions-link > span:first-child { display: grid; gap: .15rem; }
  strong { font-size: 1rem; color: var(--text); }
  span span { font-size: .875rem; color: var(--text-dim); }
  .action { font-size: .875rem; color: var(--accent); }
  button:focus-visible, button:hover { outline: 2px solid var(--accent); outline-offset: 2px; }
</style>
