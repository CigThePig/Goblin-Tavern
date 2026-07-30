import type { TavernState } from '../../state/TavernState'
import { getAreaUpgradeDefinition } from '../../content/tavern/areaUpgradeRegistry'
import {
  DAY_MINUTES,
  getOwnerActionsModuleState,
} from '../ownerActions/stateHelpers'

import {
  CONSTRUCTION_PRIORITY,
  getMaxConcurrentSites,
  listActiveSites,
  listConstructionCrew,
} from './quote'
import type { AreaWorkBlock } from './state'

// Expansion Phase 2 §2.5 — work scheduling inside the day clock.
//
// The locked day-clock contract keeps the readable 360-minute owner budget
// (`phase-186-day-clock-time-economy.md` §2.5), and this phase does not touch
// it: owner minutes are still charged by the owner-action layer against
// `DAY_MINUTES`. What is added is the *other* half of §2.5 — accepted work
// represented as scheduled blocks, so concurrency and conflict are facts
// rather than guesses.
//
// The schedule is LOAD-BEARING, not a display. `tickConstruction` advances
// only the sites whose block came out `scheduled`; a site whose block is
// `conflicted` makes no progress that day and says why. That is what makes
// "which staff can contribute" and "concurrent-work limits" real constraints
// instead of numbers in a report.
//
// The player never places a block by hand. Blocks are derived from what is
// already true — which builds are live, who is on repairs, what the owner
// queued — exactly as §2.5 asks ("priorities and queued actions can produce
// the schedule").

/** Minutes a staff member gives a site in one day. */
const STAFF_SHIFT_MINUTES = 180

/** Minutes the site's own baseline attention represents. */
const SITE_BASE_MINUTES = 60

/** Owner-action ids that occupy an area rather than a desk. */
const AREA_WORK_ACTION_IDS = new Set([
  'start_area_upgrade',
  'fund_area_upgrade',
  'repair_area_upgrade',
  'maintain_area_upgrade',
  'clean_area',
  'repair_area',
  'patch_roof',
  'fumigate_cellar',
])

/**
 * Distinct areas the owner has already worked in today, from the applied
 * owner-action record.
 *
 * §2.5's travel/setup cost, charged only where it creates a real tradeoff:
 * spreading the owner's day across three rooms costs setup that concentrating
 * it in one does not. It is charged in LABOUR (see `ownerTravelPenalty`)
 * rather than in minutes, because the minute budget belongs to the locked
 * day-clock contract and this phase does not get to reprice it.
 */
export function listOwnerWorkedAreas(state: TavernState): string[] {
  const slice = getOwnerActionsModuleState(state)
  const areas = new Set<string>()
  for (const applied of slice.applied) {
    if (!AREA_WORK_ACTION_IDS.has(applied.actionId)) continue
    const target = applied.targetId
    if (!target) continue
    // Upgrade actions target `<areaId>:<upgradeId>`; area actions target the
    // area id directly.
    const areaId = target.includes(':') ? target.split(':')[0]! : target
    if (state.areas[areaId]) areas.add(areaId)
  }
  return [...areas].sort()
}

/**
 * Labour lost to travel and setup when the owner puts a shift into an area
 * they have not already been working in today.
 *
 * Returns 0 for the first area worked (no travel yet) and 1 thereafter, so a
 * focused day is worth more than a scattered one.
 */
export function ownerTravelPenalty(state: TavernState, areaId: string): number {
  const worked = listOwnerWorkedAreas(state)
  if (worked.length === 0) return 0
  if (worked.includes(areaId)) return 0
  return 1
}

/**
 * Build today's work schedule.
 *
 * Pure: same state in, same blocks out, in a stable order. Determinism here is
 * what the full-day-versus-segmented and save/reload equivalence checks rest
 * on, so nothing in this function may read the RNG or iteration order of an
 * unsorted collection.
 */
