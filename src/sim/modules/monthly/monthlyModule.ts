import { z } from 'zod'

import type { SimulationHook, SimulationModule } from '../../core/module'
import type { SimContext } from '../../core/context'
import type { ReportSection } from '../../core/reports'
import type { ValidationIssue } from '../../state/types'
import { clampPercent } from '../../state/normalize'
import type { ReputationState, TavernState } from '../../state/TavernState'

import {
  WEEKLY_MODULE_ID,
  emptySignalTotals,
  getWeeklyModuleState,
} from '../weekly/state'
import type { WeeklyResult, WeeklySignalTotals } from '../weekly/types'

import { resolveRent } from './rent'
import { resolveLandlord } from './landlord'
import { resolveInspection } from './inspection'
import { computeReputationShifts, getReputationTier } from './reputation'
import { computeUpgradeReadiness } from './upgradeReadiness'
import { resolveRivalTavern } from './rival'
import { MONTH_MODIFIERS, pickMonthModifier } from './modifiers'
import { buildMonthlyReportSection } from './report'
import type {
  MonthModifier,
  MonthlyAccumulator,
  MonthlyEconomyTotals,
  MonthlyModuleState,
  MonthlyResult,
  ReputationAxisId,
} from './types'
import { MONTHLY_MODULE_ID } from './types'

// Phase 15 — Monthly module.
//
// Responsibilities:
//   - On `startDay` of day 1 (or whenever the slice has not been
//     initialised for the current month), reset the monthly accumulator
//     and re-pick the active month modifier deterministically from the
//     run seed plus calendar coordinate.
//   - On `startDay` of every day, apply the active modifier's daily
//     nudges (§15.9). These are small, mechanical effects only — no
//     issue seeds, no narrative events.
//   - On `endWeek` (engine gates this for end-of-week days), fold the
//     just-finalized weekly result into the monthly accumulator.
//   - On `endMonth` (engine gates this for day 28), resolve rent,
//     landlord, inspection, reputation shifts, upgrade readiness, and
//     rival pressure; pick the modifier for the next month; emit the
//     monthly result for the report builder.
//   - On `generateReports`, emit the MONTHLY REPORT section whenever
//     the slice carries a `lastMonthlyResult` from the current day.

const SOURCE = MONTHLY_MODULE_ID

// Phase 15 §15.2 — Recommended starting rent: 100–150 coin.
const DEFAULT_RENT = 120

// Phase 15 §15.4 — Default seed inspection state.
const DEFAULT_SUSPICION = 25

// Phase 15 §15.3 — Default seed landlord state.
const DEFAULT_LANDLORD_OPINION = 50
const DEFAULT_LANDLORD_PRESSURE = 20

// Phase 15 §15.8 — Default seed rival pressure.
const DEFAULT_RIVAL_PRESSURE = 20
const DEFAULT_RIVAL_APPEAL = 30

const TAX_MONTH_RENT_BUMP = 20

/**
 * Phase 91 — bounded buffer length for
 * `MonthlyModuleState.monthlyHistory`. Keeps the most recent year on
 * state so the Reports → Monthly screen can compare across months
 * without unbounded save growth.
 */
export const MAX_MONTHLY_HISTORY = 12

function formatMonthKey(year: number, month: number): string {
  return `Y${year}-M${month}`
}

function emptyAccumulator(): MonthlyAccumulator {
  return {
    weekKeys: [],
    signals: emptySignalTotals(),
    signalNotes: [],
    economy: emptyMonthlyEconomy(),
    shortageCount: 0,
    incidentCount: 0,
    unpaidWageWeeks: 0,
    damageSamples: [],
  }
}

function emptyMonthlyEconomy(): MonthlyEconomyTotals {
  // Same shape as the weekly economy totals; kept separate so the
  // monthly type does not depend on the weekly type at the value level.
  return {
    sales: 0,
    purchases: 0,
    repairs: 0,
    wages: 0,
    rent: 0,
    waste: 0,
    other: 0,
    net: 0,
  }
}

