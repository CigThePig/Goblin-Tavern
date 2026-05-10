import type { AreaState } from '../../state/TavernState'
import type { AreaQualityBand } from './types'

// Phase 8 §8.4 — Derived area conditions.
//
// Threshold helpers used by reports, customer satisfaction, and (later)
// issue seed generators. Centralising them keeps the "what counts as
// filthy" rule in one place.

export function isAreaFilthy(area: AreaState): boolean {
  return area.cleanliness < 35 || area.mess > 65
}

export function isAreaDamaged(area: AreaState): boolean {
  return area.damage > 50 || area.condition < 35
}

export function isAreaDangerous(area: AreaState): boolean {
  return area.risk > 60
}

export function isAreaInspectionRisk(area: AreaState): boolean {
  if (!area.tags.includes('inspection_relevant')) return false
  return (
    isAreaFilthy(area) ||
    isAreaDamaged(area) ||
    area.smell > 70 ||
    area.risk > 55
  )
}

// Phase 8 §8.4 — `getAreaQualityBand` collapses condition/cleanliness/
// damage into a single readable label. Bands are picked from the worst
// signal: a clean room with broken floors is still "bad".
export function getAreaQualityBand(area: AreaState): AreaQualityBand {
  const score = computeQualityScore(area)
  if (score >= 80) return 'excellent'
  if (score >= 60) return 'good'
  if (score >= 40) return 'rough'
  if (score >= 20) return 'bad'
  return 'critical'
}

function computeQualityScore(area: AreaState): number {
  const cleanComponent = (area.cleanliness + (100 - area.mess)) / 2
  const integrityComponent = (area.condition + (100 - area.damage)) / 2
  const safetyComponent = 100 - area.risk
  return Math.min(cleanComponent, integrityComponent, safetyComponent)
}
