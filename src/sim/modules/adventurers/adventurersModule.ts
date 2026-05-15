import { z } from 'zod'

import type { SimContext } from '../../core/context'
import type { SimulationHook, SimulationModule } from '../../core/module'
import type { ReportSection } from '../../core/reports'
import { createHireableAdventurer } from '../../content/npc/adventurerFactory'
import type { HireableAdventurer } from '../../state/TavernState'

// Phase 69 / ISSUE-029 §5.4, §6.4 — Hireable adventurer module.
//
// Owns the weekly drift of `state.world.hireableAdventurers`:
//
//   - Soft cap starts at 4 and rises with `culinary_renown`
//     (40 → 5, 70 → 6). Hard cap 6.
//   - When roster size < soft cap, a new adventurer may join.
//     Arrival probability scales with how far under cap we are.
//   - When an existing adventurer has `daysSinceLastJob > 60` and
//     `relationship < 40`, they may leave.
//   - Every idle adventurer's `daysSinceLastJob` increments by 7
//     per week. Phase 70 resets the counter when an expedition
//     resolves.
//
// Roll uses the `adventurer_roster` named RNG stream so an extra
// service roll does not shift who comes and goes.

export const ADVENTURERS_MODULE_ID = 'adventurers'

const SOFT_CAP_BASE = 4
const SOFT_CAP_MAX = 6
const HARD_CAP = 6
const INACTIVITY_THRESHOLD_DAYS = 60
const LEAVE_RELATIONSHIP_CEILING = 40

function softCapForRenown(renown: number): number {
  let cap = SOFT_CAP_BASE
  if (renown >= 40) cap += 1
  if (renown >= 70) cap += 1
  return Math.min(cap, SOFT_CAP_MAX)
}

function pickNextAdventurerId(
  roster: Record<string, HireableAdventurer>,
  today: number,
): string {
  let counter = 0
  let candidate = `hireable_adv_drift_${today}_${counter}`
  while (roster[candidate]) {
    counter += 1
    candidate = `hireable_adv_drift_${today}_${counter}`
  }
  return candidate
}

