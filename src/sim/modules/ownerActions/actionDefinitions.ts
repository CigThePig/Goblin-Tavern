import type { SimContext } from '../../core/context'
import { clampPercent } from '../../state/normalize'
import { areaRegistry } from '../../registries/areaRegistry'
import { staffRegistry } from '../../registries/staffRegistry'
import { stockRegistry } from '../../registries/stockRegistry'
import { restockItem } from '../stock/sales'
import { spendCoin } from '../stock/ledger'

import type {
  ActionTarget,
  ActionValidationResult,
  OwnerActionApplied,
  OwnerActionDefinition,
  OwnerActionInput,
} from './types'

// Phase 13 §13.3–13.12 — Owner action definitions.
//
// Each definition is data-driven (§13.1 — registry-shaped): an id, label,
// tags, action-point cost, target enumerator, validator, and apply
// function. `apply` routes mutations through `ctx.modify*` helpers; coin
// flows through the Phase 9 ledger (`spendCoin` / `restockItem`) so the
// daily ledger captures every coin movement caused by player intervention.

const OK: ActionValidationResult = { ok: true }

function reject(code: string, reason: string): ActionValidationResult {
  return { ok: false, code, reason }
}

function listAreas(ctx: SimContext): ActionTarget[] {
  return Object.values(ctx.state.areas).map((a) => ({
    id: a.id,
    label: a.label,
    hint: `cleanliness ${a.cleanliness}, damage ${a.damage}`,
  }))
}

function listStock(ctx: SimContext): ActionTarget[] {
  return Object.values(ctx.state.stock).map((s) => ({
    id: s.id,
    label: s.label,
    hint: `qty ${s.quantity}, quality ${s.quality}`,
  }))
}

function listStaff(ctx: SimContext): ActionTarget[] {
  return Object.values(ctx.state.staff).map((s) => ({
    id: s.id,
    label: s.name,
    hint: `morale ${s.morale}, stress ${s.stress}`,
  }))
}

// ---------- 13.3 clean_area ----------

const cleanArea: OwnerActionDefinition = {
  id: 'clean_area',
  label: 'Clean Area',
  tags: ['cleanliness', 'maintenance'],
  targetType: 'area',
  actionPointCost: 1,
  getValidTargets: listAreas,
  canApply: (ctx, input) => {
    if (!input.targetId) return reject('missing_target', 'clean_area requires targetId')
    if (!ctx.state.areas[input.targetId]) {
      return reject('unknown_target', `Unknown area '${input.targetId}'`)
    }
    return OK
  },
  apply: (ctx, input) => {
    const area = ctx.state.areas[input.targetId!]!
    // §13.3 scaling — bigger lift on filthy areas, smaller on already
    // clean ones. The formula stays modest because actions chain across
    // the same day; an aggressive lift would let players ignore decay.
    const filthRoom = 100 - area.cleanliness
    const gain = Math.max(6, Math.round(filthRoom * 0.4))
    const smellDrop = Math.max(3, Math.round(area.smell * 0.2))
    const riskDrop = Math.max(1, Math.round(area.risk * 0.1))

    const nextCleanliness = clampPercent(area.cleanliness + gain)
    const nextSmell = clampPercent(area.smell - smellDrop)
    const nextRisk = clampPercent(area.risk - riskDrop)
    const nextMess = clampPercent(area.mess - Math.max(2, Math.round(area.mess * 0.3)))

    ctx.modifyArea(
      area.id,
      {
        cleanliness: nextCleanliness,
        smell: nextSmell,
        risk: nextRisk,
        mess: nextMess,
      },
      { source: 'ownerActions.clean_area', reason: 'clean_area' },
    )

    return {
      actionId: cleanArea.id,
      label: `Cleaned ${area.label}`,
      targetId: area.id,
      actionPointCost: cleanArea.actionPointCost,
      effects: [
        `cleanliness ${area.cleanliness} → ${nextCleanliness}`,
        `smell ${area.smell} → ${nextSmell}`,
      ],
      data: {
        areaId: area.id,
        cleanliness: { before: area.cleanliness, after: nextCleanliness },
        smell: { before: area.smell, after: nextSmell },
        risk: { before: area.risk, after: nextRisk },
        mess: { before: area.mess, after: nextMess },
      },
    }
  },
}

// ---------- 13.4 repair_area ----------

function repairCost(damage: number): number {
  if (damage <= 0) return 0
  return Math.max(2, Math.ceil(damage / 5))
}

