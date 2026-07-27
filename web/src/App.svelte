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
  import CauseDrilldown from './lib/components/CauseDrilldown.svelte'
  import { glossaryStore } from './lib/glossary/glossaryStore.svelte'
  import { drilldownStore } from './lib/sim/drilldownStore.svelte'
  import { gameStore } from './lib/sim/gameStore.svelte'
  import { prefsStore } from './lib/prefs/prefsStore.svelte'
  import { DIFFICULTY_PRESETS } from '../../src/sim/state/difficulty'
  import {
    clearSession,
    loadSession,
    saveSessionFrom,
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

  // Phase 89 / ISSUE-049 — apply the typed `SaveResult`. `lastSavedAt`
  // is only pinned forward on a successful write; failed writes set
  // `gameStore.saveError` so the More → Saves section can surface a
  // banner with a Retry affordance. The banner clears on the next
  // successful save.
  //
  // Phase 199 / audit Wave 0 — building the envelope happens INSIDE
  // `saveSessionFrom`, so a serialization throw (P2-RT-001) becomes a
  // typed failure the banner can show instead of an uncaught exception
  // that silently ends autosaving.
  function commitSave() {
    const result = saveSessionFrom(() => gameStore.serializeForSave())
    if (result.ok) {
      gameStore.lastSavedAt = result.savedAt
      gameStore.saveError = undefined
    } else {
      gameStore.saveError = result
    }
  }

  function flushSaveNow() {
    if (!bootDone) return
    if (view === 'start') return
    if (saveTimer !== undefined) {
      clearTimeout(saveTimer)
      saveTimer = undefined
    }
    commitSave()
  }

  function scheduleSave() {
    if (!bootDone) return
    if (view === 'start') return
    if (saveTimer !== undefined) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      saveTimer = undefined
      commitSave()
    }, 300)
  }

  // Exposed so the SavesSection retry button can re-attempt the latest
  // write without waiting for the next debounce.
  function retrySaveNow() {
    flushSaveNow()
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
    // Theme: 'dark' pins the night palette, 'light' pins parchment, and
    // 'auto' removes the attribute so the prefers-color-scheme rule in
    // global.css decides. index.html ships data-theme="dark" so the
    // pre-hydration frame is always night — this effect takes over once
    // preferences load.
    const theme = prefsStore.preferences.theme
    if (theme === 'auto') {
      root.removeAttribute('data-theme')
    } else {
      root.setAttribute('data-theme', theme)
    }
  })

  // Phase 93 / ISSUE-053 — Sync the App-level `view` from
  // `gameStore.route` whenever the store route changes (e.g. the
  // Yesterday digest tap-through, snapshot/import replacement). Before
  // this, App rendered from local `view` only, so store-only route
  // writes were inert until reload.
  $effect(() => {
    if (!bootDone) return
    if (view === 'start') return
    const next = gameStore.route
    if (next !== view) view = next
  })

  // Phase 96 — Autosave effect. Reads the gameStore fields that should
  // trigger a save; the dependency list is intentionally narrow so the
  // effect doesn't fire on bookkeeping-only mutations.
  $effect(() => {
    // Touch the fields we want to react to. The values aren't used; the
    // reactive read is what registers the dependency.
    void gameStore.state
    void gameStore.beat
    // Phase 186 / Day-Clock Cluster 5 — persist the segment position so a
    // mid-day refresh resumes against the right engine segment. (It always
    // moves in lock-step with `state`, but listing it keeps the intent
    // explicit.)
    void gameStore.segment
    void gameStore.pendingBySeedId
    void gameStore.picks
    void gameStore.staffPriorities
    void gameStore.serviceComplete
    void gameStore.closingComplete
    void gameStore.route
    void gameStore.reportsSubview
    void gameStore.tavernSubview
    void gameStore.worldSubview
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
    // Phase 186 / Day-Clock Cluster 5 — open day one (Segment A: setup,
    // morning seeds, forecast) so the first morning shows real Segment-A
    // output. DayScreen's begin-day effect is the safety net for the
    // next-day and hydration paths; doing it here keeps the fresh start
    // explicit and flash-free.
    gameStore.beginDay()
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
  <!--
    Phase 97 / ISSUE-057 — Top-level error boundary. Catches render-phase
    errors (a throw inside a $derived.by, a component render crash, a
    bad reactive read). Does NOT catch event-handler errors — those are
    handled per-call (see endDay/runQuickDay in DayScreen). The failed
    snippet receives (error, reset); calling reset() retries the
    boundary's children with a fresh render.
  -->
  <svelte:boundary>
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
          onretrysave={retrySaveNow}
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

    {#snippet failed(error, reset)}
      <div class="app-error" role="alert">
        <p class="app-error-title">Something went wrong.</p>
        <p class="app-error-message mono">
          {error instanceof Error ? error.message : String(error)}
        </p>
        <div class="app-error-actions">
          <button
            type="button"
            class="app-error-btn"
            onclick={() => {
              view = 'day'
              gameStore.setRoute('day')
              reset()
            }}
          >
            Go to Day
          </button>
          <button
            type="button"
            class="app-error-btn ghost"
            onclick={() => location.reload()}
          >
            Reload
          </button>
        </div>
      </div>
    {/snippet}
  </svelte:boundary>
{/if}

<Glossary
  open={glossaryStore.open}
  anchorTerm={glossaryStore.anchorTerm}
  onclose={() => glossaryStore.close()}
/>

<!-- Phase 190a / ISSUE-157a — single app-root drilldown the from-anywhere
     MetricLink path binds against (mirrors the Glossary mount above). -->
<CauseDrilldown
  open={drilldownStore.open}
  path={drilldownStore.path}
  onclose={() => drilldownStore.close()}
/>

<style>
  .boot {
    min-height: 100dvh;
    background: var(--bg);
  }

  /* Phase 97 / ISSUE-057 — render-phase error recovery panel. */
  .app-error {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--sp-md);
    padding: var(--sp-xl) var(--sp-md);
    background: var(--bg);
    color: var(--text);
    text-align: center;
  }

  .app-error-title {
    font-family: var(--font-display);
    color: var(--accent);
    font-size: 22px;
    letter-spacing: 0.06em;
  }

  .app-error-message {
    color: var(--text-dim);
    font-size: 13px;
    line-height: 1.5;
    max-width: 520px;
    padding: var(--sp-sm) var(--sp-md);
    background: var(--surface);
    border: 1px solid color-mix(in srgb, var(--loss) 40%, transparent);
    border-radius: var(--radius-md);
    word-break: break-word;
  }

  .app-error-actions {
    display: flex;
    gap: var(--sp-sm);
  }

  .app-error-btn {
    font-family: var(--font-display);
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    font-size: 13px;
    color: var(--accent);
    background: transparent;
    border: 1px solid var(--accent);
    border-radius: var(--radius-sm);
    padding: 10px 16px;
    min-height: 40px;
  }

  .app-error-btn.ghost {
    color: var(--text-faint);
    border-color: color-mix(in srgb, var(--candle-soft) 40%, transparent);
  }
</style>