const endWeekHook: SimulationHook = (ctx: SimContext): void => {
  const today = ctx.state.calendar.totalDaysElapsed + 1
  const rng = ctx.getRngStream('adventurer_roster')

  // 1. Increment idle counters for everyone not currently on a job.
  for (const adventurer of Object.values(ctx.state.world.hireableAdventurers)) {
    if (adventurer.currentExpeditionId !== null) continue
    ctx.modifyHireableAdventurer(
      adventurer.id,
      { daysSinceLastJob: adventurer.daysSinceLastJob + 7 },
      {
        source: `${ADVENTURERS_MODULE_ID}.weekly_idle_tick`,
        sourceType: 'system',
        readable: `${adventurer.name.display} idle ${adventurer.daysSinceLastJob + 7} days.`,
        tags: ['adventurer', 'idle_tick', adventurer.id],
        relatedActors: [{ kind: 'other', id: adventurer.id }],
        relatedSystems: ['adventurers'],
      },
    )
  }

  // 2. Possibly drift out a long-inactive adventurer.
  const eligibleLeavers = Object.values(
    ctx.state.world.hireableAdventurers,
  ).filter(
    (a) =>
      a.currentExpeditionId === null &&
      a.daysSinceLastJob > INACTIVITY_THRESHOLD_DAYS &&
      a.relationship < LEAVE_RELATIONSHIP_CEILING,
  )
  if (eligibleLeavers.length > 0 && rng.chance(0.6)) {
    const idx = rng.int(0, eligibleLeavers.length - 1)
    const leaver = eligibleLeavers[idx]!
    ctx.removeHireableAdventurer(leaver.id, {
      source: `${ADVENTURERS_MODULE_ID}.roster_drift`,
      sourceType: 'system',
      direction: 'decrease',
      amount: -1,
      readable: `${leaver.name.display} left the hireable roster after ${leaver.daysSinceLastJob} idle days.`,
      tags: ['adventurer', 'departure', leaver.id],
      relatedActors: [{ kind: 'other', id: leaver.id }],
      relatedSystems: ['adventurers'],
    })
    ctx.addMemory({
      id: 'adventurer_left_roster',
      source: ADVENTURERS_MODULE_ID,
      actors: [{ kind: 'other', id: leaver.id }],
      tags: ['adventurer', 'roster_drift', 'departed', leaver.id],
      metadata: {
        adventurerId: leaver.id,
        adventurerName: leaver.name.display,
        daysIdle: leaver.daysSinceLastJob,
      },
    })
  }

  // 3. Possibly grow the roster toward the soft cap.
  const renown = ctx.state.reputation.culinary_renown
  const softCap = softCapForRenown(renown)
  const currentSize = Object.keys(ctx.state.world.hireableAdventurers).length
  if (currentSize < softCap && currentSize < HARD_CAP) {
    const slack = softCap - currentSize
    const arrivalChance = Math.min(0.85, 0.35 + slack * 0.15)
    if (rng.chance(arrivalChance)) {
      const adventurerId = pickNextAdventurerId(
        ctx.state.world.hireableAdventurers,
        today,
      )
      const existingNames = new Set(
        Object.values(ctx.state.world.hireableAdventurers).map(
          (a) => a.name.display,
        ),
      )
      const identityRng = ctx.getRngStream('npc_identity')
      const { adventurer } = createHireableAdventurer({
        adventurerId,
        rng: identityRng,
        joinedDay: today,
        existingNames,
        experience: 30 + rng.int(0, 25),
        reliability: 35 + rng.int(0, 20),
        relationship: 25 + rng.int(0, 15),
        wageBase: 3 + rng.int(0, 3),
        tags: ['drift_arrival'],
      })
      ctx.addHireableAdventurer(adventurer, {
        source: `${ADVENTURERS_MODULE_ID}.roster_drift`,
        sourceType: 'system',
        direction: 'increase',
        amount: 1,
        readable: `${adventurer.name.display} joined the hireable roster (culinary renown ${renown}).`,
        tags: ['adventurer', 'arrival', adventurer.id],
        relatedActors: [{ kind: 'other', id: adventurer.id }],
        relatedSystems: ['adventurers'],
      })
      ctx.addMemory({
        id: 'adventurer_joined_roster',
        source: ADVENTURERS_MODULE_ID,
        actors: [{ kind: 'other', id: adventurer.id }],
        tags: ['adventurer', 'roster_drift', 'arrived', adventurer.id],
        metadata: {
          adventurerId: adventurer.id,
          adventurerName: adventurer.name.display,
          renownAtArrival: renown,
        },
      })
    }
  }
}

function buildAdventurersReport(ctx: SimContext): ReportSection {
  const roster = Object.values(ctx.state.world.hireableAdventurers)
  const lines: string[] = []
  if (roster.length === 0) {
    lines.push('No hireable adventurers available.')
  } else {
    for (const adventurer of roster) {
      const status = adventurer.currentExpeditionId
        ? `on expedition ${adventurer.currentExpeditionId}`
        : `idle ${adventurer.daysSinceLastJob}d`
      lines.push(
        `${adventurer.name.display} — exp ${adventurer.experience}, rel ${adventurer.reliability}, friend ${adventurer.relationship}, ${status}`,
      )
    }
  }
  return {
    id: ADVENTURERS_MODULE_ID,
    source: ADVENTURERS_MODULE_ID,
    title: 'Hireable Adventurers',
    lines,
  }
}

const AdventurersModuleStateSchema = z
  .object({})
  .passthrough()
  .optional()

export const adventurersModule: SimulationModule = {
  id: ADVENTURERS_MODULE_ID,
  version: '0.1.0',
  hooks: {
    endWeek: [endWeekHook],
  },
  buildReport: buildAdventurersReport,
  stateSchema: AdventurersModuleStateSchema,
}
