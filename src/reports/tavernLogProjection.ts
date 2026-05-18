// Phase 94 — Tavern Log projection.
//
// `buildTavernLog(state, filters?)` is the single function the
// `<TavernLog>` Svelte component renders against. Pure: same `(state,
// filters)` ⇒ same `TavernLogData`. No DOM, no globals, no Math.random.
// Cards-contract §1 — the simulation is the source of truth; this
// projection slices `state.history`, resolves entity references to
// display labels, and surfaces facet counts. It never invents data not
// already in state.
//
// History pruning policy (Phase 62 / ISSUE-022) caps `state.history` at
// 500 entries or 90 days — whichever covers more — so rendering the
// whole filtered set in one pass is bounded.

import { resolveEntityLabel } from './entityLabels'
import type {
  EntityRef,
  HistoryCategory,
  HistoryEntry,
  TavernState,
} from '../sim/state/TavernState'

export type TavernLogDayRange = 'today' | 'last_7' | 'last_28' | 'all'

export type TavernLogFilters = {
  /** Empty / undefined = no category filter (all categories pass). */
  categories?: HistoryCategory[]
  /** Empty / undefined = no tag filter. Values are ANDed — entry must contain every tag. */
  tags?: string[]
  /** Default resolved at projection time based on `state.calendar.totalDaysElapsed`. */
  dayRange?: TavernLogDayRange
  /** Case-insensitive substring on `summary`; trimmed before match. */
  search?: string
  /**
   * "Involving X" filter — entry's `relatedActors` OR `relatedLocations`
   * must contain a ref with matching kind and id.
   */
  entity?: EntityRef
}

export type TavernLogChipRef = {
  kind: EntityRef['kind']
  id: string
  label: string
}

export type TavernLogRow = {
  id: string
  absoluteDay: number
  year: number
  month: number
  week: number
  day: number
  category: HistoryCategory
  summary: string
  tags: string[]
  actorChips: TavernLogChipRef[]
  locationChips: TavernLogChipRef[]
  systems: string[]
  mechanicalRefs: string[]
}

export type TavernLogDayGroup = {
  absoluteDay: number
  year: number
  month: number
  week: number
  day: number
  /** Number of rows in this day after filtering. */
  rowCount: number
  /** Slice indices into the flat `rows` array — `[start, end)`. */
  rowStart: number
  rowEnd: number
}

export type TavernLogCategoryFacet = {
  id: HistoryCategory
  label: string
  /** Count in ALL history (unfiltered). 0 means no entries of this category exist; chip dims. */
  totalCount: number
}

export type TavernLogTagFacet = { tag: string; totalCount: number }

export type TavernLogAppliedFilters = {
  categories: HistoryCategory[]
  tags: string[]
  dayRange: TavernLogDayRange
  search: string
  entity?: { kind: EntityRef['kind']; id: string; label: string }
}

export type TavernLogEmptyReason = 'no_history' | 'filtered_out'

export type TavernLogData = {
  totalEntries: number
  filteredCount: number
  rows: TavernLogRow[]
  groups: TavernLogDayGroup[]
  categoryFacets: TavernLogCategoryFacet[]
  /**
   * Top `TAG_FACET_LIMIT` most common tags across the whole log, plus
   * any tag actively filtered on (so the active chip is always visible).
   * Sorted by `totalCount` desc, then alpha.
   */
  tagFacets: TavernLogTagFacet[]
  appliedFilters: TavernLogAppliedFilters
  /** 0 when no filters are non-default; >0 otherwise. Drives "Clear filters" affordance. */
  activeFilterCount: number
  emptyReason?: TavernLogEmptyReason
}

export const HISTORY_CATEGORY_LABELS: Record<HistoryCategory, string> = {
  owner_action: 'Owner Action',
  service: 'Service',
  weekly: 'Weekly',
  monthly: 'Monthly',
  state_change: 'State Change',
  memory: 'Memory',
  pressure: 'Pressure',
  system: 'System',
}

const HISTORY_CATEGORIES: HistoryCategory[] = [
  'owner_action',
  'service',
  'weekly',
  'monthly',
  'state_change',
  'memory',
  'pressure',
  'system',
]

export const TAG_FACET_LIMIT = 20

