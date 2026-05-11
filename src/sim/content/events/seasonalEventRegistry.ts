import { Registry } from '../../registries/Registry'
import type { SeasonalEventDefinition } from './eventTypes'

// Phase 22 §"Registry Pattern" — seasonal-event registry seam. Concrete
// seasonal events are added once Phase 35 implements seasonal arcs.

export const seasonalEventRegistry = new Registry<SeasonalEventDefinition>()
