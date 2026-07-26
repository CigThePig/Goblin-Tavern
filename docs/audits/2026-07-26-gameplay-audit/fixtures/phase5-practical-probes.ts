import { FULL_PIPELINE } from '../../../../src/sim/canonicalPipeline'
import {
  advanceDaySegment,
  simulateDay,
} from '../../../../src/sim/core/engine'
import type { SimInput, SimInputOwnerAction } from '../../../../src/sim/core/context'
import type { SimResult } from '../../../../src/sim/core/result'
import type { TavernState } from '../../../../src/sim/state/TavernState'
import { createInitialTavernState } from '../../../../src/sim/state/defaults'
import {
  DIFFICULTY_PRESETS,
  type DifficultyId,
} from '../../../../src/sim/state/difficulty'
import {
  getAllSeedsToday,
  getResolvableSeedsToday,
} from '../../../../src/sim/modules/issues/issueSeedQueries'
import type {
  IssueSeed,
  ResponseIntent,
} from '../../../../src/sim/modules/issues/issueSeedTypes'
import type { CustomerModuleState } from '../../../../src/sim/modules/customers/types'
import type { OwnerActionsModuleState } from '../../../../src/sim/modules/ownerActions/types'
import type { ServiceModuleState } from '../../../../src/sim/modules/service/types'
import type { ResponsesModuleState } from '../../../../src/sim/modules/responses/types'
import { buildDailyReport } from '../../../../src/reports/dailyReportProjection'
import { recipeRegistry } from '../../../../src/sim/registries/recipeRegistry'
import { runCardlessSim } from '../../../../src/sim/testing/simRunner'
import { runStrategyMatrix } from '../../../../src/sim/testing/balanceRuns'
import { buildStrategyComparison } from '../../../../src/sim/testing/strategyComparison'

const PRACTICAL_SEED = 'phase5-practical-fixed'
const STICKY_PRIORITIES = { cleaner_bouncer: 'prevent_fights' }

type ReplayDay = {
  day: number
  morningSeeds: IssueSeed[]
  serviceSeeds: IssueSeed[]
  result: SimResult
  baseline: TavernState
}

function inputFor(
  state: TavernState,
  extra: Omit<SimInput, 'seed'> = {},
): SimInput {
  return {
    seed: `${PRACTICAL_SEED}-d${state.calendar.totalDaysElapsed}`,
    ...extra,
  }
}

function intentFor(
  seed: IssueSeed,
  slotId: string,
  suffix: string,
): ResponseIntent {
  const slot = seed.responseSlots.find((candidate) => candidate.id === slotId)
  if (!slot) throw new Error(`Missing ${slotId} on ${seed.id}`)
  const verb = slot.allowedVerbs[0]
  if (!verb) throw new Error(`Missing verb on ${seed.id}/${slotId}`)
  return {
    id: `phase5-${suffix}`,
    seedId: seed.id,
    verb,
    shape: slot.shape,
    ...(slot.targetOptions[0] ? { target: slot.targetOptions[0] } : {}),
    tags: [],
    intensity: 1,
    metadata: { responseSlotId: slot.id },
  }
}

function familySeed(seeds: IssueSeed[], family: string): IssueSeed {
  const seed = seeds.find((candidate) => candidate.family === family)
  if (!seed) throw new Error(`Missing ${family} seed`)
  return seed
}

function slotSeed(seeds: IssueSeed[], slotId: string): IssueSeed {
  const seed = seeds.find((candidate) =>
    candidate.responseSlots.some((slot) => slot.id === slotId),
  )
  if (!seed) throw new Error(`Missing seed with slot ${slotId}`)
  return seed
}

function serviceSummary(state: TavernState) {
  const service = state.modules.service as ServiceModuleState
  return {
    patrons: Object.values(service.result.trafficByGroup).reduce(
      (sum, value) => sum + value,
      0,
    ),
    netCoin: service.result.netCoinEarned,
    incidents: service.result.incidents.length,
  }
}

function ownerActionSummary(state: TavernState) {
  const actions = state.modules.ownerActions as OwnerActionsModuleState
  return {
    timeSpent: actions.timeSpent,
    applied: actions.applied.map((entry) => ({
      actionId: entry.actionId,
      label: entry.label,
      timeCost: entry.timeCost,
      targetId: entry.targetId,
    })),
    rejected: actions.rejected,
  }
}

function pressureLeaders(state: TavernState) {
  return Object.values(state.pressures)
    .sort((a, b) => b.value - a.value)
    .slice(0, 5)
    .map((pressure) => ({
      id: pressure.id,
      value: pressure.value,
      trend: pressure.trend,
    }))
}

