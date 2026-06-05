// Goblin Tavern — game store
//
// SOLE caller of the engine in the web layer. Every screen reads from
// `gameStore.state`; mutation flows back through the day-segment methods
// (`beginDay` / `runService` / `endDay`, with `runDay` as the run-all
// convenience). Keeping the engine call concentrated here is the
// boundary that makes the rest of the UI reason-about-able.
//
// Phase 186 / Day-Clock Cluster 5 — the day is no longer one end-of-day
// `simulateDay`. It runs as the three real engine segments the day-clock
// contract defines (§2), each via `advanceDaySegment`:
//
//   beginDay()   → Segment A (setup + morning seed generation + forecast)
//   ⏸ Pause 1 — morning plan (owner actions + staff priorities)
//   runService() → Segment B (apply owner actions, service, closing)
//   ⏸ Pause 2 — service react (response intents)
//   endDay()     → Segment C (apply responses, rollups, build the report)
//
// This makes card placement honest: morning cards are produced by
// Segment A, emergent service/closing cards by Segment B, and the player
// resolves them the SAME day in Segment C (contract §1.9; Cluster 1 made
// resolution same-day). The pre-Cluster-5 single `runDay` resolved
// against the *previous* day's seeds, which Cluster 1 silently broke —
// this is the fix. The `segment` field (persisted) tracks position so a
// mid-day refresh resumes against the right segment; the start-of-day
// `dayBaseline` is held so the daily report keeps reading one full-day
// diff across the segment runtimes (GATE B, contract §4.2).
//
// Phase 92 lifted `picks` and `staffPriorities` out of `DayScreen`
// local state. The picks queue is now a shared cross-screen surface so
// Tavern panels can queue actions (Restock, Clean, Toggle policy, …)
// that DayScreen then submits at end-of-day. `staffPriorities` is
// sticky across days (engine semantic) and survives navigation.
//
// Phase 96 lifted the day-session view state — current beat, pending
// intents per seed, and the two deck-completion flags — onto the store
// so the persistence layer can autosave/restore the player's exact
// position. The store remains storage-agnostic: `App.svelte` owns the
// localStorage I/O via `persistence.ts`.

import { advanceDaySegment } from '../../../../src/sim/core/engine'
import { createInitialTavernState } from '../../../../src/sim/state/defaults'
import type { DifficultyConfig } from '../../../../src/sim/state/difficulty'
import { FULL_PIPELINE } from '../../../../src/sim/canonicalPipeline'
import type { TavernState } from '../../../../src/sim/state/TavernState'
import type { CalendarState } from '../../../../src/sim/modules/calendar/types'
import type { SimInput } from '../../../../src/sim/core/context'
import type { SimResult } from '../../../../src/sim/core/result'
import type { IssueSeed } from '../../../../src/sim/modules/issues/issueSeedTypes'
import {
  DAY_MINUTES,
  formatDuration,
  nextPickId,
  picksToInputs,
  sanitizePicks,
  type PickedAction,
} from './actionBuilder'
import { actionRegistry } from '../../../../src/sim/registries/actionRegistry'
import {
  actionDisabledReason,
  actionDisabledReasonForTarget,
} from '../../../../src/sim/modules/ownerActions/readonlyHelpers'
import {
  INITIAL_DAY_SESSION,
  MISSED_OPPORTUNITY_DISMISSAL_WINDOW_DAYS,
  type Beat,
  type DaySegment,
  type PendingChoice,
} from './daySession'
import type {
  LatestResultLite,
  PersistedSession,
  ReportsSubview,
  Route,
  SaveResult,
  TavernSubview,
  WorldSubview,
} from './persistence'
import { ENTITY_ROUTING, type EntityKind } from '../components/links/types'
import type { OwnerActionCategory } from '../../../../src/sim/modules/ownerActions/types'

/**
 * Phase 195 / ISSUE-162 — context carried by a one-shot ActionPicker open
 * request. The TopBar time chip requests a bare open (`{}`); a drilldown
 * "Plan an action" CTA carries the tab to preselect and whether to scroll
 * the Suggested section into view.
 */
export type ActionPickerRequest = {
  tab?: OwnerActionCategory
  focusSuggested?: boolean
}

