import { advanceCalendar, isEndOfMonth, isEndOfWeek } from '../modules/calendar/index'
import { cloneTavernState } from '../state/defaults'
import { safeValidateState } from '../state/validation'
import type {
  AreaState,
  CustomerGroupState,
  EntityRef,
  HistoryEntry,
  MemoryState,
  ReputationState,
  StaffState,
  StockState,
  TavernState,
} from '../state/TavernState'
import type { ValidationIssue, ValidationSummary } from '../state/types'
import {
  MEMORIES_MODULE_ID,
  createInitialMemoryModuleState,
  memoryRegistry,
  ageMemories,
  bumpStrength,
  stampFromCalendar,
} from '../modules/memories/index'
import type {
  MemoryModuleState,
} from '../modules/memories/memoryModule'
import type { MemoryDraft, MemoryDefinition } from '../modules/memories/memoryTypes'
import type { HistoryEntryDraft } from '../modules/history/types'

import { createRng } from './rng'
import type {
  AddLogInput,
  MutationMeta,
  SimContext,
  SimInput,
} from './context'
import { SIMULATION_PHASES, type SimulationPhase } from './phases'
import type { ReportSection, SimLog, SimLogLevel } from './reports'
import type { SimulationModule } from './module'
import type { SimResult } from './result'

// Phase 7 §7.4 / §7.5 — Engine entry point and module ordering.
//
// `simulateDay` runs the canonical pipeline (`SIMULATION_PHASES`) once.
// Modules supply hooks per phase; the engine sorts them by `dependsOn` and
// then iterates each phase, running every dependency-ordered hook.
// Validation, calendar advancement, and report collection are built in.

const ENGINE_SOURCE = 'engine'

// Phase 16 §16.2 — Helpers for memory draft → memory state assembly.
function mergeTags(
  draftTags: ReadonlyArray<string> | undefined,
  defTags: ReadonlyArray<string> | undefined,
): string[] {
  const out: string[] = []
  for (const tag of defTags ?? []) {
    if (!out.includes(tag)) out.push(tag)
  }
  for (const tag of draftTags ?? []) {
    if (!out.includes(tag)) out.push(tag)
  }
  return out
}

function mergeStrings(
  a: ReadonlyArray<string> | undefined,
  b: ReadonlyArray<string> | undefined,
): string[] {
  const out: string[] = []
  for (const s of a ?? []) if (!out.includes(s)) out.push(s)
  for (const s of b ?? []) if (!out.includes(s)) out.push(s)
  return out
}

function projectExpiry(
  stamp: { year: number; month: number; week: number; day: number; absoluteDay: number },
  durationDays: number,
): typeof stamp {
  // Project an expiry stamp `durationDays` ahead. The calendar wraps
  // at 28 days per month / 12 months per year (Phase 3); replicate the
  // arithmetic here so the projected stamp stays JSON-safe.
  const totalDays = stamp.absoluteDay + durationDays
  // We do not have access to the engine's calendar helpers without a
  // circular import, so synthesize an approximate stamp directly. The
  // values are advisory — `ageDays >= durationDays` is the canonical
  // expiration check; `expiresAt` is for debug/report inspection.
  let dayOfMonth = stamp.day + durationDays
  let month = stamp.month
  let year = stamp.year
  while (dayOfMonth > 28) {
    dayOfMonth -= 28
    month += 1
    if (month > 12) {
      month = 1
      year += 1
    }
  }
  const week = Math.floor((dayOfMonth - 1) / 7) + 1
  return {
    year,
    month,
    week,
    day: dayOfMonth,
    absoluteDay: totalDays,
  }
}

function countByDefinition(
  memories: ReadonlyArray<MemoryState>,
  defId: string,
): number {
  let count = 0
  for (const m of memories) {
    if (m.definitionId === defId || m.id === defId || m.id.startsWith(`${defId}__`)) {
      count += 1
    }
  }
  return count
}