const repairArea: OwnerActionDefinition = {
  id: 'repair_area',
  label: 'Repair Area',
  tags: ['repair', 'maintenance'],
  targetType: 'area',
  actionPointCost: 1,
  getValidTargets: listAreas,
  canApply: (ctx, input) => {
    if (!input.targetId) return reject('missing_target', 'repair_area requires targetId')
    const area = ctx.state.areas[input.targetId]
    if (!area) return reject('unknown_target', `Unknown area '${input.targetId}'`)
    if (area.damage <= 0) return reject('nothing_to_repair', `${area.label} has no damage`)
    const cost = repairCost(area.damage)
    // §13.4 — recommended early behaviour: block if insufficient coin.
    if (ctx.state.coin < cost) {
      return reject(
        'insufficient_coin',
        `Repair costs ${cost} coin; only ${ctx.state.coin} available`,
      )
    }
    return OK
  },
  apply: (ctx, input) => {
    const area = ctx.state.areas[input.targetId!]!
    const cost = repairCost(area.damage)
    const repairAmount = Math.min(area.damage, Math.max(8, Math.round(area.damage * 0.6)))
    const nextDamage = clampPercent(area.damage - repairAmount)
    const conditionGain = Math.max(3, Math.round(repairAmount * 0.4))
    const nextCondition = clampPercent(area.condition + conditionGain)

    ctx.modifyArea(
      area.id,
      { damage: nextDamage, condition: nextCondition },
      { source: 'ownerActions.repair_area', reason: 'repair_area' },
    )
    spendCoin(ctx, cost, {
      source: `ownerActions.repair_area.${area.id}`,
      category: 'repair',
      tags: ['repair', area.id],
    })

    return {
      actionId: repairArea.id,
      label: `Repaired ${area.label}`,
      targetId: area.id,
      actionPointCost: repairArea.actionPointCost,
      effects: [
        `damage ${area.damage} → ${nextDamage}`,
        `condition ${area.condition} → ${nextCondition}`,
        `coin -${cost}`,
      ],
      data: {
        areaId: area.id,
        damage: { before: area.damage, after: nextDamage },
        condition: { before: area.condition, after: nextCondition },
        coin: { spent: cost },
      },
    }
  },
}

// ---------- 13.5 restock_item ----------

const DEFAULT_RESTOCK_AMOUNT = 40

const restockItemAction: OwnerActionDefinition = {
  id: 'restock_item',
  label: 'Restock Item',
  tags: ['supply', 'stock'],
  targetType: 'stock',
  actionPointCost: 1,
  getValidTargets: listStock,
  canApply: (ctx, input) => {
    if (!input.targetId) return reject('missing_target', 'restock_item requires targetId')
    const item = ctx.state.stock[input.targetId]
    if (!item) return reject('unknown_target', `Unknown stock item '${input.targetId}'`)
    const amount =
      input.amount !== undefined && input.amount > 0
        ? Math.floor(input.amount)
        : DEFAULT_RESTOCK_AMOUNT
    const cost = amount * item.basePrice
    if (ctx.state.coin < cost) {
      return reject(
        'insufficient_coin',
        `Restock costs ${cost} coin; only ${ctx.state.coin} available`,
      )
    }
    return OK
  },
  apply: (ctx, input) => {
    const item = ctx.state.stock[input.targetId!]!
    const amount =
      input.amount !== undefined && input.amount > 0
        ? Math.floor(input.amount)
        : DEFAULT_RESTOCK_AMOUNT
    const cost = amount * item.basePrice
    const before = item.quantity
    restockItem(
      ctx,
      item.id,
      amount,
      cost,
      `ownerActions.restock_item.${item.id}`,
    )
    const after = ctx.state.stock[item.id]!.quantity

    return {
      actionId: restockItemAction.id,
      label: `Restocked ${item.label}`,
      targetId: item.id,
      actionPointCost: restockItemAction.actionPointCost,
      effects: [
        `${item.label} ${before} → ${after}`,
        `coin -${cost}`,
      ],
      data: {
        stockId: item.id,
        quantity: { before, after },
        coin: { spent: cost },
      },
    }
  },
}

// ---------- 13.6 adjust_prices ----------

