import type { IssueSeed, IssueSeedFamilyId } from '../modules/issues/issueSeedTypes'
import type { CardlessRunResult } from './simRunner'
import { collectAllSeeds } from './cardlessPlaytest'
import { getRejectedSeedsToday } from '../modules/issues/index'

// Phase 20 §20.8 / §20.9 — Seed coverage + meaningful-card-capacity
// reports.
//
// The coverage report counts how many distinct, well-formed seeds the
// simulation produces in each Phase 19 family across a run. The capacity
// report rolls those numbers up into a "is the sim ready for hundreds
// of non-fluff cards?" sketch — distinct actor/location/pressure/
// response combinations, distinct memories created by responses, and so
// on.
//
// Neither report writes cards; they only measure whether the seed
// machinery has enough variety to support card development.

// Phase 19 §20.8 — original ten families. Phase 39 §39.1 splits the
// list so callers can distinguish the original Phase 20 readiness gate
// from the Phase 40 expanded gate.
export const CORE_REQUIRED_FAMILIES: ReadonlyArray<IssueSeedFamilyId> = [
  'food_safety',
  'stock_shortage',
  'maintenance',
  'staff_burnout',
  'customer_complaint',
  'violence',
  'debt_rent',
  'inspection',
  'reputation_shift',
  'monthly_review',
]

export const EXPANDED_REQUIRED_FAMILIES: ReadonlyArray<IssueSeedFamilyId> = [
  'staff_identity',
  'regular_customer',
  'supplier_relationship',
  'faction_request',
  'culture_conflict',
  'area_atmosphere',
  'seasonal_arc',
  'policy_backlash',
  'rumour_crisis',
  'rival_tavern',
]

export const REQUIRED_FAMILIES: ReadonlyArray<IssueSeedFamilyId> = [
  ...CORE_REQUIRED_FAMILIES,
  ...EXPANDED_REQUIRED_FAMILIES,
]

export type SeedCoverageFamilyEntry = {
  family: string
  numberOfGenerators: number
  validSeedsProduced: number
  averageCardWorthiness: number
  averageResponseCount: number
  averageImpactScore: number
  commonRejectionReasons: Array<{ reason: string; count: number }>
  /** Distinct state-dependency tags surfaced by the family's seeds. */
  stateDependencies: string[]
}

export type SeedCoverageReport = {
  totalDays: number
  totalSeedsProduced: number
  totalRejected: number
  families: Record<string, SeedCoverageFamilyEntry>
  missingFamilies: string[]
}

function averageImpactScore(seeds: IssueSeed[]): number {
  if (seeds.length === 0) return 0
  let total = 0
  let count = 0
  for (const seed of seeds) {
    for (const profile of seed.consequenceProfiles) {
      total += profile.impactScore
      count += 1
    }
  }
  return count === 0 ? 0 : Math.round(total / count)
}

function averageResponseCount(seeds: IssueSeed[]): number {
  if (seeds.length === 0) return 0
  let total = 0
  for (const s of seeds) total += s.responseSlots.length
  return Math.round(total / seeds.length)
}

function averageCardWorthiness(seeds: IssueSeed[]): number {
  if (seeds.length === 0) return 0
  let total = 0
  for (const s of seeds) total += s.cardWorthiness
  return Math.round(total / seeds.length)
}

function rollupRejectionReasons(
  rejected: Array<{ family: string; templateId: string; reason: string }>,
  family: string,
): SeedCoverageFamilyEntry['commonRejectionReasons'] {
  const counts: Record<string, number> = {}
  for (const r of rejected) {
    if (r.family !== family) continue
    counts[r.reason] = (counts[r.reason] ?? 0) + 1
  }
  return Object.entries(counts)
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
}

function stateDependencies(seeds: IssueSeed[]): string[] {
  const out = new Set<string>()
  for (const seed of seeds) {
    for (const tag of seed.domain) out.add(tag)
    for (const c of seed.causes) {
      for (const t of c.tags) out.add(t)
    }
  }
  return Array.from(out).sort()
}

