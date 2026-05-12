import { Registry } from './Registry'
import {
  REQUIRED_OWNER_ACTIONS,
} from '../modules/ownerActions/actionDefinitions'
import { PROJECT_ACTIONS } from '../modules/ownerActions/projectActions'
import { POLICY_ACTIONS } from '../modules/ownerActions/policyActions'
import { SOCIAL_ACTIONS } from '../modules/ownerActions/socialActions'
import type { OwnerActionDefinition } from '../modules/ownerActions/types'

// Phase 13 §13.1 — Owner action registry.
//
// Owner actions are registry-driven (per the Phase 2 architectural rule
// for expandable concepts). The registry seeds itself with the ten
// required Phase 13 actions; the owner-actions module reads it during
// the `applyOwnerActions` phase.
//
// Phase 33 §33.4 / §33.6 / §33.7 — Project / policy / social-action
// definitions are added alongside the Phase 13 set. They share the same
// `OwnerActionDefinition` shape (Phase 33 §33.2 widens it with the
// `category` field) so the runtime can dispatch them through the
// existing `applyOwnerActions` hook without a parallel pipeline.

export type { OwnerActionDefinition }

export const actionRegistry = new Registry<OwnerActionDefinition>()

let initialized = false

export function ensureRequiredOwnerActionsRegistered(): void {
  if (initialized) return
  const all: OwnerActionDefinition[] = [
    ...REQUIRED_OWNER_ACTIONS,
    ...PROJECT_ACTIONS,
    ...POLICY_ACTIONS,
    ...SOCIAL_ACTIONS,
  ]
  for (const def of all) {
    if (!actionRegistry.has(def.id)) {
      actionRegistry.register(def)
    }
  }
  initialized = true
}

ensureRequiredOwnerActionsRegistered()
