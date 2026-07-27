// Phase 93 — World Overview projection.
//
// `buildWorldOverview(state)` is the single function the World screen's
// six panels (plus the Tavern Identity header strip) render against.
// Pure: same input → same WorldOverviewData. No DOM, no globals, no
// Math.random.
//
// Cards-contract §1 — the simulation is the source of truth; this
// projection resolves entity references to display labels, computes
// derived view-model fields, and surfaces attribution data ("what
// in-world entities think") alongside ground-truth meters. It never
// invents data not already in state.
//
// Sub-panels: Regulars, Suppliers, Factions, Cultures, Notable NPCs,
// Rumours. Plus a small Tavern Identity strip above the sub-nav.

import {
  applicableActionsForTarget,
  actionDisabledReasonForTarget,
} from '../sim/modules/ownerActions/readonlyHelpers'
import { DAY_MINUTES } from '../sim/modules/ownerActions/stateHelpers'
import {
  attributionsByTarget,
  attributionsHeldBy,
} from '../sim/modules/attribution/attributionQueries'
import { stockRegistry } from '../sim/registries/stockRegistry'
import { resolveEntityLabel, resolveBareEntityId } from './entityLabels'
import { humanizeId } from './labels/idLabel'
import {
  pickFactionRelationNoun,
  type FactionRelationKey,
} from '../sim/content/text/descriptors'
import type {
  AttributionAccuracy,
  AttributionState,
  AttributionType,
} from '../sim/modules/attribution/attributionTypes'
import type { OwnerActionDefinition } from '../sim/modules/ownerActions/types'
import type {
  CultureWorldState,
  EntityRef,
  FactionWorldState,
  MemoryState,
  NotableNpcWorldState,
  RegularWorldState,
  SocialRumourState,
  SupplierWorldState,
  TavernIdentityState,
  TavernState,
} from '../sim/state/TavernState'

// ---------- Shared types ----------

export type WorldOverviewData = {
  identity: TavernIdentityData
  regulars: RegularsPanelData
  suppliers: SuppliersPanelData
  factions: FactionsPanelData
  cultures: CulturesPanelData
  npcs: NpcsPanelData
  rumours: RumoursPanelData
}

export type ApplicableActionRef = {
  actionId: string
  label: string
  category: 'immediate' | 'project' | 'policy' | 'social'
  timeCost: number
  disabledReason?: string
}

export type AttributionRow = {
  id: string
  readable: string
  attributionType: AttributionType
  accuracy: AttributionAccuracy
  strength: number
  confidence: number
  publicness: number
  volatility: number
  ageDays: number
  targetLabel: string
  perceiverLabel: string
  tags: string[]
}

// ---------- Tavern Identity ----------

export type TavernIdentityData = {
  foundingDay: number
  daysOpen: number
  knownFor: string[]
  houseRules: string[]
  atmosphereTags: string[]
  // Phase 95 — Identity-as-perception. Composed at projection time
  // from attribution and rumour state. The strip surfaces these as
  // "Voices" and "Nicknames" so the player can read what the world
  // around the tavern thinks of it (game-loop-and-ux §9.5 option 2).
  attributionHints: string[]
  nicknames: string[]
}

// ---------- Regulars ----------

export type RegularsPanelData = {
  count: number
  rows: RegularRow[]
}

export type RegularRow = {
  id: string
  name: string
  customerGroupId: string
  customerGroupLabel: string
  cultureId?: string
  cultureLabel?: string
  factionId?: string
  factionLabel?: string
  loyalty: number
  irritation: number
  visits: number
  favoriteStockId?: string
  favoriteStockLabel?: string
  favoriteStockOnHand?: number
  firstSeenDay: number
  lastSeenDay: number
  daysSinceLastSeen: number
  tags: string[]
  activeFlags: string[]
  recentMemories: MemoryRow[]
  attributionsHeld: AttributionRow[]
  attributionsAgainst: AttributionRow[]
  applicableActions: ApplicableActionRef[]
}

export type MemoryRow = {
  id: string
  label: string
  type: MemoryState['type']
  ageDays: number
  strength: number
  tags: string[]
}

// ---------- Suppliers ----------

export type SuppliersPanelData = {
  count: number
  rows: SupplierRow[]
}

