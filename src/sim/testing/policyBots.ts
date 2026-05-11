import type { SimInput, SimInputOwnerAction } from '../core/context'
import type { TavernState } from '../state/TavernState'
import type {
  IssueSeed,
  ResponseIntent,
  ResponseIntentShape,
  ResponseSlot,
} from '../modules/issues/issueSeedTypes'

// Phase 20 §20.2 / §20.3 — Policy bots for cardless playtests.
//
// A policy bot is a tiny stateless strategy: it answers "given this
// state, what owner actions, staff priorities, and response intents
// should the simulation use today?". The goal is not realism — it is to
// produce distinct, deterministic tavern outcomes so the strategy
// comparison report can prove that different inputs really lead to
// different worlds. If every bot produced the same outcome the seed
// generators are not paying attention; that is exactly what the
// readiness gate flags.

export type PolicyBotId =
  | 'manual_debug'
  | 'auto_no_owner_actions'
  | 'auto_random_owner'
  | 'auto_clean_focused'
  | 'auto_profit_focused'
  | 'auto_merchant_focused'
  | 'auto_miner_focused'
  | 'auto_ignore_repairs'
  | 'auto_staff_friendly'
  // Phase 15 §15.11 backwards-compatible alias kept around so older
  // tests that reach for `auto_always_clean` still resolve.
  | 'auto_always_clean'
  | 'auto_always_restock'

export type PolicyBot = {
  id: PolicyBotId
  label: string
  /** Owner actions to take this day. Up to 3 per day. */
  chooseActions(state: TavernState): ReadonlyArray<SimInputOwnerAction>
  /** Staff priority overrides. Empty/undefined means use defaults. */
  chooseStaffPriorities?(state: TavernState): Record<string, string>
  /** Response intent for a given seed. Defaults to first slot if omitted. */
  chooseResponse?(
    state: TavernState,
    seed: IssueSeed,
  ): ResponseIntent | null
}

// ----------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------

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

function mostDamagedAreaId(state: TavernState): string | undefined {
  let worstId: string | undefined
  let worstDamage = -1
  for (const area of Object.values(state.areas)) {
    if (area.damage > worstDamage) {
      worstDamage = area.damage
      worstId = area.id
    }
  }
  return worstDamage > 0 ? worstId : undefined
}

function lowestStockId(state: TavernState, exclude: string[] = []): string | undefined {
  let lowestId: string | undefined
  let lowestQty = Infinity
  for (const item of Object.values(state.stock)) {
    if (exclude.includes(item.id)) continue
    if (item.quantity < lowestQty) {
      lowestQty = item.quantity
      lowestId = item.id
    }
  }
  return lowestId
}

function lowestStaffMoraleId(state: TavernState): string | undefined {
  let worstId: string | undefined
  let worstMorale = Infinity
  for (const s of Object.values(state.staff)) {
    if (s.morale < worstMorale) {
      worstMorale = s.morale
      worstId = s.id
    }
  }
  return worstId
}

function chooseResponseSlot(seed: IssueSeed, shapes: ResponseIntentShape[]): ResponseSlot | undefined {
  for (const shape of shapes) {
    const slot = seed.responseSlots.find((s) => s.shape === shape)
    if (slot) return slot
  }
  return seed.responseSlots[0]
}

function intentFromSlot(seed: IssueSeed, slot: ResponseSlot | undefined): ResponseIntent | null {
  if (!slot) return null
  const verb = slot.allowedVerbs[0]
  if (!verb) return null
  return {
    id: `bot-intent-${seed.id}-${slot.id}`,
    seedId: seed.id,
    verb,
    shape: slot.shape,
    tags: [],
    intensity: 50,
    metadata: { responseSlotId: slot.id },
  }
}

// ----------------------------------------------------------------------
// Manual / no-op bots
// ----------------------------------------------------------------------

export const manualDebugBot: PolicyBot = {
  id: 'manual_debug',
  label: 'Manual Debug',
  chooseActions(): ReadonlyArray<SimInputOwnerAction> {
    return []
  },
}

export const autoNoOwnerActionsBot: PolicyBot = {
  id: 'auto_no_owner_actions',
  label: 'Auto: No Owner Actions',
  chooseActions(): ReadonlyArray<SimInputOwnerAction> {
    return []
  },
}

