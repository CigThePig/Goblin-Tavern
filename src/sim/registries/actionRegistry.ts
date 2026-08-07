import { Registry } from './Registry'
import {
  REQUIRED_OWNER_ACTIONS,
} from '../modules/ownerActions/actionDefinitions'
import { PROJECT_ACTIONS } from '../modules/ownerActions/projectActions'
import { POLICY_ACTIONS } from '../modules/ownerActions/policyActions'
import { SOCIAL_ACTIONS } from '../modules/ownerActions/socialActions'
import { AREA_UPGRADE_ACTIONS } from '../modules/ownerActions/upgradeActions'
import { WORKFORCE_ACTIONS } from '../modules/ownerActions/workforceActions'
import { SERVICE_ACTIONS } from '../modules/ownerActions/serviceActions'
import { ECONOMY_ACTIONS } from '../modules/economy/actions'
import { SUPPLIER_ACTIONS } from '../modules/suppliers/actions'
import { FINANCE_ACTIONS } from '../modules/finance/actions'
import { TENANCY_ACTIONS } from '../modules/tenancy/actions'
import { REGULATORY_ACTIONS } from '../modules/regulatory/actions'
import { FACTION_ACTIONS } from '../modules/ownerActions/factionActions'
import { CULTURE_ACTIONS } from '../modules/ownerActions/cultureActions'
import { NPC_ACTIONS } from '../modules/ownerActions/npcActions'
import { RUMOUR_ACTIONS } from '../modules/ownerActions/rumourActions'
import { BELIEF_ACTIONS } from '../modules/ownerActions/beliefActions'
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
//
// Expansion Phase 2 §2.2 — `AREA_UPGRADE_ACTIONS` adds the upgrade lifecycle
// (start / fund / pause / resume / cancel / repair / service). They target
// `"<areaId>:<upgradeId>"` composite ids, which the generic picker enumerates
// like any other flat target list, and every target's `hint` carries its quote.

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
    // Expansion Phase 2 §2.2 — the seven-action upgrade lifecycle that closes
    // OBL-01. They share the `OwnerActionDefinition` shape, so they dispatch
    // through the existing `applyOwnerActions` hook like everything else.
    ...AREA_UPGRADE_ACTIONS,
    // Expansion Phase 3 §"Player-facing work" — the twelve workforce actions
    // that close the staff half of the phase. `hire_staff` and `fire_staff` keep
    // their ids and move here from `staffManagementActions.ts`, rebuilt around
    // the applicant board and the notice/severance lifecycle.
    ...WORKFORCE_ACTIONS,
    // Expansion Phase 4 §"Player-facing work" — the service-floor actions:
    // chasing and wiping patron slates, and the two that treat a regular as
    // somebody you can actually talk to.
    ...SERVICE_ACTIONS,
    // Expansion Phase 5 — insolvency and recovery are player capabilities,
    // not hidden state transitions.
    ...ECONOMY_ACTIONS,
    // Expansion Phase 6 §6.1–6.4 — procurement is a strategic loop the
    // player plays: order, amend, cancel, dispute, ask for credit, pay or
    // promise to pay an invoice, and negotiate terms. `place_supplier_order`
    // targets `"<supplierId>:<stockId>"` composite ids and carries its quote
    // in every target hint, the same convention the upgrade actions use.
    ...SUPPLIER_ACTIONS,
    // Expansion Phase 7 §7.1–7.3 — the external obligations. Borrowing,
    // repaying, renegotiating and settling a loan; paying rent, talking to
    // the landlord, answering an access request, asking for a repair and
    // buying an evicted tenancy back; and the five responses to an
    // inspection — the books, compliance, appeal, the fine, and the quiet
    // word. Every rung of the tenancy notice ladder names one of these as
    // its way out, so the promise the notice makes is one the registry can
    // keep.
    ...FINANCE_ACTIONS,
    ...TENANCY_ACTIONS,
    ...REGULATORY_ACTIONS,
    // Expansion Phase 8 §8.1 — the player's half of the faction
    // conversation. A faction that can act must be answerable, so granting,
    // refusing, appealing and repaying are on the board whenever a faction
    // has asked for something, announced a move, or been sponsoring the
    // house. Without these the faction layer would be weather again.
    ...FACTION_ACTIONS,
    // Expansion Phase 8 §8.2 — a culture that can hold something against the
    // house has to be answerable too. Making amends settles a specific,
    // named slight; marking an observance keeps an occasion on the day it
    // matters. Both surface exactly when there is something to answer, and
    // the target hint carries the remedy the misunderstanding recorded.
    ...CULTURE_ACTIONS,
    // Expansion Phase 8 §8.3 — dealing with people. Accepting and declining
    // are the answers to what a promoted NPC puts to the house; cultivating
    // is how a player DRIVES the repeated-interaction threshold rather than
    // waiting for it.
    ...NPC_ACTIONS,
    // Expansion Phase 8 §8.4 — DEP-10's "deny, counter, name the source".
    // They existed as response slots on issue cards, so they were reachable
    // only when a card happened to be dealt; as owner actions they are on
    // the board whenever there is something being said.
    ...RUMOUR_ACTIONS,
    // Expansion Phase 8 §8.5 — the answer to a belief. Everything else in
    // §8.5 is other people acting on what they think of the house; without
    // this the player could only watch it happen. Answering something they
    // are RIGHT about hardens it, so the move can be the wrong one.
    ...BELIEF_ACTIONS,
  ]
  for (const def of all) {
    if (!actionRegistry.has(def.id)) {
      actionRegistry.register(def)
    }
  }
  initialized = true
}

ensureRequiredOwnerActionsRegistered()
