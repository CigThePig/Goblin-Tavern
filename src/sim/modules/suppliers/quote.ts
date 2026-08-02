import { marketConditionRegistry } from '../../content/suppliers/marketConditionRegistry'
import { supplierRegistry } from '../../content/suppliers/supplierRegistry'
import { stockRegistry } from '../../registries/stockRegistry'
import { attributionsHeldBy } from '../attribution/attributionQueries'
import { getEconomyModuleState } from '../economy/state'
import { getRule } from '../../contracts/ruleset/index'
import { totalOutstanding } from '../../contracts/obligations/index'
import type { StockState, SupplierWorldState, TavernState } from '../../state/TavernState'

import { getEffectiveBasePrice, MIN_UNIT_PRICE } from './pricing'
import {
  committedUnitsForSupplier,
  getSupplierAccount,
  getSupplierModuleState,
} from './state'
import { outstandingSupplierInvoices } from './invoices'
import type {
  SupplierAccountState,
  SupplierPaymentTerms,
} from './types'

// Expansion Phase 6 §6.2 — supplier decisions.
//
// The plan lists eleven things a quote must weigh, and the point of putting
// them in ONE pure function is that the player-facing preview, the
// validator, the applied action and the report cannot disagree about any of
// them. `quoteSupplierOrder` is the single answer to "what would this
// supplier actually do?" — it is side-effect free, draws no RNG, and reads
// only state, so it is safe to call from `readonlyHelpers`' shim.
//
// The eleven factors, and where each one lands:
//
//   provided goods        → a refusal (`does_not_stock`), or a substitution
//   market conditions     → unit price and available capacity
//   relationship          → unit price, capacity, net terms, credit limit
//   reliability           → the miss chance quoted on the order
//   capacity              → how many units can be promised at all
//   existing commitments  → subtracted from that capacity
//   credit history        → whether `net` terms are offered, and the limit
//   faction/culture ties  → a small discount when the faction is warm
//   beliefs / attribution → resentment the supplier holds raises the price
//   urgency (rush)        → shorter lead time, surcharge, less capacity
//   contract terms        → a negotiated `termsAdjustment` on the account
//
// Nothing here is a meter nudge: every factor moves a number the order
// snapshot then holds the supplier to.

/** Baseline units a supplier will commit in one order, by delivery pattern. */
const PATTERN_CAPACITY: Record<string, number> = {
  weekly_local: 30,
  weekly_supplier_day: 45,
  biweekly_caravan: 70,
}
const DEFAULT_CAPACITY = 40

/** Days from placement to the promised delivery day, by delivery pattern. */
const PATTERN_LEAD_DAYS: Record<string, number> = {
  weekly_local: 1,
  weekly_supplier_day: 2,
  biweekly_caravan: 3,
}
const DEFAULT_LEAD_DAYS = 2

/** Extra days after the promised day the supplier may still turn up in. */
export const DELIVERY_WINDOW_DAYS = 2

export const RUSH_SURCHARGE = 1.35
export const RUSH_CAPACITY_FACTOR = 0.6

/** Bulk breaks. Stockpiling is cheaper per unit — and spoils. */
const BULK_BREAKS: ReadonlyArray<{ atLeast: number; multiplier: number }> = [
  { atLeast: 100, multiplier: 0.9 },
  { atLeast: 60, multiplier: 0.95 },
]

/**
 * The local spot market: distinct cost, distinct availability.
 *
 * §6.1 allows an immediate purchase to remain "for emergency channels, but
 * with distinct cost and availability", and the distinction is drawn on all
 * three axes a player can feel:
 *
 *   COST         a 30% premium over what a supplier would have quoted.
 *   RANGE        common goods only. Nobody sells bog truffle off a barrow;
 *                anything above `common` rarity has to be ordered.
 *   VOLUME       a day's worth of one good, not a cellar's worth. A
 *                stockpile is a plan, not a purchase.
 *   QUALITY      middling and anonymous (`SPOT_MARKET_QUALITY`), where a
 *                premium supplier's goods lift the cellar and a suspicious
 *                one's drag it down.
 *
 * The emergency channel stays a real rescue — an empty cellar can be
 * refilled today — it is simply the expensive, mediocre way to do it.
 */
