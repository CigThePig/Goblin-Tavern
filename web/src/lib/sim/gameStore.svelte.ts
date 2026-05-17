// Goblin Tavern — game store
//
// SOLE caller of `simulateDay` in the web layer. Every screen reads
// from `gameStore.state`; mutation flows back through `runDay(input)`.
// Keeping the engine call concentrated here is the boundary that makes
// the rest of the UI reason-about-able.

import { simulateDay } from '../../../../src/sim/core/engine'
import { createInitialTavernState } from '../../../../src/sim/state/defaults'
import { FULL_PIPELINE } from '../../../../src/sim/testing/simRunner'
import type { TavernState } from '../../../../src/sim/state/TavernState'
import type { CalendarState } from '../../../../src/sim/modules/calendar/types'
import type { SimInput } from '../../../../src/sim/core/context'
import type { SimResult } from '../../../../src/sim/core/result'
import type { IssueSeed } from '../../../../src/sim/modules/issues/issueSeedTypes'

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

  /**
   * Run one simulated day. The card layer will pass `responseIntents`
   * and `ownerActions`; for the foundation pass, both are optional and
   * the player effectively taps through with no input.
   */
  runDay(input: Partial<Omit<SimInput, 'seed'>> = {}): SimResult {
    const seed = `${this.seedString}-d${this.state.calendar.day}`
    const fullInput: SimInput = {
      seed,
      ...(input.ownerActions ? { ownerActions: input.ownerActions } : {}),
      ...(input.staffPriorities ? { staffPriorities: input.staffPriorities } : {}),
      ...(input.responseIntents ? { responseIntents: input.responseIntents } : {}),
    }
    // Snapshot the calendar BEFORE simulateDay advances it so the
    // post-day report can render an accurate "Day N closed" header.
    this.previousCalendar = { ...this.state.calendar, tags: [...this.state.calendar.tags] }
    const result = simulateDay(this.state, fullInput, FULL_PIPELINE)
    this.state = result.state
    this.latestResult = result
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
  }

  /** Issue seeds the sim produced on the most recent day, valid only. */
  get todaysSeeds(): IssueSeed[] {
    const slot = this.state.modules['issueSeeds'] as
      | { seedsToday?: unknown[] }
      | undefined
    const raw = slot?.seedsToday ?? []
    return (raw as IssueSeed[]).filter((s) => s.validation?.valid === true)
  }

  /** Seeds filtered to a single timing slot (morning_prep / during_service / closing / end_week / end_month). */
  seedsForTiming(timing: IssueSeed['timing']): IssueSeed[] {
    return this.todaysSeeds.filter((s) => s.timing === timing)
  }
}

export const gameStore = new GameStore()
