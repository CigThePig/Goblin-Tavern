import type { SimContext } from '../../../core/context'
import type { PressureCalculationResult, PressureCauseRef } from '../pressureTypes'
import type { EntityRef } from '../../../state/TavernState'
import {
  combineToValue,
  pushCause,
  severityFromValue,
  urgencyFromSeverity,
} from './helpers'

// Phase 18 §18.7 — Maintenance pressure.
//
// Inputs:
//   - area damage / condition (every area, weighted by severity)
//   - roof state specifically (mirrors Phase 14 backlog)
//   - privy condition
//   - main room damage
//   - persistent neglect memory (pattern)

const DAMAGE_HEAVY = 16
const DAMAGE_LIGHT = 6
const CONDITION_POOR = 12
const ROOF_CRITICAL = 14
const PRIVY_BROKEN = 10
const HABITUAL_NEGLECT = 14
const REPAIRED_RECENTLY = -10

export function calculateMaintenance(ctx: SimContext): PressureCalculationResult {
  const causes: PressureCauseRef[] = []
  const locations: EntityRef[] = []

  for (const area of Object.values(ctx.state.areas)) {
    if (area.damage >= 65) {
      locations.push({ kind: 'area', id: area.id })
      pushCause(causes, {
        id: `damage_heavy_${area.id}`,
        readable: `${area.label} damage heavy (${area.damage}).`,
        amount: DAMAGE_HEAVY,
        tags: ['area', 'damage', area.id],
        relatedLocations: [{ kind: 'area', id: area.id }],
        relatedSystems: ['areas'],
      })
    } else if (area.damage >= 45) {
      pushCause(causes, {
        id: `damage_light_${area.id}`,
        readable: `${area.label} damage visible (${area.damage}).`,
        amount: DAMAGE_LIGHT,
        tags: ['area', 'damage', area.id],
        relatedLocations: [{ kind: 'area', id: area.id }],
        relatedSystems: ['areas'],
      })
    }
    if (area.condition <= 40) {
      pushCause(causes, {
        id: `condition_${area.id}`,
        readable: `${area.label} condition poor (${area.condition}).`,
        amount: CONDITION_POOR,
        tags: ['area', 'condition', area.id],
        relatedLocations: [{ kind: 'area', id: area.id }],
        relatedSystems: ['areas'],
      })
    }
  }

  const roof = ctx.state.areas['roof']
  if (roof && (roof.condition <= 30 || roof.damage >= 65)) {
    pushCause(causes, {
      id: 'roof_critical',
      readable: `Roof at critical state (condition ${roof.condition}, damage ${roof.damage}).`,
      amount: ROOF_CRITICAL,
      tags: ['roof', 'critical'],
      relatedLocations: [{ kind: 'area', id: roof.id }],
      relatedSystems: ['areas'],
    })
  }

  const privy = ctx.state.areas['privy']
  if (privy && privy.condition <= 30) {
    pushCause(causes, {
      id: 'privy_broken',
      readable: `Privy condition poor (${privy.condition}).`,
      amount: PRIVY_BROKEN,
      tags: ['privy', 'condition'],
      relatedLocations: [{ kind: 'area', id: privy.id }],
      relatedSystems: ['areas'],
    })
  }

  if (ctx.hasMemory('habitual_roof_neglect')) {
    pushCause(causes, {
      id: 'habitual_neglect',
      readable: 'Habitual roof neglect pattern is active.',
      amount: HABITUAL_NEGLECT,
      tags: ['pattern', 'roof'],
      relatedSystems: ['memories'],
    })
  }
  if (
    ctx.hasMemory('roof_patched_recently') ||
    ctx.hasMemory('area_repaired_recently')
  ) {
    pushCause(causes, {
      id: 'repaired_recently',
      readable: 'Recent repairs lowering pressure.',
      amount: REPAIRED_RECENTLY,
      tags: ['memory', 'repair'],
      relatedSystems: ['memories'],
    })
  }

  const value = combineToValue(0, causes)
  const severity = severityFromValue(value)
  const urgency = urgencyFromSeverity(severity)

  return {
    value,
    severity,
    urgency,
    causes,
    relatedLocations: locations,
    relatedSystems: ['areas'],
    tags: ['maintenance', 'areas'],
    consequences:
      severity >= 60
        ? [
            'Areas may become unusable.',
            'Customer satisfaction will drop.',
          ]
        : [],
  }
}
