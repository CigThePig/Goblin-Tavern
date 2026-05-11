import { z } from 'zod'

import type { SimulationHook, SimulationModule } from '../../core/module'
import type { SimContext } from '../../core/context'
import type { ReportSection } from '../../core/reports'
import type { ValidationIssue } from '../../state/types'

import { ensureRequiredCausesRegistered, causeRegistry } from './causeRegistry'
import { buildCauseReport } from './causeReport'

// Phase 17 — Cause-tracking module.
//
// Responsibilities:
//   - Ensure the canonical cause-template registry is loaded on module
//     load (`ensureRequiredCausesRegistered`).
//   - Reset the per-day tracking slice on `startDay`.
//   - Age and prune causes on `endDay` (via `ctx.ageCausesEndOfDay()`).
//   - Emit the CAUSE REPORT on `generateReports`.
//   - Validate that on-state causes carry the required Phase 17 fields
//     (non-negative weight, valid ageDays).

export const CAUSES_MODULE_ID = 'causes'
const SOURCE = CAUSES_MODULE_ID

// Per-day tracking slice. `newTodayIds` mirrors the memory module's
// pattern: it lets the report find newly added causes without a diff
// against the previous day's array.
export type CauseModuleState = {
  newTodayIds: string[]
  expiredTodayIds: string[]
  lastSweepAbsoluteDay: number
}

export function createInitialCauseModuleState(): CauseModuleState {
  return {
    newTodayIds: [],
    expiredTodayIds: [],
    lastSweepAbsoluteDay: -1,
  }
}

export function getCauseModuleState(state: {
  modules: Record<string, unknown>
}): CauseModuleState {
  const slice = state.modules[CAUSES_MODULE_ID] as
    | CauseModuleState
    | undefined
  if (!slice) return createInitialCauseModuleState()
  return slice
}

function writeSlice(
  ctx: SimContext,
  patch: Partial<CauseModuleState>,
  reason: string,
): void {
  ctx.modifyModuleState<CauseModuleState>(
    CAUSES_MODULE_ID,
    (current) => {
      const base = current ?? createInitialCauseModuleState()
      return { ...base, ...patch }
    },
    { source: SOURCE, reason },
  )
}

const startDayHook: SimulationHook = (ctx: SimContext): void => {
  ensureRequiredCausesRegistered()
  writeSlice(
    ctx,
    {
      newTodayIds: [],
      expiredTodayIds: [],
    },
    'day_initialize',
  )
}

const endDayHook: SimulationHook = (ctx: SimContext): void => {
  // Capture the ids that exist *before* aging so the diff produces the
  // expired list.
  const beforeIds = new Set(ctx.state.causes.map((c) => c.id))
  ctx.ageCausesEndOfDay()
  const afterIds = new Set(ctx.state.causes.map((c) => c.id))
  const expired: string[] = []
  for (const id of beforeIds) {
    if (!afterIds.has(id)) expired.push(id)
  }
  writeSlice(
    ctx,
    {
      expiredTodayIds: expired,
      lastSweepAbsoluteDay: ctx.state.calendar.totalDaysElapsed,
    },
    'age_causes',
  )
}

function buildReport(ctx: SimContext): ReportSection {
  return buildCauseReport(ctx)
}

function validateCauses(ctx: SimContext): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  for (let i = 0; i < ctx.state.causes.length; i += 1) {
    const cause = ctx.state.causes[i]!
    if (cause.weight < 0) {
      issues.push({
        path: `causes[${i}].weight`,
        message: `Cause '${cause.id}' has negative weight ${cause.weight}`,
        code: 'cause_negative_weight',
      })
    }
    if (cause.ageDays < 0) {
      issues.push({
        path: `causes[${i}].ageDays`,
        message: `Cause '${cause.id}' has negative ageDays`,
        code: 'cause_negative_age',
      })
    }
  }
  return issues
}

const CauseModuleStateSchema = z.object({
  newTodayIds: z.array(z.string()),
  expiredTodayIds: z.array(z.string()),
  lastSweepAbsoluteDay: z.number().int(),
})

export const causesModule: SimulationModule = {
  id: CAUSES_MODULE_ID,
  version: '0.1.0',
  hooks: {
    startDay: [startDayHook],
    endDay: [endDayHook],
  },
  buildReport: buildReport,
  validate: validateCauses,
  stateSchema: CauseModuleStateSchema,
}

export { causeRegistry, ensureRequiredCausesRegistered }
