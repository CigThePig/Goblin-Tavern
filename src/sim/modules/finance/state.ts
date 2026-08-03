import type { SimContext } from '../../core/context'
import type { TavernState } from '../../state/TavernState'
import { listLenders } from '../../content/finance/lenderRegistry'
import { inSchemaOrder } from '../../state/schemaOrder'

import {
  FINANCE_MODULE_ID,
  FinanceModuleStateSchema,
  MAX_ARCHIVED_LOANS,
  isTerminalLoanStatus,
  type FinanceModuleState,
  type FinanceTotals,
  type LenderAccountState,
  type LoanRecord,
} from './types'

// Expansion Phase 7 §7.1 — the finance slice.
//
// Same read-through shape as every other module slice: merged field by
// field so a save loaded before its named migration runs still reads
// complete defaults rather than `undefined`.

export { FINANCE_MODULE_ID }

export function emptyFinanceTotals(): FinanceTotals {
  return {
    loansTaken: 0,
    principalBorrowed: 0,
    feesCharged: 0,
    repaid: 0,
    loansSettled: 0,
    loansDefaulted: 0,
    collectionsSeized: 0,
    renegotiations: 0,
  }
}

export function createInitialFinanceModuleState(): FinanceModuleState {
  return {
    loans: {},
    loanArchive: [],
    lenders: {},
    nextLoanSuffix: 0,
    totals: emptyFinanceTotals(),
  }
}

export function getFinanceModuleState(state: TavernState): FinanceModuleState {
  const slice = state.modules[FINANCE_MODULE_ID] as
    | Partial<FinanceModuleState>
    | undefined
  const defaults = createInitialFinanceModuleState()
  if (!slice) return defaults
  return {
    ...defaults,
    ...slice,
    totals: { ...defaults.totals, ...(slice.totals ?? {}) },
  }
}

export function writeFinanceState(
  ctx: SimContext,
  patch: (current: FinanceModuleState) => FinanceModuleState,
  reason: string,
): void {
  ctx.modifyModuleState<FinanceModuleState>(
    FINANCE_MODULE_ID,
    (current) => {
      const defaults = createInitialFinanceModuleState()
      const base: FinanceModuleState = current
        ? {
            ...defaults,
            ...current,
            totals: { ...defaults.totals, ...(current.totals ?? {}) },
          }
        : defaults
      // §5.10 — normalise through the schema so an in-memory slice takes
      // exactly the key order a reloaded one takes. See `schemaOrder.ts`.
      return inSchemaOrder(FinanceModuleStateSchema, patch(base))
    },
    { source: `${FINANCE_MODULE_ID}.${reason}`, reason },
  )
}

// ---------- Lender accounts ----------

/**
 * A lender the tavern has never dealt with.
 *
 * Standing opens at 50 — neutral, not trusting. That is what makes the
 * Coin Hall's `standingRequired: 45` a bar the tavern clears on day one
 * and loses by missing payments, rather than a wall it can never climb.
 */
export function createLenderAccount(
  lenderId: string,
  onDay: number,
): LenderAccountState {
  return {
    lenderId,
    standing: 50,
    loansTaken: 0,
    loansSettled: 0,
    loansDefaulted: 0,
    lastDecisionDay: onDay,
    lastDecisionReason: 'no dealings yet',
  }
}

export function getLenderAccount(
  state: TavernState,
  lenderId: string,
): LenderAccountState | undefined {
  return getFinanceModuleState(state).lenders[lenderId]
}

export function writeLenderAccount(
  ctx: SimContext,
  account: LenderAccountState,
  reason: string,
): void {
  writeFinanceState(
    ctx,
    (current) => ({
      ...current,
      lenders: { ...current.lenders, [account.lenderId]: account },
    }),
    reason,
  )
}

/**
 * Seed an account for every registered lender and drop accounts whose
 * lender is gone (§5.11). A lender the player can borrow from must have
 * somewhere for their record of the tavern to live.
 */
