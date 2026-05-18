<script lang="ts">
  import { onMount } from 'svelte'
  import './lib/design/global.css'
  import AppShell from './lib/components/AppShell.svelte'
  import StartScreen from './lib/screens/StartScreen.svelte'
  import DayScreen from './lib/screens/DayScreen.svelte'
  import ReportsScreen from './lib/screens/ReportsScreen.svelte'
  import TavernScreen from './lib/screens/TavernScreen.svelte'
  import WorldScreen from './lib/screens/WorldScreen.svelte'
  import MoreScreen from './lib/screens/MoreScreen.svelte'
  import Glossary from './lib/components/Glossary.svelte'
  import { glossaryStore } from './lib/glossary/glossaryStore.svelte'
  import { gameStore } from './lib/sim/gameStore.svelte'
  import { prefsStore } from './lib/prefs/prefsStore.svelte'
  import { DIFFICULTY_PRESETS } from '../../src/sim/state/difficulty'
  import {
    clearSession,
    loadSession,
    saveSession,
    type LoadOutcome,
    type Route,
  } from './lib/sim/persistence'

  type View = 'start' | Route

  let view = $state<View>('start')
  let bootDone = $state(false)
  let bootOutcome = $state<LoadOutcome | undefined>(undefined)

  // Phase 96 — On mount, attempt to load a save. A valid save hydrates
  // the store but keeps the StartScreen visible so the player can pick
  // Continue or Start over (per game-loop §2.3). Invalid /
  // incompatible saves keep the StartScreen too, with a banner.
  onMount(() => {
    // Phase 98 — Preferences hydrate FIRST so the CSS-attribute `$effect`
    // pushes data-font-scale / data-reduced-motion onto `<html>` before
    // the first screen renders.
    prefsStore.hydrate()

    const outcome = loadSession()
    bootOutcome = outcome
    if (outcome.kind === 'loaded') {
      gameStore.hydrateFromSave(outcome.save)
    } else if (outcome.kind === 'invalid') {
      gameStore.hydrationError = outcome.reason
    }
    bootDone = true

    // Hard-flush save when the tab is hidden — covers tab-close, app
    // backgrounding on mobile, and lock-screen events.
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushSaveNow()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pagehide', flushSaveNow)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pagehide', flushSaveNow)
      if (saveTimer !== undefined) {
        clearTimeout(saveTimer)
        saveTimer = undefined
      }
    }
  })

  let saveTimer: ReturnType<typeof setTimeout> | undefined

  function flushSaveNow() {
    if (!bootDone) return
    if (view === 'start') return
    if (saveTimer !== undefined) {
      clearTimeout(saveTimer)
      saveTimer = undefined
    }
    const session = gameStore.serializeForSave()
    saveSession(session)
    gameStore.lastSavedAt = session.savedAt
  }

  function scheduleSave() {
    if (!bootDone) return
    if (view === 'start') return
    if (saveTimer !== undefined) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      saveTimer = undefined
      const session = gameStore.serializeForSave()
      saveSession(session)
      gameStore.lastSavedAt = session.savedAt
    }, 300)
  }

  // Phase 98 — Mirror preferences onto `<html>` data-attributes. The
  // CSS in `global.css` reads these to apply font-scale and the
  // explicit on/off reduced-motion override.
  $effect(() => {
    if (typeof document === 'undefined') return
    const root = document.documentElement
    root.setAttribute('data-font-scale', prefsStore.preferences.fontScale)
    const rm = prefsStore.preferences.reducedMotion
    if (rm === 'on') {
      root.setAttribute('data-reduced-motion', 'true')
    } else if (rm === 'off') {
      root.setAttribute('data-reduced-motion', 'false')
    } else {
      root.removeAttribute('data-reduced-motion')
    }
  })

  // Phase 96 — Autosave effect. Reads the gameStore fields that should
  // trigger a save; the dependency list is intentionally narrow so the
  // effect doesn't fire on bookkeeping-only mutations.
  $effect(() => {
    // Touch the fields we want to react to. The values aren't used; the
    // reactive read is what registers the dependency.
    void gameStore.state
    void gameStore.beat
    void gameStore.pendingBySeedId
    void gameStore.picks
    void gameStore.staffPriorities
    void gameStore.serviceComplete
    void gameStore.closingComplete
    void gameStore.route
    void gameStore.latestResult
    void view
    scheduleSave()
  })

  function navigate(r: Route) {
    view = r
    gameStore.setRoute(r)
  }

  function startGame() {
    // Fresh start — clear any save, reset the store, drop into Day.
    // Phase 98 — Apply the difficulty preset the player picked on
    // StartScreen (sticky default lives in prefsStore.lastDifficulty).
    clearSession()
    const difficulty = DIFFICULTY_PRESETS[prefsStore.preferences.lastDifficulty]
    gameStore.reset(gameStore.seedString, difficulty)
    bootOutcome = { kind: 'fresh' }
    view = 'day'
    gameStore.setRoute('day')
  }

  function continueGame() {
    // The store has already been hydrated in `onMount`; this is just
    // the StartScreen UI calling through after the player confirms.
    view = gameStore.route
    // Auto-dismiss the welcome-back pill 30s after the player enters
    // the game. Scheduled here so the timer starts when the player is
    // actually looking at the Day screen, not while StartScreen sits.
    window.setTimeout(() => {
      if (gameStore.savedSnapshotJustLoaded) {
        gameStore.dismissWelcomeBack()
      }
    }, 30_000)
  }

  // What the StartScreen needs to know about the loaded save when one
  // exists. Days come from the calendar's totalDaysElapsed.
  const existingSave = $derived.by(() => {
    if (bootOutcome?.kind !== 'loaded') return undefined
    return {
      day: gameStore.state.calendar.totalDaysElapsed,
      lastSavedAt: bootOutcome.save.savedAt,
    }
  })

  const bootBanner = $derived.by(() => {
    if (bootOutcome?.kind === 'incompatible') {
      return `Save from a newer version (v${bootOutcome.saveVersion}). Start over to play.`
    }
    if (bootOutcome?.kind === 'invalid') {
      return "We couldn't read your last save. Start over to play."
    }
    return undefined
  })
</script>

{#if !bootDone}
  <!-- Bare loading frame — avoids flashing the StartScreen during the
       synchronous save read. Tiny budget, no flicker. -->
  <div class="boot" aria-hidden="true"></div>
{:else if view === 'start'}
  <StartScreen
    {existingSave}
    banner={bootBanner}
    onstart={startGame}
    oncontinue={continueGame}
  />
{:else}
  <AppShell route={view} onnavigate={navigate}>
    {#if view === 'day'}
      <DayScreen />
    {:else if view === 'reports'}
      <ReportsScreen />
    {:else if view === 'tavern'}
      <TavernScreen />
    {:else if view === 'world'}
      <WorldScreen />
    {:else if view === 'more'}
      <MoreScreen
        onreplaced={() => {
          // Phase 98 — Snapshot load or import has replaced the current
          // run. Drop the player into Day on the just-hydrated state so
          // the new world is immediately playable; the autosave will
          // flush on the next save cycle, so a reload from here surfaces
          // the standard welcome-back path.
          view = gameStore.route
          gameStore.setRoute(gameStore.route)
        }}
      />
    {/if}
  </AppShell>
{/if}

<Glossary
  open={glossaryStore.open}
  anchorTerm={glossaryStore.anchorTerm}
  onclose={() => glossaryStore.close()}
/>

<style>
  .boot {
    min-height: 100dvh;
    background: var(--bg);
  }
</style>
