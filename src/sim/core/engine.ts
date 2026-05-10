import { advanceCalendar, isEndOfMonth, isEndOfWeek } from '../modules/calendar/index'
import { cloneTavernState } from '../state/defaults'
import { safeValidateState } from '../state/validation'
import type { TavernState, AreaState, StockState, StaffState, CustomerGroupState } from '../state/TavernState'
import type { ValidationIssue, ValidationSummary } from '../state/types'

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
