import type { SimContext } from '../../core/context'
import type { SimulationHook, SimulationModule } from '../../core/module'
import type { ReportSection } from '../../core/reports'
import type { ValidationIssue } from '../../state/types'
import {
  conditionFor,
  ensureWorldConditionsRegistered,
} from '../../content/conditions/conditionDefinitions'

import { CONDITIONS_MODULE_ID } from './moduleId'
import {
  ConditionsModuleStateSchema,
  MAX_ACTIVE_CONDITIONS,
  bumpConditionTotal,
  createInitialConditionsModuleState,
  getConditionsModuleState,
  liveScars,
  pruneConditionsSlice,
  writeConditionsSlice,
} from './conditionState'
import { firmUpForecasts, issueForecasts, promoteForecasts } from './forecast'
import {
  accrueBurden,
  applyConditionDay,
  applyScarDrag,
  expiredConditions,
} from './process'
import { resolveCondition } from './aftermath'

// Expansion Phase 9 §9.4 — month modifiers become processes.
//
// WHAT WAS BROKEN. A modifier was drawn once a month and then subtracted one
// point from something for twenty-eight days. It had no source beyond the
// draw, no warning, no duration that was not "a month", nothing the player
// could do about it, and nothing left behind when it stopped. §9.4 lists
// seven things each modifier needs; it had one and a half of them.
//
// WHAT OWNS WHAT. This module owns the PROCESS: forecasts, active runs, the
// burden, the aftermath, the scars, the history. `modules.monthly` keeps
// owning `currentModifier`, because the arc engine, the rent resolution and
// the monthly report all read it and none of them wants to learn about
// durations — but the monthly module now DERIVES it from what is actually
// running here rather than from a draw nobody could act on. That is the
// join, and it is one-directional: this module never writes the monthly
// slice.
//
// ORDER WITHIN THE DAY. Forecasts firm up, then anything due starts, then
// the running conditions act, then the burden accrues, then anything whose
// last day has passed is paid out. Ending LAST is what lets a condition's
// final day still be a day it was happening, and starting BEFORE the daily
// pass is what stops a condition's first day being a day off.

const SOURCE = CONDITIONS_MODULE_ID

ensureWorldConditionsRegistered()

const startDayHook: SimulationHook = (ctx: SimContext): void => {
  firmUpForecasts(ctx)
  promoteForecasts(ctx)
  issueForecasts(ctx)

  for (const entry of getConditionsModuleState(ctx.state).active) {
    applyConditionDay(ctx, entry)
    accrueBurden(ctx, entry)
  }

  applyScarDrag(ctx)
}

/**
 * Endings run at the close of the day, not the open of the next one.
 *
 * A condition's last day is a day it was still happening — the rain does not
 * stop at dawn because the fortnight is up — so the daily pass acts first
 * and the reckoning comes after it.
 */
const endDayHook: SimulationHook = (ctx: SimContext): void => {
  const today = ctx.state.calendar.totalDaysElapsed
  const expired = expiredConditions(ctx)
  for (const entry of expired) {
    // Re-read: the daily pass has already written to this run today.
    const live = getConditionsModuleState(ctx.state).active.find(
      (candidate) => candidate.conditionId === entry.conditionId,
    )
    if (!live) continue
    const record = resolveCondition(ctx, live)
    writeConditionsSlice(
      ctx,
      (current) => ({
        ...current,
        active: current.active.filter(
          (candidate) => candidate.conditionId !== live.conditionId,
        ),
        history: [...current.history, record],
      }),
      'condition_ended',
    )
    bumpConditionTotal(ctx, 'ended')
    ctx.addHistory({
      category: 'state_change',
      summary: record.readable,
      tags: ['condition', 'ended', record.outcome, record.conditionId],
      relatedSystems: ['conditions'],
    })
  }

  const slice = getConditionsModuleState(ctx.state)
  const pruned = pruneConditionsSlice(slice, today)
  if (
    pruned.scars.length !== slice.scars.length ||
    pruned.history.length !== slice.history.length ||
    pruned.forecasts.length !== slice.forecasts.length
  ) {
    writeConditionsSlice(ctx, () => pruned, 'prune')
  }
}

