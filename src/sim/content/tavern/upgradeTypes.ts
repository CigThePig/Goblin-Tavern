// Phase 22 §"Tavern Atmosphere and Upgrade Types" — upgrade shape.
//
// Phase 28 §28.2 fills in the operational fields the Phase 22 stub
// reserved. An upgrade needs a coin cost so owner actions can charge
// for it, optional build days so multi-day projects are possible,
// added/removed traits and atmosphere so installing an upgrade actually
// shifts the room's identity, and meter effects so it can move
// condition/cleanliness/etc. without going through a separate effect
// table. `allowedAreaIds` and `allowedAreaTags` together gate where
// each upgrade is permitted.
//
// Expansion Phase 2 §2.2 turns the catalogue into a buildable lifecycle
// (OBL-01). Every definition now also declares what the build COSTS
// (coin, materials, labour), what it DOES to the area's
// physical capacity, what it costs to KEEP (upkeep interval and cost),
// what it costs to FIX once damage disables it, and — where relevant —
// which earlier upgrade it replaces. Those are the fields the quote, the
// disabled reasons, the construction tick, the upkeep tick and the
// derived Help all read, so timing/cost/eligibility is stated once here
// rather than a second time in prose (§5.12).

import type { AreaCapacity } from '../../registries/areaCapacityTypes'

export type AreaUpgradeId = string

export type AreaUpgradeMeterEffects = Partial<{
  condition: number
  cleanliness: number
  mess: number
  damage: number
  smell: number
  risk: number
}>

/** One material line on a quote. Quantities are consumed from `state.stock`. */
export type AreaUpgradeMaterial = {
  stockId: string
  quantity: number
}

/**
 * Expansion Phase 2 §2.2 — eligibility conditions a player must meet
 * before an upgrade can be quoted. Every clause produces its own disabled
 * reason, so "why can't I build this" always has a specific answer.
 */
export type AreaUpgradeEligibility = {
  /** Upgrades that must already be installed in the same area. */
  requiresUpgrades?: ReadonlyArray<AreaUpgradeId>
  /** Traits the target area must carry. */
  requiresAreaTraits?: ReadonlyArray<string>
  /** The build cannot start while the room is below this condition. */
  minAreaCondition?: number
  /** The build cannot start while the room is below this cleanliness. */
  minAreaCleanliness?: number
}

/**
 * Expansion Phase 2 §2.2 — the upkeep an installed fitting demands.
 *
 * This is the counterweight to progression: every upgrade adds a
 * recurring claim on owner time and coin. An overdue fitting wears down
 * and eventually breaks, so a tavern full of unmaintained upgrades is
 * worse off than a plain one.
 */
export type AreaUpgradeMaintenance = {
  /** Days between services. */
  intervalDays: number
  /** Coin one service costs. */
  coin: number
  /** Condition the fitting loses per day once upkeep is overdue. */
  wearPerOverdueDay: number
}

export type AreaUpgradeDefinition = {
  id: AreaUpgradeId
  label: string
  description: string
  /** Specific area ids this upgrade can be installed in. If omitted,
   *  `allowedAreaTags` is consulted; if both are omitted, the upgrade
   *  is allowed anywhere. */
  allowedAreaIds?: string[]
  allowedAreaTags?: string[]
  costCoin: number
  /** Days of construction before the upgrade flips from `in_progress`
   *  to `installed`. Omit for instant upgrades. */
  buildDays?: number
  addsTraits?: string[]
  removesTraits?: string[]
  addsAtmosphere?: string[]
  meterEffects?: AreaUpgradeMeterEffects
  /** Mechanical tags used by reports, customers, and pressure
   *  calculators after the upgrade is installed. */
  tags: string[]

  // ---- Expansion Phase 2 §2.2 / §2.3: the quote ----
  //
  // Owner MINUTES are deliberately absent here. Owner time is charged by
  // the owner-action layer at that layer's own tiers (the start action's
  // `timeCost`, one `fund`/`maintain`/`repair` push at a time), and the
  // engine's budget gate reads the action definition — so a per-upgrade
  // minute figure on the catalogue would be a second, unenforced copy of a
  // number the action registry already owns (§5.12). `quoteAreaUpgrade`
  // derives the owner-time line from those shared costs instead.
  /** Materials drawn from stock when the build starts. */
  materials?: ReadonlyArray<AreaUpgradeMaterial>
  /**
   * Labour points the build needs. An unattended site contributes the
   * baseline tick; assigned staff and owner funding contribute more.
   * Absent falls back to `buildDays` (one point per day), so a definition
   * that only declares build days still quotes coherently.
   */
  labourRequired?: number
  eligibility?: AreaUpgradeEligibility

  // ---- Expansion Phase 2 §2.1 / §2.3: physical effect ----
  /** Capacity the installed fitting adds to (or takes from) its area. */
  capacityEffects?: AreaCapacity
  /**
   * Share of the area's own capacity that is unusable while the build
   * runs, 0–1. A booth partition closes part of the main room; re-
   * thatching the roof closes nothing anyone sits on.
   */
  blocksCapacityWhileBuilding?: number

  // ---- Expansion Phase 2 §2.2: keeping it, and fixing it ----
  maintenance?: AreaUpgradeMaintenance
  /** Coin a repair costs once the fitting is damaged or disabled. */
  repairCoin?: number
  /** The upgrade this one supersedes in the same area, if any. */
  replaces?: AreaUpgradeId

  /**
   * Expansion Phase 2 §2.2 — the legacy owner-project type this upgrade
   * unifies with. Before this phase `start_hearth_repair` wrote a trait
   * plus its own unrelated progress row while `hearth_repair` sat unbuilt
   * in the catalogue; they are now one record and the project starter
   * delegates to this lifecycle.
   */
  legacyProjectType?: string

  /** @deprecated Phase 22 placeholder — kept so older imports compile.
   *  Prefer the structured `meterEffects` / `addsTraits` fields. */
  effects?: string[]
  /** @deprecated Phase 22 placeholder — superseded by `allowedAreaIds`. */
  areaId?: string
  /** @deprecated Phase 22 placeholder — superseded by `allowedAreaTags`. */
  areaTags?: string[]
}
