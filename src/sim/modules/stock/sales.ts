import type { SimContext } from '../../core/context'
import type { StockState } from '../../state/TavernState'

import { addCoin, spendCoin } from './ledger'
import { STOCK_MODULE_ID } from './state'
import type { ShortageRecord, StockModuleState } from './types'

// Phase 9 §9.4 — Stock sales helpers.
//
// `sellStockItem`, `consumeStockItem`, `restockItem`, and `wasteStockItem`
// are the only sanctioned paths to mutate stock quantities and coin in
// response to business activity. Each helper:
//   - reads quantity through `ctx.state.stock[id]`;
//   - clamps requests at zero and records a `ShortageRecord` when
//     requested quantity exceeds available;
//   - writes stock changes via `ctx.modifyStock` (Phase 7 §7.3.1);
//   - writes coin changes via `addCoin` / `spendCoin` (Phase 9 §9.3 ledger).
//
// Phase 12 (Daily Service) and beyond consume these helpers directly as a
// public contract — see Phase 9 §9.4 forward note.

export type SellResult = {
  /** Units actually sold (may be less than requested when stock is short). */
  sold: number
  /** Coin earned (units sold × salePrice). */
  earned: number
  /** Shortage record produced, if the request was not fulfilled. */
  shortage?: ShortageRecord
}

export type SellOptions = {
  buyerGroupId?: string
  /** Optional source tag for the ledger entry. Defaults to 'stock.sale'. */
  source?: string
  /** Expansion Phase 5 — the price actually charged after a real policy. */
  priceMultiplier?: number
}

function getStock(ctx: SimContext, stockId: string): StockState {
  const item = ctx.state.stock[stockId]
  if (!item) {
    throw new Error(`stock helper: unknown stock id '${stockId}'`)
  }
  return item
}

function appendShortage(ctx: SimContext, shortage: ShortageRecord): void {
  ctx.modifyModuleState<StockModuleState>(
    STOCK_MODULE_ID,
    (current) => {
      const base = current ?? { ledger: [], shortages: [] }
      return {
        ...base,
        shortages: [...base.shortages, shortage],
      }
    },
    { source: 'stock', reason: 'shortage' },
  )
}

export function recordShortage(
  ctx: SimContext,
  stockId: string,
  requested: number,
  available: number,
  reason: string,
): ShortageRecord {
  const shortage: ShortageRecord = {
    stockId,
    requested,
    available,
    day: ctx.state.calendar.totalDaysElapsed + 1,
    reason,
  }
  appendShortage(ctx, shortage)
  return shortage
}

export function sellStockItem(
  ctx: SimContext,
  stockId: string,
  quantity: number,
  options?: SellOptions,
): SellResult {
  if (!Number.isFinite(quantity) || quantity < 0) {
    throw new Error(`sellStockItem: quantity must be non-negative, got ${quantity}`)
  }
  const item = getStock(ctx, stockId)
  const available = item.quantity
  const sold = Math.min(quantity, available)
  const multiplier = Math.max(0, options?.priceMultiplier ?? 1)
  // Coin is an integer state invariant. Discounts and premiums change the
  // final bill, but never create fractional currency that invalidates saves.
  const earned = Math.round(sold * item.salePrice * multiplier)
  const source = options?.source ?? `stock.sale.${stockId}`
  const tags = ['sale', stockId]
  if (multiplier !== 1) tags.push(`price_multiplier:${multiplier}`)
  if (options?.buyerGroupId) tags.push(`buyer:${options.buyerGroupId}`)

  if (sold > 0) {
    ctx.modifyStock(
      stockId,
      { quantity: available - sold },
      { source: 'stock', reason: 'sale' },
    )
    addCoin(ctx, earned, {
      source,
      category: 'sales',
      tags,
    })
  }

  const result: SellResult = { sold, earned }
  if (sold < quantity) {
    result.shortage = recordShortage(ctx, stockId, quantity, available, 'sale')
  }
  return result
}

export type ConsumeResult = {
  consumed: number
  shortage?: ShortageRecord
}

export function consumeStockItem(
  ctx: SimContext,
  stockId: string,
  quantity: number,
  reason: string,
): ConsumeResult {
  if (!Number.isFinite(quantity) || quantity < 0) {
    throw new Error(`consumeStockItem: quantity must be non-negative, got ${quantity}`)
  }
  const item = getStock(ctx, stockId)
  const available = item.quantity
  const consumed = Math.min(quantity, available)

  if (consumed > 0) {
    ctx.modifyStock(
      stockId,
      { quantity: available - consumed },
      { source: 'stock', reason },
    )
  }

  const result: ConsumeResult = { consumed }
  if (consumed < quantity) {
    result.shortage = recordShortage(ctx, stockId, quantity, available, reason)
  }
  return result
}

export function restockItem(
  ctx: SimContext,
  stockId: string,
  quantity: number,
  totalCost: number,
  source: string = `stock.restock.${stockId}`,
): void {
  if (!Number.isFinite(quantity) || quantity < 0) {
    throw new Error(`restockItem: quantity must be non-negative, got ${quantity}`)
  }
  if (!Number.isFinite(totalCost) || totalCost < 0) {
    throw new Error(`restockItem: totalCost must be non-negative, got ${totalCost}`)
  }
  const item = getStock(ctx, stockId)
  if (quantity > 0) {
    ctx.modifyStock(
      stockId,
      { quantity: item.quantity + quantity },
      { source: 'stock', reason: 'restock' },
    )
  }
  if (totalCost > 0) {
    spendCoin(ctx, totalCost, {
      source,
      category: 'purchase',
      tags: ['restock', stockId],
    })
  }
}

export type WasteResult = {
  wasted: number
}

export function wasteStockItem(
  ctx: SimContext,
  stockId: string,
  quantity: number,
  reason: string,
): WasteResult {
  if (!Number.isFinite(quantity) || quantity < 0) {
    throw new Error(`wasteStockItem: quantity must be non-negative, got ${quantity}`)
  }
  const item = getStock(ctx, stockId)
  const wasted = Math.min(quantity, item.quantity)
  if (wasted > 0) {
    ctx.modifyStock(
      stockId,
      { quantity: item.quantity - wasted },
      { source: 'stock', reason: `waste:${reason}` },
    )
  }
  return { wasted }
}
