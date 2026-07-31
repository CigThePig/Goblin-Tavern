import type { SimContext } from '../../../core/context'
import { clampPercent } from '../../../state/normalize'
import type { ServiceQualityModifiers } from '../../staff/types'
import type { AreaChangeSummary } from '../types'

import type { ServiceFlowResult } from './types'

// Expansion Phase 4 §4.1 "table occupancy … cleaning and reset capacity" —
// what the evening does to the rooms.
//
// WHY THIS MOVED. Phase 10's `customers/impact.ts` put every patron's mess in
// `main_room`, because a group's turnout was a single number with no location.
// The flow knows where parties actually sat, so the wear now lands in the rooms
// that took it: a night spent in the booths dirties the booths. The customers
// module keeps everything about how a GROUP feels; the service module owns what
// the SERVICE did to the building, which is the same split Phase 3 used when
// the staff fatigue rule moved into the roster.
//
// It is one writer, not two: the old customers-module impact pass is gone, so
// mess is charged for exactly once.

const SOURCE = 'service.flow'

/** Patrons seated in each area across the evening, and who they were. */
function occupancyByArea(
  flow: ServiceFlowResult,
): Map<string, { patrons: number; groupIds: Set<string> }> {
  const rows = new Map<string, { patrons: number; groupIds: Set<string> }>()
  for (const party of flow.parties) {
    if (!party.areaId || party.seatedWave === undefined) continue
    const row = rows.get(party.areaId) ?? { patrons: 0, groupIds: new Set<string>() }
    row.patrons += party.size
    row.groupIds.add(party.groupId)
    rows.set(party.areaId, row)
  }
  return rows
}

/**
 * Apply the evening's wear.
 *
 * `unresetSeats` is the Phase 4 addition to a Phase 10 rule: tables that never
 * got wiped are extra mess in the morning, which is how a cleaning bottleneck
 * carries into tomorrow's service instead of vanishing at midnight.
 */
export function applyServiceAreaImpact(
  ctx: SimContext,
  flow: ServiceFlowResult,
  quality: ServiceQualityModifiers,
): AreaChangeSummary[] {
  const changes: AreaChangeSummary[] = []
  const rows = occupancyByArea(flow)
  const messReduction = Math.max(0, Math.round(quality.messControl))
  const fightFactor = Math.max(0, 1 - quality.fightControl / 4)

  const areaIds = [...rows.keys()].sort((a, b) => a.localeCompare(b))
  for (const areaId of areaIds) {
    const row = rows.get(areaId)!
    const area = ctx.state.areas[areaId]
    if (!area) continue

    const baseMess = Math.max(1, Math.round(row.patrons / 4))
    const cleanlinessDrop = Math.max(0, Math.round(row.patrons / 6))

    // Rowdiness and destructiveness, weighted by how much of this room's crowd
    // each group actually was.
    let rowdyExtra = 0
    let rawDamage = 0
    for (const groupId of [...row.groupIds].sort((a, b) => a.localeCompare(b))) {
      const group = ctx.state.customerGroups[groupId]
      if (!group) continue
      const share = shareOfArea(flow, areaId, groupId)
      if (group.rowdiness >= 70) {
        rowdyExtra += Math.round(((group.rowdiness - 50) / 20) * share)
      }
      if (group.damageRisk >= 60) {
        rawDamage += Math.max(
          share > 0 ? 1 : 0,
          Math.round(((group.damageRisk - 40) * row.patrons * share) / 80),
        )
      }
    }

    // Tables nobody got round to wiping are tomorrow's problem, in the room
    // they were left in.
    const unreset = flow.unresetByArea[areaId] ?? 0
    const messGain = Math.max(
      0,
      baseMess + rowdyExtra + Math.round(unreset / 4) - messReduction,
    )
    const damageGain = Math.round(rawDamage * fightFactor)

    const nextCleanliness = clampPercent(area.cleanliness - cleanlinessDrop)
    const nextMess = clampPercent(area.mess + messGain)
    const nextDamage =
      damageGain > 0 ? clampPercent(area.damage + damageGain) : area.damage

    const patch: Partial<typeof area> = {}
    if (nextCleanliness !== area.cleanliness) patch.cleanliness = nextCleanliness
    if (nextMess !== area.mess) patch.mess = nextMess
    if (nextDamage !== area.damage) patch.damage = nextDamage
    if (Object.keys(patch).length === 0) continue

    ctx.modifyArea(areaId, patch, {
      source: SOURCE,
      reason: `service_traffic:${row.patrons}`,
    })

    if (patch.mess !== undefined) {
      changes.push({
        areaId,
        field: 'mess',
        delta: nextMess - area.mess,
        reason: 'service_day',
      })
    }
    if (patch.damage !== undefined) {
      changes.push({
        areaId,
        field: 'damage',
        delta: nextDamage - area.damage,
        reason: 'service_day',
      })
      const worst = [...row.groupIds].sort((a, b) => a.localeCompare(b))[0]
      ctx.addCause({
        source: `${SOURCE}.impact`,
        sourceType: 'service',
        target: `area:${areaId}.damage`,
        targetType: 'area',
        amount: damageGain,
        direction: 'increase',
        weight: damageGain * 4,
        readable: `Service traffic caused +${damageGain} damage in ${areaId}.`,
        tags: ['service', 'customer_impact', 'damage', areaId],
        relatedActors: worst
          ? [{ kind: 'customer_group' as const, id: worst }]
          : [],
        relatedLocations: [{ kind: 'area', id: areaId }],
        relatedSystems: ['service', 'areas'],
      })
    }
  }
  return changes
}

/** This group's share of the patrons who sat in this area. */
function shareOfArea(
  flow: ServiceFlowResult,
  areaId: string,
  groupId: string,
): number {
  let total = 0
  let mine = 0
  for (const party of flow.parties) {
    if (party.areaId !== areaId || party.seatedWave === undefined) continue
    total += party.size
    if (party.groupId === groupId) mine += party.size
  }
  return total > 0 ? mine / total : 0
}
