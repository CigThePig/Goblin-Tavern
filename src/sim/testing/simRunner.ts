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

import { areasModule } from '../modules/areas/index'
import { attributionModule } from '../modules/attribution/index'
import { causesModule } from '../modules/causes/index'
import { customersModule } from '../modules/customers/index'
import { feedbackModule } from '../modules/feedback/index'
import { historyModule } from '../modules/history/index'
import { issueSeedsModule } from '../modules/issues/index'
import { memoriesModule } from '../modules/memories/index'
import { responsesModule } from '../modules/responses/index'
import { localArcsModule } from '../modules/localArcs/index'
import { monthlyModule } from '../modules/monthly/index'
import { ownerActionsModule } from '../modules/ownerActions/index'
import { pressuresModule } from '../modules/pressures/index'
import { serviceModule } from '../modules/service/index'
import { staffModule } from '../modules/staff/index'
import { stockModule } from '../modules/stock/index'
import { weeklyModule } from '../modules/weekly/index'
// Phase 27 §27.4 — expanded world modules.
import { worldModule } from '../modules/world/index'
import { cultureModule } from '../modules/cultures/index'
import { factionModule } from '../modules/factions/index'
import { supplierModule } from '../modules/suppliers/index'
import { regularModule } from '../modules/regulars/index'
// Phase 69 / ISSUE-029 §6.4 — hireable adventurer roster module.
import { adventurersModule } from '../modules/adventurers/index'
// Phase 70 / ISSUE-030 §6.3 — expedition subsystem module.
import { expeditionsModule } from '../modules/expeditions/index'

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

/**
 * The canonical full Phase 19 simulation pipeline. The order is
 * load-bearing: state owners (areas/stock/staff/customers) run before
 * the input/service modules, which run before weekly/monthly closers,
 * memory/history pipelines, then the analysis stack (causes →
 * pressures → feedback → issue seeds).
 */
export const FULL_PIPELINE: ReadonlyArray<SimulationModule> = [
  areasModule,
  stockModule,
  staffModule,
  customersModule,
  // Phase 27 §27.4 — world skeleton modules sit between the state
  // owners and the input/service modules. They currently register no-
  // op hooks against the new Phase 27 phases; later phases (29, 30)
  // give them real behaviour. The world module itself is listed first
  // so its `state.modules.world` slot is reserved before domain
  // modules that may eventually depend on it.
  worldModule,
  cultureModule,
  factionModule,
  supplierModule,
  regularModule,
  // Phase 69 / ISSUE-029 §6.4 — adventurers module runs alongside the
  // other world-state modules. Its only hook is `endWeek`, so its
  // position before service/owner-actions is just for clarity.
  adventurersModule,
  // Phase 70 / ISSUE-030 §6.3 — expeditions module ticks each day
  // before the input/service path so newly-resolved expeditions can
  // influence today's customer/service flow (e.g. fresh ingredients
  // landing in stock at startDay).
  expeditionsModule,
  ownerActionsModule,
  serviceModule,
  weeklyModule,
  monthlyModule,
  // Phase 35 §35.5 — local arcs run after the monthly module so they
  // observe the finalized month (modifier, accumulator) before seeding
  // or progressing arcs.
  localArcsModule,
  memoriesModule,
  historyModule,
  causesModule,
  // Phase 37 §37.1 — Attribution sits after causes/memories/scenes so
  // its rules can read today's settled simulation truth, but before the
  // pressure/feedback/issue-seed analytical stack so those layers can
  // optionally fold in attribution-driven signals.
  attributionModule,
  pressuresModule,
  feedbackModule,
  issueSeedsModule,
  // Phase 41 / ISSUE-001 — responses module wires the resolver into the
  // engine. Its `applyResponses` phase slot fires between `closing` and
  // `endDay`, so by the time `applyResponses` runs the day's seeds are
  // present (issueSeedsModule populates them during `generateReports`
  // for the previous day's snapshot — for current-day intents, the
  // chooser must supply intents referencing seeds known at the moment
  // they were chosen). The module also drains the pending queue on
  // `startDay`, which is why it must be registered at all.
  responsesModule,
]

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
