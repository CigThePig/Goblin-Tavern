import type { SimInput, SimInputOwnerAction } from '../core/context'
import type { TavernState } from '../state/TavernState'

// Phase 15 §15.11 — Policy bots for the end-of-batch sanity check.
//
// These are minimum-viable strategy stubs. Each bot receives the *current*
// state and returns the SimInput it would feed `simulateDay` for that
// day. The bots are intentionally tiny: they prove the simulation reacts
// to different inputs, not that the strategies are realistic.

export type PolicyBot = {
  id: string
  label: string
  /** Build the owner action list for a given day. */
  chooseActions(state: TavernState): ReadonlyArray<SimInputOwnerAction>
}

export const autoNoOwnerActionsBot: PolicyBot = {
  id: 'auto_no_owner_actions',
  label: 'Auto: No Owner Actions',
  chooseActions(): ReadonlyArray<SimInputOwnerAction> {
    return []
  },
}

function dirtiestAreaId(state: TavernState): string | undefined {
  let worstId: string | undefined
  let worstScore = -Infinity
  for (const area of Object.values(state.areas)) {
    const score = (100 - area.cleanliness) + area.smell * 0.5
    if (score > worstScore) {
      worstScore = score
      worstId = area.id
    }
  }
  return worstId
}

export const autoAlwaysCleanBot: PolicyBot = {
  id: 'auto_always_clean',
  label: 'Auto: Always Clean',
  chooseActions(state): ReadonlyArray<SimInputOwnerAction> {
    const targetId = dirtiestAreaId(state)
    if (!targetId) return []
    return [{ actionId: 'clean_area', targetId }]
  },
}

function lowestStockId(state: TavernState): string | undefined {
  let lowestId: string | undefined
  let lowestQty = Infinity
  for (const item of Object.values(state.stock)) {
    if (item.quantity < lowestQty) {
      lowestQty = item.quantity
      lowestId = item.id
    }
  }
  return lowestId
}

export const autoAlwaysRestockBot: PolicyBot = {
  id: 'auto_always_restock',
  label: 'Auto: Always Restock',
  chooseActions(state): ReadonlyArray<SimInputOwnerAction> {
    const stockId = lowestStockId(state)
    if (!stockId) return []
    return [{ actionId: 'restock_item', targetId: stockId, amount: 20 }]
  },
}

export function policyBotInput(
  seed: string,
  bot: PolicyBot,
  state: TavernState,
): SimInput {
  return {
    seed,
    ownerActions: [...bot.chooseActions(state)],
  }
}

export const REQUIRED_POLICY_BOTS: ReadonlyArray<PolicyBot> = [
  autoNoOwnerActionsBot,
  autoAlwaysCleanBot,
  autoAlwaysRestockBot,
]