const adjustPrices: OwnerActionDefinition = {
  id: 'adjust_prices',
  label: 'Adjust Prices',
  tags: ['pricing', 'economy'],
  targetType: 'stock',
  actionPointCost: 1,
  getValidTargets: listStock,
  canApply: (ctx, input) => {
    if (!input.targetId) return reject('missing_target', 'adjust_prices requires targetId')
    const item = ctx.state.stock[input.targetId]
    if (!item) return reject('unknown_target', `Unknown stock item '${input.targetId}'`)
    if (input.amount === undefined || !Number.isFinite(input.amount)) {
      return reject('missing_amount', 'adjust_prices requires a numeric amount delta')
    }
    if (Math.round(input.amount) === 0) {
      return reject('zero_delta', 'adjust_prices amount must be non-zero')
    }
    return OK
  },
  apply: (ctx, input) => {
    const item = ctx.state.stock[input.targetId!]!
    const delta = Math.round(input.amount!)
    const before = item.salePrice
    // §13.6 — prices cannot go below 1.
    const after = Math.max(1, item.salePrice + delta)
    ctx.modifyStock(
      item.id,
      { salePrice: after },
      { source: 'ownerActions.adjust_prices', reason: 'adjust_prices' },
    )

    return {
      actionId: adjustPrices.id,
      label: `Adjusted ${item.label} Price`,
      targetId: item.id,
      actionPointCost: adjustPrices.actionPointCost,
      effects: [`salePrice ${before} → ${after}`],
      data: {
        stockId: item.id,
        salePrice: { before, after, requested: before + delta },
      },
    }
  },
}

// ---------- 13.7 pay_staff_bonus ----------

const DEFAULT_BONUS = 10

const payStaffBonus: OwnerActionDefinition = {
  id: 'pay_staff_bonus',
  label: 'Pay Staff Bonus',
  tags: ['staff', 'wages'],
  targetType: 'staff',
  actionPointCost: 1,
  getValidTargets: listStaff,
  canApply: (ctx, input) => {
    if (!input.targetId) return reject('missing_target', 'pay_staff_bonus requires targetId')
    const staff = ctx.state.staff[input.targetId]
    if (!staff) return reject('unknown_target', `Unknown staff '${input.targetId}'`)
    const amount =
      input.amount !== undefined && input.amount > 0
        ? Math.floor(input.amount)
        : DEFAULT_BONUS
    if (ctx.state.coin < amount) {
      return reject(
        'insufficient_coin',
        `Bonus costs ${amount} coin; only ${ctx.state.coin} available`,
      )
    }
    return OK
  },
  apply: (ctx, input) => {
    const staff = ctx.state.staff[input.targetId!]!
    const amount =
      input.amount !== undefined && input.amount > 0
        ? Math.floor(input.amount)
        : DEFAULT_BONUS

    const moraleLift = Math.max(2, Math.round(amount / 2))
    const stressDrop = Math.max(2, Math.round(amount / 3))
    const nextMorale = clampPercent(staff.morale + moraleLift)
    const nextStress = clampPercent(staff.stress - stressDrop)
    const nextLoyalty = clampPercent(staff.loyalty + 1)

    ctx.modifyStaff(
      staff.id,
      { morale: nextMorale, stress: nextStress, loyalty: nextLoyalty },
      { source: 'ownerActions.pay_staff_bonus', reason: 'pay_staff_bonus' },
    )
    spendCoin(ctx, amount, {
      source: `ownerActions.pay_staff_bonus.${staff.id}`,
      category: 'wage',
      tags: ['bonus', staff.id],
    })

    return {
      actionId: payStaffBonus.id,
      label: `Paid Bonus: ${staff.name}`,
      targetId: staff.id,
      actionPointCost: payStaffBonus.actionPointCost,
      effects: [
        `morale ${staff.morale} → ${nextMorale}`,
        `stress ${staff.stress} → ${nextStress}`,
        `coin -${amount}`,
      ],
      data: {
        staffId: staff.id,
        morale: { before: staff.morale, after: nextMorale },
        stress: { before: staff.stress, after: nextStress },
        loyalty: { before: staff.loyalty, after: nextLoyalty },
        coin: { spent: amount },
      },
    }
  },
}

// ---------- 13.8 water_down_ale ----------

