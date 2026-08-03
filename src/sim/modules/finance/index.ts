// Expansion Phase 7 §7.1 — the finance module's public surface.

export { financeModule, createInitialFinanceModuleState } from './financeModule'
export { FINANCE_ACTIONS } from './actions'
export {
  FINANCE_MODULE_ID,
  MAX_ARCHIVED_LOANS,
  MAX_LOAN_INSTALMENTS,
  MAX_OPEN_LOANS,
  MAX_RENEGOTIATIONS,
  isLoanOpen,
  isTerminalLoanStatus,
  loanOutstanding,
  nextInstalment,
  type LenderAccountState,
  type LoanInstalment,
  type LoanRecord,
  type LoanStatus,
  type FinanceModuleState,
} from './types'
export {
  findLoan,
  getFinanceModuleState,
  getLenderAccount,
  getLoan,
  listAllLoans,
  listLoans,
} from './state'
export {
  availableLenders,
  lenderRef,
  loanObligations,
  nextLoanPayment,
  openInstalmentOf,
  quoteLoan,
  renegotiateLoan,
  repayLoan,
  settleLoan,
  takeLoan,
  totalLoanDebt,
  type LoanQuote,
} from './loans'
export {
  LOAN_COLLECTIONS_EVENT,
  LOAN_INSTALMENT_REVIEW_EVENT,
} from './financeEvents'
export {
  INFORMAL_LENDER_ID,
  getLenderDefinition,
  listLenders,
  type LenderDefinition,
} from '../../content/finance/lenderRegistry'
