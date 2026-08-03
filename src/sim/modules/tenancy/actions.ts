import type { SimContext } from '../../core/context'
import {
  TIME_COST_QUICK,
  TIME_COST_SHORT,
} from '../ownerActions/stateHelpers'
import type {
  ActionTarget,
  ActionValidationResult,
  OwnerActionApplied,
  OwnerActionDefinition,
} from '../ownerActions/types'

import {
  answerAccessRequest,
  arrearsOutstanding,
  effectiveRent,
  negotiateTenancy,
  payRent,
  reinstateTenancy,
  rentObligations,
  rentOutstanding,
  type NegotiationKind,
} from './tenancy'
import { getLandlord, getTenancy, getTenancyModuleState, upsertRepairRequest, nextRepairId } from './state'
import { LANDLORD_LABEL, MAX_NEGOTIATIONS, liveNotice } from './types'
import { outstandingAmount } from '../../contracts/obligations/index'

// Expansion Phase 7 §7.2 — the player's side of the tenancy.
//
// Six registered owner actions. Every rung of the notice ladder names a way
// out on the record itself (`TenancyNotice.remedies`), and each of those
// ways out is one of these actions — so the promise the notice makes is the
// promise the registry can keep, which is the whole §5 "a card may not
// promise a consequence no domain owns" rule read from the player's side.

const OK: ActionValidationResult = { ok: true }

function reject(code: string, reason: string): ActionValidationResult {
  return { ok: false, code, reason }
}

function noTargets(): ActionTarget[] {
  return []
}

// ---------- pay_rent ----------

const payRentAction: OwnerActionDefinition = {
  id: 'pay_rent',
  label: 'Pay the rent',
  category: 'immediate',
  tags: ['tenancy', 'rent', 'coin'],
  targetType: 'global',
  timeCost: TIME_COST_QUICK,
  effectsPreview: 'Pay what you can toward the rent, oldest month first.',
  pressureAffinity: ['landlord', 'debt'],
  getValidTargets: noTargets,
  canApply: (ctx) => {
    const owed = rentOutstanding(ctx.state)
    if (owed <= 0) return reject('nothing_owed', 'The rent is clear.')
    if (ctx.state.coin <= 0) {
      return reject('no_coin', 'The till is empty — take the day\'s sales first.')
    }
    return OK
  },
  apply: (ctx, input) => {
    const owed = rentOutstanding(ctx.state)
    const offered =
      input.amount !== undefined && input.amount > 0
        ? Math.floor(input.amount)
        : owed
    const result = payRent(ctx, offered, 'owner paid the rent')
    return {
      actionId: 'pay_rent',
      label: 'Pay the rent',
      timeCost: payRentAction.timeCost,
      effects: [result.readable],
      data: {
        paid: result.paid,
        clear: result.clear,
        settledObligations: result.settledObligations,
        outstanding: rentOutstanding(ctx.state),
      },
    }
  },
}

// ---------- negotiate_tenancy ----------

const NEGOTIATION_TARGETS: ReadonlyArray<{ id: NegotiationKind; label: string; hint: string }> = [
  {
    id: 'deferral',
    label: 'Ask for more time',
    hint: 'Ten extra days on the current month. Needs the landlord to think passably of you (opinion 35).',
  },
  {
    id: 'payment_plan',
    label: 'Propose a payment plan',
    hint: 'Holds a notice or a hearing for a month while you pay down. Needs opinion 45.',
  },
  {
    id: 'reduction',
    label: 'Ask for a lower rent',
    hint: 'A quarter off for two months. Needs opinion 60.',
  },
]

const negotiateTenancyAction: OwnerActionDefinition = {
  id: 'negotiate_tenancy',
  label: 'Talk to the landlord',
  category: 'social',
  tags: ['tenancy', 'negotiation', 'landlord'],
  targetType: 'global',
  timeCost: TIME_COST_SHORT,
  effectsPreview: 'Ask for time, a plan, or a lower rent. The landlord’s opinion decides.',
  pressureAffinity: ['landlord'],
  getValidTargets: (ctx) => {
    const landlord = getLandlord(ctx.state)
    return NEGOTIATION_TARGETS.map((target) => ({
      id: target.id,
      label: target.label,
      hint:
        landlord.negotiationsUsed >= MAX_NEGOTIATIONS
          ? `${LANDLORD_LABEL} has already granted ${landlord.negotiationsUsed} concessions.`
          : `${target.hint} (opinion is ${landlord.opinion}).`,
    }))
  },
  canApply: (ctx, input) => {
    if (!input.targetId) return reject('no_target', 'Choose what to ask for.')
    if (!NEGOTIATION_TARGETS.some((target) => target.id === input.targetId)) {
      return reject('unknown_ask', `'${input.targetId}' is not something to ask for.`)
    }
    if (!getTenancy(ctx.state)) {
      return reject('no_tenancy', 'There is no tenancy to negotiate.')
    }
    const landlord = getLandlord(ctx.state)
    if (landlord.negotiationsUsed >= MAX_NEGOTIATIONS) {
      return reject(
        'exhausted',
        `${LANDLORD_LABEL} has already granted ${landlord.negotiationsUsed} concessions and will grant no more.`,
      )
    }
    return OK
  },
  apply: (ctx, input) => {
    const kind = input.targetId as NegotiationKind
    const result = negotiateTenancy(ctx, kind)
    return {
      actionId: 'negotiate_tenancy',
      label: 'Talk to the landlord',
      targetId: kind,
      ...(NEGOTIATION_TARGETS.find((target) => target.id === kind)?.label
        ? { targetLabel: NEGOTIATION_TARGETS.find((t) => t.id === kind)!.label }
        : {}),
      timeCost: negotiateTenancyAction.timeCost,
      effects: [result.ok ? result.readable : result.reason],
      data: result.ok
        ? { ok: true, kind, expiresOnDay: result.concession.expiresOnDay }
        : { ok: false, code: result.code },
    }
  },
}

