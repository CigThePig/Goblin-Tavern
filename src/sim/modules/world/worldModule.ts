import { z } from 'zod'

import type { SimulationHook, SimulationModule } from '../../core/module'
import type { SimContext } from '../../core/context'

// Phase 27 §27.4 — World module skeleton.
//
// The world module currently does:
//   1. Reserves the `state.modules.world` slot via an empty optional
//      schema so unknown-key warnings stay quiet when later phases add
//      a runtime slice here.
//   2. Reserves Phase 27's new world phase hooks
//      (`identityGeneration`, `localEventUpdate`, `rumourUpdate`) with
//      no-op slots so the pipeline order is observable in tests.
//   3. Phase 83 / ISSUE-043 — prunes `state.world.socialRumours` on
//      `endMonth`, mirroring the history pruning policy in
//      `historyModule.ts`. Long runs that emitted rumours weekly were
//      growing the rumour map linearly with sim age.
//
// Cross-reference validation (Phase 26 §26.4) already runs through
// `ctx.validate()` during the `validate` phase — wiring a redundant
// module-level `validate` here would double-count those issues.

const SOURCE = 'world'

export const WORLD_MODULE_ID = SOURCE

const WorldModuleStateSchema = z.object({}).passthrough().optional()

// Phase 83 / ISSUE-043 — rumour pruning policy.
//
// `RUMOUR_MAX_ENTRIES` is the hard cap. Stale rumours
// (`lastSpreadDay` older than `RUMOUR_STALE_DAYS` AND
// `strength < RUMOUR_STALE_STRENGTH`) drop first. If the map is still
// over the cap, the lowest-strength survivors drop until it isn't.
// Magnitudes mirror the history pruning intent: 90-day window, low-
// strength floor, hard cap to keep walks bounded.
export const RUMOUR_MAX_ENTRIES = 60
export const RUMOUR_STALE_DAYS = 90
export const RUMOUR_STALE_STRENGTH = 10

const noop = (_ctx: SimContext): void => {
  // Phase 27 phases exist before they have content. Domain modules
  // (cultures, suppliers, etc.) attach the actual behaviour later.
}

const pruneRumoursHook: SimulationHook = (ctx: SimContext): void => {
  const rumours = ctx.state.world.socialRumours
  const ids = Object.keys(rumours)
  if (ids.length === 0) return
  const today = ctx.state.calendar.totalDaysElapsed
  const ageCutoff = today - RUMOUR_STALE_DAYS

  const dropped: string[] = []
  // 1. Drop stale + low-strength entries.
  for (const id of ids) {
    const r = rumours[id]!
    if (r.lastSpreadDay <= ageCutoff && r.strength < RUMOUR_STALE_STRENGTH) {
      delete rumours[id]
      dropped.push(id)
    }
  }

  // 2. If still over cap, drop lowest-strength survivors.
  let remainingIds = Object.keys(rumours)
  if (remainingIds.length > RUMOUR_MAX_ENTRIES) {
    const survivors = remainingIds
      .map((id) => ({ id, strength: rumours[id]!.strength }))
      .sort((a, b) => a.strength - b.strength)
    const overage = remainingIds.length - RUMOUR_MAX_ENTRIES
    for (let i = 0; i < overage; i += 1) {
      const victim = survivors[i]!.id
      delete rumours[victim]
      dropped.push(victim)
    }
    remainingIds = Object.keys(rumours)
  }

  if (dropped.length > 0) {
    ctx.addCause({
      source: `${SOURCE}.rumour_prune`,
      sourceType: 'system',
      target: 'world.socialRumours',
      targetType: 'global',
      amount: -dropped.length,
      direction: 'decrease',
      readable: `Pruned ${dropped.length} stale/oversaturated social rumour${
        dropped.length === 1 ? '' : 's'
      }.`,
      tags: ['world', 'rumour', 'prune'],
      relatedSystems: ['world'],
    })
  }
}

export const worldModule: SimulationModule = {
  id: WORLD_MODULE_ID,
  version: '0.2.0',
  hooks: {
    identityGeneration: [noop],
    localEventUpdate: [noop],
    rumourUpdate: [noop],
    endMonth: [pruneRumoursHook],
  },
  stateSchema: WorldModuleStateSchema,
}