export function buildAreaWorkSchedule(state: TavernState): AreaWorkBlock[] {
  const blocks: AreaWorkBlock[] = []
  const sites = listActiveSites(state)
  const crew = listConstructionCrew(state)
  const maxSites = getMaxConcurrentSites(state)

  // Sites compete for the crew's attention in a stable order: the build that
  // started first keeps its place. A player who wants a different order pauses
  // one and resumes the other, which is what pause/resume is for.
  const ordered = [...sites].sort((a, b) => {
    const aStarted = state.areas[a.areaId]?.upgrades[a.upgradeId]?.startedAtDay ?? 0
    const bStarted = state.areas[b.areaId]?.upgrades[b.upgradeId]?.startedAtDay ?? 0
    return (
      aStarted - bStarted ||
      a.areaId.localeCompare(b.areaId) ||
      a.upgradeId.localeCompare(b.upgradeId)
    )
  })

  let startMinute = 0
  let cleared = 0
  const roomsInUse = new Set<string>()
  ordered.forEach((site) => {
    const def = getAreaUpgradeDefinition(site.upgradeId)
    const area = state.areas[site.areaId]
    const label = `${def?.label ?? site.upgradeId} — ${area?.label ?? site.areaId}`

    // §2.5's exclusivity rule, with a physical reason: you cannot rebuild the
    // hearth and fit the booths in the same room on the same day. Two builds in
    // one room take turns; two builds in two rooms only need the crew.
    const roomTaken = roomsInUse.has(site.areaId)
    const overLimit = cleared >= maxSites

    let status: AreaWorkBlock['status'] = 'scheduled'
    let conflictReason: string | undefined
    if (roomTaken) {
      status = 'conflicted'
      conflictReason = `Another build already has the floor in ${area?.label ?? site.areaId}`
    } else if (overLimit) {
      status = 'conflicted'
      conflictReason =
        `Crew is already committed to ${maxSites} site${maxSites === 1 ? '' : 's'}; ` +
        `put a staff member on ${CONSTRUCTION_PRIORITY.replace(/_/g, ' ')} or pause another build`
    }

    blocks.push({
      id: `construction:${site.areaId}:${site.upgradeId}`,
      kind: 'construction',
      areaId: site.areaId,
      upgradeId: site.upgradeId,
      actorKind: 'site',
      label,
      minutes: SITE_BASE_MINUTES,
      startMinute,
      holdsWorkstation: true,
      status,
      ...(conflictReason ? { conflictReason } : {}),
    })
    if (status === 'scheduled') {
      startMinute += SITE_BASE_MINUTES
      cleared += 1
      roomsInUse.add(site.areaId)
    }
  })

  // One block per crew member, pointing at the first site they can actually
  // reach. Crew with no scheduled site to work is recorded as conflicted so
  // "my carpenter did nothing" has an answer.
  const scheduledSites = blocks.filter((b) => b.status === 'scheduled')
  crew.forEach((member, index) => {
    const site = scheduledSites[index % Math.max(1, scheduledSites.length)]
    const hasSite = scheduledSites.length > 0
    blocks.push({
      id: `crew:${member.id}`,
      kind: 'construction',
      areaId: hasSite ? site!.areaId : '',
      ...(hasSite && site!.upgradeId ? { upgradeId: site!.upgradeId } : {}),
      actorKind: 'staff',
      actorId: member.id,
      label: `${member.name.display} on site work`,
      minutes: STAFF_SHIFT_MINUTES,
      startMinute: 0,
      holdsWorkstation: false,
      status: hasSite ? 'scheduled' : 'conflicted',
      ...(hasSite
        ? {}
        : { conflictReason: 'No build is running for them to work on' }),
    })
  })

  // The owner's own committed area work, read from what was actually applied
  // today. Minutes come from the owner-action record, so the schedule and the
  // day clock cannot disagree about how the owner's 360 minutes went.
  const slice = getOwnerActionsModuleState(state)
  let ownerMinute = 0
  for (const applied of slice.applied) {
    if (!AREA_WORK_ACTION_IDS.has(applied.actionId)) continue
    const target = applied.targetId ?? ''
    const areaId = target.includes(':') ? target.split(':')[0]! : target
    if (!state.areas[areaId]) continue
    const over = ownerMinute + applied.timeCost > DAY_MINUTES
    blocks.push({
      id: `owner:${applied.actionId}:${target}`,
      kind:
        applied.actionId === 'maintain_area_upgrade'
          ? 'upkeep'
          : applied.actionId.includes('repair')
            ? 'repair'
            : 'construction',
      areaId,
      ...(target.includes(':') ? { upgradeId: target.split(':')[1]! } : {}),
      actorKind: 'owner',
      label: applied.label,
      minutes: applied.timeCost,
      startMinute: ownerMinute,
      holdsWorkstation: false,
      status: over ? 'conflicted' : 'scheduled',
      ...(over ? { conflictReason: 'Past the end of the owner’s day' } : {}),
    })
    ownerMinute += applied.timeCost
  }

  return blocks
}

/** Site ids the schedule cleared for work today. */
export function scheduledSiteKeys(blocks: ReadonlyArray<AreaWorkBlock>): Set<string> {
  const keys = new Set<string>()
  for (const block of blocks) {
    if (block.kind !== 'construction') continue
    if (block.actorKind !== 'site') continue
    if (block.status !== 'scheduled') continue
    if (!block.upgradeId) continue
    keys.add(`${block.areaId}:${block.upgradeId}`)
  }
  return keys
}

/** Why a site was not worked today, when the schedule blocked it. */
export function siteConflictReason(
  blocks: ReadonlyArray<AreaWorkBlock>,
  areaId: string,
  upgradeId: string,
): string | undefined {
  const block = blocks.find(
    (b) =>
      b.actorKind === 'site' && b.areaId === areaId && b.upgradeId === upgradeId,
  )
  if (!block || block.status !== 'conflicted') return undefined
  return block.conflictReason
}
