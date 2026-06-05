import { Registry } from '../../registries/Registry'
import type { LocalEventDefinition } from './eventTypes'

// Intentional future placeholder from Phase 22. Current runtime local arcs use
// `localArcRegistry`; this empty local-event registry is retained for structure
// tests and for a future event host, not as active architecture today.
export const localEventRegistry = new Registry<LocalEventDefinition>()
