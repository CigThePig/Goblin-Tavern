import type { TavernState } from '../sim/state/TavernState'
import {
  graceEndsOnDay,
  isOverdue,
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
  /**
   * Whether this debt is late, decided by the obligation lifecycle's own
   * `isOverdue` rather than by any view re-reading the calendar. Carried on
   * the row so the UI styles urgency from simulation truth instead of
   * reconstructing the rule from `daysUntilDue`.
   */
  overdue: boolean
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
 * Named explicitly rather than scanned by tag, because an action's `targetId`
 * has a KIND — a lender, a case, a supplier, an obligation — and a tag match
 * cannot tell whether the id a row carries is the one that action expects.
 * The tag scan this replaces put `take_loan` on every loan row, where it
 * wants a LENDER id and so could only ever answer "no lender 'loan-0'
 * operates here"; it put case-scoped `bribe_inspector` under every individual
 * fine; it hid `renegotiate_loan`, which is not tagged `coin`; and it offered
 * nothing at all on a supplier invoice, because no supplier action is tagged
 * `coin` either.
 *
 * `addressed` records how each action wants to be addressed FROM THIS ROW, so
 * a global action that takes no target is not handed one it would reject.
 * Eligibility still comes from each definition's own `canApply`, so an option
 * offered is one the registry will accept and an option greyed out still
 * carries the registry's own reason for saying no — §5's "a player cannot
 * discover what action is available and why" read from the report side.
 */
type CalendarOptionSpec = {
  actionId: string
  /** `row` passes the row's own target id; `none` passes no target. */
  addressed: 'row' | 'none'
}

const OPTION_ACTIONS: Record<ObligationKind, ReadonlyArray<CalendarOptionSpec>> = {
  loan: [
    { actionId: 'repay_loan', addressed: 'row' },
    { actionId: 'settle_loan', addressed: 'row' },
    { actionId: 'renegotiate_loan', addressed: 'row' },
  ],
  // `pay_rent` pays the tenancy down oldest-month-first and takes no target;
  // `negotiate_tenancy` is addressed by concession kind, not by an
  // obligation, so it belongs to the rent LEDGER view rather than to a row.
  rent: [{ actionId: 'pay_rent', addressed: 'none' }],
  fine: [{ actionId: 'pay_watch_fine', addressed: 'row' }],
  supplier: [
    { actionId: 'pay_supplier_invoice', addressed: 'row' },
    { actionId: 'schedule_supplier_payment', addressed: 'row' },
  ],
  other: [],
}

function optionsFor(
  state: TavernState,
  kind: ObligationKind,
  targetId: string,
): ObligationCalendarRow['options'] {
  const out: ObligationCalendarRow['options'] = []
  for (const spec of OPTION_ACTIONS[kind]) {
    const def = actionRegistry.get(spec.actionId)
    // A registry that does not carry the action is a pipeline without that
    // module, not a defect: the row simply offers one fewer way out.
    if (!def) continue
    const verdict = canApplyAction(def, state, {
      actionId: def.id,
      ...(spec.addressed === 'row' ? { targetId } : {}),
    })
    out.push({
      actionId: def.id,
      label: def.label,
      ...(verdict.ok ? {} : { disabledReason: verdict.reason }),
    })
  }
  return out
}

export function buildObligationCalendar(
  state: TavernState,
): ObligationCalendarData {
  const today = state.calendar.totalDaysElapsed

  const payables = listObligations(state, { direction: 'payable' })

  const rows: ObligationCalendarRow[] = payables.map((record) => {
    const kind = kindOf(record)
    // The row's own target id, in the shape the row's actions address: a loan
    // row is acted on through its LOAN, a supplier invoice through its
    // SUPPLIER, a fine through its own obligation.
    const targetId =
      kind === 'loan'
        ? (listLoans(state).find((loan) =>
            loan.instalments.some(
              (instalment) => instalment.obligationId === record.id,
            ),
          )?.id ?? record.id)
        : kind === 'supplier'
          ? record.counterparty.id
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
      overdue: isOverdue(record, today),
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
  // Read from the obligation's own STATUS, not from `dueOnDay < today`. The
  // lifecycle owns what "late" means — `enterGrace`/`defaultObligation` are
  // the only things that decide it — and a report that re-derives it by date
  // arithmetic is inventing truth the simulation already holds. The two agree
  // today only because the due event fires on the due day; nothing enforces
  // that, and the same definition read off status is what the economy module
  // uses for arrears.
  const overdue = payables.reduce(
    (sum, record) =>
      isOverdue(record, today) ? sum + outstandingAmount(record) : sum,
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
