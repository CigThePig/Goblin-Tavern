import { Registry } from './Registry'
import type { SimulationModule } from '../core/module'

// Legacy Phase 2 compatibility seam. The runtime source of truth for the
// production pipeline is `src/sim/canonicalPipeline.ts`; this registry remains
// only for early structure tests and any external host still exercising the
// generic registry API directly. Do not use it for default validation or
// production module discovery.
export const moduleRegistry = new Registry<SimulationModule>()
