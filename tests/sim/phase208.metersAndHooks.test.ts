// Phase 208 / ISSUE-171 — Expansion Phase 1: informative meters (§1.5) and
// the future-hook bridge (§1.1).
//
// Two things this phase changes about existing behaviour, so both get their
// own file rather than being buried in the contract suite:
//
//   §1.5 meters stop discarding information at their clamps, and downstream
//        behaviour reads the richer state;
//   §1.1 every future hook a response declares becomes a TYPED record —
//        mechanical when a domain owns it, an explicit narrative expectation
//        when none does yet.
//
// The narrative-expectation half is what makes `OBL-02` measurable: before
// this phase ~90 hook families promised concrete consequences and drained
// into a zero-weight cause, and nothing counted them. Now the count is a
// number, and Phases 2-11 drive it to zero.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { FULL_PIPELINE } from '../../src/sim/canonicalPipeline'
import { simulateDay } from '../../src/sim/core/engine'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import type { SimInput } from '../../src/sim/core/context'
import type { TavernState } from '../../src/sim/state/TavernState'
import { createStateDiff } from '../../src/sim/core/diff'

import {
  createInitialRulesetModuleState,
} from '../../src/sim/contracts/ruleset/index'
import {
  getHysteresisLatch,
  getMeterDetail,
  meterDebt,
  readMetersSlice,
  troubledMeters,
} from '../../src/sim/contracts/meters/index'
import {
  NARRATIVE_EXPECTATION_REASON,
  findPromissoryWording,
  readScheduledEventsSlice,
} from '../../src/sim/contracts/scheduledEvents/index'
import {
  PROBE_HOOK_EVENT_TYPE,
  PROBE_LATCH_KEY,
  PROBE_UNOWNED_HOOK,
  probeActorState,
  configureObligationProbe,
  installObligationProbeExpansion,
  obligationProbeModule,
  resetObligationProbe,
  uninstallObligationProbeExpansion,
} from '../../src/sim/testing/expansions/obligationProbe'

const SEED = 'phase208/meters'

function input(day: number): SimInput {
  return { seed: `${SEED}-d${day}` }
}

function run(start: TavernState, days: number): TavernState {
  let state = start
  for (let day = 0; day < days; day += 1) {
    state = simulateDay(state, input(day), FULL_PIPELINE).state
  }
  return state
}

