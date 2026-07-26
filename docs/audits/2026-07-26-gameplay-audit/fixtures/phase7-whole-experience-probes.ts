import { FULL_PIPELINE } from '../../../../src/sim/canonicalPipeline'
import { advanceDaySegment } from '../../../../src/sim/core/engine'
import type {
  SimInput,
  SimInputOwnerAction,
} from '../../../../src/sim/core/context'
import type { SimResult } from '../../../../src/sim/core/result'
import type { TavernState } from '../../../../src/sim/state/TavernState'
import { createInitialTavernState } from '../../../../src/sim/state/defaults'
import { DIFFICULTY_PRESETS } from '../../../../src/sim/state/difficulty'
import {
  getAllSeedsToday,
  getResolvableSeedsToday,
} from '../../../../src/sim/modules/issues/issueSeedQueries'
import type {
  ConsequenceProfile,
  IssueSeed,
  ResponseIntent,
  ResponseSlot,
} from '../../../../src/sim/modules/issues/issueSeedTypes'
import type { OwnerActionsModuleState } from '../../../../src/sim/modules/ownerActions/types'
import { quoteOwnerAction } from '../../../../src/sim/modules/ownerActions/quoteOwnerAction'
import type { ResponsesModuleState } from '../../../../src/sim/modules/responses/types'
import type { ServiceModuleState } from '../../../../src/sim/modules/service/types'
import { pickRestockSupplier } from '../../../../src/sim/modules/suppliers/pricing'
import { buildDailyReport } from '../../../../src/reports/dailyReportProjection'
import { pickCard } from '../../../../src/cards/registry'
import type {
  CardlessRunDayRecord,
  CardlessRunResult,
} from '../../../../src/sim/testing/simRunner'
import { summarizeRun } from '../../../../src/sim/testing/cardlessPlaytest'
import {
  autoCleanFocusedBot,
  autoIgnoreRepairsBot,
  autoMerchantFocusedBot,
  autoMinerFocusedBot,
  autoNoOwnerActionsBot,
  autoProfitFocusedBot,
  autoRandomOwnerBot,
  autoStaffFriendlyBot,
  type PolicyBot,
} from '../../../../src/sim/testing/policyBots'

const DAYS = 28
const SHARED_SEED = 'phase7-integrated-shared'

type DayTrace = {
  day: number
  baseline: TavernState
  beforeResponses?: TavernState
  coinBeforeResponses: number
  result: SimResult
  morningSeeds: IssueSeed[]
  serviceSeeds: IssueSeed[]
  exposedSeeds: IssueSeed[]
  input: SimInput
  responseIntents: ResponseIntent[]
}

type IntegratedRun = {
  bot: PolicyBot
  initialState: TavernState
  finalState: TavernState
  days: DayTrace[]
  validatedThroughout: boolean
}

function daySeed(state: TavernState, prefix = SHARED_SEED): string {
  return `${prefix}:day-${state.calendar.totalDaysElapsed}`
}

function uniqueSeeds(...collections: ReadonlyArray<ReadonlyArray<IssueSeed>>): IssueSeed[] {
  const byId = new Map<string, IssueSeed>()
  for (const collection of collections) {
    for (const seed of collection) byId.set(seed.id, seed)
  }
  return [...byId.values()]
}