// ---------- grant_landlord_access / refuse_landlord_access ----------

function accessHint(ctx: SimContext): string {
  const request = getLandlord(ctx.state).accessRequest
  return request
    ? `${LANDLORD_LABEL} asked on day ${request.raisedOnDay} (${request.reason}); answer by day ${request.deadlineDay}.`
    : `${LANDLORD_LABEL} has not asked to come round.`
}

const grantAccessAction: OwnerActionDefinition = {
  id: 'grant_landlord_access',
  label: 'Let the landlord look round',
  category: 'social',
  tags: ['tenancy', 'access', 'landlord'],
  targetType: 'global',
  timeCost: TIME_COST_QUICK,
  effectsPreview: 'Answer the landlord’s access request. They think better of you for it.',
  pressureAffinity: ['landlord'],
  getValidTargets: noTargets,
  canApply: (ctx) => {
    const request = getLandlord(ctx.state).accessRequest
    if (!request) return reject('no_request', accessHint(ctx))
    return OK
  },
  apply: (ctx) => {
    const outcome = answerAccessRequest(ctx, true)
    return {
      actionId: 'grant_landlord_access',
      label: 'Let the landlord look round',
      timeCost: grantAccessAction.timeCost,
      effects: [outcome.readable],
      data: { granted: true, opinion: getLandlord(ctx.state).opinion },
    }
  },
}

const refuseAccessAction: OwnerActionDefinition = {
  id: 'refuse_landlord_access',
  label: 'Turn the landlord away',
  category: 'social',
  tags: ['tenancy', 'access', 'landlord'],
  targetType: 'global',
  timeCost: TIME_COST_QUICK,
  effectsPreview: 'Refuse the access request. They remember, and it costs you standing.',
  pressureAffinity: ['landlord'],
  getValidTargets: noTargets,
  canApply: (ctx) => {
    const request = getLandlord(ctx.state).accessRequest
    if (!request) return reject('no_request', accessHint(ctx))
    return OK
  },
  apply: (ctx) => {
    const outcome = answerAccessRequest(ctx, false)
    return {
      actionId: 'refuse_landlord_access',
      label: 'Turn the landlord away',
      timeCost: refuseAccessAction.timeCost,
      effects: [outcome.readable],
      data: { granted: false, opinion: getLandlord(ctx.state).opinion },
    }
  },
}

// ---------- request_landlord_repair ----------

/**
 * The landlord is responsible for the fabric of the building; the tavern is
 * responsible for what it does to it. Only badly-conditioned areas qualify,
 * because a landlord asked to repaint a serviceable room says no — and a
 * rejection that names the bar is what tells the player where the line is.
 */
const STRUCTURAL_CONDITION_BAR = 45

