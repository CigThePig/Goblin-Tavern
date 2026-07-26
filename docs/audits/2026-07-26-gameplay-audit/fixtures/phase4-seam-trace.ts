import { FULL_PIPELINE } from '../../../../src/sim/canonicalPipeline'
import { advanceDaySegment } from '../../../../src/sim/core/engine'
import type { SimInput } from '../../../../src/sim/core/context'
import type { SimResult } from '../../../../src/sim/core/result'
import type {
  CauseEntry,
  TavernState,
} from '../../../../src/sim/state/TavernState'
import { createInitialTavernState } from '../../../../src/sim/state/defaults'
import {
  getAllSeedsToday,
  getResolvableSeedsToday,
} from '../../../../src/sim/modules/issues/issueSeedQueries'
import type {
  IssueSeed,
  ResponseIntent,
} from '../../../../src/sim/modules/issues/issueSeedTypes'
import type { CustomerModuleState } from '../../../../src/sim/modules/customers/types'
import type { ServiceModuleState } from '../../../../src/sim/modules/service/types'
import type { OwnerActionsModuleState } from '../../../../src/sim/modules/ownerActions/types'
import type { PressureModuleState } from '../../../../src/sim/modules/pressures/pressureModule'
import type { ResponsesModuleState } from '../../../../src/sim/modules/responses/types'
import type {
  OpeningsModuleState,
} from '../../../../src/sim/modules/openings/types'
import {
  LIQUOR_LICENSE_TRANSFORMATION_ID,
  LIQUOR_LICENSE_VENTURE_ID,
} from '../../../../src/sim/modules/ventures/liquorLicense'
import { causesForPath } from '../../../../src/reports/causeLookup'
import { buildDailyReport } from '../../../../src/reports/dailyReportProjection'

const ROOT_SEED = 'phase4-seams-fixed'

type SegmentRun = {
  result: SimResult
  baseline: TavernState
}

function inputFor(state: TavernState, extra: Omit<SimInput, 'seed'> = {}): SimInput {
  return {
    seed: `${ROOT_SEED}-d${state.calendar.totalDaysElapsed}`,
    ...extra,
  }
}

function runA(state: TavernState): SegmentRun {
  const baseline = structuredClone(state)
  const result = advanceDaySegment(state, inputFor(state), FULL_PIPELINE, 'A')
  return { result, baseline }
}

function runB(
  state: TavernState,
  baseline: TavernState,
  extra: Omit<SimInput, 'seed'> = {},
): SimResult {
  return advanceDaySegment(
    state,
    inputFor(state, extra),
    FULL_PIPELINE,
    'B',
    { dayBaseline: baseline },
  )
}

function runC(
  state: TavernState,
  baseline: TavernState,
  extra: Omit<SimInput, 'seed'> = {},
): SimResult {
  return advanceDaySegment(
    state,
    inputFor(state, extra),
    FULL_PIPELINE,
    'C',
    { dayBaseline: baseline },
  )
}

function seedById(state: TavernState, id: string): IssueSeed {
  const seed = getResolvableSeedsToday(state).find((candidate) => candidate.id === id)
  if (!seed) throw new Error(`Missing seed ${id}`)
  return seed
}

function seedByFamily(state: TavernState, family: string): IssueSeed {
  const seed = getResolvableSeedsToday(state).find((candidate) => candidate.family === family)
  if (!seed) throw new Error(`Missing ${family} seed`)
  return seed
}

function intentFor(seed: IssueSeed, slotId: string, id: string): ResponseIntent {
  const slot = seed.responseSlots.find((candidate) => candidate.id === slotId)
  if (!slot) throw new Error(`Missing slot ${slotId} on ${seed.id}`)
  const verb = slot.allowedVerbs[0]
  if (!verb) throw new Error(`Missing verb on ${seed.id}/${slotId}`)
  return {
    id,
    seedId: seed.id,
    verb,
    shape: slot.shape,
    ...(slot.targetOptions[0] ? { target: slot.targetOptions[0] } : {}),
    tags: [],
    intensity: 1,
    metadata: { responseSlotId: slot.id },
  }
}

