import type { AreaState, TavernState } from '../../state/TavernState'
import { areaRegistry } from '../../registries/areaRegistry'
import type { AreaCapacity } from '../../registries/areaCapacityTypes'
import {
  areaUpgradeRegistry,
  getAreaUpgradeDefinition,
} from '../../content/tavern/areaUpgradeRegistry'
import type {
  AreaUpgradeDefinition,
  AreaUpgradeMaintenance,
} from '../../content/tavern/upgradeTypes'
import {
  CONSTRUCTION_PRIORITY,
  DERELICT_CONDITION,
  OWNER_FUND_LABOUR,
  getMaxConcurrentSites,
  listActiveSites,
} from './labour'
// `getSiteLabourPerDay` lives with the schedule because the honest answer
// depends on which sites the schedule actually cleared today — see the note on
// the crew split there. Quoting reads it rather than re-deriving a second,
// looser estimate that could disagree with the tick.
import { getSiteLabourPerDay } from './schedule'

// Expansion Phase 2 §2.2 / §2.3 / §2.5 — quoting a build.
//
// OBL-01's requirement is that the player can DISCOVER, quote, start, fund,
// build, complete, damage, disable, repair and persist an upgrade. This file
// owns the first two, and it is the single source the owner actions, the
// reports, the web surfaces and the derived Help all read — so the number
// the player is shown and the number they are charged cannot disagree
// (required test: "quote and authoritative cost agreement").
//
// The quote is pure: state in, quote out. It never mutates and never draws
// from the RNG, so a preview and the eventual charge are the same
// computation run twice.

export type AreaUpgradeMaterialLine = {
  stockId: string
  label: string
  required: number
  held: number
}

export type AreaUpgradeVerdict =
  | { ok: true }
  | { ok: false; code: string; reason: string }

export type AreaUpgradeQuote = {
  areaId: string
  areaLabel: string
  upgradeId: string
  label: string
  description: string
  coin: number
  /** Owner minutes the start action itself costs. */
  startMinutes: number
  /**
   * Owner minutes the whole build is expected to want, including the
   * funding pushes needed to hit the quoted duration. Derived from the
   * owner-action tiers, never authored per upgrade (§5.12).
   */
  ownerMinutes: number
  materials: AreaUpgradeMaterialLine[]
  labourRequired: number
  /** Labour the site is producing per day as things currently stand. */
  labourPerDay: number
  /** Days to completion at `labourPerDay`. */
  expectedDays: number
  /** Days the catalogue quotes with a crew on it. */
  quotedBuildDays: number
  capacityEffects: AreaCapacity
  blocksCapacityWhileBuilding: number
  maintenance?: AreaUpgradeMaintenance
  repairCoin: number
  replaces?: string
  /** Can this be started at all, ignoring whether the player can pay? */
  eligibility: AreaUpgradeVerdict
  /** Can the player pay for it right now? */
  affordability: AreaUpgradeVerdict
}

// ---------- eligibility ----------

function fail(code: string, reason: string): AreaUpgradeVerdict {
  return { ok: false, code, reason }
}

const OK: AreaUpgradeVerdict = { ok: true }

export function upgradeAllowedInArea(
  def: AreaUpgradeDefinition,
  area: AreaState,
): boolean {
  if (def.allowedAreaIds) return def.allowedAreaIds.includes(area.id)
  if (def.allowedAreaTags) {
    return def.allowedAreaTags.some((tag) => area.tags.includes(tag))
  }
  return true
}

/**
 * May the player start this build? Ordered most-specific-first so the
 * player is told the sharpest true reason, not the first generic one.
 */