export type SupplierRow = {
  id: string
  name: string
  /** Original supplier label; differs from `name` when a GeneratedName is set. */
  label: string
  supplierType: string
  reliability: number
  relationship: number
  debtTolerance: number
  priceBias: number
  goods: SupplierGoodRow[]
  factionId?: string
  factionLabel?: string
  cultureId?: string
  cultureLabel?: string
  lastDeliveryDay?: number
  daysSinceLastDelivery?: number
  tags: string[]
  activeFlags: string[]
  attributionsAgainst: AttributionRow[]
  applicableActions: ApplicableActionRef[]
}

export type SupplierGoodRow = {
  ingredientId: string
  ingredientLabel: string
  onHand: number
  basePrice: number
}

// ---------- Factions ----------

export type FactionsPanelData = {
  count: number
  rows: FactionRow[]
}

export type FactionRow = {
  id: string
  label: string
  relationship: number
  influence: number
  trust: number
  fear: number
  relationKey: FactionRelationKey
  relationNoun: string
  cultureId?: string
  cultureLabel?: string
  tags: string[]
  activeFlags: string[]
  attributionsAgainst: AttributionRow[]
  applicableActions: ApplicableActionRef[]
}

// ---------- Cultures ----------

export type CulturesPanelData = {
  count: number
  rows: CultureRow[]
}

export type CultureRow = {
  id: string
  label: string
  familiarity: number
  comfort: number
  tension: number
  namingProfileId: string
  preferredStockTags: string[]
  dislikedTags: string[]
  importantCalendarTags: string[]
  tags: string[]
  members: CultureMembers
}

export type CultureMembers = {
  regulars: number
  suppliers: number
  factions: number
  npcs: number
}

// ---------- Notable NPCs ----------

export type NpcsPanelData = {
  count: number
  rows: NpcRow[]
}

export type NpcRow = {
  id: string
  name: string
  kind: string
  cultureId?: string
  cultureLabel?: string
  factionId?: string
  factionLabel?: string
  customerGroupId?: string
  customerGroupLabel?: string
  firstSeenDay: number
  lastSeenDay?: number
  daysSinceLastSeen?: number
  tags: string[]
  activeFlags: string[]
  attributionsHeld: AttributionRow[]
  attributionsAgainst: AttributionRow[]
}

// ---------- Rumours ----------

export type RumoursPanelData = {
  count: number
  rows: RumourRow[]
}

export type RumourRow = {
  id: string
  label: string
  strength: number
  accuracy: 'true' | 'partial' | 'false' | 'unknown'
  sourceLabel?: string
  targetLabel?: string
  subjectLabel?: string
  involvedLabels: string[]
  firstHeardDay: number
  lastSpreadDay: number
  daysSinceFirstHeard: number
  daysSinceLastSpread: number
  tags: string[]
}

// ---------- Implementation ----------

const ATTRIBUTION_LIMIT = 4
const MEMORY_LIMIT = 5

export function buildWorldOverview(state: TavernState): WorldOverviewData {
  return {
    identity: projectIdentity(state),
    regulars: projectRegulars(state),
    suppliers: projectSuppliers(state),
    factions: projectFactions(state),
    cultures: projectCultures(state),
    npcs: projectNpcs(state),
    rumours: projectRumours(state),
  }
}

// ---------- Identity ----------

const ATTRIBUTION_HINT_CAP = 4
const NICKNAME_CAP = 2
const ATTRIBUTION_PUBLICNESS_MIN = 40
const ATTRIBUTION_STRENGTH_MIN = 50

/**
 * Phase 95 — Compose a short, public-facing identity hint phrasing
 * the type of belief a perceiver cohort holds. Keys off
 * `attributionType` first, then the perceiver kind so factions read
 * different from regulars.
 */
type HintTemplate = {
  positive: string
  negative: string
}

const ATTRIBUTION_HINT_TEMPLATES: Readonly<
  Record<AttributionType, HintTemplate>
> = Object.freeze({
  credit: { positive: '$P credit this place', negative: '$P credit this place' },
  gratitude: {
    positive: '$P are grateful',
    negative: '$P are grateful',
  },
  trust: { positive: '$P trust the host', negative: '$P trust the host' },
  blame: { positive: '$P blame the host', negative: '$P blame the host' },
  resentment: {
    positive: '$P resent the place',
    negative: '$P resent the place',
  },
  distrust: { positive: '$P distrust the host', negative: '$P distrust the host' },
  suspicion: { positive: '$P are suspicious', negative: '$P are suspicious' },
})

