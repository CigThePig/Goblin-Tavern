// Phase 141 / ISSUE-110 — Voiced Surface arc, Phase 15 (Reports Prose).
//
// Section composer for the Daily Report's quiet-day line. One slot,
// narrator-voiced, register `tavern_floor`. Replaces
// `composeEmpty('quiet', voiceKey)` at
// `src/reports/dailyReportProjection.ts:135`.

import type { TavernState } from '../../../sim/state/TavernState'
import {
  buildReportSeed,
  type ReportSection,
} from '../../../cards/compose/reports'
import { assembleSlots } from '../../../cards/compose/assemble'
import type { SlotSpec } from '../../../cards/compose/types'
import { dailyQuietLinePool } from '../pools/dailyQuiet'

const QUIET_BUDGET = 10

export const dailyQuietSlots: readonly SlotSpec[] = [
  {
    id: 'line',
    role: 'aside',
    pool: dailyQuietLinePool,
    optional: true,
    wordBudget: QUIET_BUDGET,
    claimMode: 'flavor',
  },
]

export const dailyQuietSection: ReportSection = {
  id: 'daily.quiet',
  voiceRegister: 'tavern_floor',
  slots: dailyQuietSlots,
}

export type DailyQuietInput = {
  state: TavernState
  closedDayOrdinal: number
  isEndOfWeek: boolean
}

export function composeDailyQuietLine(
  input: DailyQuietInput,
): string | undefined {
  const tags: string[] = ['quiet']
  if (input.isEndOfWeek) tags.push('end_of_week')
  const seed = buildReportSeed({
    sectionId: 'daily.quiet',
    periodKey: `d${input.closedDayOrdinal}`,
    timing: 'closing',
    domain: tags,
  })
  const filled = assembleSlots(dailyQuietSlots, seed, input.state)
  return filled['line']
}