export const SPOT_MARKET_PREMIUM = 1.3
export const SPOT_MARKET_DAILY_UNITS = 120
export const SPOT_MARKET_QUALITY = 55

export type QuoteRefusalCode =
  | 'unknown_supplier'
  | 'unknown_stock'
  | 'does_not_stock'
  | 'no_capacity'
  | 'refusing_orders'
  | 'credit_unavailable'
  | 'credit_limit_reached'
  | 'invalid_quantity'

export type SupplierQuote = {
  supplierId: string
  supplierLabel: string
  stockId: string
  stockLabel: string
  /** Units requested. */
  requested: number
  /** Units the supplier will actually commit to — may be fewer. */
  quantity: number
  unitPrice: number
  totalPrice: number
  /** Quality of the goods as promised, 0–100. */
  quality: number
  leadTimeDays: number
  /** Absolute day the goods are promised for. */
  deliveryDay: number
  deliveryWindowDays: number
  /** Capacity left with this supplier for this good, before this order. */
  capacityAvailable: number
  paymentTerms: SupplierPaymentTerms
  /** Coin required at placement. */
  dueAtPlacement: number
  /** Coin invoiced on delivery. */
  invoicedOnDelivery: number
  netTermDays: number
  creditStatus: SupplierAccountState['creditStatus']
  creditLimit: number
  creditAvailable: number
  /** Probability the supplier fails to deliver what was promised. */
  missChance: number
  /**
   * What that probability actually does when it lands.
   *
   * An order the player let the supplier substitute on never arrives short
   * or empty — the sanctioned fallback is lower-grade stock — so quoting it
   * as "chance of a short or missed delivery" advertised a consequence the
   * order could not produce. The number is the same roll either way; this
   * says which outcome it buys.
   */
  riskKind: 'short_or_missed' | 'lower_grade'
  substitutionsAllowed: boolean
  rush: boolean
  /** Whether the goods are a substitute for what was asked for. */
  substitutedFor?: string
  /** Readable "why this price" lines. Mechanical, not prose. */
  factors: string[]
  refusal?: { code: QuoteRefusalCode; reason: string }
}

export type QuoteRequest = {
  supplierId: string
  stockId: string
  quantity: number
  /** Ask for `net` terms. Falls back to cash/deposit when credit is unavailable. */
  onCredit?: boolean
  rush?: boolean
  /** Let the supplier ship a related good it does stock instead. */
  allowSubstitution?: boolean
}

function refusal(
  base: Partial<SupplierQuote>,
  code: QuoteRefusalCode,
  reason: string,
): SupplierQuote {
  return {
    supplierId: base.supplierId ?? '',
    supplierLabel: base.supplierLabel ?? base.supplierId ?? '',
    stockId: base.stockId ?? '',
    stockLabel: base.stockLabel ?? base.stockId ?? '',
    requested: base.requested ?? 0,
    quantity: 0,
    unitPrice: base.unitPrice ?? 0,
    totalPrice: 0,
    quality: base.quality ?? 0,
    leadTimeDays: base.leadTimeDays ?? 0,
    deliveryDay: base.deliveryDay ?? 0,
    deliveryWindowDays: DELIVERY_WINDOW_DAYS,
    capacityAvailable: base.capacityAvailable ?? 0,
    paymentTerms: base.paymentTerms ?? 'cash',
    dueAtPlacement: 0,
    invoicedOnDelivery: 0,
    netTermDays: base.netTermDays ?? 0,
    creditStatus: base.creditStatus ?? 'none',
    creditLimit: base.creditLimit ?? 0,
    creditAvailable: base.creditAvailable ?? 0,
    missChance: base.missChance ?? 0,
    riskKind: base.riskKind ?? 'short_or_missed',
    substitutionsAllowed: base.substitutionsAllowed ?? false,
    rush: base.rush ?? false,
    factors: base.factors ?? [],
    refusal: { code, reason },
  }
}

/** Base capacity this supplier commits per order, before commitments. */
export function supplierBaseCapacity(supplier: SupplierWorldState): number {
  const def = supplierRegistry.has(supplier.id)
    ? supplierRegistry.get(supplier.id)
    : undefined
  const pattern = def?.deliveryPattern ?? ''
  return PATTERN_CAPACITY[pattern] ?? DEFAULT_CAPACITY
}