/**
 * Pretty-print a perceiver cohort as a player-facing phrase. The
 * resolver returns "Granny Hoss" for a regular and "The Black Hand"
 * for a faction; we want plural-ish, lowercase fragments so the
 * surrounding template reads well. Names stay as-is.
 */
function formatPerceiverLabel(kind: string, label: string): string {
  switch (kind) {
    case 'faction':
      return label // proper-noun faction names
    case 'culture':
      return label.toLowerCase()
    case 'customer_group':
      return label.toLowerCase()
    case 'regular':
    case 'notable_npc':
      return label
    default:
      return label
  }
}

function projectAttributionHints(state: TavernState): string[] {
  const slice = state.modules['attribution'] as
    | { attributions?: AttributionState[] }
    | undefined
  const attributions = slice?.attributions ?? []
  if (attributions.length === 0) return []

  type Candidate = {
    score: number
    perceiverKind: string
    attributionType: AttributionType
    label: string
    accuracy: AttributionAccuracy
  }
  const candidates: Candidate[] = []
  for (const a of attributions) {
    if (a.publicness < ATTRIBUTION_PUBLICNESS_MIN) continue
    if (a.strength < ATTRIBUTION_STRENGTH_MIN) continue
    if (a.accuracy === 'unknown') continue
    const label = formatPerceiverLabel(
      a.perceivedBy.kind,
      resolveEntityLabel(state, a.perceivedBy),
    )
    if (!label) continue
    candidates.push({
      score: a.publicness * a.strength,
      perceiverKind: a.perceivedBy.kind,
      attributionType: a.attributionType,
      label,
      accuracy: a.accuracy,
    })
  }
  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return a.label.localeCompare(b.label)
  })

  const seenKey = new Set<string>()
  const out: string[] = []
  for (const c of candidates) {
    // Cap: at most one hint per (perceiver kind, attribution type)
    // so a single noisy regular doesn't dominate the strip.
    const dedupKey = `${c.perceiverKind}::${c.attributionType}`
    if (seenKey.has(dedupKey)) continue
    seenKey.add(dedupKey)
    const template = ATTRIBUTION_HINT_TEMPLATES[c.attributionType]
    if (!template) continue
    let phrase = template.positive.replace('$P', c.label)
    // Note false attributions so the player reads "perceived, not
    // necessarily true." Cards-contract §3.5 leans into the gap.
    if (c.accuracy === 'false' || c.accuracy === 'partial') {
      phrase = `${phrase} (perhaps wrongly)`
    }
    out.push(phrase)
    if (out.length >= ATTRIBUTION_HINT_CAP) break
  }
  return out
}

function projectNicknames(state: TavernState): string[] {
  const rumours = Object.values(state.world.socialRumours ?? {})
  if (rumours.length === 0) return []
  const candidates = rumours
    .filter((r) => r.accuracy !== 'false' && (r.tags ?? []).includes('nickname'))
    .slice()
    .sort((a, b) => {
      if (b.strength !== a.strength) return b.strength - a.strength
      if (b.lastSpreadDay !== a.lastSpreadDay) return b.lastSpreadDay - a.lastSpreadDay
      return a.id.localeCompare(b.id)
    })
    .slice(0, NICKNAME_CAP)
  return candidates.map((r) => r.label)
}

function projectIdentity(state: TavernState): TavernIdentityData {
  const identity: TavernIdentityState = state.world.tavernIdentity
  const daysOpen = Math.max(
    0,
    state.calendar.totalDaysElapsed - identity.foundingDay,
  )
  return {
    foundingDay: identity.foundingDay,
    daysOpen,
    knownFor: [...identity.knownFor],
    houseRules: [...identity.houseRules],
    atmosphereTags: [...identity.atmosphereTags],
    attributionHints: projectAttributionHints(state),
    nicknames: projectNicknames(state),
  }
}

// ---------- Regulars ----------

