<script lang="ts">
  import './lib/design/global.css'
  import AppShell from './lib/components/AppShell.svelte'
  import StartScreen from './lib/screens/StartScreen.svelte'
  import DayScreen from './lib/screens/DayScreen.svelte'
  import ComingSoon from './lib/screens/ComingSoon.svelte'
  import type { Route } from './lib/components/BottomNav.svelte'

  type View = 'start' | Route

  let view = $state<View>('start')

  function navigate(r: Route) {
    view = r
  }

  function startGame() {
    view = 'day'
  }
</script>

{#if view === 'start'}
  <StartScreen onstart={startGame} />
{:else}
  <AppShell route={view} onnavigate={navigate}>
    {#if view === 'day'}
      <DayScreen />
    {:else if view === 'reports'}
      <ComingSoon
        title="Reports"
        body="Daily, weekly, monthly digests. Pressures dashboard. Tavern Log. Wiring up in phase 89."
      />
    {:else if view === 'tavern'}
      <ComingSoon
        title="Tavern"
        body="Areas, stock, recipes, staff, projects, policies. State-as-place. Wiring up in phase 92."
      />
    {:else if view === 'world'}
      <ComingSoon
        title="World"
        body="Regulars, suppliers, factions, cultures, NPCs, rumours. Hidden until populated. Wiring up in phase 93."
      />
    {/if}
  </AppShell>
{/if}
