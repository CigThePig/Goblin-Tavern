import { Registry } from '../../registries/Registry'
import type { SeasonalEventDefinition } from './eventTypes'

// Intentional future placeholder from Phase 22. No runtime module consumes
// seasonal events yet; tests assert this registry exists and starts empty so a
// later seasonal-event host can fill it without changing the public seam.
export const seasonalEventRegistry = new Registry<SeasonalEventDefinition>()
