import type { SimContext } from '../../core/context'
import type { ReportSection } from '../../core/reports'
import type { SimulationModule } from '../../core/module'
import type { CauseEntry } from '../../state/TavernState'

import { actionRegistry } from '../../registries/actionRegistry'
import {
  ensureRequiredStockRegistered,
  stockRegistry,
} from '../../registries/stockRegistry'

import type { OwnerActionDefinition } from '../../modules/ownerActions/types'
import { TIME_COST_STANDARD } from '../../modules/ownerActions/stateHelpers'
import { spendCoin } from '../../modules/stock/ledger'
import { restockItem } from '../../modules/stock/sales'

import {
  ensureRequiredSeedGeneratorsRegistered,
  issueSeedGeneratorRegistry,
} from '../../modules/issues/index'
import {
  buildTextIngredients,
  effect,
  makeProfile,
  stockRef,
  customerRef,
  stake,
  systemRef,
} from '../../modules/issues/generatorHelpers'
import { stampFromState } from '../../modules/issues/generatorHelpers'
import { validateSeed } from '../../modules/issues/issueSeedValidation'
import type {
  IssueSeed,
  ConsequenceProfile,
  ResponseSlot,
} from '../../modules/issues/issueSeedTypes'

// Phase 20 §20.14 — Candle shortage expansion (the canonical Phase 1 §9.2
// fake expansion).
//
// Purpose: prove that a small expansion can plug into the simulation
// **without** touching anything in `src/sim/core/`, `src/sim/state/`,
// or `src/sim/registries/Registry.ts`. The expansion adds:
//
//   - a stock item: `candles`
//   - an area effect: a `low_light` impact on the main room when candles
//     are low (registered as a customer impact)
//   - an owner action: `buy_candles`
//   - a customer effect: merchants dislike darkness, goblins tolerate it
//   - an issue seed generator: `candle_shortage_darkness`
//   - a report section: a "LIGHTING REPORT" surfaced by a tiny
//     `candleShortageExpansion` simulation module
//
// Calling `installCandleShortageExpansion()` registers every piece.
// `uninstallCandleShortageExpansion()` is provided for repeated test runs.

export const CANDLE_STOCK_ID = 'candles'
export const CANDLE_BUY_ACTION_ID = 'buy_candles'
export const CANDLE_SEED_FAMILY = 'candle_shortage'
export const CANDLE_SEED_GENERATOR_ID = 'candle_shortage_darkness'

export const CANDLE_EXPANSION_MODULE_ID = 'candle_shortage_expansion'

const DEFAULT_BUY_AMOUNT = 10
const CANDLE_BASE_PRICE = 1
const CANDLE_SALE_PRICE = 1
const LOW_LIGHT_THRESHOLD = 8
const SEED_THRESHOLD = 5

// ----------------------------------------------------------------------
// 1. Stock item: candles
// ----------------------------------------------------------------------

function registerCandleStock(): void {
  ensureRequiredStockRegistered()
  if (stockRegistry.has(CANDLE_STOCK_ID)) return
  stockRegistry.register({
    id: CANDLE_STOCK_ID,
    label: 'Candles',
    tags: ['utility', 'lighting', 'consumable', 'main_room'],
    defaultState: {
      quantity: 20,
      quality: 50,
      spoilage: 0,
      basePrice: CANDLE_BASE_PRICE,
      salePrice: CANDLE_SALE_PRICE,
      storageAreaId: 'cellar',
      rarity: 'common',
    },
  })
}

// ----------------------------------------------------------------------
// 2. Owner action: buy_candles
// ----------------------------------------------------------------------