export function supplierBaseLeadDays(supplier: SupplierWorldState): number {
  const def = supplierRegistry.has(supplier.id)
    ? supplierRegistry.get(supplier.id)
    : undefined
  const pattern = def?.deliveryPattern ?? ''
  return PATTERN_LEAD_DAYS[pattern] ?? DEFAULT_LEAD_DAYS
}

/**
 * How likely a supplier is to miss or short a REAL order.
 *
 * Distinct from `getMissedDeliveryProbability`, which Phase 84 used for a
 * daily diagnostic roll against nothing. A live order carries its own
 * pressure: a rushed order and a supplier already carrying a lot of
 * committed units are both more likely to slip, which is what gives
 * "don't over-commit one supplier" its teeth.
 */
export function orderMissChance(
  supplier: SupplierWorldState,
  input: { rush: boolean; committedUnits: number; capacity: number },
): number {
  const base = Math.max(0, Math.min(0.5, (70 - supplier.reliability) * 0.006))
  const rushPenalty = input.rush ? 0.08 : 0
  const load =
    input.capacity > 0
      ? Math.max(0, Math.min(0.15, (input.committedUnits / input.capacity) * 0.15))
      : 0
  return Math.max(0, Math.min(0.6, base + rushPenalty + load))
}

/** Multiplicative availability from every market condition touching this good. */
function availabilityMultiplier(
  state: TavernState,
  stock: StockState,
): { multiplier: number; conditionIds: string[] } {
  let multiplier = 1
  const conditionIds: string[] = []
  for (const active of getSupplierModuleState(state).activeMarketConditions) {
    if (!marketConditionRegistry.has(active.id)) continue
    const def = marketConditionRegistry.get(active.id)
    const noFilters =
      (!def.affectedStockIds || def.affectedStockIds.length === 0) &&
      (!def.affectedStockTags || def.affectedStockTags.length === 0)
    const targets =
      noFilters ||
      def.affectedStockIds?.includes(stock.id) === true ||
      def.affectedStockTags?.some((tag) => stock.tags.includes(tag)) === true
    if (!targets) continue
    if (def.availabilityMultiplier !== undefined) {
      multiplier *= def.availabilityMultiplier
      conditionIds.push(active.id)
    }
  }
  return { multiplier, conditionIds }
}

/** Additive quality shift from active market conditions. */
function conditionQualityModifier(state: TavernState, stock: StockState): number {
  let modifier = 0
  for (const active of getSupplierModuleState(state).activeMarketConditions) {
    if (!marketConditionRegistry.has(active.id)) continue
    const def = marketConditionRegistry.get(active.id)
    if (def.qualityModifier === undefined) continue
    const noFilters =
      (!def.affectedStockIds || def.affectedStockIds.length === 0) &&
      (!def.affectedStockTags || def.affectedStockTags.length === 0)
    const targets =
      noFilters ||
      def.affectedStockIds?.includes(stock.id) === true ||
      def.affectedStockTags?.some((tag) => stock.tags.includes(tag)) === true
    if (targets) modifier += def.qualityModifier
  }
  return modifier
}

/**
 * The quality this supplier's goods actually arrive at.
 *
 * §6.1 requires a quote to carry a quality, and a quoted quality that never
 * reaches the cellar would be exactly the decorative number this phase is
 * removing. `deliverOrder` blends this into the stock record.
 */
export function quotedQuality(
  state: TavernState,
  supplier: SupplierWorldState,
  stock: StockState,
): number {
  let quality = 60
  if (supplier.tags.includes('quality')) quality += 12
  if (supplier.tags.includes('premium')) quality += 10
  if (supplier.tags.includes('specialty')) quality += 8
  if (supplier.tags.includes('suspicious_quality')) quality -= 18
  if (supplier.tags.includes('cheap')) quality -= 6
  // Reliability is partly craft: a supplier who cannot keep a promise
  // usually cannot keep a standard either.
  quality += Math.round((supplier.reliability - 50) * 0.2)
  quality += conditionQualityModifier(state, stock)
  return Math.max(5, Math.min(100, Math.round(quality)))
}

/**
 * Resentment the supplier holds about the tavern, 0–1.
 *
 * Attribution is the game's existing model of "what an entity believes",
 * and §6.2 asks supplier decisions to consider beliefs. A supplier who
 * blames the tavern for something quotes worse terms — the belief has a
 * price rather than a tooltip.
 */
