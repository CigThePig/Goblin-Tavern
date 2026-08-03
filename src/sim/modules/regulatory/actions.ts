import type { SimContext } from '../../core/context'
import {
  TIME_COST_QUICK,
  TIME_COST_SHORT,
} from '../ownerActions/stateHelpers'
import type {
  ActionTarget,
  ActionValidationResult,
  OwnerActionDefinition,
} from '../ownerActions/types'
import {
  getObligation,
  listObligations,
  outstandingAmount,
} from '../../contracts/obligations/index'

import {
  appealFinding,
  bribeInspector,
  checkRequirement,
  payFine,
  remediateFinding,
  updateRecords,
} from './inspection'
import {
  getCase,
  getRegulatoryModuleState,
  listFindings,
} from './state'
import {
  MAX_APPEALS_PER_CASE,
  REGULATORY_MODULE_ID,
  WATCH_LABEL,
  openCases,
} from './types'

// Expansion Phase 7 §7.3.9 — the player's side of an inspection.
//
// Five registered owner actions covering the four responses §7.3.9 allows:
// compliance (`declare_remediation`, and `put_the_books_in_order` as the
// preparation the window is for), payment (`pay_watch_fine`), appeal
// (`appeal_finding`), and the one the plan gates on being "consistent with
// the game" — bribery, which the ledger's own `HOOK-inspection_bribe_exposed_*`
// family already presumed.
//
// Every one of them names its condition on rejection, and every one of them
// moves state the inspector re-reads. `declare_remediation` deliberately
// does NOT clear a finding on its own: the follow-up checks the room.

const OK: ActionValidationResult = { ok: true }

function reject(code: string, reason: string): ActionValidationResult {
  return { ok: false, code, reason }
}

function noTargets(): ActionTarget[] {
  return []
}

// ---------- put_the_books_in_order ----------

const updateRecordsAction: OwnerActionDefinition = {
  id: 'put_the_books_in_order',
  label: 'Put the books in order',
  category: 'immediate',
  tags: ['regulatory', 'records', 'preparation'],
  targetType: 'global',
  timeCost: TIME_COST_SHORT,
  effectsPreview: 'Raises records readiness — one of the seven things an inspector grades.',
  pressureAffinity: ['inspection'],
  getValidTargets: noTargets,
  canApply: (ctx) => {
    const records = getRegulatoryModuleState(ctx.state).records
    if (records.readiness >= 95) {
      return reject('already_in_order', `The books are already in order (${records.readiness}).`)
    }
    return OK
  },
  apply: (ctx) => {
    const result = updateRecords(ctx)
    return {
      actionId: 'put_the_books_in_order',
      label: 'Put the books in order',
      timeCost: updateRecordsAction.timeCost,
      effects: [result.readable],
      data: { readiness: result.readiness },
    }
  },
}

// ---------- declare_remediation ----------

function listOpenFindings(ctx: SimContext): ActionTarget[] {
  return listFindings(ctx.state)
    .filter((finding) => finding.status === 'open' || finding.status === 'remediated')
    .map((finding) => ({
      id: finding.id,
      label: finding.requirement,
      // The hint says whether it is ACTUALLY true yet, read off live state —
      // so a player can tell the difference between declaring and doing.
      hint: checkRequirement(ctx.state, finding)
        ? `Satisfied now. Declare it and the follow-up will confirm it.`
        : `Not satisfied yet: ${finding.readable}`,
    }))
}

const remediateAction: OwnerActionDefinition = {
  id: 'declare_remediation',
  label: 'Report an order as done',
  category: 'immediate',
  tags: ['regulatory', 'finding', 'compliance'],
  targetType: 'global',
  timeCost: TIME_COST_QUICK,
  effectsPreview: 'Tell the watch a finding is dealt with. The follow-up checks the room, not the claim.',
  pressureAffinity: ['inspection'],
  getValidTargets: listOpenFindings,
  canApply: (ctx, input) => {
    if (!input.targetId) return reject('no_target', 'Choose a finding.')
    const finding = getRegulatoryModuleState(ctx.state).findings[input.targetId]
    if (!finding) return reject('unknown_finding', `No finding '${input.targetId}'.`)
    if (finding.status !== 'open') {
      return reject('not_open', `That finding is already ${finding.status}.`)
    }
    return OK
  },
  apply: (ctx, input) => {
    const result = remediateFinding(ctx, input.targetId!)
    return {
      actionId: 'declare_remediation',
      label: 'Report an order as done',
      targetId: input.targetId!,
      timeCost: remediateAction.timeCost,
      effects: [result.ok ? result.readable : result.reason],
      data: result.ok
        ? { ok: true, verified: result.verified, status: result.finding.status }
        : { ok: false, code: result.code },
    }
  },
}

// ---------- appeal_finding ----------

