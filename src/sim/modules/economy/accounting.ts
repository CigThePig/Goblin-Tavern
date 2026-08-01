import { z } from 'zod'

import type { TavernState } from '../../state/TavernState'
import {
  listObligations,
  outstandingAmount,
  readObligationsSlice,
  type ObligationRecord,
} from '../../contracts/obligations/index'
import { getStockModuleState } from '../stock/state'
import type { CoinLedgerEntry } from '../stock/types'

import { emptyEconomyAccounting, getEconomyModuleState } from './state'
import type { EconomyAccountingTotals } from './types'

export const EconomyAccountingTotalsSchema = z.object({
  sales: z.number().min(0),
  stockPurchases: z.number().min(0),
  wages: z.number().min(0),
  rent: z.number().min(0),
  maintenance: z.number().min(0),
  construction: z.number().min(0),
  upgradeUpkeep: z.number().min(0),
  overhead: z.number().min(0),
  financingCharges: z.number().min(0),
  fines: z.number().min(0),
  tabCollections: z.number().min(0),
  tabCredit: z.number().min(0),
  creditPurchases: z.number().min(0),
  invoicePayments: z.number().min(0),
  loanProceeds: z.number().min(0),
  loanPayments: z.number().min(0),
  writeOffs: z.number().min(0),
  inventoryWriteOffs: z.number().min(0),
  expeditionCosts: z.number().min(0),
  expeditionReturns: z.number().min(0),
  otherIncome: z.number().min(0),
  otherCosts: z.number().min(0),
  payableOutstanding: z.number().min(0),
  receivableOutstanding: z.number().min(0),
  cashNet: z.number(),
})

function hasAnyTag(entry: CoinLedgerEntry, tags: ReadonlyArray<string>): boolean {
  return tags.some((tag) => entry.tags.includes(tag))
}

/** Fold one cash movement into one and only one cash bucket. */
export function applyLedgerEntryToAccounting(
  totals: EconomyAccountingTotals,
  entry: CoinLedgerEntry,
): EconomyAccountingTotals {
  const next = { ...totals, cashNet: totals.cashNet + entry.amount }
  const magnitude = Math.abs(entry.amount)

  if (entry.category === 'sales') {
    next.sales += Math.max(0, entry.amount)
    return next
  }
  if (entry.category === 'wage') {
    next.wages += magnitude
    return next
  }
  if (entry.category === 'rent') {
    next.rent += magnitude
    return next
  }
  if (entry.category === 'purchase') {
    if (hasAnyTag(entry, ['invoice_payment', 'supplier_invoice'])) {
      next.invoicePayments += magnitude
    } else {
      next.stockPurchases += magnitude
    }
    return next
  }
  if (entry.category === 'repair') {
    if (hasAnyTag(entry, ['construction', 'build'])) {
      next.construction += magnitude
    } else if (hasAnyTag(entry, ['upkeep', 'upgrade_upkeep'])) {
      next.upgradeUpkeep += magnitude
    } else {
      next.maintenance += magnitude
    }
    return next
  }
  if (entry.category === 'waste') {
    next.writeOffs += magnitude
    return next
  }

  if (entry.amount > 0) {
    if (hasAnyTag(entry, ['patron_tab', 'tab_collection', 'collected'])) {
      next.tabCollections += entry.amount
    } else if (hasAnyTag(entry, ['loan', 'loan_proceeds'])) {
      next.loanProceeds += entry.amount
    } else if (hasAnyTag(entry, ['expedition', 'expedition_return', 'reward'])) {
      next.expeditionReturns += entry.amount
    } else {
      next.otherIncome += entry.amount
    }
    return next
  }

  if (hasAnyTag(entry, ['operating_overhead', 'overhead'])) {
    next.overhead += magnitude
  } else if (hasAnyTag(entry, ['loan_payment', 'restructuring_payment'])) {
    next.loanPayments += magnitude
  } else if (hasAnyTag(entry, ['financing_charge'])) {
    next.financingCharges += magnitude
  } else if (hasAnyTag(entry, ['fine', 'penalty'])) {
    next.fines += magnitude
  } else if (hasAnyTag(entry, ['expedition', 'commission'])) {
    next.expeditionCosts += magnitude
  } else if (hasAnyTag(entry, ['policy_enforcement'])) {
    next.overhead += magnitude
  } else if (hasAnyTag(entry, ['maintenance', 'emergency_premium'])) {
    next.maintenance += magnitude
  } else {
    next.otherCosts += magnitude
  }
  return next
}

export function accountingFromEntries(
  entries: ReadonlyArray<CoinLedgerEntry>,
  starting: EconomyAccountingTotals = emptyEconomyAccounting(),
): EconomyAccountingTotals {
  let totals = { ...starting }
  for (const entry of entries) totals = applyLedgerEntryToAccounting(totals, entry)
  return totals
}

