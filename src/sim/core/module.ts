import type { z } from 'zod'
import type { SimulationPhase } from './phases'
import type { SimContext } from './context'
import type { ReportSection } from './reports'
import type { ValidationIssue } from '../state/types'

// Phase 7 §7.2 — Simulation module contract.
//
// This extends the Phase 2 placeholder with optional `buildReport` and
// `validate` members. The existing fields (`id`, `version`, `dependsOn`,
// `hooks`) are intentionally unchanged: hooks remain `SimulationHook[]` per
// phase so multiple hooks per module per phase compose cleanly.

export type SimulationHook = (ctx: SimContext) => void

export type RegistrationContext = {
  // Phase 2 keeps this minimal. Later phases will expose specific registry helpers
  // (areas, stock, customers, staff, actions, reputation, pressures, issue seeds).
}

export type SimulationModule = {
  id: string
  version: string
  dependsOn?: string[]
  hooks?: Partial<Record<SimulationPhase, SimulationHook[]>>
  register?: (ctx: RegistrationContext) => void

  // Phase 6 §6.1.1 — optional schema for the module's namespaced state at
  // `state.modules[id]`. `validateState` composes these from currently
  // registered modules. Unknown keys with no registered schema are reported
  // as warnings, not failures.
  stateSchema?: z.ZodType<unknown>

  // Phase 7 §7.2 — Optional report builder. Called during the
  // `generateReports` phase. May return one section, many sections, or null
  // when the module has nothing to say for the current day.
  buildReport?: (ctx: SimContext) => ReportSection | ReportSection[] | null

  // Phase 7 §7.2 — Optional module-level validator. Called during the
  // `validate` phase, in addition to (not instead of) the full state schema
  // run by `ctx.validate()`. Returned issues are merged into
  // `SimResult.validation`.
  validate?: (ctx: SimContext) => ValidationIssue[]
}

// Phase 7 §7.2 alias — the doc uses `SimHook` and `SimModule` in places.
// Same shape; alias only.
export type SimHook = SimulationHook
export type SimModule = SimulationModule