/**
 * Phase 196 / ISSUE-163 — which seed timings own resolvable cards on each
 * beat, mirroring `DayScreen`'s per-beat seed slices. Plan and report carry
 * no card deck, so `hasUnresolvedDayWork` falls back to the picks queue
 * alone for them.
 */
const BEAT_SEED_TIMINGS: Record<Beat, IssueSeed['timing'][]> = {
  morning: ['morning_prep', 'end_week', 'end_month'],
  plan: [],
  service: ['during_service'],
  closing: ['closing'],
  report: [],
}

class GameStore {
  state: TavernState = $state(createInitialTavernState())
  latestResult: SimResult | undefined = $state(undefined)
  /**
   * The calendar snapshotted BEFORE the most recent `runDay` call.
   * The Daily Report needs this because the engine advances the
   * calendar in its final phase, so `state.calendar` post-runDay is
   * tomorrow's calendar; the just-closed day's calendar is here.
   */
  previousCalendar: CalendarState | undefined = $state(undefined)
  seedString: string = $state('crooked-keg')

  /** Owner-action queue, shared across DayScreen and Tavern panels. */
  picks: PickedAction[] = $state([])

  /**
   * Sticky map of staffId → priorityId. Engine takes the map verbatim
   * each day; omitted staff fall back to role defaults. Persistent
   * across days by design (game-loop §3.3).
   */
  staffPriorities: Record<string, string> = $state({})

  // Phase 96 — Day-session view state. Lives on the store so refreshes
  // resume on the same beat with the same pending intents.
  beat: Beat = $state(INITIAL_DAY_SESSION.beat)
  pendingBySeedId: Record<string, PendingChoice> = $state({})
  serviceComplete: boolean = $state(INITIAL_DAY_SESSION.serviceComplete)
  closingComplete: boolean = $state(INITIAL_DAY_SESSION.closingComplete)

  // Phase 186 / Day-Clock Cluster 5 — segment position for the in-progress
  // (or just-closed) day. Persisted so a mid-day refresh resumes against
  // the right segment without re-running one. See `DaySegment` doc.
  segment: DaySegment = $state(INITIAL_DAY_SESSION.segment)

  /**
   * Phase 186 / Day-Clock Cluster 5 — the start-of-day `TavernState`
   * (snapshot taken before Segment A). Held so Segments B and C can be
   * passed it as `dayBaseline`, keeping the daily report's full-day diff
   * bracketed start-of-day → end-of-day across the three per-segment
   * runtimes (GATE B, contract §4.2). Persisted while a day is in
   * progress (`segment` is 'A' or 'B') so the report stays whole after a
   * mid-day refresh; cleared/overwritten at the next `beginDay`.
   */
  dayBaseline: TavernState | undefined = $state(undefined)

  /**
   * Phase 186 / Day-Clock Cluster 5 — accumulated logs across the day's
   * segments. Each `advanceDaySegment` call has its own runtime and so
   * its own `result.logs`; the daily report's `latestResult.logs` should
   * read the whole day, so A's and B's logs are stashed here and prepended
   * to C's when `endDay` builds the final result. In-memory only — a
   * mid-day refresh loses A/B logs (cosmetic: only the debug-bundle log
   * count is affected).
   */
  private dayLogs: SimResult['logs'] = []

  // Phase 96 — Last selected top-level route. The App restores this on
  // boot so a player who closed the app while reading the Tavern panel
  // returns there instead of being yanked back to Day.
  route: Route = $state('day')

  // Phase 93 / ISSUE-053 — Last visited subview per top-level screen.
  // Persisted in the save envelope so Reload/Continue lands the player
  // on the same Monthly/Projects/Rumours tab they were reading.
  reportsSubview: ReportsSubview = $state('today')
  tavernSubview: TavernSubview = $state('areas')
  worldSubview: WorldSubview = $state('regulars')

  // Phase 190a / ISSUE-157a — Transient routing targets. When an
  // `EntityLink` routes to a sub-view it stashes the entity id here; the
  // destination panel consumes it on mount (consume-once) to auto-open
  // the matching detail sheet. Session-only — NOT persisted to the save
  // envelope (it is a routing hint, not state), so the save schema stays
  // stable. Re-entering a panel via the tab nav finds the target already
  // consumed, so the sheet does not re-open.
  tavernSubviewTarget: string | undefined = $state(undefined)
  worldSubviewTarget: string | undefined = $state(undefined)

