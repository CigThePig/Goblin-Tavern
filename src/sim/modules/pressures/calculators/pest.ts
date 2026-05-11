import type { SimContext } from '../../../core/context'
import type { PressureCalculationResult, PressureCauseRef } from '../pressureTypes'
import type { EntityRef } from '../../../state/TavernState'
import {
  combineToValue,
  pushCause,
  severityFromValue,
  urgencyFromSeverity,
} from './helpers'

// Phase 18 §18.5 — Pest pressure.
//
// Inputs:
//   - cellar cleanliness / smell / risk
//   - stock spoilage on food items stored in the cellar
//   - kitchen smell as a secondary signal
//   - recent fumigation memory (relief)
//
// Phase 18 explicitly says "if no rat system exists yet, keep this
// generic" — so we work with the existing area & stock state.

const CELLAR_FILTHY_HEAVY = 18
const CELLAR_FILTHY_LIGHT = 8
const CELLAR_SMELL = 10
const CELLAR_RISK = 12
const SPOILED_FOOD_PER_ITEM = 8
const KITCHEN_SMELL_HINT = 5
const FUMIGATION_RELIEF = -12

export function calculatePest(ctx: SimContext): PressureCalculationResult {
  const causes: PressureCauseRef[] = []
  const locations: EntityRef[] = []

  const cellar = ctx.state.areas['cellar']
  if (cellar) {
    locations.push({ kind: 'area', id: cellar.id })
    if (cellar.cleanliness <= 30) {
      pushCause(causes, {
        id: 'cellar_filthy_heavy',
        readable: `Cellar cleanliness very low (${cellar.cleanliness}).`,
        amount: CELLAR_FILTHY_HEAVY,
        tags: ['cellar', 'cleanliness'],
        relatedLocations: [{ kind: 'area', id: cellar.id }],
        relatedSystems: ['areas'],
      })
    } else if (cellar.cleanliness <= 50) {
      pushCause(causes, {
        id: 'cellar_filthy_light',
        readable: `Cellar cleanliness slipping (${cellar.cleanliness}).`,
        amount: CELLAR_FILTHY_LIGHT,
        tags: ['cellar', 'cleanliness'],
        relatedLocations: [{ kind: 'area', id: cellar.id }],
        relatedSystems: ['areas'],
      })
    }
    if (cellar.smell >= 60) {
      pushCause(causes, {
        id: 'cellar_smell',
        readable: `Cellar smell elevated (${cellar.smell}).`,
        amount: CELLAR_SMELL,
        tags: ['cellar', 'smell'],
        relatedLocations: [{ kind: 'area', id: cellar.id }],
        relatedSystems: ['areas'],
      })
    }
    if (cellar.risk >= 55) {
      pushCause(causes, {
        id: 'cellar_risk',
        readable: `Cellar risk elevated (${cellar.risk}).`,
        amount: CELLAR_RISK,
        tags: ['cellar', 'risk'],
        relatedLocations: [{ kind: 'area', id: cellar.id }],
        relatedSystems: ['areas'],
      })
    }
  }

  let spoiledFoodCount = 0
  for (const item of Object.values(ctx.state.stock)) {
    if (item.spoilage >= 50 && item.tags.includes('food')) spoiledFoodCount += 1
  }
  if (spoiledFoodCount > 0) {
    pushCause(causes, {
      id: 'spoiled_food',
      readable: `${spoiledFoodCount} food stock item(s) spoiling.`,
      amount: SPOILED_FOOD_PER_ITEM * spoiledFoodCount,
      tags: ['stock', 'spoilage'],
      relatedSystems: ['stock'],
    })
  }

  const kitchen = ctx.state.areas['kitchen']
  if (kitchen && kitchen.smell >= 65) {
    pushCause(causes, {
      id: 'kitchen_smell_hint',
      readable: `Kitchen smell suggesting pest activity (${kitchen.smell}).`,
      amount: KITCHEN_SMELL_HINT,
      tags: ['kitchen', 'smell'],
      relatedLocations: [{ kind: 'area', id: kitchen.id }],
      relatedSystems: ['areas'],
    })
  }

  if (ctx.hasMemory('cellar_fumigated_recently')) {
    pushCause(causes, {
      id: 'fumigation_relief',
      readable: 'Cellar was fumigated recently.',
      amount: FUMIGATION_RELIEF,
      tags: ['memory', 'cellar', 'sanitation'],
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
    relatedSystems: ['areas', 'stock'],
    tags: ['pests', 'cellar'],
    consequences:
      severity >= 60
        ? [
            'Pest outbreak risk rises.',
            'Inspection pressure may rise.',
          ]
        : [],
  }
}
