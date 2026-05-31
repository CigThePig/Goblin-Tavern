// Phase 186 / Day-Clock Cluster 6 — Report-as-unfolding.
//
// Section composer for the daily report's day-arc movement connective
// lines. One slot, narrator-voiced, register `tavern_floor`. Keys
// deterministically off (closedDayOrdinal, movementId) so the same
// movement on the same closed day reads the same line across rebuilds.

import type { TavernState } from '../../../sim/state/TavernState'
import {
  buildReportSeed,
  type ReportSection,
} from '../../../cards/compose/reports'
import { assembleSlots } from '../../../cards/compose/assemble'
import type { SlotSpec } from '../../../cards/compose/types'
import { dayArcLinePool } from '../pools/dayArc'

const DAY_ARC_BUDGET = 8

export type DayArcMovementId = 'opening' | 'service' | 'reckoning'

export const dayArcSlots: readonly SlotSpec[] = [
  {
    id: 'line',
    role: 'aside',
    pool: dayArcLinePool,
    optional: true,
    wordBudget: DAY_ARC_BUDGET,
    claimMode: 'flavor',
  },
]

export const dayArcSection: ReportSection = {
  id: 'daily.arc',
  voiceRegister: 'tavern_floor',
  slots: dayArcSlots,
}

export type DayArcLineInput = {
  state: TavernState
  closedDayOrdinal: number
  movementId: DayArcMovementId
}

export function composeDayArcLine(input: DayArcLineInput): string | undefined {
  const seed = buildReportSeed({
    sectionId: 'daily.arc',
    periodKey: `d${input.closedDayOrdinal}.${input.movementId}`,
    timing: 'closing',
    domain: [input.movementId],
  })
  const filled = assembleSlots(dayArcSlots, seed, input.state)
  return filled['line']
}