export function supplierGrievance(
  state: TavernState,
  supplierId: string,
): number {
  const held = attributionsHeldBy(state, { kind: 'supplier', id: supplierId })
  let worst = 0
  for (const attribution of held) {
    if (
      attribution.attributionType !== 'blame' &&
      attribution.attributionType !== 'resentment'
    ) {
      continue
    }
    const weight = (attribution.strength / 100) * (attribution.confidence / 100)
    worst = Math.max(worst, weight)
  }
  return Math.max(0, Math.min(1, worst))
}

/** Warmth of the faction behind the supplier, as a price multiplier. */
function factionTieMultiplier(
  state: TavernState,
  supplier: SupplierWorldState,
): { multiplier: number; note?: string } {
  const faction = supplier.factionId
    ? state.world.factions[supplier.factionId]
    : undefined
  if (!faction) return { multiplier: 1 }
  // ±3%: a tie is worth something, but never more than the relationship
  // the player builds with the supplier directly.
  const raw = (faction.relationship - 50) * 0.0012
  const bounded = Math.max(-0.03, Math.min(0.03, raw))
  if (bounded === 0) return { multiplier: 1 }
  return {
    multiplier: 1 - bounded,
    note:
      bounded > 0
        ? `${faction.label} ties: ${Math.round(bounded * 100)}% off`
        : `${faction.label} coolness: ${Math.abs(Math.round(bounded * 100))}% on`,
  }
}

/** The credit limit this supplier would extend, given the trading record. */
export function creditLimitFor(
  state: TavernState,
  supplier: SupplierWorldState,
  account: SupplierAccountState,
): number {
  const relationshipFactor = 0.5 + supplier.relationship / 100
  const recordFactor =
    1 +
    Math.min(0.5, account.history.onTimePayments * 0.08) -
    Math.min(0.6, account.history.latePayments * 0.1) -
    Math.min(0.8, account.history.defaults * 0.4)
  const raw = supplier.debtTolerance * 1.5 * relationshipFactor * recordFactor
  return Math.max(0, Math.round(raw))
}

/** Would this supplier open a credit line today, and why not if not? */
export function creditEligibility(
  state: TavernState,
  supplierId: string,
): { eligible: boolean; limit: number; netTermDays: number; reason: string } {
  const supplier = state.world.suppliers[supplierId]
  if (!supplier) {
    return { eligible: false, limit: 0, netTermDays: 0, reason: 'unknown supplier' }
  }
  const account = getSupplierAccount(state, supplierId)
  const today = state.calendar.totalDaysElapsed
  const limit = creditLimitFor(state, supplier, account)
  const netTermDays = netTermsFor(supplier, account)

  if (account.creditStatus === 'approved') {
    return { eligible: false, limit, netTermDays, reason: 'a credit line is already open' }
  }
  if (account.reviewOnDay !== undefined && today < account.reviewOnDay) {
    return {
      eligible: false,
      limit,
      netTermDays,
      reason: `${supplier.label} will not revisit credit before day ${account.reviewOnDay}`,
    }
  }
  if (account.history.defaults > 0 && supplier.relationship < 70) {
    return {
      eligible: false,
      limit,
      netTermDays,
      reason: `${supplier.label} remembers a default; relationship 70 would be needed to try again (currently ${supplier.relationship})`,
    }
  }
  if (supplier.relationship < 40) {
    return {
      eligible: false,
      limit,
      netTermDays,
      reason: `${supplier.label} extends credit at relationship 40 or better (currently ${supplier.relationship})`,
    }
  }
  if (account.history.ordersDelivered < 1) {
    return {
      eligible: false,
      limit,
      netTermDays,
      reason: `${supplier.label} wants at least one completed delivery before opening a line`,
    }
  }
  if (limit <= 0) {
    return {
      eligible: false,
      limit,
      netTermDays,
      reason: `${supplier.label} carries no debt for anyone`,
    }
  }
  return {
    eligible: true,
    limit,
    netTermDays,
    reason: `${supplier.label} will carry up to ${limit} coin on ${netTermDays}-day terms`,
  }
}

export function netTermsFor(
  supplier: SupplierWorldState,
  account: SupplierAccountState,
): number {
  let days = 7
  if (supplier.relationship >= 70) days += 3
  if (supplier.relationship < 40) days -= 2
  if (account.history.latePayments > account.history.onTimePayments) days -= 2
  return Math.max(3, Math.min(14, days))
}

