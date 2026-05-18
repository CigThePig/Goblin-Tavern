// Phase 95 — Tavern Identity module.
//
// Recomputes `state.world.tavernIdentity.{knownFor, houseRules,
// atmosphereTags}` on `endDay` based on current state. Writes through
// `ctx.modifyTavernIdentity` only when an array actually changed —
// the engine emits one cause per write tagged `tavern_identity`, so
// idempotency matters (otherwise every day produces noise).
//
// The module is pure: it reads from state, computes three derived
// string arrays via the label tables in `./labels.ts`, and asks the
// engine to persist them. No RNG, no unseeded randomness, no side
// effects. Identity becomes a tracked simulation fact (Phase 21
// contract: "identity, culture, place, and relationships must become
// persistent simulation facts before they become card flavour").

import { z } from 'zod'

import type { SimulationModule, SimulationHook } from '../../core/module'
import type { SimContext } from '../../core/context'
import type {
  AreaState,
  CultureWorldState,
  ReputationState,
  TavernIdentityState,
} from '../../state/TavernState'
import type { OwnerPolicyState } from '../ownerActions/types'
import { getOwnerActionsModuleState } from '../ownerActions/stateHelpers'

import {
  AREA_CONDITION_FRAGMENT,
  AREA_CONDITION_FRACTION,
  ATMOSPHERE_LIMIT,
  AXIS_KNOWN_FOR,
  CULTURE_COMFORT_MIN,
  CULTURE_FAMILIARITY_MIN,
  KNOWN_FOR_LIMIT,
  KNOWN_FOR_THRESHOLD,
  POLICY_HOUSE_RULE,
  areaMatches,
  cultureFragment,
  type AreaConditionFlag,
} from './labels'

export const TAVERN_IDENTITY_MODULE_ID = 'tavernIdentity'

const TavernIdentityModuleStateSchema = z.object({}).passthrough().optional()

// ---------- Pure computers ----------

export function computeKnownFor(reputation: ReputationState): string[] {
  const axes = Object.entries(reputation) as Array<[keyof ReputationState, number]>
  const eligible = axes
    .filter(([, value]) => value >= KNOWN_FOR_THRESHOLD)
    .slice()
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1]
      return String(a[0]).localeCompare(String(b[0]))
    })
    .slice(0, KNOWN_FOR_LIMIT)
  return eligible.map(([axis]) => AXIS_KNOWN_FOR[axis])
}

export function computeHouseRules(
  policies: Record<string, OwnerPolicyState>,
): string[] {
  const enabled = Object.values(policies)
    .filter((p) => p.enabled)
    .slice()
    // Order by startedAtDay ascending so the array stays stable for
    // long-standing rules even after newly-enabled ones are added.
    .sort((a, b) => {
      if (a.startedAtDay !== b.startedAtDay) return a.startedAtDay - b.startedAtDay
      return a.id.localeCompare(b.id)
    })
  const out: string[] = []
  const seen = new Set<string>()
  for (const policy of enabled) {
    const fragment =
      POLICY_HOUSE_RULE[policy.policyType] ??
      POLICY_HOUSE_RULE[policy.id] ??
      policy.label.toLowerCase()
    if (seen.has(fragment)) continue
    seen.add(fragment)
    out.push(fragment)
  }
  return out
}

export function computeAtmosphereTags(
  areas: Record<string, AreaState>,
  cultures: Record<string, CultureWorldState>,
): string[] {
  const out: string[] = []
  const seen = new Set<string>()

  // ---- Area condition flags ----
  const areaList = Object.values(areas)
  if (areaList.length > 0) {
    const flags: AreaConditionFlag[] = [
      'grimy',
      'damaged',
      'smelly',
      'rowdy',
      'cosy',
      'polished',
    ]
    type FragmentWeight = { fragment: string; weight: number }
    const fragments: FragmentWeight[] = []
    for (const flag of flags) {
      const matches = areaList.filter((a) => areaMatches(a, flag)).length
      const fraction = matches / areaList.length
      if (fraction >= AREA_CONDITION_FRACTION) {
        fragments.push({
          fragment: AREA_CONDITION_FRAGMENT[flag],
          weight: fraction,
        })
      }
    }
    fragments.sort((a, b) => {
      if (b.weight !== a.weight) return b.weight - a.weight
      return a.fragment.localeCompare(b.fragment)
    })
    for (const { fragment } of fragments) {
      if (seen.has(fragment)) continue
      seen.add(fragment)
      out.push(fragment)
      if (out.length >= ATMOSPHERE_LIMIT) return out
    }
  }

  // ---- Culture flags ----
  const cultureList = Object.values(cultures)
    .filter(
      (c) =>
        c.familiarity >= CULTURE_FAMILIARITY_MIN &&
        c.comfort >= CULTURE_COMFORT_MIN,
    )
    .slice()
    .sort((a, b) => {
      const wa = a.familiarity + a.comfort
      const wb = b.familiarity + b.comfort
      if (wb !== wa) return wb - wa
      return a.id.localeCompare(b.id)
    })
  for (const culture of cultureList) {
    const fragment = cultureFragment(culture.id, culture.label)
    if (seen.has(fragment)) continue
    seen.add(fragment)
    out.push(fragment)
    if (out.length >= ATMOSPHERE_LIMIT) return out
  }

  return out
}

// ---------- Diff helpers ----------

function stringArraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false
  }
  return true
}

// ---------- Hook ----------

const recomputeIdentityHook: SimulationHook = (ctx: SimContext): void => {
  const current = ctx.state.world.tavernIdentity
  const reputation = ctx.state.reputation
  const policies = getOwnerActionsModuleState(ctx.state).policies
  const areas = ctx.state.areas
  const cultures = ctx.state.world.cultures

  const nextKnownFor = computeKnownFor(reputation)
  const nextHouseRules = computeHouseRules(policies)
  const nextAtmosphereTags = computeAtmosphereTags(areas, cultures)

  const changes: Partial<TavernIdentityState> = {}
  if (!stringArraysEqual(current.knownFor, nextKnownFor)) {
    changes.knownFor = nextKnownFor
  }
  if (!stringArraysEqual(current.houseRules, nextHouseRules)) {
    changes.houseRules = nextHouseRules
  }
  if (!stringArraysEqual(current.atmosphereTags, nextAtmosphereTags)) {
    changes.atmosphereTags = nextAtmosphereTags
  }

  if (Object.keys(changes).length === 0) return

  ctx.modifyTavernIdentity(changes, {
    source: 'tavernIdentity.recompute',
    sourceType: 'system',
    readable: 'Tavern identity recomputed from state.',
    tags: ['tavern_identity', 'recompute'],
    relatedSystems: ['tavernIdentity'],
  })
}

export const tavernIdentityModule: SimulationModule = {
  id: TAVERN_IDENTITY_MODULE_ID,
  version: '0.1.0',
  hooks: {
    endDay: [recomputeIdentityHook],
  },
  stateSchema: TavernIdentityModuleStateSchema,
}