const appealAction: OwnerActionDefinition = {
  id: 'appeal_finding',
  label: 'Appeal a finding',
  category: 'social',
  tags: ['regulatory', 'finding', 'appeal'],
  targetType: 'global',
  timeCost: TIME_COST_SHORT,
  effectsPreview: 'Contest one finding. Judged on whether it is still true, not on how you ask.',
  pressureAffinity: ['inspection'],
  getValidTargets: listOpenFindings,
  canApply: (ctx, input) => {
    if (!input.targetId) return reject('no_target', 'Choose a finding.')
    const finding = getRegulatoryModuleState(ctx.state).findings[input.targetId]
    if (!finding) return reject('unknown_finding', `No finding '${input.targetId}'.`)
    const record = getCase(ctx.state, finding.caseId)
    if (!record) return reject('case_closed', 'That case is closed.')
    if (record.appealsUsed >= MAX_APPEALS_PER_CASE) {
      return reject(
        'appeals_exhausted',
        `${WATCH_LABEL} hears one appeal per case, and you have used it.`,
      )
    }
    if (finding.status !== 'open' && finding.status !== 'remediated') {
      return reject('not_appealable', `That finding is already ${finding.status}.`)
    }
    return OK
  },
  apply: (ctx, input) => {
    const result = appealFinding(ctx, input.targetId!)
    return {
      actionId: 'appeal_finding',
      label: 'Appeal a finding',
      targetId: input.targetId!,
      timeCost: appealAction.timeCost,
      effects: [result.ok ? result.readable : result.reason],
      data: result.ok ? { ok: true, upheld: result.upheld } : { ok: false, code: result.code },
    }
  },
}

// ---------- pay_watch_fine ----------

function listFineTargets(ctx: SimContext): ActionTarget[] {
  return listObligations(ctx.state, {
    direction: 'payable',
    ownerModuleId: REGULATORY_MODULE_ID,
  }).map((obligation) => ({
    id: obligation.id,
    label: obligation.readable,
    hint: `${outstandingAmount(obligation)} outstanding, due day ${obligation.dueOnDay ?? '—'} [${obligation.status}]`,
  }))
}

const payFineAction: OwnerActionDefinition = {
  id: 'pay_watch_fine',
  label: 'Pay a watch fine',
  category: 'immediate',
  tags: ['regulatory', 'fine', 'coin'],
  targetType: 'global',
  timeCost: TIME_COST_QUICK,
  effectsPreview: 'Settle a fine. Partial payment counts, and unpaid fines keep a case open.',
  pressureAffinity: ['inspection', 'debt'],
  getValidTargets: listFineTargets,
  canApply: (ctx, input) => {
    if (!input.targetId) return reject('no_target', 'Choose a fine.')
    const obligation = getObligation(ctx.state, input.targetId)
    if (!obligation) return reject('unknown_fine', `No outstanding fine '${input.targetId}'.`)
    if (ctx.state.coin <= 0) {
      return reject('no_coin', 'The till is empty — take the day\'s sales first.')
    }
    return OK
  },
  apply: (ctx, input) => {
    const obligation = getObligation(ctx.state, input.targetId!)
    const offered =
      input.amount !== undefined && input.amount > 0
        ? Math.floor(input.amount)
        : obligation
          ? outstandingAmount(obligation)
          : 0
    const result = payFine(ctx, input.targetId!, offered)
    return {
      actionId: 'pay_watch_fine',
      label: 'Pay a watch fine',
      targetId: input.targetId!,
      ...(obligation ? { targetLabel: obligation.readable } : {}),
      timeCost: payFineAction.timeCost,
      effects: [result.ok ? result.readable : result.reason],
      data: result.ok
        ? { ok: true, paid: result.paid, cleared: result.cleared }
        : { ok: false, code: result.code },
    }
  },
}

// ---------- bribe_inspector ----------

const DEFAULT_BRIBE = 60

const bribeAction: OwnerActionDefinition = {
  id: 'bribe_inspector',
  label: 'Have a quiet word with the inspector',
  category: 'social',
  tags: ['regulatory', 'bribe', 'coin', 'risk'],
  targetType: 'global',
  timeCost: TIME_COST_QUICK,
  effectsPreview: 'Offer coin for a clean visit. It can be taken, refused, or come out later.',
  pressureAffinity: ['inspection'],
  getValidTargets: (ctx) =>
    openCases(getRegulatoryModuleState(ctx.state)).map((record) => ({
      id: record.id,
      label: `${record.inspectorName} — ${record.readable}`,
      hint: record.bribe
        ? `${record.inspectorName} has already been approached about this.`
        : `Coin buys a clean visit if it is taken. If it is refused, or it comes out, it is worse than the finding.`,
    })),
  canApply: (ctx, input) => {
    if (!input.targetId) return reject('no_target', 'Choose a case.')
    const record = getCase(ctx.state, input.targetId)
    if (!record) return reject('unknown_case', `No open case '${input.targetId}'.`)
    if (record.bribe) {
      return reject(
        'already_offered',
        `${record.inspectorName} has already been approached about this case.`,
      )
    }
    const offer =
      input.amount !== undefined && input.amount > 0
        ? Math.floor(input.amount)
        : DEFAULT_BRIBE
    if (ctx.state.coin < offer) {
      return reject(
        'cannot_afford',
        `The till holds ${ctx.state.coin}, not ${offer}.`,
      )
    }
    return OK
  },
  apply: (ctx, input) => {
    const offer =
      input.amount !== undefined && input.amount > 0
        ? Math.floor(input.amount)
        : DEFAULT_BRIBE
    const result = bribeInspector(ctx, input.targetId!, offer)
    return {
      actionId: 'bribe_inspector',
      label: 'Have a quiet word with the inspector',
      targetId: input.targetId!,
      timeCost: bribeAction.timeCost,
      effects: [result.ok ? result.readable : result.reason],
      data: result.ok
        ? { ok: true, accepted: result.accepted, paid: result.paid }
        : { ok: false, code: result.code },
    }
  },
}

export const REGULATORY_ACTIONS: OwnerActionDefinition[] = [
  updateRecordsAction,
  remediateAction,
  appealAction,
  payFineAction,
  bribeAction,
]
