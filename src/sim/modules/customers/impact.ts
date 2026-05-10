import type { SimContext } from '../../core/context'
import type { CustomerGroupState } from '../../state/TavernState'

import { clampPercent } from '../../state/normalize'

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

export function applyCustomerImpact(
  ctx: SimContext,
  group: CustomerGroupState,
  turnout: CustomerTurnout,
): void {
  if (turnout.visitors <= 0) return
  const room = ctx.state.areas['main_room']
  if (!room) return

  // Baseline mess: rough cleanliness drop scaled by visitors / 5.
  const messGain = Math.max(1, Math.round(turnout.visitors / 4))
  const cleanlinessDrop = Math.max(0, Math.round(turnout.visitors / 6))

  // Rowdy groups add extra mess and damage.
  const rowdyExtra = group.rowdiness >= 70
    ? Math.round((group.rowdiness - 50) / 20)
    : 0
  const damageGain = group.damageRisk >= 60
    ? Math.max(1, Math.round((group.damageRisk - 40) * turnout.visitors / 80))
    : 0

  const nextCleanliness = clampPercent(room.cleanliness - cleanlinessDrop)
  const nextMess = clampPercent(room.mess + messGain + rowdyExtra)
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

  if (damageGain > 0) {
    turnout.notes.push(
      `${group.label ?? group.id} traffic caused +${damageGain} main room damage.`,
    )
  } else if (rowdyExtra > 0) {
    turnout.notes.push(`${group.label ?? group.id} traffic was rowdy.`)
  }
}
