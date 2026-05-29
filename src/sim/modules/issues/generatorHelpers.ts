import type { SimContext } from '../../core/context'
import type {
  CalendarStamp,
  CauseEntry,
  EntityRef,
  TavernState,
} from '../../state/TavernState'
import type {
  EffectDirection,
  EffectMagnitudeBand,
  EffectPreview,
  EffectTargetKind,
} from '../../core/effect'
import type {
  ConsequenceProfile,
  IssueSeed,
  IssueSeedFamilyId,
  IssueSeedTiming,
  IssueSeedType,
  NamedEntityIngredient,
  ResponseSlot,
  StakeRef,
  TextIngredients,
} from './issueSeedTypes'
import { scoreProfile } from './impactScoring'
import {
  memoriesAboutEntity,
  memoriesForOwner,
  strongestMemoryFor,
} from '../memories/entityMemory'
import type { MemoryState } from '../memories/memoryTypes'
import {
  attributionsByTarget,
} from '../attribution/attributionQueries'
import type {
  AttributionState,
  AttributionType,
} from '../attribution/attributionTypes'

// Phase 19 — Shared helpers for seed generators.
//
// Generators build seeds from current state, pressure snapshots, and
// recent causes. These helpers keep the family-specific generators
// short and consistent.

export function stampFromState(state: TavernState): CalendarStamp {
  return {
    year: state.calendar.year,
    month: state.calendar.month,
    week: state.calendar.week,
    day: state.calendar.day,
    absoluteDay: state.calendar.totalDaysElapsed,
  }
}

// Phase 145 / ISSUE-113 — Voiced Surface arc, Phase 18 (iteration 2).
//
// `effect()` is the single choke point through which every consequence
// preview is constructed (~240 call sites across `issueSeedGenerators.ts`
// and `expandedSeedGenerators.ts`). Classifying targetKind / direction /
// magnitudeBand here means the card layer's snippet pools can gate on
// structural meter facts without re-parsing the `target` string at
// condition time. Snippets stay flat data; the parsing rules live here.

/** Per-targetKind absolute-magnitude cutoffs. A reading lands in the
 *  first band whose upper bound is greater than `Math.abs(amount)`.
 *  Tuned so "small" reads as a noticeable nudge and "large" reads as
 *  a meaningful shock per meter family. */
const MAGNITUDE_BAND_CUTOFFS: Record<EffectTargetKind, readonly number[]> = {
  coin: [5, 20, 50],
  pressure: [5, 10, 20],
  staff: [3, 8, 15],
  customer: [3, 8, 15],
  cohort: [3, 8, 15],
  reputation: [5, 10, 20],
  area: [10, 25, 50],
  stock: [10, 30, 60],
  supplier: [5, 10, 20],
  faction: [5, 10, 20],
  culture: [5, 10, 20],
  memory: [1, 1, 1],
  arc: [1, 1, 1],
  attribution: [1, 1, 1],
  global: [5, 15, 30],
  other: [5, 15, 30],
}

const BANDS: readonly EffectMagnitudeBand[] = [
  'tiny',
  'small',
  'medium',
  'large',
]

// Phase 164 / ISSUE-132 — Faithful Surface arc, Phase 2 (Meter Valence).
//
// Effect `direction` is the surface contract the preview pools gate on, but
// pre-Phase-164 it was the raw arithmetic sign of `amount` — so a kindness
// that lowers `staff.stress` by 8 classified `negative` and rendered the
// "things got worse" line. This map adds the missing polarity layer: which
// meters are lower-is-better, so a *decrease* on them reads `positive` (good
// for the player). Keyed on the meter sub-name — the last dot-segment of the
// target string (`staff.mira.stress` → `stress`, `areas.kitchen.damage` →
// `damage`) — because state-change targets carry the entity id in the middle.
// Everything not listed defaults to higher-is-better.
//
// `cleanliness` / `condition` are HIGHER-is-better (a cleaner, sounder room is
// good) and are intentionally absent. Only the area hygiene/decay meters
// (`damage` / `smell` / `mess` / `risk`) invert.
//
// `pressure.*` is deliberately EXCLUDED. Pressure is stored rising = positive,
// and its Phase-159 preview block already encodes threat-vs-relief in the verbs
// ("build / mount / climb" for rising; "settle / ease / fall back" for relief)
// keyed on arithmetic sign. It is valence-correct as-is and was never among the
// audit's direction mismatches; adding it here would invert a correct signal
// and break a faithful pool. Do not "fix" the omission.
const METER_VALENCE: Record<string, 'lowerIsBetter'> = {
  stress: 'lowerIsBetter', // staff
  fatigue: 'lowerIsBetter', // staff
  damage: 'lowerIsBetter', // area
  smell: 'lowerIsBetter', // area
  mess: 'lowerIsBetter', // area
  risk: 'lowerIsBetter', // area
  tension: 'lowerIsBetter', // culture
  irritation: 'lowerIsBetter', // regular (defensive — may not be emitted today)
  rowdiness: 'lowerIsBetter', // customer_group cohort (defensive)
}

