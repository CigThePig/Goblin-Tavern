import { z } from 'zod'

import type { SimContext } from '../../core/context'
import type {
  CustomerGroupState,
  EntityRef,
  RegularWorldState,
  TavernState,
} from '../../state/TavernState'
import { getRule } from '../../contracts/ruleset/index'
import {
  forgiveObligation,
  getObligation,
  listObligations,
  nextObligationId,
  openObligation,
  outstandingAmount,
  payObligation,
  transitionContract,
  upsertObligation,
  type ObligationRecord,
} from '../../contracts/obligations/index'
import { addCoin } from '../stock/ledger'
import { isPolicyEnabled } from '../ownerActions/stateHelpers'
import type { ServiceQualityModifiers } from '../staff/types'

// Expansion Phase 4 §4.5 — patron-specific tabs.
//
// WHAT THIS REPLACES. An unpaid tab used to be one number per group per day,
// computed from `tabRisk`, deducted from the till, and then forgotten. Nobody
// owed it, because there was nobody to owe it: the "debtor" was an aggregate.
// So none of §4.5's requirements could exist — no repayment, no forgiveness, no
// escalation, no write-off, and no relationship consequence, because there was
// no relationship on the other end of the debt.
//
// THE IDENTITY LEVEL IS THE POINT. §4.5 asks for "bounded debt records attached
// to regulars, groups, or anonymous cohorts", and the three levels behave
// differently on purpose:
//
//   regular   a named person. Highest collection chance (you know where they
//             drink), and chasing them or forgiving them moves a real
//             relationship that changes whether they come back.
//   group     a cohort you can identify by its colours. Middling chance;
//             pressure lands on the group's patronage rather than a person.
//   anonymous strangers who walked. Low chance and no relationship to move —
//             which is exactly why a tavern full of strangers is a worse place
//             to run a slate.
//
// THE COIN IS UNCHANGED, THE RECORD IS NEW. A tab still leaves the till short
// on the night (the money never arrived), so net takings match the old model
// exactly. What is new is that the shortfall is now a RECEIVABLE the player can
// chase, forgive, or lose — and that a collected tab is real coin arriving days
// later.

export const SERVICE_MODULE_ID_FOR_TABS = 'service'

/** Days a patron tab runs before the house calls it in. */
export const TAB_DUE_DAYS = 5

/** §5.11 bounded growth: live patron tabs are capped. */
export const MAX_OPEN_PATRON_TABS = 40

/** Below this, a debt is not worth the ink. Written off on sight. */
export const TAB_MINIMUM = 1

export type TabDebtorKind = 'regular' | 'group' | 'anonymous'

/**
 * The service module's own index of what it knows about a tab that the shared
 * obligation record has no field for.
 *
 * The money and its due/grace/default clock live in the shared ledger (one
 * calendar, not six). The identity level, the collection odds, and the chase
 * history are patron-tab facts, so they live here.
 */
export type PatronTabIndexEntry = {
  obligationId: string
  debtorKind: TabDebtorKind
  /** Regular id, customer-group id, or the party that walked. */
  debtorId: string
  groupId: string
  openedOnDay: number
  /** 0..1 — the chance a collection attempt lands anything. */
  collectionProbability: number
  /** Collection attempts made so far. Each one costs goodwill. */
  chases: number
  readable: string
}

export const PatronTabIndexEntrySchema = z.object({
  obligationId: z.string(),
  debtorKind: z.enum(['regular', 'group', 'anonymous']),
  debtorId: z.string(),
  groupId: z.string(),
  openedOnDay: z.number().int().min(0),
  collectionProbability: z.number().min(0).max(1),
  chases: z.number().int().min(0),
  readable: z.string(),
})

export function patronTabTag(debtorKind: TabDebtorKind, debtorId: string): string {
  return `patron_tab:${debtorKind}:${debtorId}`
}

/** Every live patron tab, soonest-opened first. */
export function listPatronTabs(state: TavernState): ObligationRecord[] {
  return listObligations(state, {
    direction: 'receivable',
    ownerModuleId: SERVICE_MODULE_ID_FOR_TABS,
  })
    .filter((record) => record.tags.includes('patron_tab'))
    .sort((a, b) =>
      a.openedOnDay === b.openedOnDay
        ? a.id.localeCompare(b.id)
        : a.openedOnDay - b.openedOnDay,
    )
}

