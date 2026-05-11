// Phase 20 §20.6 — One-month test harness.

import type { TavernState } from '../state/TavernState'
import { runOneMonth, type CardlessRunResult } from './simRunner'
import { buildOneMonthReport, type OneMonthReport } from './cardlessPlaytest'

export type RunMonthResult = {
  run: CardlessRunResult
  report: OneMonthReport
}

export function runMonth(
  seed: string,
  initialState?: TavernState,
): RunMonthResult {
  const run = runOneMonth({
    seed,
    ...(initialState !== undefined ? { initialState } : {}),
  })
  return { run, report: buildOneMonthReport(run.days) }
}

export { runOneMonth }