const buyCandles: OwnerActionDefinition = {
  id: CANDLE_BUY_ACTION_ID,
  label: 'Buy Candles',
  category: 'immediate',
  tags: ['stock', 'supply', 'lighting'],
  targetType: 'stock',
  actionPointCost: TIME_COST_STANDARD,
  getValidTargets: (ctx) => {
    const candles = ctx.state.stock[CANDLE_STOCK_ID]
    return candles
      ? [{ id: candles.id, label: candles.label, hint: `qty ${candles.quantity}` }]
      : []
  },
  canApply: (ctx, input) => {
    const candles = ctx.state.stock[CANDLE_STOCK_ID]
    if (!candles) {
      return {
        ok: false,
        code: 'no_candles',
        reason: 'Candles are not on the stock list',
      }
    }
    const amount =
      input.amount !== undefined && input.amount > 0
        ? Math.floor(input.amount)
        : DEFAULT_BUY_AMOUNT
    const cost = amount * candles.basePrice
    if (ctx.state.coin < cost) {
      return {
        ok: false,
        code: 'insufficient_coin',
        reason: `Candles cost ${cost} coin; only ${ctx.state.coin} available`,
      }
    }
    return { ok: true }
  },
  apply: (ctx, input) => {
    const candles = ctx.state.stock[CANDLE_STOCK_ID]!
    const amount =
      input.amount !== undefined && input.amount > 0
        ? Math.floor(input.amount)
        : DEFAULT_BUY_AMOUNT
    const cost = amount * candles.basePrice
    const before = candles.quantity
    restockItem(ctx, CANDLE_STOCK_ID, amount, cost, 'expansion.buy_candles')
    const after = ctx.state.stock[CANDLE_STOCK_ID]!.quantity
    return {
      actionId: CANDLE_BUY_ACTION_ID,
      label: 'Bought Candles',
      targetId: CANDLE_STOCK_ID,
      actionPointCost: buyCandles.actionPointCost,
      effects: [`candles ${before} → ${after}`, `coin -${cost}`],
      data: {
        stockId: CANDLE_STOCK_ID,
        quantity: { before, after },
        coin: { spent: cost },
      },
    }
  },
}

function registerCandleAction(): void {
  if (actionRegistry.has(CANDLE_BUY_ACTION_ID)) return
  actionRegistry.register(buyCandles)
}

// ----------------------------------------------------------------------
// 3. Issue seed generator: candle_shortage_darkness
// ----------------------------------------------------------------------

