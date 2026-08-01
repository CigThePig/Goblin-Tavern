import {
  MAX_CONTRACT_TRANSITIONS,
  isTerminalContractStatus,
  outstandingAmount,
  type ContractRecordBase,
  type ContractStatus,
  type ContractTransition,
  type ObligationRecord,
} from './types'

// Expansion Phase 1 §1.2 — the shared lifecycle transitions.
//
// Every function here is PURE: it takes a record and returns a new record.
// The domain that owns the record is responsible for writing it back and
// for the coin movement, because only that domain knows which ledger the
// money comes out of. Keeping the transitions pure is what lets six
// unrelated systems share one status machine without sharing a slice.
//
// The `reason` argument is mandatory on every transition. A contract that
// changed status for no recorded reason is exactly the failure mode
// `OBL-02` describes at the level of a whole obligation rather than a
// single field.

function recordTransition<T extends ContractRecordBase>(
  record: T,
  to: ContractStatus,
  onDay: number,
  reason: string,
  amount?: number,
): T {
  const transition: ContractTransition = {
    onDay,
    from: record.status,
    to,
    reason,
    ...(amount !== undefined ? { amount } : {}),
  }
  // §5.11 bounded growth: a record's history keeps its most recent
  // transitions. The opening transition is always kept — it is the one a
  // report needs to say "you agreed to this on day 4" — so trimming drops
  // from the middle, not from the front.
  const history = [...record.history, transition]
  const trimmed =
    history.length > MAX_CONTRACT_TRANSITIONS
      ? [
          history[0]!,
          ...history.slice(history.length - (MAX_CONTRACT_TRANSITIONS - 1)),
        ]
      : history

  return {
    ...record,
    status: to,
    lastTransitionOnDay: onDay,
    history: trimmed,
    ...(isTerminalContractStatus(to) ? { closedOnDay: onDay } : {}),
  }
}

export type OpenObligationInput = {
  id: string
  ownerModuleId: string
  counterparty: ObligationRecord['counterparty']
  direction: ObligationRecord['direction']
  principal: number
  openedOnDay: number
  dueOnDay: number
  /** From `getRule(state, 'obligationGraceDays')`. */
  graceDays: number
  /** From `getRule(state, 'obligationLateChargeRate')`. */
  lateChargeRate: number
  readable: string
  tags?: string[]
}

/**
 * Open a money obligation.
 *
 * `graceDays` and `lateChargeRate` are captured at open time rather than
 * read per-day. That is deliberate: the terms the player agreed to must not
 * change under them because the ruleset was re-read later, and a save that
 * predates a re-tuning keeps its own terms.
 */
export function openObligation(input: OpenObligationInput): ObligationRecord {
  const base: ObligationRecord = {
    id: input.id,
    family: 'obligation',
    ownerModuleId: input.ownerModuleId,
    counterparty: input.counterparty,
    status: 'active',
    openedOnDay: input.openedOnDay,
    dueOnDay: input.dueOnDay,
    graceDays: input.graceDays,
    lastTransitionOnDay: input.openedOnDay,
    history: [],
    escalation: 0,
    readable: input.readable,
    tags: input.tags ?? [],
    direction: input.direction,
    principal: input.principal,
    paid: 0,
    accruedCharges: 0,
    forgiven: 0,
    lateChargeRate: input.lateChargeRate,
  }
  return {
    ...base,
    history: [
      {
        onDay: input.openedOnDay,
        from: 'pending',
        to: 'active',
        reason: 'opened',
        amount: input.principal,
      },
    ],
  }
}

export type PaymentResult = {
  record: ObligationRecord
  /** How much of the offered payment was actually applied. */
  applied: number
  /** True when this payment discharged the obligation. */
  settled: boolean
}

/**
 * Apply a payment. Partial payment is the normal case: the obligation stays
 * live at a lower balance and does NOT reset its due day — paying half of
 * a late debt buys goodwill, not a new deadline.
 */
