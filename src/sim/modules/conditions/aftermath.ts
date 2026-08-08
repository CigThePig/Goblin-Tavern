import type { SimContext } from '../../core/context'
import { conditionFor } from '../../content/conditions/conditionDefinitions'
import { recordPressureAdjustment } from '../pressures/pressureModule'
import { applyRenownDrift } from '../service/renown'
import { spendCoin } from '../stock/ledger'

import {
  SCAR_LIFETIME_DAYS,
  bumpConditionTotal,
  writeConditionsSlice,
  type ActiveCondition,
  type ConditionRecord,
  type ConditionScar,
} from './conditionState'

// Expansion Phase 9 §9.4 — the reckoning.
//
// This is the function the whole phase exists for. A month modifier used to
// stop by running out of month; nothing was owed, nothing was left, and the
// only trace was a label in a report. A condition now ENDS, and what it
// leaves behind is whatever burden the house never dealt with, paid out in
// the currency of the thing it was doing all along: water in the roof, spores
// through the stores, an assessment nobody set coin aside for.
//
// A CLEAN ENDING IS A REAL OUTCOME. Below `cleanBelow` the condition ends
// with nothing owed, and that is the point of the counterplay: not that
// preparing makes the number smaller, but that a house which worked at it
// walks away from the same weather owing nothing at all.

const SOURCE = 'conditions.aftermath'

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

/**
 * Pay out one condition's ending.
 *
 * Returns the record so the caller can append it to history in the same
 * write as the removal from `active` — the two must not be able to drift.
 */
export function resolveCondition(
  ctx: SimContext,
  entry: ActiveCondition,
): ConditionRecord {
  const definition = conditionFor(entry.conditionId)
  const today = ctx.state.calendar.totalDaysElapsed
  const finalBurden = Math.round(entry.burden)
  const label = entry.conditionId.replace(/_/g, ' ')

  if (!definition) {
    return {
      conditionId: entry.conditionId,
      startedOnDay: entry.startedOnDay,
      endedOnDay: today,
      peakBurden: entry.peakBurden,
      finalBurden,
      counteredDays: entry.counteredDays,
      preparedness: entry.preparedness,
      exploited: entry.exploited,
      exploitGain: entry.exploitGain,
      outcome: 'clean',
      readable: `${label} passed.`,
    }
  }

  // The upside first: a condition worked for profit pays out whether or not
  // it also left a mess, because those are two different things that
  // happened to the same fortnight.
  if (entry.exploited && entry.exploitGain > 0) {
    applyRenownDrift(ctx, Math.min(6, Math.round(entry.exploitGain / 6)), {
      source: `${SOURCE}.exploited`,
      readable: `The house made something of the ${label}.`,
      tags: ['renown', 'condition', 'exploited', entry.conditionId],
      relatedActors: [],
      relatedSystems: ['conditions'],
    })
    bumpConditionTotal(ctx, 'exploited')
  }

  const aftermath = definition.aftermath
  if (finalBurden < aftermath.cleanBelow) {
    bumpConditionTotal(ctx, 'cleanEndings')
    ctx.addCause({
      source: `${SOURCE}.clean`,
      sourceType: 'system',
      target: entry.conditionId,
      targetType: 'global',
      amount: finalBurden,
      direction: 'neutral',
      weight: 5,
      readable: `The ${label} ended with nothing owed — the house stayed on top of it.`,
      tags: ['condition', 'ended', 'clean', entry.conditionId],
      relatedSystems: ['conditions'],
    })
    return {
      conditionId: entry.conditionId,
      startedOnDay: entry.startedOnDay,
      endedOnDay: today,
      peakBurden: entry.peakBurden,
      finalBurden,
      counteredDays: entry.counteredDays,
      preparedness: entry.preparedness,
      exploited: entry.exploited,
      exploitGain: entry.exploitGain,
      outcome: entry.exploited ? 'exploited' : 'clean',
      readable: `The ${label} ended with nothing owed.`,
    }
  }

  const severity = Math.max(1, Math.round(finalBurden / aftermath.severityDivisor))
  applyAftermathEffect(ctx, entry, severity, aftermath.kind, aftermath.targetId)

  const scar: ConditionScar = {
    id: `scar_${entry.conditionId}_${entry.startedOnDay}`,
    conditionId: entry.conditionId,
    label: `${label} — what it left`,
    readable: aftermath.readable,
    createdOnDay: today,
    expiresOnDay: today + SCAR_LIFETIME_DAYS,
    severity,
  }
  writeConditionsSlice(
    ctx,
    (current) => ({
      ...current,
      scars: [...current.scars.filter((s) => s.id !== scar.id), scar],
    }),
    'scar',
  )
  bumpConditionTotal(ctx, 'scarsLeft')
  ctx.addCause({
    source: `${SOURCE}.scarred`,
    sourceType: 'system',
    target: entry.conditionId,
    targetType: 'global',
    amount: severity,
    direction: 'increase',
    weight: 8,
    readable: aftermath.readable,
    tags: ['condition', 'ended', 'aftermath', entry.conditionId],
    relatedSystems: ['conditions'],
  })

  return {
    conditionId: entry.conditionId,
    startedOnDay: entry.startedOnDay,
    endedOnDay: today,
    peakBurden: entry.peakBurden,
    finalBurden,
    counteredDays: entry.counteredDays,
    preparedness: entry.preparedness,
    exploited: entry.exploited,
    exploitGain: entry.exploitGain,
    outcome: 'scarred',
    readable: aftermath.readable,
  }
}