function fallbackModifier(): MonthModifier {
  return MONTH_MODIFIERS.quiet_roads
}

export function createInitialMonthlyModuleState(): MonthlyModuleState {
  return {
    monthKey: '',
    monthNumber: 0,
    yearNumber: 0,
    rent: {
      monthlyAmount: DEFAULT_RENT,
      paidThisMonth: false,
      missedPayments: 0,
      arrears: 0,
    },
    landlord: {
      opinion: DEFAULT_LANDLORD_OPINION,
      pressure: DEFAULT_LANDLORD_PRESSURE,
      missedRentCount: 0,
    },
    inspection: {
      suspicion: DEFAULT_SUSPICION,
      warningCount: 0,
    },
    rivalTavern: {
      pressure: DEFAULT_RIVAL_PRESSURE,
      appeal: DEFAULT_RIVAL_APPEAL,
      strategy: 'unknown',
    },
    currentModifier: fallbackModifier(),
    accumulator: emptyAccumulator(),
    monthlyHistory: [],
    monthFinalized: false,
  }
}

export function getMonthlyModuleState(state: {
  modules: Record<string, unknown>
}): MonthlyModuleState {
  const slice = state.modules[MONTHLY_MODULE_ID] as
    | MonthlyModuleState
    | undefined
  if (!slice) return createInitialMonthlyModuleState()
  return slice
}

function replaceSlice(
  ctx: SimContext,
  next: MonthlyModuleState,
  reason: string,
): void {
  ctx.modifyModuleState<MonthlyModuleState>(
    MONTHLY_MODULE_ID,
    () => next,
    { source: SOURCE, reason },
  )
}

function writeSlice(
  ctx: SimContext,
  patch: Partial<MonthlyModuleState>,
  reason: string,
): void {
  ctx.modifyModuleState<MonthlyModuleState>(
    MONTHLY_MODULE_ID,
    (current) => {
      const base = current ?? createInitialMonthlyModuleState()
      return { ...base, ...patch }
    },
    { source: SOURCE, reason },
  )
}

// ---------- Hooks ----------

function totalDamage(state: TavernState): number {
  let sum = 0
  for (const area of Object.values(state.areas)) sum += area.damage
  return sum
}

function isNewMonth(slice: MonthlyModuleState, state: TavernState): boolean {
  if (slice.monthKey === '') return true
  if (slice.monthFinalized) return true
  return (
    slice.monthNumber !== state.calendar.month ||
    slice.yearNumber !== state.calendar.year
  )
}

const startDayHook: SimulationHook = (ctx: SimContext): void => {
  const slice = getMonthlyModuleState(ctx.state)

  if (isNewMonth(slice, ctx.state)) {
    const modifier = pickMonthModifier(
      ctx.input.seed,
      ctx.state.calendar.year,
      ctx.state.calendar.month,
    )
    const fresh: MonthlyModuleState = {
      monthKey: formatMonthKey(
        ctx.state.calendar.year,
        ctx.state.calendar.month,
      ),
      monthNumber: ctx.state.calendar.month,
      yearNumber: ctx.state.calendar.year,
      rent: slice.rent,
      landlord: slice.landlord,
      inspection: slice.inspection,
      rivalTavern: slice.rivalTavern,
      currentModifier: modifier,
      accumulator: emptyAccumulator(),
      // Phase 91 — preserve cross-month persistent fields so the
      // Reports → Monthly screen reads truth across the full next
      // month, not just on day 28 itself. `monthFinalized` still flips
      // back to false so `buildMonthlyReport` stays one-shot per month.
      ...(slice.lastMonthlyResult
        ? { lastMonthlyResult: slice.lastMonthlyResult }
        : {}),
      monthlyHistory: [...slice.monthlyHistory],
      monthFinalized: false,
    }
    replaceSlice(ctx, fresh, 'reset_month')
  }

  // Apply the active modifier's daily mechanical nudge. Effects are
  // intentionally small; multi-day exposure is what makes them matter.
  applyMonthModifierDailyEffects(ctx)
}

