import type { TavernState, AreaState, StockState, StaffState, CustomerGroupState, ReputationState } from '../state/TavernState'
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

/**
 * Phase 13 §13.2 — Per-action owner input. Mirrored here as a structural
 * type so `SimInput.ownerActions` stays typed without forcing the core
 * module to import from the ownerActions module (which would create a
 * cycle: ownerActions/types.ts already imports from this file). The
 * canonical type lives at `modules/ownerActions/types.ts`; this is the
 * same shape used by name only.
 */
export type SimInputOwnerAction = {
  actionId: string
  targetId?: string
  amount?: number
  options?: Record<string, unknown>
}

export type SimInput = {
  /** Seed for the deterministic RNG threaded through `ctx.rng`. */
  seed: string
  /**
   * Phase 13 §13.2 — per-day owner action input. Up to 3 action points
   * may be consumed per day; the owner-actions module enforces the
   * budget and rejects entries that overflow it, reference an unknown
   * action id, or fail the action's `canApply`.
   */
  ownerActions?: ReadonlyArray<SimInputOwnerAction>
  /**
   * Phase 11 §11.3 — per-day staff priority assignment. Keys are staff
   * ids; values are `StaffPriorityId`s validated against the role's
   * `allowedPriorities` by the staff module. Staff members omitted from
   * this map fall back to the role's default priority.
   */
  staffPriorities?: Record<string, string>
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

  /**
   * Phase 9 §9.3 — Coin mutations route through `modifyCoin` so the
   * Phase 9 ledger helpers (`addCoin` / `spendCoin`) never write to
   * `state.coin` directly. Defensive add per Phase 7 §7.3.1 forward note:
   * Phase 17 will turn `meta` into a full `CauseDraft`.
   */
  modifyCoin(delta: number, meta: MutationMeta): void

  /**
   * Phase 15 §15.5 — Reputation is multi-axis; the monthly module
   * computes the full next shape and writes it through this helper so
   * the engine stays the only place that swaps state references. As
   * with every other `modify*` helper, `meta` is the Phase 7 §7.3.1
   * placeholder that Phase 17 will widen to `CauseDraft`.
   */
  modifyReputation(next: ReputationState, meta: MutationMeta): void

  /**
   * Phase 9 §9.3 — Module-state mutations route through `modifyModuleState`
   * so a module's namespaced slice under `state.modules` cannot be written
   * silently. The updater receives the current slice (or `undefined` when
   * unseeded) and returns the next value. `meta` is the Phase 7 §7.3.1
   * placeholder that Phase 17 will widen to `CauseDraft`.
   */
  modifyModuleState<T>(
    moduleId: string,
    updater: (current: T | undefined) => T,
    meta: MutationMeta,
  ): void
}
