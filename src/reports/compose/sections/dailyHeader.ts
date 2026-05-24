// Phase 141 / ISSUE-110 — Voiced Surface arc, Phase 15 (Reports Prose).
//
// Section composer for the Daily Report's italic header voice line. One
// slot, narrator-voiced, register `tavern_floor`. Replaces the legacy
// `composeEmpty('header', voiceKey)` entry point at
// `src/reports/dailyReportProjection.ts:183`.

import type { TavernState } from '../../../sim/state/TavernState'
import type { CalendarState } from '../../../sim/modules/calendar/types'
import {
  buildReportSeed,
  type ReportSection,
} from '../../../cards/compose/reports'
import {
  assembleSlots,
} from '../../../cards/compose/assemble'
import type { SlotSpec } from '../../../cards/compose/types'
import { dailyHeaderLinePool } from '../pools/dailyHeader'

const HEADER_BUDGET = 8

export const dailyHeaderSlots: readonly SlotSpec[] = [
  {
    id: 'line',
    role: 'aside',
    pool: dailyHeaderLinePool,
    optional: true,
    wordBudget: HEADER_BUDGET,
    claimMode: 'flavor',
  },
]

export const dailyHeaderSection: ReportSection = {
  id: 'daily.header',
  voiceRegister: 'tavern_floor',
  slots: dailyHeaderSlots,
}

export type DailyHeaderInput = {
  state: TavernState
  closedDayOrdinal: number
  calendar: CalendarState
  isEndOfWeek: boolean
  isEndOfMonth: boolean
  /** Optional — caller may classify the day as "heavy" (lots of
   *  resolutions / high-impact diffs). Routed through `seed.domain` as
   *  `'heavy_day'` so the line pool can read it via `hasTag`. */
  isHeavyDay?: boolean
}

export function composeDailyHeaderLine(
  input: DailyHeaderInput,
): string | undefined {
  const tags: string[] = ['closed']
  if (input.isEndOfWeek) tags.push('end_of_week')
  if (input.isEndOfMonth) tags.push('end_of_month')
  if (input.isHeavyDay) tags.push('heavy_day')

  const seed = buildReportSeed({
    sectionId: 'daily.header',
    periodKey: `d${input.closedDayOrdinal}`,
    timing: 'closing',
    domain: tags,
  })
  const filled = assembleSlots(dailyHeaderSlots, seed, input.state)
  return filled['line']
}
