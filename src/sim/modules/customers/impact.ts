import type { SimContext } from '../../core/context'
import type { CustomerGroupState } from '../../state/TavernState'

import { clampPercent } from '../../state/normalize'
import type { ServiceQualityModifiers } from '../staff/types'

import type { CustomerTurnout } from './types'

// Phase 10 §10.6 — Customer-created mess and damage.
//
// Visitors increase main-room mess proportional to headcount, and rowdy
// or destructive groups add cleanliness drop and damage on top. All
// mutations route through `ctx.modifyArea` with `meta.source: 'customers'`
// per Phase 7 §7.3.1 / Phase 10 §10.6 ("All area mutations from this
// section must go through `ctx.modifyArea`"). The numbers are intentionally
// small — Phase 10 is about believable movement, not balance.

const SOURCE = 'customers'

export type CustomerImpactOptions = {
  serviceQuality?: ServiceQualityModifiers
}

export function applyCustomerImpact(
  ctx: SimContext,
  group: CustomerGroupState,
  turnout: CustomerTurnout,
  options: CustomerImpactOptions = {},
): void {
  if (turnout.visitors <= 0) return
  const room = ctx.state.areas['main_room']
  if (!room) return

  // Baseline mess: rough cleanliness drop scaled by visitors / 5.
  const baseMess = Math.max(1, Math.round(turnout.visitors / 4))
  const cleanlinessDrop = Math.max(0, Math.round(turnout.visitors / 6))

  // Rowdy groups add extra mess and damage.
  const rowdyExtra = group.rowdiness >= 70
    ? Math.round((group.rowdiness - 50) / 20)
    : 0
  const rawDamage = group.damageRisk >= 60
    ? Math.max(1, Math.round((group.damageRisk - 40) * turnout.visitors / 80))
    : 0

  // Phase 12 §12.5 — staff `messControl` reduces mess accumulation;
  // `fightControl` reduces damage from rowdy groups. Both knobs are
  // optional: when no service quality is published (e.g. the customers
  // module runs without the staff module), the maths reduce to the
  // Phase 10 baseline.
  const quality = options.serviceQuality
  const messReduction = quality
    ? Math.max(0, Math.round(quality.messControl))
    : 0
  const fightFactor = quality
    ? Math.max(0, 1 - quality.fightControl / 4)
    : 1
  const messGain = Math.max(0, baseMess + rowdyExtra - messReduction)
  const damageGain = Math.round(rawDamage * fightFactor)

  const nextCleanliness = clampPercent(room.cleanliness - cleanlinessDrop)
  const nextMess = clampPercent(room.mess + messGain)
  const nextDamage = damageGain > 0
    ? clampPercent(room.damage + damageGain)
    : room.damage

  const changes: Partial<typeof room> = {}
  if (nextCleanliness !== room.cleanliness) changes.cleanliness = nextCleanliness
  if (nextMess !== room.mess) changes.mess = nextMess
  if (nextDamage !== room.damage) changes.damage = nextDamage

  if (Object.keys(changes).length === 0) return

  ctx.modifyArea('main_room', changes, {
    source: SOURCE,
    reason: `traffic:${group.id}`,
  })

  // Phase 17 §17.4 — destructive groups carry their main-room damage
  // forward as an attributable cause so the service report can answer
  // "why did the main room take damage?".
  if (damageGain > 0) {
    ctx.addCause({
      source: 'customers.impact',
      sourceType: 'service',
      target: 'area:main_room.damage',
      targetType: 'area',
      amount: damageGain,
      direction: 'increase',
      weight: damageGain * 4,
      readable: `${group.label ?? group.id} traffic caused +${damageGain} main room damage.`,
      tags: ['service', 'customer_impact', group.id, 'damage', 'main_room'],
      relatedActors: [{ kind: 'customer_group', id: group.id }],
      relatedLocations: [{ kind: 'area', id: 'main_room' }],
      relatedSystems: ['customers', 'areas'],
    })
  }

  if (damageGain > 0) {
    turnout.notes.push(
      `${group.label ?? group.id} traffic caused +${damageGain} main room damage.`,
    )
  } else if (rowdyExtra > 0) {
    turnout.notes.push(`${group.label ?? group.id} traffic was rowdy.`)
  }
}