export function buildSeedCoverageReport(
  run: CardlessRunResult,
): SeedCoverageReport {
  const allSeeds = collectAllSeeds(run)
  const byFamily: Record<string, IssueSeed[]> = {}
  for (const seed of allSeeds) {
    const list = byFamily[seed.family] ?? []
    list.push(seed)
    byFamily[seed.family] = list
  }

  const rejected: Array<{ family: string; templateId: string; reason: string }> = []
  for (const day of run.days) {
    for (const r of getRejectedSeedsToday(day.result.state)) {
      rejected.push(r)
    }
  }

  const generatorsByFamily: Record<string, Set<string>> = {}
  for (const seed of allSeeds) {
    // Each seed has an id starting with the generator id (per Phase 19
    // §19.7); we synthesize a "template id" from the seed id prefix.
    const set = generatorsByFamily[seed.family] ?? new Set<string>()
    const tmpl = seed.id.split('--')[0] ?? seed.id
    set.add(tmpl)
    generatorsByFamily[seed.family] = set
  }

  const families: Record<string, SeedCoverageFamilyEntry> = {}
  for (const family of REQUIRED_FAMILIES) {
    const seeds = byFamily[family] ?? []
    families[family] = {
      family,
      numberOfGenerators: generatorsByFamily[family]?.size ?? 0,
      validSeedsProduced: seeds.length,
      averageCardWorthiness: averageCardWorthiness(seeds),
      averageResponseCount: averageResponseCount(seeds),
      averageImpactScore: averageImpactScore(seeds),
      commonRejectionReasons: rollupRejectionReasons(rejected, family),
      stateDependencies: stateDependencies(seeds),
    }
  }

  const missing = REQUIRED_FAMILIES.filter(
    (f) => (byFamily[f] ?? []).length === 0,
  )

  return {
    totalDays: run.days.length,
    totalSeedsProduced: allSeeds.length,
    totalRejected: rejected.length,
    families,
    missingFamilies: missing,
  }
}

// ----------------------------------------------------------------------
// Phase 20 §20.9 — Meaningful card capacity report.
// ----------------------------------------------------------------------

export type CardCapacityReport = {
  distinctSeedFamilies: number
  distinctSeedTemplates: number
  distinctActorIds: string[]
  distinctLocationIds: string[]
  distinctPressureCombinations: string[]
  distinctResponseShapes: string[]
  distinctFutureHookIds: string[]
  distinctMemoryIds: string[]
  strongCoverageFamilies: string[]
  weakCoverageFamilies: string[]
}

const STRONG_COVERAGE_THRESHOLD = 4
const WEAK_COVERAGE_THRESHOLD = 1

export function buildCardCapacityReport(
  run: CardlessRunResult,
): CardCapacityReport {
  const allSeeds = collectAllSeeds(run)
  const familySet = new Set<string>()
  const templateSet = new Set<string>()
  const actorSet = new Set<string>()
  const locationSet = new Set<string>()
  const pressureComboSet = new Set<string>()
  const shapeSet = new Set<string>()
  const hookSet = new Set<string>()
  const memorySet = new Set<string>()

  const seedsByFamily: Record<string, number> = {}

  for (const seed of allSeeds) {
    familySet.add(seed.family)
    templateSet.add(seed.id.split('--')[0] ?? seed.id)
    seedsByFamily[seed.family] = (seedsByFamily[seed.family] ?? 0) + 1
    if (seed.primaryActor) actorSet.add(seed.primaryActor.id)
    for (const a of seed.affectedActors) actorSet.add(a.id)
    if (seed.location) locationSet.add(seed.location.id)
    const pressureIds = seed.pressures.map((p) => p.id).sort().join('+')
    if (pressureIds) pressureComboSet.add(pressureIds)
    for (const slot of seed.responseSlots) shapeSet.add(slot.shape)
    for (const h of seed.futureHooks) hookSet.add(h.id)
    for (const m of seed.memoriesCreated) memorySet.add(m.id)
    for (const profile of seed.consequenceProfiles) {
      for (const h of profile.futureHooks) hookSet.add(h.id)
      for (const m of profile.memories) memorySet.add(m.id)
    }
  }

  const strong: string[] = []
  const weak: string[] = []
  for (const family of REQUIRED_FAMILIES) {
    const count = seedsByFamily[family] ?? 0
    if (count >= STRONG_COVERAGE_THRESHOLD) strong.push(family)
    else if (count <= WEAK_COVERAGE_THRESHOLD) weak.push(family)
  }

  return {
    distinctSeedFamilies: familySet.size,
    distinctSeedTemplates: templateSet.size,
    distinctActorIds: Array.from(actorSet).sort(),
    distinctLocationIds: Array.from(locationSet).sort(),
    distinctPressureCombinations: Array.from(pressureComboSet).sort(),
    distinctResponseShapes: Array.from(shapeSet).sort(),
    distinctFutureHookIds: Array.from(hookSet).sort(),
    distinctMemoryIds: Array.from(memorySet).sort(),
    strongCoverageFamilies: strong,
    weakCoverageFamilies: weak,
  }
}