function topologicallySortModules(
  modules: ReadonlyArray<SimulationModule>,
): SimulationModule[] {
  const byId = new Map<string, SimulationModule>()
  for (const mod of modules) {
    if (byId.has(mod.id)) {
      throw new Error(`simulateDay: duplicate module id '${mod.id}'`)
    }
    byId.set(mod.id, mod)
  }

  // Validate declared dependencies exist.
  for (const mod of modules) {
    for (const depId of mod.dependsOn ?? []) {
      if (!byId.has(depId)) {
        throw new Error(
          `simulateDay: module '${mod.id}' declares missing dependency '${depId}'`,
        )
      }
    }
  }

  const sorted: SimulationModule[] = []
  const tempMark = new Set<string>()
  const permMark = new Set<string>()
  const stack: string[] = []

  const visit = (id: string): void => {
    if (permMark.has(id)) return
    if (tempMark.has(id)) {
      const cycleStart = stack.indexOf(id)
      const cyclePath = [...stack.slice(cycleStart), id].join(' -> ')
      throw new Error(`simulateDay: cyclic module dependency detected: ${cyclePath}`)
    }
    const mod = byId.get(id)
    if (!mod) return
    tempMark.add(id)
    stack.push(id)
    for (const depId of mod.dependsOn ?? []) {
      visit(depId)
    }
    stack.pop()
    tempMark.delete(id)
    permMark.add(id)
    sorted.push(mod)
  }

  for (const mod of modules) {
    visit(mod.id)
  }

  return sorted
}

function normalizeLog(input: AddLogInput, fallbackSource: string): SimLog {
  if (typeof input === 'string') {
    return { source: fallbackSource, level: 'info', message: input }
  }
  if ('source' in input && typeof input.source === 'string' && 'level' in input) {
    return input
  }
  const level: SimLogLevel = (input as { level?: SimLogLevel }).level ?? 'info'
  return {
    source: fallbackSource,
    level,
    message: input.message,
    ...(input.data !== undefined ? { data: input.data } : {}),
  }
}

type EngineRuntime = {
  current: TavernState
  reports: ReportSection[]
  logs: SimLog[]
  hookSource: string
  validationErrors: ValidationIssue[]
  validationWarnings: ValidationIssue[]
}