function forecastTotal(state: TavernState): number {
  const slice = state.modules.customers as CustomerModuleState
  return slice.forecasts.reduce((total, forecast) => total + forecast.expected, 0)
}

function serviceSummary(state: TavernState) {
  const slice = state.modules.service as ServiceModuleState
  const result = slice.result
  return {
    dayKey: result.dayKey,
    patrons: Object.values(result.trafficByGroup).reduce((a, b) => a + b, 0),
    netCoinEarned: result.netCoinEarned,
    incidents: result.incidents.map((incident) => incident.id),
    stockConsumed: result.stockConsumed,
  }
}

function actionSummary(state: TavernState) {
  const slice = state.modules.ownerActions as OwnerActionsModuleState
  return {
    timeSpent: slice.timeSpent,
    applied: slice.applied,
    rejected: slice.rejected,
  }
}

function seedSummary(state: TavernState) {
  return getAllSeedsToday(state).map((seed) => ({
    id: seed.id,
    family: seed.family,
    timing: seed.timing,
    refs: {
      primaryActor: seed.primaryActor,
      affectedActors: seed.affectedActors,
      causeIds: seed.causes.map((cause) => cause.id),
      stakeIds: seed.stakes.map((stake) => stake.id),
    },
    slots: seed.responseSlots.map((slot) => ({
      id: slot.id,
      verbs: slot.allowedVerbs,
      targetIds: slot.targetOptions.map((target) => target.id),
    })),
  }))
}

function causeSummary(causes: CauseEntry[]) {
  return causes.map((cause) => ({
    id: cause.id,
    source: cause.source,
    target: cause.target,
    amount: cause.amount,
    weight: cause.weight,
    readable: cause.readable,
    day: cause.timestamp.absoluteDay,
    tags: cause.tags,
  }))
}

function pressureSummary(state: TavernState, ids: string[]) {
  const slice = state.modules.pressures as PressureModuleState
  return Object.fromEntries(
    ids.map((id) => [
      id,
      {
        state: state.pressures[id],
        snapshot: slice.snapshots[id]
          ? {
              value: slice.snapshots[id]!.value,
              previousValue: slice.snapshots[id]!.previousValue,
              delta: slice.snapshots[id]!.delta,
              causes: slice.snapshots[id]!.causes.map((cause) => ({
                id: cause.id,
                amount: cause.amount,
                readable: cause.readable,
              })),
            }
          : undefined,
      },
    ]),
  )
}

function responsesSummary(state: TavernState) {
  const slice = state.modules.responses as ResponsesModuleState
  return {
    resolvedToday: slice.resolvedToday,
    pending: slice.pending.map((entry) => ({
      id: entry.id,
      origin: entry.origin,
      scheduledFor: entry.scheduledFor,
      expiresAt: entry.expiresAt,
      payload: entry.payload,
    })),
    appliedFromPendingToday: slice.appliedFromPendingToday,
  }
}

function reportSummary(result: SimResult, baselineCalendar: TavernState['calendar']) {
  const report = buildDailyReport(result, result.state, {
    previousCalendar: baselineCalendar,
  })
  return {
    header: report.header,
    ownerActions: report.ownerActionsApplied,
    responses: report.resolvedIntents,
    groupedDiffs: report.groupedDiffs,
    futureHooks: report.futureHooks,
    missedOpportunities: report.missedOpportunities,
  }
}

const trace: Record<string, unknown> = {
  rootSeed: ROOT_SEED,
}

let state = createInitialTavernState()

// Day 1: opening + forecast -> plan -> fumigation -> service -> response/report.
const d1a = runA(state)
state = d1a.result.state
const openingSeed = seedByFamily(state, 'opening')
const openings = state.modules.openings as OpeningsModuleState
trace.day1A = {
  calendar: state.calendar,
  forecastTotal: forecastTotal(state),
  seeds: seedSummary(state),
  openingRecords: openings.openings,
  pressures: pressureSummary(state, ['pests', 'food_safety', 'maintenance']),
}