describe('Phase 208 §1.5 — informative meters', () => {
  it('a room neglected past its floor banks the decay the clamp discarded', () => {
    // Left alone, main-room cleanliness falls to 0 and then keeps being
    // pushed down. Before this phase that pressure vanished, so a room
    // filthy for three weeks was identical to one filthy for three days and
    // one scrub restored both. The banked debt is that difference.
    const end = run(createInitialTavernState(), 24)
    const TARGET = 'area:main_room.cleanliness'
    const detail = getMeterDetail(end, TARGET)

    expect(end.areas['main_room']!.cleanliness).toBe(0)
    expect(detail, 'a floored meter must carry a detail record').toBeDefined()
    expect(detail!.debt).toBeGreaterThan(0)
    expect(detail!.daysAtFloor).toBeGreaterThan(1)
    // Velocity tracks the UNCLAMPED movement, so a meter pinned at zero that
    // is still being pushed down still reads as falling.
    expect(detail!.velocity).toBeLessThan(0)
  })

  it('longer neglect banks strictly more debt than shorter neglect', () => {
    const TARGET = 'area:main_room.cleanliness'
    const shorter = meterDebt(run(createInitialTavernState(), 20), TARGET)
    const longer = meterDebt(run(createInitialTavernState(), 30), TARGET)
    expect(longer).toBeGreaterThan(shorter)
  })

  it('a healthy opening day writes no debt and no excess', () => {
    const end = run(createInitialTavernState(), 1)
    expect(troubledMeters(end)).toEqual([])
  })

  it('records pressure detail exactly once a day, not once per pass', () => {
    // The pressure module runs its pass twice (calculate, then finalize).
    // Recording from both would double-count velocity and excess, so only
    // the authoritative pass records — which this asserts by checking the
    // detail's day stamp advances by one per simulated day.
    let state = createInitialTavernState()
    for (let day = 0; day < 4; day += 1) {
      state = simulateDay(state, input(day), FULL_PIPELINE).state
      const details = Object.values(readMetersSlice(state).details).filter((d) =>
        d.target.startsWith('pressure:'),
      )
      expect(details.length).toBeGreaterThan(0)
      for (const detail of details) {
        expect(detail.lastUpdatedDay).toBe(state.calendar.totalDaysElapsed - 1)
      }
    }
  })

  it('never carries both floor debt and ceiling excess for one meter', () => {
    const end = run(createInitialTavernState(), 24)
    for (const detail of Object.values(readMetersSlice(end).details)) {
      expect(
        detail.debt > 0 && detail.excess > 0,
        `${detail.target} carries both`,
      ).toBe(false)
    }
  })

  it('the meter report explains why a floored meter is not recovering', () => {
    let state = createInitialTavernState()
    let section: { lines: string[] } | undefined
    for (let day = 0; day < 24; day += 1) {
      const result = simulateDay(state, input(day), FULL_PIPELINE)
      state = result.state
      const found = result.reports.find((r) => r.id === 'meters')
      if (found) section = found
    }
    expect(section, 'the meters report should appear once a meter is in trouble')
      .toBeDefined()
    // The player-facing point: the number is not stuck, the neglect is banked.
    expect(section!.lines.join('\n')).toMatch(/banked|over the cap/)
  })

  it('derived meter detail is excluded from the state diff', () => {
    // It is bookkeeping derived from meters the diff already walks and the
    // causes already explain; diffing it would add a multi-kilobyte blob to
    // the unexplained-changes list every single day.
    const before = createInitialTavernState()
    const after = run(createInitialTavernState(), 8)
    const diff = createStateDiff(before, after)
    expect(diff.changes.some((c) => c.path === 'modules.meters.details')).toBe(
      false,
    )
  })

  it('carries no meter records on a state that never ran a day', () => {
    expect(readMetersSlice(createInitialTavernState())).toEqual({
      details: {},
      latches: {},
    })
  })
})

describe('Phase 208 §1.5 — the hidden state survives a reload', () => {
  it('banked debt is persisted, not recomputed', () => {
    const TARGET = 'area:main_room.cleanliness'
    const end = run(createInitialTavernState(), 24)
    const debt = meterDebt(end, TARGET)
    expect(debt).toBeGreaterThan(0)

    // A JSON round trip is the persistence boundary. If the debt were
    // derived rather than stored it would be silently lost here, and a
    // reload would forgive every day of neglect.
    const reloaded = JSON.parse(JSON.stringify(end)) as TavernState
    expect(meterDebt(reloaded, TARGET)).toBe(debt)
  })
})