/** Resolve the valence of the meter a `target` string points at. Reads the
 *  last dot-segment against `METER_VALENCE`; colon-prefixed cause targets
 *  (`staff:cook_1`, `pressure:landlord`) have no dot and fall through to the
 *  higher-is-better default (cause effects carry amount 0 ⇒ neutral anyway). */
export function resolveMeterValence(
  target: string,
): 'higherIsBetter' | 'lowerIsBetter' {
  const lastDot = target.lastIndexOf('.')
  if (
    lastDot >= 0 &&
    METER_VALENCE[target.slice(lastDot + 1)] === 'lowerIsBetter'
  )
    return 'lowerIsBetter'
  return 'higherIsBetter'
}

/** Classify a `target` string into a structural target-kind. Order
 *  matters: `pressure:` colon-prefix must beat any later `pressure.`
 *  dot-path, etc. Unknown patterns fall to `'other'` rather than
 *  throwing — keeps existing seeds valid if a new target shape lands. */
export function classifyTargetKind(target: string): EffectTargetKind {
  if (target.startsWith('pressure:') || target.startsWith('pressure.'))
    return 'pressure'
  if (target.startsWith('memory:') || target.startsWith('memory.'))
    return 'memory'
  if (target.startsWith('arc:')) return 'arc'
  if (target.startsWith('attribution.') || target.startsWith('attribution:'))
    return 'attribution'
  if (target.startsWith('world.suppliers.') || target.startsWith('suppliers.'))
    return 'supplier'
  if (target.startsWith('supplier:')) return 'supplier'
  if (target.startsWith('factions.') || target.startsWith('world.factions.'))
    return 'faction'
  if (target.startsWith('faction:')) return 'faction'
  if (target.startsWith('cultures.') || target.startsWith('world.cultures.'))
    return 'culture'
  if (target.startsWith('customer_group:')) return 'cohort'
  if (target.startsWith('staff:')) return 'staff'
  if (target.startsWith('regular:')) return 'customer'
  if (target.startsWith('rumour:')) return 'memory'
  if (target === 'coin' || target.startsWith('coin.')) return 'coin'
  if (target.startsWith('stock.')) return 'stock'
  if (target.startsWith('areas.')) return 'area'
  if (target.startsWith('customers.')) return 'customer'
  if (target.startsWith('staff.')) return 'staff'
  if (target.startsWith('reputation.')) return 'reputation'
  if (target.startsWith('cohort.') || target.startsWith('cohorts.'))
    return 'cohort'
  if (target === 'global' || target === 'tavern' || target.startsWith('global.'))
    return 'global'
  return 'other'
}

/** Valence-aware direction classification. `0` and `undefined` resolve to
 *  `'neutral'`. When `target` resolves to a lower-is-better meter (Phase 164 /
 *  ISSUE-132), the sign is inverted before classifying so a decrease reads
 *  `'positive'` (good for the player). The no-target form keeps the raw
 *  arithmetic-sign behavior for callers that have no target context. */
export function classifyDirection(
  amount?: number,
  target?: string,
): EffectDirection {
  if (amount === undefined || amount === 0) return 'neutral'
  const signed =
    target !== undefined && resolveMeterValence(target) === 'lowerIsBetter'
      ? -amount
      : amount
  return signed > 0 ? 'positive' : 'negative'
}

/** Band the absolute amount against the per-targetKind cutoff table.
 *  Returns `undefined` when amount is missing or 0 (no meter movement
 *  to band). */