export function payObligation(
  record: ObligationRecord,
  amount: number,
  onDay: number,
  reason: string,
): PaymentResult {
  const outstanding = outstandingAmount(record)
  const applied = Math.max(0, Math.min(amount, outstanding))
  if (applied === 0) {
    return { record, applied: 0, settled: outstanding <= 0 }
  }
  const paid = { ...record, paid: record.paid + applied }
  const nowOutstanding = outstandingAmount(paid)
  if (nowOutstanding <= 0) {
    return {
      record: recordTransition(paid, 'settled', onDay, reason, applied),
      applied,
      settled: true,
    }
  }
  // Still owing. A partial payment on a defaulted or in-collections debt
  // pulls it back to `grace` — the counterparty is being paid, so the
  // escalation stops climbing — but the escalation rung already reached is
  // kept, because the relationship damage happened.
  const nextStatus: ContractStatus =
    record.status === 'defaulted' || record.status === 'in_collections'
      ? 'grace'
      : record.status
  const next =
    nextStatus === record.status
      ? { ...paid, lastTransitionOnDay: onDay }
      : recordTransition(paid, nextStatus, onDay, reason, applied)
  return { record: next, applied, settled: false }
}

/** Move a due-but-unpaid obligation into its grace window. */
export function enterGrace(
  record: ObligationRecord,
  onDay: number,
  reason: string,
): ObligationRecord {
  return recordTransition(record, 'grace', onDay, reason)
}

/**
 * Accrue one day of late charges. Charges are a fraction of PRINCIPAL, not
 * of the running balance, so they grow linearly rather than compounding —
 * a compounding debt in a game about a failing tavern is an unrecoverable
 * spiral, and `recoveryAssistanceMultiplier` exists precisely because the
 * design wants recovery to be possible.
 */
export function accrueLateCharge(
  record: ObligationRecord,
  onDay: number,
): ObligationRecord {
  // The tavern's till is whole-coin. Keep monetary obligations on that same
  // boundary so a later payment can never turn an integer till fractional.
  // Small debts may round to no charge; that is preferable to a compulsory
  // one-coin daily fee becoming an unrecoverable spiral.
  const charge = Math.round(record.principal * record.lateChargeRate)
  if (charge <= 0) return record
  return {
    ...record,
    accruedCharges: record.accruedCharges + charge,
    lastTransitionOnDay: onDay,
  }
}

/** Grace has run out. */
export function defaultObligation(
  record: ObligationRecord,
  onDay: number,
  reason: string,
): ObligationRecord {
  return recordTransition(
    { ...record, escalation: record.escalation + 1 },
    'defaulted',
    onDay,
    reason,
  )
}

/** The counterparty starts actively coming after the player. */
export function escalateToCollections(
  record: ObligationRecord,
  onDay: number,
  reason: string,
): ObligationRecord {
  return recordTransition(
    { ...record, escalation: record.escalation + 1 },
    'in_collections',
    onDay,
    reason,
  )
}

/** The counterparty writes the balance off. The player did not pay it. */
export function forgiveObligation(
  record: ObligationRecord,
  onDay: number,
  reason: string,
): ObligationRecord {
  const remaining = outstandingAmount(record)
  return recordTransition(
    { ...record, forgiven: record.forgiven + remaining },
    'forgiven',
    onDay,
    reason,
    remaining,
  )
}

/** Discharged some other way — renegotiated, traded away, absorbed. */
export function settleObligation(
  record: ObligationRecord,
  onDay: number,
  reason: string,
): ObligationRecord {
  return recordTransition(record, 'settled', onDay, reason)
}

export function cancelContract<T extends ContractRecordBase>(
  record: T,
  onDay: number,
  reason: string,
): T {
  return recordTransition(record, 'cancelled', onDay, reason)
}

export function expireContract<T extends ContractRecordBase>(
  record: T,
  onDay: number,
  reason: string,
): T {
  return recordTransition(record, 'expired', onDay, reason)
}

/**
 * Advance a generic contract's status with a recorded reason. Domains use
 * this for the family-specific statuses the money helpers above do not
 * cover (an employment record going to `settled` on separation, a
 * regulatory case escalating).
 */
export function transitionContract<T extends ContractRecordBase>(
  record: T,
  to: ContractStatus,
  onDay: number,
  reason: string,
  amount?: number,
): T {
  return recordTransition(record, to, onDay, reason, amount)
}

/** The day an obligation's grace window closes. */
export function graceEndsOnDay(record: ObligationRecord): number {
  return (record.dueOnDay ?? record.openedOnDay) + record.graceDays
}

export { outstandingAmount }