function applyMonthModifierDailyEffects(ctx: SimContext): void {
  const slice = getMonthlyModuleState(ctx.state)
  const modifier = slice.currentModifier
  switch (modifier.id) {
    case 'rainy_month': {
      const roof = ctx.state.areas['roof']
      if (roof && roof.condition < 90 && roof.damage > 0) {
        ctx.modifyArea(
          roof.id,
          { condition: clampPercent(roof.condition - 1) },
          { source: `${SOURCE}.rainy_month`, reason: 'rainy_month_drift' },
        )
      }
      break
    }
    case 'festival_month': {
      const mainRoom = ctx.state.areas['main_room']
      if (mainRoom) {
        ctx.modifyArea(
          mainRoom.id,
          { mess: clampPercent(mainRoom.mess + 1) },
          { source: `${SOURCE}.festival_month`, reason: 'festival_mess' },
        )
      }
      break
    }
    case 'mold_bloom': {
      const cellar = ctx.state.areas['cellar']
      if (cellar) {
        ctx.modifyArea(
          cellar.id,
          {
            smell: clampPercent(cellar.smell + 1),
            risk: clampPercent(cellar.risk + 1),
          },
          { source: `${SOURCE}.mold_bloom`, reason: 'mold_bloom_drift' },
        )
      }
      break
    }
    case 'quiet_roads': {
      for (const staff of Object.values(ctx.state.staff)) {
        if (staff.stress <= 0) continue
        ctx.modifyStaff(
          staff.id,
          { stress: clampPercent(staff.stress - 1) },
          { source: `${SOURCE}.quiet_roads`, reason: 'quiet_roads_recovery' },
        )
      }
      break
    }
    case 'adventurer_season': {
      const mainRoom = ctx.state.areas['main_room']
      if (mainRoom) {
        ctx.modifyArea(
          mainRoom.id,
          { damage: clampPercent(mainRoom.damage + 1) },
          {
            source: `${SOURCE}.adventurer_season`,
            reason: 'adventurer_season_wear',
          },
        )
      }
      break
    }
    case 'tax_month':
      // tax_month effect is applied at endMonth (extra rent due).
      break
  }
}

function applyWeeklyEconomyToMonthly(
  monthly: MonthlyEconomyTotals,
  weekly: WeeklyResult['economy'],
): MonthlyEconomyTotals {
  return {
    sales: monthly.sales + weekly.sales,
    purchases: monthly.purchases + weekly.purchases,
    repairs: monthly.repairs + weekly.repairs,
    wages: monthly.wages + weekly.wages,
    rent: monthly.rent + weekly.rent,
    waste: monthly.waste + weekly.waste,
    other: monthly.other + weekly.other,
    net: monthly.net + weekly.net,
  }
}

function addSignals(
  target: WeeklySignalTotals,
  patch: WeeklySignalTotals,
): WeeklySignalTotals {
  return {
    cheap: target.cheap + patch.cheap,
    filthy: target.filthy + patch.filthy,
    dangerous: target.dangerous + patch.dangerous,
    tasty: target.tasty + patch.tasty,
    reliable: target.reliable + patch.reliable,
  }
}