export function classifyMagnitudeBand(
  targetKind: EffectTargetKind,
  amount?: number,
): EffectMagnitudeBand | undefined {
  if (amount === undefined || amount === 0) return undefined
  const abs = Math.abs(amount)
  const cutoffs = MAGNITUDE_BAND_CUTOFFS[targetKind]
  for (const [i, cutoff] of cutoffs.entries()) {
    if (abs < cutoff) return BANDS[i] ?? 'large'
  }
  return 'large'
}

export function effect(
  kind: EffectPreview['kind'],
  target: string,
  amount: number,
  readable: string,
  tags: string[] = [],
): EffectPreview {
  const targetKind = classifyTargetKind(target)
  const direction = classifyDirection(amount, target)
  const magnitudeBand = classifyMagnitudeBand(targetKind, amount)
  const out: EffectPreview = {
    kind,
    target,
    amount,
    readable,
    tags,
    targetKind,
    direction,
  }
  if (magnitudeBand !== undefined) out.magnitudeBand = magnitudeBand
  return out
}

/** Compute impactScore for a profile shaped by partial inputs. */
export function makeProfile(
  partial: Omit<ConsequenceProfile, 'impactScore'>,
): ConsequenceProfile {
  const impactScore = scoreProfile(partial)
  return { ...partial, impactScore }
}

/** Sum severity from given pressures (clamped). */
export function severityFromPressures(
  ctx: SimContext,
  pressureIds: string[],
): number {
  let total = 0
  let count = 0
  const snapshots = (ctx.state.modules.pressures as
    | { snapshots?: Record<string, { value: number; severity: number }> }
    | undefined)?.snapshots ?? {}
  for (const id of pressureIds) {
    const snap = snapshots[id]
    if (!snap) continue
    total += snap.severity
    count += 1
  }
  if (count === 0) return 0
  return Math.round(total / count)
}

export function urgencyFromPressures(
  ctx: SimContext,
  pressureIds: string[],
): number {
  let total = 0
  let count = 0
  const snapshots = (ctx.state.modules.pressures as
    | { snapshots?: Record<string, { value: number; urgency: number }> }
    | undefined)?.snapshots ?? {}
  for (const id of pressureIds) {
    const snap = snapshots[id]
    if (!snap) continue
    total += snap.urgency
    count += 1
  }
  if (count === 0) return 0
  return Math.round(total / count)
}

/** Filter recent causes (created within `days`) matching any of the
 *  given tags. */
export function recentCauseEntries(
  ctx: SimContext,
  tags: string[],
  days: number = 3,
  limit: number = 4,
): CauseEntry[] {
  const recent = ctx.getRecentCauses(days)
  const matching: CauseEntry[] = []
  for (const cause of recent) {
    if (tags.some((tag) => cause.tags.includes(tag))) {
      matching.push(cause)
    }
  }
  matching.sort((a, b) => b.weight - a.weight)
  return matching.slice(0, limit)
}

/** Manufacture a synthetic cause from a pressure cause-ref. The pressure
 *  module records its own `state.causes` entries when shifts are
 *  significant, but the calculation always exposes the breakdown via the
 *  snapshot. We adapt those refs to CauseEntries so seeds always have at
 *  least two causes. */
export function pressureCauseRefsAsEntries(
  ctx: SimContext,
  pressureId: string,
  limit: number = 3,
): CauseEntry[] {
  const snapshots = (ctx.state.modules.pressures as
    | {
        snapshots?: Record<
          string,
          {
            causes: Array<{
              id: string
              readable: string
              amount: number
              weight: number
              direction: 'increase' | 'decrease' | 'neutral'
              tags: string[]
            }>
          }
        >
      }
    | undefined)?.snapshots ?? {}
  const snap = snapshots[pressureId]
  if (!snap) return []
  const stamp = stampFromState(ctx.state)
  return snap.causes.slice(0, limit).map((ref, idx) => ({
    id: `pressure-${pressureId}-${idx}-${stamp.absoluteDay}`,
    timestamp: stamp,
    source: `pressures.${pressureId}`,
    sourceType: 'pressure' as const,
    target: `pressure:${pressureId}`,
    targetType: 'pressure' as const,
    amount: ref.amount,
    direction: ref.direction,
    weight: ref.weight,
    readable: ref.readable,
    tags: [...ref.tags],
    relatedActors: [],
    relatedLocations: [],
    relatedSystems: [],
    ageDays: 0,
  }))
}

