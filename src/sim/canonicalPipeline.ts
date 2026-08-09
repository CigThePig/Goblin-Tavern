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
import { conditionsModule } from './modules/conditions/index'
import { ownerActionsModule } from './modules/ownerActions/index'
import { pressuresModule } from './modules/pressures/index'
import { serviceModule } from './modules/service/index'
import { staffModule } from './modules/staff/index'
import { stockModule } from './modules/stock/index'
import { weeklyModule } from './modules/weekly/index'
import { worldModule } from './modules/world/index'
import { cultureModule } from './modules/cultures/index'
import { factionModule } from './modules/factions/index'
import { npcModule } from './modules/npcs/index'
import { rumourModule } from './modules/rumours/index'
import { rivalModule } from './modules/rival/index'
import { supplierModule } from './modules/suppliers/index'
import { regularModule } from './modules/regulars/index'
import { adventurersModule } from './modules/adventurers/index'
import { expeditionsModule } from './modules/expeditions/index'
import { tavernIdentityModule } from './modules/tavernIdentity/index'
import { kernelModule } from './modules/kernel/index'
import { ventureModule } from './modules/ventures/index'
import { arcModule } from './modules/arcs/index'
import { openingsModule } from './modules/openings/index'
// Expansion Phase 1 — shared contract modules. `ruleset` first: it holds
// the ongoing rules that area/stock/staff decay read on the same day, so it
// must be present before any state owner runs. `scheduledEvents` and
// `obligations` sit at the end of the pipeline next to `responses`, which is
// the other system that deals in time-shifted consequences.
import { rulesetModule } from './contracts/ruleset/index'
import { metersModule } from './contracts/meters/index'
import { scheduledEventsModule } from './contracts/scheduledEvents/index'
import { obligationsModule } from './contracts/obligations/index'
import { economyModule } from './modules/economy/index'
// Expansion Phase 7 — the three external-obligation domains.
import { financeModule } from './modules/finance/index'
import { tenancyModule } from './modules/tenancy/index'
import { regulatoryModule } from './modules/regulatory/index'

export const FULL_PIPELINE: ReadonlyArray<SimulationModule> = [
  rulesetModule,
  metersModule,
  areasModule,
  stockModule,
  staffModule,
  customersModule,
  worldModule,
  cultureModule,
  factionModule,
  // Expansion Phase 8 §8.3 — the notable-NPC module. Runs after factions and
  // cultures because its importance rule reads what those two have live, and
  // its `closing` pass reads the faction moves made earlier the same day.
  npcModule,
  // Expansion Phase 8 §8.4 — the rumour network. Runs at `rumourUpdate`,
  // which sits after the culture/faction/NPC passes and before
  // `forecastTraffic`, so talk that moved this morning is believed by the
  // time turnout is projected.
  rumourModule,
  // Expansion Phase 9 §9.1 — the rival tavern as an actor. Runs at
  // `localEventUpdate`, after the faction and rumour passes (so backing
  // given and talk moved this morning are on the books) and before
  // `forecastTraffic` (so a crowd courted today is felt in tonight's
  // turnout). Declares `dependsOn: ['factions']` because the head-to-head
  // reads faction rival-backing.
  rivalModule,
  supplierModule,
  regularModule,
  adventurersModule,
  expeditionsModule,
  ownerActionsModule,
  serviceModule,
  economyModule,
  weeklyModule,
  // Expansion Phase 9 §9.4 — world conditions decide what is actually
  // happening today BEFORE the monthly module projects it onto
  // `currentModifier`, so the rent bump and the arc gates read the world
  // as it is rather than as it was yesterday.
  conditionsModule,
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
  scheduledEventsModule,
  obligationsModule,
  // Expansion Phase 7 — the three external-obligation domains sit AFTER the
  // shared ledger they write into, because each declares a dependency on it
  // and the architecture check requires a dependency to run first. Their own
  // hooks are on `beforeOwnerActions` and `closing`, both far downstream of
  // any `startDay` ordering question, so nothing about the day beat depends
  // on this position — only the declared dependency does.
  financeModule,
  tenancyModule,
  regulatoryModule,
]
