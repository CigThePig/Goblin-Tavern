import type { SimContext } from '../../core/context'
import { getRule } from '../../contracts/ruleset/index'
import { addCoin, spendCoin } from '../stock/ledger'
import {
  TIME_COST_QUICK,
  TIME_COST_SHORT,
} from '../ownerActions/stateHelpers'
import type {
  ActionValidationResult,
  OwnerActionApplied,
  OwnerActionDefinition,
} from '../ownerActions/types'

import { getEconomyModuleState, writeEconomyState } from './state'

const OK: ActionValidationResult = { ok: true }

function reject(code: string, reason: string): ActionValidationResult {
  return { ok: false, code, reason }
}

function noTargets(): [] {
  return []
}

const payOperatingArrears: OwnerActionDefinition = {
  id: 'pay_operating_arrears',
  label: 'Pay Operating Arrears',
  category: 'immediate',
  tags: ['economy', 'arrears', 'recovery'],
  effectsPreview: 'Pays overdue operating costs from the till',
  pressureAffinity: ['staff_loyalty_risk', 'landlord'],
  targetType: 'global',
  timeCost: TIME_COST_QUICK,
  getValidTargets: noTargets,
  canApply: (ctx, input) => {
    const arrears = getEconomyModuleState(ctx.state).financial.operatingArrears
    if (arrears <= 0) return reject('no_operating_arrears', 'No operating arrears are due.')
    if (ctx.state.coin <= 0) return reject('insufficient_coin', 'The till is empty.')
    if (
      input.amount !== undefined &&
      (!Number.isFinite(input.amount) || Math.floor(input.amount) <= 0)
    ) {
      return reject(
        'invalid_amount',
        'The arrears payment must be at least 1 whole coin.',
      )
    }
    return OK
  },
  apply: (ctx, input): OwnerActionApplied => {
    const before = getEconomyModuleState(ctx.state).financial.operatingArrears
    const amountDue = Math.ceil(before)
    const requested =
      input.amount !== undefined
        ? Math.floor(input.amount)
        : amountDue
    const paid = Math.min(amountDue, requested, ctx.state.coin)
    const after = Math.max(0, before - paid)
    spendCoin(ctx, paid, {
      source: 'economy.action.pay_operating_arrears',
      category: 'other',
      tags: ['economy', 'operating_arrears', 'arrears_payment'],
    })
    writeEconomyState(
      ctx,
      (state) => ({
        ...state,
        financial: {
          ...state.financial,
          operatingArrears: after,
        },
      }),
      'owner_paid_arrears',
    )
    return {
      actionId: payOperatingArrears.id,
      label: payOperatingArrears.label,
      timeCost: payOperatingArrears.timeCost,
      effects: [`operating arrears ${before} → ${after}`, `coin -${paid}`],
      data: { paid, before, after },
    }
  },
}

const closeTemporarily: OwnerActionDefinition = {
  id: 'close_tavern_temporarily',
  label: 'Close Tavern Temporarily',
  category: 'immediate',
  tags: ['economy', 'closure', 'recovery'],
  effectsPreview: 'Stops service while reducing daily operating burn',
  targetType: 'global',
  timeCost: TIME_COST_QUICK,
  getValidTargets: noTargets,
  canApply: (ctx) => {
    const status = getEconomyModuleState(ctx.state).financial.status
    return status === 'temporarily_closed' || status === 'restructuring'
      ? reject('already_closed', 'The tavern is already closed.')
      : OK
  },
  apply: (ctx): OwnerActionApplied => {
    const today = ctx.state.calendar.totalDaysElapsed + 1
    const before = getEconomyModuleState(ctx.state).financial.status
    writeEconomyState(
      ctx,
      (state) => ({
        ...state,
        financial: {
          ...state.financial,
          status: 'temporarily_closed',
          statusSinceDay: today,
          lastTransitionReason: 'the owner closed the doors to stop the burn',
        },
      }),
      'voluntary_closure',
    )
    return {
      actionId: closeTemporarily.id,
      label: closeTemporarily.label,
      timeCost: closeTemporarily.timeCost,
      effects: [`financial status ${before} → temporarily_closed`],
      data: { before, after: 'temporarily_closed' },
    }
  },
}

