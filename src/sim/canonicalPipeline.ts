// Phase 92 / ISSUE-052 — Canonical simulation pipeline.
//
// The ordered list of `SimulationModule`s that production code (the
// engine, validation, persistence migrations) treats as the authoritative
// runtime pipeline. Previously this lived in `src/sim/testing/simRunner.ts`,
// which meant production code had to import from `testing/` to reach the
// pipeline. The array is re-exported from the old location to keep
// existing imports working.
//
// The order is load-bearing: state owners (areas/stock/staff/customers)
// run before the input/service modules, which run before weekly/monthly
// closers, memory/history pipelines, then the analysis stack
// (causes → pressures → feedback → issue seeds).

import type { SimulationModule } from './core/module'

import { areasModule } from './modules/areas/index'
import { attributionModule } from './modules/attribution/index'
import { causesModule } from './modules/causes/index'
import { customersModule } from './modules/customers/index'
import { feedbackModule } from './modules/feedback/index'
import { historyModule } from './modules/history/index'
import { issueSeedsModule } from './modules/issues/index'
import { memoriesModule } from './modules/memories/index'
import { responsesModule } from './modules/responses/index'
import { localArcsModule } from './modules/localArcs/index'
import { monthlyModule } from './modules/monthly/index'
import { ownerActionsModule } from './modules/ownerActions/index'
import { pressuresModule } from './modules/pressures/index'
import { serviceModule } from './modules/service/index'
import { staffModule } from './modules/staff/index'
import { stockModule } from './modules/stock/index'
import { weeklyModule } from './modules/weekly/index'
import { worldModule } from './modules/world/index'
import { cultureModule } from './modules/cultures/index'
import { factionModule } from './modules/factions/index'
import { supplierModule } from './modules/suppliers/index'
import { regularModule } from './modules/regulars/index'
import { adventurersModule } from './modules/adventurers/index'
import { expeditionsModule } from './modules/expeditions/index'
import { tavernIdentityModule } from './modules/tavernIdentity/index'
import { kernelModule } from './modules/kernel/index'
import { ventureModule } from './modules/ventures/index'
import { arcModule } from './modules/arcs/index'
import { openingsModule } from './modules/openings/index'

export const FULL_PIPELINE: ReadonlyArray<SimulationModule> = [
  areasModule,
  stockModule,
  staffModule,
  customersModule,
  worldModule,
  cultureModule,
  factionModule,
  supplierModule,
  regularModule,
  adventurersModule,
  expeditionsModule,
  ownerActionsModule,
  serviceModule,
  weeklyModule,
  monthlyModule,
  localArcsModule,
  tavernIdentityModule,
  memoriesModule,
  historyModule,
  causesModule,
  attributionModule,
  pressuresModule,
  feedbackModule,
  kernelModule,
  ventureModule,
  arcModule,
  openingsModule,
  issueSeedsModule,
  responsesModule,
]
