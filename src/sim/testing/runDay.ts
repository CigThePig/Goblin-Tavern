// Phase 20 §20.1 — One-day test harness.
//
// Thin wrapper around the cardless playtest runner that simulates a
// single day and (optionally) builds the matching one-day report.

import type { TavernState } from '../state/TavernState'
import type { SimInput } from '../core/context'
import type { SimResult } from '../core/result'
import { runOneDay } from './simRunner'
import { buildOneDayReport, type OneDayReport } from './cardlessPlaytest'

export type RunDayResult = {
  result: SimResult
  report: OneDayReport
}

export function runDay(state: TavernState, input: SimInput): RunDayResult {
  const result = runOneDay(state, input)
  const report = buildOneDayReport({
    index: 1,
    stateBefore: state,
    input,
    result,
  })
  return { result, report }
}

export { runOneDay }
