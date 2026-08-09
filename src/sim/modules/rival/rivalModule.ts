import type { SimulationHook, SimulationModule } from '../../core/module'
import type { SimContext } from '../../core/context'

import { buildRivalReport } from './rivalReport'
import {
  RIVAL_MODULE_ID,
  RivalModuleStateSchema,
  getRivalModuleState,
  pruneRivalRecords,
  writeRivalSlice,
} from './rivalState'
import { runRivalActor } from './rivalActors'
import './rivalEvents'

// Expansion Phase 9 §9.1 — the rival module.
//
// The day runs in three steps:
//
//   1. clear the day's move list, so the report (which runs after `endDay`)
//      still sees what the rival did today;
//   2. `runRivalActor` — mirror faction backing, take the week's money,
//      decay courting that nobody is pushing, then decide / announce / act;
//   3. pruning at `endDay` — §5.11 for setbacks, courting and move history.
//
// Step 2 runs at `localEventUpdate`, which sits AFTER `factionUpdate` and
// `rumourUpdate` (so backing given and talk moved this morning are on the
// books) and BEFORE `forecastTraffic` (so a crowd courted today is felt in
// tonight's turnout). Nothing about the rival needs the service result, so
// nothing about it runs late.

export { RIVAL_MODULE_ID }

const rivalUpdateHook: SimulationHook = (ctx: SimContext): void => {
  writeRivalSlice(ctx, (current) => ({ ...current, movesToday: [] }), 'new_day')
  runRivalActor(ctx)
}

const rivalEndDayHook: SimulationHook = (ctx: SimContext): void => {
  const today = ctx.state.calendar.totalDaysElapsed
  const slice = getRivalModuleState(ctx.state)
  const pruned = pruneRivalRecords(slice, today)
  if (JSON.stringify(pruned) === JSON.stringify(slice)) return
  writeRivalSlice(ctx, () => pruned, 'prune')
}

export const rivalModule: SimulationModule = {
  id: RIVAL_MODULE_ID,
  version: '0.1.0',
  // The head-to-head reads faction backing, so the faction pass must have
  // run. Both hooks are in phases the factions module also participates in,
  // so the declared dependency is the thing that guarantees the order.
  dependsOn: ['factions'],
  hooks: {
    localEventUpdate: [rivalUpdateHook],
    endDay: [rivalEndDayHook],
  },
  buildReport: buildRivalReport,
  stateSchema: RivalModuleStateSchema,
}
