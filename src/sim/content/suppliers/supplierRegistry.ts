import { Registry } from '../../registries/Registry'
import type { SupplierDefinition } from './supplierTypes'

// Phase 22 §"Registry Pattern" — supplier registry seam. Starter
// suppliers land in Phase 29; Phase 22 only reserves the registry.

export const supplierRegistry = new Registry<SupplierDefinition>()
