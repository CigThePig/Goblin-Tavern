import type { TavernState } from '../../state/TavernState'
import type { IssueSeed } from './issueSeedTypes'
import type { PressureCauseOrigin, PressureSnapshot } from '../pressures/pressureTypes'

// Phase 188 — player-facing fairness gates for inherited opening pressure.
// These helpers do not change raw simulation pressure. They only decide
// whether an issue seed should be surfaced as a card today.

const EARLY_GAME_CAP_BY_DAY: Record<number, number> = {
  2: 2,
  3: 3,
}

const AGENCY_ORIGINS = new Set<PressureCauseOrigin>([
  'warned',
  'player_caused',
  'neglected',
  'memory',
])

const INHERITED_ONLY_ORIGINS = new Set<PressureCauseOrigin>([
  'inherited',
  'discovered',
])

const EXTERNAL_ORIGINS = new Set<PressureCauseOrigin>(['external'])

const BLAME_OR_CONSEQUENCE_TYPES = new Set<IssueSeed['type']>([
  'crisis',
  'complaint',
  'warning',
  'staff_request',
  'maintenance_problem',
  'customer_incident',
  'debt_pressure',
  'inspection_threat',
  'relationship_test',
  'social_conflict',
  'policy_reaction',
  'rumour',
])

function currentDayNumber(state: TavernState): number {
  // Completed days are one-based at the player-facing day boundary.
  return state.calendar.totalDaysElapsed
}

function positiveCauses(snapshot: PressureSnapshot): PressureSnapshot['causes'] {
  return snapshot.causes.filter((cause) => cause.amount > 0)
}

function causeOrigin(cause: { origin?: PressureCauseOrigin }): PressureCauseOrigin {
  return cause.origin ?? 'unknown'
}

function seedPositivePressureCauses(seed: IssueSeed): Array<{ origin?: PressureCauseOrigin }> {
  const out: Array<{ origin?: PressureCauseOrigin }> = []
  for (const pressure of seed.pressures) {
    out.push(...positiveCauses(pressure))
  }
  return out
}

export function isEarlyGameGraceActive(state: TavernState): boolean {
  return currentDayNumber(state) <= 3
}

export function earlyGameVisibleSeedCap(state: TavernState): number | undefined {
  return EARLY_GAME_CAP_BY_DAY[currentDayNumber(state)]
}

export function pressureHasPlayerAgency(snapshot: PressureSnapshot): boolean {
  return positiveCauses(snapshot).some((cause) => AGENCY_ORIGINS.has(causeOrigin(cause)))
}

export function isInheritedOnlyPressure(snapshot: PressureSnapshot): boolean {
  const causes = positiveCauses(snapshot)
  if (causes.length === 0) return false
  return causes.every((cause) => INHERITED_ONLY_ORIGINS.has(causeOrigin(cause)))
}

export function hasPlayerAgencyForPressure(seed: IssueSeed): boolean {
  if (seed.pressures.some(pressureHasPlayerAgency)) return true
  if (seed.causes.some((cause) => cause.tags.some((tag) => (
    tag === 'ignored' ||
    tag === 'warning' ||
    tag === 'player_caused' ||
    tag === 'late_payment' ||
    tag === 'grudge' ||
    tag === 'blame'
  )))) return true
  return seed.textIngredients.relevantMemories !== undefined &&
    seed.textIngredients.relevantMemories.length > 0
}

export function isExternalIssueSeed(seed: IssueSeed): boolean {
  return seed.pressures.some((pressure) =>
    positiveCauses(pressure).some((cause) => EXTERNAL_ORIGINS.has(causeOrigin(cause))),
  )
}

export function isInheritedOnlyIssueSeed(seed: IssueSeed): boolean {
  const causes = seedPositivePressureCauses(seed)
  if (causes.length === 0) return false
  return causes.every((cause) => INHERITED_ONLY_ORIGINS.has(causeOrigin(cause)))
}

export function shouldSurfaceAsIssueSeed(state: TavernState, seed: IssueSeed): boolean {
  if (!BLAME_OR_CONSEQUENCE_TYPES.has(seed.type)) return true
  if (isExternalIssueSeed(seed)) return true
  if (hasPlayerAgencyForPressure(seed)) return true
  if (!isInheritedOnlyIssueSeed(seed)) return true

  const day = currentDayNumber(state)
  if (day <= 1) return false

  // After Day 1 this first fairness layer allows inherited-only
  // pressure to become a first warning, with the early-game card cap keeping
  // the surface readable. Later phases can promote the warning/deferred state
  // into stricter post-grace neglect semantics.
  return true
}

export function applyEarlyGameIssueSeedCap(
  state: TavernState,
  rankedSeeds: IssueSeed[],
): IssueSeed[] {
  const cap = earlyGameVisibleSeedCap(state)
  if (cap === undefined) return rankedSeeds

  const external: IssueSeed[] = []
  const normal: IssueSeed[] = []
  for (const seed of rankedSeeds) {
    if (isExternalIssueSeed(seed)) external.push(seed)
    else normal.push(seed)
  }
  return [...external, ...normal.slice(0, cap)]
}