function buildCandleShortageSeed(ctx: SimContext): IssueSeed | null {
  const candles = ctx.state.stock[CANDLE_STOCK_ID]
  if (!candles) return null
  if (candles.quantity >= SEED_THRESHOLD) return null

  const merchants = ctx.state.customerGroups.merchants
  const goblins = ctx.state.customerGroups.local_goblins

  const stamp = stampFromState(ctx.state)
  // Synthesize a cause from the visible state — we do not invent truth,
  // we read it. The cause is anchored to the candle quantity.
  const cause: CauseEntry = {
    id: `expansion-candle-${stamp.absoluteDay}`,
    timestamp: stamp,
    source: 'expansion.candle_shortage',
    sourceType: 'stock',
    target: `stock:${CANDLE_STOCK_ID}.quantity`,
    targetType: 'stock',
    amount: candles.quantity,
    direction: 'decrease',
    weight: SEED_THRESHOLD - candles.quantity,
    readable: `Candle stock is down to ${candles.quantity}.`,
    tags: ['stock', 'lighting', 'candles'],
    relatedActors: [],
    relatedLocations: [{ kind: 'area', id: 'main_room' }],
    relatedSystems: ['stock', 'lighting'],
    ageDays: 0,
  }

  const responseSlots: ResponseSlot[] = [
    {
      id: 'restock_candles',
      labelHint: 'Restock candles',
      allowedVerbs: ['buy'],
      shape: 'safe_costly',
      targetOptions: [stockRef(CANDLE_STOCK_ID)],
      expectedEffects: ['raise candle quantity', 'spend coin'],
    },
    {
      id: 'embrace_darkness',
      labelHint: 'Embrace the darkness',
      allowedVerbs: ['rebrand'],
      shape: 'reputation_play',
      targetOptions: [systemRef('reputation')],
      expectedEffects: ['lean into strange reputation', 'lose merchants'],
    },
    {
      id: 'ignore_candles',
      labelHint: 'Ignore the dark',
      allowedVerbs: ['ignore'],
      shape: 'ignore',
      targetOptions: [],
      expectedEffects: ['save coin', 'risk merchants leaving'],
    },
  ]

  const consequenceProfiles: ConsequenceProfile[] = [
    makeProfile({
      id: 'restock_candles_profile',
      responseSlotId: 'restock_candles',
      immediateEffects: [
        effect('state_change', `stock.${CANDLE_STOCK_ID}.quantity`, 15, 'Candles back', ['stock']),
        effect('state_change', 'coin', -15, 'Spend coin on candles', ['coin']),
      ],
      delayedEffects: [],
      memories: [{ id: 'candles_restocked_recently', tags: ['stock', 'lighting'] }],
      futureHooks: [],
    }),
    makeProfile({
      id: 'embrace_darkness_profile',
      responseSlotId: 'embrace_darkness',
      immediateEffects: [
        effect('state_change', 'reputation.strange', 6, 'Lean strange', ['reputation']),
        effect('state_change', 'customers.merchants.satisfaction', -8, 'Merchants annoyed', ['customer']),
      ],
      delayedEffects: [],
      memories: [{ id: 'embraced_dark_tavern', tags: ['reputation', 'lighting'] }],
      futureHooks: [{ id: 'merchant_flight_possible', tags: ['merchants', 'risk'] }],
    }),
    makeProfile({
      id: 'ignore_candles_profile',
      responseSlotId: 'ignore_candles',
      immediateEffects: [
        effect('state_change', 'customers.merchants.satisfaction', -5, 'Merchants grumble', ['customer']),
      ],
      delayedEffects: [],
      memories: [{ id: 'ignored_lighting_recently', tags: ['lighting'] }],
      futureHooks: [{ id: 'main_room_too_dark', tags: ['main_room', 'lighting'] }],
    }),
  ]

  const actorOpinions: Record<string, string> = {}
  if (merchants) actorOpinions['merchants'] = 'cannot see their coin'
  if (goblins) actorOpinions['goblins'] = 'love the dark'

  const seed: IssueSeed = {
    id: `${CANDLE_SEED_GENERATOR_ID}--day${stamp.absoluteDay}`,
    family: CANDLE_SEED_FAMILY,
    type: 'warning',
    domain: ['stock', 'lighting', 'customers'],
    timing: 'morning_prep',
    severity: 50,
    urgency: 55,
    novelty: 100,
    cardWorthiness: 55,
    location: { kind: 'area', id: 'main_room' },
    affectedActors: merchants ? [customerRef(merchants.id)] : [],
    causes: [cause],
    pressures: [],
    stakes: [
      stake(
        'candle_shortage_stake',
        `stock:${CANDLE_STOCK_ID}.quantity`,
        'main room going dark',
        'loss',
        ['lighting'],
      ),
    ],
    responseSlots,
    consequenceProfiles,
    memoriesCreated: [
      { id: 'candle_shortage_warning_seen', tags: ['lighting', 'warning'] },
    ],
    futureHooks: [
      { id: 'main_room_too_dark', tags: ['main_room', 'lighting'] },
    ],
    toneHints: ['dim', 'merchants_annoyed'],
    textIngredients: buildTextIngredients({
      subject: 'the candles',
      problemNoun: 'dim main room',
      sensoryDetails: ['smoky shadows'],
      actorOpinions,
      recentContext: ['candles run low'],
      stakesReadable: ['merchants may leave'],
    }),
    validation: { valid: true, errors: [], warnings: [], contractChecks: {} },
    generatedAt: stamp,
  }
  seed.validation = validateSeed(seed, { strictTextBudget: false })
  return seed
}

function registerCandleSeedGenerator(): void {
  ensureRequiredSeedGeneratorsRegistered(issueSeedGeneratorRegistry)
  if (issueSeedGeneratorRegistry.has(CANDLE_SEED_GENERATOR_ID)) return
  issueSeedGeneratorRegistry.register({
    id: CANDLE_SEED_GENERATOR_ID,
    family: CANDLE_SEED_FAMILY,
    domain: ['stock', 'lighting'],
    timing: ['morning_prep'],
    generate(ctx) {
      const seed = buildCandleShortageSeed(ctx)
      return seed ? [seed] : []
    },
  })
}

// ----------------------------------------------------------------------
// 4. Customer-effect + report module
// ----------------------------------------------------------------------

type CandleSliceState = {
  /** Candle quantity at last sample. */
  lastCandleQuantity: number
  /** Whether the most recent day fell below the low-light threshold. */
  lowLightTriggered: boolean
  /** Merchant satisfaction nudges applied today (debug). */
  merchantPenaltyToday: number
}

function getSlice(ctx: SimContext): CandleSliceState {
  const current = ctx.state.modules[CANDLE_EXPANSION_MODULE_ID] as
    | CandleSliceState
    | undefined
  return (
    current ?? {
      lastCandleQuantity: 0,
      lowLightTriggered: false,
      merchantPenaltyToday: 0,
    }
  )
}

