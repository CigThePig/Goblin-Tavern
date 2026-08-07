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
// Expansion Phase 8 §8.4 — THE RUMOUR LIFECYCLE HAS MOVED to
// `modules/rumours/`. The world module owned decay and pruning only because
// nothing else did; `world.socialRumours` now has start, spread, contradict,
// correct, decay and prune, which is a domain rather than a chore, and §5.4
// wants one owner per transition. The constants below are re-exported from
// their new home so existing importers keep working.
//
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
// Expansion Phase 8 §8.4 — re-exported from their new owner so every
// existing importer keeps working. The values are unchanged.
export {
  RUMOUR_MAX_ENTRIES,
  RUMOUR_STALE_DAYS,
  RUMOUR_STALE_STRENGTH,
} from '../rumours/rumourModule'

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
export {
  RUMOUR_DAILY_RETENTION,
  RUMOUR_SPREADING_RETENTION,
  RUMOUR_FADE_FLOOR,
} from '../rumours/belief'

const noop = (_ctx: SimContext): void => {
  // Phase 27 phases exist before they have content. Domain modules
  // (cultures, suppliers, etc.) attach the actual behaviour later.
}

export const worldModule: SimulationModule = {
  id: WORLD_MODULE_ID,
  version: '0.3.0',
  hooks: {
    identityGeneration: [noop],
    localEventUpdate: [noop],
    rumourUpdate: [noop],
    endMonth: [noop],
  },
  stateSchema: WorldModuleStateSchema,
}
