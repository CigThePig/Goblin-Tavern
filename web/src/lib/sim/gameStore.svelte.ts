// Goblin Tavern — game store
//
// SOLE caller of `simulateDay` in the web layer. Every screen reads
// from `gameStore.state`; mutation flows back through `runDay(input)`.
// Keeping the engine call concentrated here is the boundary that makes
// the rest of the UI reason-about-able.
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

import { simulateDay } from '../../../../src/sim/core/engine'
import { createInitialTavernState } from '../../../../src/sim/state/defaults'
import type { DifficultyConfig } from '../../../../src/sim/state/difficulty'
import { FULL_PIPELINE } from '../../../../src/sim/testing/simRunner'
import type { TavernState } from '../../../../src/sim/state/TavernState'
import type { CalendarState } from '../../../../src/sim/modules/calendar/types'
import type { SimInput } from '../../../../src/sim/core/context'
import type { SimResult } from '../../../../src/sim/core/result'
import type { IssueSeed } from '../../../../src/sim/modules/issues/issueSeedTypes'
import {
  ACTION_POINT_BUDGET,
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
  type PendingChoice,
} from './daySession'
import type {
  LatestResultLite,
  PersistedSession,
  Route,
  SaveResult,
} from './persistence'

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

  // Phase 96 — Last selected top-level route. The App restores this on
  // boot so a player who closed the app while reading the Tavern panel
  // returns there instead of being yanked back to Day.
  route: Route = $state('day')

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
   * Phase 97 — Per-day dismissed missed-opportunity ids. Used by the
   * daily-report projection to filter the "What you could have done"
   * block. A new Set reference is assigned on every change so `$state`
   * triggers downstream `$derived`s.
   */
  dismissedMissedOpportunityIds: Set<string> = $state(new Set())

  /**
   * Run one simulated day. Bundles the queued picks, sticky staff
   * priorities, and any per-day response intents into a single
   * `simulateDay` call. Picks are reset after the engine call; staff
   * priorities persist. The day-session flags reset to a fresh
   * morning — engine always advances the calendar, so the player
   * lands on a new day.
   */
  runDay(extra: Partial<Omit<SimInput, 'seed'>> = {}): SimResult {
    const seed = `${this.seedString}-d${this.state.calendar.day}`
    const queuedActions = picksToInputs(this.picks)
    const fullInput: SimInput = {
      seed,
      // `extra` wins so DayScreen can still override per-call for
      // testing or special flows.
      ownerActions: extra.ownerActions ?? queuedActions,
      staffPriorities: extra.staffPriorities ?? { ...this.staffPriorities },
      ...(extra.responseIntents ? { responseIntents: extra.responseIntents } : {}),
    }
    this.previousCalendar = { ...this.state.calendar, tags: [...this.state.calendar.tags] }
    const result = simulateDay(this.state, fullInput, FULL_PIPELINE)
    this.state = result.state
    this.latestResult = result
    // Per-day picks reset; staff priorities persist by design.
    this.picks = []
    // Day-session flags reset for the new day. The caller (DayScreen)
    // sets `beat = 'report'` after this call to surface the daily
    // report; subsequent beats land naturally on the new day.
    this.pendingBySeedId = {}
    this.serviceComplete = false
    this.closingComplete = false
    // Phase 97 — Prune stale dismissal entries so the set stays bounded.
    this.pruneMissedOpportunityDismissals()
    return result
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
    this.route = 'day'
    this.savedSnapshotJustLoaded = false
    this.lastSavedAt = undefined
    this.hydrationError = undefined
    this.saveError = undefined
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
    this.route = save.route
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
      },
      route: this.route,
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
   * this so the queue cannot overflow the daily action-point budget or
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
    const pointsLeft = ACTION_POINT_BUDGET - this.actionPointsQueued
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

  /** Total action points across queued picks. Sticky chip reads this. */
  get actionPointsQueued(): number {
    return this.picks.reduce((n, p) => n + p.actionPointCost, 0)
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

  setServiceComplete(value: boolean): void {
    this.serviceComplete = value
  }

  setClosingComplete(value: boolean): void {
    this.closingComplete = value
  }

  setRoute(r: Route): void {
    this.route = r
  }

  /** Dismiss the welcome-back pill without changing the beat. */
  dismissWelcomeBack(): void {
    this.savedSnapshotJustLoaded = false
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
export { ACTION_POINT_BUDGET }