// Deterministic-but-varied owner picker: uses absoluteDay as the
// "randomness" axis so seed-equivalent runs replay identically.
export const autoRandomOwnerBot: PolicyBot = {
  id: 'auto_random_owner',
  label: 'Auto: Pseudo-Random Owner',
  chooseActions(state): ReadonlyArray<SimInputOwnerAction> {
    const tick = state.calendar.totalDaysElapsed
    const dirty = dirtiestAreaId(state)
    const lowStock = lowestStockId(state)
    const phase = tick % 3
    if (phase === 0 && dirty) {
      return [{ actionId: 'clean_area', targetId: dirty }]
    }
    if (phase === 1 && lowStock) {
      return [{ actionId: 'restock_item', targetId: lowStock, amount: 20 }]
    }
    const damaged = mostDamagedAreaId(state)
    if (damaged) {
      return [{ actionId: 'repair_area', targetId: damaged }]
    }
    return []
  },
}

// ----------------------------------------------------------------------
// Clean-focused bot
// ----------------------------------------------------------------------

export const autoCleanFocusedBot: PolicyBot = {
  id: 'auto_clean_focused',
  label: 'Auto: Clean Focused',
  chooseActions(state): ReadonlyArray<SimInputOwnerAction> {
    const actions: SimInputOwnerAction[] = []
    const dirty = dirtiestAreaId(state)
    if (dirty) actions.push({ actionId: 'clean_area', targetId: dirty })
    const damaged = mostDamagedAreaId(state)
    if (damaged && state.coin >= 20) {
      actions.push({ actionId: 'repair_area', targetId: damaged })
    }
    const lowStock = lowestStockId(state)
    if (lowStock && state.coin >= 20) {
      actions.push({ actionId: 'restock_item', targetId: lowStock, amount: 20 })
    }
    return actions
  },
  chooseStaffPriorities(state): Record<string, string> {
    const out: Record<string, string> = {}
    for (const s of Object.values(state.staff)) {
      if (s.role === 'cook') out[s.id] = 'clean_as_you_go'
      else if (s.role === 'server') out[s.id] = 'help_clean'
      else if (s.role === 'cleaner_bouncer') out[s.id] = 'clean'
    }
    return out
  },
  chooseResponse(_state, seed): ResponseIntent | null {
    return intentFromSlot(seed, chooseResponseSlot(seed, ['safe_costly', 'long_term_investment']))
  },
}

// Backwards-compatible alias preserving the Phase 15 §15.11 bot id.
export const autoAlwaysCleanBot: PolicyBot = {
  ...autoCleanFocusedBot,
  id: 'auto_always_clean',
  label: 'Auto: Always Clean',
}

// ----------------------------------------------------------------------
// Profit-focused bot
// ----------------------------------------------------------------------

export const autoProfitFocusedBot: PolicyBot = {
  id: 'auto_profit_focused',
  label: 'Auto: Profit Focused',
  chooseActions(state): ReadonlyArray<SimInputOwnerAction> {
    const actions: SimInputOwnerAction[] = []
    // Restock the lowest seller every day.
    const lowStock = lowestStockId(state)
    if (lowStock && state.coin >= 10) {
      actions.push({ actionId: 'restock_item', targetId: lowStock, amount: 20 })
    }
    // Water down ale when ale quantity is low.
    const ale = state.stock.ale
    if (ale && ale.quantity < 30 && ale.quantity > 0) {
      actions.push({ actionId: 'water_down_ale' })
    } else if (ale && ale.salePrice < 6 && state.coin > 20) {
      // Otherwise nudge ale prices up.
      actions.push({ actionId: 'adjust_prices', targetId: 'ale', amount: 1 })
    }
    return actions
  },
  chooseStaffPriorities(state): Record<string, string> {
    const out: Record<string, string> = {}
    for (const s of Object.values(state.staff)) {
      if (s.role === 'cook') out[s.id] = 'speed'
      else if (s.role === 'server') out[s.id] = 'maximize_sales'
      else if (s.role === 'cleaner_bouncer') out[s.id] = 'intimidate_debtors'
    }
    return out
  },
  chooseResponse(_state, seed): ResponseIntent | null {
    return intentFromSlot(
      seed,
      chooseResponseSlot(seed, ['risky_profitable', 'deception', 'reputation_play']),
    )
  },
}

// Backwards-compatible alias.
export const autoAlwaysRestockBot: PolicyBot = {
  id: 'auto_always_restock',
  label: 'Auto: Always Restock',
  chooseActions(state): ReadonlyArray<SimInputOwnerAction> {
    const stockId = lowestStockId(state)
    if (!stockId) return []
    if (state.coin < 10) return []
    return [{ actionId: 'restock_item', targetId: stockId, amount: 20 }]
  },
}