function complaintDiagnostic(seed: IssueSeed) {
  const fix = seed.consequenceProfiles.find(
    (profile) => profile.responseSlotId === 'fix_root',
  )
  const effectTargets = (fix?.immediateEffects ?? [])
    .map((effect) => effect.target)
    .filter((target) => target.startsWith('areas.'))
  return {
    id: seed.id,
    primaryActor: seed.primaryActor,
    recentContext: seed.textIngredients.recentContext,
    causes: seed.causes.map((cause) => ({
      id: cause.id,
      readable: cause.readable,
      target: cause.target,
      tags: cause.tags,
      locations: cause.relatedLocations,
    })),
    fixRootTargets: seed.responseSlots
      .find((slot) => slot.id === 'fix_root')
      ?.targetOptions.map((target) => target.id),
    fixRootEffectTargets: effectTargets,
  }
}

function shortageDiagnostic(seed: IssueSeed, state: TavernState) {
  const target = seed.responseSlots
    .find((slot) => slot.id === 'restock')
    ?.targetOptions[0]
  const stockId = target?.id
  const consumingRecipes = stockId
    ? recipeRegistry
        .all()
        .filter((definition) =>
          definition.inputs.some((input) => input.ingredientId === stockId),
        )
        .map((definition) => ({
          id: definition.id,
          label: definition.label,
          demandTier: definition.demandTier,
          onMenu: state.recipes[definition.id]?.onMenu,
          timesServed: state.recipes[definition.id]?.timesServed,
        }))
    : []
  return {
    id: seed.id,
    target: stockId,
    quantity: stockId ? state.stock[stockId]?.quantity : undefined,
    consumingRecipes,
    recentContext: seed.textIngredients.recentContext,
    stakes: seed.stakes.map((stake) => stake.readable),
  }
}

function responseSummary(state: TavernState) {
  const responses = state.modules.responses as ResponsesModuleState
  return {
    resolvedToday: responses.resolvedToday.map((entry) => ({
      seedId: entry.seedId,
      slotId: entry.responseSlotId,
      profileId: entry.profileId,
    })),
    pending: responses.pending.map((entry) => ({
      id: entry.id,
      scheduledFor: entry.scheduledFor,
      expiresAt: entry.expiresAt,
      payload: entry.payload,
    })),
    appliedFromPendingToday: responses.appliedFromPendingToday,
  }
}