  // Phase 192 / ISSUE-159 — one-shot request to open the ActionPicker.
  // The `ActionPicker` open-state is screen-local (Day/Tavern/World each
  // own a `pickerOpen`); the global TopBar time chip needs a cross-
  // component signal to open it. Set by `requestActionPicker()`, consumed
  // once by the active screen's mount/reactive `$effect`. Session-only —
  // NOT persisted (a routing hint, like the sub-view targets above).
  //
  // Phase 195 / ISSUE-162 — the flag became a typed request object so a
  // drilldown CTA can carry the tab to preselect + a focus-Suggested hint.
  // `undefined` means "no request pending"; any object means "open".
  actionPickerRequest: ActionPickerRequest | undefined = $state(undefined)

  // Phase 96 — One-shot flag the welcome-back pill reads. Set true on
  // hydration; flipped to false on the first beat advance.
  savedSnapshotJustLoaded: boolean = $state(false)
  /** ISO timestamp of the last successful save flush. */
  lastSavedAt: string | undefined = $state(undefined)
  /** Non-blocking error surfaced when a save couldn't be hydrated. */
  hydrationError: string | undefined = $state(undefined)
  /**
   * Phase 89 / ISSUE-049 — Last failed autosave attempt. The More →
   * Saves section renders a recoverable banner when this is set; the
   * App layer clears it on the next successful flush. Holding the
   * typed `SaveResult` failure variant means the banner can show
   * quota-specific copy.
   */
  saveError: Exclude<SaveResult, { ok: true }> | undefined = $state(undefined)

  /**
   * Phase 97 / ISSUE-057 — Last thrown error from a `runDay()` call.
   * `runDay` itself never swallows; the UI handler wraps the call,
   * stamps the captured error here on throw, and renders a banner
   * with a Retry affordance. Mirrors the saveError pattern.
   */
  runError: { message: string; stack?: string } | undefined = $state(undefined)

  /**
   * Phase 97 — Per-day dismissed missed-opportunity ids. Used by the
   * daily-report projection to filter the "What you could have done"
   * block. A new Set reference is assigned on every change so `$state`
   * triggers downstream `$derived`s.
   */
  dismissedMissedOpportunityIds: Set<string> = $state(new Set())

  /**
   * Build the per-day `SimInput`. The same input is valid for any
   * segment — each segment only consumes the fields whose phase it runs
   * (`ownerActions` in B, `responseIntents` in C); the rest are inert
   * (Cluster 2 note). The seed embeds the absolute-day coordinate
   * (`totalDaysElapsed`, Phase 91 / ISSUE-051), which is stable across a
   * day's three segments — the calendar only advances in Segment C's
   * `advanceCalendar` — so A, B, and C all derive the *same* seed string,
   * which is required for the segmented run to match `simulateDay`.
   */
  private dayInput(extra: Partial<Omit<SimInput, 'seed'>> = {}): SimInput {
    const seed = `${this.seedString}-d${this.state.calendar.totalDaysElapsed}`
    return {
      seed,
      ownerActions: extra.ownerActions ?? picksToInputs(this.picks),
      staffPriorities: extra.staffPriorities ?? { ...this.staffPriorities },
      ...(extra.responseIntents ? { responseIntents: extra.responseIntents } : {}),
    }
  }

  /**
   * Phase 97 / ISSUE-057 — `$state.snapshot` returns a deep, plain
   * (non-proxied) clone of the reactive state. Required so the engine's
   * `structuredClone` in `cloneTavernState` doesn't choke on Svelte's
   * deep proxy in environments where structuredClone is stricter than
   * Chrome's (e.g. jsdom in component tests).
   */
  private snapshotState(): TavernState {
    return $state.snapshot(this.state) as TavernState
  }

  /**
   * The start-of-day baseline as a plain (non-proxied) `TavernState`,
   * ready to hand to the engine. `dayBaseline` is a `$state` field, so a
   * direct read returns Svelte's deep proxy, which `structuredClone`
   * rejects in stricter environments (jsdom). Falls back to the current
   * state when no baseline is held (the documented post-reload edge).
   */
  private dayBaselineSnapshot(): TavernState {
    return this.dayBaseline
      ? ($state.snapshot(this.dayBaseline) as TavernState)
      : this.snapshotState()
  }

