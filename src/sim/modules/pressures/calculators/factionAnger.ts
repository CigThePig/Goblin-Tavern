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
  gratitudeStrengthAgainst,
  memoryStrengthAboutByTags,
  memoryStrengthForOwnerByTags,
  publicBlameStrengthAgainst,
} from './expandedHelpers'

// Phase 38 §38.6 — Faction anger pressure.

const FACTION_RELATIONSHIP_FLOOR = 40
const FACTION_RELATIONSHIP_AMOUNT = 8
const FACTION_FEAR_FLOOR = 45
const FACTION_FEAR_AMOUNT = 6
const INDIVIDUAL_FACTION_STRAIN_FLOOR = 30
const INDIVIDUAL_FACTION_FEAR_FLOOR = 60
const INDIVIDUAL_FACTION_STRAIN_AMOUNT = 28
const GRUDGE_MEMORY_DIVISOR = 8
const PUBLIC_BLAME_DIVISOR = 8
const POLICY_BACKLASH_DIVISOR = 10
const FACTION_ARC_PER_ARC = 12
const FACTION_EVENT_RELIEF_DIVISOR = 10
const GRATITUDE_RELIEF_DIVISOR = 10

export function calculateFactionAnger(
  ctx: SimContext,
): PressureCalculationResult {
  const causes: PressureCauseRef[] = []
  const relatedActors: EntityRef[] = []
  const seen = new Set<string>()
  const pushActor = (ref: EntityRef) => {
    const key = `${ref.kind}:${ref.id}`
    if (seen.has(key)) return
    seen.add(key)
    relatedActors.push(ref)
  }

  const factions = Object.values(ctx.state.world.factions)

  if (factions.length > 0) {
    let inverseSum = 0
    let highFearSum = 0
    for (const faction of factions) {
      inverseSum += 100 - faction.relationship
      highFearSum += faction.fear
    }
    const avgRelationship = 100 - inverseSum / factions.length
    if (avgRelationship < FACTION_RELATIONSHIP_FLOOR) {
      pushCause(causes, {
        id: 'avg_faction_cautious',
        readable: `Factions are cautious toward the tavern (avg relationship ${Math.round(avgRelationship)}).`,
        amount: FACTION_RELATIONSHIP_AMOUNT,
        tags: ['faction', 'relationship'],
        relatedSystems: ['factions'],
        origin: 'discovered',
      })
    }
    const avgFear = highFearSum / factions.length
    if (avgFear >= FACTION_FEAR_FLOOR) {
      pushCause(causes, {
        id: 'avg_faction_fear',
        readable: `Faction fear is high in town (avg fear ${Math.round(avgFear)}).`,
        amount: FACTION_FEAR_AMOUNT,
        tags: ['faction', 'fear'],
        relatedSystems: ['factions'],
        origin: 'external',
      })
    }
    const strained = factions.filter(
      (faction) =>
        faction.relationship <= INDIVIDUAL_FACTION_STRAIN_FLOOR ||
        faction.fear >= INDIVIDUAL_FACTION_FEAR_FLOOR,
    )
    if (strained.length > 0) {
      pushCause(causes, {
        id: 'individual_faction_strain',
        readable: `${strained.length} faction(s) are under visible strain.`,
        amount: INDIVIDUAL_FACTION_STRAIN_AMOUNT * strained.length,
        tags: ['faction', 'relationship'],
        relatedActors: strained.map((faction) => ({ kind: 'faction', id: faction.id })),
        relatedSystems: ['factions'],
        origin: 'discovered',
      })
    }
  }

  for (const faction of factions) {
    const ref: EntityRef = { kind: 'faction', id: faction.id }
    const grudgeMem = memoryStrengthForOwnerByTags(ctx, ref, ['grudge'])
    if (grudgeMem >= 25) {
      pushActor(ref)
      pushCause(causes, {
        id: `grudge_${faction.id}`,
        readable: `${faction.label} carries grudges (strength ${Math.round(grudgeMem)}).`,
        amount: Math.round(grudgeMem / GRUDGE_MEMORY_DIVISOR),
        tags: ['faction', 'grudge', 'memory'],
        relatedActors: [ref],
        origin: 'player_caused',
        relatedSystems: ['factions', 'memories'],
      })
    }
    const blame = publicBlameStrengthAgainst(ctx.state, ref)
    if (blame >= 25) {
      pushActor(ref)
      pushCause(causes, {
        id: `blame_${faction.id}`,
        readable: `${faction.label} carries blame attributions (strength ${Math.round(blame)}).`,
        amount: Math.round(blame / PUBLIC_BLAME_DIVISOR),
        tags: ['faction', 'blame', 'attribution'],
        relatedActors: [ref],
        origin: 'discovered',
        relatedSystems: ['factions', 'attribution'],
      })
    }
    const hostedEvent = memoryStrengthAboutByTags(ctx, ref, ['hosted_event'])
    const honouredDiscount = memoryStrengthAboutByTags(ctx, ref, ['honoured_discount'])
    const gratitude = gratitudeStrengthAgainst(ctx.state, ref)
    const eventRelief = hostedEvent + honouredDiscount
    const grTotal = eventRelief + gratitude
    if (grTotal >= 25) {
      pushActor(ref)
      pushCause(causes, {
        id: `relief_${faction.id}`,
        readable: `${faction.label} feels honoured (relief ${Math.round(grTotal)}).`,
        amount: -Math.round(
          eventRelief / FACTION_EVENT_RELIEF_DIVISOR +
            gratitude / GRATITUDE_RELIEF_DIVISOR,
        ),
        tags: ['faction', 'relief'],
        relatedActors: [ref],
        origin: 'memory',
        relatedSystems: ['factions', 'memories'],
      })
    }
  }

  // Policy backlash bleed-in.
  const backlash = ctx.state.pressures['policy_backlash']
  if (backlash && backlash.value >= 35) {
    pushCause(causes, {
      id: 'policy_backlash_bleed',
      readable: `Policy backlash (${backlash.value}) angers factions.`,
      amount: Math.round(backlash.value / POLICY_BACKLASH_DIVISOR),
      tags: ['faction', 'policy', 'web'],
      relatedSystems: ['policies', 'pressures'],
      origin: 'player_caused',
    })
  }

  // Active faction-tension arcs.
  const arcs = activeArcsByTypeOrTag(ctx.state, {
    types: ['faction_tension'],
    tags: ['faction'],
  })
  if (arcs.length > 0) {
    pushCause(causes, {
      id: 'active_faction_arc',
      readable: `${arcs.length} active faction-tension arc(s).`,
      amount: FACTION_ARC_PER_ARC * arcs.length,
      tags: ['faction', 'arc'],
      relatedActors: arcs.map((arc) => ({ kind: 'local_event', id: arc.id })),
      origin: 'external',
      relatedSystems: ['localArcs', 'factions'],
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
    relatedSystems: ['factions', 'memories', 'attribution', 'localArcs'],
    tags: ['faction', 'social'],
    consequences:
      severity >= 50
        ? [
            'Faction demands may surface.',
            'Boycotts or brawls become more likely.',
            'Angry factions may tip off inspectors.',
          ]
        : [],
  }
}
