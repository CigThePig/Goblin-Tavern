import { buildMonthlyOverview } from '../../../../src/reports/monthlyOverviewProjection'
import { buildWeeklyOverview } from '../../../../src/reports/weeklyOverviewProjection'
import { FULL_PIPELINE } from '../../../../src/sim/canonicalPipeline'
import { advanceDaySegment } from '../../../../src/sim/core/engine'
import type { SimInput } from '../../../../src/sim/core/context'
import type { SimResult } from '../../../../src/sim/core/result'
import { getLocalArcsModuleState } from '../../../../src/sim/modules/localArcs/state'
import { getMonthlyModuleState } from '../../../../src/sim/modules/monthly/monthlyModule'
import { getAllSeedsToday } from '../../../../src/sim/modules/issues/issueSeedQueries'
import { getWeeklyModuleState } from '../../../../src/sim/modules/weekly/state'
import { createInitialTavernState } from '../../../../src/sim/state/defaults'
import type { TavernState } from '../../../../src/sim/state/TavernState'

const ROOT_SEED = 'phase4-periodic-fixed'

function inputFor(state: TavernState): SimInput {
  return {
    seed: `${ROOT_SEED}-d${state.calendar.totalDaysElapsed}`,
  }
}

function reportSummary(result: SimResult) {
  return result.reports
    .filter((section) => ['weekly', 'monthly', 'localArcs'].includes(section.id))
    .map((section) => ({
      id: section.id,
      source: section.source,
      title: section.title,
      lines: section.lines,
    }))
}

function arcSummary(state: TavernState) {
  const slice = getLocalArcsModuleState(state)
  return {
    module: {
      lastMonthlyTickDay: slice.lastMonthlyTickDay,
      activeArcIds: slice.activeArcIds,
      activeArcTags: slice.activeArcTags,
      activeIssueSeedTags: slice.activeIssueSeedTags,
      activeMarketConditionIds: slice.activeMarketConditionIds,
      recentlyAppliedEffects: slice.recentlyAppliedEffects,
      monthlyCalendarTagsSeen: slice.monthlyCalendarTagsSeen,
    },
    world: Object.values(state.world.localEvents)
      .filter((event) => event.stage !== undefined)
      .map((event) => ({
        id: event.id,
        definitionId: event.definitionId,
        label: event.label,
        stage: event.stage,
        startedDay: event.startedDay,
        lastUpdatedDay: event.lastUpdatedDay,
        ageDays: event.ageDays,
        intensity: event.intensity,
        activeEffects: event.activeEffects,
        arcHistory: event.arcHistory,
      })),
  }
}

