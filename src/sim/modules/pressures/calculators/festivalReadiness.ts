import type { SimContext } from '../../../core/context'
import type { EntityRef } from '../../../state/TavernState'
import type { PressureCalculationResult, PressureCauseRef } from '../pressureTypes'

import {
  combineToValue,
  pushCause,
  severityFromValue,
  urgencyFromSeverity,
} from './helpers'
import {
  activeArcsByTypeOrTag,
  hasCalendarTag,
  ownerProjects,
} from './expandedHelpers'

// Phase 38 §38.9 — Festival readiness pressure. Inverted: high = risk
// of being unready.

const FESTIVAL_ARC_PER_INTENSITY = 0.6
const LOW_STOCK_PENALTY = 12
const STAFF_FATIGUE_PER_STAFF = 4
const DIRTY_AREA_PER_AREA = 5
const SUPPLIER_DISTRUST_DIVISOR = 7
const COMPLETED_PREP_RELIEF = -10
const STRONG_SUPPLIER_RELIEF = -6

export function calculateFestivalReadiness(
  ctx: SimContext,
): PressureCalculationResult {
  const causes: PressureCauseRef[] = []
  const relatedActors: EntityRef[] = []
  const relatedLocations: EntityRef[] = []

  const arcs = activeArcsByTypeOrTag(ctx.state, {
    types: ['festival'],
    tags: ['festival'],
  })
  let arcIntensity = 0
  for (const arc of arcs) {
    arcIntensity += arc.intensity
    relatedActors.push({ kind: 'local_event', id: arc.id })
  }

  const festivalImminent =
    hasCalendarTag(ctx.state, 'festival_window') ||
    hasCalendarTag(ctx.state, 'mushroom_festival')

  if (arcs.length === 0 && !festivalImminent) {
    // No festival, no pressure.
    return {
      value: 0,
      severity: 0,
      urgency: 0,
      causes,
      relatedSystems: ['calendar', 'localArcs'],
      tags: ['festival', 'arc'],
    }
  }

  if (arcs.length > 0) {
    pushCause(causes, {
      id: 'festival_arc_active',
      readable: `${arcs.length} festival arc(s) active (intensity ${arcIntensity}).`,
      amount: Math.round(arcIntensity * FESTIVAL_ARC_PER_INTENSITY),
      tags: ['festival', 'arc'],
      relatedSystems: ['localArcs'],
    })
  }

  if (festivalImminent && arcs.length === 0) {
    pushCause(causes, {
      id: 'festival_window_open',
      readable: 'Festival calendar tag active but no preparation arc seeded.',
      amount: 20,
      tags: ['festival', 'calendar'],
      relatedSystems: ['calendar'],
    })
  }

  // Low stock.
  const ale = ctx.state.stock['ale']
  const stew = ctx.state.stock['stew']
  if (ale && ale.quantity <= 40) {
    pushCause(causes, {
      id: 'low_ale_for_festival',
      readable: `Ale stock low (${Math.round(ale.quantity)}) ahead of festival.`,
      amount: LOW_STOCK_PENALTY,
      tags: ['stock', 'festival'],
      relatedSystems: ['stock'],
    })
  }
  if (stew && stew.quantity <= 15) {
    pushCause(causes, {
      id: 'low_stew_for_festival',
      readable: `Stew stock low (${Math.round(stew.quantity)}) ahead of festival.`,
      amount: LOW_STOCK_PENALTY,
      tags: ['stock', 'festival'],
      relatedSystems: ['stock'],
    })
  }

  // Staff fatigue.
  let fatiguedStaff = 0
  for (const member of Object.values(ctx.state.staff)) {
    if (member.fatigue >= 60) fatiguedStaff += 1
  }
  if (fatiguedStaff > 0) {
    pushCause(causes, {
      id: 'fatigued_staff',
      readable: `${fatiguedStaff} fatigued staff before festival.`,
      amount: STAFF_FATIGUE_PER_STAFF * fatiguedStaff,
      tags: ['staff', 'fatigue'],
      relatedSystems: ['staff'],
    })
  }

  // Dirty/damaged areas.
  let dirtyAreas = 0
  for (const area of Object.values(ctx.state.areas)) {
    if (area.cleanliness <= 40 || area.condition <= 40) {
      dirtyAreas += 1
      relatedLocations.push({ kind: 'area', id: area.id })
    }
  }
  if (dirtyAreas > 0) {
    pushCause(causes, {
      id: 'dirty_areas',
      readable: `${dirtyAreas} area(s) dirty or damaged.`,
      amount: DIRTY_AREA_PER_AREA * dirtyAreas,
      tags: ['areas', 'festival'],
      relatedSystems: ['areas'],
    })
  }

  // Supplier distrust bleeds in.
  const supplierDistrust = ctx.state.pressures['supplier_distrust']
  if (supplierDistrust && supplierDistrust.value >= 30) {
    pushCause(causes, {
      id: 'supplier_distrust_bleed',
      readable: `Supplier distrust (${supplierDistrust.value}) threatens festival deliveries.`,
      amount: Math.round(supplierDistrust.value / SUPPLIER_DISTRUST_DIVISOR),
      tags: ['supplier', 'web'],
      relatedSystems: ['suppliers', 'pressures'],
    })
  }

  // Completed preparation projects.
  let prepProjects = 0
  for (const project of Object.values(ownerProjects(ctx.state))) {
    if (
      project.status === 'completed' &&
      (project.tags.includes('festival_prep') || project.tags.includes('preparation'))
    ) {
      prepProjects += 1
    }
  }
  if (prepProjects > 0) {
    pushCause(causes, {
      id: 'preparation_projects_complete',
      readable: `${prepProjects} preparation project(s) complete.`,
      amount: COMPLETED_PREP_RELIEF * prepProjects,
      tags: ['project', 'festival'],
      relatedSystems: ['ownerActions'],
    })
  }

  // Strong supplier relationships.
  let strongSuppliers = 0
  for (const supplier of Object.values(ctx.state.world.suppliers)) {
    if (supplier.relationship >= 75 && supplier.reliability >= 65) strongSuppliers += 1
  }
  if (strongSuppliers > 0) {
    pushCause(causes, {
      id: 'strong_suppliers',
      readable: `${strongSuppliers} supplier(s) reliable and friendly.`,
      amount: STRONG_SUPPLIER_RELIEF * strongSuppliers,
      tags: ['supplier', 'relief'],
      relatedSystems: ['suppliers'],
    })
  }

  const value = combineToValue(0, causes)
  const severity = severityFromValue(value)
  // Festival readiness is time-sensitive: any imminent festival tag adds
  // urgency above severity.
  const urgency = urgencyFromSeverity(severity, festivalImminent ? 15 : 5)

  return {
    value,
    severity,
    urgency,
    causes,
    relatedActors,
    relatedLocations,
    relatedSystems: ['stock', 'staff', 'areas', 'suppliers', 'localArcs'],
    tags: ['festival', 'arc'],
    consequences:
      severity >= 40
        ? [
            'Festival preparation issue seeds become more likely.',
            'A failed festival creates lasting memories.',
            'A successful festival creates lasting memories.',
          ]
        : [],
  }
}
