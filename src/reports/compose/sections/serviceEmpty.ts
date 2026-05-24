// Phase 142 / ISSUE-111 — Voiced Surface arc, Phase 16 (Ambient Surface).
//
// Section composer for the day-screen service empty-state line — the
// placeholder rendered when the service beat surfaces zero seeds. One
// slot, narrator-voiced, register `tavern_floor`. Replaces the legacy
// `composeEmpty('service', voiceKey)` entry point at
// `web/src/lib/screens/DayScreen.svelte:159`.

import type { TavernState } from '../../../sim/state/TavernState'
import {
  buildReportSeed,
  type ReportSection,
} from '../../../cards/compose/reports'
import { assembleSlots } from '../../../cards/compose/assemble'
import type { SlotSpec } from '../../../cards/compose/types'
import { serviceEmptyLinePool } from '../pools/serviceEmpty'

const SERVICE_BUDGET = 10

export const serviceEmptySlots: readonly SlotSpec[] = [
  {
    id: 'line',
    role: 'aside',
    pool: serviceEmptyLinePool,
    optional: true,
    wordBudget: SERVICE_BUDGET,
    claimMode: 'flavor',
  },
]

export const serviceEmptySection: ReportSection = {
  id: 'day.service_empty',
  voiceRegister: 'tavern_floor',
  slots: serviceEmptySlots,
}

export type ServiceEmptyInput = {
  state: TavernState
  closedDayOrdinal: number
  isEndOfWeek?: boolean
}

export function composeServiceEmptyLine(
  input: ServiceEmptyInput,
): string | undefined {
  const tags: string[] = ['service']
  if (input.isEndOfWeek) tags.push('end_of_week')
  const seed = buildReportSeed({
    sectionId: 'day.service_empty',
    periodKey: `d${input.closedDayOrdinal}.service`,
    timing: 'during_service',
    domain: tags,
  })
  const filled = assembleSlots(serviceEmptySlots, seed, input.state)
  return filled['line']
}
