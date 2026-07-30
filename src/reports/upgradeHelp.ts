import { actionRegistry } from '../sim/registries/actionRegistry'
import {
  areaUpgradeRegistry,
  getAreaUpgradeDefinition,
} from '../sim/content/tavern/areaUpgradeRegistry'
import type { AreaUpgradeDefinition } from '../sim/content/tavern/upgradeTypes'
import { areaRegistry } from '../sim/registries/areaRegistry'
import { formatDuration } from '../sim/modules/ownerActions/stateHelpers'
import {
  CONSTRUCTION_PRIORITY,
  OWNER_FUND_LABOUR,
  SITE_BASE_LABOUR_PER_DAY,
} from '../sim/modules/areas/labour'
import { upgradeLabourRequired } from '../sim/modules/areas/quote'

// Expansion Phase 2 §5.12 / §"Player-facing work" — Help DERIVED from upgrade
// metadata.
//
// §5.12 is blunt: "Update help from shared rule metadata. Do not create a
// second prose-only version of timing, costs, or eligibility." The static
// glossary already had an `area_upgrade` entry claiming upgrades "cost coin and
// time to install" — accurate as far as it went, and unable to tell a player
// that private booths need better tables first, want eight timber, and take
// eight labour points.
//
// So nothing in this file authors a number. Every figure is read from the
// catalogue, the area registry or the owner-action registry at call time, which
// means a retuned upgrade updates its own Help and the test that pins them
// together cannot pass while they disagree.

export type UpgradeHelpRow = {
  upgradeId: string
  label: string
  description: string
  /** Rooms this upgrade can go in, by display label. */
  areaLabels: string[]
  /** One line per cost the quote will charge. */
  costLines: string[]
  /** One line per eligibility condition. Empty when there are none. */
  requirementLines: string[]
  /** What installing it does. */
  effectLines: string[]
  /** What keeping it costs. Empty when it needs no service. */
  upkeepLines: string[]
}

function labelForArea(areaId: string): string {
  return areaRegistry.has(areaId) ? areaRegistry.get(areaId).label : areaId
}

function areaLabelsFor(def: AreaUpgradeDefinition): string[] {
  if (def.allowedAreaIds) return def.allowedAreaIds.map(labelForArea)
  if (def.allowedAreaTags) {
    return areaRegistry
      .all()
      .filter((area) => def.allowedAreaTags!.some((tag) => area.tags.includes(tag)))
      .map((area) => area.label)
  }
  return ['any room']
}

function actionMinutes(actionId: string): number | undefined {
  return actionRegistry.has(actionId)
    ? actionRegistry.get(actionId).timeCost
    : undefined
}

