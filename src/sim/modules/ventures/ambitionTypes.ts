import type { TavernState } from '../../state/TavernState'

export type VentureRequirement =
  | { kind: 'upgrade'; areaId: string; upgradeId: string; label: string }
  | { kind: 'deliveries'; count: number }
  | { kind: 'relationship'; minimum: number }
  | { kind: 'staff_ready' }
  | { kind: 'culture_comfort'; minimum: number }
  | { kind: 'solvent' }
  | { kind: 'trading' }

export type VentureOption = {
  id: string
  label: string
  minutes: number
  coin: number
  material?: { id: string; quantity: number }
  outcome?: string
}
export type VentureStage = {
  id: string
  label: string
  description: string
  work: number
  requirements: VentureRequirement[]
  options: VentureOption[]
}
export type AmbitionDefinition = {
  summary: string
  unlockDay: number
  participant?: 'supplier' | 'faction' | 'staff' | 'culture'
  stages: VentureStage[]
  outcome: string
  outcomeLabel: string
  benefit: string
  applies?: (state: TavernState) => boolean
}
/** One record per catalogued venture. Work and stall counters never grow collections. */
export type VentureRecord = {
  participantId?: string
  lastWorkedDay?: number
  stageEnteredDay: number
  blockedDays: number
  attempts: number
  outcome?: string
}
export type VentureModuleState = { records: Record<string, VentureRecord> }