  /**
   * Segment A — open a new day. Runs setup (`startDay … forecastTraffic`):
   * clears yesterday's surface, advances the world, generates the morning
   * seeds (`morning_prep` + choice-bearing periodic seeds, Cluster 4), and
   * forecasts today's traffic. Captures the start-of-day baseline for the
   * full-day diff (GATE B) and resets the per-day session view state.
   *
   * Idempotent: only opens a day from the 'C' (ready) state, so a
   * stray double-call (e.g. an effect firing twice) is a no-op. Returns
   * `undefined` when it did not open a day.
   */
  beginDay(): SimResult | undefined {
    if (this.segment !== 'C') return undefined
    const baseline = this.snapshotState()
    this.dayBaseline = baseline
    const result = advanceDaySegment(baseline, this.dayInput(), FULL_PIPELINE, 'A')
    this.state = result.state
    this.dayLogs = [...result.logs]
    this.segment = 'A'
    // Per-day session view state resets for the new day. Picks are NOT
    // reset here — a player can queue owner actions from the Tavern
    // surfaces before the plan beat; they are consumed (and cleared) when
    // Segment B applies them.
    this.pendingBySeedId = {}
    this.serviceComplete = false
    this.closingComplete = false
    return result
  }

  /**
   * Segment B — the day happening. Applies the morning plan (queued owner
   * actions + sticky staff priorities), runs service, and recomputes
   * pressures/feedback at closing. Emergent `during_service`/`closing`
   * seeds are produced here, at the moment service runs (contract §3.1).
   * Owner-action picks are consumed and the queue is cleared.
   *
   * Only runs from the 'A' state; otherwise a no-op (returns `undefined`).
   */
  runService(extra: Partial<Omit<SimInput, 'seed'>> = {}): SimResult | undefined {
    if (this.segment !== 'A') return undefined
    const result = advanceDaySegment(
      this.snapshotState(),
      this.dayInput(extra),
      FULL_PIPELINE,
      'B',
      { dayBaseline: this.dayBaselineSnapshot() },
    )
    this.state = result.state
    this.dayLogs = [...this.dayLogs, ...result.logs]
    this.segment = 'B'
    // Owner actions have been applied — drain the queue. Staff priorities
    // persist by design.
    this.picks = []
    return result
  }

  /**
   * Segment C — wrap-up. Applies the day's response intents (the player's
   * reactions to morning + service + closing cards), runs the rollups,
   * builds the report, validates, and advances the calendar. Sets
   * `latestResult` (with the full-day diff and the concatenated day logs)
   * so the report beat can render. Leaves `segment` at 'C' — the
   * "ready to begin the next day" state.
   *
   * Only runs from the 'B' state; otherwise returns the existing
   * `latestResult` unchanged (so a stray call can't double-close a day).
   */
  endDay(extra: Partial<Omit<SimInput, 'seed'>> = {}): SimResult | undefined {
    if (this.segment !== 'B') return this.latestResult
    // The calendar BEFORE Segment C's `advanceCalendar` is the closing
    // day's calendar — the daily report needs it to label the day that
    // just closed (the post-C `state.calendar` is already tomorrow). This
    // matches the pre-Cluster-5 `runDay`, which captured it before the
    // single `simulateDay`; capturing it here (not at `beginDay`) keeps
    // the prior day's report correctly labelled while the next day is in
    // progress.
    const closingCalendar = this.snapshotState().calendar
    const result = advanceDaySegment(
      this.snapshotState(),
      this.dayInput(extra),
      FULL_PIPELINE,
      'C',
      { dayBaseline: this.dayBaselineSnapshot() },
    )
    this.previousCalendar = {
      ...closingCalendar,
      tags: [...closingCalendar.tags],
    }
    this.state = result.state
    // The report's `latestResult.logs` should read the whole day, so
    // prepend A's and B's logs to C's.
    this.latestResult = { ...result, logs: [...this.dayLogs, ...result.logs] }
    this.dayLogs = []
    this.segment = 'C'
    // The day is closed; the baseline is no longer needed.
    this.dayBaseline = undefined
    // Phase 97 — Prune stale dismissal entries so the set stays bounded.
    // Runs here (not beginDay) because the calendar has just advanced.
    this.pruneMissedOpportunityDismissals()
    return this.latestResult
  }

