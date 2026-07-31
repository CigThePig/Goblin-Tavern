import type { EntityRef } from '../../state/TavernState'
import type { ShortageRecord } from '../stock/types'
import type { ServiceQualityModifiers } from '../staff/types'

import type { ServiceFlowResult } from './flow/types'
import type { PatronTabIndexEntry } from './tabs'

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
//
// Phase 32 §32.1 — adds `ServiceScene`, the structured "scene ingredient"
// record produced by `buildServiceScenes` during `afterService`. Scenes
// are not finished cards; they are deterministic, structured pointers at
// named entities, areas, causes, and text ingredients. The card layer
// (post-Phase-40) consumes them. See phases-31-35 §32 "Do Not Do" — no
// prose, no card ids, no card text.

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

// Phase 32 §32.1 — structured "scene" record produced after service
// resolves. Scenes are deterministic and condition-driven; they reference
// named entities (regulars, staff, suppliers, customer groups) and areas
// rather than inventing flavour. `textIngredients` is a strictly
// JSON-safe key/value map: it gives the future card layer the parts it
// needs to write prose without letting this layer write prose itself.
export type ServiceSceneType =
  | 'staff_customer_friction'
  | 'regular_complaint'
  | 'supplier_arrival_during_rush'
  | 'area_problem_noticed'
  | 'stock_quality_complaint'
  | 'cultural_seating_friction'
  | 'unpaid_tab_argument'
  | 'brawl_aftermath'
  | 'staff_moment'

export type ServiceSceneSeverity = 'minor' | 'moderate' | 'major'

export type ServiceSceneTextIngredients = Record<
  string,
  string | number | boolean | null
>

export type ServiceScene = {
  id: string
  sceneType: ServiceSceneType
  severity: ServiceSceneSeverity
  numericSeverity: number
  areaId?: string
  involvedEntityRefs: EntityRef[]
  involvedGroupIds: string[]
  staffIds: string[]
  regularIds: string[]
  supplierIds: string[]
  tags: string[]
  causes: string[]
  textIngredients: ServiceSceneTextIngredients
  possibleIssueSeedIds: string[]
}

export type DailyServiceResult = {
  dayKey: string
  /**
   * Expansion Phase 4 §4.1 — the evening's substeps, in full.
   *
   * The aggregate totals below are DERIVED from this rather than computed
   * alongside it, which is what makes "reports reconcile service substeps to
   * aggregate ledger totals" a real check: there is one calculation, and the
   * summary is a projection of it.
   */
  flow: ServiceFlowResult
  /** Ids of patron tabs opened tonight (§4.5). */
  tabsOpened: string[]
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
  /**
   * Phase 32 §32.1 — structured service scenes generated after the
   * primary service result resolves. Always present (possibly empty) so
   * downstream code can treat it as an array.
   */
  scenes: ServiceScene[]
}

/**
 * Expansion Phase 4 §4.5 — the service module's persistent half.
 *
 * `result` is per-day and clears every morning. `patronTabs` does not: a slate
 * outlives the night it was run up, which is the entire difference between a
 * debt and a deduction. The money lives in the shared obligation ledger; this
 * index holds the patron-tab facts that ledger has no field for.
 */
export type ServiceModuleState = {
  result: DailyServiceResult
  /** Live tabs, oldest first. Bounded by `MAX_OPEN_PATRON_TABS`. */
  patronTabs: PatronTabIndexEntry[]
  totals: {
    tabsOpened: number
    tabsCollected: number
    tabsForgiven: number
    tabsWrittenOff: number
    /** Lifetime coin recovered from chased slates. */
    coinRecovered: number
    /** Lifetime patrons who left without being served. */
    patronsAbandoned: number
  }
}
