// Phase 201 / gameplay audit Wave 2 — authoritative causality.
//
// Sim-side half of the wave's regression coverage. Plan:
// docs/plans/phase-201-audit-wave-2-authoritative-causality.md.
//
//   P5-PLAY-003  issue evidence crosses actor/location boundaries
//   P4-SEAM-004  the seasonal-arc card absorbs staff-arc causes
//   P5-PLAY-004  Fix Root repairs a rotated room, not the cited one
//   P7-EXP-003   coaching recommends destructive choices
//
// Closed-report immutability (`P4-SEAM-002`, `P6-COMP-006`) needs the web
// store's day boundary and lives in
// tests/web/phase201.wave2.closedReports.test.ts.

import { describe, expect, it } from 'vitest'

import { simulateDay } from '../../src/sim/core/engine'
import { FULL_PIPELINE } from '../../src/sim/canonicalPipeline'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import type { SimInput } from '../../src/sim/core/context'
import type { EntityRef, TavernState } from '../../src/sim/state/TavernState'
import type { IssueSeed } from '../../src/sim/modules/issues/issueSeedTypes'
import { getIssueSeeds } from '../../src/sim/modules/issues/issueSeedQueries'
import { withArea, withCustomerGroup, withStock } from '../../src/sim/testing/stateFactories'
import { profileUtility } from '../../src/sim/modules/issues/impactScoring'

const SEED = 'phase201-wave2'

function input(overrides: Partial<SimInput> = {}): SimInput {
  return { seed: SEED, ...overrides }
}

function runDay(state: TavernState, overrides: Partial<SimInput> = {}) {
  return simulateDay(state, input(overrides), FULL_PIPELINE)
}

function plentyOfStock(state: TavernState): TavernState {
  let next = withStock(state, 'ale', { quantity: 800, quality: 60 })
  next = withStock(next, 'stew', { quantity: 400, quality: 60 })
  next = withStock(next, 'mushrooms', { quantity: 200 })
  return next
}

/** Every entity the seed itself is about. */
function subjectRefs(seed: IssueSeed): EntityRef[] {
  return [
    ...(seed.primaryActor ? [seed.primaryActor] : []),
    ...(seed.location ? [seed.location] : []),
    ...seed.affectedActors,
  ]
}

/** Ids named by a cause, from tags and from its entity refs. */
function namedEntityIds(cause: {
  tags: string[]
  relatedActors: EntityRef[]
  relatedLocations: EntityRef[]
}): Set<string> {
  const out = new Set<string>(cause.tags)
  for (const ref of cause.relatedActors) out.add(ref.id)
  for (const ref of cause.relatedLocations) out.add(ref.id)
  return out
}

// ──────────────────────────────────────────────────────────────────
// P5-PLAY-003 — evidence stays with its actor and its room