/** Build a basic text ingredients object, trimmed to fit budgets.
 *  Phase 39 §39.3 extends the helper with expanded-world arrays so
 *  Phase 39 generators can feed named entities, social context, memory
 *  fragments, pressure context, and arc context to the card layer. */
export function buildTextIngredients(input: {
  subject: string
  problemNoun?: string
  sensoryDetails?: string[]
  actorOpinions?: Record<string, string>
  recentContext?: string[]
  stakesReadable?: string[]
  namedEntities?: NamedEntityIngredient[]
  socialContext?: string[]
  relevantMemories?: string[]
  perceivedBlame?: string[]
  pressureContext?: string[]
  calendarContext?: string[]
  marketContext?: string[]
  arcContext?: string[]
}): TextIngredients {
  const out: TextIngredients = {
    subject: input.subject,
    ...(input.problemNoun !== undefined
      ? { problemNoun: input.problemNoun }
      : {}),
    sensoryDetails: (input.sensoryDetails ?? []).slice(0, 3),
    actorOpinions: Object.fromEntries(
      Object.entries(input.actorOpinions ?? {}).slice(0, 2),
    ),
    recentContext: (input.recentContext ?? []).slice(0, 3),
    stakesReadable: (input.stakesReadable ?? []).slice(0, 3),
  }
  if (input.namedEntities && input.namedEntities.length > 0) {
    out.namedEntities = input.namedEntities.slice(0, 4)
  }
  if (input.socialContext && input.socialContext.length > 0) {
    out.socialContext = input.socialContext.slice(0, 3)
  }
  if (input.relevantMemories && input.relevantMemories.length > 0) {
    out.relevantMemories = input.relevantMemories.slice(0, 3)
  }
  if (input.perceivedBlame && input.perceivedBlame.length > 0) {
    out.perceivedBlame = input.perceivedBlame.slice(0, 2)
  }
  if (input.pressureContext && input.pressureContext.length > 0) {
    out.pressureContext = input.pressureContext.slice(0, 3)
  }
  if (input.calendarContext && input.calendarContext.length > 0) {
    out.calendarContext = input.calendarContext.slice(0, 2)
  }
  if (input.marketContext && input.marketContext.length > 0) {
    out.marketContext = input.marketContext.slice(0, 2)
  }
  if (input.arcContext && input.arcContext.length > 0) {
    out.arcContext = input.arcContext.slice(0, 2)
  }
  return out
}

/** Build a stake ref. */
export function stake(
  id: string,
  target: string,
  readable: string,
  direction: StakeRef['direction'] = 'loss',
  tags: string[] = [],
): StakeRef {
  return { id, target, readable, direction, tags }
}

/** Build a seed id stable for a single day. */
export function seedId(
  family: string,
  templateId: string,
  ctx: SimContext,
): string {
  const stamp = stampFromState(ctx.state)
  return `seed-${family}-${templateId}-d${stamp.absoluteDay}`
}

/** Skeleton seed factory. */
export function buildSeed(input: {
  id: string
  family: IssueSeedFamilyId | string
  type: IssueSeedType
  timing: IssueSeedTiming
  domain: string[]
  severity: number
  urgency: number
  location?: EntityRef | undefined
  primaryActor?: EntityRef | undefined
  affectedActors?: EntityRef[]
  causes: CauseEntry[]
  pressures?: IssueSeed['pressures']
  stakes: StakeRef[]
  responseSlots: ResponseSlot[]
  consequenceProfiles: ConsequenceProfile[]
  memoriesCreated?: IssueSeed['memoriesCreated']
  futureHooks?: IssueSeed['futureHooks']
  toneHints?: string[]
  textIngredients: TextIngredients
  ctx: SimContext
}): IssueSeed {
  const { ctx, location, primaryActor, ...rest } = input
  const seed: IssueSeed = {
    id: rest.id,
    family: rest.family,
    type: rest.type,
    timing: rest.timing,
    domain: rest.domain,
    severity: rest.severity,
    urgency: rest.urgency,
    novelty: 0,
    cardWorthiness: 0,
    affectedActors: rest.affectedActors ?? [],
    causes: rest.causes,
    pressures: rest.pressures ?? [],
    stakes: rest.stakes,
    responseSlots: rest.responseSlots,
    consequenceProfiles: rest.consequenceProfiles,
    memoriesCreated: rest.memoriesCreated ?? [],
    futureHooks: rest.futureHooks ?? [],
    toneHints: rest.toneHints ?? [],
    textIngredients: rest.textIngredients,
    validation: {
      valid: true,
      errors: [],
      warnings: [],
      contractChecks: {},
    },
    generatedAt: stampFromState(ctx.state),
  }
  if (location !== undefined) seed.location = location
  if (primaryActor !== undefined) seed.primaryActor = primaryActor
  return seed
}

