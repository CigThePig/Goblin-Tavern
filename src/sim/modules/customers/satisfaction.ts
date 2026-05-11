import type { SimContext } from '../../core/context'
import type { CustomerGroupState } from '../../state/TavernState'

import { clampPercent } from '../../state/normalize'
import { isAreaDangerous } from '../areas/derived'
import { effectiveQuality, isPerishable } from '../stock/spoilage'
import type { ServiceQualityModifiers } from '../staff/types'

import { highestStockPrice } from './forecast'
import type { CustomerTurnout } from './types'

// Phase 12 §12.8 — satisfaction adjustments derived from staff service
// quality and structured incidents (read from the service module slice
// when present). The shape mirrors `DailyServiceResult.incidents`
// loosely so this file does not depend on the service module's types.
type ServiceAdjustmentInputs = {
  serviceQuality?: ServiceQualityModifiers
  incidents?: ReadonlyArray<{ actorGroup?: string; id: string }>
}

// Phase 10 §10.5 — Customer satisfaction.
//
// Satisfaction reacts to: stock availability (shortages), effective stock
// quality (after spoilage), main-room cleanliness vs filthTolerance,
// danger vs dangerTolerance, and price vs priceSensitivity. The actual
// mutation is routed through `ctx.modifyCustomerGroup` so the Phase 7
// §7.3.1 cause contract holds end-to-end.

const SOURCE = 'customers'

function cleanlinessSignal(
  group: CustomerGroupState,
  ctx: SimContext,
): number {
  const room = ctx.state.areas['main_room']
  if (!room) return 0
  if (room.cleanliness >= group.filthTolerance) return 1
  // Squared sensitivity factor mirrors `forecast.cleanlinessPenalty`:
  // tolerant groups take a much smaller hit than sensitive groups even
  // when their gap-below-tolerance is larger.
  const gap = group.filthTolerance - room.cleanliness
  const sensitivity = 1 - group.filthTolerance / 100
  return -Math.round(gap * Math.pow(sensitivity, 2) * 0.5)
}

function dangerSignal(group: CustomerGroupState, ctx: SimContext): number {
  let dangerous = 0
  for (const area of Object.values(ctx.state.areas)) {
    if (isAreaDangerous(area)) dangerous += 1
  }
  if (dangerous === 0) return 0
  if (group.dangerTolerance >= 75) return 0
  const margin = 75 - group.dangerTolerance
  return -Math.round(dangerous * (margin / 25))
}

function priceSignal(group: CustomerGroupState, ctx: SimContext): number {
  const maxPrice = highestStockPrice(ctx.state)
  if (maxPrice <= 1) return 0
  const sensitivity = group.priceSensitivity / 100
  if (sensitivity < 0.3) return 0
  return -Math.round((maxPrice - 1) * sensitivity * 0.6)
}

function qualitySignal(group: CustomerGroupState, ctx: SimContext): number {
  // Average effective quality of preferred items (only those in stock).
  let totalEffective = 0
  let count = 0
  for (const item of Object.values(ctx.state.stock)) {
    if (item.quantity <= 0) continue
    if (!group.preferredStockTags.some((tag) => item.tags.includes(tag))) continue
    const q = isPerishable(item) ? effectiveQuality(item) : item.quality
    totalEffective += q
    count += 1
  }
  if (count === 0) return 0
  const avg = totalEffective / count
  // Centred at 50: each 10 above is +1, each 10 below is -1 (rounded).
  return Math.round((avg - 50) / 10)
}

function shortageSignal(turnout: CustomerTurnout): number {
  if (turnout.shortages.length === 0) return 0
  return -2 * turnout.shortages.length
}

function serviceSignal(turnout: CustomerTurnout): number {
  // Some visitors arrived and were served (coin earned) → mild bump.
  if (turnout.visitors > 0 && turnout.coinEarned > 0) return 1
  return 0
}

function foodQualitySignal(
  quality: ServiceQualityModifiers | undefined,
): number {
  if (!quality) return 0
  if (quality.foodQualityModifier === 0) return 0
  return Math.round(quality.foodQualityModifier)
}

function incidentSignal(
  group: CustomerGroupState,
  inputs: ServiceAdjustmentInputs | undefined,
): number {
  if (!inputs?.incidents) return 0
  const groupIncidents = inputs.incidents.filter(
    (i) => i.actorGroup === group.id,
  )
  if (groupIncidents.length === 0) return 0
  return -groupIncidents.length
}