describe('P5-PLAY-003 — issue evidence never crosses identity', () => {
  /**
   * Drive a world where two customer groups, two staff members and two
   * rooms all have simultaneous problems, so any-tag matching has
   * something wrong to reach for.
   */
  function contestedState(): TavernState {
    let state = plentyOfStock(createInitialTavernState())
    state = withArea(state, 'main_room', { cleanliness: 8, mess: 85, smell: 70 })
    state = withArea(state, 'private_booth', {
      cleanliness: 12,
      mess: 80,
      damage: 60,
    })
    for (const id of Object.keys(state.customerGroups)) {
      state = withCustomerGroup(state, id, { satisfaction: 18, patronage: 60 })
    }
    return state
  }

  it('customer complaints cite only their own group and rooms', () => {
    let state = contestedState()
    const failures: string[] = []

    for (let day = 0; day < 6; day++) {
      state = runDay(state).state
      for (const seed of getIssueSeeds(state, { family: 'customer_complaint' })) {
        const subjectIds = new Set<string>(subjectRefs(seed).map((r) => r.id))
        const otherGroups = Object.keys(state.customerGroups).filter(
          (id) => !subjectIds.has(id),
        )
        for (const cause of seed.causes) {
          const named = namedEntityIds(cause)
          for (const foreign of otherGroups) {
            if (named.has(foreign)) {
              failures.push(
                `day ${day + 1} ${seed.id}: cites foreign group ${foreign} — "${cause.readable}"`,
              )
            }
          }
        }
      }
    }
    expect(failures.slice(0, 8)).toEqual([])
  })

  it('staff cards cite only their own staff member', () => {
    let state = contestedState()
    const failures: string[] = []

    for (let day = 0; day < 6; day++) {
      state = runDay(state).state
      for (const seed of getIssueSeeds(state, {})) {
        const staffSubjects = subjectRefs(seed)
          .filter((ref) => ref.kind === 'staff')
          .map((ref) => ref.id)
        if (staffSubjects.length === 0) continue
        const otherStaff = Object.keys(state.staff).filter(
          (id) => !staffSubjects.includes(id),
        )
        for (const cause of seed.causes) {
          const named = namedEntityIds(cause)
          for (const foreign of otherStaff) {
            if (named.has(foreign)) {
              failures.push(
                `day ${day + 1} ${seed.id}: cites foreign staff ${foreign} — "${cause.readable}"`,
              )
            }
          }
        }
      }
    }
    expect(failures.slice(0, 8)).toEqual([])
  })

  it('area-anchored cards cite only their own room', () => {
    let state = contestedState()
    const failures: string[] = []

    for (let day = 0; day < 6; day++) {
      state = runDay(state).state
      for (const seed of getIssueSeeds(state, { family: 'area_atmosphere' })) {
        const rooms = subjectRefs(seed)
          .filter((ref) => ref.kind === 'area')
          .map((ref) => ref.id)
        if (rooms.length === 0) continue
        const otherRooms = Object.keys(state.areas).filter(
          (id) => !rooms.includes(id),
        )
        for (const cause of seed.causes) {
          const named = namedEntityIds(cause)
          for (const foreign of otherRooms) {
            if (named.has(foreign)) {
              failures.push(
                `day ${day + 1} ${seed.id}: cites foreign room ${foreign} — "${cause.readable}"`,
              )
            }
          }
        }
      }
    }
    expect(failures.slice(0, 8)).toEqual([])
  })
})

// ──────────────────────────────────────────────────────────────────
// P4-SEAM-004 — seasonal arc keeps its own evidence

describe('P4-SEAM-004 — seasonal-arc cards do not absorb staff-arc causes', () => {
  it('never carries only teleology/staff-arc evidence', () => {
    let state = plentyOfStock(createInitialTavernState())
    const failures: string[] = []

    for (let day = 0; day < 14; day++) {
      state = runDay(state).state
      for (const seed of getIssueSeeds(state, { family: 'seasonal_arc' })) {
        if (seed.causes.length === 0) continue
        const allStaffArc = seed.causes.every(
          (cause) =>
            cause.tags.includes('staff_arc') ||
            cause.tags.includes('teleology') ||
            (cause.relatedActors ?? []).some((ref) => ref.kind === 'staff'),
        )
        if (allStaffArc) {
          failures.push(
            `day ${day + 1} ${seed.id}: every cause is staff-arc — "${seed.causes[0]?.readable}"`,
          )
        }
        // And no individual cause should be a staff-arc one at all.
        for (const cause of seed.causes) {
          if (cause.tags.includes('staff_arc')) {
            failures.push(`day ${day + 1} ${seed.id}: staff-arc cause "${cause.readable}"`)
          }
        }
      }
    }
    expect(failures.slice(0, 8)).toEqual([])
  })
})

// ──────────────────────────────────────────────────────────────────
// P5-PLAY-004 — Fix Root repairs the cited room

