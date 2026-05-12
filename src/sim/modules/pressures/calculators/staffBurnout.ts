import type { SimContext } from '../../../core/context'
import type { PressureCalculationResult, PressureCauseRef } from '../pressureTypes'
import type { EntityRef } from '../../../state/TavernState'
import {
  combineToValue,
  pushCause,
  severityFromValue,
  urgencyFromSeverity,
} from './helpers'

// Phase 18 §18.4 — Staff burnout pressure.
//
// Inputs:
//   - average staff stress, fatigue, low morale
//   - unpaid wages (this week and recent memory)
//   - traffic intensity
//   - repeated heavy weeks (pattern memory)

const STRESS_HIGH_PER_STAFF = 12
const FATIGUE_HIGH_PER_STAFF = 10
const LOW_MORALE_PER_STAFF = 8
const UNPAID_WAGES_THIS_WEEK = 14
const UNPAID_WAGES_MEMORY = 10
const REPEATED_UNPAID = 18
const HEAVY_TRAFFIC = 6
const MORALE_RELIEF = -8

export function calculateStaffBurnout(ctx: SimContext): PressureCalculationResult {
  const causes: PressureCauseRef[] = []
  const actors: EntityRef[] = []

  let unpaidCount = 0
  for (const member of Object.values(ctx.state.staff)) {
    if (!member.paidThisWeek) unpaidCount += 1
    if (member.stress >= 65) {
      actors.push({ kind: 'staff', id: member.id })
      pushCause(causes, {
        id: `stress_${member.id}`,
        readable: `${member.name.display} is stressed (${member.stress}).`,
        amount: STRESS_HIGH_PER_STAFF,
        tags: ['staff', 'stress'],
        relatedActors: [{ kind: 'staff', id: member.id }],
        relatedSystems: ['staff'],
      })
    }
    if (member.fatigue >= 65) {
      actors.push({ kind: 'staff', id: member.id })
      pushCause(causes, {
        id: `fatigue_${member.id}`,
        readable: `${member.name.display} is fatigued (${member.fatigue}).`,
        amount: FATIGUE_HIGH_PER_STAFF,
        tags: ['staff', 'fatigue'],
        relatedActors: [{ kind: 'staff', id: member.id }],
        relatedSystems: ['staff'],
      })
    }
    if (member.morale <= 30) {
      pushCause(causes, {
        id: `morale_${member.id}`,
        readable: `${member.name.display} morale low (${member.morale}).`,
        amount: LOW_MORALE_PER_STAFF,
        tags: ['staff', 'morale'],
        relatedActors: [{ kind: 'staff', id: member.id }],
        relatedSystems: ['staff'],
      })
    }
    if (member.morale >= 70 && member.stress <= 40 && member.fatigue <= 40) {
      pushCause(causes, {
        id: `morale_relief_${member.id}`,
        readable: `${member.name.display} is in good shape (morale ${member.morale}).`,
        amount: MORALE_RELIEF,
        tags: ['staff', 'morale'],
        relatedActors: [{ kind: 'staff', id: member.id }],
        relatedSystems: ['staff'],
      })
    }
  }

  if (unpaidCount > 0) {
    pushCause(causes, {
      id: 'unpaid_wages',
      readable: `${unpaidCount} staff with unpaid wages this week.`,
      amount: UNPAID_WAGES_THIS_WEEK,
      tags: ['staff', 'wages', 'unpaid'],
      relatedSystems: ['staff', 'weekly'],
    })
  }

  if (ctx.hasMemory('wages_unpaid_recently')) {
    pushCause(causes, {
      id: 'wages_unpaid_memory',
      readable: 'Unpaid wages remembered recently.',
      amount: UNPAID_WAGES_MEMORY,
      tags: ['memory', 'wages'],
      relatedSystems: ['memories', 'staff'],
    })
  }
  if (ctx.hasMemory('repeated_unpaid_wages')) {
    pushCause(causes, {
      id: 'repeated_unpaid',
      readable: 'Pattern of repeated unpaid wages.',
      amount: REPEATED_UNPAID,
      tags: ['pattern', 'wages'],
      relatedSystems: ['memories', 'staff'],
    })
  }

  // "Heavy traffic" proxy: count customer groups with very high patronage.
  let heavyGroups = 0
  for (const group of Object.values(ctx.state.customerGroups)) {
    if (group.patronage >= 75) heavyGroups += 1
  }
  if (heavyGroups >= 2) {
    pushCause(causes, {
      id: 'heavy_traffic',
      readable: `${heavyGroups} customer groups at high patronage.`,
      amount: HEAVY_TRAFFIC * heavyGroups,
      tags: ['traffic'],
      relatedSystems: ['customers'],
    })
  }

  const value = combineToValue(0, causes)
  const severity = severityFromValue(value)
  const urgency = urgencyFromSeverity(severity, unpaidCount > 0 ? 5 : 0)

  return {
    value,
    severity,
    urgency,
    causes,
    relatedActors: actors,
    relatedSystems: ['staff', 'weekly'],
    tags: ['staff', 'burnout'],
    consequences:
      severity >= 60
        ? [
            'Service speed will degrade.',
            'Staff may quit if wages keep slipping.',
          ]
        : [],
  }
}