/** Read pressure snapshot directly. */
export function pressureSnapshot(
  ctx: SimContext,
  id: string,
):
  | {
      id: string
      value: number
      severity: number
      urgency: number
      trend: 'rising' | 'stable' | 'falling'
    }
  | undefined {
  const snapshots = (ctx.state.modules.pressures as
    | {
        snapshots?: Record<
          string,
          {
            id: string
            value: number
            severity: number
            urgency: number
            trend: 'rising' | 'stable' | 'falling'
          }
        >
      }
    | undefined)?.snapshots ?? {}
  return snapshots[id]
}

/** EntityRef helpers. */
export function areaRef(id: string): EntityRef {
  return { kind: 'area', id }
}
export function stockRef(id: string): EntityRef {
  return { kind: 'stock', id }
}
export function staffRef(id: string): EntityRef {
  return { kind: 'staff', id }
}
export function customerRef(id: string): EntityRef {
  return { kind: 'customer_group', id }
}
export function systemRef(id: string): EntityRef {
  return { kind: 'system', id }
}

// Phase 39 §39.4 — Expanded-world EntityRef helpers. World entities
// (suppliers, factions, regulars, cultures, local arcs) are persistent
// state; their refs live alongside the Phase 19 refs so seeds can name
// them without re-rolling identity.
export function supplierRef(id: string): EntityRef {
  return { kind: 'supplier', id }
}
export function factionRef(id: string): EntityRef {
  return { kind: 'faction', id }
}
export function regularRef(id: string): EntityRef {
  return { kind: 'regular', id }
}
export function notableNpcRef(id: string): EntityRef {
  return { kind: 'notable_npc', id }
}
export function cultureRef(id: string): EntityRef {
  return { kind: 'culture', id }
}

// Phase 44 §ISSUE-004 — Lookup helper for notable NPCs by faction.
// Iterates `state.world.notableNpcs` in stable id order and returns the
// first ref whose `factionId` matches. Lets seed generators prefer a
// notable NPC actor over a faction-level ref when one exists, lighting
// up the `notable_npc` ref kind for the 7+ consumer paths that already
// branch on it.
export function findNotableNpcByFaction(
  state: TavernState,
  factionId: string,
): EntityRef | undefined {
  const ordered = Object.values(state.world.notableNpcs).sort((a, b) =>
    a.id.localeCompare(b.id),
  )
  const match = ordered.find((npc) => npc.factionId === factionId)
  return match ? notableNpcRef(match.id) : undefined
}
export function localArcRef(id: string): EntityRef {
  return { kind: 'local_event', id }
}
export function serviceSceneRef(id: string): EntityRef {
  return { kind: 'other', id: `scene:${id}` }
}
export function projectRef(id: string): EntityRef {
  return { kind: 'other', id: `project:${id}` }
}
export function rumourRef(id: string): EntityRef {
  return { kind: 'rumour', id }
}
export function tavernIdentityRef(id: string): EntityRef {
  return { kind: 'tavern_identity', id }
}