/** Outstanding invoiced coin against one supplier. */
export function supplierOutstanding(state: TavernState, supplierId: string): number {
  return outstandingSupplierInvoices(state, supplierId).reduce(
    (sum, invoice) => sum + invoice.outstanding,
    0,
  )
}

/**
 * Coin already committed against a supplier's credit line.
 *
 * A net order reserves credit as soon as the supplier accepts it, not only
 * after the cart arrives and an invoice is raised. Otherwise several orders
 * placed on the same day can each see the whole line as available and
 * collectively promise more credit than the supplier approved. Delivered
 * units move from this reservation into an invoice, so only the undelivered
 * value of open net orders is added to live invoice balances.
 */
export function supplierCreditExposure(
  state: TavernState,
  supplierId: string,
): number {
  const reservedForOpenOrders = Object.values(
    getSupplierModuleState(state).orders,
  )
    .filter(
      (order) =>
        order.supplierId === supplierId &&
        order.paymentTerms === 'net' &&
        ['pending', 'active'].includes(order.status),
    )
    .reduce((sum, order) => {
      const reserved = order.lines.reduce((lineSum, line) => {
        const delivered = order.delivered[line.stockId] ?? 0
        const acceptedValue = Math.ceil(line.unitPrice * line.quantity)
        const deliveredValue = Math.ceil(
          line.unitPrice * Math.min(line.quantity, delivered),
        )
        return lineSum + Math.max(0, acceptedValue - deliveredValue)
      }, 0)
      return sum + reserved
    }, 0)

  return supplierOutstanding(state, supplierId) + reservedForOpenOrders
}

/**
 * The one answer to "what would this supplier do?".
 *
 * Pure. No RNG, no mutation. Callers that need a random outcome (the
 * delivery roll) draw it themselves from a named stream at the moment the
 * promise is tested, never at quote time.
 */
