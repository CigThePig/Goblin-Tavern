import { z } from 'zod'

import type { SimulationModule } from '../../core/module'
import type { SimContext } from '../../core/context'

// Phase 27 §27.4 — Regular-customer module skeleton.
//
// Owns the `regularCustomerUpdate` phase hook. Phase 30 §30.6 lands
// the emergence logic; Phase 27 wires the seam.

const SOURCE = 'regulars'

export const REGULARS_MODULE_ID = SOURCE

const RegularModuleStateSchema = z.object({}).passthrough().optional()

const regularUpdateHook = (_ctx: SimContext): void => {
  // Phase 27 leaves this empty on purpose.
}

export const regularModule: SimulationModule = {
  id: REGULARS_MODULE_ID,
  version: '0.1.0',
  hooks: {
    regularCustomerUpdate: [regularUpdateHook],
  },
  stateSchema: RegularModuleStateSchema,
}
