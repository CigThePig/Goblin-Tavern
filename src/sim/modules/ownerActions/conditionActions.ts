import type { SimContext } from '../../core/context'
import {
  COUNTER_COOLDOWN_DAYS,
  conditionFor,
  counterplayFor,
} from '../../content/conditions/conditionDefinitions'
import {
  bumpConditionTotal,
  getConditionsModuleState,
  writeActiveCondition,
  writeForecast,
} from '../conditions/conditionState'
import { spendCoin } from '../stock/ledger'

import { TIME_COST_SHORT, TIME_COST_STANDARD } from './stateHelpers'
import type {
  ActionTarget,
  ActionValidationResult,
  OwnerActionDefinition,
} from './types'

// Expansion Phase 9 §9.4 — the player's half of a world condition.
//
// §9.4 lists counterplay between "affected systems" and "accumulated
// consequences", and the order is the argument: a condition that builds up a
// burden and pays it out at the end is only a decision if there is something
// to decide. Before this phase a modifier was weather in the literal sense —
// it happened at the tavern and the tavern watched.
//
// THREE VERBS, AND THE DIFFERENCE BETWEEN THEM IS THE POINT.
//
//   prepare_for_condition   spend against a FORECAST, before it exists
//   counter_condition       work the burden down while it runs
//   exploit_condition       take the upside instead of only surviving it
//
// ONE PREPARATION BEATS ONE COUNTERING, on every condition in the catalogue,
// and it has to or the forecast would be decoration: being told a week early
// has to buy more than finding out when the roof starts dripping. Preparing
// applies to the whole run, so it is the move for a house that expects to be
// busy; countering is cheaper per point but has to be done again and again,
// which spends the scarce thing — owner time — right through the crisis.
// Exploiting is the third answer — a festival is a fortnight of extra wear
// AND a fortnight of extra trade, and a player who only ever plays defence
// against it is leaving the better half on the table.
//
// One of each per run: the same move twice is the same move, and letting it
// stack would make the burden a coin sink rather than a decision.

const SOURCE = 'ownerActions.conditions'

const OK: ActionValidationResult = { ok: true }

function reject(code: string, reason: string): ActionValidationResult {
  return { ok: false, code, reason }
}

/** `<conditionId>:<counterplayId>` — the same shape the arc actions use. */
function parseTarget(
  targetId: string,
): { conditionId: string; moveId: string } | undefined {
  const split = targetId.lastIndexOf(':')
  if (split <= 0) return undefined
  return { conditionId: targetId.slice(0, split), moveId: targetId.slice(split + 1) }
}

function targetsFor(
  ctx: SimContext,
  kinds: ('prepare' | 'counter' | 'exploit')[],
): ActionTarget[] {
  const slice = getConditionsModuleState(ctx.state)
  const targets: ActionTarget[] = []

  if (kinds.includes('prepare')) {
    for (const forecast of slice.forecasts) {
      const definition = conditionFor(forecast.conditionId)
      if (!definition) continue
      for (const move of definition.counterplay) {
        if (move.kind !== 'prepare') continue
        if (forecast.preparedBy.includes(move.id)) continue
        targets.push({
          id: `${forecast.conditionId}:${move.id}`,
          label: move.label,
          hint: `${move.coinCost}c — ${forecast.confidence}% sure it lands in ${Math.max(0, forecast.startsOnDay - ctx.state.calendar.totalDaysElapsed)} day(s)`,
        })
      }
    }
  }

  for (const entry of slice.active) {
    const definition = conditionFor(entry.conditionId)
    if (!definition) continue
    for (const move of definition.counterplay) {
      if (!kinds.includes(move.kind)) continue
      if (move.kind === 'prepare') continue
      if (move.kind === 'exploit' && entry.exploited) continue
      if (move.kind === 'exploit' && entry.counteredBy.includes(move.id)) continue
      if (move.kind === 'counter' && counterCoolingUntil(ctx, entry) > 0) continue
      targets.push({
        id: `${entry.conditionId}:${move.id}`,
        label: move.label,
        hint:
          move.kind === 'exploit'
            ? `${move.coinCost}c — take the upside instead of only weathering it`
            : `${move.coinCost}c — takes ${move.strength} off a burden of ${Math.round(entry.burden)}`,
      })
    }
  }
  return targets
}

/** Days left before somebody can have another go at working it down. */
function counterCoolingUntil(
  ctx: SimContext,
  entry: { lastCounterDay?: number },
): number {
  if (entry.lastCounterDay === undefined) return 0
  const elapsed = ctx.state.calendar.totalDaysElapsed - entry.lastCounterDay
  return Math.max(0, COUNTER_COOLDOWN_DAYS - elapsed)
}