const d1b = runB(state, d1a.baseline, {
  ownerActions: [{ actionId: 'fumigate_cellar', targetId: 'cellar' }],
})
state = d1b.state
trace.day1B = {
  calendar: state.calendar,
  action: actionSummary(state),
  service: serviceSummary(state),
  pressures: pressureSummary(state, ['pests', 'food_safety', 'maintenance']),
  visibleSeeds: seedSummary(state),
  pestCausesCurrentDay: causeSummary(
    state.causes.filter(
      (cause) =>
        cause.target.startsWith('pressure:pests') &&
        cause.timestamp.absoluteDay === state.calendar.totalDaysElapsed,
    ),
  ),
}

const openingIntent = intentFor(openingSeed, 'pursue', 'phase4-intent-opening-pursue')
const d1c = runC(state, d1a.baseline, { responseIntents: [openingIntent] })
state = d1c.state
trace.day1C = {
  calendar: state.calendar,
  intent: openingIntent,
  venture: state.ventures[LIQUOR_LICENSE_VENTURE_ID],
  openingRecords: (state.modules.openings as OpeningsModuleState).openings,
  responses: responsesSummary(state),
  pestDrilldown: causeSummary(causesForPath(state, 'pressures.pests')),
  report: reportSummary(d1c, d1a.baseline.calendar),
  validation: d1c.validation,
}

// Day 2: area issue + venture issue -> immediate and delayed effects.
const d2a = runA(state)
state = d2a.result.state
const areaSeed = seedById(state, 'seed-area_atmosphere-main_room-d1')
const ventureSeedD2 = seedById(state, 'venture_venture_liquor_license_paperwork')
trace.day2A = {
  calendar: state.calendar,
  forecastTotal: forecastTotal(state),
  seeds: seedSummary(state),
  venture: state.ventures[LIQUOR_LICENSE_VENTURE_ID],
}
const d2b = runB(state, d2a.baseline)
state = d2b.state
const areaIntent = intentFor(areaSeed, 'start_project', 'phase4-intent-area-project')
const ventureIntentD2 = intentFor(
  ventureSeedD2,
  'invest_owner_time',
  'phase4-intent-venture-invest-1',
)
const d2c = runC(state, d2a.baseline, {
  responseIntents: [areaIntent, ventureIntentD2],
})
state = d2c.state
trace.day2C = {
  calendar: state.calendar,
  intents: [areaIntent, ventureIntentD2],
  mainRoom: state.areas.main_room,
  coin: state.coin,
  venture: state.ventures[LIQUOR_LICENSE_VENTURE_ID],
  responses: responsesSummary(state),
  causes: causeSummary(
    state.causes.filter(
      (cause) =>
        cause.timestamp.absoluteDay === 1 &&
        (cause.tags.includes('response') || cause.tags.includes('teleology')),
    ),
  ),
  report: reportSummary(d2c, d2a.baseline.calendar),
  validation: d2c.validation,
}

// Day 3: second venture investment activates the transformation.
const d3a = runA(state)
state = d3a.result.state
const ventureSeedD3 = seedById(state, 'venture_venture_liquor_license_paperwork')
trace.day3A = {
  calendar: state.calendar,
  seed: seedSummary(state).find(
    (candidate) => candidate.id === 'venture_venture_liquor_license_paperwork',
  ),
  venture: state.ventures[LIQUOR_LICENSE_VENTURE_ID],
}
const d3b = runB(state, d3a.baseline)
state = d3b.state
const ventureIntentD3 = intentFor(
  ventureSeedD3,
  'invest_owner_time',
  'phase4-intent-venture-invest-2',
)
const d3c = runC(state, d3a.baseline, { responseIntents: [ventureIntentD3] })
state = d3c.state
trace.day3C = {
  calendar: state.calendar,
  intent: ventureIntentD3,
  venture: state.ventures[LIQUOR_LICENSE_VENTURE_ID],
  transformation: state.transformations[LIQUOR_LICENSE_TRANSFORMATION_ID],
  responses: responsesSummary(state),
  transformationCauses: causeSummary(
    state.causes.filter(
      (cause) =>
        cause.timestamp.absoluteDay === 2 &&
        (cause.tags.includes('teleology') ||
          cause.target.includes(LIQUOR_LICENSE_TRANSFORMATION_ID)),
    ),
  ),
  report: reportSummary(d3c, d3a.baseline.calendar),
  validation: d3c.validation,
}

