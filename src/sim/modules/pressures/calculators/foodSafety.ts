import type { SimContext } from '../../../core/context'
import type { PressureCalculationResult, PressureCauseRef } from '../pressureTypes'
import type { EntityRef } from '../../../state/TavernState'
import {
  combineToValue,
  pushCause,
  severityFromValue,
  urgencyFromSeverity,
} from './helpers'

// Phase 18 §18.2 — Food safety pressure.
//
// Inputs:
//   - kitchen cleanliness
//   - kitchen smell
//   - stew & mushroom spoilage
//   - cook stress / fatigue
//   - recent food/cellar memories
//
// The calculator combines weighted contributions; the dominant
// contribution surfaces first.

const KITCHEN_FILTHY_HEAVY = 22
const KITCHEN_FILTHY_LIGHT = 10
const KITCHEN_SMELL_HEAVY = 12
const KITCHEN_SMELL_LIGHT = 5
const STEW_SPOIL_HEAVY = 18
const STEW_SPOIL_LIGHT = 8
const MUSHROOM_SPOIL = 10
const COOK_STRESSED = 8
const COOK_FATIGUED = 6
const KITCHEN_CLEAN = -10
const MEMORY_BOOST = 10

export function calculateFoodSafety(ctx: SimContext): PressureCalculationResult {
  const causes: PressureCauseRef[] = []
  const actors: EntityRef[] = []
  const locations: EntityRef[] = []

  const kitchen = ctx.state.areas['kitchen']
  if (kitchen) {
    locations.push({ kind: 'area', id: kitchen.id })
    if (kitchen.cleanliness <= 30) {
      pushCause(causes, {
        id: 'kitchen_filthy_heavy',
        readable: `Kitchen cleanliness very low (${kitchen.cleanliness}).`,
        amount: KITCHEN_FILTHY_HEAVY,
        tags: ['kitchen', 'cleanliness'],
        relatedLocations: [{ kind: 'area', id: kitchen.id }],
        relatedSystems: ['areas'],
      })
    } else if (kitchen.cleanliness <= 50) {
      pushCause(causes, {
        id: 'kitchen_filthy_light',
        readable: `Kitchen cleanliness slipping (${kitchen.cleanliness}).`,
        amount: KITCHEN_FILTHY_LIGHT,
        tags: ['kitchen', 'cleanliness'],
        relatedLocations: [{ kind: 'area', id: kitchen.id }],
        relatedSystems: ['areas'],
      })
    } else if (kitchen.cleanliness >= 75) {
      pushCause(causes, {
        id: 'kitchen_clean',
        readable: `Kitchen is clean (${kitchen.cleanliness}).`,
        amount: KITCHEN_CLEAN,
        tags: ['kitchen', 'cleanliness'],
        relatedLocations: [{ kind: 'area', id: kitchen.id }],
        relatedSystems: ['areas'],
      })
    }
    if (kitchen.smell >= 70) {
      pushCause(causes, {
        id: 'kitchen_smell_heavy',
        readable: `Kitchen smell heavy (${kitchen.smell}).`,
        amount: KITCHEN_SMELL_HEAVY,
        tags: ['kitchen', 'smell'],
        relatedLocations: [{ kind: 'area', id: kitchen.id }],
        relatedSystems: ['areas'],
      })
    } else if (kitchen.smell >= 55) {
      pushCause(causes, {
        id: 'kitchen_smell_light',
        readable: `Kitchen smell elevated (${kitchen.smell}).`,
        amount: KITCHEN_SMELL_LIGHT,
        tags: ['kitchen', 'smell'],
        relatedLocations: [{ kind: 'area', id: kitchen.id }],
        relatedSystems: ['areas'],
      })
    }
  }

  const stew = ctx.state.stock['stew']
  if (stew) {
    if (stew.spoilage >= 60) {
      pushCause(causes, {
        id: 'stew_spoiled_heavy',
        readable: `Stew spoilage high (${stew.spoilage}).`,
        amount: STEW_SPOIL_HEAVY,
        tags: ['stock', 'stew', 'spoilage'],
        relatedSystems: ['stock'],
      })
    } else if (stew.spoilage >= 40) {
      pushCause(causes, {
        id: 'stew_spoiled_light',
        readable: `Stew spoilage elevated (${stew.spoilage}).`,
        amount: STEW_SPOIL_LIGHT,
        tags: ['stock', 'stew', 'spoilage'],
        relatedSystems: ['stock'],
      })
    }
  }

  const mushrooms = ctx.state.stock['mushrooms']
  if (mushrooms && mushrooms.spoilage >= 50) {
    pushCause(causes, {
      id: 'mushrooms_spoiled',
      readable: `Mushroom spoilage high (${mushrooms.spoilage}).`,
      amount: MUSHROOM_SPOIL,
      tags: ['stock', 'mushrooms', 'spoilage'],
      relatedSystems: ['stock'],
    })
  }

  for (const member of Object.values(ctx.state.staff)) {
    if (member.role !== 'cook') continue
    actors.push({ kind: 'staff', id: member.id })
    if (member.stress >= 70) {
      pushCause(causes, {
        id: `cook_stressed_${member.id}`,
        readable: `Cook stress high (${member.stress}).`,
        amount: COOK_STRESSED,
        tags: ['staff', 'cook', 'stress'],
        relatedActors: [{ kind: 'staff', id: member.id }],
        relatedSystems: ['staff'],
      })
    }
    if (member.fatigue >= 70) {
      pushCause(causes, {
        id: `cook_fatigued_${member.id}`,
        readable: `Cook fatigue high (${member.fatigue}).`,
        amount: COOK_FATIGUED,
        tags: ['staff', 'cook', 'fatigue'],
        relatedActors: [{ kind: 'staff', id: member.id }],
        relatedSystems: ['staff'],
      })
    }
  }

  if (
    ctx.hasMemory('food_poisoning_rumor_possible') ||
    ctx.getMemoriesByTag('food_safety').length > 0
  ) {
    pushCause(causes, {
      id: 'food_safety_memory',
      readable: 'Recent food-safety memories are pushing the pressure up.',
      amount: MEMORY_BOOST,
      tags: ['memory', 'food_safety'],
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
    relatedActors: actors,
    relatedLocations: locations,
    relatedSystems: ['stock', 'areas', 'staff'],
    tags: ['food', 'kitchen', 'risk'],
    consequences:
      severity >= 60
        ? [
            'Customers may fall ill if pressure keeps climbing.',
            'Inspection pressure will rise.',
          ]
        : [],
  }
}
