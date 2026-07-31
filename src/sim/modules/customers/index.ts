// Phase 10 — Customer module re-exports.
//
// `customerModule.ts` is the canonical implementation file (per
// `phases-06-10.md` §10 Agent Execution Checklist). `index.ts` keeps the
// barrel so callers can `import { customersModule } from
// '.../modules/customers'` without knowing the file split.
//
// Expansion Phase 4 §4.1 — `resolveGroupPurchases` and `applyCustomerImpact`
// are gone from this barrel because the code behind them is gone. A fixed
// per-group basket and a main-room-only mess pass were the two halves of
// "service is one arithmetic step"; the service module's flow owns both jobs
// now, per party and per room. What the customers module still owns — the
// forecast, tonight's demand, and how each group feels afterwards — is below.

export {
  customersModule,
  customerRegistry,
  ensureRequiredCustomerGroupsRegistered,
  forecastTraffic,
  forecastTrafficForGroup,
  applySatisfactionUpdate,
  CUSTOMERS_MODULE_ID,
  COMPLAINT_THRESHOLD,
  createInitialCustomerModuleState,
  getCustomerModuleState,
} from './customerModule'

export type {
  CustomerDemand,
  CustomerForecast,
  CustomerTurnout,
  CustomerModuleState,
} from './types'

export type {
  CustomerGroupDefinition,
  CustomerGroupDefaultState,
} from '../../registries/customerRegistry'