const endWeekHook: SimulationHook = (ctx: SimContext): void => {
  const slice = getMonthlyModuleState(ctx.state)
  const weekly = getWeeklyModuleState(ctx.state)
  const weeklyResult = weekly.lastWeeklyResult
  if (!weeklyResult) return
  if (slice.accumulator.weekKeys.includes(weeklyResult.weekKey)) return

  const accumulator = slice.accumulator
  const shortageThisWeek =
    weekly.shortageCountByStock !== undefined
      ? Object.values(weekly.shortageCountByStock).reduce((a, b) => a + b, 0)
      : 0
  const incidentsThisWeek = 0 // Phase 14 does not pipe per-week incidents;
  // monthly aggregates them via damage drift as a proxy.

  const nextAccumulator: MonthlyAccumulator = {
    weekKeys: [...accumulator.weekKeys, weeklyResult.weekKey],
    signals: addSignals(accumulator.signals, weeklyResult.signals),
    signalNotes:
      weeklyResult.signalNotes.length > 0
        ? [...accumulator.signalNotes, ...weeklyResult.signalNotes]
        : accumulator.signalNotes,
    economy: applyWeeklyEconomyToMonthly(accumulator.economy, weeklyResult.economy),
    shortageCount: accumulator.shortageCount + shortageThisWeek,
    incidentCount: accumulator.incidentCount + incidentsThisWeek,
    unpaidWageWeeks: accumulator.unpaidWageWeeks + (weeklyResult.wages.paid ? 0 : 1),
    damageSamples: [...accumulator.damageSamples, totalDamage(ctx.state)],
  }

  writeSlice(ctx, { accumulator: nextAccumulator }, 'roll_week')
}

function applyReputationShifts(
  ctx: SimContext,
  shifts: ReturnType<typeof computeReputationShifts>,
): void {
  let changed = false
  const nextReputation: ReputationState = { ...ctx.state.reputation }
  for (const shift of shifts) {
    if (shift.delta === 0) continue
    nextReputation[shift.axisId as ReputationAxisId] = shift.after
    changed = true
  }
  if (!changed) return
  ctx.modifyReputation(nextReputation, {
    source: `${SOURCE}.reputation`,
    reason: 'monthly_reputation_shift',
  })
}

