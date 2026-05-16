import type {
  AreaState,
  CultureWorldState,
  CustomerGroupState,
  ExpeditionsState,
  FactionWorldState,
  HireableAdventurer,
  LocalEventWorldState,
  PressureState,
  RecipeState,
  RegularWorldState,
  ReputationState,
  SocialRumourState,
  StaffState,
  StockState,
  SupplierWorldState,
  TavernIdentityState,
  TavernState,
} from '../state/TavernState'

// Phase 17 §17.1 — State diff helpers.
//
// `createStateDiff(before, after)` walks two snapshots and emits a list
// of every numeric/array/scalar field that moved, plus a flagged subset
// of "significant" changes per the Phase 17 §17.1 thresholds. The
// snapshots are read-only inputs; this module owns no engine state.
//
// "Significant" is a heuristic threshold; the cause report uses the
// flagged subset to ask "did anything important happen without a
// matching cause?" — see Phase 17 §17.9.

export type StateChange = {
  path: string
  before: unknown
  after: unknown
  delta?: number
  readable: string
  tags: string[]
  source?: string
}

export type StateDiff = {
  changes: StateChange[]
  significantChanges: StateChange[]
}

export type DiffThresholds = {
  /** 0–100 meter fields (cleanliness, satisfaction, suspicion, etc.). */
  meter: number
  /** Coin delta. */
  coin: number
  /** Stock quantity delta. */
  stockQuantity: number
  /** Reputation axis delta. */
  reputation: number
  /** Pressure value delta. */
  pressure: number
}

// Phase 17 §17.1 — Default thresholds. These mirror the doc:
//   "percent-like value change >= 5"
//   "coin change >= 5"
//   "stock quantity change >= 5"
// Pressure/reputation match the meter threshold (both are 0–100 axes).
export const DEFAULT_THRESHOLDS: DiffThresholds = {
  meter: 5,
  coin: 5,
  stockQuantity: 5,
  reputation: 5,
  pressure: 5,
}

function numericDelta(before: unknown, after: unknown): number | undefined {
  if (typeof before === 'number' && typeof after === 'number') {
    return after - before
  }
  return undefined
}

function pushNumericChange(
  changes: StateChange[],
  path: string,
  before: number,
  after: number,
  options: { tags?: string[]; source?: string; readable?: string } = {},
): void {
  if (before === after) return
  const delta = after - before
  const direction = delta > 0 ? '+' : ''
  const readable = options.readable ?? `${path} ${before} → ${after} (${direction}${delta})`
  changes.push({
    path,
    before,
    after,
    delta,
    readable,
    tags: options.tags ? [...options.tags] : [],
    ...(options.source !== undefined ? { source: options.source } : {}),
  })
}

function pushScalarChange(
  changes: StateChange[],
  path: string,
  before: unknown,
  after: unknown,
  options: { tags?: string[]; source?: string; readable?: string } = {},
): void {
  if (before === after) return
  const delta = numericDelta(before, after)
  const readable =
    options.readable ?? `${path}: ${formatValue(before)} → ${formatValue(after)}`
  const change: StateChange = {
    path,
    before,
    after,
    readable,
    tags: options.tags ? [...options.tags] : [],
  }
  if (delta !== undefined) change.delta = delta
  if (options.source !== undefined) change.source = options.source
  changes.push(change)
}

