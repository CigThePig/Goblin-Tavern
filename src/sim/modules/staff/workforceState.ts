import type { SimContext } from '../../core/context'
import type { TavernState } from '../../state/TavernState'
import type { EmploymentRecord } from '../../contracts/obligations/index'
import { isTerminalContractStatus } from '../../contracts/obligations/index'

import type { StaffModuleState } from './types'
import {
  MAX_EMPLOYMENT_ARCHIVE,
  MAX_SEPARATION_HISTORY,
  createInitialStaffWorkforceState,
  createInitialStaffWorkforceTotals,
  type StaffSeparationEntry,
  type StaffWorkforceTotals,
} from './workforceTypes'

// Expansion Phase 3 — reading and writing the staff slice.
//
// Every accessor here normalises: a save written before this phase carries the
// Phase 11 slice (three fields) and nothing else, so every workforce field has
// to be defaulted on read rather than assumed present. That is belt and braces
// with `ensureStaffWorkforceFields` in `state/migrations.ts` — the named
// migration is what the §5.7 protocol requires and what a test can call
// directly, and this is what stops a slice that slipped past it from throwing.

export const STAFF_MODULE_ID = 'staff'

export function createInitialStaffModuleState(): StaffModuleState {
  return {
    ...createInitialStaffWorkforceState(),
    appliedPriorities: {},
    rejectedAssignments: [],
    priorityChanges: [],
    serviceQuality: emptyServiceQuality(),
  }
}

export function emptyServiceQuality(): StaffModuleState['serviceQuality'] {
  return {
    foodQualityModifier: 0,
    serviceSpeed: 0,
    tabControl: 0,
    messControl: 0,
    fightControl: 0,
    repairSupport: 0,
    staffSummaries: [],
  }
}

function normalizeSlice(
  slice: Partial<StaffModuleState> | undefined,
): StaffModuleState {
  const base = createInitialStaffModuleState()
  if (!slice) return base
  return {
    appliedPriorities: slice.appliedPriorities ?? base.appliedPriorities,
    rejectedAssignments: slice.rejectedAssignments ?? base.rejectedAssignments,
    priorityChanges: slice.priorityChanges ?? base.priorityChanges,
    serviceQuality: slice.serviceQuality ?? base.serviceQuality,
    employment: slice.employment ?? base.employment,
    employmentArchive: slice.employmentArchive ?? base.employmentArchive,
    laborMarket: slice.laborMarket
      ? { ...base.laborMarket, ...slice.laborMarket }
      : base.laborMarket,
    relationships: slice.relationships ?? base.relationships,
    actors: slice.actors ?? base.actors,
    roster: slice.roster ?? base.roster,
    coverage: slice.coverage ?? base.coverage,
    development: slice.development ?? base.development,
    separations: slice.separations ?? base.separations,
    separationHistory: slice.separationHistory ?? base.separationHistory,
    ...(slice.lastWageSettlement !== undefined
      ? { lastWageSettlement: slice.lastWageSettlement }
      : {}),
    totals: { ...base.totals, ...(slice.totals ?? {}) },
  }
}

export function getStaffModuleState(state: {
  modules: Record<string, unknown>
}): StaffModuleState {
  return normalizeSlice(
    state.modules[STAFF_MODULE_ID] as Partial<StaffModuleState> | undefined,
  )
}

export function writeStaffSlice(
  ctx: SimContext,
  updater: (current: StaffModuleState) => StaffModuleState,
  reason: string,
): void {
  ctx.modifyModuleState<StaffModuleState>(
    STAFF_MODULE_ID,
    (current) => updater(normalizeSlice(current)),
    { source: `${STAFF_MODULE_ID}.${reason}`, reason },
  )
}

export function bumpStaffTotal(
  ctx: SimContext,
  key: keyof StaffWorkforceTotals,
  by = 1,
  reason = 'totals',
): void {
  if (by === 0) return
  writeStaffSlice(
    ctx,
    (current) => ({
      ...current,
      totals: {
        ...createInitialStaffWorkforceTotals(),
        ...current.totals,
        [key]: (current.totals[key] ?? 0) + by,
      },
    }),
    reason,
  )
}

// ---------- employment records ----------

export function getEmployment(
  state: TavernState,
  staffId: string,
): EmploymentRecord | undefined {
  return getStaffModuleState(state).employment[staffId]
}

/**
 * Put an employment record back. A record that has reached a terminal status
 * moves to the bounded archive rather than vanishing, so "what were we paying
 * them, and how did it end?" still has an answer after they have gone.
 */
export function upsertEmployment(
  ctx: SimContext,
  record: EmploymentRecord,
  reason: string,
): void {
  const terminal = isTerminalContractStatus(record.status)
  writeStaffSlice(
    ctx,
    (current) => {
      const employment = { ...current.employment }
      if (terminal) delete employment[record.staffId]
      else employment[record.staffId] = record
      const archive = terminal
        ? capTail([...current.employmentArchive, record], MAX_EMPLOYMENT_ARCHIVE)
        : current.employmentArchive
      return { ...current, employment, employmentArchive: archive }
    },
    reason,
  )
}

export function recordSeparation(
  ctx: SimContext,
  entry: StaffSeparationEntry,
): void {
  writeStaffSlice(
    ctx,
    (current) => ({
      ...current,
      separations: [...current.separations, entry],
      separationHistory: capTail(
        [...current.separationHistory, entry],
        MAX_SEPARATION_HISTORY,
      ),
    }),
    'separation',
  )
}

export function capTail<T>(list: T[], cap: number): T[] {
  if (list.length <= cap) return list
  return list.slice(list.length - cap)
}