function validate(
  ctx: SimContext,
  targetId: string | undefined,
  kinds: ('prepare' | 'counter' | 'exploit')[],
): ActionValidationResult {
  if (!targetId) return reject('missing_target', 'Name the condition and the move.')
  const parsed = parseTarget(targetId)
  if (!parsed) {
    return reject('invalid_target', `'${targetId}' is not '<condition>:<move>'.`)
  }
  const move = counterplayFor(parsed.conditionId, parsed.moveId)
  if (!move) {
    return reject('unknown_move', `Nothing called '${parsed.moveId}' for that.`)
  }
  if (!kinds.includes(move.kind)) {
    return reject('wrong_action', `${move.label} is not that kind of move.`)
  }
  const slice = getConditionsModuleState(ctx.state)

  if (move.kind === 'prepare') {
    const forecast = slice.forecasts.find(
      (entry) => entry.conditionId === parsed.conditionId,
    )
    if (!forecast) {
      // Deliberately specific: preparing after the thing has started is not
      // an error the player made, it is the window having closed, and the
      // reason says so.
      const running = slice.active.some(
        (entry) => entry.conditionId === parsed.conditionId,
      )
      return reject(
        running ? 'already_started' : 'not_forecast',
        running
          ? 'It has already started — the time to prepare has passed.'
          : 'Nobody has said anything is coming.',
      )
    }
    if (forecast.preparedBy.includes(move.id)) {
      return reject('already_prepared', `${move.label} is already done.`)
    }
  } else {
    const entry = slice.active.find(
      (candidate) => candidate.conditionId === parsed.conditionId,
    )
    if (!entry) return reject('not_running', 'That is not happening right now.')
    if (move.kind === 'exploit') {
      if (entry.exploited || entry.counteredBy.includes(move.id)) {
        return reject('already_exploited', 'The house is already working it.')
      }
    } else {
      const cooling = counterCoolingUntil(ctx, entry)
      if (cooling > 0) {
        return reject(
          'too_soon',
          `They only just did that — ${cooling} day(s) before it is worth doing again.`,
        )
      }
    }
  }

  if (ctx.state.coin < move.coinCost) {
    return reject(
      'insufficient_coin',
      `${move.label} costs ${move.coinCost} coin; you have ${ctx.state.coin}.`,
    )
  }
  return OK
}

export const PREPARE_FOR_CONDITION_ACTION_ID = 'prepare_for_condition'
export const COUNTER_CONDITION_ACTION_ID = 'counter_condition'
export const EXPLOIT_CONDITION_ACTION_ID = 'exploit_condition'

export const prepareForCondition: OwnerActionDefinition = {
  id: PREPARE_FOR_CONDITION_ACTION_ID,
  label: 'Prepare for what is coming',
  category: 'immediate',
  tags: ['condition', 'world', 'preparation'],
  effectsPreview: 'Acts on a forecast before the condition arrives',
  targetType: 'composite',
  timeCost: TIME_COST_STANDARD,
  getValidTargets: (ctx) => targetsFor(ctx, ['prepare']),
  canApply: (ctx, input) => validate(ctx, input.targetId, ['prepare']),
  apply: (ctx, input) => {
    const parsed = parseTarget(input.targetId!)!
    const move = counterplayFor(parsed.conditionId, parsed.moveId)!
    const definition = conditionFor(parsed.conditionId)!
    if (move.coinCost > 0) {
      spendCoin(ctx, move.coinCost, {
        source: `${SOURCE}.prepare.${parsed.conditionId}`,
        category: 'repair',
        tags: ['condition', 'prepare', parsed.conditionId, move.id],
      })
    }
    writeForecast(
      ctx,
      parsed.conditionId,
      (current) => ({
        ...current,
        prepared: Math.min(100, current.prepared + move.strength),
        preparedBy: [...current.preparedBy, move.id],
      }),
      'prepared',
    )
    bumpConditionTotal(ctx, 'prepared')
    ctx.addHistory({
      category: 'owner_action',
      summary: `${move.label} — against the ${parsed.conditionId.replace(/_/g, ' ')} ${definition.source.actor} says is coming.`,
      tags: ['condition', 'prepare', parsed.conditionId],
      relatedSystems: ['conditions'],
      mechanicalRefs: [PREPARE_FOR_CONDITION_ACTION_ID],
    })
    return {
      actionId: PREPARE_FOR_CONDITION_ACTION_ID,
      label: 'Prepare for what is coming',
      targetId: input.targetId!,
      timeCost: TIME_COST_STANDARD,
      effects: [
        move.readable,
        `Spent ${move.coinCost} coin.`,
        'It will still happen. It will land softer.',
      ],
      data: { conditionId: parsed.conditionId, moveId: move.id, strength: move.strength },
    }
  },
}

