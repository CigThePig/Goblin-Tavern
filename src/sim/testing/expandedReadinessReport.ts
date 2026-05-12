import type { TavernState, EntityRef, MemoryState } from '../state/TavernState'
import type { IssueSeed } from '../modules/issues/issueSeedTypes'
import type { AttributionState } from '../modules/attribution/attributionTypes'
import type { ExpandedPressureId } from '../modules/pressures/pressureTypes'
import { EXPANDED_PRESSURE_IDS } from '../modules/pressures/pressureTypes'
import { EXPANDED_FEEDBACK_LOOPS } from '../modules/feedback/index'
import { getAllSeedsToday } from '../modules/issues/index'
import { memoryOwner, memorySubjects, memoryBlamed, memoryCredited } from '../modules/memories/index'
import {
  buildReadinessReport,
  type ReadinessReport,
} from './readinessReport'
import { runCardlessSim, runMonths, type CardlessRunResult } from './simRunner'
import {
  auditRunForExpandedContradictions,
  type ExpandedContradictionAuditResult,
} from './expandedContradictionAudit'
import {
  buildExpandedSeedCoverageReport,
  EXPANDED_SEED_FAMILIES,
  type ExpandedSeedCoverageReport,
} from './expandedSeedCoverageReport'

// Phase 40 §40.1–§40.15 — Expanded card-fuel readiness report.
//
// Mirrors the Phase 20 readiness report and gate, but measures the
// expansion-arc systems instead of the core ten dimensions. Both
// reports must pass before the expanded card layer can be built.

// ----------------------------------------------------------------------
// §40.1 — Report shape and thresholds.
// ----------------------------------------------------------------------

export type ExpandedReadinessSection = {
  id: string
  score: number
  threshold: number
  passed: boolean
  notes: string[]
}

export type ExpandedReadinessReport = {
  passed: boolean
  sections: ExpandedReadinessSection[]
  scores: Record<string, number>
  coreReadinessPassed: boolean
  coreReadiness: ReadinessReport
  identityRichness: IdentityRichnessReport
  entityMemoryQuality: EntityMemoryQualityReport
  attributionQuality: AttributionQualityReport
  expandedPressureQuality: ExpandedPressureQualityReport
  expandedSeedCoverage: ExpandedSeedCoverageReport
  textIngredientQuality: TextIngredientQualityReport
  namedEntityRepetition: NamedEntityRepetitionAudit
  arcAndCalendarUse: ArcAndCalendarUseReport
  socialConsequenceQuality: SocialConsequenceQualityReport
  expandedContradictionAudit: ExpandedContradictionAuditResult
  replayIdentical: boolean
}

export const EXPANDED_READINESS_THRESHOLDS = {
  identity_richness: 70,
  entity_memory_quality: 70,
  attribution_quality: 65,
  expanded_pressure_quality: 70,
  expanded_seed_coverage: 65,
  text_ingredient_quality: 75,
  named_entity_repetition: 70,
  arc_and_calendar_use: 60,
  social_consequence_quality: 70,
  expanded_contradiction_safety: 90,
} as const

export const EXPANDED_READINESS_SECTION_IDS = [
  'identity_richness',
  'entity_memory_quality',
  'attribution_quality',
  'expanded_pressure_quality',
  'expanded_seed_coverage',
  'text_ingredient_quality',
  'named_entity_repetition',
  'arc_and_calendar_use',
  'social_consequence_quality',
  'expanded_contradiction_safety',
] as const

// ----------------------------------------------------------------------
// §40.3 — Identity richness report.
// ----------------------------------------------------------------------

export type IdentityRichnessReport = {
  namedStaff: number
  namedRegulars: number
  namedSuppliers: number
  namedFactions: number
  namingProfilesUsed: string[]
  duplicateDisplayNames: string[]
  entitiesWithMissingNames: string[]
  score: number
}

export function buildIdentityRichnessReport(
  state: TavernState,
): IdentityRichnessReport {
  const profiles = new Set<string>()
  const displayNames: string[] = []
  const missing: string[] = []

  let namedStaff = 0
  for (const staff of Object.values(state.staff)) {
    const name = (staff as { name?: { display?: string; profileId?: string } }).name
    if (name?.display && name.display.trim().length > 0) {
      namedStaff += 1
      displayNames.push(name.display)
      if (name.profileId) profiles.add(name.profileId)
    } else {
      missing.push(`staff:${staff.id}`)
    }
  }

  let namedRegulars = 0
  for (const reg of Object.values(state.world.regulars)) {
    if (reg.name?.display && reg.name.display.trim().length > 0) {
      namedRegulars += 1
      displayNames.push(reg.name.display)
      profiles.add(reg.name.profileId)
    } else {
      missing.push(`regular:${reg.id}`)
    }
  }

  let namedSuppliers = 0
  for (const sup of Object.values(state.world.suppliers)) {
    if (sup.name?.display && sup.name.display.trim().length > 0) {
      namedSuppliers += 1
      displayNames.push(sup.name.display)
      profiles.add(sup.name.profileId)
    } else if (sup.label && sup.label.trim().length > 0) {
      // Suppliers can keep their label as the public name; only flag if
      // truly anonymous.
      namedSuppliers += 1
      displayNames.push(sup.label)
    } else {
      missing.push(`supplier:${sup.id}`)
    }
  }

  const namedFactions = Object.values(state.world.factions).filter(
    (f) => f.label && f.label.trim().length > 0,
  ).length

  const duplicates: string[] = []
  const seen = new Map<string, number>()
  for (const name of displayNames) {
    const c = (seen.get(name) ?? 0) + 1
    seen.set(name, c)
  }
  for (const [name, count] of seen) {
    if (count > 1) duplicates.push(name)
  }

  let score = 0
  if (namedStaff >= 3) score += 20
  if (namedRegulars >= 3) score += 15
  if (namedSuppliers >= 2) score += 15
  if (Object.keys(state.world.factions).length >= 2) score += 10
  if (profiles.size >= 4) score += 20
  if (missing.length === 0 && duplicates.length === 0) score += 20

  return {
    namedStaff,
    namedRegulars,
    namedSuppliers,
    namedFactions,
    namingProfilesUsed: Array.from(profiles).sort(),
    duplicateDisplayNames: duplicates.sort(),
    entitiesWithMissingNames: missing.sort(),
    score: Math.min(100, score),
  }
}