  /**
   * Run-all convenience: advance from the current position to a closed
   * day (Segments A → B → C). The cardless flows and tests use this to
   * step one full day in a single call; the interactive DayScreen drives
   * the three segments separately across the beats. Each step is guarded,
   * so calling this mid-day finishes the in-progress day rather than
   * starting a fresh one.
   */
  runDay(extra: Partial<Omit<SimInput, 'seed'>> = {}): SimResult {
    this.beginDay()
    this.runService(extra)
    return this.endDay(extra) as SimResult
  }

  /**
   * Fresh save. The Crooked Keg, day zero, dirty, broke, goblin-authentic
   * (see game-loop-and-ux.md §2.1). Phase 98 — optional `difficulty`
   * preset modulates day-zero coin / cleanliness / pressure baselines.
   */
  reset(seed?: string, difficulty?: DifficultyConfig): void {
    if (seed) this.seedString = seed
    this.state = createInitialTavernState(undefined, difficulty)
    this.latestResult = undefined
    this.previousCalendar = undefined
    this.picks = []
    this.staffPriorities = {}
    this.beat = INITIAL_DAY_SESSION.beat
    this.pendingBySeedId = {}
    this.serviceComplete = INITIAL_DAY_SESSION.serviceComplete
    this.closingComplete = INITIAL_DAY_SESSION.closingComplete
    // 'C' = ready to begin day one; the first `beginDay()` opens it.
    this.segment = INITIAL_DAY_SESSION.segment
    this.dayBaseline = undefined
    this.dayLogs = []
    this.route = 'day'
    this.reportsSubview = 'today'
    this.tavernSubview = 'areas'
    this.worldSubview = 'regulars'
    this.tavernSubviewTarget = undefined
    this.worldSubviewTarget = undefined
    this.actionPickerRequest = undefined
    this.savedSnapshotJustLoaded = false
    this.lastSavedAt = undefined
    this.hydrationError = undefined
    this.saveError = undefined
    this.runError = undefined
    this.dismissedMissedOpportunityIds = new Set()
  }

  // ── Persistence boundary ─────────────────────────────────────────

  /**
   * Restore from a previously-saved session. Single-source — the
   * caller has already validated and migrated `save.state` through
   * `persistence.loadSession()`.
   */
  hydrateFromSave(save: PersistedSession): void {
    this.seedString = save.simSeed
    this.state = save.state
    this.previousCalendar = save.previousCalendar
    this.latestResult = save.latestResultLite
      ? { ...save.latestResultLite, state: save.state }
      : undefined
    // Phase 89 / ISSUE-049 — Re-run pick sanitation against the
    // (now-canonical) hydrated state. `validatePersistedSession` also
    // sanitises, but running it here too means picks added from a
    // snapshot/import path are filtered against the same rules even if
    // a future call site forgets the upstream sanitiser.
    const { picks: hydratedPicks } = sanitizePicks(save.picks, save.state)
    this.picks = hydratedPicks
    this.staffPriorities = { ...save.staffPriorities }
    this.pendingBySeedId = { ...save.pendingBySeedId }
    this.beat = save.daySession.beat
    this.serviceComplete = save.daySession.serviceComplete
    this.closingComplete = save.daySession.closingComplete
    // Phase 186 / Cluster 5 — resume the segment position. The sanitiser
    // guarantees a value (derived from `beat` for pre-Cluster-5 saves).
    this.segment = save.daySession.segment ?? 'C'
    // The start-of-day baseline is only present mid-day (segment 'A'/'B').
    // Without it, a resumed end-of-day would produce a partial full-day
    // diff — the segment methods fall back to the current state, which is
    // the documented edge Cluster 7's migration will harden.
    this.dayBaseline = save.dayBaseline
    this.dayLogs = []
    this.route = save.route
    this.reportsSubview = save.subroutes?.reports ?? 'today'
    this.tavernSubview = save.subroutes?.tavern ?? 'areas'
    this.worldSubview = save.subroutes?.world ?? 'regulars'
    this.savedSnapshotJustLoaded = true
    this.lastSavedAt = save.savedAt
    this.hydrationError = undefined
    this.dismissedMissedOpportunityIds = new Set(
      save.dismissedMissedOpportunityIds ?? [],
    )
  }

