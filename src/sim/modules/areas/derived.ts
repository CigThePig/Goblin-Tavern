import type { AreaState } from '../../state/TavernState'
import { getAreaTraitDefinition } from '../../content/tavern/areaTraitRegistry'
import { getAreaUpgradeDefinition } from '../../content/tavern/areaUpgradeRegistry'
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

// Phase 28 §28.6 — Trait, atmosphere, and upgrade lookups.
//
// Modules that want to ask "does this area have trait X" or "is upgrade
// Y installed here" should go through these helpers rather than poking
// the arrays directly. Centralising the lookups keeps trait/upgrade
// semantics in one place once later phases start adding behaviour.

export function hasAreaTrait(area: AreaState, traitId: string): boolean {
  return area.traits.includes(traitId)
}

export function hasAreaAtmosphere(area: AreaState, tag: string): boolean {
  return area.atmosphere.includes(tag)
}

export function hasInstalledUpgrade(area: AreaState, upgradeId: string): boolean {
  const upgrade = area.upgrades[upgradeId]
  return !!upgrade && upgrade.status === 'installed'
}

export function getInstalledUpgradeIds(area: AreaState): string[] {
  const ids: string[] = []
  for (const upgrade of Object.values(area.upgrades)) {
    if (upgrade.status === 'installed') ids.push(upgrade.id)
  }
  return ids
}

// Phase 28 §28.6 — `getAreaMechanicalTags` is the single place reports,
// satisfaction, issue seeds, and pressure calculators ask what an area
// "means" mechanically. It unions the room's own tags, the mechanical
// tags from each installed trait, the tags from each installed upgrade,
// and the current `activeProblems` strings. Duplicates are stripped so
// downstream callers can do a simple `.includes()` check.
export function getAreaMechanicalTags(area: AreaState): string[] {
  const tags = new Set<string>()
  for (const t of area.tags) tags.add(t)
  for (const traitId of area.traits) {
    const def = getAreaTraitDefinition(traitId)
    if (!def) continue
    for (const t of def.mechanicalTags) tags.add(t)
    if (def.tags) {
      for (const t of def.tags) tags.add(t)
    }
  }
  for (const upgrade of Object.values(area.upgrades)) {
    if (upgrade.status !== 'installed') continue
    for (const t of upgrade.tags) tags.add(t)
    const def = getAreaUpgradeDefinition(upgrade.id)
    if (def) {
      for (const t of def.tags) tags.add(t)
    }
  }
  for (const problem of area.activeProblems) tags.add(problem)
  return [...tags]
}

// Phase 28 §28.6 — A compact, human-readable summary of the atmosphere
// tags plus installed trait labels. Used by area reports so they can
// show "Main Room: rough, sticky floor, dangerous corner." without each
// caller re-implementing the join logic.
export function describeAreaAtmosphere(area: AreaState): string[] {
  const parts: string[] = []
  for (const tag of area.atmosphere) parts.push(tag)
  for (const traitId of area.traits) {
    const def = getAreaTraitDefinition(traitId)
    parts.push(def?.label.toLowerCase() ?? traitId)
  }
  return parts
}