function runPracticalReplay(): {
  days: ReplayDay[]
  summary: unknown[]
  complaints: unknown[]
  shortages: unknown[]
} {
  let state = createInitialTavernState(undefined, DIFFICULTY_PRESETS.standard)
  const days: ReplayDay[] = []

  for (let day = 1; day <= 7; day += 1) {
    const baseline = structuredClone(state)
    const a = advanceDaySegment(
      state,
      inputFor(state, { staffPriorities: STICKY_PRIORITIES }),
      FULL_PIPELINE,
      'A',
    )
    state = a.state
    const morningSeeds = structuredClone(getResolvableSeedsToday(state))

    let ownerActions: SimInputOwnerAction[] = []
    if (day === 1) {
      ownerActions = [
        { actionId: 'fumigate_cellar', targetId: 'cellar' },
        { actionId: 'water_down_ale', targetId: 'ale' },
        { actionId: 'improve_stew', targetId: 'stew' },
        { actionId: 'toggle_recipe_menu', targetId: 'dish_stew' },
      ]
    } else if (day === 2) {
      ownerActions = [
        { actionId: 'buy_mugs', targetId: 'mugs' },
        { actionId: 'toggle_recipe_menu', targetId: 'dish_stew' },
        { actionId: 'improve_stew', targetId: 'stew' },
      ]
    } else if (day === 3) {
      ownerActions = [
        {
          actionId: 'comfort_stressed_staff',
          targetId: 'cleaner_bouncer',
        },
      ]
    }

    const b = advanceDaySegment(
      state,
      inputFor(state, {
        ownerActions,
        staffPriorities: STICKY_PRIORITIES,
      }),
      FULL_PIPELINE,
      'B',
      { dayBaseline: baseline },
    )
    state = b.state
    const allAtService = getResolvableSeedsToday(state)
    const serviceSeeds = structuredClone(
      allAtService.filter(
        (seed) => !morningSeeds.some((morning) => morning.id === seed.id),
      ),
    )

    const responseIntents: ResponseIntent[] = []
    if (day === 1) {
      responseIntents.push(
        intentFor(
          familySeed(allAtService, 'opening'),
          'decline',
          'opening-decline',
        ),
      )
    }
    if (day === 3) {
      responseIntents.push(
        intentFor(
          slotSeed(allAtService, 'compete_on_quality'),
          'compete_on_quality',
          'seasonal-quality',
        ),
      )
      responseIntents.push(
        intentFor(
          familySeed(allAtService, 'staff_arc'),
          'mark_milestone',
          'staff-mark',
        ),
      )
      responseIntents.push(
        intentFor(
          familySeed(allAtService, 'customer_complaint'),
          'fix_root',
          'complaint-fix-root',
        ),
      )
    }

    const c = advanceDaySegment(
      state,
      inputFor(state, {
        responseIntents,
        staffPriorities: STICKY_PRIORITIES,
      }),
      FULL_PIPELINE,
      'C',
      { dayBaseline: baseline },
    )
    state = c.state
    days.push({ day, morningSeeds, serviceSeeds, result: c, baseline })
  }

  const summary = days.map((entry) => {
    const report = buildDailyReport(entry.result, entry.result.state, {
      previousCalendar: entry.baseline.calendar,
    })
    const satisfactionRows = report.groupedDiffs.other
      .filter(
        (diff) =>
          diff.path.startsWith('customers.') &&
          diff.path.endsWith('.satisfaction'),
      )
      .map((diff) => ({
        path: diff.path,
        humanReadable: diff.humanReadable,
      }))
    return {
      day: entry.day,
      morningHand: entry.morningSeeds.map((seed) => seed.family),
      serviceHand: entry.serviceSeeds.map((seed) => seed.family),
      service: serviceSummary(entry.result.state),
      coinAfter: entry.result.state.coin,
      actions: ownerActionSummary(entry.result.state),
      stickyPriority: STICKY_PRIORITIES,
      satisfactionRows,
      missedOpportunities: report.missedOpportunities?.map((line) => ({
        seedId: line.seedId,
        family: line.family,
        status: line.status,
      })),
      futureHooks: report.futureHooks.map((hook) => hook.readable),
      responses: responseSummary(entry.result.state),
      pressureLeaders: pressureLeaders(entry.result.state),
      reportSections: entry.result.reports.map((section) => section.id),
      validationErrors: entry.result.validation.errors,
    }
  })

  const complaints = days.flatMap((entry) =>
    [...entry.morningSeeds, ...entry.serviceSeeds]
      .filter((seed) => seed.family === 'customer_complaint')
      .map((seed) => ({
        day: entry.day,
        ...complaintDiagnostic(seed),
      })),
  )

  const shortages = days.flatMap((entry) =>
    [...entry.morningSeeds, ...entry.serviceSeeds]
      .filter((seed) => seed.family === 'stock_shortage')
      .map((seed) => ({
        day: entry.day,
        ...shortageDiagnostic(seed, entry.baseline),
      })),
  )

  return { days, summary, complaints, shortages }
}

function runDifficultyProbe() {
  return (Object.keys(DIFFICULTY_PRESETS) as DifficultyId[]).map((id) => {
    const initial = createInitialTavernState(undefined, DIFFICULTY_PRESETS[id])
    const cleanliness = Object.values(initial.areas).map((area) => area.cleanliness)
    const baseline = structuredClone(initial)
    const input: SimInput = { seed: 'phase5-difficulty-fixed-d0' }
    const a = advanceDaySegment(initial, input, FULL_PIPELINE, 'A')
    const forecasts = (a.state.modules.customers as CustomerModuleState).forecasts
    const b = advanceDaySegment(a.state, input, FULL_PIPELINE, 'B', {
      dayBaseline: baseline,
    })
    const c = advanceDaySegment(b.state, input, FULL_PIPELINE, 'C', {
      dayBaseline: baseline,
    })
    return {
      id,
      startingCoin: baseline.coin,
      cleanliness: {
        min: Math.min(...cleanliness),
        max: Math.max(...cleanliness),
        average:
          Math.round(
            (cleanliness.reduce((sum, value) => sum + value, 0) /
              cleanliness.length) *
              10,
          ) / 10,
      },
      startingPressures: Object.fromEntries(
        ['food_safety', 'maintenance', 'pests'].map((pressureId) => [
          pressureId,
          baseline.pressures[pressureId]?.value,
        ]),
      ),
      forecastPatrons: forecasts.reduce(
        (sum, forecast) => sum + forecast.expected,
        0,
      ),
      service: serviceSummary(c.state),
      endingCoin: c.state.coin,
      validationErrors: c.validation.errors,
    }
  })
}

