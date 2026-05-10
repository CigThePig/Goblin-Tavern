import { z } from 'zod'

import type { SimulationModule, SimulationHook } from '../../core/module'
import type { SimContext } from '../../core/context'
import type { ReportSection } from '../../core/reports'
import type { ValidationIssue } from '../../state/types'
import type { AreaState } from '../../state/TavernState'

import {
  areaRegistry,
  ensureRequiredAreasRegistered,
} from '../../registries/areaRegistry'
import { clampPercent } from '../../state/normalize'
import {
  getAreaQualityBand,
  isAreaDamaged,
  isAreaDangerous,
  isAreaFilthy,
  isAreaInspectionRisk,
} from './derived'

// Phase 8 §8.2 — Area module.
//
// Responsibilities:
//   - Verify the five required areas (`main_room`, `kitchen`, `cellar`,
//     `privy`, `roof`) exist on the current state.
//   - Apply daily passive decay through `ctx.modifyArea` with
//     `meta.source: 'areas'` (Phase 7 §7.3.1). All randomness comes from
//     the seeded `ctx.rng` (Phase 4); the simulation never uses the
//     unseeded global PRNG.
//   - Build the area report section consumed during `generateReports`.
//   - Run a structural validate pass over `state.areas` so impossible
//     shapes surface even when the engine bypasses full schema validation.

const SOURCE = 'areas'

const REQUIRED_AREA_IDS = ['main_room', 'kitchen', 'cellar', 'privy', 'roof'] as const

const startDayHook: SimulationHook = (ctx: SimContext): void => {
  for (const id of REQUIRED_AREA_IDS) {
    if (!ctx.state.areas[id]) {
      throw new Error(`areas module: required area '${id}' is missing from state`)
    }
  }
}

const endDayHook: SimulationHook = (ctx: SimContext): void => {
  applyPassiveDecay(ctx)
}

function applyPassiveDecay(ctx: SimContext): void {
  // Numbers are intentionally small. Phase 8 is about believable movement,
  // not balance — see `phases-06-10.md` §8.3 ("intentionally imperfect").

  const main = ctx.state.areas['main_room']
  if (main) {
    ctx.modifyArea(
      'main_room',
      { cleanliness: clampPercent(main.cleanliness - 1) },
      { source: SOURCE, reason: 'passive_decay' },
    )
  }

  const kitchen = ctx.state.areas['kitchen']
  if (kitchen) {
    const drift = ctx.rng.chance(0.5) ? 2 : 1
    ctx.modifyArea(
      'kitchen',
      { cleanliness: clampPercent(kitchen.cleanliness - drift) },
      { source: SOURCE, reason: 'passive_decay' },
    )
  }

  const privy = ctx.state.areas['privy']
  if (privy) {
    ctx.modifyArea(
      'privy',
      { smell: clampPercent(privy.smell + 1) },
      { source: SOURCE, reason: 'passive_decay' },
    )
  }

  const cellar = ctx.state.areas['cellar']
  if (cellar && cellar.cleanliness < 40) {
    ctx.modifyArea(
      'cellar',
      { risk: clampPercent(cellar.risk + 1) },
      { source: SOURCE, reason: 'pest_drift' },
    )
  }

  const roof = ctx.state.areas['roof']
  if (roof && ctx.rng.chance(0.2)) {
    ctx.modifyArea(
      'roof',
      { condition: clampPercent(roof.condition - 1) },
      { source: SOURCE, reason: 'weather_decay' },
    )
  }
}

function describeStatus(area: AreaState): string {
  if (isAreaInspectionRisk(area)) return 'Inspection risk'
  if (isAreaDamaged(area)) return 'Damaged'
  if (isAreaDangerous(area)) return 'Dangerous'
  if (isAreaFilthy(area)) return 'Filthy'
  return `Quality: ${getAreaQualityBand(area)}`
}

function buildAreaReport(ctx: SimContext): ReportSection {
  const areas = Object.values(ctx.state.areas)
  const lines: string[] = []
  for (const area of areas) {
    lines.push(`${area.label}`)
    lines.push(`  Condition: ${area.condition}`)
    lines.push(`  Cleanliness: ${area.cleanliness}`)
    lines.push(`  Damage: ${area.damage}`)
    lines.push(`  Smell: ${area.smell}`)
    lines.push(`  Risk: ${area.risk}`)
    lines.push(`  Status: ${describeStatus(area)}`)
  }

  let worstArea: AreaState | undefined
  for (const area of areas) {
    if (!worstArea || area.condition < worstArea.condition) {
      worstArea = area
    }
  }
  if (worstArea) {
    lines.push('')
    lines.push(`Worst area: ${worstArea.label} (condition ${worstArea.condition})`)
  }

  return {
    id: 'areas',
    source: SOURCE,
    title: 'AREA REPORT',
    lines,
    data: {
      worstAreaId: worstArea?.id,
      worstAreaCondition: worstArea?.condition,
    },
  }
}

function validateAreas(ctx: SimContext): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  for (const id of REQUIRED_AREA_IDS) {
    if (!ctx.state.areas[id]) {
      issues.push({
        path: `areas.${id}`,
        message: `Required area '${id}' is missing`,
        code: 'missing_required_area',
      })
    }
  }
  return issues
}

// Phase 6 §6.1.1 — the area module currently keeps no namespaced data
// under `state.modules.areas`, but reserves the slot via an empty object
// schema so `safeValidateState` does not warn about an unknown key when
// future phases populate it.
const AreaModuleStateSchema = z.object({}).passthrough().optional()

export const areasModule: SimulationModule = {
  id: 'areas',
  version: '0.1.0',
  hooks: {
    startDay: [startDayHook],
    endDay: [endDayHook],
  },
  buildReport: buildAreaReport,
  validate: validateAreas,
  stateSchema: AreaModuleStateSchema,
}

// Re-export so callers that prefer to read areas via the registry have a
// single place to import. Keeping the helper exported also lets tests
// (and future host environments) re-seed the registry deterministically.
export { areaRegistry, ensureRequiredAreasRegistered }
export {
  getAreaQualityBand,
  isAreaFilthy,
  isAreaDamaged,
  isAreaDangerous,
  isAreaInspectionRisk,
} from './derived'