  /**
   * Serialize current store state for saving. The caller (App) drops
   * the result through `persistence.saveSession()`. The `savedAt`
   * timestamp is filled in here so the same value lands both in
   * storage and (post-save) on `lastSavedAt`.
   */
  serializeForSave(): PersistedSession {
    const latestResultLite: LatestResultLite | undefined = this.latestResult
      ? {
          reports: this.latestResult.reports,
          logs: this.latestResult.logs,
          validation: this.latestResult.validation,
          diffs: this.latestResult.diffs,
        }
      : undefined
    return {
      saveVersion: 1,
      savedAt: new Date().toISOString(),
      simSeed: this.seedString,
      state: this.state,
      ...(this.previousCalendar
        ? {
            previousCalendar: {
              ...this.previousCalendar,
              tags: [...this.previousCalendar.tags],
            },
          }
        : {}),
      ...(latestResultLite ? { latestResultLite } : {}),
      picks: [...this.picks],
      staffPriorities: { ...this.staffPriorities },
      pendingBySeedId: { ...this.pendingBySeedId },
      daySession: {
        beat: this.beat,
        serviceComplete: this.serviceComplete,
        closingComplete: this.closingComplete,
        segment: this.segment,
      },
      // Persist the start-of-day baseline only while a day is in progress
      // (segment 'A'/'B') — at 'C' the day is closed and the next
      // `beginDay` will snapshot a fresh one, so storing it would just
      // bloat the save with a stale copy of state.
      ...(this.dayBaseline && this.segment !== 'C'
        ? { dayBaseline: this.dayBaseline }
        : {}),
      route: this.route,
      subroutes: {
        reports: this.reportsSubview,
        tavern: this.tavernSubview,
        world: this.worldSubview,
      },
      dismissedMissedOpportunityIds: [...this.dismissedMissedOpportunityIds],
    }
  }

  /** Issue seeds the sim produced on the most recent day, valid only. */
  get todaysSeeds(): IssueSeed[] {
    const slot = this.state.modules['issueSeeds'] as
      | { seedsToday?: unknown[] }
      | undefined
    const raw = slot?.seedsToday ?? []
    return (raw as IssueSeed[]).filter((s) => s.validation?.valid === true)
  }

  /** Seeds filtered to a single timing slot. */
  seedsForTiming(timing: IssueSeed['timing']): IssueSeed[] {
    return this.todaysSeeds.filter((s) => s.timing === timing)
  }

  /**
   * Phase 196 / ISSUE-163 — does the player have outstanding Day work they
   * may have navigated away from? Drives the BottomNav Day-tab dot. Two
   * sources, both genuine cross-screen states:
   *  • queued owner-action picks — the picks queue is shared, so Tavern
   *    panels (Restock, Clean, policy toggles) enqueue here while the
   *    player is off the Day tab; and
   *  • unresolved issue-seed cards on the active beat — a seed whose card
   *    the player hasn't answered yet (no `pendingBySeedId` entry).
   * Read-only/derived; only the beat's own timings count (plan/report
   * beats carry no resolvable cards, so picks alone drive them).
   */
  get hasUnresolvedDayWork(): boolean {
    if (this.picks.length > 0) return true
    const timings = BEAT_SEED_TIMINGS[this.beat]
    return this.todaysSeeds.some(
      (s) => timings.includes(s.timing) && !(s.id in this.pendingBySeedId),
    )
  }

  // ── Picks queue API ──────────────────────────────────────────────

  addPick(pick: Omit<PickedAction, 'pickId'>): PickedAction {
    const full: PickedAction = { ...pick, pickId: nextPickId() }
    this.picks = [...this.picks, full]
    return full
  }

  /**
   * Phase 90 / ISSUE-050 — Budget- and canApply-aware variant of
   * `addPick`. Every UI entry point (central picker, Tavern quick
   * actions, projects/policies, expedition sheet) should funnel through
   * this so the queue cannot overflow the daily time budget or
   * carry an invalid (action, target) pair into `runDay`.
   *
   * Returns the actual `PickedAction` on success, or a typed failure
   * with a player-readable reason. Surfaces reasons identical to the
   * central picker's `actionDisabledReason` output so the message is
   * consistent across surfaces.
   */
  tryAddPick(
    pick: Omit<PickedAction, 'pickId'>,
  ):
    | { ok: true; pick: PickedAction }
    | { ok: false; reason: string } {
    if (!actionRegistry.has(pick.actionId)) {
      return { ok: false, reason: 'unknown action' }
    }
    const def = actionRegistry.get(pick.actionId)
    const pointsLeft = DAY_MINUTES - this.minutesQueued
    const reason =
      def.targetType && def.targetType !== 'global'
        ? actionDisabledReasonForTarget(def, this.state, pick.targetId, pointsLeft)
        : actionDisabledReason(def, this.state, pointsLeft)
    if (reason) return { ok: false, reason }
    return { ok: true, pick: this.addPick(pick) }
  }

