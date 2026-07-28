// Phase 204 / gameplay audit Wave 5 — secondary surfaces and identity.
//
// Regression coverage for the sim/projection half of the wave. Plan:
// docs/plans/phase-204-audit-wave-5-secondary-surfaces-and-identity.md.
//
//   P2-RT-002   two glossary terms share the id `atmosphere`, so the
//               glossary's keyed render aborts and no sheet opens
//   P2-RT-003   service-scene history rows carry their scene type twice,
//               so a populated Tavern Log hits the error boundary
//   P3-BHV-003  a fired staff member loses their name in the report
//               heading, because the label is resolved after removal
//   P4-SEAM-005 a newly seeded local arc reads three ways at month close
//
// `P6-COMP-007` (vocabulary) is a surface finding and lives in
// tests/web/phase204.wave5.vocabulary.test.ts.

import { describe, expect, it } from 'vitest'

import { simulateDay } from '../../src/sim/core/engine'
import { FULL_PIPELINE } from '../../src/sim/canonicalPipeline'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import { safeValidateState } from '../../src/sim/state/validation'
import type { SimInput } from '../../src/sim/core/context'
import type { TavernState } from '../../src/sim/state/TavernState'
import { GLOSSARY_TERMS } from '../../src/reports/glossary'
import { buildTavernLog } from '../../src/reports/tavernLogProjection'
import { buildDailyReport } from '../../src/reports/dailyReportProjection'
import { buildMonthlyOverview } from '../../src/reports/monthlyOverviewProjection'
import { getOwnerActionsModuleState } from '../../src/sim/modules/ownerActions/stateHelpers'
import { FIRE_STAFF_ACTION_ID } from '../../src/sim/modules/ownerActions/staffManagementActions'
import {
  listActiveArcs,
  listPresentedArcs,
} from '../../src/sim/modules/localArcs/arcEngine'

const SEED = 'phase204-wave5'
/** The audit's Phase 4 periodic-trace seed, which reaches a month close. */
const ARC_SEED = 'phase4-periodic-fixed'

function runDay(state: TavernState, overrides: Partial<SimInput> = {}) {
  return simulateDay(state, { seed: SEED, ...overrides }, FULL_PIPELINE)
}

// ── P2-RT-002 — the glossary can be keyed by term id ────────────────

describe('P2-RT-002 — every glossary term has a unique id', () => {
  it('has no duplicate ids', () => {
    const seen = new Map<string, number>()
    for (const term of GLOSSARY_TERMS) {
      seen.set(term.id, (seen.get(term.id) ?? 0) + 1)
    }
    const duplicates = [...seen.entries()]
      .filter(([, count]) => count > 1)
      .map(([id]) => id)
    // The audit's crash: two `mechanic` entries both called `atmosphere`,
    // so `{#each … (term.id)}` aborted and the sheet never opened.
    expect(duplicates).toEqual([])
  })

  it('keeps both atmosphere concepts, under distinct ids', () => {
    const ids = new Set(GLOSSARY_TERMS.map((t) => t.id))
    // The area's tonal tags…
    expect(ids.has('atmosphere')).toBe(true)
    // …and what the tavern as a whole feels like today. Different
    // concepts, and two different components link to them.
    expect(ids.has('tavern_atmosphere')).toBe(true)
  })
})

// ── P2-RT-003 — a populated Tavern Log renders ──────────────────────

describe('P2-RT-003 — history tags are unique per entry', () => {
  it('writes no duplicate tag on any history entry', () => {
    let state = createInitialTavernState()
    for (let day = 0; day < 3; day += 1) {
      state = runDay(state, { seed: `${SEED}-log-${day}` }).state
    }
    expect(state.history.length).toBeGreaterThan(0)

    // The audit's row: tags `service, scene, unpaid_tab_argument,
    // service_scene, unpaid_tab_argument, local_goblins` — the scene type
    // arrived once from the composition and once from `scene.tags`.
    const offenders = state.history
      .filter((e) => new Set(e.tags).size !== e.tags.length)
      .map((e) => ({ id: e.id, tags: e.tags }))
    expect(offenders).toEqual([])
  })

  it('projects unique tags even from a save that already holds duplicates', () => {
    const base = createInitialTavernState()
    const state: TavernState = {
      ...base,
      history: [
        {
          id: 'h-0-2',
          timestamp: {
            year: base.calendar.year,
            month: base.calendar.month,
            week: base.calendar.week,
            day: base.calendar.day,
            absoluteDay: base.calendar.totalDaysElapsed,
          },
          category: 'service',
          summary: 'Unpaid tabs caused friction (26 coin).',
          tags: [
            'service',
            'scene',
            'unpaid_tab_argument',
            'service_scene',
            'unpaid_tab_argument',
            'local_goblins',
          ],
          relatedActors: [],
          relatedLocations: [],
          relatedSystems: ['service'],
          mechanicalRefs: [],
        },
      ],
    }

    // Wave 0 made these saves survive a reload; they must also render.
    const log = buildTavernLog(state)
    const row = log.rows.find((r) => r.id === 'h-0-2')
    expect(row).toBeDefined()
    expect(new Set(row!.tags).size).toBe(row!.tags.length)
    expect(row!.tags).toContain('unpaid_tab_argument')
  })
})

