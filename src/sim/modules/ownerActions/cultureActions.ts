import type { SimContext } from '../../core/context'
import {
  getCultureModuleState,
  liveMisunderstandingFor,
  liveMisunderstandings,
} from '../cultures/cultureState'
import {
  closeMisunderstanding,
  noteAccommodation,
  noteEvidence,
} from '../cultures/standing'
import { bumpCultureTotal } from '../cultures/cultureState'
import { observancesToday } from '../cultures/observance'
import { spendCoin } from '../stock/ledger'

import { TIME_COST_SHORT, TIME_COST_STANDARD } from './stateHelpers'
import type {
  ActionTarget,
  ActionValidationResult,
  OwnerActionApplied,
  OwnerActionDefinition,
} from './types'

// Expansion Phase 8 §8.2 — the player's half of the culture relationship.
//
// §5 fails a phase where "a player cannot discover what action is available
// and why", and §8.2's reconciliation half is meaningless without a way to
// reconcile. Two actions, and between them they cover the two things a
// culture can be owed:
//
//   make_amends_to_culture     put right a specific, named slight
//   mark_culture_observance    keep an occasion on the day it matters
//
// Both are discoverable in the ordinary way — they appear as valid targets
// exactly when there is something to answer, and the target hint carries the
// remedy the misunderstanding itself recorded, so the player is told what
// would fix it rather than having to guess.

const SOURCE = 'ownerActions'

const OK: ActionValidationResult = { ok: true }

function reject(code: string, reason: string): ActionValidationResult {
  return { ok: false, code, reason }
}

/** Coin it costs to put a slight right. Scales with how badly it landed. */
const AMENDS_BASE_COST = 12

function amendsCost(ctx: SimContext, cultureId: string): number {
  const standing = getCultureModuleState(ctx.state).standing[cultureId]
  const net = standing?.net ?? 0
  return AMENDS_BASE_COST + Math.min(40, Math.abs(Math.min(0, net)))
}

function culturesOwedAmends(ctx: SimContext): ActionTarget[] {
  return liveMisunderstandings(ctx.state).map((record) => {
    const culture = ctx.state.world.cultures[record.cultureId]
    return {
      id: record.cultureId,
      label: culture?.label ?? record.cultureId,
      // The remedy is the discoverability requirement: the player is told
      // what would fix it, in the culture's own terms.
      hint: `${record.reason} — ${record.remedy} (${amendsCost(ctx, record.cultureId)} coin)`,
    }
  })
}

function culturesObservingToday(ctx: SimContext): ActionTarget[] {
  return observancesToday(ctx).map((observance) => {
    const culture = ctx.state.world.cultures[observance.cultureId]
    return {
      id: observance.cultureId,
      label: culture?.label ?? observance.cultureId,
      hint: `observing ${observance.tag.replace(/_/g, ' ')} today`,
    }
  })
}

// ---------- make_amends_to_culture ----------

const makeAmendsToCulture: OwnerActionDefinition = {
  id: 'make_amends_to_culture',
  label: 'Make Amends',
  category: 'social',
  tags: ['social', 'culture', 'reconciliation'],
  effectsPreview: 'Puts right a specific slight a culture is holding against the house',
  pressureAffinity: ['cultural_tension'],
  targetType: 'customer_group',
  timeCost: TIME_COST_STANDARD,
  getValidTargets: culturesOwedAmends,
  canApply: (ctx, input) => {
    if (!input.targetId) {
      return reject('missing_target', 'make_amends_to_culture requires targetId')
    }
    const culture = ctx.state.world.cultures[input.targetId]
    if (!culture) {
      return reject('unknown_target', `Unknown culture '${input.targetId}'`)
    }
    const record = liveMisunderstandingFor(ctx.state, input.targetId)
    if (!record) {
      return reject(
        'nothing_to_answer',
        `${culture.label} are holding nothing against the house.`,
      )
    }
    const cost = amendsCost(ctx, input.targetId)
    if (cost > ctx.state.coin) {
      return reject(
        'insufficient_coin',
        `${cost} coin needed, ${ctx.state.coin} in the till.`,
      )
    }
    return OK
  },
  apply: (ctx, input): OwnerActionApplied => {
    const culture = ctx.state.world.cultures[input.targetId!]!
    const record = liveMisunderstandingFor(ctx.state, culture.id)!
    const cost = amendsCost(ctx, culture.id)

    spendCoin(ctx, cost, {
      category: 'other',
      source: `${SOURCE}.make_amends_to_culture`,
      sourceType: 'owner_action',
      target: 'coin',
      targetType: 'coin',
      amount: -cost,
      readable: `Made amends to ${culture.label} (${cost} coin).`,
      tags: ['owner_action', 'culture', 'amends', culture.id],
      relatedActors: [{ kind: 'culture', id: culture.id }],
      relatedSystems: ['cultures', 'economy'],
    })

    closeMisunderstanding(ctx, record.id, 'reconciled')
    bumpCultureTotal(ctx, 'amendsMade')

    // Amends are positive evidence in their own right, weighted to roughly
    // cancel the slight that caused them — putting something right undoes
    // it, it does not earn credit beyond that.
    noteEvidence(ctx, {
      cultureId: culture.id,
      id: `amends_${record.id}`,
      kind: 'amends',
      weight: 16,
      readable: `The house made it right with ${culture.label}.`,
      tags: ['amends', 'reconciliation'],
    })
    noteAccommodation(ctx, {
      cultureId: culture.id,
      kind: 'made_amends',
      readable: `The house made amends to ${culture.label} over: ${record.reason}`,
      accommodated: true,
    })

    ctx.addHistory({
      category: 'owner_action',
      summary: `The house made amends to ${culture.label}.`,
      tags: ['owner_action', 'culture', 'amends', culture.id],
      relatedActors: [{ kind: 'culture', id: culture.id }],
      relatedSystems: ['ownerActions', 'cultures'],
      mechanicalRefs: ['make_amends_to_culture', record.id],
    })

    return {
      actionId: makeAmendsToCulture.id,
      label: `Made Amends to ${culture.label}`,
      targetId: culture.id,
      timeCost: TIME_COST_STANDARD,
      effects: [`coin -${cost}`, 'matter settled'],
      data: { cultureId: culture.id, misunderstandingId: record.id, paid: cost },
    }
  },
}

