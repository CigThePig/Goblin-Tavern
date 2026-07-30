import type { StaffState, TavernState } from '../../state/TavernState'

import { getTotalUsableWorkstations } from './capacity'

// Expansion Phase 2 §2.3 — who can work a site, and how many sites can run.
//
// These primitives sit in their own file because BOTH `quote.ts` (which must
// tell the player how long a build will take) and `schedule.ts` (which decides
// which sites are actually worked today) need them, and `quote.ts` in turn
// needs the schedule's verdict to answer honestly. Without this split those two
// import each other.

/**
 * Baseline labour a live site produces on its own each day.
 *
 * A site is never wholly dead — the owner passes through, a hand puts an hour
 * in. But the baseline is deliberately slow: `labourRequired` scales with build
 * days, so an unattended four-day job takes eight days. Hitting the quoted
 * duration needs either staff on repairs or the owner's own time (§2.3,
 * "variable progress from labor, damage, shortages, and interruptions").
 */
export const SITE_BASE_LABOUR_PER_DAY = 1

/** Labour one `fund_area_upgrade` push buys. */
export const OWNER_FUND_LABOUR = 2

/** The staff priority that puts a body on a construction site. */
export const CONSTRUCTION_PRIORITY = 'minor_repairs'

/** Condition below which a wrecked room slows its own repairs. */
export const DERELICT_CONDITION = 35

function isWorkingStaff(member: StaffState): boolean {
  return member.unavailable !== true
}

/** Effectiveness mirrors the staff module's own formula, read-only. */
export function staffEffectiveness(member: StaffState): number {
  const raw =
    member.skill +
    Math.round(member.morale * 0.2) -
    Math.round(member.stress * 0.25) -
    Math.round(member.fatigue * 0.25)
  return Math.max(0, Math.min(100, raw))
}

/** Staff currently assigned to site work, in a stable order. */
export function listConstructionCrew(state: TavernState): StaffState[] {
  return Object.values(state.staff)
    .filter(
      (member) =>
        isWorkingStaff(member) && member.currentPriority === CONSTRUCTION_PRIORITY,
    )
    .sort((a, b) => a.id.localeCompare(b.id))
}

/** Labour one crew member contributes across a full day. */
export function crewMemberLabour(member: StaffState): number {
  return 1 + Math.round(staffEffectiveness(member) / 50)
}

/**
 * §2.3 concurrent-work limit.
 *
 * Two independent constraints, and the tighter one wins:
 *
 *   supervision   one site is what an owner can keep an eye on alone; each
 *                 staffer on repairs makes another one possible. This is why
 *                 `minor_repairs` is a real decision rather than a flavour
 *                 toggle.
 *   work space    a crew can only run as many sites as the tavern has usable
 *                 workstations to work from. This is what makes workstation
 *                 capacity load-bearing rather than a reported number: let the
 *                 rooms rot and their workstations stop counting, and the
 *                 tavern can run fewer builds at once — including the builds
 *                 that would fix them.
 */
export function getMaxConcurrentSites(state: TavernState): number {
  const supervision = 1 + listConstructionCrew(state).length
  const workSpace = getTotalUsableWorkstations(state)
  // Never zero: a tavern with every workstation lost can still crawl one site
  // forward, or repairing the place would become unreachable.
  return Math.max(1, Math.min(supervision, workSpace))
}

/** Areas with a live (`in_progress`) build, in a stable order. */
export function listActiveSites(
  state: TavernState,
): Array<{ areaId: string; upgradeId: string }> {
  const sites: Array<{ areaId: string; upgradeId: string }> = []
  for (const area of Object.values(state.areas)) {
    for (const upgrade of Object.values(area.upgrades)) {
      if (upgrade.status !== 'in_progress') continue
      sites.push({ areaId: area.id, upgradeId: upgrade.id })
    }
  }
  return sites.sort(
    (a, b) =>
      a.areaId.localeCompare(b.areaId) || a.upgradeId.localeCompare(b.upgradeId),
  )
}