function completeIntentTarget(
  intent: ResponseIntent,
  seed: IssueSeed,
): ResponseIntent {
  if (intent.target) return intent
  const slotId = intent.metadata?.responseSlotId
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

function chooseResponses(bot: PolicyBot, state: TavernState): ResponseIntent[] {
  if (!bot.chooseResponse) return []
  return getResolvableSeedsToday(state).flatMap((seed) => {
    const intent = bot.chooseResponse?.(state, seed)
    return intent ? [completeIntentTarget(intent, seed)] : []
  })
}

function runIntegratedStrategy(
  bot: PolicyBot,
  options: { retainBeforeResponses?: boolean } = {},
): IntegratedRun {
  const initialState = createInitialTavernState(
    undefined,
    DIFFICULTY_PRESETS.standard,
  )
  let state = initialState
  const days: DayTrace[] = []
  let validatedThroughout = true

  for (let day = 1; day <= DAYS; day += 1) {
    const baseline = state
    const seed = daySeed(baseline)
    const segmentA = advanceDaySegment(
      state,
      { seed },
      FULL_PIPELINE,
      'A',
    )
    state = segmentA.state
    const morningSeeds = structuredClone(getAllSeedsToday(state))

    const ownerActions = [...bot.chooseActions(state)]
    const staffPriorities = bot.chooseStaffPriorities?.(state)
    const segmentBInput: SimInput = {
      seed,
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
    const visibleAfterService = structuredClone(getAllSeedsToday(state))
    const exposedBeforeResponse = uniqueSeeds(
      morningSeeds,
      structuredClone(getResolvableSeedsToday(state)),
    )
    const morningIds = new Set(morningSeeds.map((issue) => issue.id))
    const serviceSeeds = visibleAfterService.filter(
      (issue) => !morningIds.has(issue.id),
    )

    const responseIntents = chooseResponses(bot, state)
    const beforeResponses = state
    const segmentCInput: SimInput = {
      seed,
      ...(responseIntents.length > 0 ? { responseIntents } : {}),
    }
    const segmentC = advanceDaySegment(
      state,
      segmentCInput,
      FULL_PIPELINE,
      'C',
      { dayBaseline: baseline },
    )
    state = segmentC.state
    if (segmentC.validation.errors.length > 0) validatedThroughout = false

    days.push({
      day,
      baseline,
      ...(options.retainBeforeResponses ? { beforeResponses } : {}),
      coinBeforeResponses: beforeResponses.coin,
      result: segmentC,
      morningSeeds,
      serviceSeeds,
      exposedSeeds: exposedBeforeResponse,
      input: {
        seed,
        ...(ownerActions.length > 0 ? { ownerActions } : {}),
        ...(staffPriorities && Object.keys(staffPriorities).length > 0
          ? { staffPriorities }
          : {}),
        ...(responseIntents.length > 0 ? { responseIntents } : {}),
      },
      responseIntents,
    })
  }

  return {
    bot,
    initialState,
    finalState: state,
    days,
    validatedThroughout,
  }
}

function toCardlessRun(run: IntegratedRun): CardlessRunResult {
  const records: CardlessRunDayRecord[] = run.days.map((day) => ({
    index: day.day,
    stateBefore: day.baseline,
    input: day.input,
    result: day.result,
  }))
  return {
    config: {
      seed: SHARED_SEED,
      days: DAYS,
      initialState: run.initialState,
    },
    initialState: run.initialState,
    finalState: run.finalState,
    days: records,
    validatedThroughout: run.validatedThroughout,
  }
}

function mean(values: number[]): number {
  if (values.length === 0) return 0
  return Math.round(
    (values.reduce((sum, value) => sum + value, 0) / values.length) * 100,
  ) / 100
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

function serviceState(state: TavernState): ServiceModuleState {
  return state.modules.service as ServiceModuleState
}

function ownerActionState(state: TavernState): OwnerActionsModuleState {
  return state.modules.ownerActions as OwnerActionsModuleState
}

function responseState(state: TavernState): ResponsesModuleState {
  return state.modules.responses as ResponsesModuleState
}

function renderedChoiceCount(seed: IssueSeed, state: TavernState): number {
  const card = pickCard(seed, state)
  const modeledChoices = card.choices.length
  const rendererAddsIgnore = card.choices.every(
    (choice) => choice.verb !== 'ignore',
  )
  return modeledChoices + (rendererAddsIgnore ? 1 : 0)
}

function requireBeforeResponses(day: DayTrace): TavernState {
  if (!day.beforeResponses) {
    throw new Error(
      `Day ${day.day} did not retain its pre-response state for this probe.`,
    )
  }
  return day.beforeResponses
}

function averageRecord<T>(
  values: Record<string, T>,
  select: (value: T) => number,
): number {
  return mean(Object.values(values).map(select))
}

function strategyRow(run: IntegratedRun) {
  const cardless = toCardlessRun(run)
  const summary = summarizeRun(cardless)
  const services = run.days.map((day) => serviceState(day.result.state).result)
  const actions = run.days.map((day) => ownerActionState(day.result.state))
  const finalResponses = responseState(run.finalState)
  const final = run.finalState
  const totalPatrons = sum(
    services.map((service) =>
      sum(Object.values(service.trafficByGroup)),
    ),
  )
  const totalServiceCoin = sum(
    services.map((service) => service.netCoinEarned),
  )
  const allExposed = run.days.flatMap((day) => day.exposedSeeds)
  const validationErrors = run.days.flatMap((day) =>
    day.result.validation.errors.map((error) => {
      const selectedImmediateCoinCosts = day.responseIntents.flatMap(
        (intent) => {
          const seed = day.exposedSeeds.find(
            (candidate) => candidate.id === intent.seedId,
          )
          const slotId = intent.metadata?.responseSlotId
          const profile = seed?.consequenceProfiles.find(
            (candidate) => candidate.responseSlotId === slotId,
          )
          const costs = (profile?.immediateEffects ?? []).filter(
            (effect) =>
              effect.kind === 'state_change' &&
              effect.target === 'coin' &&
              (effect.amount ?? 0) < 0,
          )
          return costs.map((effect) => ({
            seedId: intent.seedId,
            responseSlotId: slotId,
            amount: effect.amount,
            readable: effect.readable,
          }))
        },
      )
      return {
        day: day.day,
        coinBeforeResponses: day.coinBeforeResponses,
        coinAfterResponsesAndRollups: day.result.state.coin,
        selectedImmediateCoinCosts,
        selectedImmediateCoinCostTotal: sum(
          selectedImmediateCoinCosts.map((cost) => -(cost.amount ?? 0)),
        ),
        error,
      }
    }),
  )
  const familyCounts = allExposed.reduce<Record<string, number>>(
    (counts, seed) => {
      counts[seed.family] = (counts[seed.family] ?? 0) + 1
      return counts
    },
    {},
  )
  return {
    botId: run.bot.id,
    label: run.bot.label,
    sharedSeed: SHARED_SEED,
    finalCoin: summary.finalCoin,
    netCoinChange: summary.netCoinChange,
    minimumCoin: Math.min(
      run.initialState.coin,
      ...run.days.map((day) => day.result.state.coin),
    ),
    totalPatrons,
    totalServiceCoin,
    ownerActionsApplied: sum(actions.map((state) => state.applied.length)),
    ownerActionsRejected: sum(actions.map((state) => state.rejected.length)),
    responsesResolved: finalResponses.totalResolved,
    delayedResponsesApplied: finalResponses.totalApplied,
    delayedResponsesPending: finalResponses.pending.length,
    exposedCards: allExposed.length,
    rawResponseSlots: sum(
      allExposed.map((seed) => seed.responseSlots.length),
    ),
    averageCardsPerDay: mean(
      run.days.map((day) => day.exposedSeeds.length),
    ),
    identity: summary.reputationIdentity.identityKey,
    dominantAxes: summary.reputationIdentity.dominantAxes,
    dominantCustomerGroup: summary.dominantCustomerGroup,
    averageCustomerSatisfaction: averageRecord(
      final.customerGroups,
      (group) => group.satisfaction,
    ),
    averageCustomerPatronage: averageRecord(
      final.customerGroups,
      (group) => group.patronage,
    ),
    averageAreaCleanliness: averageRecord(
      final.areas,
      (area) => area.cleanliness,
    ),
    averageAreaDamage: averageRecord(final.areas, (area) => area.damage),
    averageStaffMorale: averageRecord(final.staff, (staff) => staff.morale),
    averageStaffStress: averageRecord(final.staff, (staff) => staff.stress),
    topPressures: Object.values(final.pressures)
      .sort((left, right) => right.value - left.value)
      .slice(0, 5)
      .map((pressure) => ({ id: pressure.id, value: pressure.value })),
    topFamilies: Object.entries(familyCounts)
      .sort((left, right) => right[1] - left[1])
      .slice(0, 8)
      .map(([family, count]) => ({ family, count })),
    validatedThroughout: run.validatedThroughout,
    validationErrors,
  }
}

function runStrategyProbe() {
  const bots: PolicyBot[] = [
    autoNoOwnerActionsBot,
    autoRandomOwnerBot,
    autoCleanFocusedBot,
    autoProfitFocusedBot,
    autoMerchantFocusedBot,
    autoMinerFocusedBot,
    autoIgnoreRepairsBot,
    autoStaffFriendlyBot,
  ]
  // Summarize each run immediately so the fixture does not retain eight
  // full 28-day state histories at once.
  const rows = bots.map((bot) => strategyRow(runIntegratedStrategy(bot)))
  const identities = [...new Set(rows.map((row) => row.identity))].sort()
  const customerGroups = [
    ...new Set(rows.map((row) => row.dominantCustomerGroup)),
  ].sort()
  const coins = rows.map((row) => row.finalCoin)
  return {
    method: {
      days: DAYS,
      sharedSeed: SHARED_SEED,
      ownerActionsChosenAfterMorningSegment: true,
      responsesChosenAfterServiceSegment: true,
      note:
        'Unlike runStrategyMatrix, this probe uses one shared seed and wires chooseResponse into Segment C.',
    },
    differentiation: {
      distinctIdentityKeys: identities,
      distinctDominantCustomerGroups: customerGroups,
      endingCoinSpread: Math.max(...coins) - Math.min(...coins),
    },
    rows,
  }
}

function longestFamilyStreak(
  days: DayTrace[],
  family: string,
): number {
  let longest = 0
  let current = 0
  for (const day of days) {
    const present = day.exposedSeeds.some((seed) => seed.family === family)
    current = present ? current + 1 : 0
    longest = Math.max(longest, current)
  }
  return longest
}

function selectedCoachingSlot(
  seed: IssueSeed,
): { slot: ResponseSlot; profile?: ConsequenceProfile } | undefined {
  let best:
    | { slot: ResponseSlot; profile?: ConsequenceProfile; score: number }
    | undefined
  for (const slot of seed.responseSlots) {
    if (slot.shape === 'ignore' || slot.allowedVerbs[0] === 'ignore') continue
    const profiles = seed.consequenceProfiles.filter(
      (profile) => profile.responseSlotId === slot.id,
    )
    const profile = profiles.sort(
      (left, right) => right.impactScore - left.impactScore,
    )[0]
    const score = profile?.impactScore ?? 0
    if (!best || score > best.score) {
      best = { slot, ...(profile ? { profile } : {}), score }
    }
  }
  return best
}

function rawEffects(profile: ConsequenceProfile | undefined) {
  if (!profile) return []
  return [...profile.immediateEffects, ...profile.delayedEffects].map(
    (effect) => ({
      timing: profile.immediateEffects.includes(effect)
        ? 'immediate'
        : 'delayed',
      kind: effect.kind,
      target: effect.target,
      amount: effect.amount,
      readable: effect.readable,
    }),
  )
}

function pacingAndCoachingProbe() {
  const run = runIntegratedStrategy(autoNoOwnerActionsBot, {
    retainBeforeResponses: true,
  })
  const familyCounts = run.days
    .flatMap((day) => day.exposedSeeds)
    .reduce<Record<string, number>>((counts, seed) => {
      counts[seed.family] = (counts[seed.family] ?? 0) + 1
      return counts
    }, {})
  const families = Object.keys(familyCounts)
  const daily = run.days.map((day) => {
    const report = buildDailyReport(day.result, day.result.state, {
      previousCalendar: day.baseline.calendar,
    })
    return {
      day: day.day,
      morningCards: day.morningSeeds.length,
      serviceCards: day.serviceSeeds.length,
      exposedCards: day.exposedSeeds.length,
      exposedChoices: sum(
        day.exposedSeeds.map((seed) =>
          renderedChoiceCount(seed, requireBeforeResponses(day)),
        ),
      ),
      families: day.exposedSeeds.map((seed) => seed.family),
      missedOpportunityCount: report.missedOpportunities?.length ?? 0,
      weeklyDigest: Boolean(report.weeklyDigest),
      monthlyDigest: Boolean(report.monthlyDigest),
    }
  })

  const destructiveCoaching = run.days.flatMap((day) => {
    const report = buildDailyReport(day.result, day.result.state, {
      previousCalendar: day.baseline.calendar,
    })
    return (report.missedOpportunities ?? []).flatMap((line) => {
      if (line.kind !== 'ignored_seed' || !line.seedId) return []
      const seed = day.exposedSeeds.find((candidate) => candidate.id === line.seedId)
      if (!seed) return []
      const selected = selectedCoachingSlot(seed)
      if (!selected) return []
      const effects = rawEffects(selected.profile)
      const adverse = effects.filter(
        (effect) =>
          (effect.amount ?? 0) < 0 &&
          /(morale|loyalty|satisfaction|reputation|relationship)/i.test(
            effect.target,
          ),
      )
      if (adverse.length === 0 && selected.slot.allowedVerbs[0] !== 'blame') {
        return []
      }
      return [
        {
          day: day.day,
          reportReadable: line.readable,
          reportSecondary: line.secondary,
          seedId: seed.id,
          family: seed.family,
          subject: seed.textIngredients.subject,
          selectedSlot: selected.slot.id,
          selectedLabel: selected.slot.labelHint,
          verb: selected.slot.allowedVerbs[0],
          impactScore: selected.profile?.impactScore ?? 0,
          effects,
        },
      ]
    })
  })

  return {
    method: {
      days: DAYS,
      seed: SHARED_SEED,
      route: 'standard difficulty, no owner actions, no responses',
      exposedCards:
        'union of the visible morning hand and every resolvable card surfaced by the service pause',
    },
    load: {
      cards: {
        min: Math.min(...daily.map((day) => day.exposedCards)),
        max: Math.max(...daily.map((day) => day.exposedCards)),
        average: mean(daily.map((day) => day.exposedCards)),
        total: sum(daily.map((day) => day.exposedCards)),
      },
      choices: {
        min: Math.min(...daily.map((day) => day.exposedChoices)),
        max: Math.max(...daily.map((day) => day.exposedChoices)),
        average: mean(daily.map((day) => day.exposedChoices)),
        total: sum(daily.map((day) => day.exposedChoices)),
      },
      familyCounts: Object.entries(familyCounts)
        .sort((left, right) => right[1] - left[1])
        .map(([family, count]) => ({
          family,
          count,
          longestConsecutiveDayStreak: longestFamilyStreak(run.days, family),
        })),
      firstWeek: daily.slice(0, 7),
      weeklyBoundaryDays: daily
        .filter((day) => day.weeklyDigest)
        .map((day) => day.day),
      monthlyBoundaryDays: daily
        .filter((day) => day.monthlyDigest)
        .map((day) => day.day),
    },
    destructiveCoachingSummary: {
      count: destructiveCoaching.length,
      byVerb: destructiveCoaching.reduce<Record<string, number>>(
        (counts, row) => {
          counts[row.verb ?? 'unknown'] =
            (counts[row.verb ?? 'unknown'] ?? 0) + 1
          return counts
        },
        {},
      ),
    },
    destructiveCoaching,
  }
}

function pressureContinuityProbe() {
  const bots = [
    autoCleanFocusedBot,
    autoProfitFocusedBot,
    autoMerchantFocusedBot,
    autoMinerFocusedBot,
    autoIgnoreRepairsBot,
    autoStaffFriendlyBot,
  ]
  return bots.map((bot) => {
    const run = runIntegratedStrategy(bot)
    const mismatches = run.days.flatMap((day) => {
      const report = buildDailyReport(day.result, day.result.state, {
        previousCalendar: day.baseline.calendar,
      })
      return report.risingPressures.flatMap((line) => {
        const finalValue = day.result.state.pressures[line.id]?.value
        if (finalValue === undefined || finalValue === line.value) return []
        return [{
          day: day.day,
          pressureId: line.id,
          reportValue: line.value,
          finalStateValue: finalValue,
          difference: line.value - finalValue,
          responsesResolved:
            responseState(day.result.state).resolvedToday.length,
        }]
      })
    })
    return {
      botId: bot.id,
      mismatchCount: mismatches.length,
      maxAbsoluteDifference: Math.max(
        0,
        ...mismatches.map((row) => Math.abs(row.difference)),
      ),
      examples: mismatches.slice(0, 12),
    }
  })
}

function rentSnapshot(state: TavernState) {
  const monthly = state.modules.monthly as
    | {
        rent?: {
          monthlyAmount?: number
          paidThisMonth?: boolean
          missedPayments?: number
          arrears?: number
        }
      }
    | undefined
  return {
    monthlyAmount: monthly?.rent?.monthlyAmount,
    paidThisMonth: monthly?.rent?.paidThisMonth,
    missedPayments: monthly?.rent?.missedPayments,
    arrears: monthly?.rent?.arrears,
  }
}

function debtPaymentProbe() {
  const run = runIntegratedStrategy(autoCleanFocusedBot, {
    retainBeforeResponses: true,
  })
  const payments = run.days.flatMap((day) =>
    day.responseIntents.flatMap((intent) => {
      if (intent.metadata?.responseSlotId !== 'pay') return []
      const seed = day.exposedSeeds.find(
        (candidate) => candidate.id === intent.seedId,
      )
      if (!seed || seed.family !== 'debt_rent') return []
      const profile = seed.consequenceProfiles.find(
        (candidate) => candidate.responseSlotId === 'pay',
      )
      const beforeResponses = requireBeforeResponses(day)
      const rendered = pickCard(seed, beforeResponses)
      const choice = rendered.choices.find(
        (candidate) => candidate.slotId === 'pay',
      )
      return [{
        day: day.day,
        seedId: seed.id,
        coinBeforeResponse: day.coinBeforeResponses,
        rentBeforeResponse: rentSnapshot(beforeResponses),
        renderedChoice: {
          label: choice?.label,
          disabledReason: choice?.disabledReason,
          previewEffects: choice?.previewEffects,
          mechanicalEffects: choice?.mechanicalEffects,
        },
        slotExpectedEffects: seed.responseSlots.find(
          (slot) => slot.id === 'pay',
        )?.expectedEffects,
        profileImmediateEffects: profile?.immediateEffects,
        coinAfterResponseAndRollups: day.result.state.coin,
        rentAfterResponseAndRollups: rentSnapshot(day.result.state),
        validationErrors: day.result.validation.errors,
      }]
    }),
  )
  return {
    route: {
      difficulty: 'standard',
      strategy: autoCleanFocusedBot.id,
      days: DAYS,
      seed: SHARED_SEED,
      directStateEditing: false,
    },
    paymentCount: payments.length,
    payments,
  }
}

function restockSegment(
  actions: SimInputOwnerAction[],
  seed: string,
): {
  before: TavernState
  after: TavernState
  actionState: OwnerActionsModuleState
} {
  const initial = createInitialTavernState(
    undefined,
    DIFFICULTY_PRESETS.standard,
  )
  initial.stock.mushrooms!.quantity = 0
  initial.stock.ingredients!.quantity = 0
  initial.stock.stew!.quantity = 0
  const baseline = structuredClone(initial)
  const a = advanceDaySegment(initial, { seed }, FULL_PIPELINE, 'A')
  const before = structuredClone(a.state)
  const b = advanceDaySegment(
    a.state,
    { seed, ownerActions: actions },
    FULL_PIPELINE,
    'B',
    { dayBaseline: baseline },
  )
  return {
    before,
    after: b.state,
    actionState: ownerActionState(b.state),
  }
}

function freeRestockProbe() {
  const targets = ['mushrooms', 'ingredients', 'stew']
  const single = targets.map((targetId) => {
    const initial = createInitialTavernState(
      undefined,
      DIFFICULTY_PRESETS.standard,
    )
    initial.stock[targetId]!.quantity = 0
    const supplier = pickRestockSupplier(initial, targetId)
    const quote = quoteOwnerAction(initial, {
      actionId: 'restock_item',
      targetId,
      amount: 40,
    })
    const segment = restockSegment(
      [{ actionId: 'restock_item', targetId, amount: 40 }],
      `phase7-free-restock-${targetId}`,
    )
    const applied = segment.actionState.applied[0]
    const coinData = applied?.data.coin as { spent?: number } | undefined
    const quantityData = applied?.data.quantity as
      | { before?: number; after?: number }
      | undefined
    return {
      targetId,
      basePrice: initial.stock[targetId]!.basePrice,
      chosenSupplier: supplier?.supplier.id,
      supplierPriceBias: supplier?.supplier.priceBias,
      effectiveUnitPrice: supplier?.effectivePrice,
      quote: quote.summary,
      reportedOwnerSpend: coinData?.spent,
      deliveredByAction:
        (quantityData?.after ?? 0) - (quantityData?.before ?? 0),
      coinAtPlanningPause: segment.before.coin,
      coinAfterService: segment.after.coin,
      stockAtPlanningPause: segment.before.stock[targetId]!.quantity,
      stockAfterService: segment.after.stock[targetId]!.quantity,
      applied: segment.actionState.applied,
      rejected: segment.actionState.rejected,
    }
  })

  const repeated = restockSegment(
    Array.from({ length: 6 }, () => ({
      actionId: 'restock_item',
      targetId: 'mushrooms',
      amount: 40,
    })),
    'phase7-free-restock-repeat',
  )
  return {
    single,
    repeatedMushrooms: {
      attempts: 6,
      timeSpent: repeated.actionState.timeSpent,
      timeBudget: repeated.actionState.timeBudget,
      applied: repeated.actionState.applied.length,
      missedDeliveries: repeated.actionState.applied.filter((entry) =>
        entry.label.startsWith('Missed restock'),
      ).length,
      rejected: repeated.actionState.rejected.length,
      reportedOwnerSpend: sum(
        repeated.actionState.applied.map((entry) => {
          const coin = entry.data.coin as { spent?: number } | undefined
          return coin?.spent ?? 0
        }),
      ),
      deliveredByActions: sum(
        repeated.actionState.applied.map((entry) => {
          const quantity = entry.data.quantity as
            | { before?: number; after?: number }
            | undefined
          return (quantity?.after ?? 0) - (quantity?.before ?? 0)
        }),
      ),
      coinAtPlanningPause: repeated.before.coin,
      coinAfterService: repeated.after.coin,
      stockAtPlanningPause: repeated.before.stock.mushrooms!.quantity,
      stockAfterService: repeated.after.stock.mushrooms!.quantity,
      actionEffects: repeated.actionState.applied.map((entry) => entry.effects),
    },
  }
}

const requestedSection = process.argv[2]
let output: unknown
if (requestedSection === 'freeRestockProbe') {
  output = freeRestockProbe()
} else if (requestedSection === 'debtPaymentProbe') {
  output = debtPaymentProbe()
} else if (requestedSection === 'pacingAndCoachingProbe') {
  output = pacingAndCoachingProbe()
} else if (requestedSection === 'pressureContinuityProbe') {
  output = pressureContinuityProbe()
} else if (requestedSection === 'strategyProbe') {
  output = runStrategyProbe()
} else {
  output = {
    freeRestockProbe: freeRestockProbe(),
    debtPaymentProbe: debtPaymentProbe(),
    pacingAndCoachingProbe: pacingAndCoachingProbe(),
    pressureContinuityProbe: pressureContinuityProbe(),
    strategyProbe: runStrategyProbe(),
  }
}

console.log(JSON.stringify(output, null, 2))
