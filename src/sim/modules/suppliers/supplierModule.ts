import { z } from 'zod'

import type { SimulationModule } from '../../core/module'
import type { SimContext } from '../../core/context'

// Phase 27 §27.4 — Supplier module skeleton.
//
// Owns the `supplierUpdate` phase hook. Phase 29 §29.5 expands this
// with delivery clearing, market condition application, and supplier
// relationship drift. Phase 27 just registers the seam.

const SOURCE = 'suppliers'

export const SUPPLIERS_MODULE_ID = SOURCE

const SupplierModuleStateSchema = z.object({}).passthrough().optional()

const supplierUpdateHook = (_ctx: SimContext): void => {
  // Phase 27 leaves this empty on purpose.
}

export const supplierModule: SimulationModule = {
  id: SUPPLIERS_MODULE_ID,
  version: '0.1.0',
  hooks: {
    supplierUpdate: [supplierUpdateHook],
  },
  stateSchema: SupplierModuleStateSchema,
}
