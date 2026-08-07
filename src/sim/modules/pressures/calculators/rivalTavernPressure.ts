import type { SimContext } from '../../../core/context'
import type { EntityRef } from '../../../state/TavernState'
import type { PressureCalculationResult, PressureCauseRef } from '../pressureTypes'

import {
  competitionSummary,
  competitorStandings,
} from '../../rival/appeal'
import { getPrimaryRival, rivalRef } from '../../rival/rivalState'

import {
  combineToValue,
  pushCause,
  severityFromValue,
  urgencyFromSeverity,
} from './helpers'
import { activeArcsByTypeOrTag, ownerProjects } from './expandedHelpers'

// Phase 38 §38.8 — Rival tavern pressure.
//
// Expansion Phase 9 §9.1: "Rival pressure remains a summary of this
// competition." It was not one before — it summarised arcs, reputation
// drift and rumours, which are things that happen NEAR a rival rather than
// things a rival does, because there was no rival record to read. There is
// one now, so the head-to-head leads: how far ahead the other house is with
// each crowd, who it is working, who is backing it, and what is currently
// going wrong for it. The pre-Phase-9 causes are kept below rather than
// replaced — an arc, a bleed of regulars and talk crediting the competition
// are all still real contributors, and dropping them would narrow the
// diagnosis rather than sharpen it.

const RIVAL_ARC_PER_INTENSITY = 0.6
const REPUTATION_DRIFT_DIVISOR = 8
const REGULAR_LOSS_DIVISOR = 7
const PUBLIC_RUMOUR_DIVISOR = 12
const COMPLETED_PROJECT_RELIEF = -6
const IDENTITY_RELIEF_DIVISOR = 8

/** Pressure per 0.1 of mean rival advantage across the customer groups. */
const ADVANTAGE_PER_TENTH = 7
const COURTED_GROUP_PRESSURE = 5
const BACKED_RIVAL_PRESSURE = 6
const RIVAL_SETBACK_RELIEF = -6
const TRUCE_RELIEF = -10

export function calculateRivalTavernPressure(
  ctx: SimContext,
): PressureCalculationResult {
  const causes: PressureCauseRef[] = []
  const relatedActors: EntityRef[] = []

  // Expansion Phase 9 §9.1 — the competition itself, first.
  const rival = getPrimaryRival(ctx.state)
  const summary = competitionSummary(ctx.state)
  if (rival && summary) {
    relatedActors.push(rivalRef(rival.id))
    const standings = competitorStandings(ctx.state)
    const losing = standings.filter((standing) => standing.advantage > 0.05)
    if (summary.meanAdvantage > 0) {
      pushCause(causes, {
        id: 'rival_appeal_advantage',
        readable:
          losing.length > 0
            ? `${rival.name} is out-appealing this house with ${losing.length} crowd(s).`
            : `${rival.name} is edging ahead on appeal.`,
        amount: Math.round(summary.meanAdvantage * 10 * ADVANTAGE_PER_TENTH),
        tags: ['rival', 'market'],
        relatedActors: [rivalRef(rival.id)],
        relatedSystems: ['rival', 'customers'],
      })
    } else if (summary.meanAdvantage < -0.05) {
      pushCause(causes, {
        id: 'house_appeal_advantage',
        readable: `This house still out-appeals ${rival.name}.`,
        amount: Math.round(summary.meanAdvantage * 10 * ADVANTAGE_PER_TENTH),
        tags: ['rival', 'relief'],
        relatedActors: [rivalRef(rival.id)],
        relatedSystems: ['rival', 'customers'],
      })
    }
    if (summary.courtedGroupIds.length > 0) {
      pushCause(causes, {
        id: 'rival_courting',
        readable: `${rival.name} is actively working ${summary.courtedGroupIds.length} crowd(s).`,
        amount: COURTED_GROUP_PRESSURE * summary.courtedGroupIds.length,
        tags: ['rival', 'customers'],
        relatedActors: summary.courtedGroupIds.map((id) => ({
          kind: 'customer_group' as const,
          id,
        })),
        relatedSystems: ['rival', 'customers'],
      })
    }
    if (rival.backingFactionIds.length > 0) {
      pushCause(causes, {
        id: 'rival_backed',
        readable: `${rival.backingFactionIds.length} faction(s) are backing ${rival.name}.`,
        amount: BACKED_RIVAL_PRESSURE * rival.backingFactionIds.length,
        tags: ['rival', 'faction'],
        relatedActors: rival.backingFactionIds.map((id) => ({
          kind: 'faction' as const,
          id,
        })),
        relatedSystems: ['rival', 'factions'],
      })
    }
    if (summary.liveSetbackCount > 0) {
      pushCause(causes, {
        id: 'rival_setbacks',
        readable: `${rival.name} has ${summary.liveSetbackCount} trouble(s) of its own.`,
        amount: RIVAL_SETBACK_RELIEF * summary.liveSetbackCount,
        tags: ['rival', 'relief'],
        relatedActors: [rivalRef(rival.id)],
        relatedSystems: ['rival'],
      })
    }
    if (summary.underTruce) {
      pushCause(causes, {
        id: 'rival_truce',
        readable: `There is an arrangement with ${rival.name}.`,
        amount: TRUCE_RELIEF,
        tags: ['rival', 'relief', 'settlement'],
        relatedActors: [rivalRef(rival.id)],
        relatedSystems: ['rival'],
      })
    }
  }

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
      relatedActors: arcs.map((arc) => ({ kind: 'local_event', id: arc.id })),
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
    relatedSystems: [
      'rival',
      'localArcs',
      'reputation',
      'regulars',
      'rumours',
      'tavernIdentity',
    ],
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