/**
 * Hand the consequence to the domain that owns it.
 *
 * Every branch writes through the owning module's own mutator, because §5
 * is explicit that a system whose only consequence is a direct meter
 * adjustment has not done its job — the aftermath has to land somewhere the
 * rest of the sim already reads and acts on.
 */
function applyAftermathEffect(
  ctx: SimContext,
  entry: ActiveCondition,
  severity: number,
  kind: string,
  targetId: string | undefined,
): void {
  switch (kind) {
    case 'area_damage': {
      const area = targetId ? ctx.state.areas[targetId] : undefined
      if (!area) return
      ctx.modifyArea(
        area.id,
        {
          damage: clampPercent(area.damage + severity),
          condition: clampPercent(area.condition - Math.round(severity / 2)),
        },
        { source: `${SOURCE}.${entry.conditionId}`, reason: 'condition_aftermath' },
      )
      return
    }
    case 'area_smell_and_risk': {
      const area = targetId ? ctx.state.areas[targetId] : undefined
      if (!area) return
      ctx.modifyArea(
        area.id,
        {
          smell: clampPercent(area.smell + severity),
          risk: clampPercent(area.risk + severity),
        },
        { source: `${SOURCE}.${entry.conditionId}`, reason: 'condition_aftermath' },
      )
      return
    }
    case 'stock_spoilage': {
      for (const item of Object.values(ctx.state.stock)) {
        if (item.quantity <= 0) continue
        if (item.storageAreaId !== 'cellar') continue
        ctx.modifyStock(
          item.id,
          { spoilage: clampPercent(item.spoilage + severity) },
          { source: `${SOURCE}.${entry.conditionId}`, reason: 'condition_aftermath' },
        )
      }
      return
    }
    case 'staff_stress': {
      for (const staff of Object.values(ctx.state.staff)) {
        ctx.modifyStaff(
          staff.id,
          { stress: clampPercent(staff.stress + severity) },
          { source: `${SOURCE}.${entry.conditionId}`, reason: 'condition_aftermath' },
        )
      }
      return
    }
    case 'coin_assessment': {
      // The assessment is owed whether or not the till can cover it. What
      // the house cannot pay is what the levy takes out of it, and the
      // shortfall shows up as landlord pressure rather than vanishing.
      const owed = severity
      const affordable = Math.min(owed, ctx.state.coin)
      if (affordable > 0) {
        spendCoin(ctx, affordable, {
          category: 'other',
          source: `${SOURCE}.levy`,
          sourceType: 'system',
          target: 'coin',
          targetType: 'coin',
          amount: -affordable,
          readable: `The assessment came due: ${affordable} coin.`,
          tags: ['condition', 'levy', entry.conditionId],
          relatedSystems: ['conditions', 'economy'],
        })
      }
      const shortfall = owed - affordable
      if (shortfall > 0) {
        // What the till could not cover does not evaporate. It goes through
        // the pressure layer's ADJUSTMENT channel rather than a direct write
        // — `debt` is a calculated pressure, so a bare `modifyPressure` would
        // be recomputed away on the same day's endDay and the shortfall
        // would have had no consequence at all. An adjustment survives the
        // recalculation and decays on the ruleset's own schedule, which is
        // what an unpaid assessment should do: hang over the house for a
        // while, and stop mattering once it has been worked through.
        recordPressureAdjustment(
          ctx,
          'debt',
          Math.min(12, Math.round(shortfall / 2)),
          `${SOURCE}.levy_unpaid`,
        )
        ctx.addCause({
          source: `${SOURCE}.levy_unpaid`,
          sourceType: 'system',
          target: 'debt',
          targetType: 'pressure',
          amount: shortfall,
          direction: 'increase',
          weight: 8,
          readable: `${shortfall} coin of the assessment went unpaid.`,
          tags: ['condition', 'levy', 'unpaid', entry.conditionId],
          relatedSystems: ['conditions', 'economy'],
        })
      }
      return
    }
    case 'lost_trade': {
      for (const group of Object.values(ctx.state.customerGroups)) {
        if (group.patronage <= 0) continue
        ctx.modifyCustomerGroup(
          group.id,
          {
            loyalty: clampPercent(group.loyalty - severity),
            patronage: Math.max(0, group.patronage - Math.round(severity / 2)),
          },
          { source: `${SOURCE}.${entry.conditionId}`, reason: 'condition_aftermath' },
        )
      }
      return
    }
    case 'renown_swing': {
      applyRenownDrift(ctx, -severity, {
        source: `${SOURCE}.${entry.conditionId}`,
        readable: `The ${entry.conditionId.replace(/_/g, ' ')} cost the house its name.`,
        tags: ['renown', 'condition', entry.conditionId],
        relatedActors: [],
        relatedSystems: ['conditions'],
      })
      return
    }
    default:
      return
  }
}