  removePick(pickId: string): void {
    this.picks = this.picks.filter((p) => p.pickId !== pickId)
  }

  setPicks(next: PickedAction[]): void {
    this.picks = next
  }

  clearPicks(): void {
    this.picks = []
  }

  /**
   * Total minutes across queued picks. Sticky chip reads this. The queue
   * budget is time; `p.timeCost` holds minutes (Phase 186; was
   * `actionPointCost`).
   */
  get minutesQueued(): number {
    return this.picks.reduce((n, p) => n + p.timeCost, 0)
  }

  /** True when at least one pick targets this (action, target). Options ignored. */
  isQueued(actionId: string, targetId?: string): boolean {
    return this.picks.some(
      (p) => p.actionId === actionId && p.targetId === targetId,
    )
  }

  /** Remove every queued pick matching (action, target). Options ignored. */
  removePicksFor(actionId: string, targetId?: string): void {
    this.picks = this.picks.filter(
      (p) => !(p.actionId === actionId && p.targetId === targetId),
    )
  }

  // ── Staff priorities API ────────────────────────────────────────

  setStaffPriority(staffId: string, priorityId: string | undefined): void {
    if (priorityId === undefined) {
      const next = { ...this.staffPriorities }
      delete next[staffId]
      this.staffPriorities = next
    } else {
      this.staffPriorities = { ...this.staffPriorities, [staffId]: priorityId }
    }
  }

  setStaffPriorities(next: Record<string, string>): void {
    this.staffPriorities = next
  }

  // ── Day-session setters (Phase 96) ──────────────────────────────

  setBeat(next: Beat): void {
    if (this.beat === next) return
    this.beat = next
    // Any beat advance dismisses the welcome-back pill — the player
    // has signalled they're oriented again.
    this.savedSnapshotJustLoaded = false
  }

  resolveSeed(seedId: string, pending: PendingChoice): void {
    this.pendingBySeedId = { ...this.pendingBySeedId, [seedId]: pending }
  }

  /**
   * Phase 190b / ISSUE-157b — drop a pending decision so the card's
   * choices are live again. A decision stays uncommitted until End Day,
   * so revising one before then is free; the pending-tag tap-target on
   * DayScreen calls this to let the player re-open the original choice.
   */
  clearSeed(seedId: string): void {
    if (!(seedId in this.pendingBySeedId)) return
    const next = { ...this.pendingBySeedId }
    delete next[seedId]
    this.pendingBySeedId = next
  }

  setServiceComplete(value: boolean): void {
    this.serviceComplete = value
  }

  setClosingComplete(value: boolean): void {
    this.closingComplete = value
  }

  /**
   * Navigate to a top-level route, optionally carrying an entity target.
   *
   * Single-arg callers (`setRoute('day')`) are unchanged. When `opts.kind`
   * is given (the `EntityLink` path), the matching sub-view is selected
   * from {@link ENTITY_ROUTING} and `opts.target` is stashed as the
   * transient sub-view target for the destination panel to consume. An
   * empty target clears any pending target (land on the home tab, no
   * auto-open).
   */
  setRoute(r: Route, opts?: { target?: string; kind?: EntityKind }): void {
    this.route = r
    if (!opts?.kind) return
    const dest = ENTITY_ROUTING[opts.kind]
    const target = opts.target ? opts.target : undefined
    if (dest.route === 'tavern') {
      this.tavernSubview = dest.subview
      this.tavernSubviewTarget = target
    } else {
      this.worldSubview = dest.subview
      this.worldSubviewTarget = target
    }
  }

  /**
   * Read-and-clear the pending Tavern sub-view target (consume-once).
   * The destination panel calls this on mount; a later re-entry finds it
   * already cleared, so the targeted sheet does not re-open.
   */
  consumeTavernSubviewTarget(): string | undefined {
    const t = this.tavernSubviewTarget
    this.tavernSubviewTarget = undefined
    return t
  }