export function quoteSupplierOrder(
  state: TavernState,
  request: QuoteRequest,
): SupplierQuote {
  const today = state.calendar.totalDaysElapsed
  const supplier = state.world.suppliers[request.supplierId]
  if (!supplier) {
    return refusal(
      { supplierId: request.supplierId, stockId: request.stockId },
      'unknown_supplier',
      `No supplier '${request.supplierId}'`,
    )
  }
  const account = getSupplierAccount(state, supplier.id)
  const base = {
    supplierId: supplier.id,
    supplierLabel: supplier.label,
    stockId: request.stockId,
    creditStatus: account.creditStatus,
  }

  const requested = Math.floor(request.quantity)
  if (!Number.isFinite(requested) || requested <= 0) {
    return refusal(base, 'invalid_quantity', 'An order needs at least one unit.')
  }

  if (
    account.refusingUntilDay !== undefined &&
    today < account.refusingUntilDay
  ) {
    return refusal(
      base,
      'refusing_orders',
      `${supplier.label} is not taking orders until day ${account.refusingUntilDay}.`,
    )
  }

  // ---- provided goods, and the substitution rule ----
  let stockId = request.stockId
  let substitutedFor: string | undefined
  if (!supplier.goodsProvided.includes(stockId)) {
    const alternative = request.allowSubstitution
      ? findSubstitute(state, supplier, stockId)
      : undefined
    if (!alternative) {
      return refusal(
        base,
        'does_not_stock',
        `${supplier.label} does not carry ${labelForStock(state, stockId)}.`,
      )
    }
    substitutedFor = stockId
    stockId = alternative
  }

  const stock = state.stock[stockId]
  if (!stock) {
    return refusal(base, 'unknown_stock', `No stock item '${stockId}'`)
  }

  const factors: string[] = []

  // ---- capacity: pattern × relationship × market availability − commitments ----
  const availability = availabilityMultiplier(state, stock)
  const relationshipCapacity = 0.75 + supplier.relationship / 200
  const rushFactor = request.rush ? RUSH_CAPACITY_FACTOR : 1
  const grossCapacity = Math.floor(
    supplierBaseCapacity(supplier) *
      relationshipCapacity *
      availability.multiplier *
      rushFactor,
  )
  const committed = committedUnitsForSupplier(state, supplier.id, stockId)
  const capacityAvailable = Math.max(0, grossCapacity - committed)
  if (capacityAvailable <= 0) {
    return refusal(
      { ...base, capacityAvailable: 0 },
      'no_capacity',
      `${supplier.label} has already committed its ${labelForStock(state, stockId)} capacity (${committed} units outstanding).`,
    )
  }
  const quantity = Math.min(requested, capacityAvailable)
  if (quantity < requested) {
    factors.push(
      `capacity caps this order at ${quantity} of ${requested} units`,
    )
  }
  if (availability.multiplier !== 1 && availability.conditionIds.length > 0) {
    factors.push(
      `market conditions (${availability.conditionIds.join(', ')}) move availability ×${availability.multiplier.toFixed(2)}`,
    )
  }
  if (committed > 0) {
    factors.push(`${committed} units already on order with this supplier`)
  }

  // ---- unit price ----
  const termsFactor = getEconomyModuleState(state).modifiers.supplierTermsFactor
  let unitPrice = getEffectiveBasePrice(
    stock,
    supplier,
    getSupplierModuleState(state).activeMarketConditions,
  )
  if (termsFactor !== 1) {
    unitPrice *= termsFactor
    factors.push(`tavern standing moves supplier terms ×${termsFactor.toFixed(2)}`)
  }
  const tie = factionTieMultiplier(state, supplier)
  if (tie.multiplier !== 1) {
    unitPrice *= tie.multiplier
    if (tie.note) factors.push(tie.note)
  }
  const grievance = supplierGrievance(state, supplier.id)
  if (grievance > 0) {
    const grievanceMultiplier = 1 + grievance * 0.15
    unitPrice *= grievanceMultiplier
    factors.push(
      `${supplier.label} holds a grievance: ×${grievanceMultiplier.toFixed(2)}`,
    )
  }
  if (account.termsAdjustment !== 1) {
    unitPrice *= account.termsAdjustment
    factors.push(
      `negotiated terms ×${account.termsAdjustment.toFixed(2)}`,
    )
  }
  if (request.rush) {
    unitPrice *= RUSH_SURCHARGE
    factors.push(`rush surcharge ×${RUSH_SURCHARGE}`)
  }
  const bulk = BULK_BREAKS.find((entry) => quantity >= entry.atLeast)
  if (bulk) {
    unitPrice *= bulk.multiplier
    factors.push(`bulk break at ${bulk.atLeast}+ units: ×${bulk.multiplier}`)
  }
  if (substitutedFor) {
    // A substitute is a favour, priced like one: no premium, but the player
    // is getting a different good than the one they asked for.
    factors.push(
      `substituting ${labelForStock(state, stockId)} for ${labelForStock(state, substitutedFor)}`,
    )
  }
  unitPrice = Math.max(MIN_UNIT_PRICE, Math.round(unitPrice * 100) / 100)
  const totalPrice = Math.ceil(unitPrice * quantity)

  // ---- lead time ----
  const leadTimeDays = Math.max(
    1,
    request.rush
      ? Math.ceil(supplierBaseLeadDays(supplier) / 2)
      : supplierBaseLeadDays(supplier),
  )

  // ---- payment terms ----
  const creditLimit =
    account.creditStatus === 'approved'
      ? account.creditLimit
      : creditLimitFor(state, supplier, account)
  const creditUsed = supplierCreditExposure(state, supplier.id)
  const creditAvailable = Math.max(0, creditLimit - creditUsed)
  let paymentTerms: SupplierPaymentTerms = 'cash'
  if (request.onCredit) {
    if (account.creditStatus !== 'approved') {
      return refusal(
        { ...base, creditLimit, creditAvailable, capacityAvailable },
        'credit_unavailable',
        creditEligibility(state, supplier.id).reason,
      )
    }
    if (totalPrice > creditAvailable) {
      return refusal(
        { ...base, creditLimit, creditAvailable, capacityAvailable },
        'credit_limit_reached',
        `${supplier.label} will carry ${creditAvailable} more coin; this order is ${totalPrice}.`,
      )
    }
    paymentTerms = 'net'
    factors.push(
      `net ${account.netTermDays} days, ${creditAvailable} of ${creditLimit} coin of credit free`,
    )
  } else if (supplier.relationship >= 55 && account.history.defaults === 0) {
    // A supplier who already trusts the tavern takes half up front and
    // bills the rest on delivery, even without a formal line. That is what
    // makes relationship worth building for a cash player.
    paymentTerms = 'deposit'
    factors.push(
      `${Math.round(account.depositFraction * 100)}% deposit, remainder invoiced on delivery`,
    )
  } else {
    factors.push('cash up front — no line of credit')
  }

  const dueAtPlacement =
    paymentTerms === 'cash'
      ? totalPrice
      : paymentTerms === 'deposit'
        ? Math.ceil(totalPrice * account.depositFraction)
        : 0
  const invoicedOnDelivery = Math.max(0, totalPrice - dueAtPlacement)

  const missChance = orderMissChance(supplier, {
    rush: request.rush ?? false,
    committedUnits: committed,
    capacity: Math.max(1, grossCapacity),
  })
  // The roll is the same; what it costs is not. `deliverOrder` turns a failed
  // roll on a substitution-enabled order into lower-grade goods rather than a
  // short or missed delivery, so the quote names that consequence instead.
  const riskKind: SupplierQuote['riskKind'] = request.allowSubstitution
    ? 'lower_grade'
    : 'short_or_missed'
  if (missChance > 0) {
    factors.push(
      riskKind === 'lower_grade'
        ? `reliability ${supplier.reliability}: ${Math.round(missChance * 100)}% chance the order arrives as lower-grade stock`
        : `reliability ${supplier.reliability}: ${Math.round(missChance * 100)}% chance of a short or missed delivery`,
    )
  }

  return {
    supplierId: supplier.id,
    supplierLabel: supplier.label,
    stockId,
    stockLabel: labelForStock(state, stockId),
    requested,
    quantity,
    unitPrice,
    totalPrice,
    quality: quotedQuality(state, supplier, stock),
    leadTimeDays,
    deliveryDay: today + leadTimeDays,
    deliveryWindowDays: DELIVERY_WINDOW_DAYS,
    capacityAvailable,
    paymentTerms,
    dueAtPlacement,
    invoicedOnDelivery,
    netTermDays: account.netTermDays,
    creditStatus: account.creditStatus,
    creditLimit,
    creditAvailable,
    missChance,
    riskKind,
    substitutionsAllowed: request.allowSubstitution ?? false,
    rush: request.rush ?? false,
    ...(substitutedFor !== undefined ? { substitutedFor } : {}),
    factors,
  }
}