function projectRegulars(state: TavernState): RegularsPanelData {
  const today = state.calendar.totalDaysElapsed
  const rows = Object.values(state.world.regulars)
    .map((r) => projectRegularRow(state, r, today))
    .sort((a, b) => {
      if (b.loyalty !== a.loyalty) return b.loyalty - a.loyalty
      if (b.lastSeenDay !== a.lastSeenDay) return b.lastSeenDay - a.lastSeenDay
      return a.id.localeCompare(b.id)
    })
  return { count: rows.length, rows }
}

function projectRegularRow(
  state: TavernState,
  regular: RegularWorldState,
  today: number,
): RegularRow {
  const customerGroupLabel =
    state.customerGroups[regular.customerGroupId]?.label ?? regular.customerGroupId
  const cultureLabel = regular.cultureId
    ? state.world.cultures[regular.cultureId]?.label
    : undefined
  const factionLabel = regular.factionId
    ? state.world.factions[regular.factionId]?.label
    : undefined
  const favoriteStockLabel = regular.favoriteStockId
    ? state.stock[regular.favoriteStockId]?.label ??
      stockRegistry.get(regular.favoriteStockId)?.label
    : undefined
  const favoriteStockOnHand = regular.favoriteStockId
    ? state.stock[regular.favoriteStockId]?.quantity
    : undefined

  const ref: EntityRef = { kind: 'regular', id: regular.id }
  const recentMemories = projectMemoriesForActor(state, ref, regular.knownIncidentIds)
  const attributionsHeld = projectAttributionRows(
    state,
    attributionsHeldBy(state, ref),
    'held',
  )
  const attributionsAgainst = projectAttributionRows(
    state,
    attributionsByTarget(state, ref),
    'against',
  )
  const applicableActions = applicableActionsForRow(state, 'regular', regular.id)

  const row: RegularRow = {
    id: regular.id,
    name: regular.name.display,
    customerGroupId: regular.customerGroupId,
    customerGroupLabel,
    loyalty: regular.loyalty,
    irritation: regular.irritation,
    visits: regular.visits,
    firstSeenDay: regular.firstSeenDay,
    lastSeenDay: regular.lastSeenDay,
    daysSinceLastSeen: Math.max(0, today - regular.lastSeenDay),
    tags: [...regular.tags],
    activeFlags: [...regular.activeFlags],
    recentMemories,
    attributionsHeld,
    attributionsAgainst,
    applicableActions,
  }
  if (regular.cultureId !== undefined) row.cultureId = regular.cultureId
  if (cultureLabel !== undefined) row.cultureLabel = cultureLabel
  if (regular.factionId !== undefined) row.factionId = regular.factionId
  if (factionLabel !== undefined) row.factionLabel = factionLabel
  if (regular.favoriteStockId !== undefined) {
    row.favoriteStockId = regular.favoriteStockId
  }
  if (favoriteStockLabel !== undefined) row.favoriteStockLabel = favoriteStockLabel
  if (favoriteStockOnHand !== undefined) row.favoriteStockOnHand = favoriteStockOnHand
  return row
}

function projectMemoriesForActor(
  state: TavernState,
  actorRef: EntityRef,
  knownIncidentIds: string[],
): MemoryRow[] {
  const memoryById = new Map<string, MemoryState>()
  for (const m of state.memories) memoryById.set(m.id, m)

  const seen = new Set<string>()
  const collected: MemoryState[] = []

  // Priority 1: explicitly known incident ids from the entity record.
  for (const id of knownIncidentIds) {
    const memory = memoryById.get(id)
    if (memory && !seen.has(memory.id)) {
      seen.add(memory.id)
      collected.push(memory)
    }
  }
  // Priority 2: any memory whose actors list includes this entity.
  for (const memory of state.memories) {
    if (seen.has(memory.id)) continue
    if (
      memory.actors.some(
        (a) => a.kind === actorRef.kind && a.id === actorRef.id,
      )
    ) {
      seen.add(memory.id)
      collected.push(memory)
    }
  }

  collected.sort((a, b) => a.ageDays - b.ageDays)
  return collected.slice(0, MEMORY_LIMIT).map((m) => ({
    id: m.id,
    // Phase 204 / audit Wave 5 (`P6-COMP-007`) — a memory with no
    // authored label used to surface its raw key (`ogres_dismissed`).
    label: m.label ?? humanizeId(m.definitionId ?? m.id),
    type: m.type,
    ageDays: m.ageDays,
    strength: m.strength,
    tags: [...m.tags],
  }))
}

