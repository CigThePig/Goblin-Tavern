import type { TavernState } from '../sim/state/TavernState'
import {
  graceEndsOnDay,
  listObligations,
  outstandingAmount,
  type ObligationRecord,
} from '../sim/contracts/obligations/index'
import { readScheduledEventsSlice } from '../sim/contracts/scheduledEvents/state'
import { canApplyAction } from '../sim/modules/ownerActions/readonlyHelpers'
import { actionRegistry } from '../sim/registries/actionRegistry'
import {
  listLoans,
  loanOutstanding,
  openInstalmentOf,
} from '../sim/modules/finance/index'
import {
  LANDLORD_LABEL,
  arrearsOutstanding,
  effectiveRent,
  getTenancyModuleState,
  liveNotice,
  rentOutstanding,
} from '../sim/modules/tenancy/index'
import {
  WATCH_LABEL,
  checkRequirement,
  evidenceWeight,
  getRegulatoryModuleState,
  listFindings,
  openCases,
} from '../sim/modules/regulatory/index'

// Expansion Phase 7 §7.4 — reports and calendars.
//
// §7.4 asks for one view carrying "scheduled obligation view; loan and rent
// ledger; inspection/case status; due dates; warning provenance; player
// options; exact settlement entries; history and causes." This is that view,
// and it is a PROJECTION in the strict sense: every number is read from the
// record that owns it, and nothing here recomputes a due date, a balance or
// an eligibility rule. A report that derives its own figures is a second
// source of truth waiting to disagree with the first.
//
// "Player options" is the part worth being careful about. The options come
// from the owner-action registry's own `canApply`, through the same
// read-only helper the rest of the UI uses — so an option this view offers
// is an action the registry will actually accept, and an option it greys out
// carries the registry's own reason for saying no. §5 fails a phase where "a
// player cannot discover what action is available and why".

export type ObligationKind = 'loan' | 'rent' | 'fine' | 'supplier' | 'other'

export type ObligationCalendarRow = {
  id: string
  kind: ObligationKind
  /** Who it is with, in words. */
  counterparty: string
  readable: string
  outstanding: number
  dueOnDay?: number
  /** Days from today. Negative when it is already late. */
  daysUntilDue?: number
  status: ObligationRecord['status']
  /** The day the grace window closes, when the record is inside one. */
  graceEndsOnDay?: number
  escalation: number
  /** Late charges accrued so far — an exact settlement entry, not an estimate. */
  accruedCharges: number
  paid: number
  /** Registered actions the player could take against this row, right now. */
  options: Array<{ actionId: string; label: string; disabledReason?: string }>
}

export type ScheduledObligationEvent = {
  id: string
  type: string
  ownerModuleId: string
  scheduledForDay: number
  daysUntil: number
  /** True once the player has been told it is coming. */
  warned: boolean
  /** Where the promise came from — §7.4's "warning provenance". */
  origin: string
  /** The player's own words, when the promise came from a card choice. */
  selectionLabel?: string
}

export type LoanLedgerRow = {
  id: string
  lender: string
  status: string
  principal: number
  fee: number
  totalRepayable: number
  repaid: number
  outstanding: number
  nextDueOnDay?: number
  nextAmount?: number
  missedInstalments: number
  renegotiations: number
  collectedByLender: number
  /** Oldest first. The record's own transition history. */
  history: Array<{ onDay: number; from: string; to: string; reason: string; amount?: number }>
}

export type RentLedgerView = {
  landlord: string
  status: string
  rentPerPeriod: number
  periodIndex: number
  periodEndsOnDay: number
  outstanding: number
  arrears: number
  missedPeriods: number
  totalPaid: number
  landlordOpinion: number
  landlordConcern: number
  concession?: string
  notice?: {
    kind: string
    readable: string
    deadlineDay: number
    cureAmount: number
    /** What can prevent or delay it — §7.2's requirement, read off the record. */
    remedies: string[]
  }
  accessRequest?: { reason: string; deadlineDay: number }
  /** What the landlord holds for and against the tavern. */
  beliefs: Array<{ readable: string; weight: number }>
  repairs: Array<{ readable: string; status: string }>
}

export type RegulatoryCaseView = {
  id: string
  status: string
  inspector: string
  announced: boolean
  nextVisitDay?: number
  daysUntilVisit?: number
  outcomes: Array<{ onDay: number; outcome: string; readable: string }>
  findings: Array<{
    id: string
    dimension: string
    status: string
    requirement: string
    /** Read off live state, so "done" means done rather than declared. */
    met: boolean
    dueOnDay?: number
  }>
  fines: Array<{ id: string; outstanding: number; dueOnDay?: number }>
  bribe?: { amount: number; accepted: boolean; exposed: boolean }
}

