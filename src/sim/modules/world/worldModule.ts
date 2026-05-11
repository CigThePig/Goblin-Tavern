import { z } from 'zod'

import type { SimulationModule } from '../../core/module'
import type { SimContext } from '../../core/context'

// Phase 27 §27.4 — World module skeleton.
//
// The world module currently does two small things:
//   1. Reserves the `state.modules.world` slot via an empty optional
//      schema so unknown-key warnings stay quiet when later phases add
//      a runtime slice here.
//   2. Reserves Phase 27's new world phase hooks
//      (`identityGeneration`, `localEventUpdate`, `rumourUpdate`) with
//      no-op slots so the pipeline order is observable in tests.
//
// Cross-reference validation (Phase 26 §26.4) already runs through
// `ctx.validate()` during the `validate` phase — wiring a redundant
// module-level `validate` here would double-count those issues.

const SOURCE = 'world'

export const WORLD_MODULE_ID = SOURCE

const WorldModuleStateSchema = z.object({}).passthrough().optional()

const noop = (_ctx: SimContext): void => {
  // Phase 27 phases exist before they have content. Domain modules
  // (cultures, suppliers, etc.) attach the actual behaviour later.
}

export const worldModule: SimulationModule = {
  id: WORLD_MODULE_ID,
  version: '0.1.0',
  hooks: {
    identityGeneration: [noop],
    localEventUpdate: [noop],
    rumourUpdate: [noop],
  },
  stateSchema: WorldModuleStateSchema,
}
