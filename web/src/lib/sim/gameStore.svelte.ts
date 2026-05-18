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

import { simulateDay } from '../../../../src/sim/core/engine'
import { createInitialTavernState } from '../../../../src/sim/state/defaults'
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
  type PickedAction,
} from './actionBuilder'

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

  /**
   * Run one simulated day. Bundles the queued picks, sticky staff
   * priorities, and any per-day response intents into a single
   * `simulateDay` call. Picks are reset after the engine call; staff
   * priorities persist.
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
    return result
  }

  /**
   * Fresh save. The Crooked Keg, day zero, dirty, broke, goblin-authentic
   * (see game-loop-and-ux.md §2.1).
   */
  reset(seed?: string): void {
    if (seed) this.seedString = seed
    this.state = createInitialTavernState()
    this.latestResult = undefined
    this.previousCalendar = undefined
    this.picks = []
    this.staffPriorities = {}
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
}

export const gameStore = new GameStore()
export { ACTION_POINT_BUDGET }