// ----------------------------------------------------------------------
// §40.4 — Entity memory quality report.
// ----------------------------------------------------------------------

export type EntityMemoryQualityReport = {
  totalEntityMemories: number
  memoriesWithOwners: number
  memoriesWithRealTargets: number
  staffMemories: number
  regularMemories: number
  supplierMemories: number
  factionMemories: number
  areaMemories: number
  arcMemories: number
  strongMemories: number
  score: number
}

function isEntityMemory(m: MemoryState): boolean {
  // A memory counts as "entity-scoped" if it has an owner, named subject,
  // blamed/credited refs, or actor refs of an entity kind.
  const md = (m.metadata ?? {}) as Record<string, unknown>
  if (md['owner']) return true
  if (Array.isArray(md['subjects']) && (md['subjects'] as unknown[]).length > 0)
    return true
  if (Array.isArray(md['blamed']) && (md['blamed'] as unknown[]).length > 0)
    return true
  if (Array.isArray(md['credited']) && (md['credited'] as unknown[]).length > 0)
    return true
  return m.actors.length > 0
}

function memoryHasRealTarget(state: TavernState, m: MemoryState): boolean {
  const candidates: EntityRef[] = []
  const own = memoryOwner(m)
  if (own) candidates.push(own)
  for (const s of memorySubjects(m)) candidates.push(s)
  for (const a of m.actors) candidates.push(a)
  for (const ref of candidates) {
    switch (ref.kind) {
      case 'staff':
        if (state.staff[ref.id]) return true
        break
      case 'customer_group':
        if (state.customerGroups[ref.id]) return true
        break
      case 'area':
        if (state.areas[ref.id]) return true
        break
      case 'stock':
        if (state.stock[ref.id]) return true
        break
      case 'culture':
        if (state.world.cultures[ref.id]) return true
        break
      case 'faction':
        if (state.world.factions[ref.id]) return true
        break
      case 'supplier':
        if (state.world.suppliers[ref.id]) return true
        break
      case 'regular':
        if (state.world.regulars[ref.id]) return true
        break
      case 'notable_npc':
        if (state.world.notableNpcs[ref.id]) return true
        break
      case 'local_event':
        if (state.world.localEvents[ref.id]) return true
        break
      case 'rumour':
        if (state.world.socialRumours[ref.id]) return true
        break
      case 'tavern_identity':
        return true
      default:
        break
    }
  }
  return false
}

export function buildEntityMemoryQualityReport(
  state: TavernState,
): EntityMemoryQualityReport {
  let total = 0
  let withOwner = 0
  let withRealTarget = 0
  let staff = 0
  let regular = 0
  let supplier = 0
  let faction = 0
  let area = 0
  let arc = 0
  let strong = 0

  for (const m of state.memories) {
    if (!isEntityMemory(m)) continue
    total += 1
    if (memoryOwner(m)) withOwner += 1
    if (memoryHasRealTarget(state, m)) withRealTarget += 1
    if (m.strength >= 60) strong += 1
    const owner = memoryOwner(m)
    const refs: EntityRef[] = [
      ...(owner ? [owner] : []),
      ...memorySubjects(m),
      ...memoryBlamed(m),
      ...memoryCredited(m),
      ...m.actors,
    ]
    const kinds = new Set(refs.map((r) => r.kind))
    if (kinds.has('staff')) staff += 1
    if (kinds.has('regular')) regular += 1
    if (kinds.has('supplier')) supplier += 1
    if (kinds.has('faction')) faction += 1
    if (kinds.has('area')) area += 1
    if (kinds.has('local_event')) arc += 1
  }

  const ownerCoverage = total === 0 ? 0 : withOwner / total
  const targetCoverage = total === 0 ? 0 : withRealTarget / total
  const categoryBuckets = [staff, regular, supplier, faction, area, arc].filter(
    (n) => n > 0,
  ).length
  const strongScore = Math.min(100, strong * 10)

  // Aggregate score:
  //   ownerCoverage and targetCoverage weighted heavily, plus category
  //   spread (up to 6 categories) and strong memory volume.
  const ownerAxis = Math.round(ownerCoverage * 100)
  const targetAxis = Math.round(targetCoverage * 100)
  const categoryAxis = Math.min(100, categoryBuckets * 20)
  const score = Math.round(
    (ownerAxis + targetAxis + categoryAxis + strongScore) / 4,
  )

  return {
    totalEntityMemories: total,
    memoriesWithOwners: withOwner,
    memoriesWithRealTargets: withRealTarget,
    staffMemories: staff,
    regularMemories: regular,
    supplierMemories: supplier,
    factionMemories: faction,
    areaMemories: area,
    arcMemories: arc,
    strongMemories: strong,
    score,
  }
}

// ----------------------------------------------------------------------
// §40.5 — Attribution quality report.
// ----------------------------------------------------------------------

export type AttributionQualityReport = {
  totalAttributions: number
  blameCount: number
  creditCount: number
  falseOrPartialCount: number
  publicAttributions: number
  attributionsWithSources: number
  attributionsCreatingMemories: number
  score: number
}

type AttributionSlice = {
  attributions?: AttributionState[]
}

