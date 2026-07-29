import { z } from 'zod'

import type { SimContext } from '../../core/context'
import type { TavernState } from '../../state/TavernState'

import {
  ObligationRecordSchema,
  isTerminalContractStatus,
  outstandingAmount,
  type ObligationRecord,
} from './types'

// Expansion Phase 1 §1.2 — the shared obligation ledger.
//
// WHAT THIS MODULE OWNS, AND WHAT IT DOES NOT. The plan is explicit that
// invoices belong to suppliers, employment to staff, inspections to the
// regulatory system, and tenancy/loans to landlord/finance. This module
// therefore does NOT own the decision to open, pay, or forgive anything —
// each record names its `ownerModuleId`, and that domain makes those calls
// through the pure helpers in `lifecycle.ts`.
//
// What it owns is TIMEKEEPING: the uniform "due → grace → default →
// collections" progression, which belongs to no single domain and must not
// be reimplemented six times with six sets of off-by-one bugs. That is why
// the records live in one place while the decisions stay distributed.

export const OBLIGATIONS_MODULE_ID = 'obligations'

/** §5.11 bounded growth. */
export const MAX_OPEN_OBLIGATIONS = 120
export const MAX_CLOSED_OBLIGATIONS = 80

export type ObligationsModuleState = {
  /** Live records, keyed by id. */
  records: Record<string, ObligationRecord>
  /** Closed records, most recent last. Bounded archive. */
  closed: ObligationRecord[]
  nextSuffix: number
  totals: {
    opened: number
    settled: number
    defaulted: number
    forgiven: number
    /** Lifetime coin actually paid out against payables. */
    paidOut: number
    /** Lifetime late charges accrued. */
    chargesAccrued: number
  }
}

export const ObligationsModuleStateSchema = z.object({
  records: z.record(z.string(), ObligationRecordSchema),
  closed: z.array(ObligationRecordSchema),
  nextSuffix: z.number().int().min(0),
  totals: z.object({
    opened: z.number().int().min(0),
    settled: z.number().int().min(0),
    defaulted: z.number().int().min(0),
    forgiven: z.number().int().min(0),
    paidOut: z.number().min(0),
    chargesAccrued: z.number().min(0),
  }),
})

export function createInitialObligationsModuleState(): ObligationsModuleState {
  return {
    records: {},
    closed: [],
    nextSuffix: 0,
    totals: {
      opened: 0,
      settled: 0,
      defaulted: 0,
      forgiven: 0,
      paidOut: 0,
      chargesAccrued: 0,
    },
  }
}

export function readObligationsSlice(
  state: TavernState,
): ObligationsModuleState {
  const raw = (state.modules as Record<string, unknown> | undefined)?.[
    OBLIGATIONS_MODULE_ID
  ] as Partial<ObligationsModuleState> | undefined
  const defaults = createInitialObligationsModuleState()
  if (!raw) return defaults
  return {
    ...defaults,
    ...raw,
    totals: { ...defaults.totals, ...(raw.totals ?? {}) },
  }
}

export function writeObligationsSlice(
  ctx: SimContext,
  patch: (current: ObligationsModuleState) => ObligationsModuleState,
  reason: string,
): void {
  ctx.modifyModuleState<ObligationsModuleState>(
    OBLIGATIONS_MODULE_ID,
    (current) => {
      const defaults = createInitialObligationsModuleState()
      const base = current
        ? {
            ...defaults,
            ...current,
            totals: { ...defaults.totals, ...(current.totals ?? {}) },
          }
        : defaults
      return patch(base)
    },
    { source: `${OBLIGATIONS_MODULE_ID}.${reason}`, reason },
  )
}

export function getObligation(
  state: TavernState,
  id: string,
): ObligationRecord | undefined {
  return readObligationsSlice(state).records[id]
}

export function listObligations(
  state: TavernState,
  filter?: {
    direction?: ObligationRecord['direction']
    ownerModuleId?: string
    status?: ObligationRecord['status']
  },
): ObligationRecord[] {
  return Object.values(readObligationsSlice(state).records)
    .filter((record) => {
      if (filter?.direction && record.direction !== filter.direction) return false
      if (filter?.ownerModuleId && record.ownerModuleId !== filter.ownerModuleId) {
        return false
      }
      if (filter?.status && record.status !== filter.status) return false
      return true
    })
    // Stable order: soonest due first, id as the tie-break. Deterministic
    // ordering matters because a report and a resolver must walk the same
    // list in the same order across a reload.
    .sort((a, b) => {
      const byDue = (a.dueOnDay ?? Infinity) - (b.dueOnDay ?? Infinity)
      return byDue !== 0 ? byDue : a.id.localeCompare(b.id)
    })
}

/** Total the player currently owes. */
export function totalOutstanding(
  state: TavernState,
  direction: ObligationRecord['direction'] = 'payable',
): number {
  return listObligations(state, { direction }).reduce(
    (sum, record) => sum + outstandingAmount(record),
    0,
  )
}

/** Mint a deterministic obligation id owned by the requesting domain. */
export function nextObligationId(
  state: TavernState,
  ownerModuleId: string,
): string {
  const slice = readObligationsSlice(state)
  return `obl-${ownerModuleId}-${slice.nextSuffix}`
}

/**
 * Put a record into (or back into) the ledger.
 *
 * A record that has reached a terminal status is moved to the bounded
 * `closed` archive instead of being deleted, so "what happened to that
 * debt?" always has an answer — the §5 "old saves must not silently lose
 * material obligations" rule applied within a single run.
 */
export function upsertObligation(
  ctx: SimContext,
  record: ObligationRecord,
  reason: string,
): void {
  const terminal = isTerminalContractStatus(record.status)
  writeObligationsSlice(
    ctx,
    (current) => {
      const records = { ...current.records }
      const isNew = !(record.id in records)
      if (terminal) delete records[record.id]
      else records[record.id] = record

      const closed = terminal
        ? capClosed([...current.closed, record])
        : current.closed

      return {
        ...current,
        records,
        closed,
        nextSuffix: isNew ? current.nextSuffix + 1 : current.nextSuffix,
        totals: {
          ...current.totals,
          opened: isNew ? current.totals.opened + 1 : current.totals.opened,
          settled:
            record.status === 'settled'
              ? current.totals.settled + 1
              : current.totals.settled,
          defaulted:
            record.status === 'defaulted'
              ? current.totals.defaulted + 1
              : current.totals.defaulted,
          forgiven:
            record.status === 'forgiven'
              ? current.totals.forgiven + 1
              : current.totals.forgiven,
        },
      }
    },
    reason,
  )
}

export function recordObligationPayment(
  ctx: SimContext,
  amount: number,
  reason: string,
): void {
  if (amount <= 0) return
  writeObligationsSlice(
    ctx,
    (current) => ({
      ...current,
      totals: { ...current.totals, paidOut: current.totals.paidOut + amount },
    }),
    reason,
  )
}

export function recordObligationCharges(
  ctx: SimContext,
  amount: number,
  reason: string,
): void {
  if (amount <= 0) return
  writeObligationsSlice(
    ctx,
    (current) => ({
      ...current,
      totals: {
        ...current.totals,
        chargesAccrued: current.totals.chargesAccrued + amount,
      },
    }),
    reason,
  )
}

function capClosed(closed: ObligationRecord[]): ObligationRecord[] {
  if (closed.length <= MAX_CLOSED_OBLIGATIONS) return closed
  return closed.slice(closed.length - MAX_CLOSED_OBLIGATIONS)
}
