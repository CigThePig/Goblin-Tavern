import type { SimContext, MutationMeta } from '../../core/context'
import type { TavernState } from '../../state/TavernState'

import { STOCK_MODULE_ID, getStockModuleState } from './state'
import type { CoinLedgerCategory, CoinLedgerEntry, StockModuleState } from './types'

// Phase 9 §9.3 — Coin ledger.
//
// All coin movements are required to go through `addCoin` / `spendCoin`
// (Phase 9 §9.3 "Do not directly mutate coin everywhere without ledger
// entries"). These helpers:
//   - route the numeric change through `ctx.modifyCoin` so the Phase 7
//     §7.3.1 cause contract holds end-to-end;
//   - append a `CoinLedgerEntry` to `state.modules.stock.ledger` via
//     `ctx.modifyModuleState` so the explainability trail is preserved.
//
// `getDailyProfitLoss(state)` returns the net coin movement recorded by
// the current day's ledger. The stock module's `startDay` hook resets the
// ledger; entries accumulate within a single simulated day.

export type LedgerMeta = MutationMeta & {
  category: CoinLedgerCategory
  tags?: ReadonlyArray<string>
}

function appendEntry(ctx: SimContext, entry: CoinLedgerEntry, meta: MutationMeta): void {
  ctx.modifyModuleState<StockModuleState>(
    STOCK_MODULE_ID,
    (current) => {
      const base = current ?? { ledger: [], shortages: [] }
      return {
        ...base,
        ledger: [...base.ledger, entry],
      }
    },
    meta,
  )
}

export function addCoin(ctx: SimContext, amount: number, meta: LedgerMeta): void {
  if (!Number.isFinite(amount)) {
    throw new Error(`addCoin: amount must be a finite number, got ${amount}`)
  }
  if (amount < 0) {
    throw new Error(
      `addCoin: amount must be non-negative (use spendCoin for negative flow), got ${amount}`,
    )
  }
  if (amount === 0) return
  ctx.modifyCoin(amount, meta)
  appendEntry(
    ctx,
    {
      source: meta.source,
      amount,
      category: meta.category,
      tags: meta.tags ? [...meta.tags] : [],
    },
    meta,
  )
}

export function spendCoin(ctx: SimContext, amount: number, meta: LedgerMeta): void {
  if (!Number.isFinite(amount)) {
    throw new Error(`spendCoin: amount must be a finite number, got ${amount}`)
  }
  if (amount < 0) {
    throw new Error(
      `spendCoin: amount must be non-negative (use addCoin for positive flow), got ${amount}`,
    )
  }
  if (amount === 0) return
  ctx.modifyCoin(-amount, meta)
  appendEntry(
    ctx,
    {
      source: meta.source,
      amount: -amount,
      category: meta.category,
      tags: meta.tags ? [...meta.tags] : [],
    },
    meta,
  )
}

export function getDailyProfitLoss(state: TavernState): number {
  const moduleState = getStockModuleState(state)
  let total = 0
  for (const entry of moduleState.ledger) {
    total += entry.amount
  }
  return total
}