describe('Phase 208 §1.1 — the future-hook bridge, both branches', () => {
  beforeEach(() => {
    installObligationProbeExpansion()
    resetObligationProbe()
    configureObligationProbe({
      openOnDay: 99, // no obligation; this suite is about hooks only
      principal: 10,
      dueInDays: 2,
      counterpartyId: 'the_landlord',
      declareFutureHooksOnDay: 1,
    })
  })
  afterEach(() => {
    uninstallObligationProbeExpansion()
  })

  /**
   * The probe pushes a profile with two future hooks through the REAL
   * response applier: one name an owner has claimed (with a
   * `fromFutureHook` adapter), one nobody owns. They must be routed
   * differently — that split is the whole of §1.1.
   */
  function runProbe(days: number): TavernState {
    let state = createInitialTavernState()
    for (let day = 0; day < days; day += 1) {
      state = simulateDay(state, input(day), [
        ...FULL_PIPELINE,
        obligationProbeModule,
      ]).state
    }
    return state
  }

  it('an owned hook becomes a mechanical event that really mutates state', () => {
    const end = runProbe(6)
    const archive = readScheduledEventsSlice(end).archive
    const mechanical = archive.find((o) => o.type === PROBE_HOOK_EVENT_TYPE)

    expect(mechanical, 'the owned hook should have fired').toBeDefined()
    expect(mechanical!.kind).toBe('mechanical')
    expect(mechanical!.status).toBe('resolved')
    // The `OBL-02` contract: resolving means CHANGING something, and saying
    // what. A zero-weight cause would not satisfy this.
    expect(mechanical!.mutations.length).toBeGreaterThan(0)
    expect(mechanical!.mutations[0]!.targetKind).toBe('area')
  })

  it('an unowned hook becomes a narrative expectation that changes nothing', () => {
    const end = runProbe(6)
    const archive = readScheduledEventsSlice(end).archive
    const narrative = archive.find((o) => o.type === PROBE_UNOWNED_HOOK)

    expect(narrative, 'the unowned hook should have been tracked').toBeDefined()
    expect(narrative!.kind).toBe('narrative_expectation')
    expect(narrative!.status).toBe('no_op')
    expect(narrative!.mutations).toEqual([])
    // Explained, not silent. This is what makes the count of still-narrative
    // promises a number Phases 2-11 can drive to zero.
    expect(narrative!.reason).toBe(NARRATIVE_EXPECTATION_REASON)
  })

  it('an owned hook is not ALSO left on the responses pending queue', () => {
    // Both paths keeping the same promise would apply it twice. The bridge
    // returns `mechanical` precisely so the caller skips the enqueue.
    const end = runProbe(6)
    const pending = (
      end.modules as Record<string, { pending?: Array<{ payload: unknown }> }>
    )['responses']!.pending!
    const asJson = JSON.stringify(pending)
    expect(asJson).not.toContain(PROBE_HOOK_EVENT_TYPE)
  })

  it('a run that declares no hooks queues no expectations', () => {
    const end = run(createInitialTavernState(), 3)
    expect(readScheduledEventsSlice(end).queue).toEqual([])
  })

  it('every queued expectation carries an owner, a key and a readable origin', () => {
    // Whatever the run produces, the invariants hold: this is the shape
    // contract that made `OBL-02` invisible when it was absent.
    const end = run(createInitialTavernState(), 12)
    for (const record of readScheduledEventsSlice(end).queue) {
      expect(record.ownerModuleId).not.toBe('')
      expect(record.ownerModuleId).not.toBe('unowned')
      expect(record.exactOnceKey.length).toBeGreaterThan(0)
      expect(record.origin.readable.length).toBeGreaterThan(0)
      expect(record.expiresAfterDay).toBeGreaterThanOrEqual(
        record.scheduledForDay,
      )
    }
  })

  it('a narrative expectation resolves as an explained no-op, never as a mutation', () => {
    const end = run(createInitialTavernState(), 12)
    const narrative = readScheduledEventsSlice(end).archive.filter(
      (o) => o.kind === 'narrative_expectation',
    )
    for (const outcome of narrative) {
      // It must NOT claim to have resolved: it changed nothing, and saying
      // otherwise is exactly the lie this phase exists to stop.
      expect(outcome.status).not.toBe('resolved')
      expect(outcome.mutations).toEqual([])
      if (outcome.status === 'no_op') {
        expect(outcome.reason).toBe(NARRATIVE_EXPECTATION_REASON)
      }
    }
  })

  it('detects promissory wording, so the content audit has teeth', () => {
    // Reports rather than fails: the ~90 existing hook families were written
    // as concrete promises, and rewriting them belongs to the phase that
    // gives each family a real owner — at which point the wording becomes
    // true rather than needing to be watered down.
    expect(findPromissoryWording('Gruk will remember this.')).toContain('will ')
    expect(findPromissoryWording('The rent comes due on Sunday.')).toContain(
      'comes due',
    )
    expect(findPromissoryWording('The room feels colder.')).toEqual([])
  })
})

