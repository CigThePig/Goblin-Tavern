import { z } from 'zod'

import type { SimulationModule, SimulationHook } from '../../core/module'
import type { SimContext } from '../../core/context'

import { buildFactionReport } from './factionReport'

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

const SOURCE = 'factions'

export const FACTIONS_MODULE_ID = SOURCE

const FactionModuleStateSchema = z.object({}).passthrough().optional()

const VIOLENCE_THRESHOLD = 60
const DEBT_THRESHOLD = 60
const MINERS_SAT_THRESHOLD = 60

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