// ----------------------------------------------------------------------
// Phase 20 §20.10 — Repetition audit.
// ----------------------------------------------------------------------

export type RepetitionAuditResult = {
  totalSeeds: number
  mostRepeatedSeeds: Array<{ templateId: string; family: string; count: number }>
  overusedActors: Array<{ actorId: string; count: number }>
  overusedLocations: Array<{ locationId: string; count: number }>
  underusedFamilies: string[]
  cooldownPressure: number
}

const OVERUSE_THRESHOLD = 5
const REPETITION_FAMILY_FLOOR = 1

export function buildRepetitionAudit(run: CardlessRunResult): RepetitionAuditResult {
  const allSeeds = collectAllSeeds(run)
  const templateCounts: Record<string, { family: string; count: number }> = {}
  const actorCounts: Record<string, number> = {}
  const locationCounts: Record<string, number> = {}
  const familyCounts: Record<string, number> = {}

  for (const seed of allSeeds) {
    const tmpl = seed.id.split('--')[0] ?? seed.id
    const entry = templateCounts[tmpl] ?? { family: seed.family, count: 0 }
    entry.count += 1
    templateCounts[tmpl] = entry
    if (seed.primaryActor) actorCounts[seed.primaryActor.id] = (actorCounts[seed.primaryActor.id] ?? 0) + 1
    for (const a of seed.affectedActors) {
      actorCounts[a.id] = (actorCounts[a.id] ?? 0) + 1
    }
    if (seed.location) locationCounts[seed.location.id] = (locationCounts[seed.location.id] ?? 0) + 1
    familyCounts[seed.family] = (familyCounts[seed.family] ?? 0) + 1
  }

  const mostRepeatedSeeds = Object.entries(templateCounts)
    .map(([templateId, info]) => ({ templateId, family: info.family, count: info.count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  const overusedActors = Object.entries(actorCounts)
    .filter(([, count]) => count >= OVERUSE_THRESHOLD)
    .map(([actorId, count]) => ({ actorId, count }))
    .sort((a, b) => b.count - a.count)

  const overusedLocations = Object.entries(locationCounts)
    .filter(([, count]) => count >= OVERUSE_THRESHOLD)
    .map(([locationId, count]) => ({ locationId, count }))
    .sort((a, b) => b.count - a.count)

  const underusedFamilies = REQUIRED_FAMILIES.filter(
    (f) => (familyCounts[f] ?? 0) <= REPETITION_FAMILY_FLOOR,
  )

  // Cooldown pressure: how strongly does the run rely on a small number
  // of templates? 0 means perfectly even, 100 means one template did all
  // the work.
  const total = allSeeds.length
  let cooldownPressure = 0
  if (total > 0 && mostRepeatedSeeds.length > 0) {
    const top = mostRepeatedSeeds[0]!.count
    cooldownPressure = Math.round((top / total) * 100)
  }

  return {
    totalSeeds: total,
    mostRepeatedSeeds,
    overusedActors,
    overusedLocations,
    underusedFamilies,
    cooldownPressure,
  }
}