describe('P5-PLAY-004 — Fix Root repairs the room the card cites', () => {
  /** The area id a complaint's `fix_root` profile actually writes to. */
  function fixRootAreaId(seed: IssueSeed): string | undefined {
    const profile = seed.consequenceProfiles.find(
      (candidate) => candidate.responseSlotId === 'fix_root',
    )
    for (const effect of profile?.immediateEffects ?? []) {
      const match = /^areas\.([^.]+)\./.exec(effect.target)
      if (match) return match[1]
    }
    return undefined
  }

  /** Rooms named by the seed's own cause evidence. */
  function citedRooms(seed: IssueSeed, areaIds: readonly string[]): Set<string> {
    const out = new Set<string>()
    for (const cause of seed.causes) {
      for (const ref of cause.relatedLocations ?? []) out.add(ref.id)
      for (const tag of cause.tags) if (areaIds.includes(tag)) out.add(tag)
    }
    return out
  }

  it('targets a room its own evidence names, with two rooms dirty', () => {
    let state = plentyOfStock(createInitialTavernState())
    state = withArea(state, 'main_room', { cleanliness: 5, mess: 90, smell: 80 })
    state = withArea(state, 'private_booth', { cleanliness: 10, mess: 85 })
    for (const id of Object.keys(state.customerGroups)) {
      state = withCustomerGroup(state, id, { satisfaction: 15, patronage: 70 })
    }

    const areaIds = Object.keys(state.areas)
    const failures: string[] = []
    let checked = 0

    for (let day = 0; day < 7; day++) {
      state = runDay(state).state
      for (const seed of getIssueSeeds(state, { family: 'customer_complaint' })) {
        const repaired = fixRootAreaId(seed)
        if (!repaired) continue
        const cited = citedRooms(seed, areaIds)
        if (cited.size === 0) continue // no room in evidence — rotation is fair
        checked += 1
        if (!cited.has(repaired)) {
          failures.push(
            `day ${day + 1} ${seed.id}: repairs ${repaired}, cites ${[...cited].join('/')}`,
          )
        }

        // The slot's own target options must offer the room it repairs,
        // so preview and application cannot name different places.
        const slot = seed.responseSlots.find((s) => s.id === 'fix_root')
        expect(
          slot?.targetOptions.some((t) => t.id === repaired),
          `${seed.id}: fix_root targets ${repaired}, options ${slot?.targetOptions.map((t) => t.id).join('/')}`,
        ).toBe(true)

        // And the room it repairs must be one that actually needs it —
        // the audit's Fix Root cleaned a tidy Private Booth while the
        // filthy Main Room it cited kept getting worse.
        const customerFacing = Object.values(state.areas).filter((a) =>
          a.tags.includes('customer_facing'),
        )
        const badness = (a: (typeof customerFacing)[number]) =>
          100 - a.cleanliness + a.mess + a.damage + a.smell
        const worst = Math.max(...customerFacing.map(badness))
        const repairedArea = state.areas[repaired]!
        expect(
          worst - badness(repairedArea),
          `${seed.id}: repairs ${repaired} (badness ${badness(repairedArea)}) while worst is ${worst}`,
        ).toBeLessThan(15)
      }
    }

    expect(checked, 'no fix_root complaint surfaced to check').toBeGreaterThan(0)
    expect(failures.slice(0, 8)).toEqual([])
  })
})

// ──────────────────────────────────────────────────────────────────
// P7-EXP-003 — magnitude is not desirability

describe('P7-EXP-003 — harmful choices are not coached as opportunities', () => {
  it('scores a harmful profile below a smaller beneficial one', () => {
    const harmful = {
      id: 'blame_profile',
      responseSlotId: 'blame',
      immediateEffects: [
        {
          kind: 'state_change' as const,
          target: 'staff.server.loyalty',
          amount: -20,
          readable: 'Loyalty falls hard',
          tags: ['staff'],
          targetKind: 'staff' as const,
          direction: 'negative' as const,
        },
        {
          kind: 'state_change' as const,
          target: 'staff.server.morale',
          amount: -12,
          readable: 'Morale falls',
          tags: ['staff'],
          targetKind: 'staff' as const,
          direction: 'negative' as const,
        },
      ],
      delayedEffects: [],
      memories: [],
      futureHooks: [],
    }
    const helpful = {
      id: 'support_profile',
      responseSlotId: 'support',
      immediateEffects: [
        {
          kind: 'state_change' as const,
          target: 'staff.server.morale',
          amount: 6,
          readable: 'Morale steadies',
          tags: ['staff'],
          targetKind: 'staff' as const,
          direction: 'positive' as const,
        },
      ],
      delayedEffects: [],
      memories: [],
      futureHooks: [],
    }

    // Magnitude still ranks the blame higher — that is what impactScore
    // is for. Utility must not.
    expect(profileUtility(harmful)).toBeLessThan(0)
    expect(profileUtility(helpful)).toBeGreaterThan(0)
    expect(profileUtility(helpful)).toBeGreaterThan(profileUtility(harmful))
  })

  it('treats a relief on a lower-is-better meter as beneficial', () => {
    // Phase 164 valence: -8 stress is good for the player. Utility must
    // read the effect's `direction`, not the arithmetic sign.
    const relief = {
      id: 'rest_profile',
      responseSlotId: 'rest',
      immediateEffects: [
        {
          kind: 'state_change' as const,
          target: 'staff.server.stress',
          amount: -8,
          readable: 'Stress eases',
          tags: ['staff'],
          targetKind: 'staff' as const,
          direction: 'positive' as const,
        },
      ],
      delayedEffects: [],
      memories: [],
      futureHooks: [],
    }
    expect(profileUtility(relief)).toBeGreaterThan(0)
  })
})
