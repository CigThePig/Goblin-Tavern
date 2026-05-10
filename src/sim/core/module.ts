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
}
