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
import type { SimInput } from '../../../../src/sim/core/context'
import type { SimResult } from '../../../../src/sim/core/result'
import type { IssueSeed } from '../../../../src/sim/modules/issues/issueSeedTypes'

class GameStore {
  state: TavernState = $state(createInitialTavernState())
  latestResult: SimResult | undefined = $state(undefined)
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
  }

  /** Issue seeds the sim produced on the most recent day, valid only. */
  get todaysSeeds(): IssueSeed[] {
    const slot = this.state.modules['issueSeeds'] as
      | { seedsToday?: unknown[] }
      | undefined
    const raw = slot?.seedsToday ?? []
    return (raw as IssueSeed[]).filter((s) => s.validation?.valid === true)
  }
}

export const gameStore = new GameStore()
