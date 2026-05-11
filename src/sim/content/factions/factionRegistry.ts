import { Registry } from '../../registries/Registry'
import type { FactionDefinition } from './factionTypes'

// Phase 22 §"Registry Pattern" — faction registry seam. Starter factions
// land in Phase 30; Phase 22 only reserves the registry.

export const factionRegistry = new Registry<FactionDefinition>()