export function applySatisfactionUpdate(
  ctx: SimContext,
  group: CustomerGroupState,
  turnout: CustomerTurnout,
  inputs: ServiceAdjustmentInputs = {},
): void {
  const cleanliness = cleanlinessSignal(group, ctx)
  const danger = dangerSignal(group, ctx)
  const price = priceSignal(group, ctx)
  const quality = qualitySignal(group, ctx)
  const shortage = shortageSignal(turnout)
  const service = serviceSignal(turnout)
  const food = foodQualitySignal(inputs.serviceQuality)
  const incidents = incidentSignal(group, inputs)

  const delta =
    cleanliness + danger + price + quality + shortage + service + food + incidents
  if (delta === 0) return

  const next = clampPercent(group.satisfaction + delta)
  if (next === group.satisfaction) {
    turnout.satisfactionChange = 0
    return
  }
  turnout.satisfactionChange = next - group.satisfaction

  if (cleanliness < 0) {
    turnout.notes.push(`Main room cleanliness hurt satisfaction (${cleanliness}).`)
  }
  if (cleanliness > 0) {
    turnout.notes.push('Main room cleanliness was tolerable.')
  }
  if (danger < 0) {
    turnout.notes.push(`Dangerous areas reduced satisfaction (${danger}).`)
  }
  if (price < 0) {
    turnout.notes.push(`Prices stung price-sensitive visitors (${price}).`)
  }
  if (quality > 0) turnout.notes.push('Stock quality was a draw.')
  if (quality < 0) turnout.notes.push('Stock quality was disappointing.')
  if (shortage < 0) turnout.notes.push(`Shortages left visitors unhappy (${shortage}).`)
  if (food > 0) turnout.notes.push('Cook lifted food quality.')
  if (food < 0) {
    turnout.notes.push('Cook stretched ingredients — food suffered.')
  }
  if (incidents < 0) {
    turnout.notes.push(`${-incidents} incident(s) hurt satisfaction.`)
  }
  if (service > 0 && turnout.notes.length === 0) {
    turnout.notes.push('Service went smoothly.')
  }

  ctx.modifyCustomerGroup(
    group.id,
    { satisfaction: next },
    { source: SOURCE, reason: 'service_satisfaction' },
  )

  // Phase 17 §17.4 — record the dominant negative driver as a cause so
  // reports can answer "why is this group unhappy?". We always emit a
  // top-level satisfaction cause (target = customer:<id>.satisfaction)
  // and add a more specific cause for each strong contributor.
  const causeTags = ['service', 'satisfaction', group.id]
  ctx.addCause({
    source: SOURCE,
    sourceType: 'service',
    target: `customer:${group.id}.satisfaction`,
    targetType: 'customer',
    amount: next - group.satisfaction,
    readable:
      next > group.satisfaction
        ? `${group.label ?? group.id} satisfaction improved (+${next - group.satisfaction}).`
        : `${group.label ?? group.id} satisfaction fell (${next - group.satisfaction}).`,
    tags: causeTags,
    relatedActors: [{ kind: 'customer_group', id: group.id }],
    relatedSystems: ['customers'],
  })
  if (cleanliness < 0) {
    ctx.addCause({
      source: SOURCE,
      sourceType: 'service',
      target: `customer:${group.id}.satisfaction`,
      targetType: 'customer',
      amount: cleanliness,
      weight: Math.abs(cleanliness) * 2,
      readable: `Main room cleanliness fell below ${group.label ?? group.id} tolerance.`,
      tags: [...causeTags, 'cleanliness', 'main_room'],
      relatedActors: [{ kind: 'customer_group', id: group.id }],
      relatedLocations: [{ kind: 'area', id: 'main_room' }],
      relatedSystems: ['customers', 'areas'],
    })
  }
  if (danger < 0) {
    ctx.addCause({
      source: SOURCE,
      sourceType: 'service',
      target: `customer:${group.id}.satisfaction`,
      targetType: 'customer',
      amount: danger,
      weight: Math.abs(danger) * 2,
      readable: `Dangerous areas drove ${group.label ?? group.id} away.`,
      tags: [...causeTags, 'dangerous'],
      relatedActors: [{ kind: 'customer_group', id: group.id }],
      relatedSystems: ['customers', 'areas'],
    })
  }
  if (shortage < 0) {
    ctx.addCause({
      source: SOURCE,
      sourceType: 'service',
      target: `customer:${group.id}.satisfaction`,
      targetType: 'customer',
      amount: shortage,
      weight: Math.abs(shortage) * 2,
      readable: `${group.label ?? group.id} hit ${-shortage / 2} shortage(s).`,
      tags: [...causeTags, 'shortage'],
      relatedActors: [{ kind: 'customer_group', id: group.id }],
      relatedSystems: ['customers', 'stock'],
    })
  }
}