function createContext(
  runtime: EngineRuntime,
  input: SimInput,
  modules: ReadonlyArray<SimulationModule>,
): SimContext {
  const rng = createRng(input.seed)

  const requireRecord = <T>(record: Record<string, T>, id: string, kind: string): T => {
    const value = record[id]
    if (value === undefined) {
      throw new Error(`ctx.modify${kind}: unknown ${kind.toLowerCase()} id '${id}'`)
    }
    return value
  }

  // ---------- Phase 16 §16.2 — memory helpers ----------

  const findMemoryIndex = (id: string): number => {
    return runtime.current.memories.findIndex((m) => m.id === id)
  }

  const updateMemoryModuleState = (
    updater: (current: MemoryModuleState) => MemoryModuleState,
    reason: string,
  ): void => {
    runtime.current = {
      ...runtime.current,
      modules: {
        ...runtime.current.modules,
        [MEMORIES_MODULE_ID]: updater(
          (runtime.current.modules[MEMORIES_MODULE_ID] as
            | MemoryModuleState
            | undefined) ?? createInitialMemoryModuleState(),
        ),
      },
    }
    void reason
  }

  const writeMemories = (next: MemoryState[]): void => {
    runtime.current = { ...runtime.current, memories: next }
  }

  const recordNew = (id: string): void => {
    updateMemoryModuleState((current) => {
      if (current.newToday.includes(id)) return current
      return { ...current, newToday: [...current.newToday, id] }
    }, 'memory_added')
  }

  const recordExpired = (ids: ReadonlyArray<string>): void => {
    if (ids.length === 0) return
    updateMemoryModuleState((current) => {
      const merged = [...current.expiredToday]
      for (const id of ids) {
        if (!merged.includes(id)) merged.push(id)
      }
      return { ...current, expiredToday: merged }
    }, 'memory_expired')
  }

  const buildMemoryFromDraft = (
    draft: MemoryDraft,
    definition: MemoryDefinition | undefined,
    instanceId: string,
  ): MemoryState => {
    const type = draft.type ?? definition?.type ?? 'timed'
    const strength = draft.strength ?? definition?.defaultStrength ?? 50
    const durationDays =
      draft.durationDays ?? definition?.defaultDurationDays
    const decayRate = draft.decayRate ?? definition?.defaultDecayRate
    const tags = mergeTags(draft.tags, definition?.tags)
    const relatedSystems = mergeStrings(
      draft.relatedSystems,
      definition?.relatedSystems,
    )
    const stamp = stampFromCalendar(runtime.current.calendar)
    const memory: MemoryState = {
      id: instanceId,
      type,
      strength,
      ageDays: 0,
      createdAt: stamp,
      actors: draft.actors ? draft.actors.map((a) => ({ ...a })) : [],
      locations: draft.locations
        ? draft.locations.map((l) => ({ ...l }))
        : [],
      relatedSystems,
      tags,
    }
    if (definition?.id !== undefined) memory.definitionId = definition.id
    else memory.definitionId = draft.id
    if (definition?.label !== undefined) memory.label = definition.label
    if (draft.label !== undefined) memory.label = draft.label
    if (durationDays !== undefined) {
      memory.durationDays = durationDays
      memory.expiresAt = projectExpiry(stamp, durationDays)
    }
    if (decayRate !== undefined) memory.decayRate = decayRate
    if (draft.source !== undefined) memory.source = draft.source
    if (draft.metadata !== undefined) memory.metadata = { ...draft.metadata }
    return memory
  }

  const addMemoryInternal = (draft: MemoryDraft): MemoryState => {
    const def = memoryRegistry.has(draft.id)
      ? memoryRegistry.get(draft.id)
      : undefined
    const stacking = def?.stacking ?? 'replace'
    const existingIdx = findMemoryIndex(draft.id)

    // Stack strategy: keep all instances around with unique state ids
    // (definitionId stays equal to the registry id so queries can find
    // the whole group).
    if (stacking === 'stack') {
      const memories = [...runtime.current.memories]
      const counter = countByDefinition(memories, draft.id) + 1
      const instanceId = `${draft.id}__${counter}`
      const built = buildMemoryFromDraft(draft, def, instanceId)
      memories.push(built)
      writeMemories(memories)
      recordNew(instanceId)
      return built
    }

    if (existingIdx === -1) {
      const built = buildMemoryFromDraft(draft, def, draft.id)
      writeMemories([...runtime.current.memories, built])
      recordNew(built.id)
      return built
    }

    const existing = runtime.current.memories[existingIdx]!

    if (stacking === 'replace') {
      const built = buildMemoryFromDraft(draft, def, draft.id)
      const memories = [...runtime.current.memories]
      memories[existingIdx] = built
      writeMemories(memories)
      recordNew(built.id)
      return built
    }

    if (stacking === 'refresh') {
      const stamp = stampFromCalendar(runtime.current.calendar)
      const durationDays =
        draft.durationDays ??
        existing.durationDays ??
        def?.defaultDurationDays
      const refreshed: MemoryState = {
        ...existing,
        ageDays: 0,
        createdAt: stamp,
      }
      if (durationDays !== undefined) {
        refreshed.durationDays = durationDays
        refreshed.expiresAt = projectExpiry(stamp, durationDays)
      }
      // A refresh may also lift the strength back to the default.
      if (draft.strength !== undefined) {
        refreshed.strength = draft.strength
      } else if (def?.defaultStrength !== undefined) {
        refreshed.strength = bumpStrength(existing.strength, 0) // no-op floor/ceil
        if (refreshed.strength < def.defaultStrength) {
          refreshed.strength = def.defaultStrength
        }
      }
      const memories = [...runtime.current.memories]
      memories[existingIdx] = refreshed
      writeMemories(memories)
      recordNew(refreshed.id)
      return refreshed
    }

    // increase_strength
    const stamp = stampFromCalendar(runtime.current.calendar)
    const bump =
      draft.strength ?? def?.defaultStrength ?? 25
    const nextStrength = bumpStrength(existing.strength, bump)
    const durationDays =
      draft.durationDays ??
      existing.durationDays ??
      def?.defaultDurationDays
    const updated: MemoryState = {
      ...existing,
      strength: nextStrength,
      ageDays: 0,
      createdAt: stamp,
    }
    if (durationDays !== undefined) {
      updated.durationDays = durationDays
      updated.expiresAt = projectExpiry(stamp, durationDays)
    }
    const memories = [...runtime.current.memories]
    memories[existingIdx] = updated
    writeMemories(memories)
    recordNew(updated.id)
    return updated
  }

  // ---------- Phase 16 §16.8 — history helpers ----------

  let historyCounter = 0

  const addHistoryInternal = (draft: HistoryEntryDraft): HistoryEntry => {
    const stamp = stampFromCalendar(runtime.current.calendar)
    historyCounter += 1
    const id =
      draft.id ??
      `h-${stamp.absoluteDay}-${historyCounter}`
    const entry: HistoryEntry = {
      id,
      timestamp: stamp,
      category: draft.category,
      summary: draft.summary,
      tags: draft.tags ? [...draft.tags] : [],
      relatedActors: draft.relatedActors
        ? draft.relatedActors.map((a) => ({ ...a }))
        : [],
      relatedLocations: draft.relatedLocations
        ? draft.relatedLocations.map((l) => ({ ...l }))
        : [],
      relatedSystems: draft.relatedSystems ? [...draft.relatedSystems] : [],
    }
    if (draft.mechanicalRefs && draft.mechanicalRefs.length > 0) {
      entry.mechanicalRefs = [...draft.mechanicalRefs]
    }
    runtime.current = {
      ...runtime.current,
      history: [...runtime.current.history, entry],
    }
    return entry
  }

  const ctx: SimContext = {
    get state() {
      return runtime.current
    },
    input,
    rng,
    get reports() {
      return runtime.reports
    },
    get logs() {
      return runtime.logs
    },
    addReportSection(section: ReportSection): void {
      runtime.reports.push(section)
    },
    addLog(log, source): void {
      runtime.logs.push(normalizeLog(log, source ?? runtime.hookSource))
    },
    getDayType() {
      return runtime.current.calendar.dayType
    },
    isEndOfWeek() {
      return isEndOfWeek(runtime.current.calendar)
    },
    isEndOfMonth() {
      return isEndOfMonth(runtime.current.calendar)
    },
    validate(): ValidationSummary {
      const result = safeValidateState(runtime.current, { modules })
      if (result.success) {
        return { errors: [], warnings: result.warnings }
      }
      return { errors: result.errors, warnings: result.warnings }
    },
    modifyArea(id, changes, _meta): void {
      const area = requireRecord<AreaState>(runtime.current.areas, id, 'Area')
      runtime.current = {
        ...runtime.current,
        areas: {
          ...runtime.current.areas,
          [id]: { ...area, ...changes },
        },
      }
    },
    modifyStock(id, changes, _meta): void {
      const item = requireRecord<StockState>(runtime.current.stock, id, 'Stock')
      runtime.current = {
        ...runtime.current,
        stock: {
          ...runtime.current.stock,
          [id]: { ...item, ...changes },
        },
      }
    },
    modifyStaff(id, changes, _meta): void {
      const member = requireRecord<StaffState>(runtime.current.staff, id, 'Staff')
      runtime.current = {
        ...runtime.current,
        staff: {
          ...runtime.current.staff,
          [id]: { ...member, ...changes },
        },
      }
    },
    modifyCustomerGroup(id, changes, _meta): void {
      const group = requireRecord<CustomerGroupState>(
        runtime.current.customerGroups,
        id,
        'CustomerGroup',
      )
      runtime.current = {
        ...runtime.current,
        customerGroups: {
          ...runtime.current.customerGroups,
          [id]: { ...group, ...changes },
        },
      }
    },
    modifyCoin(delta, _meta): void {
      if (!Number.isFinite(delta)) {
        throw new Error(`ctx.modifyCoin: delta must be a finite number, got ${delta}`)
      }
      runtime.current = {
        ...runtime.current,
        coin: runtime.current.coin + delta,
      }
    },
    modifyReputation(next: ReputationState, _meta): void {
      runtime.current = {
        ...runtime.current,
        reputation: { ...next },
      }
    },
    modifyModuleState(moduleId, updater, _meta): void {
      const current = runtime.current.modules[moduleId]
      const next = updater(current as never)
      runtime.current = {
        ...runtime.current,
        modules: {
          ...runtime.current.modules,
          [moduleId]: next,
        },
      }
    },

    // Phase 16 §16.2 — Memory context API.
    addMemory(draft): MemoryState {
      return addMemoryInternal(draft)
    },
    removeMemory(id): boolean {
      const idx = findMemoryIndex(id)
      if (idx === -1) return false
      const memories = [...runtime.current.memories]
      memories.splice(idx, 1)
      writeMemories(memories)
      return true
    },
    hasMemory(id): boolean {
      return findMemoryIndex(id) !== -1
    },
    getMemory(id): MemoryState | undefined {
      const idx = findMemoryIndex(id)
      if (idx === -1) return undefined
      return runtime.current.memories[idx]
    },
    getMemoriesByTag(tag): MemoryState[] {
      return runtime.current.memories.filter((m) => m.tags.includes(tag))
    },
    getMemoriesForActor(actor: EntityRef): MemoryState[] {
      return runtime.current.memories.filter((m) =>
        m.actors.some((a) => a.kind === actor.kind && a.id === actor.id),
      )
    },
    getMemoriesForLocation(location: EntityRef): MemoryState[] {
      return runtime.current.memories.filter((m) =>
        m.locations.some((l) => l.kind === location.kind && l.id === location.id),
      )
    },
    getMemoryStrength(id): number {
      const idx = findMemoryIndex(id)
      if (idx === -1) return 0
      return runtime.current.memories[idx]!.strength
    },
    ageMemoriesEndOfDay(): void {
      const { next, expired } = ageMemories(runtime.current.memories, 1)
      writeMemories(next)
      if (expired.length > 0) {
        recordExpired(expired.map((m) => m.id))
      }
    },

    // Phase 16 §16.8 — History context API.
    addHistory(draft): HistoryEntry {
      return addHistoryInternal(draft)
    },
    getRecentHistory(days): HistoryEntry[] {
      if (days <= 0) return []
      const cutoff = runtime.current.calendar.totalDaysElapsed - days
      return runtime.current.history.filter(
        (e) => e.timestamp.absoluteDay >= cutoff,
      )
    },
    getHistoryByTag(tag): HistoryEntry[] {
      return runtime.current.history.filter((e) => e.tags.includes(tag))
    },
  }

  // The mutation helpers do not yet wire a real cause draft (Phase 17),
  // but `meta` is intentionally part of the signature so callers cannot
  // bypass the contract. Reference the parameter so unused-arg lint stays
  // quiet in strict configurations.
  void ctx
  return ctx
}

