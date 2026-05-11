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

export type StaffRole = 'cook' | 'server' | 'cleaner_bouncer'

export type StaffState = {
  id: string
  name: string
  role: StaffRole
  skill: number
  morale: number
  stress: number
  fatigue: number
  loyalty: number
  wage: number
  tags: string[]
  activeProblems: string[]
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

export type ReputationState = {
  cheap: number
  tasty: number
  filthy: number
  dangerous: number
  cozy: number
  strange: number
  reliable: number
  goblinAuthentic: number
}

export type MemoryState = {
  id: string
  type: 'fact' | 'timed' | 'grudge' | 'hook'
  strength: number
  ageDays: number
  durationDays?: number
  tags: string[]
  relatedIds: string[]
  data?: Record<string, unknown>
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
  causes: CauseState[]
  pressures: Record<string, PressureState>

  modules: Record<string, unknown>
}