/**
 * Every supplier who could fill this request, best quote first.
 *
 * §6.4's "alternative suppliers" and "order splitting" both need this, and
 * so does the report line that tells the player where else they could go
 * when their usual supplier misses.
 */
export function quoteAlternativeSuppliers(
  state: TavernState,
  request: Omit<QuoteRequest, 'supplierId'> & { excludeSupplierId?: string },
): SupplierQuote[] {
  const quotes: SupplierQuote[] = []
  for (const supplier of Object.values(state.world.suppliers)) {
    if (supplier.id === request.excludeSupplierId) continue
    const quote = quoteSupplierOrder(state, {
      ...request,
      supplierId: supplier.id,
    })
    if (quote.refusal) continue
    quotes.push(quote)
  }
  return quotes.sort(
    (a, b) =>
      a.unitPrice - b.unitPrice ||
      a.leadTimeDays - b.leadTimeDays ||
      b.quantity - a.quantity ||
      a.supplierId.localeCompare(b.supplierId),
  )
}

/**
 * The unit price of an immediate local-market purchase.
 *
 * The market carries whatever the cheapest supplier carries, at a premium
 * and in limited quantity — the emergency channel §6.1 allows, priced so
 * that relying on it is a decision rather than the default.
 */
export function spotMarketUnitPrice(state: TavernState, stockId: string): number {
  const stock = state.stock[stockId]
  if (!stock) return 0
  const conditions = getSupplierModuleState(state).activeMarketConditions
  const termsFactor = getEconomyModuleState(state).modifiers.supplierTermsFactor
  let best: number | undefined
  for (const supplier of Object.values(state.world.suppliers)) {
    if (!supplier.goodsProvided.includes(stockId)) continue
    const price = getEffectiveBasePrice(stock, supplier, conditions)
    if (best === undefined || price < best) best = price
  }
  const reference = best ?? getEffectiveBasePrice(stock, undefined, conditions)
  return Math.max(
    MIN_UNIT_PRICE,
    Math.round(reference * termsFactor * SPOT_MARKET_PREMIUM * 100) / 100,
  )
}