export function checkUpgradeEligibility(
  state: TavernState,
  areaId: string,
  upgradeId: string,
): AreaUpgradeVerdict {
  const area = state.areas[areaId]
  if (!area) return fail('unknown_area', `Unknown area '${areaId}'`)
  const def = getAreaUpgradeDefinition(upgradeId)
  if (!def) return fail('unknown_upgrade', `Unknown upgrade '${upgradeId}'`)
  if (!upgradeAllowedInArea(def, area)) {
    return fail(
      'wrong_area',
      `${def.label} cannot be installed in ${area.label}`,
    )
  }

  const existing = area.upgrades[upgradeId]
  if (existing) {
    if (existing.status === 'installed') {
      return fail('already_installed', `${def.label} is already installed`)
    }
    if (existing.status === 'in_progress') {
      return fail('already_in_progress', `${def.label} is already being built`)
    }
    if (existing.status === 'paused') {
      return fail('paused', `${def.label} is paused — resume it instead`)
    }
    if (existing.status === 'damaged' || existing.status === 'disabled') {
      return fail('needs_repair', `${def.label} is broken — repair it instead`)
    }
    // `available` and `cancelled` fall through: an abandoned build may be
    // started again from scratch.
  }

  // …but a SUPERSEDED record is not an abandoned one. `completeUpgrade` retires
  // the upgrade a replacement supersedes by marking it `cancelled`, and without
  // this clause that record reads as freely restartable: build the beams, then
  // rebuild the thatch they replaced, and the room ends up with both installed,
  // the patch's meter benefit re-applied and two upkeep clocks running for
  // mutually exclusive roof work. The successor's own `replaces` declaration is
  // the authority, so no extra state is needed to know it.
  for (const other of Object.values(area.upgrades)) {
    if (other.status !== 'installed') continue
    const otherDef = getAreaUpgradeDefinition(other.id)
    if (otherDef?.replaces !== upgradeId) continue
    return fail(
      'superseded',
      `${def.label} was replaced by ${otherDef.label}; the two cannot both be fitted`,
    )
  }

  const el = def.eligibility
  if (el?.requiresUpgrades) {
    for (const required of el.requiresUpgrades) {
      if (area.upgrades[required]?.status === 'installed') continue
      const requiredDef = getAreaUpgradeDefinition(required)
      return fail(
        'requires_upgrade',
        `${def.label} needs ${requiredDef?.label ?? required} installed first`,
      )
    }
  }
  if (el?.requiresAreaTraits) {
    for (const trait of el.requiresAreaTraits) {
      if (area.traits.includes(trait)) continue
      return fail(
        'requires_trait',
        `${def.label} needs ${area.label} to be ${trait.replace(/_/g, ' ')}`,
      )
    }
  }
  if (el?.minAreaCondition !== undefined && area.condition < el.minAreaCondition) {
    return fail(
      'area_condition_too_low',
      `${area.label} must be repaired to condition ${el.minAreaCondition} first (now ${area.condition})`,
    )
  }
  if (
    el?.minAreaCleanliness !== undefined &&
    area.cleanliness < el.minAreaCleanliness
  ) {
    return fail(
      'area_too_filthy',
      `${area.label} must be cleaned to ${el.minAreaCleanliness} first (now ${area.cleanliness})`,
    )
  }

  return OK
}

// ---------- the quote ----------

export function upgradeLabourRequired(def: AreaUpgradeDefinition): number {
  if (def.labourRequired !== undefined) return def.labourRequired
  // A definition that only declares build days still quotes coherently:
  // one labour point per quoted day, minimum one.
  return Math.max(1, def.buildDays ?? 1)
}

export function upgradeMaterials(
  state: TavernState,
  def: AreaUpgradeDefinition,
): AreaUpgradeMaterialLine[] {
  return (def.materials ?? []).map((line) => ({
    stockId: line.stockId,
    label: state.stock[line.stockId]?.label ?? line.stockId,
    required: line.quantity,
    held: state.stock[line.stockId]?.quantity ?? 0,
  }))
}

/**
 * Coin the build costs here.
 *
 * A neglected room costs more to work in: a fifth again on top when the room
 * is below the shared `isAreaDamaged` cut-point. It is a small number with a
 * clear reason — you pay for working around the wreckage — and it gives
 * `repair_area` a second purpose beyond the meter it moves.
 */
export function upgradeCoinCost(area: AreaState, def: AreaUpgradeDefinition): number {
  const base = def.costCoin
  if (area.condition >= DERELICT_CONDITION) return base
  return Math.ceil(base * 1.2)
}

