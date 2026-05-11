import { Registry } from '../../registries/Registry'
import type { CultureDefinition } from './cultureTypes'

// Phase 22 §"Registry Pattern" — culture registry seam. Starter cultures
// are added by Phase 30; Phase 22 only reserves the registry.

export const cultureRegistry = new Registry<CultureDefinition>()
