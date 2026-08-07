import type { SimulationModule, SimulationHook } from '../../core/module'
import type { SimContext } from '../../core/context'

import { buildFactionReport } from './factionReport'
import {
  FACTIONS_MODULE_ID,
  FactionModuleStateSchema,
  getFactionModuleState,
  pruneFactionRecords,
  writeFactionSlice,
} from './factionState'
import { observeFactionTreatment } from './factionEvidence'
import { summariseStanding } from './standing'
import { runFactionActors } from './factionActors'
import { syncFactionFlags } from './stances'
import './factionEvents'

// Phase 27 §27.4 / Phase 30 §30.9 — Faction module.
//
// Expansion Phase 8 §8.1 rewrites what this module DOES. Phase 30 and
// Phase 52 gave it a drift pass: read four pressures, compare each to a
// threshold, move a relationship meter by one. §8.1 names that as the thing
// to replace — "replace pure threshold +1/-1 drift as the main behavior…
// moves must come from faction decisions".
//
// The day now runs in four steps, and the order is the argument:
//
//   1. `observeFactionTreatment` — the same signals Phase 30/52 read, but
//      recorded as DATED, READABLE EVIDENCE in each faction's standing
//      ledger rather than applied to a meter.
//   2. `summariseStanding` — the visible `relationship` meter is re-derived
//      from that ledger, moving at most two points a day. §8.1 keeps
//      relationships as a summary of history; this is that summary, and
//      every point of it can be traced to a named entry.
//   3. `runFactionActors` — factions decide, announce, and act. This is the
//      behaviour: demands, support, boycotts, inspections, sponsorships,
//      supply squeezes, protection, rival backing.
//   4. pruning, at `endDay` — §5.11 for four persistent collections.
//
// Step 3 runs at `factionUpdate`, which sits before `forecastTraffic`, so a
// boycott called this morning is felt in today's turnout rather than
// tomorrow's.

export { FACTIONS_MODULE_ID }

const factionUpdateHook: SimulationHook = (ctx: SimContext): void => {
  // Today's moves are a per-day list. Clearing it here rather than at
  // `endDay` means the report — which runs after `endDay` — still sees what
  // the factions did today.
  writeFactionSlice(ctx, (current) => ({ ...current, movesToday: [] }), 'new_day')

  observeFactionTreatment(ctx)
  summariseStanding(ctx)
  runFactionActors(ctx)

  // Stances that ran out overnight must stop being read by the domains that
  // read them, and the mirrored flags must stop advertising them.
  for (const factionId of Object.keys(ctx.state.world.factions).sort()) {
    syncFactionFlags(ctx, factionId)
  }
}

const factionEndDayHook: SimulationHook = (ctx: SimContext): void => {
  const today = ctx.state.calendar.totalDaysElapsed
  const slice = getFactionModuleState(ctx.state)
  const pruned = pruneFactionRecords(slice, today)
  if (
    Object.keys(pruned.stances).length === Object.keys(slice.stances).length &&
    Object.keys(pruned.demands).length === Object.keys(slice.demands).length &&
    Object.keys(pruned.favours).length === Object.keys(slice.favours).length &&
    pruned.moveHistory.length === slice.moveHistory.length
  ) {
    return
  }
  writeFactionSlice(ctx, () => pruned, 'prune')
}

export const factionModule: SimulationModule = {
  id: FACTIONS_MODULE_ID,
  version: '0.3.0',
  hooks: {
    factionUpdate: [factionUpdateHook],
    endDay: [factionEndDayHook],
  },
  buildReport: buildFactionReport,
  stateSchema: FactionModuleStateSchema,
}