const restructureTavern: OwnerActionDefinition = {
  id: 'restructure_tavern',
  label: 'Restructure the Tavern',
  category: 'immediate',
  tags: ['economy', 'insolvency', 'recovery', 'restructuring'],
  effectsPreview: 'Writes down arrears and restores costly working capital',
  pressureAffinity: ['staff_loyalty_risk', 'landlord'],
  targetType: 'global',
  timeCost: TIME_COST_SHORT,
  getValidTargets: noTargets,
  canApply: (ctx) => {
    const status = getEconomyModuleState(ctx.state).financial.status
    return status === 'insolvent' || status === 'temporarily_closed'
      ? OK
      : reject('not_insolvent', 'Restructuring is available only during insolvency or closure.')
  },
  apply: (ctx): OwnerActionApplied => {
    const before = getEconomyModuleState(ctx.state)
    const assistance = getRule(ctx.state, 'recoveryAssistanceMultiplier')
    const writeDownShare = Math.max(0.3, Math.min(0.75, 0.5 * assistance))
    // Coin and every payable amount are whole-coin values. Rounding the
    // write-down here prevents a fractional arrear from later making the
    // integer till invalid when it is paid.
    const writtenDown = Math.round(
      before.financial.operatingArrears * writeDownShare,
    )
    const remaining = Math.max(
      0,
      Math.ceil(before.financial.operatingArrears) - writtenDown,
    )
    const workingCapital = Math.max(20, Math.round(45 * assistance))
    addCoin(ctx, workingCapital, {
      source: 'economy.action.restructure_tavern',
      category: 'other',
      tags: [
        'economy',
        'restructuring',
        'recovery_assistance',
        'loan_proceeds',
      ],
    })
    const today = ctx.state.calendar.totalDaysElapsed + 1
    writeEconomyState(
      ctx,
      (state) => ({
        ...state,
        financial: {
          ...state.financial,
          status: 'restructuring',
          statusSinceDay: today,
          cashStressDays: 0,
          insolvencyDays: 0,
          healthyDays: 0,
          operatingArrears: remaining,
          restructuringBalance:
            state.financial.restructuringBalance + workingCapital,
          lastTransitionReason: 'a restructuring restored working capital under repayment terms',
        },
        operatingWriteOffsToday:
          state.operatingWriteOffsToday + writtenDown,
      }),
      'restructured',
    )
    ctx.addHistory({
      category: 'state_change',
      summary: `The tavern restructured: ${writtenDown} arrears written down, ${workingCapital} working capital advanced.`,
      tags: ['economy', 'restructuring', 'recovery'],
      relatedSystems: ['economy'],
      mechanicalRefs: ['restructure_tavern'],
    })
    return {
      actionId: restructureTavern.id,
      label: restructureTavern.label,
      timeCost: restructureTavern.timeCost,
      effects: [
        `operating arrears ${before.financial.operatingArrears} → ${remaining}`,
        `working capital +${workingCapital}`,
        `restructuring balance +${workingCapital}`,
      ],
      data: { writtenDown, workingCapital, remaining },
    }
  },
}

const reopenTavern: OwnerActionDefinition = {
  id: 'reopen_tavern',
  label: 'Reopen the Tavern',
  category: 'immediate',
  tags: ['economy', 'closure', 'recovery'],
  effectsPreview: 'Resumes service when a basic operating cushion exists',
  targetType: 'global',
  timeCost: TIME_COST_QUICK,
  getValidTargets: noTargets,
  canApply: (ctx) => {
    const financial = getEconomyModuleState(ctx.state).financial
    if (financial.status !== 'temporarily_closed' && financial.status !== 'restructuring') {
      return reject('not_closed', 'The tavern is already operating.')
    }
    if (ctx.state.coin < 8) {
      return reject('insufficient_working_capital', 'At least 8 coin is needed to reopen safely.')
    }
    if (
      financial.status === 'temporarily_closed' &&
      financial.operatingArrears > 20
    ) {
      return reject('arrears_too_high', 'Operating arrears must be restructured below 20 coin.')
    }
    return OK
  },
  apply: (ctx): OwnerActionApplied => {
    const today = ctx.state.calendar.totalDaysElapsed + 1
    const before = getEconomyModuleState(ctx.state).financial.status
    writeEconomyState(
      ctx,
      (state) => ({
        ...state,
        financial: {
          ...state.financial,
          status: 'recovering',
          statusSinceDay: today,
          cashStressDays: 0,
          healthyDays: 0,
          lastTransitionReason: 'the owner reopened with a working cushion',
        },
      }),
      'reopened',
    )
    return {
      actionId: reopenTavern.id,
      label: reopenTavern.label,
      timeCost: reopenTavern.timeCost,
      effects: [`financial status ${before} → recovering`, 'service resumed'],
      data: { before, after: 'recovering' },
    }
  },
}

export const ECONOMY_ACTIONS: OwnerActionDefinition[] = [
  payOperatingArrears,
  closeTemporarily,
  restructureTavern,
  reopenTavern,
]
