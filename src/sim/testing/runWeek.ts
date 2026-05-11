// Phase 20 §20.5 — One-week test harness.

import type { TavernState } from '../state/TavernState'
import { runOneWeek, type CardlessRunResult } from './simRunner'
import { buildOneWeekReport, type OneWeekReport } from './cardlessPlaytest'

export type RunWeekResult = {
  run: CardlessRunResult
  report: OneWeekReport
}

export function runWeek(
  seed: string,
  initialState?: TavernState,
): RunWeekResult {
  const run = runOneWeek({
    seed,
    ...(initialState !== undefined ? { initialState } : {}),
  })
  return { run, report: buildOneWeekReport(run.days) }
}

export { runOneWeek }