export function ensureLenderAccounts(ctx: SimContext): void {
  const today = ctx.state.calendar.totalDaysElapsed
  const slice = getFinanceModuleState(ctx.state)
  const known = new Set(listLenders().map((lender) => lender.id))
  const missing = [...known].filter((id) => !(id in slice.lenders))
  const stale = Object.keys(slice.lenders).filter((id) => !known.has(id))
  if (missing.length === 0 && stale.length === 0) return
  writeFinanceState(
    ctx,
    (current) => {
      const lenders: Record<string, LenderAccountState> = {}
      for (const [id, account] of Object.entries(current.lenders)) {
        if (known.has(id)) lenders[id] = account
      }
      for (const id of missing) lenders[id] = createLenderAccount(id, today)
      return { ...current, lenders }
    },
    'lender_accounts',
  )
}

// ---------- Loans ----------

export function getLoan(state: TavernState, id: string): LoanRecord | undefined {
  return getFinanceModuleState(state).loans[id]
}

/** Live loans, soonest instalment first, id as the deterministic tie-break. */
export function listLoans(
  state: TavernState,
  filter?: { lenderId?: string },
): LoanRecord[] {
  return Object.values(getFinanceModuleState(state).loans)
    .filter((loan) => !filter?.lenderId || loan.lenderId === filter.lenderId)
    .sort((a, b) => {
      const byDue = (a.dueOnDay ?? Infinity) - (b.dueOnDay ?? Infinity)
      return byDue !== 0 ? byDue : a.id.localeCompare(b.id)
    })
}

export function listAllLoans(state: TavernState): LoanRecord[] {
  const slice = getFinanceModuleState(state)
  return [...Object.values(slice.loans), ...slice.loanArchive]
}

export function findLoan(state: TavernState, id: string): LoanRecord | undefined {
  const slice = getFinanceModuleState(state)
  return slice.loans[id] ?? slice.loanArchive.find((loan) => loan.id === id)
}

export function nextLoanId(state: TavernState): string {
  return `loan-${getFinanceModuleState(state).nextLoanSuffix}`
}

/**
 * Put a loan into (or back into) the slice.
 *
 * A terminal loan moves to the bounded archive rather than being deleted,
 * so "what happened to that debt?" always has an answer — the §5 rule about
 * not silently losing material obligations, applied within one run.
 */
export function upsertLoan(
  ctx: SimContext,
  loan: LoanRecord,
  reason: string,
): void {
  const terminal = isTerminalLoanStatus(loan.loanStatus)
  writeFinanceState(
    ctx,
    (current) => {
      const loans = { ...current.loans }
      const isNew = !(loan.id in loans)
      if (terminal) delete loans[loan.id]
      else loans[loan.id] = loan
      const archive = terminal
        ? capArchive([
            ...current.loanArchive.filter((entry) => entry.id !== loan.id),
            loan,
          ])
        : current.loanArchive
      return {
        ...current,
        loans,
        loanArchive: archive,
        nextLoanSuffix: isNew ? current.nextLoanSuffix + 1 : current.nextLoanSuffix,
      }
    },
    reason,
  )
}

export function bumpFinanceTotals(
  ctx: SimContext,
  changes: Partial<FinanceTotals>,
  reason: string,
): void {
  writeFinanceState(
    ctx,
    (current) => {
      const totals = { ...current.totals }
      for (const [key, delta] of Object.entries(changes)) {
        if (typeof delta !== 'number') continue
        totals[key as keyof FinanceTotals] += delta
      }
      return { ...current, totals }
    },
    reason,
  )
}

function capArchive(archive: LoanRecord[]): LoanRecord[] {
  if (archive.length <= MAX_ARCHIVED_LOANS) return archive
  return archive.slice(archive.length - MAX_ARCHIVED_LOANS)
}
