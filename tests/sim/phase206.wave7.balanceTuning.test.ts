// Phase 206 / gameplay-audit Wave 7 — regression cover for the balance
// tuning pass.
//
// Wave 7's sweep (npm run balance:matrix) surfaced three saturation
// mechanisms that made whole meters carry no signal, plus the re-opened
// `DC-06` recurrence gap. Each fix here follows the audit workflow:
// reproduced on its route before the fix (the numbers are in the queue's
// Wave 7 section), fixed, and pinned by an assertion that fails on the
// pre-fix build:
//
//   1. `shouldRestFamily`'s answered-thread exemption is CAPPED
//      (`ANSWERED_FAMILY_STREAK_LIMIT`) for ordinary families — the
//      uncapped Wave 6 exemption ran `staff_identity` 17–26 consecutive
//      days on every route that answered cards.
//   2. Social rumours DECAY daily (`worldModule`) — nothing ever reduced
//      strength, so `rumour_pressure` pinned at 100 on all 360 sweep
//      cells.
//   3. Attributions merge by NARRATIVE (perceiver, target, type, tags) —
//      the old key included per-incident cause ids, so one recurring
//      belief stacked 612 live copies against one server and pinned
//      `staff_loyalty_risk` at 100 everywhere. The merge also required
//      breaking the belief→cause→belief feedback loop (rules no longer
//      consume the attribution layer's own causes; threshold causes fire
//      on crossing, not daily).
//   4. Pressure snapshots re-sync with compact values at the end of
//      Segment A — Morning-phase writers (arcs, suppliers) moved compact
//      values that the snapshot pass only reconciled at `closing`,
//      which the per-segment §8.2 check surfaced on every managed route.

import { describe, expect, it } from 'vitest'

import {
  ANSWERED_FAMILY_STREAK_LIMIT,
  FAMILY_STREAK_LIMIT,
} from '../../src/sim/modules/issues/handBudget'
import { shouldRestFamily } from '../../src/sim/modules/issues/issueThreads'
import {
  RUMOUR_DAILY_RETENTION,
  RUMOUR_SPREADING_RETENTION,
  RUMOUR_FADE_FLOOR,
} from '../../src/sim/modules/world/worldModule'
import type {
  IssueSeed,
  IssueThreadState,
} from '../../src/sim/modules/issues/issueSeedTypes'
import { runBalanceScenario } from '../../src/sim/testing/balanceHarness'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import { simulateDay } from '../../src/sim/core/engine'
import { FULL_PIPELINE } from '../../src/sim/canonicalPipeline'

const streakOf = (days: number): { family: string; lastSurfacedDay: number; consecutiveDays: number; lastSeverity: number } => ({
  family: 'staff_identity',
  lastSurfacedDay: 9,
  consecutiveDays: days,
  lastSeverity: 40,
})

const answeredThread: IssueThreadState = {
  key: 'staff_identity:staff:server',
  family: 'staff_identity',
  firstSurfacedDay: 5,
  lastSurfacedDay: 9,
  timesSurfaced: 5,
  lastSeverity: 40,
  peakSeverity: 40,
  triedSlotIds: ['slot_a'],
  lastAnsweredDay: 9,
}

const calmSeed = { family: 'staff_identity', severity: 40, urgency: 20 } as IssueSeed