// Day 4 morning: transformation-gated content can now enter the generator set.
const d4a = runA(state)
state = d4a.result.state
trace.day4A = {
  calendar: state.calendar,
  venture: state.ventures[LIQUOR_LICENSE_VENTURE_ID],
  transformation: state.transformations[LIQUOR_LICENSE_TRANSFORMATION_ID],
  seeds: seedSummary(state),
  licensedFamilies: getAllSeedsToday(state)
    .filter((seed) => seed.family === 'liquor_compliance' || seed.family === 'licensed_service')
    .map((seed) => seed.id),
  responses: responsesSummary(state),
}

// Advance Day 4 so Day 5 start-day drains the Day 2 +3-day deferred queue.
const d4b = runB(state, d4a.baseline)
state = d4b.state
const d4c = runC(state, d4a.baseline)
state = d4c.state
const beforeDeferred = {
  mainRoomCondition: state.areas.main_room.condition,
  maintenancePressure: state.pressures.maintenance?.value,
  responses: responsesSummary(state),
}

const d5a = runA(state)
state = d5a.result.state
trace.day5A = {
  calendar: state.calendar,
  beforeDeferred,
  afterDeferred: {
    mainRoomCondition: state.areas.main_room.condition,
    maintenancePressure: state.pressures.maintenance?.value,
    responses: responsesSummary(state),
  },
  appliedPendingCauses: causeSummary(
    state.causes.filter(
      (cause) =>
        cause.timestamp.absoluteDay === 4 &&
        (cause.tags.includes('response') ||
          cause.source.startsWith('response.')),
    ),
  ),
  seeds: seedSummary(state),
}

const d5b = runB(state, d5a.baseline)
state = d5b.state
const d5c = runC(state, d5a.baseline)
state = d5c.state
trace.day5C = {
  calendar: state.calendar,
  mainRoomCondition: state.areas.main_room.condition,
  pressureState: state.pressures.maintenance,
  pressureSnapshot: (state.modules.pressures as PressureModuleState).snapshots
    .maintenance,
  responses: responsesSummary(state),
  maintenanceCauses: causeSummary(
    state.causes.filter(
      (cause) =>
        cause.timestamp.absoluteDay === 4 &&
        cause.target.startsWith('pressure:maintenance'),
    ),
  ),
  report: reportSummary(d5c, d5a.baseline.calendar),
  validation: d5c.validation,
}

// Day 6 morning: inspect staff-arc state and any seasonal-arc seed attribution.
const d6a = runA(state)
state = d6a.result.state
trace.day6A = {
  calendar: state.calendar,
  arcs: state.arcs,
  seasonalSeeds: getAllSeedsToday(state)
    .filter((seed) => seed.family === 'seasonal_arc')
    .map((seed) => ({
      id: seed.id,
      subject: seed.subject,
      primaryActor: seed.primaryActor,
      tags: seed.tags,
      causes: seed.causes,
      stakes: seed.stakes,
    })),
  currentDayArcCauses: causeSummary(
    state.causes.filter(
      (cause) =>
        cause.timestamp.absoluteDay === state.calendar.totalDaysElapsed &&
        (cause.tags.includes('arc') ||
          cause.source.startsWith('arcs') ||
          cause.source.startsWith('localArcs')),
    ),
  ),
  seeds: seedSummary(state),
  validation: d6a.result.validation,
}

const requestedSection = process.env.PHASE4_TRACE_SECTION
console.log(
  JSON.stringify(
    requestedSection ? { [requestedSection]: trace[requestedSection] } : trace,
    null,
    2,
  ),
)