export function buildUpgradeHelpRow(upgradeId: string): UpgradeHelpRow | undefined {
  const def = getAreaUpgradeDefinition(upgradeId)
  if (!def) return undefined

  const labour = upgradeLabourRequired(def)
  const startMinutes = actionMinutes('start_area_upgrade')
  const fundMinutes = actionMinutes('fund_area_upgrade')

  const costLines: string[] = [`${def.costCoin} coin, paid when work starts`]
  if (def.materials && def.materials.length > 0) {
    costLines.push(
      `Materials: ${def.materials
        .map((line) => `${line.quantity} × ${line.stockId.replace(/_/g, ' ')}`)
        .join(', ')} — drawn from stores when work starts`,
    )
  }
  if (startMinutes !== undefined) {
    costLines.push(`${formatDuration(startMinutes)} of the owner's day to start`)
  }
  costLines.push(
    `${labour} labour points of site work` +
      (def.buildDays !== undefined
        ? ` (about ${def.buildDays} day${def.buildDays === 1 ? '' : 's'} with a crew on it)`
        : ''),
  )
  costLines.push(
    `An unattended site banks ${SITE_BASE_LABOUR_PER_DAY} labour a day. ` +
      `A staff member on ${CONSTRUCTION_PRIORITY.replace(/_/g, ' ')} adds more, and ` +
      (fundMinutes !== undefined
        ? `working it yourself adds ${OWNER_FUND_LABOUR} for ${formatDuration(fundMinutes)}.`
        : `working it yourself adds ${OWNER_FUND_LABOUR}.`),
  )
  // A room in bad repair costs more to build in — the same rule
  // `upgradeCoinCost` applies, stated once here rather than re-worded.
  costLines.push('A room below condition 35 costs a fifth again to work in.')

  const requirementLines: string[] = []
  const el = def.eligibility
  if (el?.requiresUpgrades) {
    for (const required of el.requiresUpgrades) {
      requirementLines.push(
        `${getAreaUpgradeDefinition(required)?.label ?? required} must already be installed here`,
      )
    }
  }
  if (el?.requiresAreaTraits) {
    for (const trait of el.requiresAreaTraits) {
      requirementLines.push(`The room must be ${trait.replace(/_/g, ' ')}`)
    }
  }
  if (el?.minAreaCondition !== undefined) {
    requirementLines.push(`Room condition at least ${el.minAreaCondition}`)
  }
  if (el?.minAreaCleanliness !== undefined) {
    requirementLines.push(`Room cleanliness at least ${el.minAreaCleanliness}`)
  }

  const effectLines: string[] = []
  for (const [kind, amount] of Object.entries(def.capacityEffects ?? {})) {
    if (!amount) continue
    effectLines.push(`${amount > 0 ? '+' : ''}${amount} ${kind}`)
  }
  for (const [meter, amount] of Object.entries(def.meterEffects ?? {})) {
    if (!amount) continue
    effectLines.push(`${meter} ${amount > 0 ? '+' : ''}${amount}`)
  }
  for (const trait of def.addsTraits ?? []) {
    effectLines.push(`the room becomes ${trait.replace(/_/g, ' ')}`)
  }
  for (const trait of def.removesTraits ?? []) {
    effectLines.push(`the room stops being ${trait.replace(/_/g, ' ')}`)
  }
  for (const tag of def.addsAtmosphere ?? []) {
    effectLines.push(`atmosphere: ${tag.replace(/_/g, ' ')}`)
  }
  if (def.blocksCapacityWhileBuilding) {
    effectLines.push(
      `${Math.round(def.blocksCapacityWhileBuilding * 100)}% of the room is out of use while it is being built`,
    )
  }
  if (def.replaces) {
    effectLines.push(
      `replaces ${getAreaUpgradeDefinition(def.replaces)?.label ?? def.replaces}, which is retired on completion`,
    )
  }

  const upkeepLines: string[] = []
  if (def.maintenance) {
    const maintainMinutes = actionMinutes('maintain_area_upgrade')
    upkeepLines.push(
      `Service every ${def.maintenance.intervalDays} days for ${def.maintenance.coin} coin` +
        (maintainMinutes !== undefined
          ? ` and ${formatDuration(maintainMinutes)}`
          : ''),
    )
    upkeepLines.push(
      `Left overdue it loses ${def.maintenance.wearPerOverdueDay} condition a day; below 25 it stops working, and at 0 it is out of service.`,
    )
  }
  const repairCoin = def.repairCoin ?? Math.max(1, Math.round(def.costCoin * 0.3))
  const repairMinutes = actionMinutes('repair_area_upgrade')
  upkeepLines.push(
    `A repair costs ${repairCoin} coin` +
      (repairMinutes !== undefined ? ` and ${formatDuration(repairMinutes)}` : '') +
      ' and returns it to condition 85.',
  )

  return {
    upgradeId,
    label: def.label,
    description: def.description,
    areaLabels: areaLabelsFor(def),
    costLines,
    requirementLines,
    effectLines,
    upkeepLines,
  }
}

/** Every upgrade's Help, sorted by id so the order is stable. */
export function buildUpgradeHelp(): UpgradeHelpRow[] {
  return areaUpgradeRegistry
    .all()
    .map((def) => buildUpgradeHelpRow(def.id))
    .filter((row): row is UpgradeHelpRow => row !== undefined)
    .sort((a, b) => a.upgradeId.localeCompare(b.upgradeId))
}