function runHooks(
  phase: SimulationPhase,
  modules: ReadonlyArray<SimulationModule>,
  ctx: SimContext,
  runtime: EngineRuntime,
): void {
  for (const mod of modules) {
    const hooks = mod.hooks?.[phase]
    if (!hooks || hooks.length === 0) continue
    runtime.hookSource = mod.id
    for (const hook of hooks) {
      hook(ctx)
    }
  }
  runtime.hookSource = ENGINE_SOURCE
}

function collectReports(
  modules: ReadonlyArray<SimulationModule>,
  ctx: SimContext,
  runtime: EngineRuntime,
): void {
  for (const mod of modules) {
    if (!mod.buildReport) continue
    const result = mod.buildReport(ctx)
    if (result === null || result === undefined) continue
    if (Array.isArray(result)) {
      for (const section of result) {
        runtime.reports.push(section)
      }
    } else {
      runtime.reports.push(result)
    }
  }
}

function collectModuleValidations(
  modules: ReadonlyArray<SimulationModule>,
  ctx: SimContext,
  runtime: EngineRuntime,
): void {
  for (const mod of modules) {
    if (!mod.validate) continue
    const issues = mod.validate(ctx)
    for (const issue of issues) {
      runtime.validationErrors.push(issue)
    }
  }
}

