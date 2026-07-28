import { advanceDaySegment } from '../core/engine'
import { FULL_PIPELINE } from '../canonicalPipeline'
import type { SimInput, SimInputOwnerAction } from '../core/context'
import type { TavernState } from '../state/TavernState'
import { createInitialTavernState } from '../state/defaults'
import {
  DIFFICULTY_PRESETS,
  type DifficultyId,
} from '../state/difficulty'
import {
  getIssueSeedSlice,
  getResolvableSeedsToday,
} from '../modules/issues/issueSeedQueries'
import { renderedChoiceCost } from '../modules/issues/handBudget'
import type {
  IssueSeed,
  ResponseIntent,
} from '../modules/issues/issueSeedTypes'
import { getPressureModuleState } from '../modules/pressures/pressureModule'
import type { OwnerActionsModuleState } from '../modules/ownerActions/types'
import type { ResponsesModuleState } from '../modules/responses/types'
import type { ServiceModuleState } from '../modules/service/types'
import { getPolicyBot, type PolicyBot, type PolicyBotId } from './policyBots'

// Phase 206 / gameplay-audit Wave 7 — the balance measurement harness.
//
// Wave 7 asks a question none of the existing harnesses can answer. The
// Phase 20 `balanceRuns.runStrategy` driver proves *differentiation*: it
// runs `simulateDay` once per day with owner actions only, so no run it
// produces has ever answered a card. The audit's own Phase 7 fixture does
// wire responses, but only as a one-off script: one seed, one difficulty,
// one response policy, and a bespoke row shape that cannot be compared to
// anything else.
//
// Phase 8 §7 (Wave 7) needs all of:
//
//   - the eight shared-seed strategies, re-run;
//   - Easy and Hard beside Standard;
//   - action / no-action / response / partial-response variants;
//   - cash, patrons, satisfaction, staff, areas, stock, pressures and
//     delayed obligations compared across every one of those cells.
//
// So this module is the single driver for all of it. It runs the real
// segmented day (A → B → C) exactly as the web store does, which is what
// makes a response variant meaningful: a card can only be answered from
// the state that exists *after* Service, and `simulateDay` takes its
// whole input up front.
//
// Deliberately NOT in this module:
//
//   - any verdict. What counts as "balanced" depends on `DC-03` (the
//     long-term objective) and `DC-04` (the failure contract), which are
//     unanswered. Everything here is a measurement; scoring lives in
//     `balanceMatrix.ts` and is objective-agnostic.
//   - any card-layer import. `src/sim` must not depend on `src/cards`,
//     so decision load is priced with the sim's own
//     `renderedChoiceCost` — the same upper bound the Wave 6 hand budget
//     spends. Pass `measureRenderedChoices` to price actual rendered
//     cards from a test that may legally import the card layer.

// ----------------------------------------------------------------------
// Spec
// ----------------------------------------------------------------------

/** How the run answers cards. */
export type ResponsePolicy =
  /** Never answer a card. Every issue is left to stand. */
  | 'none'
  /** Answer every resolvable card with the bot's own slot preference. */
  | 'all'
  /** Answer every `partialStride`-th resolvable card (default: every 2nd). */
  | 'partial'

/** How the run spends the owner's day. */
export type OwnerActionPolicy =
  /** Queue nothing. The day passes without proactive management. */
  | 'none'
  /** Queue whatever the bot chooses. */
  | 'bot'

export type BalanceScenarioSpec = {
  botId: PolicyBotId
  days: number
  seed: string
  difficulty: DifficultyId
  /** Default `'bot'`. */
  ownerActions?: OwnerActionPolicy
  /** Default `'all'`. */
  responses?: ResponsePolicy
  /** Only read when `responses === 'partial'`. Default 2. */
  partialStride?: number
  /**
   * Price the day's decision load with a real card render instead of the
   * sim's `renderedChoiceCost` upper bound. Only a caller that may import
   * `src/cards` can supply this; the sim layer must not.
   */
  measureRenderedChoices?: (seed: IssueSeed, state: TavernState) => number
}

