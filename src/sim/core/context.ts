import type { TavernState, AreaState, StockState, StaffState, CustomerGroupState } from '../state/TavernState'
import type { ValidationSummary } from '../state/types'
import type { DayType } from '../modules/calendar/types'
import type { SimRng } from './rng'
import type { ReportSection, SimLog, SimLogLevel } from './reports'

// Phase 7 §7.3 — SimContext.
//
// The context is the controlled way modules interact with the simulation.
// It exposes the current state, the seeded RNG, the input, accumulators
// for reports/logs, calendar accessors, and the cause-required mutation
// helpers from §7.3.1.
//
// Phase 7 keeps the surface intentionally small; later phases will add
// `addCause`, `addMemory`, `addPressure`, `addIssueSeed`, and a richer
// mutation surface (`modifyCoin`, `modifyReputation`, `modifyPressure`).
// See §7.3 "Later phases will add" and §7.3.1 forward note.

export type SimInput = {
  /** Seed for the deterministic RNG threaded through `ctx.rng`. */
  seed: string
  /**
   * Phase 7 placeholder for owner-action input. Phase 13 fills this in with
   * the real owner-action shape; Phase 7 only needs the field to exist so
   * the engine signature does not churn later.
   */
  ownerActions?: ReadonlyArray<unknown>
}

/**
 * Phase 7 §7.3.1 — Mutation metadata placeholder.
 *
 * Phase 17 upgrades this argument to a full `CauseDraft` and enforces it
 * at the type level. Until then, callers pass `{ source: string }` so no
 * significant mutation is silent.
 */
export type MutationMeta = {
  source: string
  reason?: string
}

export type AddLogInput = SimLog | { message: string; level?: SimLogLevel; data?: Record<string, unknown> } | string

export type SimContext = {
  /** Current tavern state. Always reflects the most recent mutation. */
  readonly state: TavernState
  readonly input: SimInput
  readonly rng: SimRng

  readonly reports: ReadonlyArray<ReportSection>
  readonly logs: ReadonlyArray<SimLog>

  addReportSection(section: ReportSection): void
  addLog(log: AddLogInput, source?: string): void

  getDayType(): DayType
  isEndOfWeek(): boolean
  isEndOfMonth(): boolean

  /**
   * Run the full state validator on the current state and return the
   * resulting summary. Does not throw on failure — callers decide what to
   * do with errors. Engine `validate` phase calls this once per day.
   */
  validate(): ValidationSummary

  // Phase 7 §7.3.1 — Cause-required mutation helpers.
  modifyArea(id: string, changes: Partial<AreaState>, meta: MutationMeta): void
  modifyStock(id: string, changes: Partial<StockState>, meta: MutationMeta): void
  modifyStaff(id: string, changes: Partial<StaffState>, meta: MutationMeta): void
  modifyCustomerGroup(id: string, changes: Partial<CustomerGroupState>, meta: MutationMeta): void
}
