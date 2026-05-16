import type { SimContext } from '../../core/context'
import type { ReportSection } from '../../core/reports'
import { marketConditionRegistry } from '../../content/suppliers/marketConditionRegistry'
import { getRelationshipPriceMultiplier } from './pricing'
import { getSupplierModuleState } from './state'

// Phase 29 §29.7 — Supplier report.
//
// Surfaces simulation truth about the supplier layer: active market
// conditions, unreliable suppliers, missed deliveries, and notable
// price changes. Reports must remain mechanical (Phase 21 contract: no
// finished card prose); each line names ids and numbers, not stories.

const SOURCE = 'suppliers'

const UNRELIABLE_RELIABILITY_THRESHOLD = 35
const POOR_RELATIONSHIP_THRESHOLD = 30

export function buildSupplierReport(ctx: SimContext): ReportSection | null {
  const suppliers = Object.values(ctx.state.world.suppliers)
  const slice = getSupplierModuleState(ctx.state)

  const hasContent =
    suppliers.length > 0 ||
    slice.activeMarketConditions.length > 0 ||
    slice.deliveriesToday.length > 0 ||
    slice.priceAdjustmentsToday.length > 0 ||
    slice.missedDeliveriesToday.length > 0
  if (!hasContent) return null

  const lines: string[] = []

  if (suppliers.length > 0) {
    lines.push('Suppliers:')
    for (const supplier of suppliers) {
      const goodsLabel =
        supplier.goodsProvided.length > 0
          ? supplier.goodsProvided.join(', ')
          : '(no goods)'
      // Phase 84 / ISSUE-044 — surface the relationship discount so
      // the player sees the meter pay off. multiplier 0.97 = 3% off.
      const multiplier = getRelationshipPriceMultiplier(supplier)
      const discountPct = Math.round((1 - multiplier) * 100)
      const discountTag =
        discountPct === 0
          ? ''
          : discountPct > 0
            ? `, ${discountPct}% discount`
            : `, ${Math.abs(discountPct)}% surcharge`
      lines.push(
        `  ${supplier.label}: reliability ${supplier.reliability}, relationship ${supplier.relationship}${discountTag} (${goodsLabel})`,
      )
    }
  }

  const unreliable = suppliers.filter(
    (s) => s.reliability <= UNRELIABLE_RELIABILITY_THRESHOLD,
  )
  if (unreliable.length > 0) {
    lines.push('')
    lines.push('Unreliable suppliers:')
    for (const supplier of unreliable) {
      lines.push(
        `  ${supplier.label} (reliability ${supplier.reliability})`,
      )
    }
  }

  const strained = suppliers.filter(
    (s) => s.relationship <= POOR_RELATIONSHIP_THRESHOLD,
  )
  if (strained.length > 0) {
    lines.push('')
    lines.push('Strained relationships:')
    for (const supplier of strained) {
      lines.push(
        `  ${supplier.label} (relationship ${supplier.relationship})`,
      )
    }
  }

  if (slice.activeMarketConditions.length > 0) {
    lines.push('')
    lines.push('Active market conditions:')
    for (const active of slice.activeMarketConditions) {
      const def = marketConditionRegistry.has(active.id)
        ? marketConditionRegistry.get(active.id)
        : undefined
      const label = def?.label ?? active.id
      const expiry =
        active.expiresAtDay !== undefined
          ? ` (expires day ${active.expiresAtDay})`
          : ''
      lines.push(`  ${label}: intensity ${active.intensity}${expiry}`)
    }
  }

  if (slice.deliveriesToday.length > 0) {
    lines.push('')
    lines.push('Deliveries today:')
    for (const delivery of slice.deliveriesToday) {
      lines.push(
        `  ${delivery.supplierId} → ${delivery.stockId}: ${delivery.quantity} @ ${delivery.coinCost} coin (quality ${delivery.quality})`,
      )
    }
  }

  if (slice.missedDeliveriesToday.length > 0) {
    lines.push('')
    lines.push('Missed deliveries:')
    for (const missed of slice.missedDeliveriesToday) {
      lines.push(
        `  ${missed.supplierId} → ${missed.stockId}: ${missed.reason}`,
      )
    }
  }

  if (slice.priceAdjustmentsToday.length > 0) {
    lines.push('')
    lines.push('Notable price changes:')
    for (const adj of slice.priceAdjustmentsToday) {
      const delta = adj.effectivePrice - adj.basePrice
      const sign = delta >= 0 ? '+' : ''
      lines.push(
        `  ${adj.supplierId} → ${adj.stockId}: ${adj.basePrice} → ${adj.effectivePrice} (${sign}${delta.toFixed(2)})`,
      )
    }
  }

  return {
    id: 'suppliers',
    source: SOURCE,
    title: 'SUPPLIER REPORT',
    lines,
    data: {
      supplierCount: suppliers.length,
      activeMarketConditionCount: slice.activeMarketConditions.length,
      deliveryCount: slice.deliveriesToday.length,
      missedDeliveryCount: slice.missedDeliveriesToday.length,
      priceAdjustmentCount: slice.priceAdjustmentsToday.length,
      unreliableSupplierIds: unreliable.map((s) => s.id),
    },
  }
}