export type ObligationCalendarData = {
  today: number
  /** Everything owed, soonest first. */
  rows: ObligationCalendarRow[]
  totalOutstanding: number
  /** What is already late. */
  overdue: number
  /** Dated promises on the calendar, soonest first. */
  upcoming: ScheduledObligationEvent[]
  loans: LoanLedgerRow[]
  rent?: RentLedgerView
  watch: {
    label: string
    standing: number
    interest: number
    recordsReadiness: number
    cases: RegulatoryCaseView[]
  }
}

function kindOf(record: ObligationRecord): ObligationKind {
  if (record.tags.includes('loan')) return 'loan'
  if (record.tags.includes('rent')) return 'rent'
  if (record.tags.includes('fine')) return 'fine'
  if (record.tags.includes('invoice') || record.tags.includes('supplier')) {
    return 'supplier'
  }
  return 'other'
}

function counterpartyLabel(record: ObligationRecord, state: TavernState): string {
  const { kind, id } = record.counterparty
  if (id.startsWith('landlord:')) return LANDLORD_LABEL
  if (id.startsWith('watch:')) return WATCH_LABEL
  if (id.startsWith('lender:')) {
    const lenderId = id.slice('lender:'.length)
    const loan = listLoans(state).find((entry) => entry.lenderId === lenderId)
    return loan?.lenderLabel ?? lenderId
  }
  if (kind === 'supplier') return state.world.suppliers[id]?.label ?? id
  if (kind === 'regular') return state.world.regulars[id]?.name?.display ?? id
  return id
}

/**
 * Which registered actions bear on a row of this kind.
 *
 * Asked of the REGISTRY by tag rather than hardcoded, so an action a later
 * phase adds to one of these domains appears here without this file
 * changing. Eligibility comes from each definition's own `canApply`, so an
 * option offered is one the registry will accept and an option greyed out
 * carries the registry's own reason for saying no — §5's "a player cannot
 * discover what action is available and why" read from the report side.
 */
const OPTION_TAGS: Record<ObligationKind, string> = {
  loan: 'loan',
  rent: 'tenancy',
  fine: 'regulatory',
  supplier: 'supplier',
  other: 'obligation',
}

function optionsFor(
  state: TavernState,
  kind: ObligationKind,
  targetId: string,
): ObligationCalendarRow['options'] {
  const tag = OPTION_TAGS[kind]
  return actionRegistry
    .all()
    .filter((def) => def.tags.includes(tag) && def.tags.includes('coin'))
    .map((def) => {
      const verdict = canApplyAction(def, state, {
        actionId: def.id,
        targetId,
      })
      return {
        actionId: def.id,
        label: def.label,
        ...(verdict.ok ? {} : { disabledReason: verdict.reason }),
      }
    })
}

