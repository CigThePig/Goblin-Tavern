import type { z } from 'zod'
import type {
  AreaStateSchema,
  CalendarStampSchema,
  CalendarStateSchema,
  CauseEntrySchema,
  CustomerGroupStateSchema,
  EntityRefSchema,
  HistoryEntrySchema,
  MemoryStateSchema,
  PressureStateSchema,
  ReputationStateSchema,
  StaffStateSchema,
  StockItemStateSchema,
  TavernMetaStateSchema,
  TavernStateSchema,
} from './schemas'

// Phase 6 §6.1 — schema-derived inferred types.
//
// These mirror the hand-written types in `TavernState.ts` exactly. Phase 5
// remains the source of truth for the canonical type names imported across
// the codebase; this file exposes the schema-derived counterparts so callers
// that want a guaranteed schema-aligned type have a place to import from.

export type AreaState = z.infer<typeof AreaStateSchema>
export type StockItemState = z.infer<typeof StockItemStateSchema>
export type StaffState = z.infer<typeof StaffStateSchema>
export type CustomerGroupState = z.infer<typeof CustomerGroupStateSchema>
export type ReputationState = z.infer<typeof ReputationStateSchema>
export type CalendarState = z.infer<typeof CalendarStateSchema>
export type CalendarStamp = z.infer<typeof CalendarStampSchema>
export type EntityRef = z.infer<typeof EntityRefSchema>
export type MemoryState = z.infer<typeof MemoryStateSchema>
export type HistoryEntry = z.infer<typeof HistoryEntrySchema>
export type CauseEntry = z.infer<typeof CauseEntrySchema>
export type PressureState = z.infer<typeof PressureStateSchema>
export type TavernMetaState = z.infer<typeof TavernMetaStateSchema>
export type TavernState = z.infer<typeof TavernStateSchema>

// Phase 6 §6.3 — Validation issue surface used by `safeValidateState` and
// the `expect*` test assertions in `src/sim/testing/stateAssertions.ts`.
export type ValidationIssue = {
  path: string
  message: string
  code?: string
}

export type ValidationSummary = {
  errors: ValidationIssue[]
  warnings: ValidationIssue[]
}
