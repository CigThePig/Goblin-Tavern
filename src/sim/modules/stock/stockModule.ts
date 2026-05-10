import { z } from 'zod'

import type { SimulationModule, SimulationHook } from '../../core/module'
import type { SimContext } from '../../core/context'
import type { ReportSection } from '../../core/reports'
import type { ValidationIssue } from '../../state/types'
import type { StockState } from '../../state/TavernState'

import {
  ensureRequiredStockRegistered,
  stockRegistry,
} from '../../registries/stockRegistry'
import {
  STOCK_MODULE_ID,
  createInitialStockModuleState,
  getStockModuleState,
} from './state'
import { applyDailySpoilage, effectiveQuality, isPerishable } from './spoilage'
import { getDailyProfitLoss } from './ledger'
import type {
  CoinLedgerEntry,
  ShortageRecord,
  StockModuleState,
} from './types'

// Phase 9 §9.2 — Stock module.
//
// Responsibilities:
//   - Confirm the six required stock items exist at the start of each day.
//   - Reset the day's ledger and shortage list (§9.3 / §9.6) so reports
//     and `getDailyProfitLoss` reflect only the current day's activity.
//   - Apply daily spoilage to perishable items via `ctx.modifyStock`
//     (Phase 7 §7.3.1 / Phase 9 §9.5).
//   - Build the stock report consumed during `generateReports`.
//   - Validate the stock slice.

const SOURCE = 'stock'

const REQUIRED_STOCK_IDS = [
  'ale',
  'stew',
  'ingredients',
  'mushrooms',
  'firewood',
  'mugs',
] as const

const startDayHook: SimulationHook = (ctx: SimContext): void => {
  ensureRequiredStockRegistered()
  for (const id of REQUIRED_STOCK_IDS) {
    if (!ctx.state.stock[id]) {
      throw new Error(`stock module: required stock item '${id}' is missing from state`)
    }
  }
  // Reset the per-day ledger and shortage list. The stock module owns the
  // `state.modules.stock` slice; the engine routes the write through
  // `ctx.modifyModuleState` so the cause-required mutation contract holds.
  ctx.modifyModuleState<StockModuleState>(
    STOCK_MODULE_ID,
    () => createInitialStockModuleState(),
    { source: SOURCE, reason: 'day_initialize' },
  )
}

const endDayHook: SimulationHook = (ctx: SimContext): void => {
  applyDailySpoilage(ctx)
}

function describeStockStatus(item: StockState): string {
  if (item.quantity <= 0) return 'Out of stock'
  if (item.spoilage >= 70) return 'Risky'
  if (item.spoilage >= 40) return 'Getting questionable'
  if (item.quantity <= 10) return 'Low'
  return 'Adequate'
}

function buildStockReport(ctx: SimContext): ReportSection {
  const items = Object.values(ctx.state.stock)
  const moduleState = getStockModuleState(ctx.state)
  const lines: string[] = []

  for (const item of items) {
    lines.push(`${item.label}`)
    lines.push(`  Quantity: ${item.quantity}`)
    lines.push(`  Quality: ${item.quality}`)
    lines.push(`  Spoilage: ${item.spoilage}`)
    if (isPerishable(item)) {
      lines.push(`  Effective quality: ${effectiveQuality(item).toFixed(1)}`)
    }
    if (item.storageAreaId) {
      lines.push(`  Stored in: ${item.storageAreaId}`)
    }
    lines.push(`  Status: ${describeStockStatus(item)}`)
  }

  if (moduleState.shortages.length > 0) {
    lines.push('')
    lines.push('Shortages:')
    for (const shortage of moduleState.shortages) {
      lines.push(
        `  ${shortage.stockId}: requested ${shortage.requested}, available ${shortage.available} (${shortage.reason})`,
      )
    }
  }

  // Top sales summary.
  const salesByStock = new Map<string, number>()
  for (const entry of moduleState.ledger) {
    if (entry.category !== 'sales') continue
    const tag = entry.tags.find((t) => !t.startsWith('buyer:') && t !== 'sale')
    if (!tag) continue
    salesByStock.set(tag, (salesByStock.get(tag) ?? 0) + entry.amount)
  }
  if (salesByStock.size > 0) {
    lines.push('')
    lines.push('Sales:')
    const sorted = [...salesByStock.entries()].sort((a, b) => b[1] - a[1])
    for (const [id, amount] of sorted) {
      lines.push(`  ${id}: ${amount}`)
    }
  }

  const profitLoss = getDailyProfitLoss(ctx.state)
  lines.push('')
  lines.push(`Daily profit/loss: ${profitLoss}`)

  return {
    id: 'stock',
    source: SOURCE,
    title: 'STOCK REPORT',
    lines,
    data: {
      profitLoss,
      shortages: moduleState.shortages.map((s) => ({ ...s })),
      ledgerEntries: moduleState.ledger.length,
    },
  }
}

function validateStock(ctx: SimContext): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  for (const id of REQUIRED_STOCK_IDS) {
    if (!ctx.state.stock[id]) {
      issues.push({
        path: `stock.${id}`,
        message: `Required stock item '${id}' is missing`,
        code: 'missing_required_stock',
      })
    }
  }

  // Surface registry/state drift early: every registered required item
  // should declare a sensible price pair.
  for (const def of stockRegistry.all()) {
    const item = ctx.state.stock[def.id]
    if (!item) continue
    if (item.salePrice < 0 || item.basePrice < 0) {
      issues.push({
        path: `stock.${def.id}`,
        message: `Stock prices must be non-negative`,
        code: 'negative_stock_price',
      })
    }
  }

  return issues
}

// Phase 6 §6.1.1 — schema for `state.modules.stock`.
const CoinLedgerCategoryEnum = z.enum([
  'sales',
  'purchase',
  'wage',
  'repair',
  'rent',
  'waste',
  'other',
])

const CoinLedgerEntrySchema: z.ZodType<CoinLedgerEntry> = z.object({
  source: z.string(),
  amount: z.number(),
  category: CoinLedgerCategoryEnum,
  tags: z.array(z.string()),
})

const ShortageRecordSchema: z.ZodType<ShortageRecord> = z.object({
  stockId: z.string(),
  requested: z.number().min(0),
  available: z.number().min(0),
  day: z.number().int().min(1),
  reason: z.string(),
})

const StockModuleStateSchema: z.ZodType<StockModuleState> = z.object({
  ledger: z.array(CoinLedgerEntrySchema),
  shortages: z.array(ShortageRecordSchema),
})

export const stockModule: SimulationModule = {
  id: STOCK_MODULE_ID,
  version: '0.1.0',
  hooks: {
    startDay: [startDayHook],
    endDay: [endDayHook],
  },
  buildReport: buildStockReport,
  validate: validateStock,
  stateSchema: StockModuleStateSchema,
}

export { stockRegistry, ensureRequiredStockRegistered }
export { effectiveQuality, isPerishable } from './spoilage'
export { addCoin, spendCoin, getDailyProfitLoss } from './ledger'
export {
  sellStockItem,
  consumeStockItem,
  restockItem,
  wasteStockItem,
} from './sales'
export type {
  SellResult,
  SellOptions,
  ConsumeResult,
  WasteResult,
} from './sales'
export { getStockModuleState, createInitialStockModuleState } from './state'
