import type { SimContext } from '../../../core/context'
import type { EntityRef } from '../../../state/TavernState'
import type { PressureCalculationResult, PressureCauseRef } from '../pressureTypes'

import {
  combineToValue,
  pushCause,
  severityFromValue,
  urgencyFromSeverity,
} from './helpers'
import { totalMemoryStrengthByTags } from './expandedHelpers'

// Phase 38 §38.13 — Arc escalation pressure.

const RISING_ARC_PER_INTENSITY = 0.4
const ACTIVE_ARC_PER_INTENSITY = 0.5
const CLIMAX_ARC_PER_INTENSITY = 0.7
const IGNORED_WARNING_MEMORY_DIVISOR = 8
const FAILED_PREP_MEMORY_DIVISOR = 8
const RELATED_PRESSURE_DIVISOR = 10

export function calculateArcEscalation(
  ctx: SimContext,
): PressureCalculationResult {
  const causes: PressureCauseRef[] = []
  const relatedActors: EntityRef[] = []
  const risingActors: EntityRef[] = []
  const activeActors: EntityRef[] = []
  const climaxActors: EntityRef[] = []

  let risingIntensity = 0
  let activeIntensity = 0
  let climaxIntensity = 0
  for (const event of Object.values(ctx.state.world.localEvents)) {
    if (!event.stage) continue
    if (event.stage === 'resolved' || event.stage === 'failed') continue
    const ref: EntityRef = { kind: 'local_event', id: event.id }
    relatedActors.push(ref)
    if (event.stage === 'rising') {
      risingIntensity += event.intensity
      risingActors.push(ref)
    }
    if (event.stage === 'active') {
      activeIntensity += event.intensity
      activeActors.push(ref)
    }
    if (event.stage === 'climax') {
      climaxIntensity += event.intensity
      climaxActors.push(ref)
    }
  }
  if (risingIntensity > 0) {
    pushCause(causes, {
      id: 'rising_arcs',
      readable: `Rising arc intensity ${risingIntensity}.`,
      amount: Math.round(risingIntensity * RISING_ARC_PER_INTENSITY),
      tags: ['arc', 'rising'],
      relatedActors: risingActors,
      relatedSystems: ['localArcs'],
    })
  }
  if (activeIntensity > 0) {
    pushCause(causes, {
      id: 'active_arcs',
      readable: `Active arc intensity ${activeIntensity}.`,
      amount: Math.round(activeIntensity * ACTIVE_ARC_PER_INTENSITY),
      tags: ['arc', 'active'],
      relatedActors: activeActors,
      relatedSystems: ['localArcs'],
    })
  }
  if (climaxIntensity > 0) {
    pushCause(causes, {
      id: 'climax_arcs',
      readable: `Climax arc intensity ${climaxIntensity}.`,
      amount: Math.round(climaxIntensity * CLIMAX_ARC_PER_INTENSITY),
      tags: ['arc', 'climax'],
      relatedActors: climaxActors,
      relatedSystems: ['localArcs'],
    })
  }

  const ignoredWarnings = totalMemoryStrengthByTags(ctx, ['ignored_warning'])
  if (ignoredWarnings >= 20) {
    pushCause(causes, {
      id: 'ignored_warnings',
      readable: `Ignored-warning memories (strength ${Math.round(ignoredWarnings)}).`,
      amount: Math.round(ignoredWarnings / IGNORED_WARNING_MEMORY_DIVISOR),
      tags: ['memory', 'arc'],
      relatedSystems: ['memories', 'localArcs'],
    })
  }

  const failedPrep = totalMemoryStrengthByTags(ctx, ['failed_preparation'])
  if (failedPrep >= 20) {
    pushCause(causes, {
      id: 'failed_preparation',
      readable: `Failed-preparation memories (strength ${Math.round(failedPrep)}).`,
      amount: Math.round(failedPrep / FAILED_PREP_MEMORY_DIVISOR),
      tags: ['memory', 'arc', 'preparation'],
      relatedSystems: ['memories'],
    })
  }

  // Related-pressure bleed-in (festival readiness, rival pressure, faction
  // anger): if any are high they accelerate arc escalation.
  for (const id of [
    'festival_readiness',
    'rival_tavern_pressure',
    'faction_anger',
    'cultural_tension',
  ]) {
    const p = ctx.state.pressures[id]
    if (p && p.value >= 40) {
      pushCause(causes, {
        id: `bleed_${id}`,
        readable: `${p.label} (${p.value}) feeds arc escalation.`,
        amount: Math.round(p.value / RELATED_PRESSURE_DIVISOR),
        tags: ['arc', 'web'],
        relatedSystems: ['pressures', 'localArcs'],
      })
    }
  }

  const value = combineToValue(0, causes)
  const severity = severityFromValue(value)
  const urgency = urgencyFromSeverity(severity, climaxIntensity > 0 ? 10 : 0)

  return {
    value,
    severity,
    urgency,
    causes,
    relatedActors,
    relatedSystems: ['localArcs', 'memories', 'pressures'],
    tags: ['arc'],
    consequences:
      severity >= 40
        ? [
            'Arc-specific issue seeds become more likely.',
            'Seasonal crises may escalate.',
            'Local event consequences may follow.',
            'Rival/supplier/faction pressures may jump.',
          ]
        : [],
  }
}
