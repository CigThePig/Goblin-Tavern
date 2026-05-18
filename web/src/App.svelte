<script lang="ts">
  import './lib/design/global.css'
  import AppShell from './lib/components/AppShell.svelte'
  import StartScreen from './lib/screens/StartScreen.svelte'
  import DayScreen from './lib/screens/DayScreen.svelte'
  import ReportsScreen from './lib/screens/ReportsScreen.svelte'
  import TavernScreen from './lib/screens/TavernScreen.svelte'
  import ComingSoon from './lib/screens/ComingSoon.svelte'
  import Glossary from './lib/components/Glossary.svelte'
  import { glossaryStore } from './lib/glossary/glossaryStore.svelte'
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
      <ReportsScreen />
    {:else if view === 'tavern'}
      <TavernScreen />
    {:else if view === 'world'}
      <ComingSoon
        title="World"
        body="Regulars, suppliers, factions, cultures, NPCs, rumours. Hidden until populated. Wiring up in phase 93."
      />
    {/if}
  </AppShell>
{/if}

<Glossary
  open={glossaryStore.open}
  anchorTerm={glossaryStore.anchorTerm}
  onclose={() => glossaryStore.close()}
/>