function collectAttributions(state: TavernState): AttributionState[] {
  const slice = state.modules.attribution as AttributionSlice | undefined
  return slice?.attributions ?? []
}

export function buildAttributionQualityReport(
  state: TavernState,
): AttributionQualityReport {
  const attributions = collectAttributions(state)
  let blame = 0
  let credit = 0
  let falseOrPartial = 0
  let publicly = 0
  let withSources = 0
  let memoryRefs = 0

  // Build a quick lookup: did any memory cite this attribution id?
  const attributionMemoryIds = new Set<string>()
  for (const m of state.memories) {
    const md = (m.metadata ?? {}) as Record<string, unknown>
    const ids = md['sourceAttributionIds']
    if (Array.isArray(ids)) for (const id of ids) attributionMemoryIds.add(String(id))
    const single = md['sourceAttributionId']
    if (typeof single === 'string') attributionMemoryIds.add(single)
  }

  for (const a of attributions) {
    if (a.attributionType === 'blame' || a.attributionType === 'resentment') {
      blame += 1
    }
    if (
      a.attributionType === 'credit' ||
      a.attributionType === 'gratitude' ||
      a.attributionType === 'trust'
    ) {
      credit += 1
    }
    if (a.accuracy === 'partial' || a.accuracy === 'false' || a.accuracy === 'unknown') {
      falseOrPartial += 1
    }
    if (a.publicness >= 60) publicly += 1
    if (
      a.sourceCauseIds.length > 0 ||
      a.sourceMemoryIds.length > 0 ||
      a.sourceSceneIds.length > 0 ||
      a.sourceEventId
    ) {
      withSources += 1
    }
    if (attributionMemoryIds.has(a.id)) memoryRefs += 1
  }

  let score = 0
  if (blame >= 1) score += 20
  if (credit >= 1) score += 20
  if (falseOrPartial >= 1) score += 15
  if (
    attributions.length > 0 &&
    withSources / attributions.length >= 0.7
  )
    score += 20
  if (memoryRefs >= 1) score += 15
  if (publicly >= 1) score += 10

  // If no attributions exist, score is still computed but capped at 0.
  if (attributions.length === 0) {
    score = 0
  }

  return {
    totalAttributions: attributions.length,
    blameCount: blame,
    creditCount: credit,
    falseOrPartialCount: falseOrPartial,
    publicAttributions: publicly,
    attributionsWithSources: withSources,
    attributionsCreatingMemories: memoryRefs,
    score: Math.min(100, score),
  }
}

// ----------------------------------------------------------------------
// §40.6 — Expanded pressure quality report.
// ----------------------------------------------------------------------

export type ExpandedPressureQualityReport = {
  expandedPressuresMoved: string[]
  expandedPressuresHighSeverity: string[]
  pressuresWithNamedCauses: string[]
  pressureWebsActivated: string[]
  score: number
}

const EXPANDED_PRESSURE_SET = new Set<string>(EXPANDED_PRESSURE_IDS)
const EXPANDED_FEEDBACK_IDS = new Set<string>(
  EXPANDED_FEEDBACK_LOOPS.map((l) => l.id),
)

export function buildExpandedPressureQualityReport(
  run: CardlessRunResult,
): ExpandedPressureQualityReport {
  const moved = new Set<string>()
  const highSeverity = new Set<string>()
  const namedCauses = new Set<string>()
  const websActivated = new Set<string>()

  for (const day of run.days) {
    for (const p of Object.values(day.result.state.pressures)) {
      if (!EXPANDED_PRESSURE_SET.has(p.id)) continue
      if (p.trend !== 0) moved.add(p.id)
      if (p.value >= 60) highSeverity.add(p.id)
      const slice = day.result.state.modules.pressures as
        | { snapshots?: Record<string, { causes?: Array<{ relatedActors?: EntityRef[] }> }> }
        | undefined
      const snap = slice?.snapshots?.[p.id]
      for (const c of snap?.causes ?? []) {
        const refs = c.relatedActors ?? []
        for (const r of refs) {
          if (
            r.kind === 'staff' ||
            r.kind === 'regular' ||
            r.kind === 'supplier' ||
            r.kind === 'faction' ||
            r.kind === 'culture' ||
            r.kind === 'notable_npc' ||
            r.kind === 'local_event'
          ) {
            namedCauses.add(p.id)
          }
        }
      }
    }
    const fb = day.result.state.modules.feedback as
      | { activeLoopIds?: string[]; loops?: Record<string, { active?: boolean }> }
      | undefined
    for (const id of fb?.activeLoopIds ?? []) {
      if (EXPANDED_FEEDBACK_IDS.has(id)) websActivated.add(id)
    }
    for (const [id, loop] of Object.entries(fb?.loops ?? {})) {
      if (EXPANDED_FEEDBACK_IDS.has(id) && loop.active) websActivated.add(id)
    }
  }

  const movementScore = Math.min(100, moved.size * 10)
  const namedCauseScore = Math.min(100, namedCauses.size * 15)
  const webScore = Math.min(100, websActivated.size * 25)
  const score = Math.round((movementScore + namedCauseScore + webScore) / 3)

  return {
    expandedPressuresMoved: Array.from(moved).sort(),
    expandedPressuresHighSeverity: Array.from(highSeverity).sort(),
    pressuresWithNamedCauses: Array.from(namedCauses).sort(),
    pressureWebsActivated: Array.from(websActivated).sort(),
    score,
  }
}

// ----------------------------------------------------------------------
// §40.8 — Text ingredient quality report.
// ----------------------------------------------------------------------

export type TextIngredientQualityReport = {
  totalSeedsChecked: number
  seedsWithSubject: number
  seedsWithNamedEntities: number
  seedsWithRecentContext: number
  seedsWithStakes: number
  seedsOverBudget: number
  seedsWithCardProseSmell: number
  score: number
}