function runBudgetProbe() {
  const cases: Array<{
    id: string
    actions: SimInputOwnerAction[]
  }> = [
    {
      id: 'partial_90',
      actions: [
        { actionId: 'buy_mugs', targetId: 'mugs' },
        { actionId: 'improve_stew', targetId: 'stew' },
      ],
    },
    {
      id: 'exact_360',
      actions: [
        { actionId: 'fumigate_cellar', targetId: 'cellar' },
        { actionId: 'water_down_ale', targetId: 'ale' },
        { actionId: 'improve_stew', targetId: 'stew' },
      ],
    },
    {
      id: 'overflow_390',
      actions: [
        { actionId: 'fumigate_cellar', targetId: 'cellar' },
        { actionId: 'water_down_ale', targetId: 'ale' },
        { actionId: 'improve_stew', targetId: 'stew' },
        { actionId: 'buy_mugs', targetId: 'mugs' },
      ],
    },
  ]
  return cases.map((entry) => {
    const result = simulateDay(
      createInitialTavernState(),
      {
        seed: `phase5-budget-${entry.id}`,
        ownerActions: entry.actions,
      },
      FULL_PIPELINE,
    )
    return {
      id: entry.id,
      ...ownerActionSummary(result.state),
      validationErrors: result.validation.errors,
    }
  })
}

function runMonthAndCadenceProbe() {
  const run = runCardlessSim({
    seed: 'phase5-cadence-fixed',
    days: 28,
  })
  const days = run.days.map((record) => {
    const seeds = getAllSeedsToday(record.result.state)
    const timingCounts = seeds.reduce<Record<string, number>>((out, seed) => {
      out[seed.timing] = (out[seed.timing] ?? 0) + 1
      return out
    }, {})
    const report = buildDailyReport(record.result, record.result.state, {
      previousCalendar: record.stateBefore.calendar,
    })
    return {
      day: record.index,
      calendarBefore: record.stateBefore.calendar,
      seedCount: seeds.length,
      timingCounts,
      families: seeds.map((seed) => seed.family),
      weeklyDigest: Boolean(report.weeklyDigest),
      monthlyDigest: Boolean(report.monthlyDigest),
      validationErrors: record.result.validation.errors.length,
    }
  })
  return {
    validatedThroughout: run.validatedThroughout,
    finalCalendar: run.finalState.calendar,
    weeklyBoundaryDays: days
      .filter((day) => day.weeklyDigest)
      .map((day) => day.day),
    monthlyBoundaryDays: days
      .filter((day) => day.monthlyDigest)
      .map((day) => day.day),
    seedCount: {
      min: Math.min(...days.map((day) => day.seedCount)),
      max: Math.max(...days.map((day) => day.seedCount)),
      average:
        Math.round(
          (days.reduce((sum, day) => sum + day.seedCount, 0) / days.length) *
            100,
        ) / 100,
    },
    days,
  }
}

function runStrategyProbe() {
  const comparison = buildStrategyComparison(runStrategyMatrix(28))
  return {
    diverseEnoughForReadiness: comparison.diverseEnoughForReadiness,
    distinctIdentityKeys: comparison.distinctIdentityKeys,
    distinctDominantCustomerGroups:
      comparison.distinctDominantCustomerGroups,
    endingCoinSpread: comparison.endingCoinSpread,
    rows: comparison.rows.map((row) => ({
      botId: row.botId,
      finalCoin: row.summary.finalCoin,
      netCoinChange: row.summary.netCoinChange,
      validatedThroughout: row.summary.validatedThroughout,
      identity: row.summary.reputationIdentity.identityKey,
      dominantCustomerGroup: row.summary.dominantCustomerGroup,
      totalSeedsGenerated: row.summary.totalSeedsGenerated,
      uniqueIssueSeedFamilies: row.summary.uniqueIssueSeedFamilies.length,
      contradictions: row.contradictions,
    })),
  }
}

const requestedSection = process.argv[2]
let output: unknown
if (requestedSection === 'practicalReplay') {
  output = runPracticalReplay().summary
} else if (requestedSection === 'complaintDiagnostics') {
  output = runPracticalReplay().complaints
} else if (requestedSection === 'shortageDiagnostics') {
  output = runPracticalReplay().shortages
} else if (requestedSection === 'difficultyProbe') {
  output = runDifficultyProbe()
} else if (requestedSection === 'budgetProbe') {
  output = runBudgetProbe()
} else if (requestedSection === 'monthAndCadenceProbe') {
  output = runMonthAndCadenceProbe()
} else if (requestedSection === 'strategyProbe') {
  output = runStrategyProbe()
} else {
  const practical = runPracticalReplay()
  output = {
    practicalReplay: practical.summary,
    complaintDiagnostics: practical.complaints,
    shortageDiagnostics: practical.shortages,
    difficultyProbe: runDifficultyProbe(),
    budgetProbe: runBudgetProbe(),
    monthAndCadenceProbe: runMonthAndCadenceProbe(),
    strategyProbe: runStrategyProbe(),
  }
}

console.log(JSON.stringify(output, null, 2))
