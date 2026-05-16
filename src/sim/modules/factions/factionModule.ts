import { z } from 'zod'

import type { SimulationModule, SimulationHook } from '../../core/module'
import type { SimContext } from '../../core/context'

import { buildFactionReport } from './factionReport'
import {
  activeArcsByTypeOrTag,
  hasCalendarTag,
  ownerProjects,
} from '../pressures/calculators/expandedHelpers'

// Phase 27 §27.4 / Phase 30 §30.9 — Faction module.
//
// Phase 27 reserved the seam; Phase 30 lands the relationship-drift
// pass that links existing pressure/satisfaction/debt signals to the
// faction layer. The drift is intentionally light:
//
//   - high `violence` pressure pulls Town Watch relationship down,
//   - high `debt` pressure pulls Brewers Guild relationship down,
//   - high miner satisfaction on payday pulls the Miners' Union up,
//   - high supplier debt pulls the Market Caravan Circle down.
//
// Phase 38 will expand the pressure web; Phase 30 only wires the
// minimal hooks so the system is observable and testable.
//
// Phase 52 / ISSUE-012 — Two factions (`local_shrine`,
// `scrap_collectors`) had no module-driven drift. Phase 52 adds
// trigger pairs that read existing signals (festival calendar tags +
// festival arcs/projects, maintenance/pests pressure, recent cleanup
// memories) so all six original factions get day-over-day movement.

const SOURCE = 'factions'

export const FACTIONS_MODULE_ID = SOURCE

const FactionModuleStateSchema = z.object({}).passthrough().optional()

const VIOLENCE_THRESHOLD = 60
const DEBT_THRESHOLD = 60
const MINERS_SAT_THRESHOLD = 60
// Phase 52 / ISSUE-012 — Maintenance / cleanliness thresholds for the
// scrap_collectors drift pair. The higher gate triggers neglect (drop);
// the lower gate, combined with a recent cleanup memory, triggers
// recognition (rise). Pairing prevents the trigger from oscillating
// on borderline days.
const MAINTENANCE_THRESHOLD = 60
const MAINTENANCE_RELIEF_THRESHOLD = 40

function shiftFaction(
  ctx: SimContext,
  id: string,
  delta: number,
  reason: string,
  tags: string[],
): void {
  const faction = ctx.getFaction(id)
  if (!faction) return
  const next = Math.max(0, Math.min(100, faction.relationship + delta))
  if (next === faction.relationship) return
  ctx.modifyFaction(
    id,
    { relationship: next },
    {
      source: `${SOURCE}.${reason}`,
      sourceType: 'faction',
      target: id,
      targetType: 'faction',
      amount: delta,
      readable: `${faction.label} relationship ${faction.relationship} → ${next} (${reason}).`,
      tags: ['faction', 'relationship', ...tags],
    },
  )
}

const factionUpdateHook: SimulationHook = (ctx: SimContext): void => {
  const violence = ctx.state.pressures['violence']?.value ?? 0
  const debt = ctx.state.pressures['debt']?.value ?? 0
  const stockShortage = ctx.state.pressures['stock_shortage']?.value ?? 0

  if (violence >= VIOLENCE_THRESHOLD) {
    shiftFaction(ctx, 'town_watch', -1, 'violence_high', ['violence'])
  }
  if (debt >= DEBT_THRESHOLD) {
    shiftFaction(ctx, 'brewers_guild', -1, 'debt_high', ['debt'])
  }
  if (stockShortage >= DEBT_THRESHOLD) {
    shiftFaction(ctx, 'market_caravan_circle', -1, 'supplier_strain', [
      'supplier_strain',
    ])
  }

  // Miners' Union rises when miners are happy, especially on payday.
  const miners = ctx.state.customerGroups['miners']
  if (miners) {
    const onPayday = ctx.getDayType() === 'payday'
    if (miners.satisfaction >= MINERS_SAT_THRESHOLD && onPayday) {
      shiftFaction(ctx, 'miners_union', 1, 'miners_payday_satisfied', [
        'payday',
        'miners',
      ])
    }
  }

  // Phase 52 / ISSUE-012 — `local_shrine` reacts to festival days.
  // When the calendar carries a festival window, the shrine watches
  // for engagement: an active festival arc OR an owner project
  // tagged `festival`/`festival_prep` reads as participation; the
  // empty case reads as disregard. Mutually exclusive — at most one
  // shift per day.
  const festivalActive =
    hasCalendarTag(ctx.state, 'festival_window') ||
    hasCalendarTag(ctx.state, 'mushroom_festival')
  if (festivalActive) {
    const festivalArcs = activeArcsByTypeOrTag(ctx.state, {
      types: ['festival'],
      tags: ['festival'],
    })
    let engaged = festivalArcs.length > 0
    if (!engaged) {
      for (const project of Object.values(ownerProjects(ctx.state))) {
        if (
          project.status === 'active' &&
          (project.tags.includes('festival') ||
            project.tags.includes('festival_prep'))
        ) {
          engaged = true
          break
        }
      }
    }
    if (engaged) {
      shiftFaction(ctx, 'local_shrine', 1, 'festival_engagement', [
        'festival',
        'ritual',
      ])
    } else {
      shiftFaction(ctx, 'local_shrine', -1, 'festival_disregard', [
        'festival',
        'ritual',
      ])
    }
  }

  // Phase 52 / ISSUE-012 — `scrap_collectors` reacts to maintenance
  // and pest signals. High pressure on either axis reads as the
  // tavern letting waste pile up; recent cleanup work with low
  // pressure reads as the haulers' value being recognised.
  const maintenancePressure =
    ctx.state.pressures['maintenance']?.value ?? 0
  const pestsPressure = ctx.state.pressures['pests']?.value ?? 0
  if (
    maintenancePressure >= MAINTENANCE_THRESHOLD ||
    pestsPressure >= MAINTENANCE_THRESHOLD
  ) {
    shiftFaction(ctx, 'scrap_collectors', -1, 'waste_buildup', [
      'maintenance',
      'pests',
    ])
  } else if (
    maintenancePressure < MAINTENANCE_RELIEF_THRESHOLD &&
    (ctx.hasMemory('area_cleaned_recently') ||
      ctx.hasMemory('cellar_fumigated_recently'))
  ) {
    shiftFaction(ctx, 'scrap_collectors', 1, 'recent_cleanup_credit', [
      'maintenance',
      'cleanliness',
    ])
  }
}

export const factionModule: SimulationModule = {
  id: FACTIONS_MODULE_ID,
  version: '0.2.0',
  hooks: {
    factionUpdate: [factionUpdateHook],
  },
  buildReport: buildFactionReport,
  stateSchema: FactionModuleStateSchema,
}