const waterDownAle: OwnerActionDefinition = {
  id: 'water_down_ale',
  label: 'Water Down Ale',
  tags: ['stock', 'cheat', 'risk'],
  targetType: 'stock',
  actionPointCost: 1,
  getValidTargets: (ctx) => {
    const ale = ctx.state.stock['ale']
    return ale ? [{ id: ale.id, label: ale.label, hint: `qty ${ale.quantity}` }] : []
  },
  canApply: (ctx) => {
    const ale = ctx.state.stock['ale']
    if (!ale) return reject('no_ale', 'Tavern has no ale stock')
    if (ale.quantity <= 0) return reject('empty_stock', 'Ale is empty; nothing to water down')
    return OK
  },
  apply: (ctx) => {
    const ale = ctx.state.stock['ale']!
    const stretch = Math.max(4, Math.round(ale.quantity * 0.2))
    const nextQuantity = ale.quantity + stretch
    const nextQuality = clampPercent(ale.quality - 15)
    // §13.8 — leave a stock-quality penalty trail. We also push a
    // 'watered_down' tag onto the stock so the memory/cause systems
    // (Phases 16/17) can spot the moment without re-reading quality
    // deltas.
    const nextTags = ale.tags.includes('watered_down')
      ? ale.tags
      : [...ale.tags, 'watered_down']

    ctx.modifyStock(
      ale.id,
      { quantity: nextQuantity, quality: nextQuality, tags: nextTags },
      { source: 'ownerActions.water_down_ale', reason: 'water_down_ale' },
    )

    return {
      actionId: waterDownAle.id,
      label: 'Watered Down Ale',
      targetId: ale.id,
      actionPointCost: waterDownAle.actionPointCost,
      effects: [
        `ale quantity ${ale.quantity} → ${nextQuantity}`,
        `ale quality ${ale.quality} → ${nextQuality}`,
      ],
      data: {
        stockId: ale.id,
        quantity: { before: ale.quantity, after: nextQuantity, added: stretch },
        quality: { before: ale.quality, after: nextQuality },
        flag: 'watered_down',
      },
    }
  },
}

// ---------- 13.9 improve_stew ----------

const IMPROVE_STEW_INGREDIENTS = 5

const improveStew: OwnerActionDefinition = {
  id: 'improve_stew',
  label: 'Improve Stew',
  tags: ['stock', 'food_quality'],
  targetType: 'stock',
  actionPointCost: 1,
  getValidTargets: (ctx) => {
    const stew = ctx.state.stock['stew']
    return stew ? [{ id: stew.id, label: stew.label }] : []
  },
  canApply: (ctx) => {
    const stew = ctx.state.stock['stew']
    if (!stew) return reject('no_stew', 'Tavern has no stew')
    const ingredients = ctx.state.stock['ingredients']
    if (!ingredients) return reject('no_ingredients', 'Tavern has no ingredients')
    if (ingredients.quantity < IMPROVE_STEW_INGREDIENTS) {
      return reject(
        'insufficient_ingredients',
        `improve_stew needs ${IMPROVE_STEW_INGREDIENTS} ingredients; have ${ingredients.quantity}`,
      )
    }
    return OK
  },
  apply: (ctx) => {
    const stew = ctx.state.stock['stew']!
    const ingredients = ctx.state.stock['ingredients']!
    const beforeStewQuality = stew.quality
    const beforeIngredients = ingredients.quantity

    const nextStewQuality = clampPercent(stew.quality + 10)
    const nextIngredients = ingredients.quantity - IMPROVE_STEW_INGREDIENTS

    ctx.modifyStock(
      stew.id,
      { quality: nextStewQuality },
      { source: 'ownerActions.improve_stew', reason: 'improve_stew' },
    )
    ctx.modifyStock(
      ingredients.id,
      { quantity: nextIngredients },
      { source: 'ownerActions.improve_stew', reason: 'improve_stew' },
    )

    const cook = ctx.state.staff['cook']
    let cookEffects: { stress?: { before: number; after: number }; fatigue?: { before: number; after: number } } = {}
    if (cook) {
      const nextStress = clampPercent(cook.stress + 2)
      const nextFatigue = clampPercent(cook.fatigue + 2)
      ctx.modifyStaff(
        cook.id,
        { stress: nextStress, fatigue: nextFatigue },
        { source: 'ownerActions.improve_stew', reason: 'improve_stew' },
      )
      cookEffects = {
        stress: { before: cook.stress, after: nextStress },
        fatigue: { before: cook.fatigue, after: nextFatigue },
      }
    }

    return {
      actionId: improveStew.id,
      label: 'Improved Stew',
      targetId: stew.id,
      actionPointCost: improveStew.actionPointCost,
      effects: [
        `stew quality ${beforeStewQuality} → ${nextStewQuality}`,
        `ingredients ${beforeIngredients} → ${nextIngredients}`,
      ],
      data: {
        stockId: stew.id,
        stewQuality: { before: beforeStewQuality, after: nextStewQuality },
        ingredients: { before: beforeIngredients, after: nextIngredients },
        cook: cookEffects,
      },
    }
  },
}