function buildReport(ctx: SimContext): ReportSection {
  const slice = getConditionsModuleState(ctx.state)
  const today = ctx.state.calendar.totalDaysElapsed
  const lines: string[] = []

  if (slice.active.length === 0) {
    lines.push('Nothing running.')
  } else {
    for (const entry of slice.active) {
      const definition = conditionFor(entry.conditionId)
      const label = definition?.id.replace(/_/g, ' ') ?? entry.conditionId
      lines.push(
        `${label} — day ${entry.daysActive} of about ${entry.endsOnDay - entry.startedOnDay}, from ${entry.sourceActor}${entry.arose ? ' (the house invited it)' : ''}`,
      )
      lines.push(
        `  building up: ${Math.round(entry.burden)}/100${entry.preparedness > 0 ? ` (prepared ${entry.preparedness})` : ''}${entry.exploited ? ' — being worked for profit' : ''}`,
      )
      if (definition) {
        lines.push(`  touches: ${definition.affects.join(', ')}`)
        const clean = definition.aftermath.cleanBelow
        lines.push(
          entry.burden < clean
            ? `  on this footing it ends with nothing owed.`
            : `  on this footing it will leave: ${definition.aftermath.readable}`,
        )
        const remaining = definition.counterplay.filter(
          (move) => !entry.counteredBy.includes(move.id),
        )
        if (remaining.length > 0) {
          lines.push(
            `  still available: ${remaining.map((move) => `${move.label} (${move.coinCost}c)`).join('; ')}`,
          )
        }
      }
    }
  }

  if (slice.forecasts.length > 0) {
    lines.push('')
    lines.push('Word of what is coming:')
    for (const entry of slice.forecasts) {
      lines.push(
        `  ${entry.conditionId.replace(/_/g, ' ')} — in ${Math.max(0, entry.startsOnDay - today)} day(s), ${entry.confidence}% sure (${entry.sourceActor})`,
      )
      lines.push(`    ${entry.readable}`)
      if (entry.prepared > 0) {
        lines.push(`    prepared: ${entry.prepared}`)
      }
    }
  }

  const scars = liveScars(ctx.state)
  if (scars.length > 0) {
    lines.push('')
    lines.push('Still being felt:')
    for (const scar of scars) {
      lines.push(
        `  ${scar.label} (${scar.severity}) — fades on day ${scar.expiresOnDay}: ${scar.readable}`,
      )
    }
  }

  if (slice.history.length > 0) {
    lines.push('')
    lines.push('What has passed through:')
    for (const record of slice.history.slice(-5)) {
      lines.push(
        `  ${record.conditionId.replace(/_/g, ' ')} — days ${record.startedOnDay}–${record.endedOnDay}, ${record.outcome} (peak ${Math.round(record.peakBurden)}, ended ${Math.round(record.finalBurden)})`,
      )
    }
  }

  return {
    id: CONDITIONS_MODULE_ID,
    source: CONDITIONS_MODULE_ID,
    title: 'World Conditions',
    lines,
    data: {
      active: slice.active.length,
      forecast: slice.forecasts.length,
      scars: scars.length,
      totals: slice.totals,
    },
  }
}

function validateConditions(ctx: SimContext): ValidationIssue[] {
  const slice = getConditionsModuleState(ctx.state)
  const issues: ValidationIssue[] = []
  if (slice.active.length > MAX_ACTIVE_CONDITIONS) {
    issues.push({
      path: `modules.${CONDITIONS_MODULE_ID}.active`,
      message: `More than ${MAX_ACTIVE_CONDITIONS} conditions are running at once.`,
    })
  }
  for (const entry of slice.active) {
    if (!conditionFor(entry.conditionId)) {
      issues.push({
        path: `modules.${CONDITIONS_MODULE_ID}.active`,
        message: `Unknown world condition '${entry.conditionId}'.`,
      })
    }
  }
  return issues
}

void SOURCE

export const conditionsModule: SimulationModule = {
  id: CONDITIONS_MODULE_ID,
  version: '0.1.0',
  // Deliberately depends on nothing, and is ordered BEFORE the monthly
  // module in the pipeline. The monthly slice's `currentModifier` is now a
  // projection of whatever is actually running, so this has to have decided
  // that before monthly reads it — a day's lag would mean the rent bump and
  // the arc gates were always reading yesterday's world.
  hooks: {
    startDay: [startDayHook],
    endDay: [endDayHook],
  },
  buildReport,
  validate: validateConditions,
  stateSchema: ConditionsModuleStateSchema,
}

export { CONDITIONS_MODULE_ID, createInitialConditionsModuleState, getConditionsModuleState }
