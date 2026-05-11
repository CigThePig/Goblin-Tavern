import type {
  AreaState,
  CauseEntry,
  CustomerGroupState,
  EntityRef,
  HistoryEntry,
  MemoryState,
  ReputationState,
  StaffState,
  StockState,
  TavernState,
} from '../state/TavernState'
import type { ValidationSummary } from '../state/types'
import type { DayType } from '../modules/calendar/types'
import type { HistoryEntryDraft } from '../modules/history/types'
import type { MemoryDraft } from '../modules/memories/memoryTypes'
import type { CauseDraft } from '../modules/causes/causeTypes'
import type { SimRng } from './rng'
import type { ReportSection, SimLog, SimLogLevel } from './reports'
import type { StateDiff, TaggedStateDiff, PhaseBoundary } from './diff'

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
 * Phase 7 §7.3.1 / Phase 17 §17.2.1 — Mutation metadata.
 *
 * Phase 17 widens this argument to a full `CauseDraft` and enforces it
 * at the type level: every `ctx.modify*` call must attribute the change
 * to a source. The legacy `reason` field (Phase 7 placeholder) is kept
 * as an alias for `readable` so older call sites still compile without
 * change. `source` remains mandatory; passing `{ source }` alone is
 * equivalent to a `CauseDraft` with default direction/weight inferred
 * from the mutation. Module authors who want a richer cause should pass
 * the full draft shape — including `readable`, `tags`, `targetType`,
 * and related actor/location refs — so the cause module can produce
 * useful reports.
 */
export type MutationMeta = CauseDraft

export type { CauseDraft }

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

  // Phase 16 §16.2 — Memory context API.
  //
  // Modules write memories through `addMemory` (never by reaching into
  // `state.memories` directly). The memory module looks up the registry
  // entry for the draft's `id`, applies the configured stacking strategy,
  // stamps the entry with the current calendar coordinate, and records
  // the new id in the memory module's per-day slice so the report can
  // surface "new today" lines.
  addMemory(draft: MemoryDraft): MemoryState
  removeMemory(id: string): boolean
  hasMemory(id: string): boolean
  getMemory(id: string): MemoryState | undefined
  getMemoriesByTag(tag: string): MemoryState[]
  getMemoriesForActor(actor: EntityRef): MemoryState[]
  getMemoriesForLocation(location: EntityRef): MemoryState[]
  getMemoryStrength(id: string): number

  /**
   * Phase 16 §16.4 — Trigger memory aging/expiration. Invoked by the
   * memory module's `endDay` hook (and exposed on the context so future
   * phases can drive aging from elsewhere — e.g. multi-day jumps).
   */
  ageMemoriesEndOfDay(): void

  // Phase 16 §16.8 — History log API.
  //
  // History entries are append-only debug records describing what
  // happened (owner actions, weekly summaries, monthly resolutions,
  // memory churn). Memories influence the sim; history records do not.
  addHistory(draft: HistoryEntryDraft): HistoryEntry
  getRecentHistory(days: number): HistoryEntry[]
  getHistoryByTag(tag: string): HistoryEntry[]

  // Phase 17 §17.2 — Cause context API.
  //
  // Modules call `addCause` whenever a significant state change deserves
  // attribution. The cause module ages and prunes entries on `endDay`,
  // and the cause report flags significant state diffs that have no
  // matching cause. The Phase 7 §7.3.1 forward note ("Phase 17 will widen
  // `meta` to `CauseDraft`") is fulfilled here.
  addCause(draft: CauseDraft): CauseEntry
  getCausesForTarget(target: string): CauseEntry[]
  getCausesByTag(tag: string): CauseEntry[]
  getRecentCauses(days: number): CauseEntry[]
  getTopCausesForTarget(target: string, limit: number): CauseEntry[]

  /**
   * Phase 17 §17.6 — Trigger cause aging/expiration. Invoked by the
   * cause module's `endDay` hook (and exposed on the context so future
   * phases can drive aging from elsewhere — e.g. multi-day jumps).
   */
  ageCausesEndOfDay(): void

  // Phase 17 §17.2.1 — Pressure mutation helper.
  //
  // Pressures live at `state.pressures[id]` (Phase 5 seed; Phase 18 adds
  // the full calculation/feedback loop pipeline). Phase 17 gates writes
  // through `modifyPressure` so the same cause contract that covers
  // coin/area/stock applies to pressure shifts.
  modifyPressure(id: string, change: number, cause: CauseDraft): void

  // Phase 17 §17.8 — Phase-boundary state diffs.
  //
  // The engine snapshots state at the start of `applyOwnerActions`,
  // `beforeService`, the first day of the week, and the first day of
  // the month, then publishes a tagged diff after each boundary closes.
  // Modules can read the current day's diffs via `getDiff(boundary)`;
  // `SimResult.diffs` carries them out of `simulateDay`.
  getDiff(boundary: PhaseBoundary): StateDiff | undefined
  getDiffs(): ReadonlyArray<TaggedStateDiff>
}