const endMonthHook: SimulationHook = (ctx: SimContext): void => {
  const slice = getMonthlyModuleState(ctx.state)
  if (slice.monthFinalized) return

  // Tax month bumps the rent due this month before it is resolved.
  const taxBump =
    slice.currentModifier.id === 'tax_month' ? TAX_MONTH_RENT_BUMP : 0
  const rentForResolution = taxBump > 0
    ? { ...slice.rent, monthlyAmount: slice.rent.monthlyAmount + taxBump }
    : slice.rent

  const rentOutcome = resolveRent(ctx, rentForResolution)
  // Preserve the configured monthlyAmount; the bump is one-month only.
  const nextRent = { ...rentOutcome.next, monthlyAmount: slice.rent.monthlyAmount }

  // Reflect the rent spend in the monthly economy accumulator so the
  // report numbers line up with what the ledger captured.
  const accumulatorAfterRent: MonthlyAccumulator = {
    ...slice.accumulator,
    economy: {
      ...slice.accumulator.economy,
      rent: slice.accumulator.economy.rent + rentOutcome.resolution.paidAmount,
      net:
        slice.accumulator.economy.net - rentOutcome.resolution.paidAmount,
    },
  }

  // Inspection runs before landlord so the landlord rule can read the
  // updated suspicion when it decides how much pressure to apply.
  const inspectionOutcome = resolveInspection(
    ctx.state,
    slice.inspection,
    accumulatorAfterRent,
    ctx.state.calendar.month,
  )
  // Phase 16 §16.3 — a fresh inspector warning seeds both a "recently
  // warned" memory and a `future_hook` so later phases can spot a
  // follow-up visit. We also drop a history entry summarizing the
  // resolution either way.
  if (inspectionOutcome.resolution.warningIssuedThisMonth) {
    ctx.addMemory({
      id: 'inspection_warning_recently',
      source: 'monthly.inspection',
      metadata: {
        suspicion: inspectionOutcome.resolution.suspicionAfter,
        warningCount: inspectionOutcome.resolution.warningCount,
      },
    })
    ctx.addMemory({
      id: 'inspector_followup_possible',
      source: 'monthly.inspection',
    })
    ctx.addHistory({
      category: 'monthly',
      summary: `Inspector issued a warning (suspicion ${inspectionOutcome.resolution.suspicionAfter}).`,
      tags: ['monthly', 'inspection', 'warning'],
      relatedSystems: ['inspection'],
      mechanicalRefs: ['resolveInspection'],
    })
    // Phase 17 §17.5 — inspector warning drives inspection pressure.
    ctx.addCause({
      source: 'monthly.inspection',
      sourceType: 'monthly',
      target: 'pressure:inspection',
      targetType: 'pressure',
      amount: 20,
      weight: 45,
      direction: 'increase',
      readable: `Inspector warning issued (suspicion ${inspectionOutcome.resolution.suspicionAfter}).`,
      tags: ['monthly', 'inspection', 'warning', 'pressure', 'risk'],
      relatedSystems: ['monthly', 'inspection'],
      expiresAfterDays: 28,
    })
  }
  const landlordOutcome = resolveLandlord(
    ctx.state,
    slice.landlord,
    rentOutcome.resolution,
    accumulatorAfterRent,
    inspectionOutcome.next.suspicion,
  )

  // Reputation shifts depend on the post-month accumulator and the
  // current state (which has not yet been touched for reputation).
  const shifts = computeReputationShifts(ctx.state, accumulatorAfterRent)
  applyReputationShifts(ctx, shifts)

  const upgrades = computeUpgradeReadiness(ctx.state, accumulatorAfterRent)
  const rivalOutcome = resolveRivalTavern(ctx.state, slice.rivalTavern)

  const nextMonthModifier = pickMonthModifier(
    ctx.input.seed,
    nextMonthCoord(ctx.state.calendar.year, ctx.state.calendar.month).year,
    nextMonthCoord(ctx.state.calendar.year, ctx.state.calendar.month).month,
  )

  const customerTrend = getWeeklyModuleState(ctx.state).lastWeeklyResult
  const result: MonthlyResult = {
    monthKey: slice.monthKey || formatMonthKey(
      ctx.state.calendar.year,
      ctx.state.calendar.month,
    ),
    monthNumber: ctx.state.calendar.month,
    yearNumber: ctx.state.calendar.year,
    endDay: ctx.state.calendar.day,
    endingCoin: ctx.state.coin,
    rent: rentOutcome.resolution,
    landlord: landlordOutcome.resolution,
    inspection: inspectionOutcome.resolution,
    rivalTavern: rivalOutcome.resolution,
    reputationShifts: shifts,
    upgradeReadiness: upgrades,
    economy: accumulatorAfterRent.economy,
    activeModifier: slice.currentModifier,
    nextMonthModifier,
    ...(customerTrend?.bestGroupId ? { bestGroupId: customerTrend.bestGroupId } : {}),
    ...(customerTrend?.worstGroupId ? { worstGroupId: customerTrend.worstGroupId } : {}),
    strategicSummary: buildStrategicSummary(
      rentOutcome.resolution,
      landlordOutcome.resolution,
      inspectionOutcome.resolution,
      shifts,
      slice.currentModifier,
    ),
  }

  // Phase 91 — append to bounded history. `slice.monthlyHistory` is
  // oldest-first; this finalised result becomes the new last entry.
  // The Reports → Monthly projection's previous-month lookup walks
  // `history[length - 2]`, so the appended ordering matters.
  const nextHistory = [...slice.monthlyHistory, result]
  const trimmedHistory =
    nextHistory.length > MAX_MONTHLY_HISTORY
      ? nextHistory.slice(nextHistory.length - MAX_MONTHLY_HISTORY)
      : nextHistory

  replaceSlice(
    ctx,
    {
      monthKey: slice.monthKey,
      monthNumber: slice.monthNumber,
      yearNumber: slice.yearNumber,
      rent: nextRent,
      landlord: landlordOutcome.next,
      inspection: inspectionOutcome.next,
      rivalTavern: rivalOutcome.next,
      currentModifier: slice.currentModifier,
      accumulator: accumulatorAfterRent,
      lastMonthlyResult: result,
      monthlyHistory: trimmedHistory,
      monthFinalized: true,
    },
    'finalize_month',
  )
}

function nextMonthCoord(
  year: number,
  month: number,
): { year: number; month: number } {
  if (month >= 12) return { year: year + 1, month: 1 }
  return { year, month: month + 1 }
}

