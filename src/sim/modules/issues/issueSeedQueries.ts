import type { TavernState } from '../../state/TavernState'
import type {
  IssueSeed,
  IssueSeedModuleState,
  IssueSeedQuery,
} from './issueSeedTypes'

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
  if (query.max !== undefined && query.max > 0) {
    return filtered.slice(0, query.max)
  }
  return filtered
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