export const counterCondition: OwnerActionDefinition = {
  id: COUNTER_CONDITION_ACTION_ID,
  label: 'Work against it',
  category: 'immediate',
  tags: ['condition', 'world', 'maintenance'],
  effectsPreview: 'Takes accumulated burden off a running condition',
  targetType: 'composite',
  timeCost: TIME_COST_SHORT,
  getValidTargets: (ctx) => targetsFor(ctx, ['counter']),
  canApply: (ctx, input) => validate(ctx, input.targetId, ['counter']),
  apply: (ctx, input) => {
    const parsed = parseTarget(input.targetId!)!
    const move = counterplayFor(parsed.conditionId, parsed.moveId)!
    const before =
      getConditionsModuleState(ctx.state).active.find(
        (entry) => entry.conditionId === parsed.conditionId,
      )?.burden ?? 0
    if (move.coinCost > 0) {
      spendCoin(ctx, move.coinCost, {
        source: `${SOURCE}.counter.${parsed.conditionId}`,
        category: 'repair',
        tags: ['condition', 'counter', parsed.conditionId, move.id],
      })
    }
    writeActiveCondition(
      ctx,
      parsed.conditionId,
      (current) => ({
        ...current,
        burden: Math.max(0, current.burden - move.strength),
        counteredDays: current.counteredDays + 1,
        lastCounterDay: ctx.state.calendar.totalDaysElapsed,
      }),
      'countered',
    )
    bumpConditionTotal(ctx, 'countered')
    const after = Math.max(0, before - move.strength)
    ctx.addHistory({
      category: 'owner_action',
      summary: `${move.label} — the ${parsed.conditionId.replace(/_/g, ' ')} is ${Math.round(after)} instead of ${Math.round(before)}.`,
      tags: ['condition', 'counter', parsed.conditionId],
      relatedSystems: ['conditions'],
      mechanicalRefs: [COUNTER_CONDITION_ACTION_ID],
    })
    return {
      actionId: COUNTER_CONDITION_ACTION_ID,
      label: 'Work against it',
      targetId: input.targetId!,
      timeCost: TIME_COST_SHORT,
      effects: [
        move.readable,
        `Took ${Math.round(before - after)} off what it has built up.`,
      ],
      data: { conditionId: parsed.conditionId, moveId: move.id, before, after },
    }
  },
}

export const exploitCondition: OwnerActionDefinition = {
  id: EXPLOIT_CONDITION_ACTION_ID,
  label: 'Make something of it',
  category: 'immediate',
  tags: ['condition', 'world', 'opportunity'],
  effectsPreview: 'Turns a running condition into trade rather than only damage',
  targetType: 'composite',
  timeCost: TIME_COST_STANDARD,
  getValidTargets: (ctx) => targetsFor(ctx, ['exploit']),
  canApply: (ctx, input) => validate(ctx, input.targetId, ['exploit']),
  apply: (ctx, input) => {
    const parsed = parseTarget(input.targetId!)!
    const move = counterplayFor(parsed.conditionId, parsed.moveId)!
    if (move.coinCost > 0) {
      spendCoin(ctx, move.coinCost, {
        source: `${SOURCE}.exploit.${parsed.conditionId}`,
        category: 'other',
        tags: ['condition', 'exploit', parsed.conditionId, move.id],
      })
    }
    writeActiveCondition(
      ctx,
      parsed.conditionId,
      (current) => ({
        ...current,
        exploited: true,
        exploitGain: current.exploitGain + move.strength,
        counteredBy: [...current.counteredBy, move.id],
      }),
      'exploited',
    )
    ctx.addHistory({
      category: 'owner_action',
      summary: `${move.label} — the house is working the ${parsed.conditionId.replace(/_/g, ' ')} rather than only weathering it.`,
      tags: ['condition', 'exploit', parsed.conditionId],
      relatedSystems: ['conditions'],
      mechanicalRefs: [EXPLOIT_CONDITION_ACTION_ID],
    })
    return {
      actionId: EXPLOIT_CONDITION_ACTION_ID,
      label: 'Make something of it',
      targetId: input.targetId!,
      timeCost: TIME_COST_STANDARD,
      effects: [
        move.readable,
        'The wear still lands. What it earns is banked against the ending.',
      ],
      data: { conditionId: parsed.conditionId, moveId: move.id },
    }
  },
}

export const CONDITION_ACTIONS: OwnerActionDefinition[] = [
  prepareForCondition,
  counterCondition,
  exploitCondition,
]