const requestRepairAction: OwnerActionDefinition = {
  id: 'request_landlord_repair',
  label: 'Ask the landlord to repair',
  category: 'social',
  tags: ['tenancy', 'repair', 'landlord'],
  targetType: 'area',
  timeCost: TIME_COST_SHORT,
  effectsPreview: 'Free, but slow, and only for real structural decay.',
  pressureAffinity: ['landlord', 'maintenance'],
  getValidTargets: (ctx) =>
    Object.values(ctx.state.areas).map((area) => ({
      id: area.id,
      label: area.label,
      hint:
        area.condition < STRUCTURAL_CONDITION_BAR
          ? `Condition ${area.condition} — the landlord's problem.`
          : `Condition ${area.condition} — above the ${STRUCTURAL_CONDITION_BAR} the landlord will act on.`,
    })),
  canApply: (ctx, input) => {
    if (!input.targetId) return reject('no_target', 'Choose an area.')
    const area = ctx.state.areas[input.targetId]
    if (!area) return reject('unknown_area', `No area '${input.targetId}'.`)
    if (area.condition >= STRUCTURAL_CONDITION_BAR) {
      return reject(
        'not_structural',
        `${area.label} is at condition ${area.condition}; the landlord only acts below ${STRUCTURAL_CONDITION_BAR}.`,
      )
    }
    const open = getTenancyModuleState(ctx.state).repairs.some(
      (repair) =>
        repair.areaId === input.targetId &&
        (repair.status === 'requested' || repair.status === 'scheduled'),
    )
    if (open) {
      return reject('already_requested', `A repair on ${area.label} is already with the landlord.`)
    }
    return OK
  },
  apply: (ctx, input) => {
    const today = ctx.state.calendar.totalDaysElapsed
    const area = ctx.state.areas[input.targetId!]!
    const landlord = getLandlord(ctx.state)
    // A landlord who thinks well of the tavern sends tradesmen; one who does
    // not refuses, and says so. Opinion is the lever the player can move.
    const willing = landlord.opinion >= 40 && landlord.accessRefusals < 2
    const id = nextRepairId(ctx.state)
    upsertRepairRequest(
      ctx,
      {
        id,
        areaId: area.id,
        raisedOnDay: today,
        conditionAtRequest: area.condition,
        status: willing ? 'scheduled' : 'refused',
        ...(willing ? { scheduledForDay: today + 5 } : { resolvedOnDay: today }),
        readable: willing
          ? `${LANDLORD_LABEL} will send tradesmen to ${area.label} around day ${today + 5}.`
          : `${LANDLORD_LABEL} says ${area.label} is your problem, not theirs.`,
      },
      willing ? 'repair_scheduled' : 'repair_refused',
    )
    return {
      actionId: 'request_landlord_repair',
      label: 'Ask the landlord to repair',
      targetId: area.id,
      targetLabel: area.label,
      timeCost: requestRepairAction.timeCost,
      effects: [
        willing
          ? `${LANDLORD_LABEL} will send tradesmen to ${area.label} around day ${today + 5}.`
          : `${LANDLORD_LABEL} refused — opinion ${landlord.opinion}, ${landlord.accessRefusals} refused visit(s).`,
      ],
      data: { repairId: id, scheduled: willing, areaId: area.id },
    }
  },
}

// ---------- reinstate_tenancy ----------

const reinstateAction: OwnerActionDefinition = {
  id: 'reinstate_tenancy',
  label: 'Buy the tenancy back',
  category: 'immediate',
  tags: ['tenancy', 'eviction', 'recovery', 'coin'],
  targetType: 'global',
  timeCost: TIME_COST_SHORT,
  effectsPreview: 'Clear the arrears plus the landlord’s costs and get the keys back.',
  pressureAffinity: ['landlord'],
  getValidTargets: noTargets,
  canApply: (ctx) => {
    const tenancy = getTenancy(ctx.state)
    if (!tenancy) return reject('no_tenancy', 'There is no tenancy.')
    if (tenancy.tenancyStatus !== 'evicted') {
      return reject('not_evicted', 'You still hold the tenancy.')
    }
    const owed = rentOutstanding(ctx.state)
    const due = owed + Math.max(1, Math.round(owed * 0.25))
    if (ctx.state.coin < due) {
      return reject(
        'cannot_afford',
        `Reinstatement costs ${due} coin (${owed} arrears plus costs); the till holds ${ctx.state.coin}.`,
      )
    }
    return OK
  },
  apply: (ctx) => {
    const result = reinstateTenancy(ctx)
    return {
      actionId: 'reinstate_tenancy',
      label: 'Buy the tenancy back',
      timeCost: reinstateAction.timeCost,
      effects: [result.ok ? result.readable : result.reason],
      data: result.ok ? { ok: true, paid: result.paid } : { ok: false, code: result.code },
    }
  },
}

/** Everything a report or a card needs to describe the tenancy position. */
export function tenancySummary(ctx: SimContext): {
  owed: number
  arrears: number
  nextRent: number
  dueOnDay?: number
  notice?: string
  remedies: string[]
} {
  const tenancy = getTenancy(ctx.state)
  const notice = liveNotice(getTenancyModuleState(ctx.state))
  const current = rentObligations(ctx.state).find(
    (record) => record.id === tenancy?.currentObligationId,
  )
  return {
    owed: rentOutstanding(ctx.state),
    arrears: arrearsOutstanding(ctx.state),
    nextRent: tenancy ? effectiveRent(tenancy) : 0,
    ...(current?.dueOnDay !== undefined ? { dueOnDay: current.dueOnDay } : {}),
    ...(notice ? { notice: notice.readable } : {}),
    remedies: notice?.remedies ?? [],
    ...(current ? { currentOutstanding: outstandingAmount(current) } : {}),
  }
}

export const TENANCY_ACTIONS: OwnerActionDefinition[] = [
  payRentAction,
  negotiateTenancyAction,
  grantAccessAction,
  refuseAccessAction,
  requestRepairAction,
  reinstateAction,
]
