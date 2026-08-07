import type { SimulationModule, SimulationHook } from '../../core/module'
import type { SimContext } from '../../core/context'

import { buildNpcReport } from './npcReport'
import {
  NPCS_MODULE_ID,
  NpcModuleStateSchema,
  pruneNpcRecords,
  writeNpcSlice,
} from './npcState'
import { observeAvailability, observeDealings } from './dealings'
import { reviewPromotions } from './importance'
import { runNpcActors } from './npcActors'
import './npcEvents'

// Expansion Phase 8 §8.3 — the notable-NPC module.
//
// There has never been one. Nine NPCs have been seeded at day zero since
// Phase 44 and referenced by issue-seed text ever since, and nothing has ever
// written to one — `lastSeenDay` is declared on the record and set by
// nobody. They appear in the game's prose without having done anything in it.
//
// The day runs in three steps, at two beats:
//
//   `startDay` 1. `observeAvailability` — who is about today by their own
//                 schedule, and `lastSeenDay` finally written from it. In the
//                 morning because the player acts on it during the day.
//   `closing`  2. `observeDealings` — what the house actually had to do with
//                 these people today.
//              3. `reviewPromotions` — re-score importance from what is live
//                 in regulation, finance, factions and cultures, then
//                 promote and demote against §8.3's two thresholds.
//   `endDay`   4. `runNpcActors` — the promoted few decide, announce, and
//                 act. Plus pruning (§5.11).
//
// Promotion happens BEFORE the actor pass on the same day, so somebody who
// became important this evening starts thinking about it tonight rather than
// waiting a day; and the actor pass runs at `endDay` because an NPC reacts
// to how the evening went rather than setting it up.

export { NPCS_MODULE_ID }

const closingHook: SimulationHook = (ctx: SimContext): void => {
  observeDealings(ctx)
  reviewPromotions(ctx)
}

const endDayHook: SimulationHook = (ctx: SimContext): void => {
  runNpcActors(ctx)
  const today = ctx.state.calendar.totalDaysElapsed
  writeNpcSlice(ctx, (current) => pruneNpcRecords(current, today), 'prune')
}

const startDayHook: SimulationHook = (ctx: SimContext): void => {
  // Today's moves are a per-day list, cleared at the START of the day so the
  // report — which runs after `endDay` — still sees what these people did.
  writeNpcSlice(ctx, (current) => ({ ...current, movesToday: [] }), 'new_day')
  // Who is about is a MORNING fact, and it has to be one: `cultivate_npc`
  // offers exactly these people, and owner actions run long before `closing`.
  observeAvailability(ctx)
}

export const npcModule: SimulationModule = {
  id: NPCS_MODULE_ID,
  version: '0.1.0',
  hooks: {
    startDay: [startDayHook],
    closing: [closingHook],
    endDay: [endDayHook],
  },
  buildReport: buildNpcReport,
  stateSchema: NpcModuleStateSchema,
}
