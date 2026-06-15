import type { TavernState } from '../../state/TavernState'
import type {
  IssueSeed,
  IssueSeedModuleState,
  IssueSeedQuery,
} from './issueSeedTypes'
import { applyEarlyGameIssueSeedCap } from './fairness'

// Phase 19 §19.2 — Issue seed query API.
//
// Pure-function reads against the issue-seeds module slice. Generators
// run during the engine pipeline; queries are what the (eventual) card
// layer and tests use to inspect what the simulation has produced.

export const ISSUE_SEEDS_MODULE_ID = 'issueSeeds'

export function getIssueSeedSlice(
  state: TavernState,
): IssueSeedModuleState | undefined {
  return state.modules[ISSUE_SEEDS_MODULE_ID] as
    | IssueSeedModuleState
    | undefined
}

export function getAllSeedsToday(state: TavernState): IssueSeed[] {
  const slice = getIssueSeedSlice(state)
  if (!slice) return []
  return slice.seedsToday
}

/**
 * Phase 2 (teleology) — every seed that is resolvable by a response today:
 * the union of the budget-bounded visible hand (`seedsToday`) and every seed
 * that was surfaced in an earlier generation pass but later displaced from
 * the hand (`surfacedToday`). Use this for response/intent lookup so a valid
 * player choice against a displaced card is never silently dropped on a
 * crowded day. Display surfaces still read `seedsToday` (the visible hand).
 */
export function getResolvableSeedsToday(state: TavernState): IssueSeed[] {
  const slice = getIssueSeedSlice(state)
  if (!slice) return []
  const surfaced = slice.surfacedToday ?? []
  if (surfaced.length === 0) return slice.seedsToday
  const byId = new Map<string, IssueSeed>()
  for (const seed of surfaced) byId.set(seed.id, seed)
  // Defensive: include any visible-hand seed not yet captured in
  // `surfacedToday` (e.g. an older save mid-migration) so resolution never
  // regresses relative to `seedsToday`.
  for (const seed of slice.seedsToday) {
    if (!byId.has(seed.id)) byId.set(seed.id, seed)
  }
  return [...byId.values()]
}

export function getIssueSeeds(
  state: TavernState,
  query: IssueSeedQuery = {},
): IssueSeed[] {
  const all = getAllSeedsToday(state)
  const filtered = all.filter((seed) => {
    if (!seed.validation.valid && !query.includeInvalid) return false
    if (query.timing && seed.timing !== query.timing) return false
    if (query.types && !query.types.includes(seed.type)) return false
    if (query.family && seed.family !== query.family) return false
    if (
      query.minCardWorthiness !== undefined &&
      seed.cardWorthiness < query.minCardWorthiness
    )
      return false
    return true
  })
  let visible = filtered
  if (
    query.family === undefined &&
    query.types === undefined &&
    query.timing === undefined &&
    query.minCardWorthiness === undefined
  ) {
    visible = applyEarlyGameIssueSeedCap(state, visible)
  }
  if (query.max !== undefined && query.max > 0) {
    return visible.slice(0, query.max)
  }
  return visible
}

export function getRejectedSeedsToday(
  state: TavernState,
): IssueSeedModuleState['rejectedToday'] {
  return getIssueSeedSlice(state)?.rejectedToday ?? []
}

export function getCooldown(
  state: TavernState,
  templateId: string,
): IssueSeedModuleState['cooldowns'][string] | undefined {
  return getIssueSeedSlice(state)?.cooldowns[templateId]
}
