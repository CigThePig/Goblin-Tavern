import { actionRegistry } from '../../registries/actionRegistry'
import { clampPercent } from '../../state/normalize'
import type { TavernState } from '../../state/TavernState'
import {
  SPOT_MARKET_PREMIUM,
  quoteAlternativeSuppliers,
  spotMarketAvailable,
  spotMarketUnitPrice,
} from '../suppliers/quote'
import { makeReadOnlyCtx } from './readonlyHelpers'
import type { OwnerActionInput } from './types'

export type OwnerActionQuoteStockChange = {
  stockId: string
  label: string
  before?: number
  after?: number
  delta: number
}

export type OwnerActionQuoteStatChange = {
  entityType:
    | 'staff'
    | 'area'
    | 'faction'
    | 'supplier'
    | 'dish'
    | 'customerGroup'
    | 'tavern'
    | 'stock'
  entityId: string
  label: string
  stat: string
  before: number
  after: number
  delta: number
}

export type OwnerActionQuote = {
  actionId: string
  targetId?: string
  amount?: number
  title?: string
  summary?: string
  cost?: { coin?: number }
  stockChanges?: OwnerActionQuoteStockChange[]
  statChanges?: OwnerActionQuoteStatChange[]
  risks?: string[]
  warnings?: string[]
  supplier?: {
    supplierId: string
    name: string
    reliability?: number
    relationship?: number
    unitPrice?: number
    totalCost?: number
  }
  canAfford?: boolean
}

const DEFAULT_RESTOCK_AMOUNT = 40
const DEFAULT_BONUS = 10
const DEFAULT_MUG_BUY = 10
const IMPROVE_STEW_INGREDIENTS = 5
const FUMIGATE_COST = 5

function positiveFloor(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : fallback
}

function roundedDelta(value: number | undefined): number | undefined {
  if (value === undefined || !Number.isFinite(value)) return undefined
  return Math.round(value)
}

function coinCanAfford(state: TavernState, cost: number): boolean {
  return state.coin >= cost
}

function addWarningForValidation(
  state: TavernState,
  input: OwnerActionInput,
  quote: OwnerActionQuote,
): OwnerActionQuote {
  if (!actionRegistry.has(input.actionId)) {
    return {
      ...quote,
      warnings: [...(quote.warnings ?? []), `Unknown action '${input.actionId}'`],
    }
  }
  const validation = actionRegistry.get(input.actionId).canApply(
    makeReadOnlyCtx(state),
    input,
  )
  if (!validation.ok) {
    return {
      ...quote,
      warnings: [...(quote.warnings ?? []), validation.reason],
    }
  }
  return quote
}

function stockChange(
  stockId: string,
  label: string,
  before: number,
  after: number,
): OwnerActionQuoteStockChange {
  return { stockId, label, before, after, delta: after - before }
}

function statChange(
  entityType: OwnerActionQuoteStatChange['entityType'],
  entityId: string,
  label: string,
  stat: string,
  before: number,
  after: number,
): OwnerActionQuoteStatChange {
  return { entityType, entityId, label, stat, before, after, delta: after - before }
}