describe('Wave 7 — the answered-thread exemption is capped (DC-06 re-opened)', () => {
  it('an answered ordinary thread still comes back below the cap', () => {
    expect(
      shouldRestFamily(streakOf(FAMILY_STREAK_LIMIT), calmSeed, 10, answeredThread),
    ).toBe(false)
    expect(
      shouldRestFamily(
        streakOf(ANSWERED_FAMILY_STREAK_LIMIT - 1),
        calmSeed,
        10,
        answeredThread,
      ),
    ).toBe(false)
  })

  it('at the cap, an answered ordinary family rests like any other', () => {
    expect(
      shouldRestFamily(
        streakOf(ANSWERED_FAMILY_STREAK_LIMIT),
        calmSeed,
        10,
        answeredThread,
      ),
    ).toBe(true)
  })

  it('teleology families stay exempt — daily investment is their loop', () => {
    const ventureSeed = { family: 'venture', severity: 40, urgency: 20 } as IssueSeed
    const ventureThread: IssueThreadState = {
      ...answeredThread,
      key: 'venture:global',
      family: 'venture',
    }
    expect(
      shouldRestFamily(
        { ...streakOf(ANSWERED_FAMILY_STREAK_LIMIT + 5), family: 'venture' },
        ventureSeed,
        10,
        ventureThread,
      ),
    ).toBe(false)
  })

  it('material worsening still overrides everything', () => {
    const worse = { family: 'staff_identity', severity: 60, urgency: 20 } as IssueSeed
    expect(
      shouldRestFamily(
        streakOf(ANSWERED_FAMILY_STREAK_LIMIT + 2),
        worse,
        10,
        answeredThread,
      ),
    ).toBe(false)
  })

  it('an answering 28-day route no longer runs one family for weeks', () => {
    // Pre-fix: 19 consecutive days of `staff_identity` on this exact
    // route (baselines/pre-wave7-standard.json). Escalations can extend a
    // streak legitimately, so the bound allows a little past the cap but
    // fails the old build by an order of magnitude.
    const run = runBalanceScenario({
      botId: 'auto_staff_friendly',
      days: 28,
      seed: 'phase7-integrated-shared',
      difficulty: 'standard',
      ownerActions: 'bot',
      responses: 'all',
    })
    const perDay = run.days.map((day) => new Set(day.families))
    const families = new Set(run.days.flatMap((day) => day.families))
    for (const family of families) {
      if (family === 'venture' || family === 'opening') continue
      let streak = 0
      let longest = 0
      for (const day of perDay) {
        streak = day.has(family) ? streak + 1 : 0
        longest = Math.max(longest, streak)
      }
      expect(
        longest,
        `family ${family} ran ${longest} consecutive days on an answering route`,
      ).toBeLessThanOrEqual(ANSWERED_FAMILY_STREAK_LIMIT + 2)
    }
  })
})

describe('Wave 7 — social rumours decay daily', () => {
  it('fades every rumour by the retention factor and drops the faded', () => {
    const state = createInitialTavernState()
    state.world.socialRumours['strong_rumour'] = {
      id: 'strong_rumour',
      label: 'A strong rumour.',
      strength: 40,
      accuracy: 'partial',
      firstHeardDay: 0,
      lastSpreadDay: 0,
      tags: ['rumour'],
      involvedRefs: [],
    }
    state.world.socialRumours['faint_rumour'] = {
      id: 'faint_rumour',
      label: 'A faint rumour.',
      strength: RUMOUR_FADE_FLOOR,
      accuracy: 'true',
      firstHeardDay: 0,
      lastSpreadDay: 0,
      tags: ['rumour'],
      involvedRefs: [],
    }

    const result = simulateDay(state, { seed: 'wave7-rumour-decay' }, FULL_PIPELINE)
    const strong = result.state.world.socialRumours['strong_rumour']
    expect(strong).toBeDefined()
    expect(strong!.strength).toBeGreaterThan(0)

    // Expansion Phase 8 §8.4 — a rumour can now be REPEATED, and one that
    // travelled today fades at `RUMOUR_SPREADING_RETENTION` rather than the
    // silent rate (and gains from the retelling on the way). The Wave 7
    // property was never "every rumour is smaller tomorrow" — it is that
    // unfed talk moves on instead of accumulating until the meter pins. So
    // each rate is asserted against the rumour it actually applies to, and
    // then both stories are followed to their end.
    const dayJustRun = result.state.calendar.totalDaysElapsed - 1
    const faint = result.state.world.socialRumours['faint_rumour']
    if (strong!.lastSpreadDay !== dayJustRun) {
      expect(strong!.strength).toBeLessThanOrEqual(40 * RUMOUR_DAILY_RETENTION)
    } else {
      // Being repeated is what keeps a story louder than silence would.
      expect(strong!.strength).toBeGreaterThan(40 * RUMOUR_DAILY_RETENTION)
      expect(strong!.strength).toBeLessThan(40 / RUMOUR_SPREADING_RETENTION + 10)
    }
    // 5 × 0.95 = 4.75 < floor — a rumour this faint that nobody picked up
    // stops existing rather than idling below the floor.
    if (faint) {
      expect(faint.lastSpreadDay).toBe(dayJustRun)
    }

    let later = result.state
    for (let day = 1; day < 30; day += 1) {
      later = simulateDay(later, { seed: `wave7-rumour-decay/${day}` }, FULL_PIPELINE).state
    }
    expect(
      later.world.socialRumours['strong_rumour'],
      'a rumour nobody kept feeding was still going a month later',
    ).toBeUndefined()
    expect(later.world.socialRumours['faint_rumour']).toBeUndefined()
  })

  it('keeps rumour pressure off the ceiling on the audit route', () => {
    // Pre-fix: pinned at 100 from day 8 to day 28 (21–25 days at the
    // ceiling on every sweep cell). Post-fix the weekly community pass
    // still spikes it, but decay pulls it back between passes.
    const run = runBalanceScenario({
      botId: 'auto_no_owner_actions',
      days: 28,
      seed: 'phase7-integrated-shared',
      difficulty: 'standard',
      ownerActions: 'none',
      responses: 'none',
    })
    const values = run.days.map((day) => day.pressures['rumour_pressure'] ?? 0)
    const daysAtCeiling = values.filter((value) => value >= 100).length
    expect(daysAtCeiling).toBeLessThanOrEqual(8)
    expect(values[values.length - 1]).toBeLessThan(90)
  })
})