function formatValue(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (value === null || value === undefined) return 'null'
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function diffAreas(
  before: Record<string, AreaState>,
  after: Record<string, AreaState>,
  changes: StateChange[],
): void {
  const ids = new Set([...Object.keys(before), ...Object.keys(after)])
  for (const id of ids) {
    const a = before[id]
    const b = after[id]
    if (!a || !b) continue
    const fields: (keyof AreaState)[] = [
      'condition',
      'cleanliness',
      'mess',
      'damage',
      'smell',
      'risk',
    ]
    for (const field of fields) {
      pushNumericChange(
        changes,
        `areas.${id}.${field}`,
        a[field] as number,
        b[field] as number,
        { tags: ['area', id, String(field)] },
      )
    }
  }
}

function diffStock(
  before: Record<string, StockState>,
  after: Record<string, StockState>,
  changes: StateChange[],
): void {
  const ids = new Set([...Object.keys(before), ...Object.keys(after)])
  for (const id of ids) {
    const a = before[id]
    const b = after[id]
    if (!a || !b) continue
    pushNumericChange(changes, `stock.${id}.quantity`, a.quantity, b.quantity, {
      tags: ['stock', id, 'quantity'],
    })
    pushNumericChange(changes, `stock.${id}.quality`, a.quality, b.quality, {
      tags: ['stock', id, 'quality'],
    })
    pushNumericChange(changes, `stock.${id}.spoilage`, a.spoilage, b.spoilage, {
      tags: ['stock', id, 'spoilage'],
    })
    pushNumericChange(
      changes,
      `stock.${id}.salePrice`,
      a.salePrice,
      b.salePrice,
      { tags: ['stock', id, 'price'] },
    )
  }
}

function diffStaff(
  before: Record<string, StaffState>,
  after: Record<string, StaffState>,
  changes: StateChange[],
): void {
  const ids = new Set([...Object.keys(before), ...Object.keys(after)])
  for (const id of ids) {
    const a = before[id]
    const b = after[id]
    if (!a || !b) continue
    const fields: (keyof StaffState)[] = [
      'morale',
      'stress',
      'fatigue',
      'loyalty',
      'skill',
    ]
    for (const field of fields) {
      pushNumericChange(
        changes,
        `staff.${id}.${String(field)}`,
        a[field] as number,
        b[field] as number,
        { tags: ['staff', id, String(field)] },
      )
    }
    pushScalarChange(
      changes,
      `staff.${id}.paidThisWeek`,
      a.paidThisWeek,
      b.paidThisWeek,
      { tags: ['staff', id, 'wages'] },
    )
  }
}

function diffCustomers(
  before: Record<string, CustomerGroupState>,
  after: Record<string, CustomerGroupState>,
  changes: StateChange[],
): void {
  const ids = new Set([...Object.keys(before), ...Object.keys(after)])
  for (const id of ids) {
    const a = before[id]
    const b = after[id]
    if (!a || !b) continue
    const fields: (keyof CustomerGroupState)[] = [
      'satisfaction',
      'patronage',
      'loyalty',
    ]
    for (const field of fields) {
      pushNumericChange(
        changes,
        `customers.${id}.${String(field)}`,
        a[field] as number,
        b[field] as number,
        { tags: ['customer', id, String(field)] },
      )
    }
  }
}

function diffReputation(
  before: ReputationState,
  after: ReputationState,
  changes: StateChange[],
): void {
  const keys = Object.keys(before) as (keyof ReputationState)[]
  for (const key of keys) {
    pushNumericChange(
      changes,
      `reputation.${String(key)}`,
      before[key],
      after[key],
      { tags: ['reputation', String(key)] },
    )
  }
}

function diffPressures(
  before: Record<string, PressureState>,
  after: Record<string, PressureState>,
  changes: StateChange[],
): void {
  const ids = new Set([...Object.keys(before), ...Object.keys(after)])
  for (const id of ids) {
    const a = before[id]
    const b = after[id]
    if (!a || !b) continue
    pushNumericChange(
      changes,
      `pressures.${id}.value`,
      a.value,
      b.value,
      { tags: ['pressure', id, 'value'] },
    )
  }
}

function diffMemoriesCount(
  before: TavernState,
  after: TavernState,
  changes: StateChange[],
): void {
  pushNumericChange(
    changes,
    'memories.count',
    before.memories.length,
    after.memories.length,
    { tags: ['memory', 'count'] },
  )
}

// ISSUE-002 (phase 42) — world-slice diff walks. Each helper iterates the
// union of ids and pushes one change per numeric field that moved. Skip
// timestamp-style fields (`firstSeenDay`, `lastDeliveryDay`, etc.) so the
// diff isn't flooded by per-day +1 stamps that have no matching cause.
// `notableNpcs` has only timestamp fields and is deliberately not walked.

function diffRecordNumerics<T>(
  before: Record<string, T>,
  after: Record<string, T>,
  fields: (keyof T)[],
  changes: StateChange[],
  pathFor: (id: string, field: string) => string,
  tagFor: (id: string, field: string) => string[],
): void {
  const ids = new Set([...Object.keys(before), ...Object.keys(after)])
  for (const id of ids) {
    const a = before[id]
    const b = after[id]
    if (!a || !b) continue
    for (const field of fields) {
      const av = a[field]
      const bv = b[field]
      if (typeof av !== 'number' || typeof bv !== 'number') continue
      pushNumericChange(
        changes,
        pathFor(id, String(field)),
        av,
        bv,
        { tags: tagFor(id, String(field)) },
      )
    }
  }
}

function diffCultures(
  before: Record<string, CultureWorldState>,
  after: Record<string, CultureWorldState>,
  changes: StateChange[],
): void {
  diffRecordNumerics(
    before,
    after,
    ['familiarity', 'comfort', 'tension'],
    changes,
    (id, field) => `cultures.${id}.${field}`,
    (id, field) => ['culture', id, field],
  )
}

function diffFactions(
  before: Record<string, FactionWorldState>,
  after: Record<string, FactionWorldState>,
  changes: StateChange[],
): void {
  diffRecordNumerics(
    before,
    after,
    ['relationship', 'influence', 'trust', 'fear'],
    changes,
    (id, field) => `factions.${id}.${field}`,
    (id, field) => ['faction', id, field],
  )
}

function diffSuppliers(
  before: Record<string, SupplierWorldState>,
  after: Record<string, SupplierWorldState>,
  changes: StateChange[],
): void {
  // Skip `lastDeliveryDay` — timestamp stamp.
  diffRecordNumerics(
    before,
    after,
    ['reliability', 'relationship', 'debtTolerance', 'priceBias'],
    changes,
    (id, field) => `suppliers.${id}.${field}`,
    (id, field) => ['supplier', id, field],
  )
}

function diffRegulars(
  before: Record<string, RegularWorldState>,
  after: Record<string, RegularWorldState>,
  changes: StateChange[],
): void {
  // Skip `firstSeenDay` / `lastSeenDay` — timestamp stamps that would
  // flood the diff each visit.
  diffRecordNumerics(
    before,
    after,
    ['loyalty', 'irritation', 'visits'],
    changes,
    (id, field) => `regulars.${id}.${field}`,
    (id, field) => ['regular', id, field],
  )
}

function diffLocalEvents(
  before: Record<string, LocalEventWorldState>,
  after: Record<string, LocalEventWorldState>,
  changes: StateChange[],
): void {
  // Skip `startedDay`, `endsDay`, `lastUpdatedDay` — timestamps.
  diffRecordNumerics(
    before,
    after,
    ['intensity', 'ageDays'],
    changes,
    (id, field) => `localEvents.${id}.${field}`,
    (id, field) => ['local_event', id, field],
  )
}

function diffSocialRumours(
  before: Record<string, SocialRumourState>,
  after: Record<string, SocialRumourState>,
  changes: StateChange[],
): void {
  diffRecordNumerics(
    before,
    after,
    ['strength'],
    changes,
    (id, field) => `socialRumours.${id}.${field}`,
    (id, field) => ['rumour', id, field],
  )
  // String-state flip on `accuracy` ('true' ↔ 'partial' ↔ 'false') is
  // meaningful enough to surface even though it has no numeric delta.
  const ids = new Set([...Object.keys(before), ...Object.keys(after)])
  for (const id of ids) {
    const a = before[id]
    const b = after[id]
    if (!a || !b) continue
    pushScalarChange(
      changes,
      `socialRumours.${id}.accuracy`,
      a.accuracy,
      b.accuracy,
      { tags: ['rumour', id, 'accuracy'] },
    )
  }
}

// ISSUE-035 (phase 75) — recipes / expeditions / hireableAdventurers
// were silently absent from the diff. Each walk skips counters and
// timestamps that increment every day (would flood the diff) and
// keeps meter / lifecycle / state-flip fields that match the existing
// cause-coverage audit shape.

function diffRecipes(
  before: Record<string, RecipeState>,
  after: Record<string, RecipeState>,
  changes: StateChange[],
): void {
  const ids = new Set([...Object.keys(before), ...Object.keys(after)])
  for (const id of ids) {
    const a = before[id]
    const b = after[id]
    if (!a || !b) continue
    pushScalarChange(
      changes,
      `recipes.${id}.onMenu`,
      a.onMenu,
      b.onMenu,
      { tags: ['recipe', id, 'onMenu'] },
    )
    // `timesServed`, `daysSinceLastServed`, `lastServedDay` increment
    // every day; treating them as diff entries would flood the cause
    // audit. Same omission shape as `regulars.lastSeenDay`.
  }
}

function diffExpeditions(
  before: ExpeditionsState,
  after: ExpeditionsState,
  changes: StateChange[],
): void {
  // Keyset diff on active expeditions: commissions (added) and
  // resolutions (removed) are the meaningful state flips. `daysElapsed`
  // is a per-day +1 counter; `status` is always `'in_progress'` while
  // in `active` — both are skipped.
  const beforeIds = new Set(before.active.map((e) => e.id))
  const afterIds = new Set(after.active.map((e) => e.id))
  for (const id of afterIds) {
    if (!beforeIds.has(id)) {
      pushScalarChange(
        changes,
        `expeditions.active.${id}`,
        null,
        'in_progress',
        { tags: ['expedition', id, 'commissioned'] },
      )
    }
  }
  for (const id of beforeIds) {
    if (!afterIds.has(id)) {
      pushScalarChange(
        changes,
        `expeditions.active.${id}`,
        'in_progress',
        null,
        { tags: ['expedition', id, 'resolved'] },
      )
    }
  }
  // Count-delta on completed records — long-run history is bounded in
  // diff output (the records themselves are never walked, since they
  // are append-only after resolution).
  pushNumericChange(
    changes,
    'expeditions.completed.count',
    before.completed.length,
    after.completed.length,
    { tags: ['expedition', 'completed', 'count'] },
  )
}

function diffHireableAdventurers(
  before: Record<string, HireableAdventurer>,
  after: Record<string, HireableAdventurer>,
  changes: StateChange[],
): void {
  const ids = new Set([...Object.keys(before), ...Object.keys(after)])
  for (const id of ids) {
    const a = before[id]
    const b = after[id]
    if (!a || !b) continue
    const fields: (keyof HireableAdventurer)[] = [
      'experience',
      'reliability',
      'relationship',
    ]
    for (const field of fields) {
      pushNumericChange(
        changes,
        `hireableAdventurers.${id}.${String(field)}`,
        a[field] as number,
        b[field] as number,
        { tags: ['adventurer', id, String(field)] },
      )
    }
    pushScalarChange(
      changes,
      `hireableAdventurers.${id}.currentExpeditionId`,
      a.currentExpeditionId,
      b.currentExpeditionId,
      { tags: ['adventurer', id, 'expedition'] },
    )
    // `daysSinceLastJob` is a per-day +1 counter — skipped for the same
    // reason regulars' `lastSeenDay` is skipped.
  }
}

function diffTavernIdentity(
  before: TavernIdentityState,
  after: TavernIdentityState,
  changes: StateChange[],
): void {
  // Singleton; only `foundingDay` is numeric. Rarely changes but we
  // still walk it for completeness so any post-hoc edit gets a diff
  // entry that matches the per-field cause emitted by
  // `modifyTavernIdentity`.
  pushNumericChange(
    changes,
    'tavernIdentity.foundingDay',
    before.foundingDay,
    after.foundingDay,
    { tags: ['tavern_identity', 'foundingDay'] },
  )
}

// `state.modules` is `Record<string, unknown>`. Walk shallowly per
// top-level key inside each slice and emit one change per key whose
// JSON-serialized value differs. Module-internal mutations have no
// canonical cause-target convention, so the matching entries in
// `targetForChange` intentionally return `undefined` — surfacing module
// writes as "unexplained" until module owners attribute them.
function diffModules(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  changes: StateChange[],
): void {
  const sliceIds = new Set([...Object.keys(before), ...Object.keys(after)])
  for (const moduleId of sliceIds) {
    const a = before[moduleId]
    const b = after[moduleId]
    const aIsObject = isPlainObject(a)
    const bIsObject = isPlainObject(b)
    if (aIsObject && bIsObject) {
      const keys = new Set([
        ...Object.keys(a as Record<string, unknown>),
        ...Object.keys(b as Record<string, unknown>),
      ])
      for (const key of keys) {
        const av = (a as Record<string, unknown>)[key]
        const bv = (b as Record<string, unknown>)[key]
        if (jsonEqual(av, bv)) continue
        pushScalarChange(changes, `modules.${moduleId}.${key}`, av, bv, {
          tags: ['module', moduleId, key],
        })
      }
      continue
    }
    if (jsonEqual(a, b)) continue
    pushScalarChange(changes, `modules.${moduleId}`, a, b, {
      tags: ['module', moduleId],
    })
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function jsonEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  try {
    return JSON.stringify(a) === JSON.stringify(b)
  } catch {
    return false
  }
}

export function createStateDiff(
  before: TavernState,
  after: TavernState,
): StateDiff {
  const changes: StateChange[] = []

  pushNumericChange(changes, 'coin', before.coin, after.coin, { tags: ['coin'] })
  diffAreas(before.areas, after.areas, changes)
  diffStock(before.stock, after.stock, changes)
  diffStaff(before.staff, after.staff, changes)
  diffCustomers(before.customerGroups, after.customerGroups, changes)
  diffReputation(before.reputation, after.reputation, changes)
  diffPressures(before.pressures, after.pressures, changes)
  diffMemoriesCount(before, after, changes)
  // ISSUE-002 (phase 42) — world slices and module state.
  diffCultures(before.world.cultures, after.world.cultures, changes)
  diffFactions(before.world.factions, after.world.factions, changes)
  diffSuppliers(before.world.suppliers, after.world.suppliers, changes)
  diffRegulars(before.world.regulars, after.world.regulars, changes)
  diffLocalEvents(before.world.localEvents, after.world.localEvents, changes)
  diffSocialRumours(before.world.socialRumours, after.world.socialRumours, changes)
  diffTavernIdentity(before.world.tavernIdentity, after.world.tavernIdentity, changes)
  // `notableNpcs` has no meter fields worth walking — only timestamps;
  // deliberately skipped (see phase-42 plan).
  // ISSUE-035 (phase 75) — top-level recipe / expedition slices and
  // the `world.hireableAdventurers` roster were silently absent from
  // the cause-coverage audit before phase 75.
  diffRecipes(before.recipes, after.recipes, changes)
  diffExpeditions(before.expeditions, after.expeditions, changes)
  diffHireableAdventurers(
    before.world.hireableAdventurers,
    after.world.hireableAdventurers,
    changes,
  )
  diffModules(before.modules, after.modules, changes)

  const significantChanges = filterSignificantChanges(
    { changes, significantChanges: [] },
    DEFAULT_THRESHOLDS,
  )

  return { changes, significantChanges }
}

function isMeterPath(path: string): boolean {
  // Area/customer/staff per-field meter paths, plus the Phase 27 world
  // slices whose meter fields share the 0–100 scale.
  return (
    path.startsWith('areas.') ||
    path.startsWith('customers.') ||
    path.startsWith('staff.') ||
    path.startsWith('cultures.') ||
    path.startsWith('factions.') ||
    path.startsWith('suppliers.') ||
    path.startsWith('regulars.') ||
    path.startsWith('localEvents.') ||
    path.startsWith('socialRumours.') ||
    path.startsWith('hireableAdventurers.')
  )
}

export function filterSignificantChanges(
  diff: StateDiff,
  thresholds: DiffThresholds,
): StateChange[] {
  const out: StateChange[] = []
  for (const change of diff.changes) {
    if (change.delta === undefined) {
      // Non-numeric change (e.g. paidThisWeek boolean flip) is always
      // significant: it's a state-shape flip, not a meter drift.
      out.push(change)
      continue
    }
    const magnitude = Math.abs(change.delta)
    let threshold = thresholds.meter
    if (change.path === 'coin') threshold = thresholds.coin
    else if (change.path.startsWith('stock.') && change.path.endsWith('.quantity'))
      threshold = thresholds.stockQuantity
    else if (change.path.startsWith('reputation.')) threshold = thresholds.reputation
    else if (change.path.startsWith('pressures.')) threshold = thresholds.pressure
    else if (isMeterPath(change.path)) threshold = thresholds.meter
    if (magnitude >= threshold) {
      out.push(change)
    }
  }
  return out
}

// Phase 17 §17.8 — Tag a state diff with a phase boundary label so
// reports can render "Owner Action Diff" vs "Service Diff" headings
// without re-deriving the boundary from the path list.
export type PhaseBoundary =
  | 'owner_actions'
  | 'service'
  | 'end_week'
  | 'end_month'
  | 'day'

export type TaggedStateDiff = StateDiff & {
  boundary: PhaseBoundary
}

export function tagDiff(diff: StateDiff, boundary: PhaseBoundary): TaggedStateDiff {
  return { ...diff, boundary }
}