export function simulateDay(
  state: TavernState,
  input: SimInput,
  modules: ReadonlyArray<SimulationModule>,
): SimResult {
  const sortedModules = topologicallySortModules(modules)

  const runtime: EngineRuntime = {
    current: cloneTavernState(state),
    reports: [],
    logs: [],
    hookSource: ENGINE_SOURCE,
    validationErrors: [],
    validationWarnings: [],
  }

  const ctx = createContext(runtime, input, sortedModules)

  for (const phase of SIMULATION_PHASES) {
    if (phase === 'endWeek' && !isEndOfWeek(runtime.current.calendar)) {
      continue
    }
    if (phase === 'endMonth' && !isEndOfMonth(runtime.current.calendar)) {
      continue
    }

    if (phase === 'generateReports') {
      collectReports(sortedModules, ctx, runtime)
    }

    runHooks(phase, sortedModules, ctx, runtime)

    if (phase === 'validate') {
      collectModuleValidations(sortedModules, ctx, runtime)
      const summary = ctx.validate()
      for (const e of summary.errors) runtime.validationErrors.push(e)
      for (const w of summary.warnings) runtime.validationWarnings.push(w)
    }

    if (phase === 'advanceCalendar') {
      runtime.current = {
        ...runtime.current,
        calendar: advanceCalendar(runtime.current.calendar),
      }
    }
  }

  return {
    state: runtime.current,
    reports: runtime.reports,
    logs: runtime.logs,
    validation: {
      errors: runtime.validationErrors,
      warnings: runtime.validationWarnings,
    },
  }
}

// Phase 2 placeholder name kept around for any callers that imported it
// directly. `simulateDay` is the canonical Phase 7 entry point.
export function runSimulation(): SimResult {
  throw new Error('runSimulation is deprecated; use simulateDay (Phase 7).')
}
