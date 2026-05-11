import { z } from 'zod'

import type { SimulationHook, SimulationModule } from '../../core/module'
import type { SimContext } from '../../core/context'
import type { ReportSection } from '../../core/reports'
import type { ValidationIssue } from '../../state/types'
import type { MemoryState } from '../../state/TavernState'

import {
  ensureRequiredMemoriesRegistered,
  memoryRegistry,
} from './memoryRegistry'
import { detectPatterns } from './patternDetection'
import { buildMemoryReport } from './memoryReport'

// Phase 16 — Memory module.
//
// Responsibilities:
//   - Register the canonical memory definitions on module load.
//   - Reset the per-day tracking slice on `startDay`.
//   - Age memories and prune expired ones on `endDay`.
//   - Detect patterns on `endWeek` and add the resulting memories.
//   - Emit the MEMORY REPORT on `generateReports`.
//   - Validate that on-state memories carry the required Phase 16 fields.

export const MEMORIES_MODULE_ID = 'memories'

// Per-day tracking slice stored under `state.modules.memories`. The
// slice records which memory ids were *added* today and which expired
// today so the memory report does not have to diff against yesterday.
// Pattern detection also stamps its most recent run here so future
// callers can introspect when it last ran.
export type MemoryModuleState = {
  newToday: string[]
  expiredToday: string[]
  /** Absolute day stamp of the most recent pattern-detection run. */
  lastPatternRunDay: number
}

export function createInitialMemoryModuleState(): MemoryModuleState {
  return {
    newToday: [],
    expiredToday: [],
    lastPatternRunDay: -1,
  }
}

export function getMemoryModuleState(state: {
  modules: Record<string, unknown>
}): MemoryModuleState {
  const slice = state.modules[MEMORIES_MODULE_ID] as
    | MemoryModuleState
    | undefined
  if (!slice) return createInitialMemoryModuleState()
  return slice
}

const SOURCE = MEMORIES_MODULE_ID

function writeSlice(
  ctx: SimContext,
  patch: Partial<MemoryModuleState>,
  reason: string,
): void {
  ctx.modifyModuleState<MemoryModuleState>(
    MEMORIES_MODULE_ID,
    (current) => {
      const base = current ?? createInitialMemoryModuleState()
      return { ...base, ...patch }
    },
    { source: SOURCE, reason },
  )
}

// ---------- Hooks ----------

const startDayHook: SimulationHook = (ctx: SimContext): void => {
  ensureRequiredMemoriesRegistered()
  writeSlice(
    ctx,
    {
      newToday: [],
      expiredToday: [],
    },
    'day_initialize',
  )
}

const endDayHook: SimulationHook = (ctx: SimContext): void => {
  // Aging happens via the context API on the engine — the engine owns
  // the aging step so it can route the resulting state replacement
  // through `modifyModuleState` and record the expired ids. Trigger it
  // here by calling the engine-installed helper exposed on ctx.
  ctx.ageMemoriesEndOfDay()
}

const endWeekHook: SimulationHook = (ctx: SimContext): void => {
  const drafts = detectPatterns(ctx.state)
  for (const draft of drafts) {
    ctx.addMemory(draft)
  }
  writeSlice(
    ctx,
    { lastPatternRunDay: ctx.state.calendar.totalDaysElapsed },
    'pattern_detection',
  )
}

function buildReport(ctx: SimContext): ReportSection | null {
  const slice = getMemoryModuleState(ctx.state)
  const newToday: MemoryState[] = []
  for (const id of slice.newToday) {
    const found = ctx.state.memories.find((m) => m.id === id)
    if (found) newToday.push(found)
  }
  // Expired memories are no longer present in state.memories, but the
  // module slice can still surface their ids for the report so callers
  // see that they decayed today.
  const expiredToday: MemoryState[] = []
  // The slice only tracks ids. Render them with a synthetic record so
  // the report stays readable even after the memory has been pruned.
  for (const id of slice.expiredToday) {
    expiredToday.push({
      id,
      type: 'timed',
      strength: 0,
      ageDays: 0,
      createdAt: {
        year: ctx.state.calendar.year,
        month: ctx.state.calendar.month,
        week: ctx.state.calendar.week,
        day: ctx.state.calendar.day,
        absoluteDay: ctx.state.calendar.totalDaysElapsed,
      },
      actors: [],
      locations: [],
      relatedSystems: [],
      tags: [],
    })
  }
  return buildMemoryReport({
    state: ctx.state,
    newToday,
    expiredToday,
  })
}

// ---------- Validation ----------

function validateMemories(ctx: SimContext): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  for (let i = 0; i < ctx.state.memories.length; i += 1) {
    const memory = ctx.state.memories[i]!
    if (memory.strength < 0 || memory.strength > 100) {
      issues.push({
        path: `memories[${i}].strength`,
        message: `Memory '${memory.id}' has out-of-range strength ${memory.strength}`,
        code: 'memory_strength_oor',
      })
    }
    if (memory.ageDays < 0) {
      issues.push({
        path: `memories[${i}].ageDays`,
        message: `Memory '${memory.id}' has negative age`,
        code: 'memory_negative_age',
      })
    }
  }
  return issues
}

// ---------- Schema ----------

const MemoryModuleStateSchema = z.object({
  newToday: z.array(z.string()),
  expiredToday: z.array(z.string()),
  lastPatternRunDay: z.number().int(),
})

export const memoriesModule: SimulationModule = {
  id: MEMORIES_MODULE_ID,
  version: '0.1.0',
  hooks: {
    startDay: [startDayHook],
    endDay: [endDayHook],
    endWeek: [endWeekHook],
  },
  buildReport: buildReport,
  validate: validateMemories,
  stateSchema: MemoryModuleStateSchema,
}

export { ensureRequiredMemoriesRegistered, memoryRegistry }
