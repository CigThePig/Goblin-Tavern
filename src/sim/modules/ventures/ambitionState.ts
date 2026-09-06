import { z } from 'zod'
import type { SimContext } from '../../core/context'
import type { TavernState } from '../../state/TavernState'
import type { VentureModuleState, VentureRecord } from './ambitionTypes'

export const VentureModuleStateSchema = z.object({
  records: z.record(z.string(), z.object({
    participantId: z.string().optional(), lastWorkedDay: z.number().int().min(0).optional(),
    stageEnteredDay: z.number().int().min(0), blockedDays: z.number().int().min(0),
    attempts: z.number().int().min(1), outcome: z.string().optional(),
  })),
}).optional()

export function getVentureState(state: Pick<TavernState, 'modules'>): VentureModuleState {
  return (state.modules.ventures as VentureModuleState | undefined) ?? { records: {} }
}
export function ventureRecord(state: TavernState, id: string): VentureRecord {
  return getVentureState(state).records[id] ?? {
    stageEnteredDay: state.ventures[id]?.updatedAtDay ?? state.calendar.totalDaysElapsed,
    blockedDays: 0, attempts: 1,
  }
}
export function writeVentureRecord(ctx: SimContext, id: string, patch: Partial<VentureRecord>): void {
  const value = { ...ventureRecord(ctx.state, id), ...patch }
  ctx.modifyModuleState<VentureModuleState>('ventures', current => ({
    records: { ...(current?.records ?? {}), [id]: value },
  }), { source: 'ventures', reason: 'venture_evidence' })
}