function allObligations(state: TavernState): ObligationRecord[] {
  const slice = readObligationsSlice(state)
  return [...Object.values(slice.records), ...slice.closed]
}

function obligationTagged(record: ObligationRecord, tags: ReadonlyArray<string>): boolean {
  return tags.some((tag) => record.tags.includes(tag))
}

function accrualFacts(
  state: TavernState,
  today: number,
): Pick<
  EconomyAccountingTotals,
  | 'tabCredit'
  | 'creditPurchases'
  | 'writeOffs'
  | 'payableOutstanding'
  | 'receivableOutstanding'
> {
  let tabCredit = 0
  let creditPurchases = 0
  let writeOffs = 0
  for (const record of allObligations(state)) {
    if (
      record.openedOnDay === today &&
      record.direction === 'receivable' &&
      obligationTagged(record, ['patron_tab', 'tab'])
    ) {
      tabCredit += record.principal
    }
    if (
      record.openedOnDay === today &&
      record.direction === 'payable' &&
      obligationTagged(record, ['supplier', 'invoice', 'credit_purchase'])
    ) {
      creditPurchases += record.principal
    }
    if (
      record.lastTransitionOnDay === today &&
      (record.status === 'forgiven' || record.status === 'expired')
    ) {
      writeOffs += Math.max(
        0,
        record.principal + record.accruedCharges - record.paid,
      )
    }
  }
  const payableOutstanding = listObligations(state, { direction: 'payable' })
    .reduce((sum, record) => sum + outstandingAmount(record), 0)
  const receivableOutstanding = listObligations(state, { direction: 'receivable' })
    .reduce((sum, record) => sum + outstandingAmount(record), 0)
  const rentArrears = (
    state.modules['monthly'] as { rent?: { arrears?: number } } | undefined
  )?.rent?.arrears ?? 0
  const financial = getEconomyModuleState(state).financial
  return {
    tabCredit,
    creditPurchases,
    writeOffs,
    payableOutstanding:
      payableOutstanding +
      rentArrears +
      financial.operatingArrears +
      financial.restructuringBalance,
    receivableOutstanding,
  }
}

function inventoryWriteOff(
  state: TavernState,
  openingSpoilageByStock: Readonly<Record<string, number>>,
): number {
  let total = 0
  for (const item of Object.values(state.stock)) {
    if (item.quantity <= 0 || !item.tags.includes('perishable')) continue
    const before = openingSpoilageByStock[item.id] ?? item.spoilage
    const deterioration = Math.max(0, item.spoilage - before)
    total += item.quantity * item.basePrice * (deterioration / 100)
  }
  return Math.round(total * 100) / 100
}

function expeditionReturnValue(state: TavernState, today: number): number {
  const value = state.expeditions.completed
    .filter((record) => record.resolvedDay === today)
    .flatMap((record) => record.returnedIngredients)
    .reduce((sum, returned) => {
      const unitValue = state.stock[returned.ingredientId]?.basePrice ?? 0
      return sum + returned.quantity * unitValue
    }, 0)
  return Math.round(value * 100) / 100
}

export function reconcileDailyAccounting(
  state: TavernState,
  openingSpoilageByStock: Readonly<Record<string, number>>,
): EconomyAccountingTotals {
  const today = state.calendar.totalDaysElapsed + 1
  const cash = accountingFromEntries(getStockModuleState(state).ledger)
  const accrual = accrualFacts(state, today)
  const economy = getEconomyModuleState(state)
  return {
    ...cash,
    tabCredit: accrual.tabCredit,
    creditPurchases: accrual.creditPurchases,
    writeOffs:
      cash.writeOffs +
      accrual.writeOffs +
      economy.operatingWriteOffsToday,
    inventoryWriteOffs: inventoryWriteOff(state, openingSpoilageByStock),
    expeditionReturns:
      cash.expeditionReturns + expeditionReturnValue(state, today),
    payableOutstanding: accrual.payableOutstanding,
    receivableOutstanding: accrual.receivableOutstanding,
  }
}

export function addAccountingTotals(
  a: EconomyAccountingTotals,
  b: EconomyAccountingTotals,
): EconomyAccountingTotals {
  const next = emptyEconomyAccounting()
  for (const key of Object.keys(next) as Array<keyof EconomyAccountingTotals>) {
    next[key] = a[key] + b[key]
  }
  // Outstanding balances are snapshots, not flows. The newest snapshot wins.
  next.payableOutstanding = b.payableOutstanding
  next.receivableOutstanding = b.receivableOutstanding
  return next
}
