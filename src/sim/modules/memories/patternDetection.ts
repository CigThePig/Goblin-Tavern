import type {
  EntityRef,
  MemoryState,
  TavernState,
} from '../../state/TavernState'
import type { MemoryDefinition, MemoryDraft } from './memoryTypes'
import { getMemoriesByDefinition } from './memoryQueries'
import { memoriesForOwner, memoryOwner } from './entityMemory'
import { memoryRegistry } from './memoryRegistry'

// Phase 16 §16.6 — Pattern detection.
//
// Pattern detection runs weekly. It scans the current memory list for
// repeated events and, when the threshold is hit, emits one or more
// pattern memory drafts (the memory module then adds them via the
// stacking strategy declared in the registry). This is intentionally
// simple: a handful of explicit rules backed by counts and thresholds.

export type PatternResult = MemoryDraft[]

// "3 ale shortages in 14 days" — count any ale shortage memory still
// alive (a stacked occurrence keeps a high strength even after the
// most recent one expires). We treat the count via stacked strength:
// the registry uses `increase_strength`, so the live memory's strength
// rises by ~35 each time. >= 80 strength corresponds to ~3 stacks.
function detectRepeatedAleShortages(memories: ReadonlyArray<MemoryState>): MemoryDraft | null {
  const aleMemories = getMemoriesByDefinition(memories, 'ale_shortage_recently')
  if (aleMemories.length === 0) return null
  const strongest = aleMemories.reduce(
    (max, m) => (m.strength > max ? m.strength : max),
    0,
  )
  if (strongest < 75) return null
  return {
    id: 'repeated_ale_shortages',
    strength: Math.min(100, strongest),
    relatedSystems: ['stock', 'reputation'],
    tags: ['pattern', 'stock', 'ale', 'shortage'],
    source: 'memories.pattern_detection',
  }
}

function detectRepeatedUnpaidWages(memories: ReadonlyArray<MemoryState>): MemoryDraft | null {
  const wageMemories = getMemoriesByDefinition(memories, 'wages_unpaid_recently')
  if (wageMemories.length === 0) return null
  const strongest = wageMemories.reduce(
    (max, m) => (m.strength > max ? m.strength : max),
    0,
  )
  // Each unpaid week stacks +50 strength → two weeks ≈ 100. One unpaid
  // week is enough to start the pattern memory.
  if (strongest < 50) return null
  return {
    id: 'repeated_unpaid_wages',
    strength: Math.min(100, strongest),
    relatedSystems: ['staff'],
    tags: ['pattern', 'staff', 'wages', 'risk'],
    source: 'memories.pattern_detection',
  }
}

// Phase 16 §16.6 — "roof below threshold for 10 days". We can read the
// current roof condition directly from state and count how long
// `roof_patched_recently` has been absent / how high `damage` has sat.
// We approximate the "10 days" rule with: roof damage >= 50 and no
// `roof_patched_recently` memory present.
function detectHabitualRoofNeglect(state: TavernState): MemoryDraft | null {
  const roof = state.areas['roof']
  if (!roof) return null
  if (roof.damage < 50 && roof.condition > 35) return null
  const patched = getMemoriesByDefinition(state.memories, 'roof_patched_recently')
  if (patched.length > 0) return null
  return {
    id: 'habitual_roof_neglect',
    strength: Math.min(100, 40 + roof.damage / 2),
    relatedSystems: ['areas'],
    tags: ['pattern', 'maintenance', 'roof'],
    source: 'memories.pattern_detection',
    locations: [{ kind: 'area', id: 'roof' }],
  }
}

// Phase 16 §16.6 — "merchant satisfaction falling for 2 weeks". We use
// stacked `merchants_unhappy_recently` memory strength as a proxy.
function detectMerchantDecline(memories: ReadonlyArray<MemoryState>): MemoryDraft | null {
  const merchMemories = getMemoriesByDefinition(memories, 'merchants_unhappy_recently')
  if (merchMemories.length === 0) return null
  const strongest = merchMemories.reduce(
    (max, m) => (m.strength > max ? m.strength : max),
    0,
  )
  if (strongest < 65) return null
  return {
    id: 'merchant_decline_pattern',
    strength: Math.min(100, strongest),
    relatedSystems: ['customers', 'reputation'],
    tags: ['pattern', 'customers', 'merchants'],
    source: 'memories.pattern_detection',
    actors: [{ kind: 'customer_group', id: 'merchants' }],
  }
}

