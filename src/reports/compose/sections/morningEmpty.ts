// Phase 142 / ISSUE-111 — Voiced Surface arc, Phase 16 (Ambient Surface).
//
// Section composer for the day-screen morning empty-state line — the
// placeholder rendered when the morning beat surfaces zero seeds. One
// slot, narrator-voiced, register `tavern_floor`. Replaces the legacy
// `composeEmpty('morning', voiceKey)` entry point at
// `web/src/lib/screens/DayScreen.svelte:158`.

import type { TavernState } from '../../../sim/state/TavernState'
import {
  buildReportSeed,
  type ReportSection,
} from '../../../cards/compose/reports'
import { assembleSlots } from '../../../cards/compose/assemble'
import type { SlotSpec } from '../../../cards/compose/types'
import { morningEmptyLinePool } from '../pools/morningEmpty'

const MORNING_BUDGET = 10

export const morningEmptySlots: readonly SlotSpec[] = [
  {
    id: 'line',
    role: 'aside',
    pool: morningEmptyLinePool,
    optional: true,
    wordBudget: MORNING_BUDGET,
    claimMode: 'flavor',
  },
]

export const morningEmptySection: ReportSection = {
  id: 'day.morning_empty',
  voiceRegister: 'tavern_floor',
  slots: morningEmptySlots,
}

export type MorningEmptyInput = {
  state: TavernState
  closedDayOrdinal: number
  isEndOfWeek?: boolean
}

export function composeMorningEmptyLine(
  input: MorningEmptyInput,
): string | undefined {
  const tags: string[] = ['morning']
  if (input.isEndOfWeek) tags.push('end_of_week')
  const seed = buildReportSeed({
    sectionId: 'day.morning_empty',
    periodKey: `d${input.closedDayOrdinal}.morning`,
    timing: 'morning_prep',
    domain: tags,
  })
  const filled = assembleSlots(morningEmptySlots, seed, input.state)
  return filled['line']
}
