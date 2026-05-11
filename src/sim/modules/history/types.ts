import type {
  EntityRef,
  HistoryCategory,
  HistoryEntry,
} from '../../state/TavernState'

// Phase 16 §"History Log Shape" / §16.8 — supporting types.
//
// `HistoryEntryDraft` is the input shape accepted by `ctx.addHistory`.
// Every field other than `summary` and `category` is optional and will
// be filled in by the engine — the timestamp comes from the current
// calendar, the id is generated, and missing arrays default to empty.

export type HistoryEntryDraft = {
  id?: string
  category: HistoryCategory
  summary: string
  tags?: string[]
  relatedActors?: EntityRef[]
  relatedLocations?: EntityRef[]
  relatedSystems?: string[]
  mechanicalRefs?: string[]
}

export type { EntityRef, HistoryCategory, HistoryEntry }
