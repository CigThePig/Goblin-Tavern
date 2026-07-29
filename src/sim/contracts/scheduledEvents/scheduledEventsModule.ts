import type { SimContext } from '../../core/context'
import type { SimulationHook, SimulationModule } from '../../core/module'
import type { ReportSection } from '../../core/reports'
import type { ValidationIssue } from '../../state/types'

import { resolveScheduledEventsForBeat } from './resolve'
import {
  createInitialScheduledEventsModuleState,
  readScheduledEventsSlice,
  writeScheduledEventsSlice,
} from './state'
import {
  SCHEDULED_EVENTS_MODULE_ID,
  ScheduledEventsModuleStateSchema,
} from './types'
import { validateScheduledEventState } from './validation'

// Expansion Phase 1 §1.1 — the module that owns the queue.
//
// Two hooks, one per beat:
//
//   startDay              → clear the day's outcome list, then resolve
//                           `morning` events, so the morning the player
//                           plans in already reflects what came due.
//   resolveScheduledEvents → resolve `wrap_up` events, after the day's
//                           responses have been applied and before
//                           `endDay` tears down per-day slices.
//
// The module does not resolve anything itself: every mechanical event is
// resolved by ITS OWN registered owner (§5.4). This module is the
// scheduler, the exact-once ledger, and the reporter.

const SOURCE = SCHEDULED_EVENTS_MODULE_ID

const startDayHook: SimulationHook = (ctx: SimContext): void => {
  writeScheduledEventsSlice(
    ctx,
    (current) => ({ ...current, resolvedToday: [] }),
    'day_initialize',
  )
  resolveScheduledEventsForBeat(ctx, 'morning')
}

const wrapUpHook: SimulationHook = (ctx: SimContext): void => {
  resolveScheduledEventsForBeat(ctx, 'wrap_up')
}

function validate(ctx: SimContext): ValidationIssue[] {
  return validateScheduledEventState(ctx.state).map((problem) => ({
    path: `modules.${SCHEDULED_EVENTS_MODULE_ID}`,
    message: problem.detail
      ? `${problem.message} (${problem.detail})`
      : problem.message,
    code: `scheduled_events_${problem.code}`,
  }))
}

function buildReport(ctx: SimContext): ReportSection | null {
  const slice = readScheduledEventsSlice(ctx.state)
  const live = slice.queue.filter(
    (r) => r.status === 'scheduled' || r.status === 'warned',
  )
  if (live.length === 0 && slice.resolvedToday.length === 0) return null

  const lines: string[] = []
  if (slice.resolvedToday.length > 0) {
    lines.push('Came due today:')
    for (const outcome of slice.resolvedToday.slice(0, 8)) {
      const suffix =
        outcome.status === 'resolved'
          ? outcome.mutations.map((m) => m.readable).join('; ')
          : (outcome.reason ?? outcome.status)
      lines.push(`  - [${outcome.status}] ${outcome.readable} — ${suffix}`)
    }
  }
  const warned = live.filter((r) => r.status === 'warned')
  if (warned.length > 0) {
    lines.push('Coming, and you know it:')
    for (const record of warned.slice(0, 8)) {
      lines.push(
        `  - day ${record.scheduledForDay}: ${record.origin.readable}`,
      )
    }
  }
  lines.push(
    `Scheduled: ${live.length} (${live.filter((r) => r.kind === 'mechanical').length} mechanical, ` +
      `${live.filter((r) => r.kind === 'narrative_expectation').length} narrative)`,
  )

  return {
    id: 'scheduled_events',
    source: SOURCE,
    title: 'SCHEDULED',
    lines,
    data: {
      live: live.length,
      mechanical: live.filter((r) => r.kind === 'mechanical').length,
      narrative: live.filter((r) => r.kind === 'narrative_expectation').length,
      warned: warned.length,
      resolvedToday: slice.resolvedToday.length,
      totals: slice.totals,
    },
  }
}

export const scheduledEventsModule: SimulationModule = {
  id: SCHEDULED_EVENTS_MODULE_ID,
  version: '0.1.0',
  hooks: {
    startDay: [startDayHook],
    resolveScheduledEvents: [wrapUpHook],
  },
  buildReport,
  validate,
  stateSchema: ScheduledEventsModuleStateSchema,
}

export { createInitialScheduledEventsModuleState }