// ── P3-BHV-003 — a removed target keeps its name ────────────────────

describe('P3-BHV-003 — firing staff keeps the name in the report', () => {
  function fireableStaffId(state: TavernState): string {
    // Hire first so there is someone dismissible (founding roles are not).
    const hired = runDay(state, {
      ownerActions: [{ actionId: 'hire_staff', targetId: 'kitchen_hand' }],
    })
    const before = new Set(Object.keys(state.staff))
    const added = Object.keys(hired.state.staff).find((id) => !before.has(id))
    if (!added) throw new Error('hire_staff added nobody')
    return added
  }

  it('names the person in the applied record and the report', () => {
    const start = createInitialTavernState()
    const hired = runDay(start, {
      ownerActions: [{ actionId: 'hire_staff', targetId: 'kitchen_hand' }],
    })
    const staffId = fireableStaffId(start)
    const displayName = hired.state.staff[staffId]!.name.display
    expect(displayName.length).toBeGreaterThan(0)

    const fired = runDay(hired.state, {
      seed: `${SEED}-fire`,
      ownerActions: [{ actionId: FIRE_STAFF_ACTION_ID, targetId: staffId }],
    })

    // The record is gone — that is the point of the action.
    expect(fired.state.staff[staffId]).toBeUndefined()

    // …but the label was captured while it still existed.
    const applied = getOwnerActionsModuleState(fired.state).applied.find(
      (a) => a.actionId === FIRE_STAFF_ACTION_ID,
    )
    expect(applied).toBeDefined()
    expect(applied!.targetLabel).toBe(displayName)

    // The audit's heading read `Fired Staff · Hire kitchen hand 4 0 (2h)`
    // — `humanizeId` of a dead lookup.
    const report = buildDailyReport(fired, fired.state)
    const line = report.ownerActionsApplied.find(
      (l) => l.actionId === FIRE_STAFF_ACTION_ID,
    )
    expect(line).toBeDefined()
    expect(line!.targetLabel).toBe(displayName)
    expect(safeValidateState(fired.state).success).toBe(true)
  })

  it('captures a label for ordinary actions too, not just removals', () => {
    const state = createInitialTavernState()
    const result = runDay(state, {
      ownerActions: [{ actionId: 'clean_area', targetId: 'main_room' }],
    })
    const applied = getOwnerActionsModuleState(result.state).applied.find(
      (a) => a.actionId === 'clean_area',
    )
    expect(applied?.targetLabel).toBe(state.areas['main_room']!.label)
  })
})

// ── P4-SEAM-005 — one age, one presence, for a local arc ────────────

describe('P4-SEAM-005 — a seeded arc reads the same everywhere', () => {
  /**
   * The audit's route: run naturally through the first month close on
   * `phase4-periodic-fixed`, which seeds Rival Tavern Expansion on day 27
   * and leaves it `seeded` while the calendar moves past its creating day.
   */
  function runToFirstArc(): { state: TavernState; result: ReturnType<typeof runDay> } {
    let state = createInitialTavernState()
    let result = runDay(state, { seed: ARC_SEED })
    for (let day = 0; day < 32; day += 1) {
      result = simulateDay(state, { seed: ARC_SEED }, FULL_PIPELINE)
      state = result.state
      if (listPresentedArcs(state).length > 0) return { state, result }
    }
    throw new Error('no local arc seeded within the first month')
  }

  it('separates "in play" from "counts against the seeding cap"', () => {
    const { state } = runToFirstArc()
    const presented = listPresentedArcs(state)
    expect(presented.length).toBeGreaterThan(0)
    expect(presented.some((a) => a.stage === 'seeded')).toBe(true)

    // The engine's cap predicate is unchanged — a seeded arc still does
    // not occupy one of the MAX_ACTIVE_LOCAL_ARCS slots. Changing that
    // would change when arcs seed, which is gameplay, not presentation.
    expect(listActiveArcs(state).every((a) => a.stage !== 'seeded')).toBe(true)
  })

  it('agrees on age and presence across state, report and overview', () => {
    const { state, result } = runToFirstArc()
    const arc = listPresentedArcs(state).find((a) => a.stage === 'seeded')
    expect(arc).toBeDefined()

    // 1. Canonical state.
    const canonicalAge = arc!.ageDays ?? 0
    expect(canonicalAge).toBe(0)

    // 2. The engine's Local Arcs report section — said `(none)` before.
    const section = result.reports.find((r) => r.id === 'localArcs')
    expect(section).toBeDefined()
    const sectionArcs =
      (section!.data?.['activeArcs'] as { id: string; ageDays: number }[]) ?? []
    const inSection = sectionArcs.find((a) => a.id === arc!.id)
    expect(inSection).toBeDefined()
    expect(inSection!.ageDays).toBe(canonicalAge)

    // 3. The monthly overview — said age 1 before, because it recomputed
    //    `totalDaysElapsed - startedDay` after the calendar had advanced.
    const overview = buildMonthlyOverview(state)
    const projected = (overview.arcs ?? []).find((a) => a.id === arc!.id)
    expect(projected).toBeDefined()
    expect(projected!.ageDays).toBe(canonicalAge)
    expect(projected!.stage).toBe(arc!.stage)
  })
})