export function buildObligationCalendar(
  state: TavernState,
): ObligationCalendarData {
  const today = state.calendar.totalDaysElapsed

  const rows: ObligationCalendarRow[] = listObligations(state, {
    direction: 'payable',
  }).map((record) => {
    const kind = kindOf(record)
    // The row's own target id: a loan row is acted on through its loan, a
    // fine through its obligation, rent through the tenancy.
    const targetId =
      kind === 'loan'
        ? (listLoans(state).find((loan) =>
            loan.instalments.some(
              (instalment) => instalment.obligationId === record.id,
            ),
          )?.id ?? record.id)
        : record.id
    return {
      id: record.id,
      kind,
      counterparty: counterpartyLabel(record, state),
      readable: record.readable,
      outstanding: outstandingAmount(record),
      ...(record.dueOnDay !== undefined
        ? { dueOnDay: record.dueOnDay, daysUntilDue: record.dueOnDay - today }
        : {}),
      status: record.status,
      ...(record.status === 'grace'
        ? { graceEndsOnDay: graceEndsOnDay(record) }
        : {}),
      escalation: record.escalation,
      accruedCharges: record.accruedCharges,
      paid: record.paid,
      options: optionsFor(state, kind, targetId),
    }
  })

  const totalOutstanding = rows.reduce((sum, row) => sum + row.outstanding, 0)
  const overdue = rows.reduce(
    (sum, row) =>
      row.dueOnDay !== undefined && row.dueOnDay < today
        ? sum + row.outstanding
        : sum,
    0,
  )

  // Warning provenance: the queue records where each promise came from, and
  // whether the player has been told. Both travel to the view unchanged.
  const events = readScheduledEventsSlice(state)
  const upcoming: ScheduledObligationEvent[] = events.queue
    .filter(
      (record) => record.status === 'scheduled' || record.status === 'warned',
    )
    .sort(
      (a, b) =>
        a.scheduledForDay - b.scheduledForDay || a.id.localeCompare(b.id),
    )
    .map((record) => ({
      id: record.id,
      type: record.type,
      ownerModuleId: record.ownerModuleId,
      scheduledForDay: record.scheduledForDay,
      daysUntil: record.scheduledForDay - today,
      warned: record.status === 'warned',
      origin: record.origin.readable,
      ...(record.origin.selectionLabel
        ? { selectionLabel: record.origin.selectionLabel }
        : {}),
    }))

  const loans: LoanLedgerRow[] = listLoans(state).map((loan) => {
    const instalment = openInstalmentOf(loan)
    return {
      id: loan.id,
      lender: loan.lenderLabel,
      status: loan.loanStatus,
      principal: loan.principal,
      fee: loan.fee,
      totalRepayable: loan.totalRepayable,
      repaid: loan.repaid,
      outstanding: loanOutstanding(loan),
      ...(instalment
        ? { nextDueOnDay: instalment.dueOnDay, nextAmount: instalment.amount }
        : {}),
      missedInstalments: loan.missedInstalments,
      renegotiations: loan.renegotiations,
      collectedByLender: loan.collectedByLender,
      history: loan.history.map((entry) => ({
        onDay: entry.onDay,
        from: entry.from,
        to: entry.to,
        reason: entry.reason,
        ...(entry.amount !== undefined ? { amount: entry.amount } : {}),
      })),
    }
  })

  const tenancySlice = getTenancyModuleState(state)
  const tenancy = tenancySlice.tenancy
  const notice = liveNotice(tenancySlice)
  const rent: RentLedgerView | undefined = tenancy
    ? {
        landlord: LANDLORD_LABEL,
        status: tenancy.tenancyStatus,
        rentPerPeriod: effectiveRent(tenancy),
        periodIndex: tenancy.periodIndex,
        periodEndsOnDay: tenancy.periodEndsOnDay,
        outstanding: rentOutstanding(state),
        arrears: arrearsOutstanding(state),
        missedPeriods: tenancy.missedPeriods,
        totalPaid: tenancy.totalPaid,
        landlordOpinion: tenancySlice.landlord.opinion,
        landlordConcern: tenancySlice.landlord.concern,
        ...(tenancy.concession
          ? { concession: tenancy.concession.readable }
          : {}),
        ...(notice
          ? {
              notice: {
                kind: notice.kind,
                readable: notice.readable,
                deadlineDay: notice.deadlineDay,
                cureAmount: notice.cureAmount,
                remedies: notice.remedies,
              },
            }
          : {}),
        ...(tenancySlice.landlord.accessRequest
          ? {
              accessRequest: {
                reason: tenancySlice.landlord.accessRequest.reason,
                deadlineDay: tenancySlice.landlord.accessRequest.deadlineDay,
              },
            }
          : {}),
        beliefs: tenancySlice.landlord.beliefs.map((belief) => ({
          readable: belief.readable,
          weight: belief.weight,
        })),
        repairs: tenancySlice.repairs
          .filter(
            (repair) =>
              repair.status === 'requested' || repair.status === 'scheduled',
          )
          .map((repair) => ({ readable: repair.readable, status: repair.status })),
      }
    : undefined

  const regulatory = getRegulatoryModuleState(state)
  const cases: RegulatoryCaseView[] = openCases(regulatory).map((record) => ({
    id: record.id,
    status: record.caseStatus,
    inspector: record.inspectorName,
    announced: record.announced,
    ...(record.nextVisitDay !== undefined
      ? {
          nextVisitDay: record.nextVisitDay,
          daysUntilVisit: record.nextVisitDay - today,
        }
      : {}),
    outcomes: record.outcomes,
    findings: listFindings(state, { caseId: record.id }).map((finding) => ({
      id: finding.id,
      dimension: finding.dimension,
      status: finding.status,
      requirement: finding.requirement,
      met: checkRequirement(state, finding),
      ...(finding.dueOnDay !== undefined ? { dueOnDay: finding.dueOnDay } : {}),
    })),
    fines: record.fineObligationIds
      .map((id) => rows.find((row) => row.id === id))
      .filter((row): row is ObligationCalendarRow => row !== undefined)
      .map((row) => ({
        id: row.id,
        outstanding: row.outstanding,
        ...(row.dueOnDay !== undefined ? { dueOnDay: row.dueOnDay } : {}),
      })),
    ...(record.bribe
      ? {
          bribe: {
            amount: record.bribe.amount,
            accepted: record.bribe.accepted,
            exposed: record.bribe.exposed,
          },
        }
      : {}),
  }))

  return {
    today,
    rows,
    totalOutstanding,
    overdue,
    upcoming,
    loans,
    ...(rent ? { rent } : {}),
    watch: {
      label: WATCH_LABEL,
      standing: regulatory.watch.standing,
      interest: Math.round(evidenceWeight(regulatory, today)),
      recordsReadiness: regulatory.records.readiness,
      cases,
    },
  }
}