// ---------- Suppliers ----------

function projectSuppliers(state: TavernState): SuppliersPanelData {
  const rows = Object.values(state.world.suppliers)
    .map((s) => projectSupplierRow(state, s))
    .sort((a, b) => {
      if (b.relationship !== a.relationship) return b.relationship - a.relationship
      if (b.reliability !== a.reliability) return b.reliability - a.reliability
      return a.id.localeCompare(b.id)
    })
  return { count: rows.length, rows }
}

function projectSupplierRow(
  state: TavernState,
  supplier: SupplierWorldState,
): SupplierRow {
  const today = state.calendar.totalDaysElapsed
  const factionLabel = supplier.factionId
    ? state.world.factions[supplier.factionId]?.label
    : undefined
  const cultureLabel = supplier.cultureId
    ? state.world.cultures[supplier.cultureId]?.label
    : undefined
  const goods: SupplierGoodRow[] = supplier.goodsProvided.map((ingredientId) => {
    const onHand = state.stock[ingredientId]?.quantity ?? 0
    const basePrice =
      state.stock[ingredientId]?.basePrice ??
      stockRegistry.get(ingredientId)?.defaultState.basePrice ??
      0
    const ingredientLabel =
      state.stock[ingredientId]?.label ??
      stockRegistry.get(ingredientId)?.label ??
      ingredientId
    return { ingredientId, ingredientLabel, onHand, basePrice }
  })
  const attributionsAgainst = projectAttributionRows(
    state,
    attributionsByTarget(state, { kind: 'supplier', id: supplier.id }),
    'against',
  )
  const applicableActions = applicableActionsForRow(state, 'supplier', supplier.id)

  const row: SupplierRow = {
    id: supplier.id,
    name: supplier.name?.display ?? supplier.label,
    label: supplier.label,
    supplierType: supplier.supplierType,
    reliability: supplier.reliability,
    relationship: supplier.relationship,
    debtTolerance: supplier.debtTolerance,
    priceBias: supplier.priceBias,
    goods,
    tags: [...supplier.tags],
    activeFlags: [...supplier.activeFlags],
    attributionsAgainst,
    applicableActions,
  }
  if (supplier.factionId !== undefined) row.factionId = supplier.factionId
  if (factionLabel !== undefined) row.factionLabel = factionLabel
  if (supplier.cultureId !== undefined) row.cultureId = supplier.cultureId
  if (cultureLabel !== undefined) row.cultureLabel = cultureLabel
  if (supplier.lastDeliveryDay !== undefined) {
    row.lastDeliveryDay = supplier.lastDeliveryDay
    row.daysSinceLastDelivery = Math.max(0, today - supplier.lastDeliveryDay)
  }
  return row
}

// ---------- Factions ----------

function projectFactions(state: TavernState): FactionsPanelData {
  const rows = Object.values(state.world.factions)
    .map((f) => projectFactionRow(state, f))
    .sort((a, b) => {
      if (b.influence !== a.influence) return b.influence - a.influence
      if (b.relationship !== a.relationship) return b.relationship - a.relationship
      return a.id.localeCompare(b.id)
    })
  return { count: rows.length, rows }
}

function projectFactionRow(
  state: TavernState,
  faction: FactionWorldState,
): FactionRow {
  const cultureLabel = faction.cultureId
    ? state.world.cultures[faction.cultureId]?.label
    : undefined
  const relationKey = relationKeyFromRelationship(faction.relationship)
  const relationNoun = pickFactionRelationNoun(relationKey, `world.${faction.id}`)
  const attributionsAgainst = projectAttributionRows(
    state,
    attributionsByTarget(state, { kind: 'faction', id: faction.id }),
    'against',
  )
  const applicableActions = applicableActionsForRow(state, 'faction', faction.id)

  const row: FactionRow = {
    id: faction.id,
    label: faction.label,
    relationship: faction.relationship,
    influence: faction.influence,
    trust: faction.trust,
    fear: faction.fear,
    relationKey,
    relationNoun,
    tags: [...faction.tags],
    activeFlags: [...faction.activeFlags],
    attributionsAgainst,
    applicableActions,
  }
  if (faction.cultureId !== undefined) row.cultureId = faction.cultureId
  if (cultureLabel !== undefined) row.cultureLabel = cultureLabel
  return row
}