// ----------------------------------------------------------------------
// Merchant-focused bot
// ----------------------------------------------------------------------

export const autoMerchantFocusedBot: PolicyBot = {
  id: 'auto_merchant_focused',
  label: 'Auto: Merchant Focused',
  chooseActions(state): ReadonlyArray<SimInputOwnerAction> {
    const actions: SimInputOwnerAction[] = []
    // Public-facing areas first.
    const publicAreas = ['main_room', 'kitchen', 'privy']
    let cleanTargetId: string | undefined
    let cleanScore = -Infinity
    for (const id of publicAreas) {
      const a = state.areas[id]
      if (!a) continue
      const score = 100 - a.cleanliness + a.smell * 0.5
      if (score > cleanScore) {
        cleanScore = score
        cleanTargetId = a.id
      }
    }
    if (cleanTargetId) {
      actions.push({ actionId: 'clean_area', targetId: cleanTargetId })
    }
    // Improve stew for tasty/respectable reputation.
    const stew = state.stock.stew
    const ingredients = state.stock.ingredients
    if (stew && ingredients && ingredients.quantity >= 5) {
      actions.push({ actionId: 'improve_stew' })
    }
    // Keep ale stocked but never water down.
    const ale = state.stock.ale
    if (ale && ale.quantity < 40 && state.coin >= 20) {
      actions.push({ actionId: 'restock_item', targetId: 'ale', amount: 20 })
    }
    return actions
  },
  chooseStaffPriorities(state): Record<string, string> {
    const out: Record<string, string> = {}
    for (const s of Object.values(state.staff)) {
      if (s.role === 'cook') out[s.id] = 'quality'
      else if (s.role === 'server') out[s.id] = 'keep_customers_happy'
      else if (s.role === 'cleaner_bouncer') out[s.id] = 'prevent_fights'
    }
    return out
  },
  chooseResponse(_state, seed): ResponseIntent | null {
    return intentFromSlot(
      seed,
      chooseResponseSlot(seed, ['safe_costly', 'long_term_investment', 'reputation_play']),
    )
  },
}

// ----------------------------------------------------------------------
// Miner-focused bot
// ----------------------------------------------------------------------

export const autoMinerFocusedBot: PolicyBot = {
  id: 'auto_miner_focused',
  label: 'Auto: Miner Focused',
  chooseActions(state): ReadonlyArray<SimInputOwnerAction> {
    const actions: SimInputOwnerAction[] = []
    const ale = state.stock.ale
    const dayType = state.calendar.dayType
    if (ale && ale.quantity < 60 && state.coin >= 20) {
      actions.push({ actionId: 'restock_item', targetId: 'ale', amount: 30 })
    }
    if (ale && ale.salePrice > 2 && dayType === 'payday') {
      actions.push({ actionId: 'adjust_prices', targetId: 'ale', amount: -1 })
    }
    // After Brawl Night, repair the main room.
    if (dayType === 'maintenance_day') {
      const main = state.areas.main_room
      if (main && main.damage > 0 && state.coin >= 10) {
        actions.push({ actionId: 'repair_area', targetId: 'main_room' })
      }
    }
    return actions
  },
  chooseStaffPriorities(state): Record<string, string> {
    const out: Record<string, string> = {}
    for (const s of Object.values(state.staff)) {
      if (s.role === 'cook') out[s.id] = 'speed'
      else if (s.role === 'server') out[s.id] = 'maximize_sales'
      else if (s.role === 'cleaner_bouncer') out[s.id] = 'minor_repairs'
    }
    return out
  },
  chooseResponse(_state, seed): ResponseIntent | null {
    return intentFromSlot(
      seed,
      chooseResponseSlot(seed, ['risky_profitable', 'short_term_patch', 'reputation_play']),
    )
  },
}

// ----------------------------------------------------------------------
// Ignore-repairs bot
// ----------------------------------------------------------------------

export const autoIgnoreRepairsBot: PolicyBot = {
  id: 'auto_ignore_repairs',
  label: 'Auto: Ignore Repairs',
  chooseActions(state): ReadonlyArray<SimInputOwnerAction> {
    const actions: SimInputOwnerAction[] = []
    // Profit at any cost — never repair unless an area is at the floor.
    const damaged = mostDamagedAreaId(state)
    if (damaged) {
      const a = state.areas[damaged]!
      if (a.damage >= 90 && state.coin >= 20) {
        actions.push({ actionId: 'repair_area', targetId: damaged })
      }
    }
    const lowStock = lowestStockId(state, ['mugs', 'firewood'])
    if (lowStock && state.coin >= 10) {
      actions.push({ actionId: 'restock_item', targetId: lowStock, amount: 20 })
    }
    return actions
  },
  chooseResponse(_state, seed): ResponseIntent | null {
    return intentFromSlot(seed, chooseResponseSlot(seed, ['delay_problem', 'ignore', 'risky_profitable']))
  },
}