export function totalPatronTabDebt(state: TavernState): number {
  return listPatronTabs(state).reduce(
    (sum, record) => sum + outstandingAmount(record),
    0,
  )
}

/**
 * How much of a party's bill walks out of the door.
 *
 * Every factor here is a record something else owns: the group's `tabRisk` and
 * rowdiness, the crew's published `tabControl` (a server on `watch_tabs` or a
 * bouncer on `intimidate_debtors` closes it; `maximize_sales` opens it), the
 * `refuse_tabs` policy, and — for a named regular — how much credit this house
 * has already extended them.
 */
export function tabForParty(args: {
  bill: number
  /** Patrons in the party. The slate scales with heads, as it did per group. */
  patrons: number
  group: CustomerGroupState
  quality: ServiceQualityModifiers
  regular?: RegularWorldState
  policyAdjustment: number
  /** Coin the regular already owes. A slate that is already long stops growing. */
  existingRegularDebt: number
}): number {
  const { bill, patrons, group, quality, regular, policyAdjustment } = args
  if (bill <= 0 || patrons <= 0) return 0
  // Per HEAD, not per coin — the same shape Phase 12 used at group level, so a
  // night's leakage is calibrated exactly as before and the difference is who
  // owes it rather than how much.
  const base = (patrons * group.tabRisk) / 100
  const rowdyBoost = group.rowdiness >= 70 ? 0.25 : 0
  const controlFactor = Math.max(-0.5, Math.min(0.8, quality.tabControl / 4))
  let raw = base * (1 + rowdyBoost) * (1 - controlFactor) * policyAdjustment
  if (regular) {
    // A regular runs a slate more readily — that is what being a regular buys —
    // but a house that is already owed a lot stops writing it down.
    const trust = Math.max(0, Math.min(1, regular.loyalty / 100))
    raw *= 1 + trust * 0.5
    if (args.existingRegularDebt >= bill * 3) raw *= 0.3
  }
  // Deliberately UNROUNDED. Rounding here would round a fractional slate up to
  // a whole coin on every party in the room — which, at party granularity,
  // multiplies the night's leakage several times over. The caller accumulates
  // per debtor and rounds once.
  return Math.min(Math.max(0, raw), bill)
}

/**
 * The odds a chase gets anything back.
 *
 * Identity is the dominant term, which is the mechanical statement of "know
 * your customers": a named regular is worth extending credit to and a room full
 * of strangers is not.
 */
export function collectionProbabilityFor(args: {
  debtorKind: TabDebtorKind
  group: CustomerGroupState
  regular?: RegularWorldState
  quality: ServiceQualityModifiers
}): number {
  const base =
    args.debtorKind === 'regular' ? 0.7 : args.debtorKind === 'group' ? 0.4 : 0.15
  let probability = base
  probability += Math.max(-0.15, Math.min(0.2, args.quality.tabControl / 10))
  probability += (args.group.loyalty - 50) / 400
  if (args.regular) {
    probability += (args.regular.loyalty - 50) / 300
    probability -= args.regular.irritation / 300
  }
  return Math.max(0.02, Math.min(0.95, Math.round(probability * 100) / 100))
}

export type OpenPatronTabInput = {
  amount: number
  groupId: string
  debtorKind: TabDebtorKind
  debtorId: string
  collectionProbability: number
  readable: string
}

/** Counterparty ref for the identity level. */
function counterpartyFor(input: OpenPatronTabInput): EntityRef {
  if (input.debtorKind === 'regular') return { kind: 'regular', id: input.debtorId }
  if (input.debtorKind === 'group') {
    return { kind: 'customer_group', id: input.debtorId }
  }
  return { kind: 'other', id: input.debtorId }
}

/**
 * Open a tab.
 *
 * Returns the index entry so the caller can record it in the service slice;
 * the obligation itself is already in the shared ledger when this returns.
 */