export function quoteAreaUpgrade(
  state: TavernState,
  areaId: string,
  upgradeId: string,
  opts: { startMinutes: number; fundMinutes: number },
): AreaUpgradeQuote | undefined {
  const area = state.areas[areaId]
  const def = getAreaUpgradeDefinition(upgradeId)
  if (!area || !def) return undefined

  const labourRequired = upgradeLabourRequired(def)
  const labourPerDay = getSiteLabourPerDay(state, areaId)
  const expectedDays =
    labourPerDay > 0 ? Math.ceil(labourRequired / labourPerDay) : Infinity
  const quotedBuildDays = Math.max(1, def.buildDays ?? 1)

  // Owner minutes: the start, plus however many funding pushes it would take
  // to close the gap between the site's own pace and the quoted duration.
  const labourFromSite = labourPerDay * quotedBuildDays
  const fundingPushes = Math.max(
    0,
    Math.ceil((labourRequired - labourFromSite) / OWNER_FUND_LABOUR),
  )
  const ownerMinutes = opts.startMinutes + fundingPushes * opts.fundMinutes

  const materials = upgradeMaterials(state, def)
  const coin = upgradeCoinCost(area, def)

  const eligibility = checkUpgradeEligibility(state, areaId, upgradeId)
  const affordability = checkUpgradeAffordability(state, {
    coin,
    materials,
    startMinutes: opts.startMinutes,
  })

  return {
    areaId,
    areaLabel: area.label,
    upgradeId,
    label: def.label,
    description: def.description,
    coin,
    startMinutes: opts.startMinutes,
    ownerMinutes,
    materials,
    labourRequired,
    labourPerDay,
    expectedDays,
    quotedBuildDays,
    capacityEffects: def.capacityEffects ?? {},
    blocksCapacityWhileBuilding: def.blocksCapacityWhileBuilding ?? 0,
    ...(def.maintenance ? { maintenance: def.maintenance } : {}),
    repairCoin: def.repairCoin ?? Math.max(1, Math.round(def.costCoin * 0.3)),
    ...(def.replaces ? { replaces: def.replaces } : {}),
    eligibility,
    affordability,
  }
}

/**
 * Can the player pay the quote right now?
 *
 * Kept separate from eligibility because they are different questions with
 * different answers in the UI: an ineligible upgrade should not be offered,
 * an unaffordable one should be offered with its price showing.
 */
export function checkUpgradeAffordability(
  state: TavernState,
  quote: {
    coin: number
    materials: ReadonlyArray<AreaUpgradeMaterialLine>
    startMinutes: number
  },
): AreaUpgradeVerdict {
  if (state.coin < quote.coin) {
    return fail(
      'insufficient_coin',
      `Costs ${quote.coin} coin; only ${state.coin} available`,
    )
  }
  for (const line of quote.materials) {
    if (line.held >= line.required) continue
    return fail(
      'insufficient_materials',
      `Needs ${line.required} ${line.label}; only ${line.held} in store`,
    )
  }
  if (listActiveSites(state).length >= getMaxConcurrentSites(state)) {
    const limit = getMaxConcurrentSites(state)
    return fail(
      'no_free_crew',
      `Already running ${limit} site${limit === 1 ? '' : 's'} — pause one, or put a staff member on ${CONSTRUCTION_PRIORITY.replace(/_/g, ' ')}`,
    )
  }
  return OK
}

/**
 * Every upgrade the catalogue permits in this area, whatever its state.
 *
 * Discovery starts here: the area sheet lists these, each with its quote and
 * — when it cannot be started — the specific reason. Sorted by id so the
 * order is stable across reloads.
 */
export function listCatalogueForArea(area: AreaState): AreaUpgradeDefinition[] {
  return areaUpgradeRegistry
    .all()
    .filter((def) => upgradeAllowedInArea(def, area))
    .sort((a, b) => a.id.localeCompare(b.id))
}

/** Areas the catalogue permits this upgrade in, that exist in state. */
export function listAreasForUpgrade(
  state: TavernState,
  upgradeId: string,
): AreaState[] {
  const def = getAreaUpgradeDefinition(upgradeId)
  if (!def) return []
  return Object.values(state.areas)
    .filter((area) => upgradeAllowedInArea(def, area))
    .sort((a, b) => a.id.localeCompare(b.id))
}

/** Label for an area, falling back to the registry then the raw id. */
export function areaLabel(state: TavernState, areaId: string): string {
  const live = state.areas[areaId]?.label
  if (live) return live
  if (areaRegistry.has(areaId)) return areaRegistry.get(areaId).label
  return areaId
}