function buildStrategicSummary(
  rent: MonthlyResult['rent'],
  landlord: MonthlyResult['landlord'],
  inspection: MonthlyResult['inspection'],
  shifts: MonthlyResult['reputationShifts'],
  modifier: MonthModifier,
): string[] {
  const notes: string[] = []
  if (!rent.paid) notes.push('Rent slipped — landlord pressure is rising.')
  if (landlord.pressureAfter >= 70) notes.push('Landlord pressure is high.')
  if (inspection.suspicionAfter >= 70) notes.push('Inspection suspicion is high.')
  const defining = shifts.filter((s) => s.tierAfter === 'defining')
  if (defining.length > 0) {
    notes.push(
      `Defining reputation now: ${defining.map((s) => s.axisId).join(', ')}.`,
    )
  }
  notes.push(`Active modifier was ${modifier.label}.`)
  return notes
}

// ---------- Reports ----------

function buildMonthlyReport(ctx: SimContext): ReportSection | null {
  const slice = getMonthlyModuleState(ctx.state)
  if (!slice.lastMonthlyResult) return null
  if (!slice.monthFinalized) return null
  // Only emit the monthly report on the day endMonth finalized it.
  if (slice.lastMonthlyResult.endDay !== ctx.state.calendar.day) return null
  return buildMonthlyReportSection(slice.lastMonthlyResult)
}

// ---------- Validation ----------

function validateMonthly(ctx: SimContext): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const slice = getMonthlyModuleState(ctx.state)
  if (slice.rent.monthlyAmount < 0) {
    issues.push({
      path: 'modules.monthly.rent.monthlyAmount',
      message: 'Rent amount must be non-negative',
      code: 'negative_rent',
    })
  }
  if (slice.rent.missedPayments < 0) {
    issues.push({
      path: 'modules.monthly.rent.missedPayments',
      message: 'Missed payment count must be non-negative',
      code: 'negative_missed_payments',
    })
  }
  if (slice.rent.arrears < 0) {
    issues.push({
      path: 'modules.monthly.rent.arrears',
      message: 'Arrears must be non-negative',
      code: 'negative_arrears',
    })
  }
  if (!MONTH_MODIFIERS[slice.currentModifier.id]) {
    issues.push({
      path: 'modules.monthly.currentModifier.id',
      message: `Unknown month modifier '${slice.currentModifier.id}'`,
      code: 'unknown_month_modifier',
    })
  }
  return issues
}

// ---------- Module schema ----------

const ModifierSchema = z.object({
  id: z.enum([
    'rainy_month',
    'festival_month',
    'tax_month',
    'mold_bloom',
    'quiet_roads',
    'adventurer_season',
  ]),
  label: z.string(),
  tags: z.array(z.string()),
  description: z.string(),
})

const MonthlyEconomySchema = z.object({
  sales: z.number(),
  purchases: z.number(),
  repairs: z.number(),
  wages: z.number(),
  rent: z.number(),
  waste: z.number(),
  other: z.number(),
  net: z.number(),
})

const SignalSchema = z.object({
  cheap: z.number(),
  filthy: z.number(),
  dangerous: z.number(),
  tasty: z.number(),
  reliable: z.number(),
})

const RentStateSchema = z.object({
  monthlyAmount: z.number().min(0),
  paidThisMonth: z.boolean(),
  missedPayments: z.number().int().min(0),
  arrears: z.number().min(0),
})

const LandlordStateSchema = z.object({
  opinion: z.number().min(0).max(100),
  pressure: z.number().min(0).max(100),
  missedRentCount: z.number().int().min(0),
})

const InspectionStateSchema = z.object({
  suspicion: z.number().min(0).max(100),
  lastInspectionMonth: z.number().int().optional(),
  warningCount: z.number().int().min(0),
})

const RivalTavernStateSchema = z.object({
  pressure: z.number().min(0).max(100),
  appeal: z.number().min(0).max(100),
  strategy: z.enum(['unknown', 'clean', 'cheap', 'rowdy', 'fancy']),
})