// ---------- 13.10 patch_roof ----------

function patchRoofCost(damage: number): number {
  if (damage <= 0) return 0
  return Math.max(3, Math.ceil(damage / 4))
}

const patchRoof: OwnerActionDefinition = {
  id: 'patch_roof',
  label: 'Patch Roof',
  tags: ['repair', 'roof', 'weather'],
  targetType: 'area',
  actionPointCost: 1,
  getValidTargets: (ctx) => {
    const roof = ctx.state.areas['roof']
    return roof
      ? [{ id: roof.id, label: roof.label, hint: `damage ${roof.damage}` }]
      : []
  },
  canApply: (ctx) => {
    const roof = ctx.state.areas['roof']
    if (!roof) return reject('no_roof', 'Tavern has no roof area')
    if (roof.damage <= 0 && roof.condition >= 95) {
      return reject('nothing_to_patch', 'Roof is in good shape')
    }
    const cost = patchRoofCost(roof.damage)
    if (ctx.state.coin < cost) {
      return reject(
        'insufficient_coin',
        `Patching roof costs ${cost} coin; only ${ctx.state.coin} available`,
      )
    }
    return OK
  },
  apply: (ctx) => {
    const roof = ctx.state.areas['roof']!
    const cost = patchRoofCost(roof.damage)
    const damageDrop = Math.min(roof.damage, Math.max(10, Math.round(roof.damage * 0.6)))
    const nextDamage = clampPercent(roof.damage - damageDrop)
    const nextCondition = clampPercent(roof.condition + 10)
    const nextRisk = clampPercent(roof.risk - 5)

    ctx.modifyArea(
      roof.id,
      { damage: nextDamage, condition: nextCondition, risk: nextRisk },
      { source: 'ownerActions.patch_roof', reason: 'patch_roof' },
    )
    if (cost > 0) {
      spendCoin(ctx, cost, {
        source: 'ownerActions.patch_roof',
        category: 'repair',
        tags: ['repair', 'roof'],
      })
    }

    return {
      actionId: patchRoof.id,
      label: 'Patched Roof',
      targetId: roof.id,
      actionPointCost: patchRoof.actionPointCost,
      effects: [
        `roof damage ${roof.damage} → ${nextDamage}`,
        `roof condition ${roof.condition} → ${nextCondition}`,
        `coin -${cost}`,
      ],
      data: {
        areaId: roof.id,
        damage: { before: roof.damage, after: nextDamage },
        condition: { before: roof.condition, after: nextCondition },
        risk: { before: roof.risk, after: nextRisk },
        coin: { spent: cost },
      },
    }
  },
}

// ---------- 13.11 fumigate_cellar ----------

const FUMIGATE_COST = 5

const fumigateCellar: OwnerActionDefinition = {
  id: 'fumigate_cellar',
  label: 'Fumigate Cellar',
  tags: ['cellar', 'pests', 'sanitation'],
  targetType: 'area',
  actionPointCost: 1,
  getValidTargets: (ctx) => {
    const cellar = ctx.state.areas['cellar']
    return cellar
      ? [{ id: cellar.id, label: cellar.label, hint: `risk ${cellar.risk}` }]
      : []
  },
  canApply: (ctx) => {
    const cellar = ctx.state.areas['cellar']
    if (!cellar) return reject('no_cellar', 'Tavern has no cellar')
    if (ctx.state.coin < FUMIGATE_COST) {
      return reject(
        'insufficient_coin',
        `Fumigating costs ${FUMIGATE_COST} coin; only ${ctx.state.coin} available`,
      )
    }
    return OK
  },
  apply: (ctx) => {
    const cellar = ctx.state.areas['cellar']!
    const nextRisk = clampPercent(cellar.risk - 20)
    const nextSmell = clampPercent(cellar.smell + 10)
    const nextCleanliness = clampPercent(cellar.cleanliness + 5)

    ctx.modifyArea(
      cellar.id,
      { risk: nextRisk, smell: nextSmell, cleanliness: nextCleanliness },
      { source: 'ownerActions.fumigate_cellar', reason: 'fumigate_cellar' },
    )
    spendCoin(ctx, FUMIGATE_COST, {
      source: 'ownerActions.fumigate_cellar',
      category: 'repair',
      tags: ['fumigate', 'cellar'],
    })

    return {
      actionId: fumigateCellar.id,
      label: 'Fumigated Cellar',
      targetId: cellar.id,
      actionPointCost: fumigateCellar.actionPointCost,
      effects: [
        `cellar risk ${cellar.risk} → ${nextRisk}`,
        `cellar smell ${cellar.smell} → ${nextSmell}`,
        `coin -${FUMIGATE_COST}`,
      ],
      data: {
        areaId: cellar.id,
        risk: { before: cellar.risk, after: nextRisk },
        smell: { before: cellar.smell, after: nextSmell },
        cleanliness: { before: cellar.cleanliness, after: nextCleanliness },
        coin: { spent: FUMIGATE_COST },
      },
    }
  },
}