function countWords(s: string): number {
  return s
    .trim()
    .split(/\s+/)
    .filter((part) => part.length > 0).length
}

/** Heuristic: spot ingredients that read like prose instead of fragments. */
export function detectCardProseSmell(ingredient: string): boolean {
  if (typeof ingredient !== 'string') return false
  const trimmed = ingredient.trim()
  if (trimmed.length === 0) return false
  if (countWords(trimmed) > 16) return true
  if (/[.!?]{2,}|[!?]\.|\.\.\./.test(trimmed)) return true
  if (/["“”'‘’].*["“”'‘’]/.test(trimmed)) return true
  // Multiple clauses: at least three commas/semicolons.
  const clauseSeparators = (trimmed.match(/[,;]/g) ?? []).length
  if (clauseSeparators >= 3) return true
  // Second-person commands like "You must …" or starting with imperative
  // verbs typical for cards.
  if (/^\s*you\b/i.test(trimmed)) return true
  if (/^\s*(do|don't|stop|start|tell|give|pay|find|listen)\b/i.test(trimmed))
    return true
  return false
}

function collectIngredientStrings(seed: IssueSeed): string[] {
  const t = seed.textIngredients
  const out: string[] = []
  if (t.subject) out.push(t.subject)
  if (t.problemNoun) out.push(t.problemNoun)
  out.push(...t.sensoryDetails)
  out.push(...Object.values(t.actorOpinions))
  out.push(...t.recentContext)
  out.push(...t.stakesReadable)
  for (const ne of t.namedEntities ?? []) out.push(ne.displayName)
  if (t.socialContext) out.push(...t.socialContext)
  if (t.relevantMemories) out.push(...t.relevantMemories)
  if (t.perceivedBlame) out.push(...t.perceivedBlame)
  if (t.pressureContext) out.push(...t.pressureContext)
  if (t.calendarContext) out.push(...t.calendarContext)
  if (t.marketContext) out.push(...t.marketContext)
  if (t.arcContext) out.push(...t.arcContext)
  return out
}

export function buildTextIngredientQualityReport(
  run: CardlessRunResult,
): TextIngredientQualityReport {
  let total = 0
  let withSubject = 0
  let withNamed = 0
  let withContext = 0
  let withStakes = 0
  let overBudget = 0
  let smelly = 0
  for (const day of run.days) {
    for (const seed of getAllSeedsToday(day.result.state)) {
      total += 1
      if (seed.textIngredients.subject && seed.textIngredients.subject.trim().length > 0) {
        withSubject += 1
      }
      if ((seed.textIngredients.namedEntities ?? []).length > 0) withNamed += 1
      if (seed.textIngredients.recentContext.length > 0) withContext += 1
      if (seed.textIngredients.stakesReadable.length > 0) withStakes += 1
      if (seed.validation.warnings.length > 0) {
        for (const w of seed.validation.warnings) {
          if (w.includes('over budget') || w.includes('over_budget') || w.includes('exceeds')) {
            overBudget += 1
            break
          }
        }
      }
      for (const ing of collectIngredientStrings(seed)) {
        if (detectCardProseSmell(ing)) {
          smelly += 1
          break
        }
      }
    }
  }
  // Score: weighted positives, subtract for smell and over-budget.
  const subjectAxis = total === 0 ? 0 : Math.round((withSubject / total) * 100)
  const namedAxis = total === 0 ? 0 : Math.round((withNamed / total) * 100)
  const contextAxis = total === 0 ? 0 : Math.round((withContext / total) * 100)
  const stakesAxis = total === 0 ? 0 : Math.round((withStakes / total) * 100)
  const smellPenalty = total === 0 ? 0 : Math.round((smelly / total) * 100)
  const overBudgetPenalty = total === 0 ? 0 : Math.round((overBudget / total) * 100)
  const positives = Math.round(
    (subjectAxis + namedAxis + contextAxis + stakesAxis) / 4,
  )
  const score = Math.max(0, positives - smellPenalty - overBudgetPenalty)

  return {
    totalSeedsChecked: total,
    seedsWithSubject: withSubject,
    seedsWithNamedEntities: withNamed,
    seedsWithRecentContext: withContext,
    seedsWithStakes: withStakes,
    seedsOverBudget: overBudget,
    seedsWithCardProseSmell: smelly,
    score,
  }
}

// ----------------------------------------------------------------------
// §40.9 — Named entity repetition audit.
// ----------------------------------------------------------------------

export type NamedEntityRepetitionAudit = {
  totalNamedEntityUses: number
  overusedEntities: Array<{ refKey: string; count: number }>
  overusedFamilies: Array<{ family: string; count: number }>
  duplicateNames: string[]
  sameActorConsecutiveSeeds: number
  score: number
}

function refKey(ref: EntityRef): string {
  return `${ref.kind}:${ref.id}`
}

export function buildNamedEntityRepetitionAudit(
  run: CardlessRunResult,
): NamedEntityRepetitionAudit {
  const entityCounts = new Map<string, number>()
  const familyEntityCounts = new Map<string, Map<string, number>>()
  const nameSeen = new Map<string, Set<string>>()
  let totalUses = 0
  let consecutive = 0
  let prevPrimary: string | null = null

  for (const day of run.days) {
    for (const seed of getAllSeedsToday(day.result.state)) {
      const refs: EntityRef[] = []
      if (seed.primaryActor) refs.push(seed.primaryActor)
      for (const a of seed.affectedActors) refs.push(a)
      for (const ne of seed.textIngredients.namedEntities ?? []) refs.push(ne.ref)
      for (const ref of refs) {
        const key = refKey(ref)
        entityCounts.set(key, (entityCounts.get(key) ?? 0) + 1)
        totalUses += 1
        let fam = familyEntityCounts.get(seed.family)
        if (!fam) {
          fam = new Map()
          familyEntityCounts.set(seed.family, fam)
        }
        fam.set(key, (fam.get(key) ?? 0) + 1)
      }
      const primaryKey = seed.primaryActor ? refKey(seed.primaryActor) : null
      if (primaryKey && prevPrimary && primaryKey === prevPrimary) consecutive += 1
      prevPrimary = primaryKey

      // Track duplicate display names that map to different refs.
      for (const ne of seed.textIngredients.namedEntities ?? []) {
        const set = nameSeen.get(ne.displayName) ?? new Set<string>()
        set.add(refKey(ne.ref))
        nameSeen.set(ne.displayName, set)
      }
    }
  }

  const overused: Array<{ refKey: string; count: number }> = []
  for (const [key, count] of entityCounts) {
    if (count >= 6) overused.push({ refKey: key, count })
  }
  overused.sort((a, b) => b.count - a.count)

  const overusedFamilies: Array<{ family: string; count: number }> = []
  for (const [family, counts] of familyEntityCounts) {
    for (const [, c] of counts) {
      if (c >= 4) {
        overusedFamilies.push({ family, count: c })
        break
      }
    }
  }

  const duplicates: string[] = []
  for (const [name, refs] of nameSeen) {
    if (refs.size > 1) duplicates.push(name)
  }

  // Score: start at 100, subtract for overuse + duplicates + consecutive
  // repeats.
  let score = 100
  score -= Math.min(40, overused.length * 10)
  score -= Math.min(30, overusedFamilies.length * 6)
  score -= Math.min(20, duplicates.length * 10)
  score -= Math.min(20, consecutive * 2)
  score = Math.max(0, score)

  return {
    totalNamedEntityUses: totalUses,
    overusedEntities: overused,
    overusedFamilies,
    duplicateNames: duplicates.sort(),
    sameActorConsecutiveSeeds: consecutive,
    score,
  }
}

// ----------------------------------------------------------------------
// §40.10 — Arc and calendar use report.
// ----------------------------------------------------------------------

export type ArcAndCalendarUseReport = {
  activeArcsSeen: string[]
  arcSeedsProduced: number
  calendarTagsUsedBySeeds: string[]
  festivalReadinessMoved: boolean
  marketConditionsUsedBySeeds: string[]
  score: number
}

export function buildArcAndCalendarUseReport(
  run: CardlessRunResult,
): ArcAndCalendarUseReport {
  const arcs = new Set<string>()
  let arcSeeds = 0
  const calendarTags = new Set<string>()
  const marketConditions = new Set<string>()
  let festivalMoved = false

  for (const day of run.days) {
    for (const ev of Object.values(day.result.state.world.localEvents)) {
      if (ev.stage && ev.stage !== 'resolved' && ev.stage !== 'failed') {
        arcs.add(ev.id)
      } else if (!ev.stage) {
        arcs.add(ev.id)
      }
    }
    const pressure = day.result.state.pressures['festival_readiness']
    if (pressure && pressure.trend !== 0) festivalMoved = true

    for (const seed of getAllSeedsToday(day.result.state)) {
      if (seed.family === 'seasonal_arc') arcSeeds += 1
      if (seed.affectedActors.some((a) => a.kind === 'local_event')) arcSeeds += 1
      for (const ctx of seed.textIngredients.calendarContext ?? []) {
        const trimmed = ctx.trim()
        if (trimmed.length === 0) continue
        if (trimmed.startsWith('tag:')) calendarTags.add(trimmed.slice('tag:'.length))
        else calendarTags.add(trimmed)
      }
      for (const ctx of seed.textIngredients.marketContext ?? []) {
        const trimmed = ctx.trim()
        if (trimmed.length === 0) continue
        if (trimmed.startsWith('market:'))
          marketConditions.add(trimmed.slice('market:'.length))
        else marketConditions.add(trimmed)
      }
    }
  }

  // Scoring:
  //   arcs seen (up to 4) × 15
  //   arcSeeds (any) → +20
  //   calendarTagsUsed (up to 3) × 10
  //   marketConditions (any) → +10
  //   festivalReadinessMoved → +10
  let score = 0
  score += Math.min(60, arcs.size * 15)
  if (arcSeeds > 0) score += 20
  score += Math.min(30, calendarTags.size * 10)
  if (marketConditions.size > 0) score += 10
  if (festivalMoved) score += 10
  score = Math.min(100, score)

  return {
    activeArcsSeen: Array.from(arcs).sort(),
    arcSeedsProduced: arcSeeds,
    calendarTagsUsedBySeeds: Array.from(calendarTags).sort(),
    festivalReadinessMoved: festivalMoved,
    marketConditionsUsedBySeeds: Array.from(marketConditions).sort(),
    score,
  }
}

// ----------------------------------------------------------------------
// §40.11 — Social consequence quality report.
// ----------------------------------------------------------------------

export type SocialConsequenceQualityReport = {
  responseProfilesChecked: number
  profilesCreatingMemories: number
  profilesCreatingAttributionHooks: number
  profilesAffectingNamedEntities: number
  profilesAffectingExpandedPressures: number
  averageImpactScore: number
  score: number
}

const NAMED_ENTITY_KINDS = new Set<string>([
  'staff',
  'regular',
  'supplier',
  'faction',
  'culture',
  'notable_npc',
  'local_event',
])

export function buildSocialConsequenceQualityReport(
  run: CardlessRunResult,
): SocialConsequenceQualityReport {
  let total = 0
  let withMemories = 0
  let withAttributionHook = 0
  let withNamedEntity = 0
  let withExpandedPressure = 0
  let impactSum = 0

  for (const day of run.days) {
    for (const seed of getAllSeedsToday(day.result.state)) {
      // Only score expanded seeds — those are what the expansion arc is
      // supposed to feed.
      if (
        !EXPANDED_SEED_FAMILIES.includes(
          seed.family as (typeof EXPANDED_SEED_FAMILIES)[number],
        )
      ) {
        continue
      }
      for (const profile of seed.consequenceProfiles) {
        total += 1
        impactSum += profile.impactScore
        if (profile.memories.length > 0) withMemories += 1
        const hasFutureHook =
          profile.futureHooks.length > 0 ||
          profile.memories.some((m) =>
            (m.tags ?? []).includes('attribution'),
          )
        if (hasFutureHook) withAttributionHook += 1
        const targetsNamedEntity =
          profile.memories.some((m) =>
            (m.actors ?? []).some((a) => NAMED_ENTITY_KINDS.has(a.kind)),
          ) ||
          (seed.primaryActor &&
            NAMED_ENTITY_KINDS.has(seed.primaryActor.kind)) ||
          seed.affectedActors.some((a) => NAMED_ENTITY_KINDS.has(a.kind))
        if (targetsNamedEntity) withNamedEntity += 1
        const seedPressureIds = new Set(seed.pressures.map((p) => p.id))
        let touchesExpandedPressure = false
        for (const p of seedPressureIds) {
          if (EXPANDED_PRESSURE_SET.has(p)) {
            touchesExpandedPressure = true
            break
          }
        }
        if (touchesExpandedPressure) withExpandedPressure += 1
      }
    }
  }

  const memoryAxis = total === 0 ? 0 : Math.round((withMemories / total) * 100)
  const namedAxis = total === 0 ? 0 : Math.round((withNamedEntity / total) * 100)
  const pressureAxis =
    total === 0 ? 0 : Math.round((withExpandedPressure / total) * 100)
  const impactAxis = total === 0 ? 0 : Math.round(impactSum / total)
  const score = Math.round(
    (memoryAxis + namedAxis + pressureAxis + impactAxis) / 4,
  )
  const averageImpactScore = total === 0 ? 0 : impactSum / total

  return {
    responseProfilesChecked: total,
    profilesCreatingMemories: withMemories,
    profilesCreatingAttributionHooks: withAttributionHook,
    profilesAffectingNamedEntities: withNamedEntity,
    profilesAffectingExpandedPressures: withExpandedPressure,
    averageImpactScore,
    score,
  }
}

// ----------------------------------------------------------------------
// §40.13 — Build expanded readiness report.
// ----------------------------------------------------------------------

export type ExpandedReadinessConfig = {
  days?: number
  seed?: string
}

function stripVolatile(state: TavernState): unknown {
  return JSON.parse(JSON.stringify(state))
}

export function buildExpandedReadinessReport(
  config: ExpandedReadinessConfig = {},
): ExpandedReadinessReport {
  const seed = config.seed ?? 'phase40-expanded-readiness-anchor'
  const days = config.days ?? 84

  // 1. Core Phase 20 readiness has to pass.
  const coreReadiness = buildReadinessReport({ seed, days: Math.min(days, 28) })

  // 2. Expanded 3-month run plus replay determinism check.
  const expandedRun =
    days === 84 ? runMonths(3, { seed }) : runCardlessSim({ seed, days })
  const replayRun =
    days === 84 ? runMonths(3, { seed }) : runCardlessSim({ seed, days })
  const replayIdentical =
    JSON.stringify(stripVolatile(expandedRun.finalState)) ===
    JSON.stringify(stripVolatile(replayRun.finalState))

  // 3. Build sub-reports.
  const identityRichness = buildIdentityRichnessReport(expandedRun.finalState)
  const entityMemoryQuality = buildEntityMemoryQualityReport(expandedRun.finalState)
  const attributionQuality = buildAttributionQualityReport(expandedRun.finalState)
  const expandedPressureQuality = buildExpandedPressureQualityReport(expandedRun)
  const expandedSeedCoverage = buildExpandedSeedCoverageReport(expandedRun)
  const textIngredientQuality = buildTextIngredientQualityReport(expandedRun)
  const namedEntityRepetition = buildNamedEntityRepetitionAudit(expandedRun)
  const arcAndCalendarUse = buildArcAndCalendarUseReport(expandedRun)
  const socialConsequenceQuality = buildSocialConsequenceQualityReport(expandedRun)
  const expandedContradictionAudit = auditRunForExpandedContradictions(expandedRun)

  // 4. Score and assemble sections.
  const sections: ExpandedReadinessSection[] = [
    section(
      'identity_richness',
      identityRichness.score,
      [
        `${identityRichness.namedStaff} named staff`,
        `${identityRichness.namedRegulars} named regulars`,
        `${identityRichness.namedSuppliers} named suppliers`,
        `${identityRichness.namedFactions} factions`,
        `${identityRichness.namingProfilesUsed.length} naming profiles used`,
      ],
    ),
    section('entity_memory_quality', entityMemoryQuality.score, [
      `${entityMemoryQuality.totalEntityMemories} entity memories`,
      `${entityMemoryQuality.memoriesWithOwners} with owners`,
      `${entityMemoryQuality.memoriesWithRealTargets} with real targets`,
      `${entityMemoryQuality.strongMemories} strong memories`,
    ]),
    section('attribution_quality', attributionQuality.score, [
      `${attributionQuality.totalAttributions} attributions`,
      `${attributionQuality.blameCount} blame, ${attributionQuality.creditCount} credit`,
      `${attributionQuality.attributionsWithSources} with source refs`,
    ]),
    section('expanded_pressure_quality', expandedPressureQuality.score, [
      `${expandedPressureQuality.expandedPressuresMoved.length} expanded pressures moved`,
      `${expandedPressureQuality.pressuresWithNamedCauses.length} with named causes`,
      `${expandedPressureQuality.pressureWebsActivated.length} expanded webs activated`,
    ]),
    section('expanded_seed_coverage', expandedSeedCoverage.score, [
      `${expandedSeedCoverage.expandedFamiliesProduced.length}/${EXPANDED_SEED_FAMILIES.length} expanded families produced`,
      ...(expandedSeedCoverage.missingExpandedFamilies.length > 0
        ? [`missing: ${expandedSeedCoverage.missingExpandedFamilies.join(', ')}`]
        : []),
    ]),
    section('text_ingredient_quality', textIngredientQuality.score, [
      `${textIngredientQuality.totalSeedsChecked} seeds checked`,
      `${textIngredientQuality.seedsWithCardProseSmell} prose-smell flags`,
      `${textIngredientQuality.seedsOverBudget} over budget`,
    ]),
    section('named_entity_repetition', namedEntityRepetition.score, [
      `${namedEntityRepetition.totalNamedEntityUses} named entity uses`,
      `${namedEntityRepetition.overusedEntities.length} overused entities`,
      `${namedEntityRepetition.duplicateNames.length} duplicate names`,
    ]),
    section('arc_and_calendar_use', arcAndCalendarUse.score, [
      `${arcAndCalendarUse.activeArcsSeen.length} active arcs seen`,
      `${arcAndCalendarUse.arcSeedsProduced} arc seeds produced`,
      `${arcAndCalendarUse.calendarTagsUsedBySeeds.length} calendar tags used`,
    ]),
    section('social_consequence_quality', socialConsequenceQuality.score, [
      `${socialConsequenceQuality.responseProfilesChecked} expanded profiles`,
      `${socialConsequenceQuality.profilesAffectingNamedEntities} affect named entities`,
      `${socialConsequenceQuality.profilesAffectingExpandedPressures} affect expanded pressures`,
    ]),
    section(
      'expanded_contradiction_safety',
      expandedContradictionAudit.score,
      [
        `${expandedContradictionAudit.totalExpandedSeedsAudited} expanded seeds audited`,
        `${expandedContradictionAudit.contradictionsFound.length} contradictions`,
      ],
    ),
  ]

  const scores: Record<string, number> = {}
  for (const s of sections) scores[s.id] = s.score
  const passed = sections.every((s) => s.passed) && coreReadiness.passed && replayIdentical

  return {
    passed,
    sections,
    scores,
    coreReadinessPassed: coreReadiness.passed,
    coreReadiness,
    identityRichness,
    entityMemoryQuality,
    attributionQuality,
    expandedPressureQuality,
    expandedSeedCoverage,
    textIngredientQuality,
    namedEntityRepetition,
    arcAndCalendarUse,
    socialConsequenceQuality,
    expandedContradictionAudit,
    replayIdentical,
  }
}

function section(
  id: keyof typeof EXPANDED_READINESS_THRESHOLDS,
  score: number,
  notes: string[],
): ExpandedReadinessSection {
  const threshold = EXPANDED_READINESS_THRESHOLDS[id]
  return {
    id,
    score,
    threshold,
    passed: score >= threshold,
    notes,
  }
}

// ----------------------------------------------------------------------
// §40.14 — Expanded card readiness gate.
// ----------------------------------------------------------------------

export type ExpandedCardReadinessGateConditions = {
  coreGatePasses: boolean
  expandedReplayIdentical: boolean
  identityRichnessPasses: boolean
  entityMemoryQualityPasses: boolean
  attributionQualityPasses: boolean
  expandedPressuresExpressive: boolean
  expandedSeedsFromState: boolean
  expandedSeedsCarryContext: boolean
  textIngredientsUsable: boolean
  namedEntityRepetitionAcceptable: boolean
  arcsAndCalendarMatter: boolean
  socialResponsesChangeWorld: boolean
  expandedContradictionAuditPasses: boolean
  allExpansionTestsPass: boolean
}

export type ExpandedCardReadinessGateResult = {
  passed: boolean
  conditions: ExpandedCardReadinessGateConditions
  failedReasons: string[]
  readiness: ExpandedReadinessReport
}

export type ExpandedCardReadinessGateInput = {
  allExpansionTestsPass: boolean
  seed?: string
  days?: number
}

const GATE_KEYS: Array<keyof ExpandedCardReadinessGateConditions> = [
  'coreGatePasses',
  'expandedReplayIdentical',
  'identityRichnessPasses',
  'entityMemoryQualityPasses',
  'attributionQualityPasses',
  'expandedPressuresExpressive',
  'expandedSeedsFromState',
  'expandedSeedsCarryContext',
  'textIngredientsUsable',
  'namedEntityRepetitionAcceptable',
  'arcsAndCalendarMatter',
  'socialResponsesChangeWorld',
  'expandedContradictionAuditPasses',
  'allExpansionTestsPass',
]

function describeFailure(
  key: keyof ExpandedCardReadinessGateConditions,
  report: ExpandedReadinessReport,
): string {
  switch (key) {
    case 'coreGatePasses':
      return 'Core Phase 20 readiness report did not pass.'
    case 'expandedReplayIdentical':
      return 'Expanded replay diverged after deterministic seed.'
    case 'identityRichnessPasses':
      return `Identity richness ${report.identityRichness.score}/${EXPANDED_READINESS_THRESHOLDS.identity_richness} — too few named entities or naming profiles.`
    case 'entityMemoryQualityPasses':
      return `Entity memory quality ${report.entityMemoryQuality.score}/${EXPANDED_READINESS_THRESHOLDS.entity_memory_quality} — owners or category spread insufficient.`
    case 'attributionQualityPasses':
      return `Attribution quality ${report.attributionQuality.score}/${EXPANDED_READINESS_THRESHOLDS.attribution_quality} — blame/credit/source coverage insufficient.`
    case 'expandedPressuresExpressive':
      return `Expanded pressures only moved ${report.expandedPressureQuality.expandedPressuresMoved.length} pressures.`
    case 'expandedSeedsFromState':
      return `Only ${report.expandedSeedCoverage.expandedFamiliesProduced.length}/${EXPANDED_SEED_FAMILIES.length} expanded seed families appeared.`
    case 'expandedSeedsCarryContext':
      return 'Expanded seeds do not carry enough named entity / memory / pressure context.'
    case 'textIngredientsUsable':
      return `Text ingredients quality ${report.textIngredientQuality.score}/${EXPANDED_READINESS_THRESHOLDS.text_ingredient_quality} — too much prose smell or budget overflow.`
    case 'namedEntityRepetitionAcceptable': {
      const top = report.namedEntityRepetition.overusedEntities[0]
      if (top)
        return `Named entity repetition: ${top.refKey} used in ${top.count} seeds.`
      return 'Named entity repetition: too much same-actor repetition.'
    }
    case 'arcsAndCalendarMatter':
      return 'Arcs and calendar tags do not influence enough expanded seeds.'
    case 'socialResponsesChangeWorld':
      return 'Expanded response profiles rarely affect named entities, memories, or expanded pressures.'
    case 'expandedContradictionAuditPasses': {
      const total = report.expandedContradictionAudit.contradictionsFound.length
      const first = report.expandedContradictionAudit.contradictionsFound[0]
      return first
        ? `Expanded contradiction audit found ${total} issues — first: ${first.reason}.`
        : `Expanded contradiction audit found ${total} issues.`
    }
    case 'allExpansionTestsPass':
      return "Caller reported that not all expansion tests pass (allExpansionTestsPass = false)."
  }
}

export function evaluateExpandedCardReadinessGate(
  input: ExpandedCardReadinessGateInput,
): ExpandedCardReadinessGateResult {
  const readiness = buildExpandedReadinessReport({
    ...(input.seed ? { seed: input.seed } : {}),
    ...(input.days ? { days: input.days } : {}),
  })

  const coverage = readiness.expandedSeedCoverage
  const conditions: ExpandedCardReadinessGateConditions = {
    coreGatePasses: readiness.coreReadinessPassed,
    expandedReplayIdentical: readiness.replayIdentical,
    identityRichnessPasses:
      readiness.identityRichness.score >=
      EXPANDED_READINESS_THRESHOLDS.identity_richness,
    entityMemoryQualityPasses:
      readiness.entityMemoryQuality.score >=
      EXPANDED_READINESS_THRESHOLDS.entity_memory_quality,
    attributionQualityPasses:
      readiness.attributionQuality.score >=
      EXPANDED_READINESS_THRESHOLDS.attribution_quality,
    expandedPressuresExpressive:
      readiness.expandedPressureQuality.expandedPressuresMoved.length >= 5,
    expandedSeedsFromState:
      coverage.expandedFamiliesProduced.length >= 1 && coverage.totalExpandedSeeds > 0,
    expandedSeedsCarryContext:
      coverage.totalExpandedSeeds === 0
        ? false
        : coverage.seedsWithNamedEntities / coverage.totalExpandedSeeds >= 0.5,
    textIngredientsUsable:
      readiness.textIngredientQuality.score >=
      EXPANDED_READINESS_THRESHOLDS.text_ingredient_quality,
    namedEntityRepetitionAcceptable:
      readiness.namedEntityRepetition.score >=
      EXPANDED_READINESS_THRESHOLDS.named_entity_repetition,
    arcsAndCalendarMatter:
      readiness.arcAndCalendarUse.score >=
      EXPANDED_READINESS_THRESHOLDS.arc_and_calendar_use,
    socialResponsesChangeWorld:
      readiness.socialConsequenceQuality.score >=
      EXPANDED_READINESS_THRESHOLDS.social_consequence_quality,
    expandedContradictionAuditPasses:
      readiness.expandedContradictionAudit.score >=
      EXPANDED_READINESS_THRESHOLDS.expanded_contradiction_safety,
    allExpansionTestsPass: input.allExpansionTestsPass,
  }

  const failedReasons: string[] = []
  for (const key of GATE_KEYS) {
    if (!conditions[key]) failedReasons.push(describeFailure(key, readiness))
  }

  return {
    passed: failedReasons.length === 0,
    conditions,
    failedReasons,
    readiness,
  }
}

// ----------------------------------------------------------------------
// §40.15 — Expanded readiness report formatter.
// ----------------------------------------------------------------------

export function formatExpandedReadinessReport(
  report: ExpandedReadinessReport,
): string {
  const status = report.passed ? 'PASS' : 'FAIL'
  const lines: string[] = []
  lines.push('Expanded Card Fuel Readiness')
  lines.push(`Status: ${status}`)
  lines.push('')
  for (const sec of report.sections) {
    const tag = sec.passed ? 'PASS' : 'FAIL'
    lines.push(`${sec.id}: ${sec.score}/${sec.threshold} ${tag}`)
    for (const n of sec.notes) lines.push(`- ${n}`)
    lines.push('')
  }
  if (!report.replayIdentical) {
    lines.push('Replay: expanded run diverged on the second pass.')
  }
  if (!report.coreReadinessPassed) {
    lines.push('Core readiness: Phase 20 readiness did not pass.')
  }
  return lines.join('\n').trimEnd()
}

// Re-exports so callers don't need to dip into the helper modules directly.
export type { ExpandedSeedCoverageReport, ExpandedContradictionAuditResult }
export {
  EXPANDED_SEED_FAMILIES,
  buildExpandedSeedCoverageReport,
  auditRunForExpandedContradictions,
}
export type { ExpandedPressureId }