const AccumulatorSchema = z.object({
  weekKeys: z.array(z.string()),
  signals: SignalSchema,
  signalNotes: z.array(z.string()),
  economy: MonthlyEconomySchema,
  shortageCount: z.number().int().min(0),
  incidentCount: z.number().int().min(0),
  unpaidWageWeeks: z.number().int().min(0),
  damageSamples: z.array(z.number()),
})

const ReputationAxisShiftSchema = z.object({
  axisId: z.enum([
    'cheap',
    'tasty',
    'filthy',
    'dangerous',
    'cozy',
    'reliable',
    'goblinAuthentic',
    'respectable',
    'strange',
  ]),
  before: z.number(),
  after: z.number(),
  delta: z.number(),
  tierBefore: z.enum(['absent', 'faint', 'known', 'strong', 'defining']),
  tierAfter: z.enum(['absent', 'faint', 'known', 'strong', 'defining']),
  reasons: z.array(z.string()),
})

const UpgradeReadinessSchema = z.object({
  id: z.string(),
  label: z.string(),
  rationale: z.string(),
  relevance: z.number().min(0).max(100),
})

const MonthlyResultSchema = z.object({
  monthKey: z.string(),
  monthNumber: z.number(),
  yearNumber: z.number(),
  endDay: z.number(),
  endingCoin: z.number(),
  rent: z.object({
    amountDue: z.number().min(0),
    paid: z.boolean(),
    paidAmount: z.number().min(0),
    arrears: z.number().min(0),
    missedPayments: z.number().int().min(0),
  }),
  landlord: z.object({
    opinionBefore: z.number(),
    opinionAfter: z.number(),
    pressureBefore: z.number(),
    pressureAfter: z.number(),
    notes: z.array(z.string()),
  }),
  inspection: z.object({
    suspicionBefore: z.number(),
    suspicionAfter: z.number(),
    warningCount: z.number().int().min(0),
    warningIssuedThisMonth: z.boolean(),
    notes: z.array(z.string()),
  }),
  rivalTavern: z.object({
    pressureBefore: z.number(),
    pressureAfter: z.number(),
    appealBefore: z.number(),
    appealAfter: z.number(),
    notes: z.array(z.string()),
  }),
  reputationShifts: z.array(ReputationAxisShiftSchema),
  upgradeReadiness: z.array(UpgradeReadinessSchema),
  economy: MonthlyEconomySchema,
  activeModifier: ModifierSchema,
  nextMonthModifier: ModifierSchema,
  bestGroupId: z.string().optional(),
  worstGroupId: z.string().optional(),
  strategicSummary: z.array(z.string()),
})

const MonthlyModuleStateSchema = z.object({
  monthKey: z.string(),
  monthNumber: z.number(),
  yearNumber: z.number(),
  rent: RentStateSchema,
  landlord: LandlordStateSchema,
  inspection: InspectionStateSchema,
  rivalTavern: RivalTavernStateSchema,
  currentModifier: ModifierSchema,
  accumulator: AccumulatorSchema,
  lastMonthlyResult: MonthlyResultSchema.optional(),
  monthlyHistory: z.array(MonthlyResultSchema),
  monthFinalized: z.boolean(),
})

export const monthlyModule: SimulationModule = {
  id: MONTHLY_MODULE_ID,
  version: '0.1.0',
  // Monthly reads the weekly slice's `lastWeeklyResult` on endWeek, then
  // pays rent through the stock-owned ledger on endMonth. Declaring both
  // upstream dependencies keeps the engine's topo sort honest.
  dependsOn: [WEEKLY_MODULE_ID, 'stock'],
  hooks: {
    startDay: [startDayHook],
    endWeek: [endWeekHook],
    endMonth: [endMonthHook],
  },
  buildReport: buildMonthlyReport,
  validate: validateMonthly,
  stateSchema: MonthlyModuleStateSchema,
}

export {
  MONTHLY_MODULE_ID,
  emptyMonthlyEconomy,
  emptyAccumulator,
  formatMonthKey,
  getReputationTier,
}
