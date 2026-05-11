import { z } from 'zod'

import type { SimulationHook, SimulationModule } from '../../core/module'
import type { SimContext } from '../../core/context'
import type { ReportSection } from '../../core/reports'
import type { ValidationIssue } from '../../state/types'
import type { CalendarStamp, TavernState } from '../../state/TavernState'

import {
  ensureRequiredFeedbackLoopsRegistered,
  feedbackLoopRegistry,
} from './feedbackLoopRegistry'
import type { FeedbackLoopDefinition } from './feedbackLoopRegistry'
import type {
  FeedbackLoopDetectorResult,
  FeedbackLoopSnapshot,
} from './feedbackLoopTypes'
import { buildFeedbackLoopReport } from './feedbackReport'

// Phase 18 §18.12 — Feedback loop module.
//
// Responsibilities:
//   - Run each registered detector on `closing` (after the pressure
//     module has computed the day's snapshot).
//   - Persist results into `state.modules.feedback`.
//   - Emit a FEEDBACK LOOP REPORT on `generateReports`.

export const FEEDBACK_MODULE_ID = 'feedback'

const SOURCE = FEEDBACK_MODULE_ID

export type FeedbackModuleState = {
  loops: Record<string, FeedbackLoopSnapshot>
  activeLoopIds: string[]
  lastCalculatedDay: number
}

export function createInitialFeedbackModuleState(): FeedbackModuleState {
  return {
    loops: {},
    activeLoopIds: [],
    lastCalculatedDay: -1,
  }
}

export function getFeedbackModuleState(state: {
  modules: Record<string, unknown>
}): FeedbackModuleState {
  const slice = state.modules[FEEDBACK_MODULE_ID] as
    | FeedbackModuleState
    | undefined
  if (!slice) return createInitialFeedbackModuleState()
  return slice
}

function stampFromState(state: TavernState): CalendarStamp {
  return {
    year: state.calendar.year,
    month: state.calendar.month,
    week: state.calendar.week,
    day: state.calendar.day,
    absoluteDay: state.calendar.totalDaysElapsed,
  }
}

function buildSnapshot(
  definition: FeedbackLoopDefinition,
  result: FeedbackLoopDetectorResult,
  stamp: CalendarStamp,
): FeedbackLoopSnapshot {
  return {
    id: definition.id,
    label: definition.label,
    active: result.active,
    strength: Math.max(0, Math.min(100, Math.round(result.strength))),
    speed: result.speed,
    risk: Math.max(0, Math.min(100, Math.round(result.risk))),
    nodes: [...result.nodes],
    evidence: result.evidence.map((e) => ({ ...e, tags: [...e.tags] })),
    readable: result.readable,
    tags: [...(definition.tags ?? []), ...(result.tags ?? [])],
    relatedActors: (result.relatedActors ?? []).map((a) => ({ ...a })),
    relatedLocations: (result.relatedLocations ?? []).map((l) => ({ ...l })),
    relatedSystems: [...(result.relatedSystems ?? [])],
    lastDetected: stamp,
  }
}

function writeSlice(
  ctx: SimContext,
  patch: Partial<FeedbackModuleState>,
  reason: string,
): void {
  ctx.modifyModuleState<FeedbackModuleState>(
    FEEDBACK_MODULE_ID,
    (current) => {
      const base = current ?? createInitialFeedbackModuleState()
      return { ...base, ...patch }
    },
    { source: SOURCE, reason },
  )
}

const detectFeedbackHook: SimulationHook = (ctx: SimContext): void => {
  ensureRequiredFeedbackLoopsRegistered()
  const stamp = stampFromState(ctx.state)
  const nextLoops: Record<string, FeedbackLoopSnapshot> = {}
  const activeIds: string[] = []
  for (const definition of feedbackLoopRegistry.all()) {
    const result = definition.detect(ctx)
    const snapshot = buildSnapshot(definition, result, stamp)
    nextLoops[definition.id] = snapshot
    if (snapshot.active) {
      activeIds.push(definition.id)
      ctx.addHistory({
        category: 'pressure',
        summary: `Feedback loop active: ${definition.label} (strength ${snapshot.strength}, risk ${snapshot.risk}).`,
        tags: ['feedback_loop', definition.id],
        relatedActors: snapshot.relatedActors,
        relatedLocations: snapshot.relatedLocations,
        relatedSystems: snapshot.relatedSystems,
        mechanicalRefs: [`feedback_loop:${definition.id}`],
      })
    }
  }
  writeSlice(
    ctx,
    {
      loops: nextLoops,
      activeLoopIds: activeIds,
      lastCalculatedDay: ctx.state.calendar.totalDaysElapsed,
    },
    'detect_loops',
  )
}

function buildReport(ctx: SimContext): ReportSection {
  return buildFeedbackLoopReport(ctx)
}

function validateFeedback(ctx: SimContext): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const slice = getFeedbackModuleState(ctx.state)
  for (const [id, loop] of Object.entries(slice.loops)) {
    if (loop.strength < 0 || loop.strength > 100) {
      issues.push({
        path: `modules.feedback.loops.${id}.strength`,
        message: `Feedback loop '${id}' strength out of range (${loop.strength})`,
        code: 'feedback_strength_oor',
      })
    }
    if (loop.risk < 0 || loop.risk > 100) {
      issues.push({
        path: `modules.feedback.loops.${id}.risk`,
        message: `Feedback loop '${id}' risk out of range (${loop.risk})`,
        code: 'feedback_risk_oor',
      })
    }
  }
  return issues
}

const EntityRefSchema = z.object({
  kind: z.enum(['staff', 'customer_group', 'area', 'stock', 'role', 'system', 'other']),
  id: z.string(),
})

const FeedbackEvidenceSchema = z.object({
  id: z.string(),
  readable: z.string(),
  weight: z.number(),
  tags: z.array(z.string()),
})

const CalendarStampSchema = z.object({
  year: z.number().int().min(1),
  month: z.number().int().min(1).max(12),
  week: z.number().int().min(1).max(4),
  day: z.number().int().min(1).max(28),
  absoluteDay: z.number().int().min(0),
})

const FeedbackLoopSnapshotSchema = z.object({
  id: z.string(),
  label: z.string(),
  active: z.boolean(),
  strength: z.number().min(0).max(100),
  speed: z.enum(['slow', 'medium', 'fast']),
  risk: z.number().min(0).max(100),
  nodes: z.array(z.string()),
  evidence: z.array(FeedbackEvidenceSchema),
  readable: z.string(),
  tags: z.array(z.string()),
  relatedActors: z.array(EntityRefSchema),
  relatedLocations: z.array(EntityRefSchema),
  relatedSystems: z.array(z.string()),
  lastDetected: CalendarStampSchema,
})

const FeedbackModuleStateSchema = z.object({
  loops: z.record(z.string(), FeedbackLoopSnapshotSchema),
  activeLoopIds: z.array(z.string()),
  lastCalculatedDay: z.number().int(),
})

export const feedbackModule: SimulationModule = {
  id: FEEDBACK_MODULE_ID,
  version: '0.1.0',
  // Feedback loops read pressure snapshots and memories; depend on the
  // pressures and memories modules.
  dependsOn: ['pressures', 'memories'],
  hooks: {
    closing: [detectFeedbackHook],
  },
  buildReport: buildReport,
  validate: validateFeedback,
  stateSchema: FeedbackModuleStateSchema,
}

export {
  ensureRequiredFeedbackLoopsRegistered,
  feedbackLoopRegistry,
}
