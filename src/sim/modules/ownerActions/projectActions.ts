import type { ActionPressureId, OwnerActionDefinition } from './types'

// Phase 33 §33.4 / §33.5 — Project actions.
//
// Projects are long-running owner investments. Each `start_<project>`
// action stamped a new `OwnerProjectState` into
// `state.modules.ownerActions.projects` with a required progress count and an
// effects preview; the project tick advanced them and, on completion, added a
// trait to the target area.
//
// ── Expansion Phase 2 §2.2: THE FIVE UPGRADE-BUILDING STARTERS ARE RETIRED ──
//
// All five of them (`private_booths`, `repair_hearth`, `music_corner`,
// `rat_proof_storage`, `larger_stew_pot`) built something the area-upgrade
// catalogue already described — and they built it as a TRAIT plus a progress
// row of their own, while the matching `AreaState.upgrades` record sat at
// `available` forever. That is the duplicate representation the plan names
// explicitly: "a project that constructs an upgrade must write one
// authoritative upgrade record, not a trait plus an unrelated display state".
//
// Those five are now the `legacyProjectType` field on their upgrade
// definitions, and the upgrade lifecycle in `upgradeActions.ts` +
// `modules/areas/construction.ts` is the single way to build one. It offers all
// eighteen upgrades rather than five hardcoded projects, with quotes,
// materials, pause/resume, damage and upkeep — so retiring the starters loses
// no capability and gains the rest of OBL-01.
//
// `fund_active_project` and `cancel_project` go with them: their only possible
// targets were those five records, and an action with nothing to act on is not
// discoverable. `fund_area_upgrade` / `cancel_area_upgrade` replace them.
//
// In-flight and completed legacy project records in existing saves are
// converted to authoritative upgrade records by
// `ensureAreaConstructionFields` (`src/sim/state/migrations.ts`), so no save
// loses work it paid for.
//
// WHAT REMAINS. The general project system — `OwnerProjectState`, the
// `projects` slice, and the progress tick — is intentionally kept. The plan
// says non-upgrade projects may continue to use it, and the tick still
// advances and completes any record present (including a migrated save's), it
// simply has no starters of its own today.

// Each starter definition is data: an id, a target area, a label, a
// progress requirement, an optional one-time coin cost, and an effects
// preview the report can surface before completion lands.
export type ProjectStarterDefinition = {
  id: string
  projectType: string
  label: string
  targetAreaId: string
  requiredProgress: number
  initialCoinCost: number
  tags: string[]
  effectsPreview: string[]
  /** Phase 193 — pressures this project relieves; surfaces it in the
   *  picker's "Suggested" section when a tagged pressure is in band. */
  pressureAffinity?: ActionPressureId[]
  /** Trait id added to the target area when the project completes.
   *  When omitted, the project still completes but only the effects
   *  preview record is preserved (acceptable: this lets the project
   *  system carry weight before every Phase 28 trait is wired). */
  addsTrait?: string
  /** Trait id removed from the target area when the project completes.
   *  Used by `rat_proof_storage` to scrub `pest_prone`. */
  removesTrait?: string
}

/**
 * Expansion Phase 2 §2.2 — empty by design.
 *
 * The five entries that used to live here each duplicated an area-upgrade
 * definition; they are now `legacyProjectType` on those definitions and are
 * built through the upgrade lifecycle. The list stays (rather than the type
 * being deleted) so a later phase can add a genuine non-upgrade project
 * without rebuilding the machinery.
 */
export const PROJECT_STARTERS: ProjectStarterDefinition[] = []

function findStarterByProjectType(
  projectType: string,
): ProjectStarterDefinition | undefined {
  return PROJECT_STARTERS.find((s) => s.projectType === projectType)
}

function projectInstanceIdFor(starter: ProjectStarterDefinition): string {
  // Project instance ids are stable across days so progress accumulates
  // on the same record. Players cannot start the same project twice;
  // they fund the existing instance instead.
  return `project:${starter.projectType}`
}

export const PROJECT_ACTIONS: OwnerActionDefinition[] = []

export { findStarterByProjectType, projectInstanceIdFor }
