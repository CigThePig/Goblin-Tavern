import type { SimulationModule, SimulationHook } from '../../core/module'
import type { SimContext } from '../../core/context'
import { addGroupedCause } from '../../contracts/causality/groupedCause'

import { buildRumourReport } from './rumourReport'
import {
  RUMOURS_MODULE_ID,
  RumourModuleStateSchema,
  bumpRumourTotal,
  listRumours,
  writeRumourSlice,
} from './rumourState'
import { seedRumourOrigins } from './origins'
import { propagateRumours, resetChannelBudgets } from './propagation'
import { applyContradictions, decayRumours, reinforceRumours } from './belief'
import { reviewEscalations } from './rumourEvents'
import './rumourEvents'

// Expansion Phase 8 §8.4 — the rumour network's own module.
//
// It takes the rumour lifecycle off `worldModule`, which had it only
// because nothing else did. §5.4 wants one domain per state transition, and
// `world.socialRumours` now has four of them — start, spread, contradict,
// correct — plus decay and pruning. That is a domain.
//
// The day runs in one beat, at `rumourUpdate`, which Phase 27 reserved for
// exactly this and which sits before `forecastTraffic` — so a rumour that
// spread this morning is believed by the time turnout is projected.
//
//   1. `resetChannelBudgets` (first day of the week) — everybody gets their
//      voice back.
//   2. `seedRumourOrigins` — every ownerless rumour is adopted by whoever
//      most plausibly started it. Without this the network is inert: a
//      channel may only repeat what it has heard or what it started, and the
//      weekly pass mints rumours belonging to nobody.
//   3. `propagateRumours` — source → channel → audience, bounded three ways.
//   4. `reinforceRumours` — talk heard from two directions hardens.
//   5. `applyContradictions` — two stories standing against each other wear
//      each other down.
//   6. `decayRumours` — everything nobody repeated fades, WITH a grouped
//      cause naming every rumour it covers. That is the rumour half of
//      `OBL-08`.
//   7. `reviewEscalations` — talk nobody has answered puts itself on the
//      calendar, so the escalation family is reachable without the player
//      having happened to be offered a response about it.
//
// Pruning stays monthly and moves here with the rest.

export { RUMOURS_MODULE_ID }

// The Phase 83 pruning policy, moved rather than retuned. The numbers are
// unchanged — deciding the world should hold fewer rumours is a balance
// judgement of its own, and §8.4 is about how they travel, not how many the
// world remembers.
/** Rumours kept at once. Above this the quietest are dropped. */
export const RUMOUR_MAX_ENTRIES = 60
/** Days of silence before a weak rumour is prunable. */
export const RUMOUR_STALE_DAYS = 90
/** …and how weak it has to be for that to apply. */
export const RUMOUR_STALE_STRENGTH = 10

const rumourUpdateHook: SimulationHook = (ctx: SimContext): void => {
  writeRumourSlice(ctx, (current) => ({ ...current, spreadToday: [] }), 'new_day')
  if (ctx.state.calendar.dayOfWeek === 1) resetChannelBudgets(ctx)

  seedRumourOrigins(ctx)
  propagateRumours(ctx)
  reinforceRumours(ctx)
  applyContradictions(ctx)
  decayRumours(ctx)
  reviewEscalations(ctx)
}

/**
 * Monthly pruning.
 *
 * Every deletion here is a MATERIAL one, so the whole sweep is covered by a
 * grouped cause naming the rumours it dropped — the same standard the daily
 * fade is held to, for the same reason.
 */
const pruneHook: SimulationHook = (ctx: SimContext): void => {
  const today = ctx.state.calendar.totalDaysElapsed
  const rumours = listRumours(ctx.state)
  if (rumours.length === 0) return

  const ageCutoff = today - RUMOUR_STALE_DAYS
  const dropped: string[] = []

  for (const rumour of rumours) {
    const stale =
      rumour.lastSpreadDay <= ageCutoff && rumour.strength < RUMOUR_STALE_STRENGTH
    const settled =
      rumour.correctedOnDay !== undefined && today - rumour.correctedOnDay > 14
    if (!stale && !settled) continue
    dropped.push(rumour.id)
    ctx.removeSocialRumour(rumour.id, {
      source: `${RUMOURS_MODULE_ID}.prune`,
      sourceType: 'rumour',
      target: rumour.id,
      targetType: 'rumour',
      amount: -rumour.strength,
      direction: 'decrease',
      readable: settled
        ? `"${rumour.label}" was settled a fortnight ago and is forgotten.`
        : `"${rumour.label}" has not been repeated in three weeks and is forgotten.`,
      tags: ['rumour', 'prune', rumour.id],
      relatedActors: [{ kind: 'rumour', id: rumour.id }],
      relatedSystems: ['rumours'],
    })
  }

  // Still over the cap: the quietest go.
  const remaining = listRumours(ctx.state)
  if (remaining.length > RUMOUR_MAX_ENTRIES) {
    const victims = [...remaining]
      .sort((a, b) => a.strength - b.strength || a.id.localeCompare(b.id))
      .slice(0, remaining.length - RUMOUR_MAX_ENTRIES)
    for (const victim of victims) {
      dropped.push(victim.id)
      ctx.removeSocialRumour(victim.id, {
        source: `${RUMOURS_MODULE_ID}.prune_overflow`,
        sourceType: 'rumour',
        target: victim.id,
        targetType: 'rumour',
        amount: -victim.strength,
        direction: 'decrease',
        readable: `"${victim.label}" was drowned out by louder talk and is forgotten.`,
        tags: ['rumour', 'prune', 'overflow', victim.id],
        relatedActors: [{ kind: 'rumour', id: victim.id }],
        relatedSystems: ['rumours'],
      })
    }
  }

  if (dropped.length === 0) return
  bumpRumourTotal(ctx, 'pruned', dropped.length)
  addGroupedCause(ctx, {
    source: `${RUMOURS_MODULE_ID}.prune`,
    sourceType: 'rumour',
    targetKind: 'rumour',
    targetType: 'rumour',
    targetIds: dropped,
    totalAmount: -dropped.length,
    direction: 'decrease',
    readable: `${dropped.length} rumour${dropped.length === 1 ? '' : 's'} passed out of memory.`,
    tags: ['rumour', 'prune'],
    relatedSystems: ['rumours'],
  })
}

export const rumourModule: SimulationModule = {
  id: RUMOURS_MODULE_ID,
  version: '0.1.0',
  hooks: {
    rumourUpdate: [rumourUpdateHook],
    endMonth: [pruneHook],
  },
  buildReport: buildRumourReport,
  stateSchema: RumourModuleStateSchema,
}