// ----------------------------------------------------------------------
// Observations
// ----------------------------------------------------------------------

/**
 * One day of a balance run, reduced to plain numbers.
 *
 * Every field is a scalar or a flat record so a whole matrix can be held
 * in memory, serialized to JSON, and diffed against a stored baseline.
 * Full `TavernState` snapshots are deliberately not retained — the audit
 * fixture already hit the memory ceiling holding eight 28-day histories.
 */
export type BalanceDayObservation = {
  day: number
  dayType: string

  // Economy
  coin: number
  coinDelta: number
  serviceCoinEarned: number
  serviceCoinNet: number
  unpaidTabs: number

  // Demand
  patrons: number
  incidents: number

  // Soft state (means across the relevant roster)
  avgSatisfaction: number
  avgPatronage: number
  avgCleanliness: number
  avgDamage: number
  avgMorale: number
  avgStress: number

  // Stock
  totalStockQuantity: number
  stockItemsAtZero: number

  // Pressures
  pressures: Record<string, number>
  peakPressure: number

  // Decision load (Wave 6's `DC-06` dimensions, per full day)
  cardsExposed: number
  choicesRendered: number
  families: string[]

  // Reactive agency
  responsesOffered: number
  responsesSelected: number
  responsesResolved: number
  responsesSkippedUnaffordable: number

  // Delayed obligations
  pendingDelayed: number
  delayedAppliedToday: number
  delayedExpiredToday: number

  // Proactive agency
  ownerActionsApplied: number
  ownerActionsRejected: number
  ownerTimeSpent: number
  ownerTimeBudget: number

  // Monthly obligation
  rentArrears: number
  rentMissedPayments: number
  rentPaidThisMonth: boolean

  // Trust
  validationErrorCount: number
  invariantFailures: string[]
}

export type BalanceRunResult = {
  spec: Required<Omit<BalanceScenarioSpec, 'measureRenderedChoices'>>
  botLabel: string
  days: BalanceDayObservation[]
  finalState: TavernState
  initialState: TavernState
}

// ----------------------------------------------------------------------
// Invariants
// ----------------------------------------------------------------------

/**
 * Audit Phase 8 §8.2 — the invariants that must hold at every stable beat.
 *
 * This is the exact check `tests/sim/phase200.wave1.strategyMatrix.test.ts`
 * has enforced since Wave 1, lifted here so the Wave 1 gate and every
 * Wave 7 balance cell test one contract rather than two copies of it.
 * Wave 7 must not be able to report a "balanced" cell that Wave 1 would
 * have called invalid.
 */
export function coreStateInvariantFailures(
  state: TavernState,
  label: string,
): string[] {
  const out: string[] = []
  if (state.coin < 0) out.push(`${label}: coin ${state.coin} < 0`)

  const slice = getPressureModuleState(state)
  for (const [id, compact] of Object.entries(state.pressures)) {
    const snapshot = slice.snapshots[id]
    if (!snapshot) continue
    if (snapshot.value !== compact.value) {
      out.push(
        `${label}: ${id} compact=${compact.value} snapshot=${snapshot.value}`,
      )
    }
  }

  const rent = rentSlice(state)
  if (rent && (rent.arrears ?? 0) < 0) {
    out.push(`${label}: rent arrears ${rent.arrears} < 0`)
  }
  return out
}

// ----------------------------------------------------------------------
// State readers
// ----------------------------------------------------------------------

function rentSlice(state: TavernState):
  | {
      monthlyAmount?: number
      paidThisMonth?: boolean
      missedPayments?: number
      arrears?: number
    }
  | undefined {
  const monthly = state.modules['monthly'] as
    | { rent?: Record<string, unknown> }
    | undefined
  return monthly?.rent as ReturnType<typeof rentSlice>
}

