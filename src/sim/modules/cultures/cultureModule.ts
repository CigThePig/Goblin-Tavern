import { z } from 'zod'

import type { SimulationModule } from '../../core/module'
import type { SimContext } from '../../core/context'

// Phase 27 §27.4 — Culture module skeleton.
//
// Owns the `cultureUpdate` phase hook. Phase 30 will populate this
// with culture-specific behaviour (tension drift, forecast notes,
// etc.). For Phase 27 the module proves it can register and run
// against the new phase pipeline.

const SOURCE = 'cultures'

export const CULTURES_MODULE_ID = SOURCE

const CultureModuleStateSchema = z.object({}).passthrough().optional()

const cultureUpdateHook = (_ctx: SimContext): void => {
  // Phase 27 leaves this empty on purpose. The hook slot is what
  // matters; behaviour lands in Phase 30 (§30.8).
}

export const cultureModule: SimulationModule = {
  id: CULTURES_MODULE_ID,
  version: '0.1.0',
  hooks: {
    cultureUpdate: [cultureUpdateHook],
  },
  stateSchema: CultureModuleStateSchema,
}
