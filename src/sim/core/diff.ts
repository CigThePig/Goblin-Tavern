import type {
  AreaState,
  CustomerGroupState,
  PressureState,
  ReputationState,
  StaffState,
  StockState,
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

  const significantChanges = filterSignificantChanges(
    { changes, significantChanges: [] },
    DEFAULT_THRESHOLDS,
  )

  return { changes, significantChanges }
}

function isMeterPath(path: string): boolean {
  // Area/customer/staff per-field meter paths.
  return (
    path.startsWith('areas.') ||
    path.startsWith('customers.') ||
    path.startsWith('staff.')
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