/** Units of `stockId` the local market can still sell today. */
export function spotMarketAvailable(state: TavernState, stockId: string): number {
  const stock = state.stock[stockId]
  if (!stock) return 0
  // Range: barrow traders deal in staples. Uncommon and better is a
  // supplier relationship or an expedition, never a walk to the square.
  if (stock.rarity !== 'common') return 0
  const bought = getSupplierModuleState(state).spotPurchasesToday[stockId] ?? 0
  const { multiplier } = availabilityMultiplier(state, stock)
  const cap = Math.floor(SPOT_MARKET_DAILY_UNITS * multiplier)
  return Math.max(0, cap - bought)
}

/**
 * Where a shortage of `stockId` can actually be answered today.
 *
 * The spot market only deals in common goods, and only so many units of one
 * good a day (`spotMarketAvailable`), so a recommendation that always points
 * at `restock_item` sends the player at a rejection — `market_exhausted` —
 * for every uncommon ingredient and every rare expedition find. This is the
 * one place that decides which channel is open, so the Plan-beat suggestion
 * and the drilldown CTA cannot disagree with what the action will accept.
 *
 * `none` is an honest answer: a rare good has no purchasable route at all,
 * and offering a dead button is worse than offering nothing.
 */
export type ShortageRemedy =
  | { kind: 'spot_market'; stockId: string }
  | {
      kind: 'supplier_order'
      stockId: string
      supplierId: string
      supplierLabel: string
    }
  | { kind: 'none'; stockId: string }

export function shortageRemedyFor(
  state: TavernState,
  stockId: string,
): ShortageRemedy {
  if (!state.stock[stockId]) return { kind: 'none', stockId }
  if (spotMarketAvailable(state, stockId) > 0) {
    return { kind: 'spot_market', stockId }
  }
  // Quote a single unit: this asks "would anyone take this order at all",
  // not "at what size" — the quote caps quantity to capacity by itself.
  const best = quoteAlternativeSuppliers(state, { stockId, quantity: 1 })[0]
  if (best) {
    return {
      kind: 'supplier_order',
      stockId,
      supplierId: best.supplierId,
      supplierLabel: best.supplierLabel,
    }
  }
  return { kind: 'none', stockId }
}

/** Days of grace a supplier invoice opens with, from the ruleset. */
export function invoiceGraceDays(state: TavernState): number {
  return getRule(state, 'obligationGraceDays')
}

export function invoiceLateChargeRate(state: TavernState): number {
  return getRule(state, 'obligationLateChargeRate')
}

/** Everything the tavern owes, for the credit report line. */
export function totalPayable(state: TavernState): number {
  return totalOutstanding(state, 'payable')
}

function labelForStock(state: TavernState, stockId: string): string {
  return (
    state.stock[stockId]?.label ??
    (stockRegistry.has(stockId) ? stockRegistry.get(stockId).label : stockId)
  )
}

/**
 * A good this supplier does carry that could stand in for the one asked
 * for: same functional stock family, and actually stocked by them.
 *
 * Deliberately conservative — a substitution the player did not sanction
 * would be the sim inventing an outcome, so it only ever runs when
 * `allowSubstitution` was set on the order.
 */
function findSubstitute(
  state: TavernState,
  supplier: SupplierWorldState,
  stockId: string,
): string | undefined {
  const wanted = state.stock[stockId]
  if (!wanted) return undefined
  // `food` and `perishable` are properties, not interchangeable roles: a
  // bowl of prepared stew cannot replace raw mushrooms in a recipe merely
  // because both spoil. These tags describe what the stock can do.
  const family = wanted.tags.filter((tag) =>
    ['alcohol', 'ingredient', 'fuel', 'equipment', 'material'].includes(tag),
  )
  if (family.length === 0) return undefined
  const candidates = supplier.goodsProvided
    .filter((id) => id !== stockId)
    .map((id) => state.stock[id])
    .filter((item): item is StockState => item !== undefined)
    .filter((item) => item.tags.some((tag) => family.includes(tag)))
    .sort((a, b) => a.basePrice - b.basePrice || a.id.localeCompare(b.id))
  return candidates[0]?.id
}
