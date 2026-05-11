import { Registry } from './Registry'
import {
  REQUIRED_OWNER_ACTIONS,
} from '../modules/ownerActions/actionDefinitions'
import type { OwnerActionDefinition } from '../modules/ownerActions/types'

// Phase 13 §13.1 — Owner action registry.
//
// Owner actions are registry-driven (per the Phase 2 architectural rule
// for expandable concepts). The registry seeds itself with the ten
// required Phase 13 actions; the owner-actions module reads it during
// the `applyOwnerActions` phase.

export type { OwnerActionDefinition }

export const actionRegistry = new Registry<OwnerActionDefinition>()

let initialized = false

export function ensureRequiredOwnerActionsRegistered(): void {
  if (initialized) return
  for (const def of REQUIRED_OWNER_ACTIONS) {
    if (!actionRegistry.has(def.id)) {
      actionRegistry.register(def)
    }
  }
  initialized = true
}

ensureRequiredOwnerActionsRegistered()
