import type { SimContext } from '../../../core/context'
import type { PressureCalculationResult, PressureCauseRef } from '../pressureTypes'
import type { EntityRef } from '../../../state/TavernState'
import {
  combineToValue,
  pushCause,
  severityFromValue,
  urgencyFromSeverity,
} from './helpers'

// Phase 18 §18.8 — Violence pressure.
//
// Inputs:
//   - rowdy/dangerous customer patronage (ogres, adventurers)
//   - Brawl Night incidents (day type signal)
//   - recent brawls (memory)
//   - dangerous reputation
//   - bouncer effectiveness (negative contribution if present)

const ROWDY_PATRON_HEAVY = 14
const ROWDY_PATRON_LIGHT = 6
const HIGH_ROWDINESS = 10
const BRAWL_NIGHT_TODAY = 12
const RECENT_BRAWL = 18
const DANGEROUS_REP = 8
const BOUNCER_RELIEF = -10

export function calculateViolence(ctx: SimContext): PressureCalculationResult {
  const causes: PressureCauseRef[] = []
  const actors: EntityRef[] = []

  const ogres = ctx.state.customerGroups['ogres']
  if (ogres) {
    if (ogres.patronage >= 65) {
      actors.push({ kind: 'customer_group', id: ogres.id })
      pushCause(causes, {
        id: 'ogres_heavy',
        readable: `Ogre patronage heavy (${ogres.patronage}).`,
        amount: ROWDY_PATRON_HEAVY,
        tags: ['customer', 'ogres'],
        relatedActors: [{ kind: 'customer_group', id: ogres.id }],
        origin: 'external',
        relatedSystems: ['customers'],
      })
    } else if (ogres.patronage >= 40) {
      pushCause(causes, {
        id: 'ogres_light',
        readable: `Ogres present (${ogres.patronage}).`,
        amount: ROWDY_PATRON_LIGHT,
        tags: ['customer', 'ogres'],
        relatedActors: [{ kind: 'customer_group', id: ogres.id }],
        origin: 'external',
        relatedSystems: ['customers'],
      })
    }
    if (ogres.rowdiness >= 75) {
      pushCause(causes, {
        id: 'ogres_rowdy',
        readable: `Ogres rowdy (${ogres.rowdiness}).`,
        amount: HIGH_ROWDINESS,
        tags: ['customer', 'rowdiness'],
        relatedActors: [{ kind: 'customer_group', id: ogres.id }],
        origin: 'external',
        relatedSystems: ['customers'],
      })
    }
  }

  const adventurers = ctx.state.customerGroups['adventurers']
  if (adventurers && adventurers.patronage >= 55) {
    pushCause(causes, {
      id: 'adventurers_present',
      readable: `Adventurers in the room (${adventurers.patronage}).`,
      amount: ROWDY_PATRON_LIGHT,
      tags: ['customer', 'adventurers'],
      relatedActors: [{ kind: 'customer_group', id: adventurers.id }],
      origin: 'external',
      relatedSystems: ['customers'],
    })
  }

  if (ctx.getDayType() === 'brawl_night') {
    pushCause(causes, {
      id: 'brawl_night',
      readable: 'Brawl Night today — incident risk spikes.',
      amount: BRAWL_NIGHT_TODAY,
      tags: ['day_type', 'brawl_night'],
      relatedSystems: ['calendar', 'service'],
      origin: 'external',
    })
  }

  if (ctx.hasMemory('recent_brawl')) {
    const strength = ctx.getMemoryStrength('recent_brawl')
    pushCause(causes, {
      id: 'recent_brawl',
      readable: `Recent brawl still in memory (strength ${Math.round(strength)}).`,
      amount: Math.min(RECENT_BRAWL, Math.round(strength / 3) + 8),
      tags: ['memory', 'brawl'],
      relatedSystems: ['memories', 'service'],
      origin: 'memory',
    })
  }

  if (ctx.state.reputation.dangerous >= 60) {
    pushCause(causes, {
      id: 'dangerous_reputation',
      readable: `Dangerous reputation (${ctx.state.reputation.dangerous}).`,
      amount: DANGEROUS_REP,
      tags: ['reputation', 'dangerous'],
      relatedSystems: ['reputation'],
      origin: 'memory',
    })
  }

  // Bouncer effectiveness as relief — if any cleaner_bouncer staff exist
  // with the keep_peace priority or just generally high skill.
  for (const member of Object.values(ctx.state.staff)) {
    if (member.role !== 'cleaner_bouncer') continue
    if (member.currentPriority === 'keep_peace' || member.skill >= 60) {
      pushCause(causes, {
        id: `bouncer_${member.id}`,
        readable: `${member.name.display} keeping order (skill ${member.skill}).`,
        amount: BOUNCER_RELIEF,
        tags: ['staff', 'bouncer'],
        relatedActors: [{ kind: 'staff', id: member.id }],
        origin: 'player_caused',
        relatedSystems: ['staff'],
      })
    }
  }

  const value = combineToValue(0, causes)
  const severity = severityFromValue(value)
  const urgency = urgencyFromSeverity(
    severity,
    ctx.getDayType() === 'brawl_night' ? 8 : 0,
  )

  return {
    value,
    severity,
    urgency,
    causes,
    relatedActors: actors,
    relatedSystems: ['service', 'customers'],
    tags: ['violence', 'service'],
    consequences:
      severity >= 60
        ? [
            'Brawls become likely.',
            'Main room damage will rise.',
          ]
        : [],
  }
}
