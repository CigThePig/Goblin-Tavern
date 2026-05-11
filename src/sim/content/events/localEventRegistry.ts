import { Registry } from '../../registries/Registry'
import type { LocalEventDefinition } from './eventTypes'

// Phase 22 §"Registry Pattern" — local-event registry seam. Concrete
// local events are added once Phase 35 implements seasonal arcs.

export const localEventRegistry = new Registry<LocalEventDefinition>()