/** Per-row chip cap for actors and locations. Wage-day entries can carry
 * the full staff roster; without a cap they would dominate a single row. */
const CHIPS_PER_ROW = 8

/**
 * Resolve the effective day range. Defaults to `last_7` on day ≥ 7,
 * otherwise `all`. A caller-supplied `dayRange` always wins.
 */
function effectiveDayRange(
  state: TavernState,
  requested: TavernLogDayRange | undefined,
): TavernLogDayRange {
  if (requested) return requested
  return state.calendar.totalDaysElapsed >= 7 ? 'last_7' : 'all'
}

/**
 * Resolve the default day range for the active filter count helper —
 * "default" means "what the projection would have picked without an
 * explicit filter." Used to decide whether a supplied dayRange counts
 * as an active filter.
 */
function defaultDayRange(state: TavernState): TavernLogDayRange {
  return state.calendar.totalDaysElapsed >= 7 ? 'last_7' : 'all'
}

function dayRangeCutoff(
  state: TavernState,
  range: TavernLogDayRange,
): number | undefined {
  const today = state.calendar.totalDaysElapsed
  switch (range) {
    case 'today':
      return today
    case 'last_7':
      return today - 7
    case 'last_28':
      return today - 28
    case 'all':
      return undefined
  }
}

function rowFromEntry(state: TavernState, entry: HistoryEntry): TavernLogRow {
  const actors = entry.relatedActors.slice(0, CHIPS_PER_ROW).map((ref) => ({
    kind: ref.kind,
    id: ref.id,
    label: resolveEntityLabel(state, ref),
  }))
  const locations = entry.relatedLocations.slice(0, CHIPS_PER_ROW).map((ref) => ({
    kind: ref.kind,
    id: ref.id,
    label: resolveEntityLabel(state, ref),
  }))
  return {
    id: entry.id,
    absoluteDay: entry.timestamp.absoluteDay,
    year: entry.timestamp.year,
    month: entry.timestamp.month,
    week: entry.timestamp.week,
    day: entry.timestamp.day,
    category: entry.category,
    summary: entry.summary,
    tags: [...entry.tags],
    actorChips: actors,
    locationChips: locations,
    systems: [...entry.relatedSystems],
    mechanicalRefs: entry.mechanicalRefs ? [...entry.mechanicalRefs] : [],
  }
}

