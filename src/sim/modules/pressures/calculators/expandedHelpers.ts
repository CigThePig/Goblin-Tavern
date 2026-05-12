import type { SimContext } from '../../../core/context'
import type {
  EntityRef,
  MemoryState,
  TavernState,
} from '../../../state/TavernState'

import type { AttributionModuleState, AttributionState } from '../../attribution/attributionTypes'
import { memoriesAboutEntity, memoriesForOwner } from '../../memories/entityMemory'

// Phase 38 — Shared helpers for the expanded pressure calculators.
//
// The expanded calculators read across several subsystems (memories,
// attributions, suppliers, regulars, factions, owner projects/policies,
// local arcs). These helpers centralise the slice lookups and the small
// memory/attribution aggregations so the calculators themselves stay
// readable as plain prose.

const ATTRIBUTION_MODULE_ID = 'attribution'

export function getAttributions(state: TavernState): ReadonlyArray<AttributionState> {
  const slice = state.modules[ATTRIBUTION_MODULE_ID] as
    | AttributionModuleState
    | undefined
  if (!slice) return []
  return slice.attributions
}

export function publicBlameStrengthAgainst(
  state: TavernState,
  target: EntityRef,
): number {
  let total = 0
  for (const attribution of getAttributions(state)) {
    if (attribution.target.kind !== target.kind || attribution.target.id !== target.id) {
      continue
    }
    if (attribution.attributionType !== 'blame' && attribution.attributionType !== 'resentment') {
      continue
    }
    total += (attribution.strength * attribution.publicness) / 100
  }
  return total
}

export function publicBlameStrengthForKind(
  state: TavernState,
  kind: EntityRef['kind'],
): number {
  let total = 0
  for (const attribution of getAttributions(state)) {
    if (attribution.target.kind !== kind) continue
    if (attribution.attributionType !== 'blame' && attribution.attributionType !== 'resentment') {
      continue
    }
    total += (attribution.strength * attribution.publicness) / 100
  }
  return total
}

export function publicSuspicionStrengthForKind(
  state: TavernState,
  kind: EntityRef['kind'],
): number {
  let total = 0
  for (const attribution of getAttributions(state)) {
    if (attribution.target.kind !== kind) continue
    if (attribution.attributionType !== 'suspicion') continue
    total += (attribution.strength * attribution.publicness) / 100
  }
  return total
}

export function gratitudeStrengthAgainst(
  state: TavernState,
  target: EntityRef,
): number {
  let total = 0
  for (const attribution of getAttributions(state)) {
    if (attribution.target.kind !== target.kind || attribution.target.id !== target.id) {
      continue
    }
    if (attribution.attributionType !== 'gratitude' && attribution.attributionType !== 'credit') {
      continue
    }
    total += (attribution.strength * attribution.publicness) / 100
  }
  return total
}

export function memoryStrengthForOwnerByTags(
  ctx: SimContext,
  owner: EntityRef,
  tags: string[],
): number {
  let total = 0
  for (const memory of memoriesForOwner(ctx.state, owner, { tags })) {
    total += memory.strength
  }
  return total
}

export function memoryStrengthAboutByTags(
  ctx: SimContext,
  subject: EntityRef,
  tags: string[],
): number {
  let total = 0
  for (const memory of memoriesAboutEntity(ctx.state, subject, { tags })) {
    total += memory.strength
  }
  return total
}

export function totalMemoryStrengthByTags(
  ctx: SimContext,
  tags: string[],
): number {
  let total = 0
  for (const memory of ctx.state.memories as MemoryState[]) {
    let hasAll = true
    for (const tag of tags) {
      if (!memory.tags.includes(tag)) {
        hasAll = false
        break
      }
    }
    if (hasAll) total += memory.strength
  }
  return total
}

export function hasCalendarTag(state: TavernState, tag: string): boolean {
  return (state.calendar.tags as readonly string[]).includes(tag)
}

export function activeArcsByTypeOrTag(
  state: TavernState,
  matcher: { types?: string[]; tags?: string[] },
): { id: string; label: string; intensity: number }[] {
  const out: { id: string; label: string; intensity: number }[] = []
  for (const event of Object.values(state.world.localEvents)) {
    if (event.stage && (event.stage === 'resolved' || event.stage === 'failed')) {
      continue
    }
    let matched = false
    if (matcher.types && event.type && matcher.types.includes(event.type)) {
      matched = true
    }
    if (!matched && matcher.tags) {
      for (const tag of matcher.tags) {
        if (event.tags.includes(tag)) {
          matched = true
          break
        }
      }
    }
    if (matched) {
      out.push({ id: event.id, label: event.label, intensity: event.intensity })
    }
  }
  return out
}

export function ownerProjects(state: TavernState): Record<string, { status: string; tags: string[]; label: string }> {
  const slice = state.modules['ownerActions'] as
    | { projects?: Record<string, { status: string; tags: string[]; label: string }> }
    | undefined
  return slice?.projects ?? {}
}

export function ownerPolicies(state: TavernState): Record<string, { enabled: boolean; tags: string[]; label: string }> {
  const slice = state.modules['ownerActions'] as
    | { policies?: Record<string, { enabled: boolean; tags: string[]; label: string }> }
    | undefined
  return slice?.policies ?? {}
}
