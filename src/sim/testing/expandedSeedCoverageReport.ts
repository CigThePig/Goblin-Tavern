import type { IssueSeed } from '../modules/issues/issueSeedTypes'
import { EXPANDED_ISSUE_SEED_FAMILIES } from '../modules/issues/issueSeedTypes'
import { getAllSeedsToday } from '../modules/issues/index'
import type { CardlessRunResult } from './simRunner'

// Phase 40 §40.7 — Expanded seed coverage report.
//
// Counts the expanded family appearances across a run and measures how
// many of those seeds carry the new ingredients the expansion arc was
// supposed to add: named entities, memory references, attribution refs,
// expanded-pressure context, and arc context.

export const EXPANDED_SEED_FAMILIES = [
  ...EXPANDED_ISSUE_SEED_FAMILIES,
] as const

export type ExpandedSeedFamilyId =
  (typeof EXPANDED_SEED_FAMILIES)[number]

export type ExpandedSeedCoverageReport = {
  totalExpandedSeeds: number
  expandedFamiliesProduced: string[]
  missingExpandedFamilies: string[]
  seedsWithNamedEntities: number
  seedsWithMemories: number
  seedsWithAttributions: number
  seedsWithExpandedPressures: number
  seedsWithArcContext: number
  averageResponseSlots: number
  /** 0–100; aggregate score across coverage axes. */
  score: number
}

const EXPANDED_FAMILY_SET = new Set<string>(EXPANDED_SEED_FAMILIES)
const EXPANDED_PRESSURE_HINTS = new Set<string>([
  'supplier_distrust',
  'regular_customer_loss',
  'staff_loyalty_risk',
  'faction_anger',
  'cultural_tension',
  'rival_tavern_pressure',
  'festival_readiness',
  'market_instability',
  'rumour_pressure',
  'policy_backlash',
  'arc_escalation',
])

function isExpanded(seed: IssueSeed): boolean {
  return EXPANDED_FAMILY_SET.has(seed.family)
}

function seedHasMemoryRef(seed: IssueSeed): boolean {
  if (seed.memoriesCreated.length > 0) return true
  if (seed.futureHooks.length > 0) return true
  if ((seed.textIngredients.relevantMemories ?? []).length > 0) return true
  for (const profile of seed.consequenceProfiles) {
    if (profile.memories.length > 0) return true
    if (profile.futureHooks.length > 0) return true
  }
  return false
}

function seedHasAttributionRef(seed: IssueSeed): boolean {
  if ((seed.textIngredients.perceivedBlame ?? []).length > 0) return true
  // Tone-hint based: rules that emitted attributions hint the seed
  // downstream (the seed shape has no tags field, only toneHints).
  for (const tag of seed.toneHints ?? []) {
    if (tag === 'attribution' || tag.startsWith('attribution:')) return true
  }
  // Look for explicit metadata pointer.
  const md = (seed as unknown as { metadata?: Record<string, unknown> }).metadata
  if (md && Array.isArray(md['attributionIds']) && md['attributionIds']!.length > 0)
    return true
  return false
}

function seedHasExpandedPressure(seed: IssueSeed): boolean {
  for (const p of seed.pressures) {
    if (EXPANDED_PRESSURE_HINTS.has(p.id)) return true
  }
  if ((seed.textIngredients.pressureContext ?? []).length > 0) {
    // Anything mentioning an expanded pressure id by name counts.
    const blob = (seed.textIngredients.pressureContext ?? []).join(' ')
    for (const id of EXPANDED_PRESSURE_HINTS) {
      if (blob.includes(id)) return true
    }
  }
  return false
}

function seedHasArcContext(seed: IssueSeed): boolean {
  if ((seed.textIngredients.arcContext ?? []).length > 0) return true
  if (seed.family === 'seasonal_arc') return true
  if (seed.affectedActors.some((a) => a.kind === 'local_event')) return true
  return false
}

function seedHasNamedEntities(seed: IssueSeed): boolean {
  return (seed.textIngredients.namedEntities ?? []).length > 0
}

/** Build the expanded seed coverage report across a multi-day run. */
export function buildExpandedSeedCoverageReport(
  run: CardlessRunResult,
): ExpandedSeedCoverageReport {
  const familiesSeen = new Set<string>()
  let total = 0
  let withNamed = 0
  let withMemories = 0
  let withAttributions = 0
  let withExpandedPressures = 0
  let withArc = 0
  let slotTotal = 0
  for (const day of run.days) {
    for (const seed of getAllSeedsToday(day.result.state)) {
      if (!isExpanded(seed)) continue
      total += 1
      familiesSeen.add(seed.family)
      if (seedHasNamedEntities(seed)) withNamed += 1
      if (seedHasMemoryRef(seed)) withMemories += 1
      if (seedHasAttributionRef(seed)) withAttributions += 1
      if (seedHasExpandedPressure(seed)) withExpandedPressures += 1
      if (seedHasArcContext(seed)) withArc += 1
      slotTotal += seed.responseSlots.length
    }
  }

  const missing = EXPANDED_SEED_FAMILIES.filter(
    (f) => !familiesSeen.has(f),
  )
  const averageResponseSlots = total === 0 ? 0 : slotTotal / total
  const expandedFamiliesProduced = Array.from(familiesSeen).sort()

  // Scoring axes:
  //   1. Family coverage: produced / 10.
  //   2. Named-entity coverage: seedsWithNamedEntities / total.
  //   3. Memory coverage: seedsWithMemories / total.
  //   4. Expanded-pressure coverage: seedsWithExpandedPressures / total.
  //   5. Response richness: averageResponseSlots / 3.
  const familyAxis = Math.round(
    (expandedFamiliesProduced.length / EXPANDED_SEED_FAMILIES.length) * 100,
  )
  const namedAxis = total === 0 ? 0 : Math.round((withNamed / total) * 100)
  const memoryAxis = total === 0 ? 0 : Math.round((withMemories / total) * 100)
  const pressureAxis =
    total === 0 ? 0 : Math.round((withExpandedPressures / total) * 100)
  const richnessAxis = Math.min(
    100,
    Math.round((averageResponseSlots / 3) * 100),
  )
  const score = Math.round(
    (familyAxis + namedAxis + memoryAxis + pressureAxis + richnessAxis) / 5,
  )

  return {
    totalExpandedSeeds: total,
    expandedFamiliesProduced,
    missingExpandedFamilies: missing,
    seedsWithNamedEntities: withNamed,
    seedsWithMemories: withMemories,
    seedsWithAttributions: withAttributions,
    seedsWithExpandedPressures: withExpandedPressures,
    seedsWithArcContext: withArc,
    averageResponseSlots,
    score,
  }
}