export function buildTavernLog(
  state: TavernState,
  filters?: TavernLogFilters,
): TavernLogData {
  const totalEntries = state.history.length

  // ── Resolve effective filters ──────────────────────────────────────
  const requestedDayRange = filters?.dayRange
  const effDayRange = effectiveDayRange(state, requestedDayRange)
  const defDayRange = defaultDayRange(state)
  const cutoff = dayRangeCutoff(state, effDayRange)

  const categorySet =
    filters?.categories && filters.categories.length > 0
      ? new Set<HistoryCategory>(filters.categories)
      : undefined
  const tagFilter =
    filters?.tags && filters.tags.length > 0 ? [...filters.tags] : undefined
  const searchRaw = filters?.search?.trim() ?? ''
  const searchNeedle = searchRaw.length > 0 ? searchRaw.toLowerCase() : undefined
  const entityFilter = filters?.entity

  // ── Facets — always computed against UNFILTERED history so chip ────
  //    counts stay stable as filters apply.
  const categoryCounts: Record<HistoryCategory, number> = {
    owner_action: 0,
    service: 0,
    weekly: 0,
    monthly: 0,
    state_change: 0,
    memory: 0,
    pressure: 0,
    system: 0,
  }
  const tagCountMap = new Map<string, number>()
  for (const entry of state.history) {
    categoryCounts[entry.category] = (categoryCounts[entry.category] ?? 0) + 1
    for (const tag of entry.tags) {
      tagCountMap.set(tag, (tagCountMap.get(tag) ?? 0) + 1)
    }
  }
  const categoryFacets: TavernLogCategoryFacet[] = HISTORY_CATEGORIES.map((id) => ({
    id,
    label: HISTORY_CATEGORY_LABELS[id],
    totalCount: categoryCounts[id],
  }))

  // Top-N tags by count desc, then alpha. Append any actively filtered
  // tag not in the top list so the active chip is visible.
  const sortedTags = [...tagCountMap.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1]
    return a[0].localeCompare(b[0])
  })
  const topTags = sortedTags.slice(0, TAG_FACET_LIMIT).map(([tag, count]) => ({
    tag,
    totalCount: count,
  }))
  if (tagFilter) {
    const topSet = new Set(topTags.map((t) => t.tag))
    for (const tag of tagFilter) {
      if (!topSet.has(tag)) {
        topTags.push({ tag, totalCount: tagCountMap.get(tag) ?? 0 })
        topSet.add(tag)
      }
    }
    // Re-sort after appending so the toolbar stays sorted.
    topTags.sort((a, b) => {
      if (b.totalCount !== a.totalCount) return b.totalCount - a.totalCount
      return a.tag.localeCompare(b.tag)
    })
  }
  const tagFacets: TavernLogTagFacet[] = topTags

  // ── Apply filters (entries pass when every active filter accepts) ──
  const survivors: HistoryEntry[] = []
  for (const entry of state.history) {
    if (cutoff !== undefined && entry.timestamp.absoluteDay < cutoff) continue
    if (categorySet && !categorySet.has(entry.category)) continue
    if (tagFilter) {
      let allPresent = true
      for (const tag of tagFilter) {
        if (!entry.tags.includes(tag)) {
          allPresent = false
          break
        }
      }
      if (!allPresent) continue
    }
    if (searchNeedle !== undefined) {
      if (!entry.summary.toLowerCase().includes(searchNeedle)) continue
    }
    if (entityFilter) {
      const inActors = entry.relatedActors.some(
        (r) => r.kind === entityFilter.kind && r.id === entityFilter.id,
      )
      const inLocations =
        !inActors &&
        entry.relatedLocations.some(
          (r) => r.kind === entityFilter.kind && r.id === entityFilter.id,
        )
      if (!inActors && !inLocations) continue
    }
    survivors.push(entry)
  }

  // ── Project rows newest-first ──────────────────────────────────────
  //
  // `state.history` is append-only (chronological); reverse to get
  // newest first while preserving same-day insertion order.
  const reversed = survivors.slice().reverse()
  const rows: TavernLogRow[] = reversed.map((e) => rowFromEntry(state, e))

  // ── Group by absoluteDay (single pass) ─────────────────────────────
  const groups: TavernLogDayGroup[] = []
  for (let i = 0; i < rows.length; ) {
    const row = rows[i]!
    let j = i + 1
    while (j < rows.length && rows[j]!.absoluteDay === row.absoluteDay) j += 1
    groups.push({
      absoluteDay: row.absoluteDay,
      year: row.year,
      month: row.month,
      week: row.week,
      day: row.day,
      rowCount: j - i,
      rowStart: i,
      rowEnd: j,
    })
    i = j
  }

  // ── Resolve "applied filters" echo and active-filter count ─────────
  const entityLabel = entityFilter
    ? resolveEntityLabel(state, entityFilter)
    : undefined
  const appliedFilters: TavernLogAppliedFilters = {
    categories: categorySet ? [...categorySet] : [],
    tags: tagFilter ? [...tagFilter] : [],
    dayRange: effDayRange,
    search: searchRaw,
    ...(entityFilter && entityLabel
      ? {
          entity: {
            kind: entityFilter.kind,
            id: entityFilter.id,
            label: entityLabel,
          },
        }
      : {}),
  }

  let activeFilterCount = 0
  if (categorySet) activeFilterCount += 1
  if (tagFilter) activeFilterCount += 1
  if (effDayRange !== defDayRange) activeFilterCount += 1
  if (searchNeedle !== undefined) activeFilterCount += 1
  if (entityFilter) activeFilterCount += 1

  // ── Empty reason ───────────────────────────────────────────────────
  let emptyReason: TavernLogEmptyReason | undefined
  if (totalEntries === 0) emptyReason = 'no_history'
  else if (rows.length === 0) emptyReason = 'filtered_out'

  const result: TavernLogData = {
    totalEntries,
    filteredCount: rows.length,
    rows,
    groups,
    categoryFacets,
    tagFacets,
    appliedFilters,
    activeFilterCount,
  }
  if (emptyReason !== undefined) result.emptyReason = emptyReason
  return result
}