function boundarySummary(
  before: TavernState,
  result: SimResult,
) {
  const state = result.state
  const weekly = getWeeklyModuleState(state)
  const monthly = getMonthlyModuleState(state)
  const weeklyOverview = buildWeeklyOverview(state)
  const monthlyOverview = buildMonthlyOverview(state)
  return {
    before: {
      calendar: before.calendar,
      coin: before.coin,
      weeklyHistoryCount: getWeeklyModuleState(before).weeklyHistory.length,
      monthlyHistoryCount: getMonthlyModuleState(before).monthlyHistory.length,
      arcs: arcSummary(before),
    },
    after: {
      calendar: state.calendar,
      coin: state.coin,
      weekly: {
        weekKey: weekly.weekKey,
        weekFinalized: weekly.weekFinalized,
        weeklyHistoryCount: weekly.weeklyHistory.length,
        lastWeeklyResult: weekly.lastWeeklyResult
          ? {
              weekKey: weekly.lastWeeklyResult.weekKey,
              endDay: weekly.lastWeeklyResult.endDay,
              economy: weekly.lastWeeklyResult.economy,
              wages: weekly.lastWeeklyResult.wages,
              maintenanceCount: weekly.lastWeeklyResult.maintenance.length,
              staffTrendCount: weekly.lastWeeklyResult.staffTrend.length,
              customerTrendCount: weekly.lastWeeklyResult.customerTrend.length,
              community: {
                supplierTrendCount:
                  weekly.lastWeeklyResult.community.supplierTrend.length,
                regularTrendCount:
                  weekly.lastWeeklyResult.community.regularTrend.length,
                factionTrendCount:
                  weekly.lastWeeklyResult.community.factionTrend.length,
                rumourCount: weekly.lastWeeklyResult.community.rumours.length,
              },
            }
          : undefined,
      },
      monthly: {
        monthKey: monthly.monthKey,
        monthFinalized: monthly.monthFinalized,
        monthlyHistoryCount: monthly.monthlyHistory.length,
        accumulatorWeekKeys: monthly.accumulator.weekKeys,
        lastMonthlyResult: monthly.lastMonthlyResult
          ? {
              monthKey: monthly.lastMonthlyResult.monthKey,
              endDay: monthly.lastMonthlyResult.endDay,
              endingCoin: monthly.lastMonthlyResult.endingCoin,
              rent: monthly.lastMonthlyResult.rent,
              landlord: monthly.lastMonthlyResult.landlord,
              inspection: monthly.lastMonthlyResult.inspection,
              rivalTavern: monthly.lastMonthlyResult.rivalTavern,
              reputationShifts: monthly.lastMonthlyResult.reputationShifts,
              activeModifier: monthly.lastMonthlyResult.activeModifier,
              nextMonthModifier: monthly.lastMonthlyResult.nextMonthModifier,
              strategicSummary: monthly.lastMonthlyResult.strategicSummary,
            }
          : undefined,
      },
      arcs: arcSummary(state),
      weeklyOverview: weeklyOverview.hasResult
        ? {
            hasResult: true,
            header: weeklyOverview.header,
            economy: weeklyOverview.economy,
            wages: weeklyOverview.wages,
            maintenanceCount: weeklyOverview.maintenance?.rows.length ?? 0,
            community: weeklyOverview.community,
          }
        : weeklyOverview,
      monthlyOverview: monthlyOverview.hasResult
        ? {
            hasResult: true,
            header: monthlyOverview.header,
            rent: monthlyOverview.rent,
            landlord: monthlyOverview.landlord,
            inspection: monthlyOverview.inspection,
            arcs: monthlyOverview.arcs,
            activeModifier: monthlyOverview.activeModifier,
            nextMonthModifier: monthlyOverview.nextMonthModifier,
            strategicSummary: monthlyOverview.strategicSummary,
          }
        : monthlyOverview,
      reports: reportSummary(result),
      validation: result.validation,
    },
  }
}

let state = createInitialTavernState()
const trace: Record<string, unknown> = { rootSeed: ROOT_SEED }

for (let run = 1; run <= 57; run += 1) {
  const baseline = structuredClone(state)
  const a = advanceDaySegment(state, inputFor(state), FULL_PIPELINE, 'A')
  if (run === 57) {
    trace.month2ArcNextMorning = {
      calendar: a.state.calendar,
      arcs: arcSummary(a.state),
      seeds: getAllSeedsToday(a.state).map((seed) => ({
        id: seed.id,
        family: seed.family,
        timing: seed.timing,
        primaryActor: seed.primaryActor,
        affectedActors: seed.affectedActors,
        causeIds: seed.causes.map((cause) => cause.id),
        tags: seed.tags,
      })),
      validation: a.validation,
    }
  }
  const b = advanceDaySegment(
    a.state,
    inputFor(a.state),
    FULL_PIPELINE,
    'B',
    { dayBaseline: baseline },
  )
  const c = advanceDaySegment(
    b.state,
    inputFor(b.state),
    FULL_PIPELINE,
    'C',
    { dayBaseline: baseline },
  )
  state = c.state

  if (run === 7) trace.week1Close = boundarySummary(b.state, c)
  if (run === 8) trace.week1NextDay = boundarySummary(b.state, c)
  if (run === 28) trace.month1Close = boundarySummary(b.state, c)
  if (run === 29) trace.month1NextDay = boundarySummary(b.state, c)
  if (run === 56) trace.month2Close = boundarySummary(b.state, c)
  if (run === 57) trace.month2NextDay = boundarySummary(b.state, c)
}

const section = process.env.PHASE4_PERIODIC_SECTION
console.log(JSON.stringify(section ? trace[section] : trace, null, 2))
