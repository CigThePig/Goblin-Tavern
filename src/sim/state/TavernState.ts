import type { CalendarState } from '../modules/calendar/types'

export type TavernMetaState = {
  tavernId: string
  tavernName: string
  simVersion: string
  createdAtDay: number
}

export type AreaState = {
  id: string
  label: string
  condition: number
  cleanliness: number
  mess: number
  damage: number
  smell: number
  risk: number
  tags: string[]
  activeProblems: string[]
}

// Phase 9 §"Stock State" — Phase 9 extends the Phase 5 stock shape with
// `basePrice` (per-unit restock cost), `salePrice` (per-unit customer
// price), and an optional `storageAreaId`. This mirrors the additive
// precedent set for `CustomerGroupState` (forward note in Phase 10 §"Customer
// Group State"). The Phase 5 placeholder field `unitValue` is replaced by
// the explicit two-price model the economy needs.
export type StockState = {
  id: string
  label: string
  quantity: number
  quality: number
  spoilage: number
  basePrice: number
  salePrice: number
  tags: string[]
  storageAreaId?: string
}

// Phase 11 §11.1 / "Role typing clarification" — `StaffRoleId` is a
// registry string. The earlier Phase 5 placeholder typed `role` as the
// hard-coded union `'cook' | 'server' | 'cleaner_bouncer'`; that union is
// kept exported as `StaffRole` for legacy shorthand, but the canonical
// field type is `StaffRoleId` (a string validated against
// `staffRegistry`). Same precedent applies to `StaffPriorityId`
// (validated against `staffPriorityRegistry`).
export type StaffRoleId = string
export type StaffPriorityId = string

/** @deprecated Phase 11 — legacy union kept only for backwards-compatible
 *  type imports. Prefer `StaffRoleId`. */
export type StaffRole = 'cook' | 'server' | 'cleaner_bouncer'

export type StaffState = {
  id: string
  name: string
  role: StaffRoleId
  skill: number
  morale: number
  stress: number
  fatigue: number
  loyalty: number
  wage: number
  paidThisWeek: boolean
  currentPriority?: StaffPriorityId
  unavailable?: boolean
  tags: string[]
  activeFlags: string[]
}

// Phase 10 §"Customer Group State" — Phase 10 extends the Phase 5 shape
// with three additive fields: `loyalty`, `preferredStockTags`, and
// `dislikedTags`. The forward note in §"Customer Group State" pins this
// as an additive change (mirrors the `StaffRoleId` precedent), not a fork.
export type CustomerGroupState = {
  id: string
  label: string
  patronage: number
  satisfaction: number
  wealth: number
  rowdiness: number
  dangerTolerance: number
  filthTolerance: number
  priceSensitivity: number
  loyalty: number
  damageRisk: number
  tabRisk: number
  preferredStockTags: string[]
  dislikedTags: string[]
  tags: string[]
  activeGrudges: string[]
}

// Phase 15 §15.5 — Reputation is multi-axis. The `respectable` axis was
// added in Phase 15 alongside the monthly module; the other eight axes
// are unchanged from Phase 5.
export type ReputationState = {
  cheap: number
  tasty: number
  filthy: number
  dangerous: number
  cozy: number
  strange: number
  reliable: number
  goblinAuthentic: number
  respectable: number
}

// Phase 16 §"Calendar Stamp" — a stable, serializable timestamp used by
// memories and history. `absoluteDay` mirrors `CalendarState.totalDaysElapsed`
// so the age of any stamped entry can be computed without re-resolving
// week/month boundaries.
export type CalendarStamp = {
  year: number
  month: number
  week: number
  day: number
  absoluteDay: number
}

// Phase 16 §"Memory Shape" — a memory's `actors` and `locations` reference
// other simulation entities (staff, customer groups, areas, stock items).
// Kept as a plain `{ kind, id }` pair so the array stays JSON-compatible.
export type EntityRef = {
  kind:
    | 'staff'
    | 'customer_group'
    | 'area'
    | 'stock'
    | 'role'
    | 'system'
    | 'other'
  id: string
}

// Phase 16 §"Memory Shape" / §16.1 — `MemoryState` is the on-state record
// for a single memory instance. The Phase 5 placeholder shape
// (`id, type, strength, ageDays, durationDays?, tags, relatedIds, data?`)
// is replaced with the Phase 16 shape: typed actor/location refs,
// calendar stamps, decay rate, source, and structured metadata. The
// `'hook'` type is renamed to `'future_hook'` and `'pattern'` joins the
// canonical set.
export type MemoryType = 'fact' | 'timed' | 'grudge' | 'pattern' | 'future_hook'

export type MemoryState = {
  id: string
  type: MemoryType
  /** Definition id from the memory registry, if this memory has one. */
  definitionId?: string
  label?: string
  strength: number
  ageDays: number
  durationDays?: number
  decayRate?: number
  createdAt: CalendarStamp
  expiresAt?: CalendarStamp
  actors: EntityRef[]
  locations: EntityRef[]
  relatedSystems: string[]
  tags: string[]
  source?: string
  metadata?: Record<string, unknown>
}

// Phase 16 §"History Log Shape" — append-only debug record that lives
// alongside (but distinct from) `state.memories`. Memories influence the
// simulation; history records what already happened.
export type HistoryCategory =
  | 'owner_action'
  | 'service'
  | 'weekly'
  | 'monthly'
  | 'state_change'
  | 'memory'
  | 'pressure'
  | 'system'

export type HistoryEntry = {
  id: string
  timestamp: CalendarStamp
  category: HistoryCategory
  summary: string
  tags: string[]
  relatedActors: EntityRef[]
  relatedLocations: EntityRef[]
  relatedSystems: string[]
  mechanicalRefs?: string[]
}

export type CauseState = {
  id: string
  day: number
  source: string
  target: string
  amount: number
  readable: string
  tags: string[]
}

export type PressureState = {
  id: string
  label: string
  value: number
  trend: number
  tags: string[]
  topCauses: string[]
}

export type TavernState = {
  meta: TavernMetaState
  calendar: CalendarState
  coin: number

  areas: Record<string, AreaState>
  stock: Record<string, StockState>
  staff: Record<string, StaffState>
  customerGroups: Record<string, CustomerGroupState>
  reputation: ReputationState

  memories: MemoryState[]
  history: HistoryEntry[]
  causes: CauseState[]
  pressures: Record<string, PressureState>

  modules: Record<string, unknown>
}
