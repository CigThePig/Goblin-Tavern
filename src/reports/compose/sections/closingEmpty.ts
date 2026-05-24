// Phase 142 / ISSUE-111 — Voiced Surface arc, Phase 16 (Ambient Surface).
//
// Section composer for the day-screen closing empty-state line — the
// placeholder rendered when the closing beat surfaces zero seeds. One
// slot, narrator-voiced, register `tavern_floor`. Replaces the legacy
// `composeEmpty('closing', voiceKey)` entry point at
// `web/src/lib/screens/DayScreen.svelte:160`.

import type { TavernState } from '../../../sim/state/TavernState'
import {
  buildReportSeed,
  type ReportSection,
} from '../../../cards/compose/reports'
import { assembleSlots } from '../../../cards/compose/assemble'
import type { SlotSpec } from '../../../cards/compose/types'
import { closingEmptyLinePool } from '../pools/closingEmpty'

const CLOSING_BUDGET = 10

export const closingEmptySlots: readonly SlotSpec[] = [
  {
    id: 'line',
    role: 'aside',
    pool: closingEmptyLinePool,
    optional: true,
    wordBudget: CLOSING_BUDGET,
    claimMode: 'flavor',
  },
]

export const closingEmptySection: ReportSection = {
  id: 'day.closing_empty',
  voiceRegister: 'tavern_floor',
  slots: closingEmptySlots,
}

export type ClosingEmptyInput = {
  state: TavernState
  closedDayOrdinal: number
  isEndOfWeek?: boolean
  isEndOfMonth?: boolean
}

export function composeClosingEmptyLine(
  input: ClosingEmptyInput,
): string | undefined {
  const tags: string[] = ['closing']
  if (input.isEndOfWeek) tags.push('end_of_week')
  if (input.isEndOfMonth) tags.push('end_of_month')
  const seed = buildReportSeed({
    sectionId: 'day.closing_empty',
    periodKey: `d${input.closedDayOrdinal}.closing`,
    timing: 'closing',
    domain: tags,
  })
  const filled = assembleSlots(closingEmptySlots, seed, input.state)
  return filled['line']
}
