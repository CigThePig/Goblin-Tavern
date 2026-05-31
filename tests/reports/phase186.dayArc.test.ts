// Phase 186 / Day-Clock Cluster 6 — Report-as-unfolding.
//
// The daily report now narrates the day across its three real engine
// segments via `dayArc`: opening (your morning owner moves) → service
// (the day playing out) → reckoning (the cards you answered at the
// service-react pause). These tests prove the arc faithfully re-homes
// the already-projected rich lines in segment order, invents no facts,
// omits empty movements, and routes its connective voice per movement.

import { describe, expect, it } from 'vitest'

import { runOneDay, runOneWeek } from '../../src/sim/testing/simRunner'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import { buildDailyReport } from '../../src/reports/dailyReportProjection'
import { dayArcLineSnippets } from '../../src/reports/compose/pools/dayArc/line'
import type {
  DayArcEntry,
  DayArcMovementId,
} from '../../src/reports/types'

const SEED_PREFIX = 'tests/reports/dayArc'

const MOVEMENT_ORDER: DayArcMovementId[] = ['opening', 'service', 'reckoning']

function snippetTextsFor(tag: string): Set<string> {
  // The arc snippets gate purely on a single `hasTag` of the movement id
  // (data conditions, framework §2.3), so a movement's eligible text set
  // is every snippet whose conditions are all `hasTag` of that tag.
  const texts = new Set<string>()
  for (const s of dayArcLineSnippets) {
    const eligible = s.conditions.every(
      (c) => c.kind === 'hasTag' && c.tag === tag,
    )
    if (eligible) texts.add(s.text)
  }
  return texts
}

describe('buildDailyReport — day arc', () => {
  it('orders present movements opening → service → reckoning', () => {
    const initial = createInitialTavernState()
    const result = runOneDay(initial, {
      seed: `${SEED_PREFIX}.order`,
      ownerActions: [{ actionId: 'clean_area', targetId: 'main_room' }],
    })
    const report = buildDailyReport(result, result.state)

    const ids = report.dayArc.map((m) => m.id)
    // Whatever subset is present must be a subsequence of the canonical
    // order — never out of order, never duplicated.
    const expected = MOVEMENT_ORDER.filter((id) => ids.includes(id))
    expect(ids).toEqual(expected)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('an owner action lands in the opening movement as an owner_action entry', () => {
    const initial = createInitialTavernState()
    const result = runOneDay(initial, {
      seed: `${SEED_PREFIX}.opening`,
      ownerActions: [{ actionId: 'clean_area', targetId: 'main_room' }],
    })
    const report = buildDailyReport(result, result.state)

    const opening = report.dayArc.find((m) => m.id === 'opening')
    expect(opening).toBeDefined()
    const actionIds = opening!.entries
      .filter((e): e is Extract<DayArcEntry, { kind: 'owner_action' }> => e.kind === 'owner_action')
      .map((e) => e.action.actionId)
    expect(actionIds).toContain('clean_area')
  })

  it('arc entries reproduce the flat projection fields exactly (no facts lost or invented)', () => {
    const run = runOneWeek({ seed: `${SEED_PREFIX}.equiv` })
    const last = run.days.at(-1)!
    const report = buildDailyReport(last.result, last.result.state)

    const arcOwnerActions = report.dayArc
      .flatMap((m) => m.entries)
      .filter((e) => e.kind === 'owner_action')
      .map((e) => (e as Extract<DayArcEntry, { kind: 'owner_action' }>).action)
    const arcServiceLines = report.dayArc
      .flatMap((m) => m.entries)
      .filter((e) => e.kind === 'service')
      .map((e) => (e as Extract<DayArcEntry, { kind: 'service' }>).line)
    const arcIntents = report.dayArc
      .flatMap((m) => m.entries)
      .filter((e) => e.kind === 'resolved_intent')
      .map((e) => (e as Extract<DayArcEntry, { kind: 'resolved_intent' }>).intent)

    expect(arcOwnerActions).toEqual(report.ownerActionsApplied)
    expect(arcServiceLines).toEqual(report.serviceLines)
    expect(arcIntents).toEqual(report.resolvedIntents)
  })

  it('omits a movement exactly when its source lines are empty', () => {
    const initial = createInitialTavernState()
    // No owner actions, no response intents → no opening, no reckoning.
    const result = runOneDay(initial, { seed: `${SEED_PREFIX}.omit` })
    const report = buildDailyReport(result, result.state)

    const has = (id: DayArcMovementId) => report.dayArc.some((m) => m.id === id)
    expect(has('opening')).toBe(report.ownerActionsApplied.length > 0)
    expect(has('service')).toBe(report.serviceLines.length > 0)
    expect(has('reckoning')).toBe(report.resolvedIntents.length > 0)
    // Every present movement carries at least one entry.
    for (const m of report.dayArc) expect(m.entries.length).toBeGreaterThan(0)
  })

  it('routes each movement voice to its own snippet set and is deterministic', () => {
    const initial = createInitialTavernState()
    const input = {
      seed: `${SEED_PREFIX}.voice`,
      ownerActions: [{ actionId: 'clean_area', targetId: 'main_room' }],
    }
    const result = runOneDay(initial, input)
    const a = buildDailyReport(result, result.state)
    const b = buildDailyReport(result, result.state)

    for (const movement of a.dayArc) {
      if (!movement.voice) continue
      expect(snippetTextsFor(movement.id).has(movement.voice)).toBe(true)
      const same = b.dayArc.find((m) => m.id === movement.id)
      expect(same?.voice).toBe(movement.voice)
    }
  })

  it('does not mutate its inputs', () => {
    const run = runOneWeek({ seed: `${SEED_PREFIX}.purity` })
    const last = run.days.at(-1)!
    const before = JSON.stringify(last.result.state)
    buildDailyReport(last.result, last.result.state)
    expect(JSON.stringify(last.result.state)).toBe(before)
  })
})