describe('Wave 7 — attributions merge by narrative and stay bounded', () => {
  it('never holds two live attributions for one narrative, and stays small', () => {
    const run = runBalanceScenario({
      botId: 'auto_staff_friendly',
      days: 28,
      seed: 'phase7-integrated-shared',
      difficulty: 'standard',
      ownerActions: 'bot',
      responses: 'all',
    })
    const slice = run.finalState.modules['attribution'] as {
      attributions: Array<{
        perceivedBy: { kind: string; id: string }
        target: { kind: string; id: string }
        attributionType: string
        tags: string[]
      }>
    }
    const keys = slice.attributions.map(
      (a) =>
        `${a.perceivedBy.kind}|${a.perceivedBy.id}|${a.target.kind}|${a.target.id}|${a.attributionType}|${[...a.tags].sort().join(',')}`,
    )
    expect(new Set(keys).size).toBe(keys.length)
    // Pre-fix this route held 858 live attributions (612 copies of one
    // belief against one server). Narrative-keyed, the live set is
    // bounded by distinct beliefs.
    expect(slice.attributions.length).toBeLessThan(150)

    // And the meter the stacking pinned now carries signal: pre-fix,
    // staff_loyalty_risk ended AND peaked at 100 on all 360 sweep cells.
    const peak = Math.max(
      ...run.days.map((day) => day.pressures['staff_loyalty_risk'] ?? 0),
    )
    expect(peak).toBeLessThan(100)
  })

  it('holds the §8.2 invariants at every segment on a managed route', () => {
    // The per-segment invariant check (Codex review of PR #242) found
    // compact-vs-snapshot divergence at the Morning pause on every
    // managed route — 14–22 failures per 28-day run — because Segment A
    // writers (arcs, suppliers) moved compact values that the snapshot
    // pass only reconciled at `closing`. The Segment A sync hook closes
    // the seam; this run fails without it.
    const run = runBalanceScenario({
      botId: 'auto_profit_focused',
      days: 28,
      seed: 'phase7-integrated-shared',
      difficulty: 'standard',
      ownerActions: 'bot',
      responses: 'all',
    })
    expect(run.days.flatMap((day) => day.invariantFailures)).toEqual([])
    expect(run.days.every((day) => day.validationErrorCount === 0)).toBe(true)
  })
})
