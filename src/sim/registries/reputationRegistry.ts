import { Registry } from './Registry'

export type ReputationAxisDefinition = {
  id: string
  label: string
  tags: string[]
}

export const reputationRegistry = new Registry<ReputationAxisDefinition>()

// Phase 67 / ISSUE-027 §5.5 — first real consumer of the registry.
// `culinary_renown` tracks the rare-ingredient economy's fame loop.
const REQUIRED_AXES: ReputationAxisDefinition[] = [
  {
    id: 'culinary_renown',
    label: 'Culinary Renown',
    tags: ['rare_ingredients', 'execution', 'fame'],
  },
]

let initialized = false

export function ensureRequiredReputationAxesRegistered(): void {
  if (initialized) return
  for (const def of REQUIRED_AXES) {
    if (!reputationRegistry.has(def.id)) {
      reputationRegistry.register(def)
    }
  }
  initialized = true
}

ensureRequiredReputationAxesRegistered()
