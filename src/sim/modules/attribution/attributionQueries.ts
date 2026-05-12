import type { EntityRef, TavernState } from '../../state/TavernState'

import type { AttributionModuleState, AttributionState } from './attributionTypes'

// Phase 37 §37.7 — Attribution query helpers.
//
// Pure functions over `state.modules.attribution.attributions`. They are
// used by the attribution report, by future pressure calculators, by
// issue-seed generators, and (eventually) by the card layer's text
// ingredient selection.

export const ATTRIBUTION_MODULE_ID = 'attribution'

function getModuleState(state: TavernState): AttributionModuleState | undefined {
  return state.modules[ATTRIBUTION_MODULE_ID] as
    | AttributionModuleState
    | undefined
}

function asAttributions(
  input: TavernState | ReadonlyArray<AttributionState>,
): ReadonlyArray<AttributionState> {
  if (Array.isArray(input)) return input
  const slice = getModuleState(input as TavernState)
  if (!slice) return []
  return slice.attributions
}

function refEquals(a: EntityRef, b: EntityRef): boolean {
  return a.kind === b.kind && a.id === b.id
}

export function attributionsByTarget(
  state: TavernState | ReadonlyArray<AttributionState>,
  target: EntityRef,
): AttributionState[] {
  const out: AttributionState[] = []
  for (const attribution of asAttributions(state)) {
    if (refEquals(attribution.target, target)) out.push(attribution)
  }
  return out
}

export function attributionsHeldBy(
  state: TavernState | ReadonlyArray<AttributionState>,
  perceiver: EntityRef,
): AttributionState[] {
  const out: AttributionState[] = []
  for (const attribution of asAttributions(state)) {
    if (refEquals(attribution.perceivedBy, perceiver)) out.push(attribution)
  }
  return out
}

export function blameAgainst(
  state: TavernState | ReadonlyArray<AttributionState>,
  target: EntityRef,
): AttributionState[] {
  return attributionsByTarget(state, target).filter(
    (a) => a.attributionType === 'blame' || a.attributionType === 'resentment',
  )
}

export function creditToward(
  state: TavernState | ReadonlyArray<AttributionState>,
  target: EntityRef,
): AttributionState[] {
  return attributionsByTarget(state, target).filter(
    (a) => a.attributionType === 'credit' || a.attributionType === 'gratitude',
  )
}

export function strongestPublicAttributions(
  state: TavernState | ReadonlyArray<AttributionState>,
  limit: number = 5,
): AttributionState[] {
  const list = [...asAttributions(state)]
  list.sort((a, b) => {
    const ap = a.publicness * a.strength
    const bp = b.publicness * b.strength
    return bp - ap
  })
  if (limit <= 0) return []
  return list.slice(0, limit)
}

export function attributionsByTag(
  state: TavernState | ReadonlyArray<AttributionState>,
  tag: string,
): AttributionState[] {
  const out: AttributionState[] = []
  for (const attribution of asAttributions(state)) {
    if (attribution.tags.includes(tag)) out.push(attribution)
  }
  return out
}

export function attributionsByType(
  state: TavernState | ReadonlyArray<AttributionState>,
  attributionType: AttributionState['attributionType'],
): AttributionState[] {
  const out: AttributionState[] = []
  for (const attribution of asAttributions(state)) {
    if (attribution.attributionType === attributionType) out.push(attribution)
  }
  return out
}

export function getAttributionModuleState(
  state: TavernState,
): AttributionModuleState | undefined {
  return getModuleState(state)
}