// Phase 36 §36.6 — Entity-focused pattern detection.
//
// The detectors below scan the existing memory log for repeated
// entity-scoped events (blame, complaint, supplier distrust, area
// problems) and emit pattern memories whose ownership / actors point at
// the involved entity. Each emission stays additive: the registry entry
// for the new pattern memory uses `refresh` stacking, so re-emitting on
// successive weeks does not create duplicate state records.

const RECENT_WINDOW_DAYS = 14
const MINIMUM_BLAME_COUNT = 2
const MINIMUM_IGNORED_COMPLAINTS = 2
const MINIMUM_SUPPLIER_SIGNALS = 2
const MINIMUM_AREA_SIGNALS = 3

function isRecent(memory: MemoryState, absoluteDay: number): boolean {
  return absoluteDay - memory.createdAt.absoluteDay <= RECENT_WINDOW_DAYS
}

function collectActors(
  memories: ReadonlyArray<MemoryState>,
  kind: EntityRef['kind'],
): EntityRef[] {
  const seen = new Map<string, EntityRef>()
  for (const memory of memories) {
    for (const actor of memory.actors) {
      if (actor.kind !== kind) continue
      const key = `${actor.kind}:${actor.id}`
      if (!seen.has(key)) seen.set(key, actor)
    }
    const owner = memoryOwner(memory)
    if (owner && owner.kind === kind) {
      const key = `${owner.kind}:${owner.id}`
      if (!seen.has(key)) seen.set(key, owner)
    }
  }
  return [...seen.values()]
}

function lookupDef(id: string): MemoryDefinition | undefined {
  return memoryRegistry.has(id) ? memoryRegistry.get(id) : undefined
}

function makeEntityPatternDraft(args: {
  registryId: string
  instanceSuffix: string
  owner: EntityRef
  matchCount: number
  source: string
  locations?: EntityRef[]
}): MemoryDraft {
  const { registryId, instanceSuffix, owner, matchCount, source, locations } =
    args
  const def = lookupDef(registryId)
  const draft: MemoryDraft = {
    id: `${registryId}__${instanceSuffix}`,
    type: def?.type ?? 'pattern',
    strength: Math.min(100, (def?.defaultStrength ?? 50) + matchCount * 5),
    tags: def?.tags ? [...def.tags] : ['pattern'],
    relatedSystems: def?.relatedSystems ? [...def.relatedSystems] : [],
    actors: [owner],
    source,
    metadata: {
      owner,
      patternDefinitionId: registryId,
      entityKind: owner.kind,
      entityId: owner.id,
      matchCount,
    },
  }
  if (def?.label !== undefined) draft.label = def.label
  if (def?.defaultDurationDays !== undefined) {
    draft.durationDays = def.defaultDurationDays
  }
  if (def?.defaultDecayRate !== undefined) {
    draft.decayRate = def.defaultDecayRate
  }
  if (locations) draft.locations = locations
  return draft
}

function detectStaffScapegoated(state: TavernState): MemoryDraft[] {
  const drafts: MemoryDraft[] = []
  const blameMemories = state.memories.filter(
    (m) =>
      m.tags.includes('blame') &&
      m.tags.includes('staff') &&
      isRecent(m, state.calendar.totalDaysElapsed),
  )
  if (blameMemories.length === 0) return drafts

  const staffActors = collectActors(blameMemories, 'staff')
  for (const staff of staffActors) {
    const matching = memoriesForOwner(blameMemories, staff)
    if (matching.length < MINIMUM_BLAME_COUNT) continue
    drafts.push(
      makeEntityPatternDraft({
        registryId: 'staff_feels_scapegoated',
        instanceSuffix: staff.id,
        owner: staff,
        matchCount: matching.length,
        source: 'memories.pattern_detection.staff_scapegoat',
      }),
    )
  }
  return drafts
}