// Phase 39 §39.4 — Display helpers. Read display names from persistent
// state so report text never re-rolls identity each day.
export function displayNameForRef(
  state: TavernState,
  ref: EntityRef,
): string {
  switch (ref.kind) {
    case 'staff': {
      const s = state.staff[ref.id]
      return s?.name.display ?? ref.id
    }
    case 'customer_group': {
      const g = state.customerGroups[ref.id]
      return g?.label ?? g?.id ?? ref.id
    }
    case 'area': {
      const a = state.areas[ref.id]
      return a?.label ?? ref.id
    }
    case 'stock': {
      const stock = state.stock[ref.id]
      return stock?.label ?? ref.id
    }
    case 'supplier': {
      const supplier = state.world.suppliers[ref.id]
      return supplier?.name?.display ?? supplier?.label ?? ref.id
    }
    case 'faction': {
      const faction = state.world.factions[ref.id]
      return faction?.label ?? ref.id
    }
    case 'regular': {
      const regular = state.world.regulars[ref.id]
      return regular?.name?.display ?? ref.id
    }
    case 'culture': {
      const culture = state.world.cultures[ref.id]
      return culture?.label ?? ref.id
    }
    case 'notable_npc': {
      const npc = state.world.notableNpcs[ref.id]
      return npc?.name?.display ?? ref.id
    }
    case 'local_event': {
      const event = state.world.localEvents[ref.id]
      return event?.label ?? ref.id
    }
    case 'rumour': {
      const rumour = state.world.socialRumours[ref.id]
      return rumour?.label ?? ref.id
    }
    case 'tavern_identity':
      return state.meta.tavernName ?? 'the tavern'
    default:
      return ref.id
  }
}

/** Build a single named-entity ingredient entry. */
export function namedEntityIngredient(
  state: TavernState,
  role: string,
  ref: EntityRef,
): NamedEntityIngredient {
  return {
    role,
    ref,
    displayName: displayNameForRef(state, ref),
  }
}

/** Phase 40 audit pass 2 — Deduplicate a list of EntityRefs, optionally
 *  excluding any refs that match the given reference (e.g. the primary
 *  actor). Used by seed generators to keep `affectedActors` from
 *  double-counting the primary entity, which inflates
 *  `named_entity_repetition` without changing meaning. */
export function dedupeRefs(
  refs: ReadonlyArray<EntityRef | undefined>,
  exclude?: EntityRef,
): EntityRef[] {
  const out: EntityRef[] = []
  const seen = new Set<string>()
  const excludeKey = exclude ? `${exclude.kind}:${exclude.id}` : undefined
  for (const ref of refs) {
    if (!ref) continue
    const key = `${ref.kind}:${ref.id}`
    if (excludeKey && key === excludeKey) continue
    if (seen.has(key)) continue
    seen.add(key)
    out.push(ref)
  }
  return out
}

// Phase 39 §39.4 — Memory / attribution query helpers. Generators use
// these to surface the strongest "why this seed exists right now" hint
// without coupling to raw state shape.
export function strongestMemoryText(
  state: TavernState,
  entity: EntityRef,
  tags?: string[],
): string | undefined {
  const memory = strongestMemoryFor(state, entity, tags)
  if (memory) return memoryToReadable(memory)
  const aboutMatches = memoriesAboutEntity(state, entity, tags ? { tags } : undefined)
  if (aboutMatches.length === 0) return undefined
  let best: MemoryState | undefined
  for (const m of aboutMatches) {
    if (!best || m.strength > best.strength) best = m
  }
  return best ? memoryToReadable(best) : undefined
}

function memoryToReadable(memory: MemoryState): string {
  if (memory.label) return memory.label
  return memory.id.replace(/_/g, ' ')
}

export function strongestAttributionText(
  state: TavernState,
  target: EntityRef,
  types?: AttributionType[],
): string | undefined {
  let attributions = attributionsByTarget(state, target)
  if (types && types.length > 0) {
    attributions = attributions.filter((a) => types.includes(a.attributionType))
  }
  if (attributions.length === 0) return undefined
  let best: AttributionState | undefined
  for (const a of attributions) {
    const score = a.strength * (a.publicness + 50)
    const bestScore = best ? best.strength * (best.publicness + 50) : -1
    if (score > bestScore) best = a
  }
  return best?.readable
}

// Phase 39 §39.4 — Helper to pull every memory tied to an entity once.
export function entityMemoryList(
  state: TavernState,
  entity: EntityRef,
  tags?: string[],
): MemoryState[] {
  const owned = memoriesForOwner(state, entity, tags ? { tags } : undefined)
  const about = memoriesAboutEntity(state, entity, tags ? { tags } : undefined)
  const seen = new Set<string>()
  const out: MemoryState[] = []
  for (const m of [...owned, ...about]) {
    if (seen.has(m.id)) continue
    seen.add(m.id)
    out.push(m)
  }
  return out
}