// ---------- mark_culture_observance ----------

const OBSERVANCE_COST = 20

const markCultureObservance: OwnerActionDefinition = {
  id: 'mark_culture_observance',
  label: 'Mark an Observance',
  category: 'social',
  tags: ['social', 'culture', 'observance', 'cultural_accommodation'],
  effectsPreview: "Keeps a culture's occasion on the day it matters to them",
  pressureAffinity: ['cultural_tension'],
  targetType: 'customer_group',
  timeCost: TIME_COST_SHORT,
  getValidTargets: culturesObservingToday,
  canApply: (ctx, input) => {
    if (!input.targetId) {
      return reject('missing_target', 'mark_culture_observance requires targetId')
    }
    const culture = ctx.state.world.cultures[input.targetId]
    if (!culture) {
      return reject('unknown_target', `Unknown culture '${input.targetId}'`)
    }
    const observing = observancesToday(ctx).some(
      (entry) => entry.cultureId === input.targetId,
    )
    if (!observing) {
      return reject(
        'nothing_observed',
        `${culture.label} are not observing anything today.`,
      )
    }
    if (OBSERVANCE_COST > ctx.state.coin) {
      return reject(
        'insufficient_coin',
        `${OBSERVANCE_COST} coin needed, ${ctx.state.coin} in the till.`,
      )
    }
    return OK
  },
  apply: (ctx, input): OwnerActionApplied => {
    const culture = ctx.state.world.cultures[input.targetId!]!
    const observance = observancesToday(ctx).find(
      (entry) => entry.cultureId === culture.id,
    )!

    spendCoin(ctx, OBSERVANCE_COST, {
      category: 'other',
      source: `${SOURCE}.mark_culture_observance`,
      sourceType: 'owner_action',
      target: 'coin',
      targetType: 'coin',
      amount: -OBSERVANCE_COST,
      readable: `Marked ${culture.label}'s ${observance.tag.replace(/_/g, ' ')}.`,
      tags: ['owner_action', 'culture', 'observance', culture.id],
      relatedActors: [{ kind: 'culture', id: culture.id }],
      relatedSystems: ['cultures', 'economy'],
    })

    // The evidence is recorded now, on the day it was earned. The evening's
    // `resolveObservances` pass reads accommodation history rather than
    // re-deciding, so this cannot be double-counted.
    noteEvidence(ctx, {
      cultureId: culture.id,
      id: `observance_${observance.tag}`,
      kind: 'observance_honoured',
      weight: 14,
      readable: `The house marked ${culture.label}'s ${observance.tag.replace(/_/g, ' ')}.`,
      subjectId: observance.tag,
      tags: ['observance', observance.tag, 'owner_action'],
    })
    noteAccommodation(ctx, {
      cultureId: culture.id,
      kind: 'honoured_observance',
      readable: `The house marked ${culture.label}'s ${observance.tag.replace(/_/g, ' ')} deliberately.`,
      accommodated: true,
    })
    bumpCultureTotal(ctx, 'observancesHonoured')

    ctx.addHistory({
      category: 'owner_action',
      summary: `The house marked ${culture.label}'s ${observance.tag.replace(/_/g, ' ')}.`,
      tags: ['owner_action', 'culture', 'observance', culture.id],
      relatedActors: [{ kind: 'culture', id: culture.id }],
      relatedSystems: ['ownerActions', 'cultures'],
      mechanicalRefs: ['mark_culture_observance', observance.tag],
    })

    return {
      actionId: markCultureObservance.id,
      label: `Marked ${culture.label}'s Observance`,
      targetId: culture.id,
      timeCost: TIME_COST_SHORT,
      effects: [`coin -${OBSERVANCE_COST}`, 'observance kept'],
      data: { cultureId: culture.id, tag: observance.tag },
    }
  },
}

export const CULTURE_ACTIONS: OwnerActionDefinition[] = [
  makeAmendsToCulture,
  markCultureObservance,
]

export { makeAmendsToCulture, markCultureObservance, amendsCost }