function detectRegularIgnored(state: TavernState): MemoryDraft[] {
  const drafts: MemoryDraft[] = []
  const ignored = state.memories.filter(
    (m) =>
      m.tags.includes('regular') &&
      (m.tags.includes('complaint') || m.tags.includes('irritation')) &&
      isRecent(m, state.calendar.totalDaysElapsed),
  )
  if (ignored.length === 0) return drafts

  const regulars = collectActors(ignored, 'regular')
  for (const regular of regulars) {
    const matching = memoriesForOwner(ignored, regular)
    if (matching.length < MINIMUM_IGNORED_COMPLAINTS) continue
    drafts.push(
      makeEntityPatternDraft({
        registryId: 'regular_feels_ignored',
        instanceSuffix: regular.id,
        owner: regular,
        matchCount: matching.length,
        source: 'memories.pattern_detection.regular_ignored',
      }),
    )
  }
  return drafts
}

function detectSupplierDistrust(state: TavernState): MemoryDraft[] {
  const drafts: MemoryDraft[] = []
  const supplierMemories = state.memories.filter(
    (m) =>
      m.tags.includes('supplier') &&
      (m.tags.includes('blame') ||
        m.tags.includes('payment') ||
        m.tags.includes('stock')),
  )
  if (supplierMemories.length === 0) return drafts

  const suppliers = collectActors(supplierMemories, 'supplier')
  for (const supplier of suppliers) {
    const matching = memoriesForOwner(supplierMemories, supplier)
    if (matching.length < MINIMUM_SUPPLIER_SIGNALS) continue
    // Look for the three-signal pattern (late payment, blame, weak
    // relationship). Each individual tag firing twice is also enough.
    const hasLate = matching.some((m) => m.tags.includes('payment'))
    const hasBlame = matching.some((m) => m.tags.includes('blame'))
    const hasRelationship = matching.some((m) => m.tags.includes('relationship'))
    const score =
      (hasLate ? 1 : 0) + (hasBlame ? 1 : 0) + (hasRelationship ? 1 : 0)
    if (matching.length < 3 && score < 2) continue
    drafts.push(
      makeEntityPatternDraft({
        registryId: 'supplier_distrust_pattern',
        instanceSuffix: supplier.id,
        owner: supplier,
        matchCount: matching.length,
        source: 'memories.pattern_detection.supplier_distrust',
      }),
    )
  }
  return drafts
}

function detectAreaBadReputation(state: TavernState): MemoryDraft[] {
  const drafts: MemoryDraft[] = []
  // Look at memories that point at an area location and that carry
  // negative tags. Aggregate by area id.
  const buckets = new Map<string, MemoryState[]>()
  for (const memory of state.memories) {
    const isAtmosphereProblem =
      memory.tags.includes('atmosphere') ||
      memory.tags.includes('risk') ||
      memory.tags.includes('violence') ||
      memory.tags.includes('cleanliness') ||
      memory.tags.includes('maintenance')
    if (!isAtmosphereProblem) continue
    for (const location of memory.locations) {
      if (location.kind !== 'area') continue
      const list = buckets.get(location.id) ?? []
      list.push(memory)
      buckets.set(location.id, list)
    }
  }
  for (const [areaId, memories] of buckets) {
    if (memories.length < MINIMUM_AREA_SIGNALS) continue
    const owner: EntityRef = { kind: 'area', id: areaId }
    drafts.push(
      makeEntityPatternDraft({
        registryId: 'area_bad_reputation',
        instanceSuffix: areaId,
        owner,
        matchCount: memories.length,
        source: 'memories.pattern_detection.area_bad_reputation',
        locations: [{ kind: 'area', id: areaId }],
      }),
    )
  }
  return drafts
}

export function detectPatterns(state: TavernState): PatternResult {
  const out: MemoryDraft[] = []
  const ale = detectRepeatedAleShortages(state.memories)
  if (ale) out.push(ale)
  const wages = detectRepeatedUnpaidWages(state.memories)
  if (wages) out.push(wages)
  const roof = detectHabitualRoofNeglect(state)
  if (roof) out.push(roof)
  const merch = detectMerchantDecline(state.memories)
  if (merch) out.push(merch)
  // Phase 36 §36.6 — entity-focused pattern memories.
  for (const draft of detectStaffScapegoated(state)) out.push(draft)
  for (const draft of detectRegularIgnored(state)) out.push(draft)
  for (const draft of detectSupplierDistrust(state)) out.push(draft)
  for (const draft of detectAreaBadReputation(state)) out.push(draft)
  return out
}
