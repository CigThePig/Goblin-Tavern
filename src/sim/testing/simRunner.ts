import { simulateDay } from '../core/engine'
import type { SimResult } from '../core/result'
import type {
  SimContext,
  SimInput,
  SimInputOwnerAction,
} from '../core/context'
import type { ResponseIntent } from '../modules/issues/issueSeedTypes'
import type { SimulationModule } from '../core/module'
import type { TavernState } from '../state/TavernState'
import { createInitialTavernState } from '../state/defaults'

// Phase 92 / ISSUE-052 — The canonical pipeline now lives outside of
// `testing/` so production code (engine validation, persistence
// migrations) can import it without depending on a test-runner module.
// Re-exported here for backwards compatibility with the many callers
// that already import `FULL_PIPELINE` from this file.
import { FULL_PIPELINE } from '../canonicalPipeline'
export { FULL_PIPELINE }

// Phase 20 §20.1 — Cardless playtest runner.
//
// The runner is a thin headless driver around `simulateDay`. It lets
// tests and debug scripts:
//
//   - start a fresh run with a seed,
//   - run one day / one week / one month / N days,
//   - thread a per-day owner-action and staff-priority chooser,
//   - capture each day's `SimResult` for later report aggregation.
//
// The runner does not present anything to the user. It is the underlying
// engine for cardless playtest reports, contradiction audits, seed
// coverage, strategy comparison, and the final card-readiness gate.

/** A chooser produces the SimInput for a single simulated day. */
export type DayInputChooser = (
  state: TavernState,
  absoluteDay: number,
) => {
  ownerActions?: ReadonlyArray<SimInputOwnerAction>
  staffPriorities?: Record<string, string>
  // Phase 41 / ISSUE-001 — response intents for the day. The chooser
  // typically reads `state.modules.responses.seedCache` (or yesterday's
  // `state.modules.issueSeeds.seedsToday`) to pick which seeds to act
  // on. Unknown seedIds are logged and skipped by the engine.
  responseIntents?: ReadonlyArray<ResponseIntent>
}

export type CardlessRunConfig = {
  seed: string
  /** Number of days to simulate. */
  days: number
  /** Optional pipeline override (mainly for tests of the expansion gate). */
  modules?: ReadonlyArray<SimulationModule>
  /** Optional starting state. Defaults to `createInitialTavernState()`. */
  initialState?: TavernState
  /** Optional per-day input chooser (policy bot or scripted inputs). */
  chooseInput?: DayInputChooser
}

export type CardlessRunDayRecord = {
  /** 1-based day index within the run. */
  index: number
  /** The state BEFORE this day was simulated. */
  stateBefore: TavernState
  /** The SimInput fed to `simulateDay`. */
  input: SimInput
  /** The full SimResult for the day. */
  result: SimResult
}

export type CardlessRunResult = {
  config: CardlessRunConfig
  initialState: TavernState
  finalState: TavernState
  days: CardlessRunDayRecord[]
  /** True iff every day finished with zero validation errors. */
  validatedThroughout: boolean
}

function defaultInput(
  state: TavernState,
  absoluteDay: number,
  chooser: DayInputChooser | undefined,
  seed: string,
): SimInput {
  const baseSeed = `${seed}:day-${absoluteDay}`
  if (!chooser) return { seed: baseSeed }
  const chosen = chooser(state, absoluteDay)
  const out: SimInput = { seed: baseSeed }
  if (chosen.ownerActions && chosen.ownerActions.length > 0) {
    out.ownerActions = [...chosen.ownerActions]
  }
  if (chosen.staffPriorities) {
    out.staffPriorities = { ...chosen.staffPriorities }
  }
  if (chosen.responseIntents && chosen.responseIntents.length > 0) {
    out.responseIntents = [...chosen.responseIntents]
  }
  return out
}

/** Phase 20 §20.1 — run the cardless simulation for `config.days` days. */
export function runCardlessSim(
  config: CardlessRunConfig,
): CardlessRunResult {
  const modules = config.modules ?? FULL_PIPELINE
  const initial = config.initialState ?? createInitialTavernState()
  let current = initial
  const records: CardlessRunDayRecord[] = []
  let validated = true

  for (let i = 1; i <= config.days; i += 1) {
    const stateBefore = current
    const input = defaultInput(
      stateBefore,
      stateBefore.calendar.totalDaysElapsed,
      config.chooseInput,
      config.seed,
    )
    const result = simulateDay(stateBefore, input, modules)
    if (result.validation.errors.length > 0) validated = false
    records.push({ index: i, stateBefore, input, result })
    current = result.state
  }

  return {
    config,
    initialState: initial,
    finalState: current,
    days: records,
    validatedThroughout: validated,
  }
}

/** Phase 20 §20.1 — convenience: run a single day with default pipeline. */
export function runOneDay(
  state: TavernState,
  input: SimInput,
  modules: ReadonlyArray<SimulationModule> = FULL_PIPELINE,
): SimResult {
  return simulateDay(state, input, modules)
}

/** Phase 20 §20.1 — convenience: run exactly one calendar week (7 days). */
export function runOneWeek(
  config: Omit<CardlessRunConfig, 'days'>,
): CardlessRunResult {
  return runCardlessSim({ ...config, days: 7 })
}

/** Phase 20 §20.1 — convenience: run exactly one calendar month (28 days). */
export function runOneMonth(
  config: Omit<CardlessRunConfig, 'days'>,
): CardlessRunResult {
  return runCardlessSim({ ...config, days: 28 })
}

/** Phase 20 §20.1 — convenience: count days to N months (28 days each). */
export function runMonths(
  months: number,
  config: Omit<CardlessRunConfig, 'days'>,
): CardlessRunResult {
  return runCardlessSim({ ...config, days: months * 28 })
}

void ((ctx: SimContext): void => {
  void ctx
})
