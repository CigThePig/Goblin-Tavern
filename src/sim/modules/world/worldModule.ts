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
//      (`identityGeneration`, `localEventUpdate`) with no-op slots so the
//      pipeline order is observable in tests.
//   3. Phase 83 / ISSUE-043 — prunes `state.world.socialRumours` on
//      `endMonth`, mirroring the history pruning policy in
//      `historyModule.ts`. Long runs that emitted rumours weekly were
//      growing the rumour map linearly with sim age.
//   4. Phase 206 / audit Wave 7 — decays every social rumour daily on
//      `rumourUpdate`, so unfed talk moves on instead of accumulating
//      until `rumour_pressure` pins at 100.
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

// Phase 206 / audit Wave 7 — daily rumour decay.
//
// Until Wave 7 nothing reduced a rumour's strength between the weekly
// community pass (which only starts or *raises* rumours — refresh takes
// `max(existing, new)`) and the month-end prune (which only drops stale
// low-strength entries). Talk that nobody feeds should move on; instead
// every run accumulated rumours until `rumour_pressure` pinned at 100 —
// on the balance sweep it ended AND peaked at 100 on all 360 cells, on
// every strategy and difficulty, which means the meter carried no signal
// at all. (Total live strength on a managed 28-day route: 1,002, against
// a meter that saturates at ~333.)
//
// The decay is proportional so strong rumours outlive weak ones: at 15%
// a day, a fresh strength-40 rumour fades out in about ten days and a
// strength-100 scandal hangs on for three weeks, while anything the
// weekly pass keeps re-confirming stays alive indefinitely. Entries that
// fall below `RUMOUR_FADE_FLOOR` are removed outright — a rumour nobody
// repeats stops existing rather than idling at strength 2.
export const RUMOUR_DAILY_RETENTION = 0.85
export const RUMOUR_FADE_FLOOR = 5

const noop = (_ctx: SimContext): void => {
  // Phase 27 phases exist before they have content. Domain modules
  // (cultures, suppliers, etc.) attach the actual behaviour later.
}

// Phase 206 / audit Wave 7 — fade every social rumour a little each day.
// Runs on the `rumourUpdate` phase (reserved by Phase 27 for exactly this
// kind of work, a no-op until now), before `forecastTraffic`, so the
// pressure pass later in the day reads post-decay strengths.
const decayRumoursHook: SimulationHook = (ctx: SimContext): void => {
  const rumours = ctx.state.world.socialRumours
  const faded: string[] = []
  for (const [id, rumour] of Object.entries(rumours)) {
    const next =
      Math.round(rumour.strength * RUMOUR_DAILY_RETENTION * 100) / 100
    if (next < RUMOUR_FADE_FLOOR) {
      delete rumours[id]
      faded.push(id)
      continue
    }
    rumour.strength = next
  }
  if (faded.length > 0) {
    ctx.addCause({
      source: `${SOURCE}.rumour_decay`,
      sourceType: 'system',
      target: 'world.socialRumours',
      targetType: 'global',
      amount: -faded.length,
      direction: 'decrease',
      readable: `${faded.length} rumour${
        faded.length === 1 ? '' : 's'
      } faded away — nobody is repeating ${faded.length === 1 ? 'it' : 'them'} any more.`,
      tags: ['world', 'rumour', 'decay'],
      relatedSystems: ['world'],
    })
  }
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
  version: '0.3.0',
  hooks: {
    identityGeneration: [noop],
    localEventUpdate: [noop],
    rumourUpdate: [decayRumoursHook],
    endMonth: [pruneRumoursHook],
  },
  stateSchema: WorldModuleStateSchema,
}