function writeSlice(ctx: SimContext, next: CandleSliceState): void {
  ctx.modifyModuleState<CandleSliceState>(
    CANDLE_EXPANSION_MODULE_ID,
    () => next,
    {
      source: CANDLE_EXPANSION_MODULE_ID,
      reason: 'candle_slice_update',
    },
  )
}

function applyCustomerEffect(ctx: SimContext): void {
  const candles = ctx.state.stock[CANDLE_STOCK_ID]
  const slice: CandleSliceState = {
    lastCandleQuantity: candles?.quantity ?? 0,
    lowLightTriggered: false,
    merchantPenaltyToday: 0,
  }
  if (!candles) {
    writeSlice(ctx, slice)
    return
  }
  if (candles.quantity < LOW_LIGHT_THRESHOLD) {
    slice.lowLightTriggered = true
    // Customer effect: merchants dislike darkness (small satisfaction
    // nudge), goblins tolerate / mildly enjoy it.
    const merchants = ctx.state.customerGroups.merchants
    if (merchants) {
      const nextSatisfaction = Math.max(0, merchants.satisfaction - 2)
      slice.merchantPenaltyToday = merchants.satisfaction - nextSatisfaction
      ctx.modifyCustomerGroup(
        'merchants',
        { satisfaction: nextSatisfaction },
        {
          source: 'expansion.candle_shortage',
          sourceType: 'customer',
          target: 'customers.merchants.satisfaction',
          targetType: 'customer',
          amount: nextSatisfaction - merchants.satisfaction,
          readable: 'Merchants dislike the dim main room.',
          tags: ['lighting', 'merchants'],
        },
      )
    }
    const goblins = ctx.state.customerGroups.local_goblins
    if (goblins) {
      const nextSatisfaction = Math.min(100, goblins.satisfaction + 1)
      ctx.modifyCustomerGroup(
        'local_goblins',
        { satisfaction: nextSatisfaction },
        {
          source: 'expansion.candle_shortage',
          sourceType: 'customer',
          target: 'customers.local_goblins.satisfaction',
          targetType: 'customer',
          amount: nextSatisfaction - goblins.satisfaction,
          readable: 'Goblins enjoy the dim main room.',
          tags: ['lighting', 'goblins'],
        },
      )
    }
  }
  writeSlice(ctx, slice)
}

function buildLightingReport(ctx: SimContext): ReportSection {
  const slice = getSlice(ctx)
  const candles = ctx.state.stock[CANDLE_STOCK_ID]
  const lines: string[] = []
  lines.push(`Candle stock: ${candles?.quantity ?? 0}`)
  lines.push(slice.lowLightTriggered ? 'Low light: yes' : 'Low light: no')
  if (slice.merchantPenaltyToday > 0) {
    lines.push(`Merchant satisfaction penalty: ${slice.merchantPenaltyToday}`)
  }
  return {
    id: 'lighting_report',
    source: CANDLE_EXPANSION_MODULE_ID,
    title: 'LIGHTING REPORT',
    lines,
    data: {
      candleQuantity: candles?.quantity ?? 0,
      lowLight: slice.lowLightTriggered,
      merchantPenalty: slice.merchantPenaltyToday,
    },
  }
}

export const candleShortageExpansionModule: SimulationModule = {
  id: CANDLE_EXPANSION_MODULE_ID,
  version: '0.1.0',
  dependsOn: ['stock', 'customers'],
  hooks: {
    closing: [
      (ctx) => {
        applyCustomerEffect(ctx)
      },
    ],
  },
  buildReport: buildLightingReport,
}

// ----------------------------------------------------------------------
// 5. Installer
// ----------------------------------------------------------------------

let installed = false

export function installCandleShortageExpansion(): SimulationModule {
  registerCandleStock()
  registerCandleAction()
  registerCandleSeedGenerator()
  installed = true
  return candleShortageExpansionModule
}

export function isCandleShortageExpansionInstalled(): boolean {
  return installed
}

/**
 * Best-effort uninstaller used by tests that want to keep the registries
 * tidy between runs. The Registry class does not expose a `remove`, so
 * we leave the registered items in place but flip the `installed` flag.
 */
export function markCandleShortageExpansionUninstalled(): void {
  installed = false
}
