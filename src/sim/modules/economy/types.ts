// Expansion Phase 5 — the survival-economy state owned by `economy`.

export type FinancialStatus =
  | 'stable'
  | 'cash_stress'
  | 'insolvent'
  | 'restructuring'
  | 'temporarily_closed'
  | 'recovering'

export type EconomyModifiers = {
  /** Persistent multiplier applied to tomorrow's group traffic. */
  demandFactor: number
  /** Persistent multiplier applied to servings wanted per patron. */
  spendFactor: number
  /** Below one makes patrons less tolerant of a high menu price. */
  priceToleranceFactor: number
  /** Published for Phase 6 procurement decisions. Above one is worse. */
  supplierTermsFactor: number
  /** Published for the existing labour market. Above one raises wage asks. */
  wageDemandFactor: number
  /** Published for monthly landlord decisions. Above one is worse. */
  landlordRiskFactor: number
  /** Multiplier paid by repair actions after sustained neglect. */
  repairCostFactor: number
  /** Days of remembered distrust still resisting recovery. */
  recoveryLagDays: number
}

export type FinancialState = {
  status: FinancialStatus
  statusSinceDay: number
  cashStressDays: number
  insolvencyDays: number
  healthyDays: number
  operatingArrears: number
  restructuringBalance: number
  lastTransitionReason: string
}

export type OperatingCostKind =
  | 'overhead'
  | 'maintenance'
  | 'upgrade_upkeep'
  | 'emergency_premium'
  | 'financing_charge'
  | 'restructuring_payment'
  | 'arrears_payment'
  | 'policy_enforcement'

export type OperatingCostLine = {
  kind: OperatingCostKind
  due: number
  paid: number
  shortfall: number
  readable: string
  tags: string[]
}

export type OperatingCostSettlement = {
  due: number
  paid: number
  shortfall: number
  lines: OperatingCostLine[]
}

/**
 * A complete accounting vocabulary. Cash buckets are positive magnitudes;
 * `cashNet` retains its sign. Receivables/payables, write-offs, inventory
 * deterioration and expedition return value are accrual facts and therefore
 * never pretend coin moved.
 */
export type EconomyAccountingTotals = {
  sales: number
  stockPurchases: number
  wages: number
  rent: number
  maintenance: number
  construction: number
  upgradeUpkeep: number
  overhead: number
  financingCharges: number
  fines: number
  tabCollections: number
  tabCredit: number
  creditPurchases: number
  invoicePayments: number
  loanProceeds: number
  loanPayments: number
  writeOffs: number
  inventoryWriteOffs: number
  expeditionCosts: number
  expeditionReturns: number
  otherIncome: number
  otherCosts: number
  payableOutstanding: number
  receivableOutstanding: number
  cashNet: number
}

export type DailyEconomyRecord = {
  day: number
  openingCoin: number
  closingCoin: number
  serviceHealth: number
  demandFactor: number
  spendFactor: number
  statusBefore: FinancialStatus
  statusAfter: FinancialStatus
  costs: OperatingCostSettlement
  accounting: EconomyAccountingTotals
  /** Number of entries included when this record was reconciled. */
  ledgerEntries: number
  reconciled: boolean
  notes: string[]
}

export type PolicyRuntimeStatus =
  | 'inactive'
  | 'compliant'
  | 'partial'
  | 'violated'
  | 'suspended'

export type PolicyEvidence = {
  day: number
  status: PolicyRuntimeStatus
  readable: string
  tags: string[]
}

export type PolicyComplianceState = {
  policyId: string
  intendedEnabled: boolean
  status: PolicyRuntimeStatus
  compliance: number
  enforcerIds: string[]
  enforcementMinutes: number
  operatingCost: number
  support: number
  backlash: number
  fulfilledCount: number
  violationCount: number
  reversalCount: number
  lastEvaluatedDay: number
  evidence: PolicyEvidence[]
}

export type EconomyModuleState = {
  /** Till snapshot persisted in Segment A; never held in a closure. */
  openingCoin: number
  openingFinancialStatus: FinancialStatus
  /** Per-stock spoilage percentage captured beside `openingCoin`. */
  openingSpoilageByStock: Record<string, number>
  /** Segment-B cost result carried into Segment C and across a reload. */
  todayCosts: OperatingCostSettlement
  serviceHealth: number
  collapseStreak: number
  recoveryStreak: number
  modifiers: EconomyModifiers
  financial: FinancialState
  policies: Record<string, PolicyComplianceState>
  reserveStreak: number
  /** Non-cash operating debt forgiven by today's restructuring action. */
  operatingWriteOffsToday: number
  lastDailyRecord?: DailyEconomyRecord
  /** Oldest first; bounded by `MAX_ECONOMY_DAILY_HISTORY`. */
  dailyHistory: DailyEconomyRecord[]
}