export function quoteOwnerAction(
  state: TavernState,
  input: OwnerActionInput,
): OwnerActionQuote {
  const base: OwnerActionQuote = {
    actionId: input.actionId,
    ...(input.targetId !== undefined ? { targetId: input.targetId } : {}),
    ...(input.amount !== undefined ? { amount: input.amount } : {}),
  }

  let quote: OwnerActionQuote
  switch (input.actionId) {
    case 'restock_item': {
      // Expansion Phase 6 §6.1 — `restock_item` is the LOCAL SPOT MARKET.
      // The quote therefore prices the market, not a supplier: a premium
      // over the cheapest supplier price, and only what the market can
      // still supply today. The alternative — a planned supplier order —
      // is named as a risk line so the player can see the trade rather
      // than having to infer it.
      const stockId = input.targetId
      const item = stockId ? state.stock[stockId] : undefined
      if (!stockId || !item) {
        quote = {
          ...base,
          title: 'Buy at Local Market',
          warnings: ['Choose a stock item.'],
        }
        break
      }
      const requested = positiveFloor(input.amount, DEFAULT_RESTOCK_AMOUNT)
      const available = spotMarketAvailable(state, stockId)
      const amount = Math.min(requested, available)
      const unitPrice = spotMarketUnitPrice(state, stockId)
      const totalCost = Math.ceil(amount * unitPrice)
      const before = item.quantity
      const after = before + amount
      const cheapestOrder = quoteAlternativeSuppliers(state, {
        stockId,
        quantity: requested,
      })[0]
      quote = {
        ...base,
        amount,
        title: `Buy ${item.label} at market`,
        summary: `${item.label} +${amount} · Coin -${totalCost} · Market ${unitPrice}/unit`,
        cost: { coin: totalCost },
        stockChanges: [stockChange(item.id, item.label, before, after)],
        risks: [
          `Market premium: ${Math.round((SPOT_MARKET_PREMIUM - 1) * 100)}% over a supplier's price`,
          ...(cheapestOrder
            ? [
                `${cheapestOrder.supplierLabel} would sell at ${cheapestOrder.unitPrice}/unit for day ${cheapestOrder.deliveryDay}`,
              ]
            : []),
        ],
        ...(amount < requested
          ? {
              warnings: [
                `The market can only supply ${amount} of ${requested} today.`,
              ],
            }
          : {}),
        canAfford: coinCanAfford(state, totalCost),
      }
      break
    }
    case 'pay_staff_bonus': {
      const staffId = input.targetId
      const staff = staffId ? state.staff[staffId] : undefined
      if (!staffId || !staff) {
        quote = { ...base, title: 'Pay Staff Bonus', warnings: ['Choose a staff member.'] }
        break
      }
      const amount = positiveFloor(input.amount, DEFAULT_BONUS)
      const scale = amount / DEFAULT_BONUS
      const moraleLift = Math.max(2, Math.round(5 * scale))
      const stressDrop = Math.max(2, Math.round(3 * scale))
      const loyaltyLift = Math.max(1, Math.round(3 * scale))
      const nextMorale = clampPercent(staff.morale + moraleLift)
      const nextStress = clampPercent(staff.stress - stressDrop)
      const nextLoyalty = clampPercent(staff.loyalty + loyaltyLift)
      quote = {
        ...base,
        amount,
        title: `Pay Bonus: ${staff.name.display}`,
        summary: `Coin -${amount} · Morale ${staff.morale}→${nextMorale} · Stress ${staff.stress}→${nextStress} · Loyalty ${staff.loyalty}→${nextLoyalty}`,
        cost: { coin: amount },
        statChanges: [
          statChange('staff', staff.id, staff.name.display, 'morale', staff.morale, nextMorale),
          statChange('staff', staff.id, staff.name.display, 'stress', staff.stress, nextStress),
          statChange('staff', staff.id, staff.name.display, 'loyalty', staff.loyalty, nextLoyalty),
        ],
        canAfford: coinCanAfford(state, amount),
      }
      break
    }
    case 'improve_stew': {
      const stew = state.stock['stew']
      const ingredients = state.stock['ingredients']
      const cook = state.staff['cook']
      if (!stew || !ingredients) {
        quote = { ...base, title: 'Improve Stew', warnings: ['Stew and ingredients are required.'] }
        break
      }
      const nextQuality = clampPercent(stew.quality + 10)
      const nextIngredients = ingredients.quantity - IMPROVE_STEW_INGREDIENTS
      quote = {
        ...base,
        targetId: stew.id,
        title: 'Improve Stew',
        summary: `Ingredients -${IMPROVE_STEW_INGREDIENTS} · Stew quality ${stew.quality}→${nextQuality}${cook ? ' · Cook stress +2 · Cook fatigue +2' : ''}`,
        stockChanges: [stockChange(ingredients.id, ingredients.label, ingredients.quantity, nextIngredients)],
        statChanges: [
          statChange('stock', stew.id, stew.label, 'quality', stew.quality, nextQuality),
          ...(cook
            ? [
                statChange('staff', cook.id, cook.name.display, 'stress', cook.stress, clampPercent(cook.stress + 2)),
                statChange('staff', cook.id, cook.name.display, 'fatigue', cook.fatigue, clampPercent(cook.fatigue + 2)),
              ]
            : []),
        ],
        ...(nextIngredients < 0 ? { warnings: ['Not enough ingredients.'] } : {}),
      }
      break
    }
    case 'water_down_ale': {
      const ale = state.stock['ale']
      if (!ale) {
        quote = { ...base, title: 'Water Down Ale', warnings: ['Tavern has no ale stock.'] }
        break
      }
      const stretch = Math.max(4, Math.round(ale.quantity * 0.2))
      const nextQuantity = ale.quantity + stretch
      const nextQuality = clampPercent(ale.quality - 15)
      quote = {
        ...base,
        targetId: ale.id,
        amount: stretch,
        title: 'Water Down Ale',
        summary: `${ale.label} ${ale.quantity}→${nextQuantity} · Ale quality ${ale.quality}→${nextQuality} · Reputation risk`,
        stockChanges: [stockChange(ale.id, ale.label, ale.quantity, nextQuantity)],
        statChanges: [statChange('stock', ale.id, ale.label, 'quality', ale.quality, nextQuality)],
        risks: ['Reputation and satisfaction risk if patrons notice watered ale.'],
        ...(ale.quantity <= 0 ? { warnings: ['Ale is empty; nothing to water down.'] } : {}),
      }
      break
    }
    case 'fumigate_cellar': {
      const cellar = state.areas['cellar']
      if (!cellar) {
        quote = { ...base, title: 'Fumigate Cellar', warnings: ['Tavern has no cellar.'] }
        break
      }
      const nextRisk = clampPercent(cellar.risk - 20)
      const nextSmell = clampPercent(cellar.smell + 10)
      const nextCleanliness = clampPercent(cellar.cleanliness + 5)
      quote = {
        ...base,
        targetId: cellar.id,
        title: 'Fumigate Cellar',
        summary: `Coin -${FUMIGATE_COST} · Cellar pest risk ${cellar.risk}→${nextRisk} · Smell ${cellar.smell}→${nextSmell} · Cleanliness ${cellar.cleanliness}→${nextCleanliness}`,
        cost: { coin: FUMIGATE_COST },
        statChanges: [
          statChange('area', cellar.id, cellar.label, 'risk', cellar.risk, nextRisk),
          statChange('area', cellar.id, cellar.label, 'smell', cellar.smell, nextSmell),
          statChange('area', cellar.id, cellar.label, 'cleanliness', cellar.cleanliness, nextCleanliness),
        ],
        risks: ['Hidden tradeoff: chemical smell rises today.'],
        canAfford: coinCanAfford(state, FUMIGATE_COST),
      }
      break
    }
    case 'buy_mugs': {
      const mugs = state.stock['mugs']
      if (!mugs) {
        quote = { ...base, title: 'Buy Mugs', warnings: ['Tavern has no mugs stock.'] }
        break
      }
      const amount = positiveFloor(input.amount, DEFAULT_MUG_BUY)
      const cost = amount * mugs.basePrice
      quote = {
        ...base,
        targetId: mugs.id,
        amount,
        title: 'Buy Mugs',
        summary: `${mugs.label} +${amount} · Coin -${cost}`,
        cost: { coin: cost },
        stockChanges: [stockChange(mugs.id, mugs.label, mugs.quantity, mugs.quantity + amount)],
        canAfford: coinCanAfford(state, cost),
      }
      break
    }
    case 'adjust_prices': {
      const item = input.targetId ? state.stock[input.targetId] : undefined
      const delta = roundedDelta(input.amount)
      if (!item || delta === undefined) {
        quote = { ...base, title: 'Adjust Prices', warnings: ['Choose stock and a non-zero price delta.'] }
        break
      }
      const after = Math.max(1, item.salePrice + delta)
      quote = {
        ...base,
        amount: delta,
        title: `Adjust ${item.label} Price`,
        summary: `${item.label} price ${item.salePrice}→${after} · Demand risk shifts with price`,
        statChanges: [statChange('stock', item.id, item.label, 'salePrice', item.salePrice, after)],
        risks: delta > 0 ? ['Higher prices may reduce satisfaction for price-sensitive customers.'] : ['Lower prices reduce coin per sale.'],
      }
      break
    }
    case 'comfort_stressed_staff': {
      const staff = input.targetId ? state.staff[input.targetId] : undefined
      if (!staff) {
        quote = { ...base, title: 'Comfort Stressed Staff', warnings: ['Choose a staff member.'] }
        break
      }
      quote = {
        ...base,
        title: `Comfort ${staff.name.display}`,
        summary: `Stress ${staff.stress}→${clampPercent(staff.stress - 8)} · Morale ${staff.morale}→${clampPercent(staff.morale + 4)} · Loyalty ${staff.loyalty}→${clampPercent(staff.loyalty + 1)}`,
        statChanges: [
          statChange('staff', staff.id, staff.name.display, 'stress', staff.stress, clampPercent(staff.stress - 8)),
          statChange('staff', staff.id, staff.name.display, 'morale', staff.morale, clampPercent(staff.morale + 4)),
          statChange('staff', staff.id, staff.name.display, 'loyalty', staff.loyalty, clampPercent(staff.loyalty + 1)),
        ],
      }
      break
    }
    case 'negotiate_with_supplier': {
      const supplier = input.targetId ? state.world.suppliers[input.targetId] : undefined
      if (!supplier) {
        quote = { ...base, title: 'Negotiate with Supplier', warnings: ['Choose a supplier.'] }
        break
      }
      quote = {
        ...base,
        title: `Negotiate with ${supplier.label}`,
        summary: `Relationship ${supplier.relationship}→${clampPercent(supplier.relationship + 5)} · Reliability ${supplier.reliability}→${clampPercent(supplier.reliability + 1)}`,
        supplier: {
          supplierId: supplier.id,
          name: supplier.label,
          reliability: supplier.reliability,
          relationship: supplier.relationship,
        },
        statChanges: [
          statChange('supplier', supplier.id, supplier.label, 'relationship', supplier.relationship, clampPercent(supplier.relationship + 5)),
          statChange('supplier', supplier.id, supplier.label, 'reliability', supplier.reliability, clampPercent(supplier.reliability + 1)),
        ],
      }
      break
    }
    case 'host_faction_night': {
      const faction = input.targetId ? state.world.factions[input.targetId] : undefined
      if (!faction) {
        quote = { ...base, title: 'Host Faction Night', warnings: ['Choose a faction.'] }
        break
      }
      quote = {
        ...base,
        title: `Host ${faction.label} Night`,
        summary: `Relationship ${faction.relationship}→${clampPercent(faction.relationship + 6)} · Trust ${faction.trust}→${clampPercent(faction.trust + 2)}`,
        statChanges: [
          statChange('faction', faction.id, faction.label, 'relationship', faction.relationship, clampPercent(faction.relationship + 6)),
          statChange('faction', faction.id, faction.label, 'trust', faction.trust, clampPercent(faction.trust + 2)),
        ],
        risks: ['Rival factions may read the guest list as taking sides.'],
      }
      break
    }
    case 'warn_rowdy_group': {
      const group = input.targetId ? state.customerGroups[input.targetId] : undefined
      if (!group) {
        quote = { ...base, title: 'Warn Rowdy Group', warnings: ['Choose a customer group.'] }
        break
      }
      quote = {
        ...base,
        title: `Warn ${group.label}`,
        summary: `Rowdiness ${group.rowdiness}→${clampPercent(group.rowdiness - 6)} · Satisfaction ${group.satisfaction}→${clampPercent(group.satisfaction - 3)}`,
        statChanges: [
          statChange('customerGroup', group.id, group.label, 'rowdiness', group.rowdiness, clampPercent(group.rowdiness - 6)),
          statChange('customerGroup', group.id, group.label, 'satisfaction', group.satisfaction, clampPercent(group.satisfaction - 3)),
        ],
        risks: ['Hidden tradeoff: satisfaction drops while rowdiness improves.'],
      }
      break
    }
    default: {
      quote = {
        ...base,
        title: actionRegistry.has(input.actionId)
          ? actionRegistry.get(input.actionId).label
          : input.actionId,
      }
    }
  }

  const withValidation = addWarningForValidation(state, input, quote)
  if (withValidation.canAfford === false) {
    return {
      ...withValidation,
      warnings: [
        ...(withValidation.warnings ?? []),
        `Insufficient coin: need ${withValidation.cost?.coin}, have ${state.coin}.`,
      ],
    }
  }
  return withValidation
}
