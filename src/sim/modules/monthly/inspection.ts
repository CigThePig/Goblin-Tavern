import type { TavernState } from '../../state/TavernState'
import {
  getRegulatoryModuleState,
  liveEvidence,
  openCases,
  suspicionFromEvidence,
} from '../regulatory/index'

import type {
  InspectionResolution,
  InspectionState,
  MonthlyAccumulator,
} from './types'

// Phase 15 §15.4 — Inspection suspicion.
//
// Expansion Phase 7 §7.3 — INSPECTION MOVED. This function used to BE the
// inspection system: once a month it read kitchen cleanliness, privy smell,
// spoilage, merchant mood and reputation, folded them into a 0–100
// `suspicion` meter, and — when the meter crossed 70 — incremented a warning
// counter. The Phase 15 doc said as much in its own comment: "there is no
// inspection event yet. Pressure is allowed to rise without a discharging
// event." Nobody ever came. That was `OBL-03`.
//
// The regulatory module (`src/sim/modules/regulatory/`) now owns the whole
// lifecycle: daily itemised evidence, cases, dated visits, seven graded
// dimensions read off live state, findings with requirements, fines as real
// obligations, remediation, appeal, follow-up and closure. `suspicion` is
// still published — as a DERIVED forecast of that evidence, which is what
// §7.3 says a pressure should be — so the pressure calculator, the monthly
// report and the `inspection` issue seeds keep reading the field they always
// read.
//
// What is left here is the monthly REPORT projection. It reads; it does not
// decide. The `next` it returns is what the regulatory module has already
// established, so the monthly slice cannot drift away from the evidence.

const WARNING_THRESHOLD = 70

export function resolveInspection(
  state: TavernState,
  inspection: InspectionState,
  accumulator: MonthlyAccumulator,
  monthNumber: number,
): { next: InspectionState; resolution: InspectionResolution } {
  void accumulator
  const today = state.calendar.totalDaysElapsed
  const slice = getRegulatoryModuleState(state)
  const suspicion = suspicionFromEvidence(state, today)
  const cases = openCases(slice)
  const warningCount = slice.totals.casesOpened

  const notes: string[] = []
  // The month's account of WHY, itemised from the same evidence the
  // inspector reads rather than from a parallel set of thresholds.
  for (const entry of [...liveEvidence(slice, today)]
    .sort((a, b) => b.severity - a.severity)
    .slice(0, 6)) {
    notes.push(`(${entry.severity}) ${entry.readable}`)
  }
  if (notes.length === 0) {
    notes.push('Nothing standing that the watch would come out for.')
  }
  for (const record of cases) {
    notes.push(
      record.nextVisitDay !== undefined
        ? `${record.readable} — next visit day ${record.nextVisitDay}.`
        : `${record.readable} — awaiting closure.`,
    )
  }
  for (const record of slice.caseArchive.slice(-2)) {
    const last = record.outcomes[record.outcomes.length - 1]
    if (last) notes.push(`Closed: ${last.readable}`)
  }
  if (suspicion >= WARNING_THRESHOLD && cases.length === 0) {
    notes.push(
      `The watch's interest is above the ${WARNING_THRESHOLD} mark; a visit is likely.`,
    )
  }

  return {
    next: {
      suspicion,
      lastInspectionMonth: monthNumber,
      warningCount,
    },
    resolution: {
      suspicionBefore: inspection.suspicion,
      suspicionAfter: suspicion,
      warningCount,
      // A warning is now a real case being opened, not a meter crossing a
      // line — so "was one issued this month?" is a fact about cases.
      warningIssuedThisMonth: warningCount > inspection.warningCount,
      notes,
    },
  }
}
