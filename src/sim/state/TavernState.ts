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

export type StockState = {
  id: string
  label: string
  quantity: number
  quality: number
  spoilage: number
  unitValue: number
  tags: string[]
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
  damageRisk: number
  tabRisk: number
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
