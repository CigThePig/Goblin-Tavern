import { clamp } from '../utils/clamp'
import type {
  AreaState,
  StockState,
  TavernState,
} from './TavernState'

// Phase 6 §6.4 — Normalization helpers.
//
// These are intentionally explicit: callers reach for them when slight
// numeric drift is expected (a small overshoot from an arithmetic step,
// for instance). `validateState` does NOT silently apply them — invalid
// values still fail validation. See `phases-06-10.md` §6.4 for the
// "do not hide bugs" guidance.

export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0
  return clamp(value, 0, 100)
}

export function clampNonNegative(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, value)
}

export function normalizeArea(area: AreaState): AreaState {
  return {
    ...area,
    condition: clampPercent(area.condition),
    cleanliness: clampPercent(area.cleanliness),
    mess: clampPercent(area.mess),
    damage: clampPercent(area.damage),
    smell: clampPercent(area.smell),
    risk: clampPercent(area.risk),
  }
}

export function normalizeStockItem(item: StockState): StockState {
  return {
    ...item,
    quantity: clampNonNegative(item.quantity),
    quality: clampPercent(item.quality),
    spoilage: clampPercent(item.spoilage),
  }
}

export function normalizeTavernState(state: TavernState): TavernState {
  const areas: Record<string, AreaState> = {}
  for (const [id, area] of Object.entries(state.areas)) {
    areas[id] = normalizeArea(area)
  }
  const stock: Record<string, StockState> = {}
  for (const [id, item] of Object.entries(state.stock)) {
    stock[id] = normalizeStockItem(item)
  }
  return { ...state, areas, stock }
}
