import type { ShortageRecord } from '../stock/types'
import type { ServiceQualityModifiers } from '../staff/types'

// Phase 12 — Daily service module types.
//
// `DailyServiceResult` is the structured per-day record the service module
// writes into `state.modules.service`. The shape mirrors phases-11-15.md
// §12 "Service Output". Phase 12 keeps everything numeric/log shaped — no
// prose scenes, no card text — per the §12 "Do Not Do" rules.
//
// `ServiceIncidentSummary` records a single noteworthy event from a
// service day. Severity is a 0–100 meter; actor/area/effects are
// optional so simple incidents (a generic shortage) can be recorded
// without overcommitting.

export type PurchaseLine = {
  stockId: string
  quantity: number
  coin: number
}

export type PurchaseSummary = {
  groupId: string
  visitors: number
  coinEarned: number
  unpaidTabs: number
  netCoin: number
  itemsBought: PurchaseLine[]
  shortages: ShortageRecord[]
}

export type AreaChangeSummary = {
  areaId: string
  field: 'mess' | 'damage' | 'cleanliness' | 'smell' | 'risk'
  delta: number
  reason: string
}

export type CustomerSatisfactionChange = {
  groupId: string
  before: number
  after: number
  delta: number
  drivers: string[]
}

export type StaffChangeSummary = {
  staffId: string
  stressDelta: number
  fatigueDelta: number
  moraleDelta: number
  notes: string[]
}

export type ServiceIncidentSummary = {
  id: string
  severity: number
  actorGroup?: string
  areaId?: string
  effects: string[]
}

export type DailyServiceResult = {
  dayKey: string
  trafficByGroup: Record<string, number>
  purchasesByGroup: Record<string, PurchaseSummary>
  coinEarned: number
  unpaidTabs: number
  netCoinEarned: number
  stockConsumed: Array<{ stockId: string; quantity: number }>
  shortages: ShortageRecord[]
  messCreated: AreaChangeSummary[]
  damageCreated: AreaChangeSummary[]
  satisfactionChanges: CustomerSatisfactionChange[]
  staffChanges: StaffChangeSummary[]
  incidents: ServiceIncidentSummary[]
  /** Staff service-quality modifiers as published by the staff module. */
  serviceQuality: ServiceQualityModifiers
}

export type ServiceModuleState = {
  result: DailyServiceResult
}