// ---------- 13.12 buy_mugs ----------

const DEFAULT_MUG_BUY = 10

const buyMugs: OwnerActionDefinition = {
  id: 'buy_mugs',
  label: 'Buy Mugs',
  tags: ['stock', 'supply', 'service_capacity'],
  targetType: 'stock',
  actionPointCost: 1,
  getValidTargets: (ctx) => {
    const mugs = ctx.state.stock['mugs']
    return mugs ? [{ id: mugs.id, label: mugs.label, hint: `qty ${mugs.quantity}` }] : []
  },
  canApply: (ctx, input) => {
    const mugs = ctx.state.stock['mugs']
    if (!mugs) return reject('no_mugs', 'Tavern has no mugs stock')
    const amount =
      input.amount !== undefined && input.amount > 0
        ? Math.floor(input.amount)
        : DEFAULT_MUG_BUY
    const cost = amount * mugs.basePrice
    if (ctx.state.coin < cost) {
      return reject(
        'insufficient_coin',
        `Mugs cost ${cost} coin; only ${ctx.state.coin} available`,
      )
    }
    return OK
  },
  apply: (ctx, input) => {
    const mugs = ctx.state.stock['mugs']!
    const amount =
      input.amount !== undefined && input.amount > 0
        ? Math.floor(input.amount)
        : DEFAULT_MUG_BUY
    const cost = amount * mugs.basePrice
    const before = mugs.quantity
    restockItem(ctx, mugs.id, amount, cost, 'ownerActions.buy_mugs')
    const after = ctx.state.stock['mugs']!.quantity

    return {
      actionId: buyMugs.id,
      label: 'Bought Mugs',
      targetId: mugs.id,
      actionPointCost: buyMugs.actionPointCost,
      effects: [`mugs ${before} → ${after}`, `coin -${cost}`],
      data: {
        stockId: mugs.id,
        quantity: { before, after },
        coin: { spent: cost },
      },
    }
  },
}

// ---------- Required action set ----------

export const REQUIRED_OWNER_ACTIONS: OwnerActionDefinition[] = [
  cleanArea,
  repairArea,
  restockItemAction,
  adjustPrices,
  payStaffBonus,
  waterDownAle,
  improveStew,
  patchRoof,
  fumigateCellar,
  buyMugs,
]

// Re-export the individual definitions in case callers want to register
// a subset or reference one by import. Phase 13 keeps the canonical list
// in `REQUIRED_OWNER_ACTIONS`; the action registry seeds itself from it.
export {
  cleanArea,
  repairArea,
  restockItemAction,
  adjustPrices,
  payStaffBonus,
  waterDownAle,
  improveStew,
  patchRoof,
  fumigateCellar,
  buyMugs,
}

// Defensive helper used by the report builder: pull a fallback label
// from the relevant registry when an applied action does not carry one.
export function describeTargetLabel(
  targetType: OwnerActionDefinition['targetType'],
  targetId: string | undefined,
): string {
  if (!targetId) return ''
  switch (targetType) {
    case 'area':
      return areaRegistry.has(targetId) ? areaRegistry.get(targetId).label : targetId
    case 'stock':
      return stockRegistry.has(targetId) ? stockRegistry.get(targetId).label : targetId
    case 'staff':
      return staffRegistry.has(targetId) ? staffRegistry.get(targetId).label : targetId
    default:
      return targetId
  }
}
