import type { TavernState } from '../state/TavernState'

export type SimulationResult = {
  state: TavernState
  reports: unknown[]
  causes: unknown[]
  stateDiffs: unknown[]
  issueSeeds: unknown[]
  debug: Record<string, unknown>
}
