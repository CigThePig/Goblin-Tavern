// Phase 10 — Customer module re-exports.
//
// `customerModule.ts` is the canonical implementation file (per
// `phases-06-10.md` §10 Agent Execution Checklist). `index.ts` keeps the
// barrel so callers can `import { customersModule } from
// '.../modules/customers'` without knowing the file split.

export {
  customersModule,
  customerRegistry,
  ensureRequiredCustomerGroupsRegistered,
  forecastTraffic,
  forecastTrafficForGroup,
  resolveGroupPurchases,
  applySatisfactionUpdate,
  applyCustomerImpact,
  CUSTOMERS_MODULE_ID,
  COMPLAINT_THRESHOLD,
  createInitialCustomerModuleState,
  getCustomerModuleState,
} from './customerModule'

export type {
  CustomerForecast,
  CustomerTurnout,
  CustomerModuleState,
} from './types'

export type {
  CustomerGroupDefinition,
  CustomerGroupDefaultState,
} from '../../registries/customerRegistry'

export type { GroupPurchaseResult } from './purchases'
