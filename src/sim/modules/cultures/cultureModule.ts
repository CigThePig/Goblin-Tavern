import { z } from 'zod'

import type { SimulationModule, SimulationHook } from '../../core/module'
import type { SimContext } from '../../core/context'
import type { EntityRef } from '../../state/TavernState'

import { buildCultureReport } from './cultureReport'
import {
  hasCalendarTag,
  ownerPolicies,
} from '../pressures/calculators/expandedHelpers'

// Phase 27 §27.4 / Phase 30 §30.10 — Culture module.
//
// Phase 27 reserved the seam; Phase 30 attached the report builder so
// the culture layer is observable per day. The actual culture-aware
// behaviour (forecast influence) lives in
// `modules/cultures/customerInfluence.ts` and is invoked by the
// customer module's forecast helper — keeping the seam light.
//
// Phase 50 / ISSUE-010 — wire producers for the three memory tags that
// `culturalTension` aggregates in its `taboo_memory` cause but no
// upstream producer was writing: `seating_conflict`, `food_taboo`,
// `cultural_misunderstanding`. The `closing` phase runs after service
// has settled, so patronage/stock/policy reads reflect today's state.
// `cultureUpdate` stays a no-op placeholder — the forecast helper still
// consults culture state directly without needing a runtime cache.

const SOURCE = 'cultures'

export const CULTURES_MODULE_ID = SOURCE

const CultureModuleStateSchema = z.object({}).passthrough().optional()

const FRICTION_RELIEF_POLICY_TAGS = [
  'cultural_accommodation',
  'seating',
  'friction_reduction',
] as const

const HOSTILE_RELATIONSHIP_THRESHOLD = -30
const ACTIVE_PATRONAGE_THRESHOLD = 25

const cultureUpdateHook: SimulationHook = (_ctx: SimContext): void => {
  // Phase 30 leaves this empty; the forecast helper consults culture
  // state directly without needing a runtime cache. Future phases can
  // attach tension drift, festival hooks, etc., here.
}

function hasAnyFrictionReliefPolicy(ctx: SimContext): boolean {
  for (const policy of Object.values(ownerPolicies(ctx.state))) {
    if (!policy.enabled) continue
    for (const tag of FRICTION_RELIEF_POLICY_TAGS) {
      if (policy.tags.includes(tag)) return true
    }
  }
  return false
}

function emitSeatingConflicts(ctx: SimContext): void {
  const groups = Object.values(ctx.state.customerGroups)
  for (let i = 0; i < groups.length; i += 1) {
    const a = groups[i]!
    if (a.patronage < ACTIVE_PATRONAGE_THRESHOLD) continue
    const relMap = (a as { relationshipToOtherGroups?: Record<string, number> })
      .relationshipToOtherGroups
    if (!relMap) continue
    for (let j = i + 1; j < groups.length; j += 1) {
      const b = groups[j]!
      if (b.patronage < ACTIVE_PATRONAGE_THRESHOLD) continue
      const rel = relMap[b.id]
      if (rel === undefined || rel > HOSTILE_RELATIONSHIP_THRESHOLD) continue
      const actors: EntityRef[] = [
        { kind: 'customer_group', id: a.id },
        { kind: 'customer_group', id: b.id },
      ]
      ctx.addMemory({
        id: 'seating_conflict_recently',
        source: SOURCE,
        actors,
        metadata: { groupA: a.id, groupB: b.id, relationship: rel },
      })
    }
  }
}

function emitFoodTaboos(ctx: SimContext): void {
  const cultures = ctx.state.world.cultures
  if (Object.keys(cultures).length === 0) return
  const availableStockTags = new Set<string>()
  for (const stock of Object.values(ctx.state.stock)) {
    if (stock.quantity <= 0) continue
    for (const tag of stock.tags) availableStockTags.add(tag)
  }
  if (availableStockTags.size === 0) return
  for (const group of Object.values(ctx.state.customerGroups)) {
    if (group.patronage < ACTIVE_PATRONAGE_THRESHOLD) continue
    const culture = cultures[group.cultureId]
    if (!culture) continue
    const overlap = culture.dislikedTags.filter((tag) =>
      availableStockTags.has(tag),
    )
    if (overlap.length === 0) continue
    ctx.addMemory({
      id: 'food_taboo_recently',
      source: SOURCE,
      actors: [
        { kind: 'customer_group', id: group.id },
        { kind: 'culture', id: culture.id },
      ],
      metadata: { groupId: group.id, cultureId: culture.id, overlap },
    })
  }
}

function emitCulturalMisunderstandings(ctx: SimContext): void {
  // If the owner runs any friction-reducing policy today, no
  // misunderstanding memory is emitted — the policy is doing its job.
  if (hasAnyFrictionReliefPolicy(ctx)) return
  const dayType = ctx.getDayType()
  for (const culture of Object.values(ctx.state.world.cultures)) {
    const active = culture.importantCalendarTags.filter(
      (tag) => tag === dayType || hasCalendarTag(ctx.state, tag),
    )
    if (active.length === 0) continue
    ctx.addMemory({
      id: 'cultural_misunderstanding_recently',
      source: SOURCE,
      actors: [{ kind: 'culture', id: culture.id }],
      metadata: { cultureId: culture.id, observances: active },
    })
  }
}

const closingHook: SimulationHook = (ctx: SimContext): void => {
  emitSeatingConflicts(ctx)
  emitFoodTaboos(ctx)
  emitCulturalMisunderstandings(ctx)
}

export const cultureModule: SimulationModule = {
  id: CULTURES_MODULE_ID,
  version: '0.3.0',
  hooks: {
    cultureUpdate: [cultureUpdateHook],
    closing: [closingHook],
  },
  buildReport: buildCultureReport,
  stateSchema: CultureModuleStateSchema,
}