  /** Read-and-clear the pending World sub-view target (consume-once). */
  consumeWorldSubviewTarget(): string | undefined {
    const t = this.worldSubviewTarget
    this.worldSubviewTarget = undefined
    return t
  }

  /**
   * Phase 192 / ISSUE-159 — route to the Day screen and flag a request to
   * open the ActionPicker. The TopBar time chip calls this; the Day
   * screen consumes the flag on mount/reactively. Routing to `'day'`
   * first guarantees the screen that owns the picker is the one that
   * consumes the request.
   *
   * Phase 195 / ISSUE-162 — `opts` lets a drilldown CTA carry context: the
   * `tab` to preselect, whether to scroll the Suggested section into view,
   * and `planBeat` to force the plan beat. The beat is only forced when the
   * current day is actually open and still pre-service (`segment === 'A'`):
   * forcing it at a closed/ready day ('C') would land the player on a plan
   * whose Run-service / End-day buttons are inert no-ops. The picker queues
   * picks on any beat, so the open still happens either way.
   */
  requestActionPicker(
    opts: ActionPickerRequest & { planBeat?: boolean } = {},
  ): void {
    this.route = 'day'
    if (opts.planBeat && this.segment === 'A') this.setBeat('plan')
    this.actionPickerRequest = {
      ...(opts.tab ? { tab: opts.tab } : {}),
      focusSuggested: opts.focusSuggested ?? false,
    }
  }

  /** Read-and-clear the pending ActionPicker open request (consume-once).
   *  Returns the request context (truthy) or `undefined` when none pends. */
  consumeActionPickerRequest(): ActionPickerRequest | undefined {
    const req = this.actionPickerRequest
    this.actionPickerRequest = undefined
    return req
  }

  setReportsSubview(v: ReportsSubview): void {
    this.reportsSubview = v
  }

  setTavernSubview(v: TavernSubview): void {
    this.tavernSubview = v
  }

  setWorldSubview(v: WorldSubview): void {
    this.worldSubview = v
  }

  /** Dismiss the welcome-back pill without changing the beat. */
  dismissWelcomeBack(): void {
    this.savedSnapshotJustLoaded = false
  }

  /** Clear the last `runDay` error. Called from the DayScreen banner. */
  clearRunError(): void {
    this.runError = undefined
  }

  // ── Missed-opportunity dismissals (Phase 97) ────────────────────

  /** Mark a missed-opportunity hint as dismissed. The id is the
   *  projection's stable `missed_opp:{closedDay}:{kind}:{actionId}:{targetId}`
   *  string. A new Set reference is assigned to trigger `$state`. */
  dismissMissedOpportunity(id: string): void {
    if (this.dismissedMissedOpportunityIds.has(id)) return
    const next = new Set(this.dismissedMissedOpportunityIds)
    next.add(id)
    this.dismissedMissedOpportunityIds = next
  }

  /**
   * Drop dismissal entries whose `closedDay` (extracted from the id
   * prefix `missed_opp:{closedDay}:…`) is older than the window.
   * Called after `runDay` so the set never grows unbounded.
   */
  pruneMissedOpportunityDismissals(): void {
    const cutoff =
      this.state.calendar.totalDaysElapsed -
      1 -
      MISSED_OPPORTUNITY_DISMISSAL_WINDOW_DAYS
    if (this.dismissedMissedOpportunityIds.size === 0) return
    const next = new Set<string>()
    let changed = false
    for (const id of this.dismissedMissedOpportunityIds) {
      const closedDay = parseClosedDay(id)
      if (closedDay === undefined || closedDay >= cutoff) {
        next.add(id)
      } else {
        changed = true
      }
    }
    if (changed) {
      this.dismissedMissedOpportunityIds = next
    }
  }
}

function parseClosedDay(id: string): number | undefined {
  // id: `missed_opp:{closedDay}:{kind}:{actionId}:{targetId}`
  const parts = id.split(':')
  if (parts.length < 5) return undefined
  if (parts[0] !== 'missed_opp') return undefined
  const day = Number(parts[1])
  return Number.isFinite(day) ? day : undefined
}

export const gameStore = new GameStore()
export { DAY_MINUTES, formatDuration }