function serviceResult(state: TavernState) {
  return (state.modules['service'] as ServiceModuleState | undefined)?.result
}

function ownerActionSlice(
  state: TavernState,
): OwnerActionsModuleState | undefined {
  return state.modules['ownerActions'] as OwnerActionsModuleState | undefined
}

function responseSlice(state: TavernState): ResponsesModuleState | undefined {
  return state.modules['responses'] as ResponsesModuleState | undefined
}

function mean(values: number[]): number {
  if (values.length === 0) return 0
  const total = values.reduce((sum, value) => sum + value, 0)
  return Math.round((total / values.length) * 100) / 100
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

// ----------------------------------------------------------------------
// Response selection
// ----------------------------------------------------------------------

/**
 * Fill in a target the bot's slot preference did not specify.
 *
 * Lifted from the audit's Phase 7 fixture, which found that bot intents
 * carry a slot but no target, and an intent without a target is dropped.
 * A response variant that silently resolved nothing would read as "the
 * player answered every card and it changed nothing" — the exact wrong
 * conclusion for a balance pass.
 */
function completeIntentTarget(
  intent: ResponseIntent,
  seed: IssueSeed,
): ResponseIntent {
  if (intent.target) return intent
  const slotId = intent.metadata?.['responseSlotId']
  const slot =
    seed.responseSlots.find((candidate) => candidate.id === slotId) ??
    seed.responseSlots.find(
      (candidate) =>
        candidate.shape === intent.shape &&
        candidate.allowedVerbs.includes(intent.verb),
    )
  const target = slot?.targetOptions[0]
  return target ? { ...intent, target } : intent
}

function chooseResponses(
  bot: PolicyBot,
  state: TavernState,
  policy: ResponsePolicy,
  stride: number,
): { offered: number; intents: ResponseIntent[] } {
  const resolvable = getResolvableSeedsToday(state)
  if (policy === 'none' || !bot.chooseResponse) {
    return { offered: resolvable.length, intents: [] }
  }
  const considered =
    policy === 'partial'
      ? resolvable.filter((_seed, index) => index % stride === 0)
      : resolvable
  const intents = considered.flatMap((seed) => {
    const intent = bot.chooseResponse?.(state, seed)
    return intent ? [completeIntentTarget(intent, seed)] : []
  })
  return { offered: resolvable.length, intents }
}

// ----------------------------------------------------------------------
// Runner
// ----------------------------------------------------------------------

/**
 * The day's exposure ledger — every card the player was shown across the
 * whole day, Morning ∪ Service.
 *
 * This reads Wave 6's own `surfacedToday` rather than re-deriving the
 * union from two reads of the visible hand, so the harness and the
 * `DC-06` ceiling gate
 * (`tests/cards/phase205.wave6.attentionLoad.test.ts`) count the same
 * thing by construction. A private reconstruction here is exactly the
 * mistake `P4-SEAM-005` was: a second surface deriving its own answer.
 *
 * `seedsToday` is the fallback for a state written before Wave 6.
 */
function exposedToday(state: TavernState): IssueSeed[] {
  const slice = getIssueSeedSlice(state)
  if (!slice) return []
  const surfaced = slice.surfacedToday ?? []
  return surfaced.length > 0 ? surfaced : slice.seedsToday
}

/**
 * Run one balance scenario across `spec.days` days.
 *
 * The day is driven segment by segment, matching the real player route:
 *
 *   A  Morning        → the morning hand is generated and read
 *   B  Plan + Service → owner actions are queued, then Service resolves
 *   C  React + Close  → cards are answered from post-Service state
 *
 * `simulateDay` cannot express this: it takes the whole day's input up
 * front, so a response variant driven through it would be answering
 * yesterday's cards. Segment C is what makes "answer every card" a real
 * strategy rather than a scripted guess.
 */
export function runBalanceScenario(
  spec: BalanceScenarioSpec,
): BalanceRunResult {
  const bot = getPolicyBot(spec.botId)
  const ownerActionPolicy = spec.ownerActions ?? 'bot'
  const responsePolicy = spec.responses ?? 'all'
  const partialStride = Math.max(2, spec.partialStride ?? 2)

  const initialState = createInitialTavernState(
    undefined,
    DIFFICULTY_PRESETS[spec.difficulty],
  )
  let state = initialState
  const days: BalanceDayObservation[] = []

  for (let day = 1; day <= spec.days; day += 1) {
    const baseline = state
    const daySeed = `${spec.seed}:day-${baseline.calendar.totalDaysElapsed}`

    // --- Segment A: Morning -------------------------------------------
    const segmentA = advanceDaySegment(
      state,
      { seed: daySeed },
      FULL_PIPELINE,
      'A',
    )
    state = segmentA.state

    // --- Segment B: Plan + Service ------------------------------------
    const ownerActions: SimInputOwnerAction[] =
      ownerActionPolicy === 'none' ? [] : [...bot.chooseActions(state)]
    const staffPriorities =
      ownerActionPolicy === 'none'
        ? undefined
        : bot.chooseStaffPriorities?.(state)
    const segmentBInput: SimInput = {
      seed: daySeed,
      ...(ownerActions.length > 0 ? { ownerActions } : {}),
      ...(staffPriorities && Object.keys(staffPriorities).length > 0
        ? { staffPriorities }
        : {}),
    }
    const segmentB = advanceDaySegment(
      state,
      segmentBInput,
      FULL_PIPELINE,
      'B',
      { dayBaseline: baseline },
    )
    state = segmentB.state

    // --- Segment C: React + Close -------------------------------------
    const { offered, intents } = chooseResponses(
      bot,
      state,
      responsePolicy,
      partialStride,
    )
    const segmentC = advanceDaySegment(
      state,
      {
        seed: daySeed,
        ...(intents.length > 0 ? { responseIntents: intents } : {}),
      },
      FULL_PIPELINE,
      'C',
      { dayBaseline: baseline },
    )
    state = segmentC.state

    // Read the exposure ledger at end of day, against the end-of-day
    // state — the same two inputs the Wave 6 `DC-06` ceiling gate uses,
    // so the two can never disagree about what a day cost the player.
    const exposed = exposedToday(state)
    const priceChoices = spec.measureRenderedChoices
    const choicesRendered = sum(
      exposed.map((seed) =>
        priceChoices ? priceChoices(seed, state) : renderedChoiceCost(seed),
      ),
    )

    days.push(
      observeDay({
        day,
        baseline,
        state,
        exposed,
        choicesRendered,
        responsesOffered: offered,
        responsesSelected: intents.length,
        validationErrorCount: segmentC.validation.errors.length,
      }),
    )
  }

  return {
    spec: {
      botId: spec.botId,
      days: spec.days,
      seed: spec.seed,
      difficulty: spec.difficulty,
      ownerActions: ownerActionPolicy,
      responses: responsePolicy,
      partialStride,
    },
    botLabel: bot.label,
    days,
    initialState,
    finalState: state,
  }
}

function observeDay(input: {
  day: number
  baseline: TavernState
  state: TavernState
  exposed: IssueSeed[]
  choicesRendered: number
  responsesOffered: number
  responsesSelected: number
  validationErrorCount: number
}): BalanceDayObservation {
  const { state, baseline } = input
  const service = serviceResult(state)
  const actions = ownerActionSlice(state)
  const responses = responseSlice(state)
  const rent = rentSlice(state)
  const stock = Object.values(state.stock)
  const pressures = Object.fromEntries(
    Object.values(state.pressures).map((pressure) => [
      pressure.id,
      pressure.value,
    ]),
  )

  const resolvedToday = responses?.resolvedToday ?? []

  return {
    day: input.day,
    dayType: String(state.calendar.dayType),

    coin: state.coin,
    coinDelta: state.coin - baseline.coin,
    serviceCoinEarned: service?.coinEarned ?? 0,
    serviceCoinNet: service?.netCoinEarned ?? 0,
    unpaidTabs: service?.unpaidTabs ?? 0,

    patrons: sum(Object.values(service?.trafficByGroup ?? {})),
    incidents: service?.incidents.length ?? 0,

    avgSatisfaction: mean(
      Object.values(state.customerGroups).map((group) => group.satisfaction),
    ),
    avgPatronage: mean(
      Object.values(state.customerGroups).map((group) => group.patronage),
    ),
    avgCleanliness: mean(
      Object.values(state.areas).map((area) => area.cleanliness),
    ),
    avgDamage: mean(Object.values(state.areas).map((area) => area.damage)),
    avgMorale: mean(Object.values(state.staff).map((member) => member.morale)),
    avgStress: mean(Object.values(state.staff).map((member) => member.stress)),

    totalStockQuantity: sum(stock.map((item) => item.quantity)),
    stockItemsAtZero: stock.filter((item) => item.quantity <= 0).length,

    pressures,
    peakPressure: Math.max(0, ...Object.values(pressures)),

    cardsExposed: input.exposed.length,
    choicesRendered: input.choicesRendered,
    families: input.exposed.map((seed) => String(seed.family)),

    responsesOffered: input.responsesOffered,
    responsesSelected: input.responsesSelected,
    responsesResolved: resolvedToday.length,
    responsesSkippedUnaffordable: resolvedToday.filter(
      (record) => record.outcome === 'skipped_unaffordable',
    ).length,

    pendingDelayed: responses?.pending.length ?? 0,
    delayedAppliedToday: responses?.appliedFromPendingToday.length ?? 0,
    delayedExpiredToday: responses?.expiredFromPendingToday.length ?? 0,

    ownerActionsApplied: actions?.applied.length ?? 0,
    ownerActionsRejected: actions?.rejected.length ?? 0,
    ownerTimeSpent: actions?.timeSpent ?? 0,
    ownerTimeBudget: actions?.timeBudget ?? 0,

    rentArrears: rent?.arrears ?? 0,
    rentMissedPayments: rent?.missedPayments ?? 0,
    rentPaidThisMonth: rent?.paidThisMonth === true,

    validationErrorCount: input.validationErrorCount,
    invariantFailures: coreStateInvariantFailures(state, `day ${input.day}`),
  }
}

// ----------------------------------------------------------------------
// Rollup
// ----------------------------------------------------------------------

/**
 * One comparable row per scenario.
 *
 * Every field Phase 8 §7 names for Wave 7 ("compare cash, patrons,
 * satisfaction, staff, areas, stock, pressures, and delayed obligations")
 * has a column here, plus the identity axes §7 also asks about and the
 * `DC-06` decision-load dimensions Wave 6 approved. Nothing is scored:
 * a row states what happened, not whether it was good.
 */
export type BalanceRunMetrics = {
  // Identity of the cell
  cellId: string
  botId: PolicyBotId
  botLabel: string
  difficulty: DifficultyId
  seed: string
  days: number
  ownerActions: OwnerActionPolicy
  responses: ResponsePolicy

  // Cash
  finalCoin: number
  netCoinChange: number
  minCoin: number
  maxCoin: number
  daysBelowTenCoin: number

  // Demand
  totalPatrons: number
  totalServiceCoin: number
  totalUnpaidTabs: number
  totalIncidents: number

  // Soft state at the end of the run
  finalSatisfaction: number
  finalPatronage: number
  finalCleanliness: number
  finalDamage: number
  finalMorale: number
  finalStress: number

  // Soft state across the run (a final value hides a collapse-and-recover)
  meanSatisfaction: number
  meanCleanliness: number
  meanDamage: number
  meanMorale: number

  // Stock
  finalStockQuantity: number
  meanStockItemsAtZero: number

  // Pressures
  finalPressures: Record<string, number>
  peakPressures: Record<string, number>
  topPressureIds: string[]
  pressureDaysAtCeiling: number

  // Identity
  identityKey: string
  dominantAxes: string[]
  dominantCustomerGroup: string | undefined
  customerGroupRanking: Array<{ id: string; patronage: number }>

  // Delayed obligations
  totalDelayedApplied: number
  totalDelayedExpired: number
  endingPendingDelayed: number

  // Decision load (`DC-06`)
  meanCardsPerDay: number
  maxCardsPerDay: number
  meanChoicesPerDay: number
  maxChoicesPerDay: number
  totalChoicesRendered: number
  longestFamilyStreak: number
  longestStreakFamily: string | undefined

  // Agency
  totalOwnerActionsApplied: number
  totalOwnerActionsRejected: number
  meanOwnerTimeUtilisation: number
  totalResponsesOffered: number
  totalResponsesResolved: number
  totalResponsesSkippedUnaffordable: number

  // Monthly obligation
  endingRentArrears: number
  rentPaymentsMissed: number

  // Trust
  validatedThroughout: boolean
  invariantFailureCount: number
  firstInvariantFailure: string | undefined
  firstInvalidDay: number | undefined
}

function rankReputation(state: TavernState): {
  identityKey: string
  dominantAxes: string[]
} {
  const entries = Object.entries(state.reputation) as Array<[string, number]>
  entries.sort((left, right) => right[1] - left[1])
  const dominant = entries.slice(0, 3).map(([axis]) => axis)
  return {
    dominantAxes: dominant,
    identityKey: dominant.slice(0, 2).sort().join('+'),
  }
}

function longestStreak(
  days: BalanceDayObservation[],
): { family: string | undefined; length: number } {
  const families = new Set(days.flatMap((day) => day.families))
  let best: { family: string | undefined; length: number } = {
    family: undefined,
    length: 0,
  }
  for (const family of families) {
    let current = 0
    for (const day of days) {
      current = day.families.includes(family) ? current + 1 : 0
      if (current > best.length) best = { family, length: current }
    }
  }
  return best
}

export function cellIdOf(
  spec: Pick<
    BalanceRunMetrics,
    'botId' | 'difficulty' | 'ownerActions' | 'responses' | 'seed'
  >,
): string {
  return [
    spec.botId,
    spec.difficulty,
    `act-${spec.ownerActions}`,
    `res-${spec.responses}`,
    spec.seed,
  ].join('/')
}

export function summarizeBalanceRun(
  run: BalanceRunResult,
): BalanceRunMetrics {
  const { days, finalState, initialState, spec } = run
  const coins = days.map((day) => day.coin)
  const groups = Object.values(finalState.customerGroups)
  const reputation = rankReputation(finalState)
  const streak = longestStreak(days)

  const peakPressures: Record<string, number> = {}
  for (const day of days) {
    for (const [id, value] of Object.entries(day.pressures)) {
      peakPressures[id] = Math.max(peakPressures[id] ?? 0, value)
    }
  }

  const invariantFailures = days.flatMap((day) => day.invariantFailures)
  const firstInvalid = days.find(
    (day) => day.validationErrorCount > 0 || day.invariantFailures.length > 0,
  )

  const lastDay = days[days.length - 1]

  return {
    cellId: cellIdOf({ ...spec }),
    botId: spec.botId,
    botLabel: run.botLabel,
    difficulty: spec.difficulty,
    seed: spec.seed,
    days: days.length,
    ownerActions: spec.ownerActions,
    responses: spec.responses,

    finalCoin: finalState.coin,
    netCoinChange: finalState.coin - initialState.coin,
    minCoin: Math.min(initialState.coin, ...coins),
    maxCoin: Math.max(initialState.coin, ...coins),
    daysBelowTenCoin: days.filter((day) => day.coin < 10).length,

    totalPatrons: sum(days.map((day) => day.patrons)),
    totalServiceCoin: sum(days.map((day) => day.serviceCoinNet)),
    totalUnpaidTabs: sum(days.map((day) => day.unpaidTabs)),
    totalIncidents: sum(days.map((day) => day.incidents)),

    finalSatisfaction: lastDay?.avgSatisfaction ?? 0,
    finalPatronage: lastDay?.avgPatronage ?? 0,
    finalCleanliness: lastDay?.avgCleanliness ?? 0,
    finalDamage: lastDay?.avgDamage ?? 0,
    finalMorale: lastDay?.avgMorale ?? 0,
    finalStress: lastDay?.avgStress ?? 0,

    meanSatisfaction: mean(days.map((day) => day.avgSatisfaction)),
    meanCleanliness: mean(days.map((day) => day.avgCleanliness)),
    meanDamage: mean(days.map((day) => day.avgDamage)),
    meanMorale: mean(days.map((day) => day.avgMorale)),

    finalStockQuantity: lastDay?.totalStockQuantity ?? 0,
    meanStockItemsAtZero: mean(days.map((day) => day.stockItemsAtZero)),

    finalPressures: lastDay?.pressures ?? {},
    peakPressures,
    topPressureIds: Object.entries(lastDay?.pressures ?? {})
      .sort((left, right) => right[1] - left[1])
      .slice(0, 5)
      .map(([id]) => id),
    pressureDaysAtCeiling: days.filter((day) => day.peakPressure >= 100).length,

    identityKey: reputation.identityKey,
    dominantAxes: reputation.dominantAxes,
    dominantCustomerGroup: groups
      .slice()
      .sort((left, right) => right.patronage - left.patronage)[0]?.id,
    customerGroupRanking: groups
      .map((group) => ({ id: group.id, patronage: group.patronage }))
      .sort((left, right) => right.patronage - left.patronage),

    totalDelayedApplied: sum(days.map((day) => day.delayedAppliedToday)),
    totalDelayedExpired: sum(days.map((day) => day.delayedExpiredToday)),
    endingPendingDelayed: lastDay?.pendingDelayed ?? 0,

    meanCardsPerDay: mean(days.map((day) => day.cardsExposed)),
    maxCardsPerDay: Math.max(0, ...days.map((day) => day.cardsExposed)),
    meanChoicesPerDay: mean(days.map((day) => day.choicesRendered)),
    maxChoicesPerDay: Math.max(0, ...days.map((day) => day.choicesRendered)),
    totalChoicesRendered: sum(days.map((day) => day.choicesRendered)),
    longestFamilyStreak: streak.length,
    longestStreakFamily: streak.family,

    totalOwnerActionsApplied: sum(days.map((day) => day.ownerActionsApplied)),
    totalOwnerActionsRejected: sum(days.map((day) => day.ownerActionsRejected)),
    meanOwnerTimeUtilisation: mean(
      days.map((day) =>
        day.ownerTimeBudget > 0
          ? (day.ownerTimeSpent / day.ownerTimeBudget) * 100
          : 0,
      ),
    ),
    totalResponsesOffered: sum(days.map((day) => day.responsesOffered)),
    totalResponsesResolved: sum(days.map((day) => day.responsesResolved)),
    totalResponsesSkippedUnaffordable: sum(
      days.map((day) => day.responsesSkippedUnaffordable),
    ),

    endingRentArrears: lastDay?.rentArrears ?? 0,
    rentPaymentsMissed: lastDay?.rentMissedPayments ?? 0,

    validatedThroughout: days.every((day) => day.validationErrorCount === 0),
    invariantFailureCount: invariantFailures.length,
    firstInvariantFailure: invariantFailures[0],
    firstInvalidDay: firstInvalid?.day,
  }
}

/** Run a scenario and reduce it to one row, discarding the day states. */
export function measureBalanceScenario(
  spec: BalanceScenarioSpec,
): BalanceRunMetrics {
  return summarizeBalanceRun(runBalanceScenario(spec))
}
