import type { z } from 'zod'
import type { SimulationPhase } from './phases'
import type { SimContext } from './context'

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
  // Phase 6 §6.1.1: optional schema for the module's namespaced state at
  // `state.modules[id]`. `validateState` composes these from currently
  // registered modules. Unknown keys with no registered schema are reported
  // as warnings, not failures.
  stateSchema?: z.ZodType<unknown>
}
