import type { SimContext } from '../../../core/context'
import type { EntityRef } from '../../../state/TavernState'
import type { PressureCalculationResult, PressureCauseRef } from '../pressureTypes'

import {
  combineToValue,
  pushCause,
  severityFromValue,
  urgencyFromSeverity,
} from './helpers'
import { activeArcsByTypeOrTag, ownerProjects } from './expandedHelpers'

// Phase 38 §38.8 — Rival tavern pressure.

const RIVAL_ARC_PER_INTENSITY = 0.6
const REPUTATION_DRIFT_DIVISOR = 8
const REGULAR_LOSS_DIVISOR = 7
const PUBLIC_RUMOUR_DIVISOR = 12
const COMPLETED_PROJECT_RELIEF = -6
const IDENTITY_RELIEF_DIVISOR = 8

export function calculateRivalTavernPressure(
  ctx: SimContext,
): PressureCalculationResult {
  const causes: PressureCauseRef[] = []
  const relatedActors: EntityRef[] = []

  const arcs = activeArcsByTypeOrTag(ctx.state, {
    types: ['rival', 'rival_tavern_expansion'],
    tags: ['rival'],
  })
  let arcIntensity = 0
  for (const arc of arcs) {
    arcIntensity += arc.intensity
    relatedActors.push({ kind: 'local_event', id: arc.id })
  }
  if (arcs.length > 0) {
    pushCause(causes, {
      id: 'rival_arc_active',
      readable: `${arcs.length} rival arc(s) active (intensity ${arcIntensity}).`,
      amount: Math.round(arcIntensity * RIVAL_ARC_PER_INTENSITY),
      tags: ['rival', 'arc'],
      relatedSystems: ['localArcs'],
    })
  }

  const reputationDrift = ctx.state.pressures['reputation_drift']
  if (reputationDrift && reputationDrift.value >= 35) {
    pushCause(causes, {
      id: 'reputation_drift_bleed',
      readable: `Reputation drift (${reputationDrift.value}) makes the rival look attractive.`,
      amount: Math.round(reputationDrift.value / REPUTATION_DRIFT_DIVISOR),
      tags: ['reputation', 'web'],
      relatedSystems: ['reputation', 'pressures'],
    })
  }

  const regularLoss = ctx.state.pressures['regular_customer_loss']
  if (regularLoss && regularLoss.value >= 35) {
    pushCause(causes, {
      id: 'regular_loss_bleed',
      readable: `Regular customer loss (${regularLoss.value}) lifts the rival.`,
      amount: Math.round(regularLoss.value / REGULAR_LOSS_DIVISOR),
      tags: ['regulars', 'web'],
      relatedSystems: ['regulars', 'pressures'],
    })
  }

  // Public rumours crediting the rival or blaming the tavern.
  let rivalRumourScore = 0
  for (const rumour of Object.values(ctx.state.world.socialRumours)) {
    if (rumour.tags.includes('rival') || rumour.tags.includes('competition')) {
      rivalRumourScore += rumour.strength
    }
  }
  if (rivalRumourScore >= 20) {
    pushCause(causes, {
      id: 'rival_rumours',
      readable: `Rumours crediting the rival (strength ${rivalRumourScore}).`,
      amount: Math.round(rivalRumourScore / PUBLIC_RUMOUR_DIVISOR),
      tags: ['rumour', 'rival'],
      relatedSystems: ['rumours'],
    })
  }

  // Completed projects/strong tavern identity provide relief.
  let completedProjects = 0
  for (const project of Object.values(ownerProjects(ctx.state))) {
    if (project.status === 'completed') completedProjects += 1
  }
  if (completedProjects > 0) {
    pushCause(causes, {
      id: 'completed_projects_relief',
      readable: `${completedProjects} completed owner project(s) bolster identity.`,
      amount: COMPLETED_PROJECT_RELIEF * completedProjects,
      tags: ['project', 'identity'],
      relatedSystems: ['ownerActions'],
    })
  }
  const identityKnownFor = ctx.state.world.tavernIdentity.knownFor.length
  if (identityKnownFor >= 2) {
    pushCause(causes, {
      id: 'identity_relief',
      readable: `Tavern is known for ${identityKnownFor} thing(s).`,
      amount: -Math.round((identityKnownFor * 10) / IDENTITY_RELIEF_DIVISOR),
      tags: ['identity', 'relief'],
      relatedSystems: ['tavernIdentity'],
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
    relatedActors,
    relatedSystems: ['localArcs', 'reputation', 'regulars', 'rumours', 'tavernIdentity'],
    tags: ['rival', 'market', 'social'],
    consequences:
      severity >= 50
        ? [
            'Rival offer seeds become likely.',
            'Regular defection seeds may appear.',
            'Price pressure may follow.',
            'A rebrand or signature event may be needed.',
          ]
        : [],
  }
}