// ----------------------------------------------------------------------
// Staff-friendly bot
// ----------------------------------------------------------------------

export const autoStaffFriendlyBot: PolicyBot = {
  id: 'auto_staff_friendly',
  label: 'Auto: Staff Friendly',
  chooseActions(state): ReadonlyArray<SimInputOwnerAction> {
    const actions: SimInputOwnerAction[] = []
    const tired = lowestStaffMoraleId(state)
    if (tired && state.coin >= 10) {
      const s = state.staff[tired]!
      if (s.morale < 60 || s.stress > 40) {
        actions.push({ actionId: 'pay_staff_bonus', targetId: tired, amount: 10 })
      }
    }
    const dirty = dirtiestAreaId(state)
    if (dirty) actions.push({ actionId: 'clean_area', targetId: dirty })
    const lowStock = lowestStockId(state)
    if (lowStock && state.coin >= 15) {
      actions.push({ actionId: 'restock_item', targetId: lowStock, amount: 20 })
    }
    return actions
  },
  chooseStaffPriorities(state): Record<string, string> {
    const out: Record<string, string> = {}
    for (const s of Object.values(state.staff)) {
      if (s.role === 'cook') out[s.id] = 'quality'
      else if (s.role === 'server') out[s.id] = 'keep_customers_happy'
      else if (s.role === 'cleaner_bouncer') out[s.id] = 'clean'
    }
    return out
  },
  chooseResponse(_state, seed): ResponseIntent | null {
    return intentFromSlot(seed, chooseResponseSlot(seed, ['safe_costly', 'long_term_investment']))
  },
}

// ----------------------------------------------------------------------
// Registry
// ----------------------------------------------------------------------

/**
 * Phase 15 §15.11 — original three-bot sanity-check set. Kept stable so
 * the Phase 15 test contract still passes after the Phase 20 expansion.
 */
export const REQUIRED_POLICY_BOTS: ReadonlyArray<PolicyBot> = [
  autoNoOwnerActionsBot,
  autoAlwaysCleanBot,
  autoAlwaysRestockBot,
]

/**
 * Phase 20 §20.2 / §20.3 — the canonical playtest mode set. These are
 * the bots that produce *distinct* tavern outcomes for the strategy
 * comparison report.
 */
export const PHASE_20_POLICY_BOTS: ReadonlyArray<PolicyBot> = [
  manualDebugBot,
  autoNoOwnerActionsBot,
  autoRandomOwnerBot,
  autoCleanFocusedBot,
  autoProfitFocusedBot,
  autoMerchantFocusedBot,
  autoMinerFocusedBot,
  autoIgnoreRepairsBot,
  autoStaffFriendlyBot,
]

const ALL_POLICY_BOTS: ReadonlyArray<PolicyBot> = [
  ...PHASE_20_POLICY_BOTS,
  autoAlwaysCleanBot,
  autoAlwaysRestockBot,
]

export const POLICY_BOTS_BY_ID: Record<PolicyBotId, PolicyBot> =
  ALL_POLICY_BOTS.reduce((acc, bot) => {
    acc[bot.id] = bot
    return acc
  }, {} as Record<PolicyBotId, PolicyBot>)

export function getPolicyBot(id: PolicyBotId): PolicyBot {
  const bot = POLICY_BOTS_BY_ID[id]
  if (!bot) throw new Error(`Unknown policy bot: ${id}`)
  return bot
}

/**
 * Build the SimInput a policy bot would feed `simulateDay` for the given
 * state. Kept around for the legacy Phase 15 §15.11 callers; new code
 * should use the chooser pattern from `simRunner`.
 */
export function policyBotInput(
  seed: string,
  bot: PolicyBot,
  state: TavernState,
): SimInput {
  const out: SimInput = {
    seed,
    ownerActions: [...bot.chooseActions(state)],
  }
  if (bot.chooseStaffPriorities) {
    const sp = bot.chooseStaffPriorities(state)
    if (Object.keys(sp).length > 0) out.staffPriorities = sp
  }
  return out
}