export function openPatronTab(
  ctx: SimContext,
  input: OpenPatronTabInput,
): PatronTabIndexEntry | undefined {
  if (input.amount < TAB_MINIMUM) return undefined
  const today = ctx.state.calendar.totalDaysElapsed
  const id = nextObligationId(ctx.state, SERVICE_MODULE_ID_FOR_TABS)
  const record = openObligation({
    id,
    ownerModuleId: SERVICE_MODULE_ID_FOR_TABS,
    counterparty: counterpartyFor(input),
    direction: 'receivable',
    principal: Math.round(input.amount),
    openedOnDay: today,
    dueOnDay: today + TAB_DUE_DAYS,
    graceDays: getRule(ctx.state, 'obligationGraceDays'),
    lateChargeRate: 0,
    readable: input.readable,
    tags: [
      'patron_tab',
      'service',
      input.groupId,
      patronTabTag(input.debtorKind, input.debtorId),
    ],
  })
  upsertObligation(ctx, record, 'patron_tab_opened')
  return {
    obligationId: id,
    debtorKind: input.debtorKind,
    debtorId: input.debtorId,
    groupId: input.groupId,
    openedOnDay: today,
    collectionProbability: input.collectionProbability,
    chases: 0,
    readable: input.readable,
  }
}

export type TabCollectionResult = {
  status: 'collected' | 'part_collected' | 'refused' | 'gone'
  recovered: number
  readable: string
}

/**
 * Chase a debt.
 *
 * The roll is on the `service_flow` stream, so chasing a tab cannot shift a
 * generated name or tomorrow's arrivals. A refusal escalates the record — which
 * is what eventually turns an unpaid slate into a default rather than an
 * indefinite nag.
 */
export function collectPatronTab(
  ctx: SimContext,
  entry: PatronTabIndexEntry,
): TabCollectionResult {
  const record = getObligation(ctx.state, entry.obligationId)
  if (!record) {
    return { status: 'gone', recovered: 0, readable: 'That slate is already closed.' }
  }
  const outstanding = outstandingAmount(record)
  if (outstanding <= 0) {
    return { status: 'gone', recovered: 0, readable: 'Nothing left owing.' }
  }
  const today = ctx.state.calendar.totalDaysElapsed
  const rng = ctx.getRngStream('service_flow')
  // Each previous chase makes the next less likely to land: the ones who were
  // going to pay paid the first time.
  const odds = Math.max(0.02, entry.collectionProbability * Math.pow(0.7, entry.chases))
  if (!rng.chance(odds)) {
    const escalated = transitionContract(
      { ...record, escalation: record.escalation + 1 },
      record.status === 'active' ? 'grace' : record.status,
      today,
      'collection refused',
    )
    upsertObligation(ctx, escalated, 'patron_tab_refused')
    return {
      status: 'refused',
      recovered: 0,
      readable: `${record.readable} — nothing recovered.`,
    }
  }
  // A partial recovery is the ordinary case: they had some of it on them.
  const share = rng.chance(0.55) ? 1 : 0.5
  const recovered = Math.max(1, Math.round(outstanding * share))
  const payment = payObligation(record, recovered, today, 'collected')
  upsertObligation(ctx, payment.record, 'patron_tab_collected')
  if (payment.applied > 0) {
    addCoin(ctx, payment.applied, {
      source: `service.tabs.collected.${entry.debtorId}`,
      category: 'other',
      tags: ['patron_tab', 'collected', entry.groupId, entry.debtorId],
      reason: 'patron_tab_collected',
    })
  }
  return {
    status: payment.settled ? 'collected' : 'part_collected',
    recovered: payment.applied,
    readable: `Recovered ${payment.applied} coin against ${record.readable}.`,
  }
}

/** Write a slate off as a gesture. Costs the coin, buys the goodwill. */
export function forgivePatronTab(
  ctx: SimContext,
  entry: PatronTabIndexEntry,
  reason: string,
): { forgiven: number; readable: string } | undefined {
  const record = getObligation(ctx.state, entry.obligationId)
  if (!record) return undefined
  const outstanding = outstandingAmount(record)
  if (outstanding <= 0) return undefined
  const today = ctx.state.calendar.totalDaysElapsed
  const forgiven = forgiveObligation(record, today, reason)
  upsertObligation(ctx, forgiven, 'patron_tab_forgiven')
  return {
    forgiven: outstanding,
    readable: `Wrote off ${outstanding} coin — ${record.readable}.`,
  }
}

/** Give up on a slate nobody is going to pay. */
export function writeOffPatronTab(
  ctx: SimContext,
  entry: PatronTabIndexEntry,
  reason: string,
): number {
  const record = getObligation(ctx.state, entry.obligationId)
  if (!record) return 0
  const outstanding = outstandingAmount(record)
  if (outstanding <= 0) return 0
  const today = ctx.state.calendar.totalDaysElapsed
  const closed = transitionContract(record, 'expired', today, reason)
  upsertObligation(ctx, closed, 'patron_tab_written_off')
  return outstanding
}