describe('Phase 208 — the reference route is untouched', () => {
  it('a standard run banks no fractional decay and needs no ruleset writes', () => {
    // The whole existing suite, the frozen Phase 0 probes and the recorded
    // balance matrix were measured on this route. Standard's multipliers are
    // exactly 1, so `scaleOngoingIntegerDecay` is a pure pass-through and the
    // carry map stays empty for the life of the run.
    const state = createInitialTavernState()
    expect(
      (state.modules as Record<string, unknown>)['ruleset'],
    ).toEqual(createInitialRulesetModuleState('standard'))
    const end = run(state, 10)
    expect(
      (end.modules as Record<string, { decayCarry: unknown }>)['ruleset']!
        .decayCarry,
    ).toEqual({})
  })
})

describe('Phase 208 §1.5/§1.6 — hysteresis and actor execution in a live run', () => {
  // `decideActorAction` is pure and tested directly in the contract suite.
  // Everything that WRITES — the hysteresis latch, the actor's budget,
  // cooldown, commitment, intent and learned beliefs — needs a real context
  // and a real day, which is what the probe supplies.
  beforeEach(() => {
    installObligationProbeExpansion()
    resetObligationProbe()
    configureObligationProbe({
      openOnDay: 99,
      principal: 10,
      dueInDays: 2,
      counterpartyId: 'the_landlord',
      exercisePrimitives: true,
    })
  })
  afterEach(() => {
    uninstallObligationProbeExpansion()
  })

  function runProbe(days: number): TavernState {
    let state = createInitialTavernState()
    for (let day = 0; day < days; day += 1) {
      state = simulateDay(state, input(day), [
        ...FULL_PIPELINE,
        obligationProbeModule,
      ]).state
    }
    return state
  }

  it('the hysteresis latch persists and holds its band', () => {
    const end = runProbe(6)
    const latch = getHysteresisLatch(end, PROBE_LATCH_KEY)
    expect(latch, 'the latch should have been opened').toBeDefined()
    expect(['presentable', 'grim']).toContain(latch!.held)
    // A latch that flipped every single day would be no hysteresis at all.
    expect(latch!.flips).toBeLessThan(3)
    if (latch!.candidate !== undefined) {
      expect(latch!.candidateSinceDay).toBeTypeOf('number')
    }
  })

  it('the latch survives a JSON round trip', () => {
    const end = runProbe(6)
    const before = getHysteresisLatch(end, PROBE_LATCH_KEY)!
    const reloaded = JSON.parse(JSON.stringify(end)) as TavernState
    expect(getHysteresisLatch(reloaded, PROBE_LATCH_KEY)).toEqual(before)
  })

  it('an actor announces intent before acting, then pays for the action', () => {
    runProbe(1)
    // Day one: decided, so intent is announced and nothing is spent yet.
    const announced = probeActorState()
    expect(announced.intent, 'intent should be announced first').toBeDefined()
    expect(announced.budget).toBe(10)
    expect(announced.history).toEqual([])

    resetObligationProbe()
    runProbe(3)
    const acted = probeActorState()
    // Having acted: budget spent, cooldown set, commitment taken, intent
    // cleared, outcome recorded, and the belief learned from the result.
    expect(acted.budget).toBeLessThan(10)
    expect(acted.history.length).toBeGreaterThan(0)
    expect(acted.history[0]!.result).toBe('succeeded')
    expect(acted.cooldowns['probe_tidy']).toBeTypeOf('number')
    expect(acted.committedUntilDay).toBeTypeOf('number')
    expect(acted.intent).toBeUndefined()
    expect(acted.beliefs['last_tidy']).toBe('worked')
  })
})