function relationKeyFromRelationship(value: number): FactionRelationKey {
  if (value <= 20) return 'feud'
  if (value <= 40) return 'rivalry'
  if (value <= 55) return 'tension'
  if (value <= 70) return 'truce'
  return 'cooperation'
}

// ---------- Cultures ----------

function projectCultures(state: TavernState): CulturesPanelData {
  const memberIndex = buildCultureMemberIndex(state)
  const rows = Object.values(state.world.cultures)
    .map((c) => projectCultureRow(c, memberIndex.get(c.id)))
    .sort((a, b) => {
      if (b.familiarity !== a.familiarity) return b.familiarity - a.familiarity
      return a.id.localeCompare(b.id)
    })
  return { count: rows.length, rows }
}

function projectCultureRow(
  culture: CultureWorldState,
  members: CultureMembers | undefined,
): CultureRow {
  return {
    id: culture.id,
    label: culture.label,
    familiarity: culture.familiarity,
    comfort: culture.comfort,
    tension: culture.tension,
    namingProfileId: culture.namingProfileId,
    preferredStockTags: [...culture.preferredStockTags],
    dislikedTags: [...culture.dislikedTags],
    importantCalendarTags: [...culture.importantCalendarTags],
    tags: [...culture.tags],
    members: members ?? { regulars: 0, suppliers: 0, factions: 0, npcs: 0 },
  }
}

function buildCultureMemberIndex(
  state: TavernState,
): Map<string, CultureMembers> {
  const out = new Map<string, CultureMembers>()
  for (const id of Object.keys(state.world.cultures)) {
    out.set(id, { regulars: 0, suppliers: 0, factions: 0, npcs: 0 })
  }
  const bump = (cultureId: string | undefined, kind: keyof CultureMembers) => {
    if (!cultureId) return
    const entry = out.get(cultureId)
    if (!entry) return
    entry[kind] += 1
  }
  for (const r of Object.values(state.world.regulars)) bump(r.cultureId, 'regulars')
  for (const s of Object.values(state.world.suppliers)) bump(s.cultureId, 'suppliers')
  for (const f of Object.values(state.world.factions)) bump(f.cultureId, 'factions')
  for (const n of Object.values(state.world.notableNpcs)) bump(n.cultureId, 'npcs')
  return out
}

// ---------- Notable NPCs ----------

function projectNpcs(state: TavernState): NpcsPanelData {
  const today = state.calendar.totalDaysElapsed
  const rows = Object.values(state.world.notableNpcs)
    .map((n) => projectNpcRow(state, n, today))
    .sort((a, b) => {
      const aLast = a.lastSeenDay ?? a.firstSeenDay
      const bLast = b.lastSeenDay ?? b.firstSeenDay
      if (bLast !== aLast) return bLast - aLast
      if (b.firstSeenDay !== a.firstSeenDay) return b.firstSeenDay - a.firstSeenDay
      return a.id.localeCompare(b.id)
    })
  return { count: rows.length, rows }
}

function projectNpcRow(
  state: TavernState,
  npc: NotableNpcWorldState,
  today: number,
): NpcRow {
  const cultureLabel = npc.cultureId
    ? state.world.cultures[npc.cultureId]?.label
    : undefined
  const factionLabel = npc.factionId
    ? state.world.factions[npc.factionId]?.label
    : undefined
  const customerGroupLabel = npc.customerGroupId
    ? state.customerGroups[npc.customerGroupId]?.label
    : undefined
  const ref: EntityRef = { kind: 'notable_npc', id: npc.id }
  const attributionsHeld = projectAttributionRows(
    state,
    attributionsHeldBy(state, ref),
    'held',
  )
  const attributionsAgainst = projectAttributionRows(
    state,
    attributionsByTarget(state, ref),
    'against',
  )

  const row: NpcRow = {
    id: npc.id,
    name: npc.name.display,
    kind: npc.kind,
    firstSeenDay: npc.firstSeenDay,
    tags: [...npc.tags],
    activeFlags: [...npc.activeFlags],
    attributionsHeld,
    attributionsAgainst,
  }
  if (npc.cultureId !== undefined) row.cultureId = npc.cultureId
  if (cultureLabel !== undefined) row.cultureLabel = cultureLabel
  if (npc.factionId !== undefined) row.factionId = npc.factionId
  if (factionLabel !== undefined) row.factionLabel = factionLabel
  if (npc.customerGroupId !== undefined) row.customerGroupId = npc.customerGroupId
  if (customerGroupLabel !== undefined) row.customerGroupLabel = customerGroupLabel
  if (npc.lastSeenDay !== undefined) {
    row.lastSeenDay = npc.lastSeenDay
    row.daysSinceLastSeen = Math.max(0, today - npc.lastSeenDay)
  }
  return row
}

// ---------- Rumours ----------

function projectRumours(state: TavernState): RumoursPanelData {
  const today = state.calendar.totalDaysElapsed
  const rows = Object.values(state.world.socialRumours)
    .map((r) => projectRumourRow(state, r, today))
    .sort((a, b) => {
      if (b.strength !== a.strength) return b.strength - a.strength
      if (b.lastSpreadDay !== a.lastSpreadDay) return b.lastSpreadDay - a.lastSpreadDay
      return a.id.localeCompare(b.id)
    })
  return { count: rows.length, rows }
}

function projectRumourRow(
  state: TavernState,
  rumour: SocialRumourState,
  today: number,
): RumourRow {
  const sourceLabel = rumour.sourceEntityId
    ? resolveBareEntityId(state, rumour.sourceEntityId)
    : undefined
  const targetLabel = rumour.targetEntityId
    ? resolveBareEntityId(state, rumour.targetEntityId)
    : undefined
  const subjectLabel = rumour.subject
    ? resolveEntityLabel(state, rumour.subject)
    : undefined
  const involvedLabels = (rumour.involvedRefs ?? []).map((ref) =>
    resolveEntityLabel(state, ref),
  )

  const row: RumourRow = {
    id: rumour.id,
    label: rumour.label,
    strength: rumour.strength,
    accuracy: rumour.accuracy,
    involvedLabels,
    firstHeardDay: rumour.firstHeardDay,
    lastSpreadDay: rumour.lastSpreadDay,
    daysSinceFirstHeard: Math.max(0, today - rumour.firstHeardDay),
    daysSinceLastSpread: Math.max(0, today - rumour.lastSpreadDay),
    tags: [...rumour.tags],
  }
  if (sourceLabel !== undefined) row.sourceLabel = sourceLabel
  if (targetLabel !== undefined) row.targetLabel = targetLabel
  if (subjectLabel !== undefined) row.subjectLabel = subjectLabel
  return row
}

// ---------- Attribution projection ----------

function projectAttributionRows(
  state: TavernState,
  attributions: AttributionState[],
  mode: 'held' | 'against',
): AttributionRow[] {
  const sorted = [...attributions].sort((a, b) => {
    const aScore =
      mode === 'held'
        ? a.strength * a.confidence
        : a.publicness * a.strength
    const bScore =
      mode === 'held'
        ? b.strength * b.confidence
        : b.publicness * b.strength
    if (bScore !== aScore) return bScore - aScore
    return a.id.localeCompare(b.id)
  })
  return sorted.slice(0, ATTRIBUTION_LIMIT).map((a) => ({
    id: a.id,
    readable: a.readable,
    attributionType: a.attributionType,
    accuracy: a.accuracy,
    strength: a.strength,
    confidence: a.confidence,
    publicness: a.publicness,
    volatility: a.volatility,
    ageDays: a.ageDays,
    targetLabel: resolveEntityLabel(state, a.target),
    perceiverLabel: resolveEntityLabel(state, a.perceivedBy),
    tags: [...a.tags],
  }))
}

// ---------- Shared helpers ----------

function applicableActionsForRow(
  state: TavernState,
  targetType: OwnerActionDefinition['targetType'],
  targetId: string,
): ApplicableActionRef[] {
  return applicableActionsForTarget(state, targetType, targetId).map((def) => {
    const reason = actionDisabledReasonForTarget(
      def,
      state,
      targetId,
      DAY_MINUTES,
    )
    const ref: ApplicableActionRef = {
      actionId: def.id,
      label: def.label,
      category: def.category,
      timeCost: def.timeCost,
    }
    if (reason !== undefined) ref.disabledReason = reason
    return ref
  })
}


