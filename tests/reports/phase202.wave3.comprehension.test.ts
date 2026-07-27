// Phase 202 / gameplay audit Wave 3 — the decision lifecycle.
//
// Plan: docs/plans/phase-202-audit-wave-3-decision-lifecycle.md.
//
//   P6-COMP-001  confirmations replaced choice language with engine verbs
//   P6-COMP-002  delayed choices had no pending/applied/expired lifecycle
//   P6-COMP-003  cause drilldowns exposed machine sources and raw weight
//   P6-COMP-004  staff priorities hid their tradeoff and their result
//   P5-PLAY-002  satisfaction rows omitted the customer group
//
// The gate is the seven Phase F comprehension questions: what is
// happening now; which choices are available and which are final; what
// just changed; why did it change; did the action succeed, fail or remain
// pending; what consequence should be expected later; what does the game
// expect next.

import { describe, expect, it } from 'vitest'

import { simulateDay } from '../../src/sim/core/engine'
import { FULL_PIPELINE } from '../../src/sim/canonicalPipeline'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import type { TavernState } from '../../src/sim/state/TavernState'
import type { ResponseIntent } from '../../src/sim/modules/issues/issueSeedTypes'
import { getIssueSeeds } from '../../src/sim/modules/issues/issueSeedQueries'
import { buildDailyReport } from '../../src/reports/dailyReportProjection'
import { humanizePath } from '../../src/reports/labels/humanizePath'
import {
  causeShareOfChange,
  humanizeCauseEntities,
  humanizeCauseReadable,
} from '../../src/reports/labels/causePresentation'
import {
  projectPendingConsequences,
  projectResolvedConsequences,
} from '../../src/reports/pendingConsequenceProjection'
import {
  staffPriorityRegistry,
  ensureRequiredStaffPrioritiesRegistered,
} from '../../src/sim/registries/staffPriorityRegistry'
import { RESPONSES_MODULE_ID } from '../../src/sim/modules/responses/types'

const SEED = 'phase202-wave3'

function runDay(state: TavernState, overrides = {}) {
  return simulateDay(state, { seed: SEED, ...overrides }, FULL_PIPELINE)
}

// ──────────────────────────────────────────────────────────────────
// P5-PLAY-002

describe('P5-PLAY-002 — report rows name their customer group', () => {
  it('distinguishes two groups whose satisfaction moved identically', () => {
    const adventurers = humanizePath('customers.adventurers.satisfaction')
    const miners = humanizePath('customers.miners.satisfaction')

    expect(adventurers).not.toEqual(miners)
    expect(adventurers.toLowerCase()).toContain('satisfaction')
    expect(miners.toLowerCase()).toContain('satisfaction')
    // The group has to be IN the row, not one tap away.
    expect(adventurers.toLowerCase()).toContain('adventurer')
    expect(miners.toLowerCase()).toContain('miner')
  })

  it('never renders a bare field name for a customer path', () => {
    for (const groupId of Object.keys(createInitialTavernState().customerGroups)) {
      const label = humanizePath(`customers.${groupId}.satisfaction`)
      expect(label, `${groupId} row`).not.toBe('Satisfaction')
    }
  })
})

// ──────────────────────────────────────────────────────────────────
// P6-COMP-001

describe('P6-COMP-001 — the record keeps the player’s words', () => {
  it('carries the chosen label through the report, not the engine verb', () => {
    const state = runDay(createInitialTavernState()).state
    const seed = getIssueSeeds(state, {}).find(
      (candidate) => candidate.responseSlots.length > 0,
    )
    expect(seed, 'test setup: no seed with slots').toBeDefined()
    const slot = seed!.responseSlots[0]!

    const intent: ResponseIntent = {
      id: 'r-labelled',
      seedId: seed!.id,
      verb: slot.allowedVerbs[0]!,
      shape: slot.shape,
      tags: [],
      intensity: 50,
      metadata: {
        responseSlotId: slot.id,
        selectionLabel: 'Back Mira against the Ogres',
      },
    }

    const day = runDay(state, { responseIntents: [intent] })
    const report = buildDailyReport(day, day.state)
    const row = report.resolvedIntents.find((r) => r.intentId === 'r-labelled')

    expect(row, 'the resolved choice is missing from the report').toBeDefined()
    expect(row!.selectionLabel).toBe('Back Mira against the Ogres')
    // The verb is still on the record for debug surfaces, but it is not
    // what the player-facing summary reads.
    expect(row!.selectionLabel).not.toBe(row!.verb)
  })

  it('leaves the label absent — not fabricated — for engine-built intents', () => {
    const state = runDay(createInitialTavernState()).state
    const seed = getIssueSeeds(state, {}).find((s) => s.responseSlots.length > 0)!
    const slot = seed.responseSlots[0]!
    const day = runDay(state, {
      responseIntents: [
        {
          id: 'r-unlabelled',
          seedId: seed.id,
          verb: slot.allowedVerbs[0]!,
          shape: slot.shape,
          tags: [],
          intensity: 50,
          metadata: { responseSlotId: slot.id },
        },
      ],
    })
    const report = buildDailyReport(day, day.state)
    const row = report.resolvedIntents.find((r) => r.intentId === 'r-unlabelled')
    expect(row).toBeDefined()
    expect(row!.selectionLabel).toBeUndefined()
  })
})

// ──────────────────────────────────────────────────────────────────
// P6-COMP-002

describe('P6-COMP-002 — delayed consequences have a lifecycle', () => {
  /** A state carrying one queued effect due tomorrow. */
  function withPendingEntry(state: TavernState, offsetDays = 1): TavernState {
    const today = state.calendar.totalDaysElapsed
    const slice = state.modules[RESPONSES_MODULE_ID] as Record<string, unknown>
    return {
      ...state,
      modules: {
        ...state.modules,
        [RESPONSES_MODULE_ID]: {
          ...slice,
          pending: [
            {
              id: `pending-wave3-${offsetDays}`,
              scheduledFor: today + offsetDays,
              expiresAt: today + offsetDays + 3,
              origin: {
                seedId: 'seed-x',
                intentId: 'r-labelled',
                profileId: 'p',
                responseSlotId: 'start_project',
                verb: 'upgrade',
                enqueuedDay: today,
                selectionLabel: 'Start a real Main Room project',
              },
              payload: {
                kind: 'state_change',
                effect: {
                  kind: 'state_change',
                  target: 'areas.main_room.condition',
                  amount: 20,
                  readable: 'Main Room condition improves',
                  tags: ['area'],
                },
              },
            },
          ],
        },
      },
    }
  }

  it('shows what is waiting, what it will do and when', () => {
    const state = withPendingEntry(runDay(createInitialTavernState()).state)
    const rows = projectPendingConsequences(
      state,
      state.calendar.totalDaysElapsed,
    )

    expect(rows.length).toBe(1)
    const row = rows[0]!
    expect(row.expectedEffect).toContain('Main Room condition')
    expect(row.daysAway).toBe(1)
    expect(row.status).toBe('pending')
    // The choice that promised it is named in the player's own words —
    // not the engine verb, and not a generic stand-in.
    expect(row.originLabel).toBe('Start a real Main Room project')
  })

  it('marks an entry due once its day arrives', () => {
    const state = withPendingEntry(runDay(createInitialTavernState()).state, 0)
    const rows = projectPendingConsequences(
      state,
      state.calendar.totalDaysElapsed,
    )
    expect(rows[0]!.status).toBe('due')
    expect(rows[0]!.daysAway).toBe(0)
  })

  it('reports the entry as applied when it fires, and stops listing it', () => {
    // `scheduledFor === today` fires on this day's own startDay drain
    // (the calendar advances at the END of a day).
    const before = withPendingEntry(runDay(createInitialTavernState()).state, 0)
    const after = runDay(before).state

    const slice = after.modules[RESPONSES_MODULE_ID] as {
      pending: unknown[]
      appliedFromPendingToday: string[]
    }
    expect(slice.appliedFromPendingToday.length).toBe(1)
    expect(slice.pending.length).toBe(0)

    const resolved = projectResolvedConsequences(after)
    expect(resolved.length).toBe(1)
    expect(resolved[0]!.status).toBe('applied')
    // The link back to the originating choice is the whole point of the
    // finding: a later effect must not arrive unattributed.
    expect(resolved[0]!.originLabel).toBe('Start a real Main Room project')
    expect(resolved[0]!.expectedEffect).toContain('Main Room condition')

    // And it is no longer promised.
    expect(
      projectPendingConsequences(after, after.calendar.totalDaysElapsed),
    ).toEqual([])
  })

  it('reports an entry as expired rather than letting it vanish', () => {
    let state = runDay(createInitialTavernState()).state
    const today = state.calendar.totalDaysElapsed
    const slice = state.modules[RESPONSES_MODULE_ID] as Record<string, unknown>
    state = {
      ...state,
      modules: {
        ...state.modules,
        [RESPONSES_MODULE_ID]: {
          ...slice,
          pending: [
            {
              id: 'pending-expiring',
              // Already past its window when the next day opens.
              scheduledFor: today - 5,
              expiresAt: today - 1,
              origin: {
                seedId: 'seed-y',
                intentId: 'r-old',
                profileId: 'p',
                responseSlotId: 'delay',
                verb: 'delay',
                enqueuedDay: today - 6,
                selectionLabel: 'Delay the payment',
              },
              payload: {
                kind: 'state_change',
                effect: {
                  kind: 'state_change',
                  target: 'coin',
                  amount: -5,
                  readable: 'A cost that never landed',
                  tags: ['coin'],
                },
              },
            },
          ],
        },
      },
    }

    const after = runDay(state).state
    const resolved = projectResolvedConsequences(after)
    expect(resolved.length).toBe(1)
    expect(resolved[0]!.status).toBe('expired')
    expect(resolved[0]!.originLabel).toBe('Delay the payment')
  })

  it('the real pipeline stamps the label onto anything it queues', () => {
    // The fixture cases above set `origin.selectionLabel` by hand. This
    // one proves the sim actually puts it there — without it, the link
    // survives only for the day the choice was made, and a delayed
    // effect (which by definition lands later) arrives unattributed.
    // A response resolves against seeds generated the SAME day, so build
    // the intents from a probe of the day we are about to run (the
    // Phase 41 pattern). Two days in, the surface carries slots with
    // delayed effects.
    const warmState = runDay(createInitialTavernState()).state
    const probe = runDay(warmState)
    const intents: ResponseIntent[] = getIssueSeeds(probe.state, {}).flatMap((seed) => {
      // Pick a slot that actually queues something — a slot with only
      // immediate effects never reaches the pending queue.
      const slot = seed.responseSlots.find((candidate) => {
        const profile = seed.consequenceProfiles.find(
          (p) => p.responseSlotId === candidate.id,
        )
        return (
          (profile?.delayedEffects.length ?? 0) > 0 ||
          (profile?.futureHooks.length ?? 0) > 0
        )
      })
      if (!slot) return []
      return [
        {
          id: `r-${seed.id}`,
          seedId: seed.id,
          verb: slot.allowedVerbs[0]!,
          shape: slot.shape,
          tags: [],
          intensity: 50,
          metadata: {
            responseSlotId: slot.id,
            selectionLabel: `Chose ${slot.labelHint}`,
          },
        },
      ]
    })
    expect(intents.length, 'test setup: no resolvable seeds').toBeGreaterThan(0)

    const state = runDay(warmState, { responseIntents: intents }).state
    const queued = (
      state.modules[RESPONSES_MODULE_ID] as {
        pending: Array<{ origin: { selectionLabel?: string } }>
      }
    ).pending
    expect(queued.length, 'test setup: nothing was queued').toBeGreaterThan(0)
    for (const entry of queued) {
      expect(entry.origin.selectionLabel).toMatch(/^Chose /)
    }

    // And it reaches the projection as the row's origin.
    const rows = projectPendingConsequences(state, state.calendar.totalDaysElapsed)
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      expect(row.originLabel).toMatch(/^Chose /)
    }
  })

  it('the report carries both halves of the lifecycle', () => {
    const state = withPendingEntry(runDay(createInitialTavernState()).state, 0)
    const day = runDay(state)
    const report = buildDailyReport(day, day.state)
    // Fired on this day's startDay drain, so the closed report shows the
    // completion side.
    expect(report.resolvedConsequences.length).toBeGreaterThan(0)
    expect(Array.isArray(report.pendingConsequences)).toBe(true)
  })
})

// ──────────────────────────────────────────────────────────────────
// P6-COMP-003

describe('P6-COMP-003 — causes read as tavern language', () => {
  const state = createInitialTavernState()

  it('translates machine sources instead of printing paths', () => {
    const cases = [
      'customers.merchants.dish_ale',
      'customers.local_goblins.dish_ale',
      'service.tabs.local_goblins',
      'areas.main_room.cleanliness',
    ]
    for (const raw of cases) {
      const text = humanizeCauseReadable(state, { readable: raw, source: raw })
      // A sentence may end in a full stop; what must not survive is a
      // dotted path segment like `customers.merchants`.
      expect(text, raw).not.toMatch(/\w\.\w/)
      expect(text.length, raw).toBeGreaterThan(0)
      // A sentence, not an identifier.
      expect(text, raw).toMatch(/\s/)
    }
  })

  it('names the group that bought and the group that owes', () => {
    expect(
      humanizeCauseReadable(state, {
        readable: 'customers.merchants.dish_ale',
        source: 'customers.merchants.dish_ale',
      }).toLowerCase(),
    ).toContain('merchant')
    expect(
      humanizeCauseReadable(state, {
        readable: 'service.tabs.local_goblins',
        source: 'service.tabs.local_goblins',
      }).toLowerCase(),
    ).toContain('tab')
  })

  it('falls back to a safe sentence for an unknown source', () => {
    const text = humanizeCauseReadable(state, {
      readable: 'wibble.frobnicate.42',
      source: 'wibble.frobnicate.42',
    })
    expect(text).not.toContain('wibble')
    expect(text).toMatch(/\s/)
  })

  it('leaves an already-prose readable alone', () => {
    const prose = 'Ogres traffic caused main room damage.'
    expect(humanizeCauseReadable(state, { readable: prose, source: 'x' })).toBe(
      prose,
    )
  })

  it('resolves actors and locations to display names', () => {
    const labels = humanizeCauseEntities(state, {
      relatedActors: [{ kind: 'customer_group', id: 'merchants' }],
      relatedLocations: [{ kind: 'area', id: 'main_room' }],
    })
    expect(labels.length).toBe(2)
    for (const label of labels) {
      expect(label).not.toContain('/')
      expect(label).not.toBe('merchants')
      expect(label).not.toBe('main_room')
    }
  })

  it('expresses importance as a share of the change', () => {
    const all = [{ weight: 60 }, { weight: 30 }, { weight: 10 }]
    expect(causeShareOfChange(all[0]!, all)).toBe(60)
    expect(causeShareOfChange(all[2]!, all)).toBe(10)
    // Degenerate input must not divide by zero.
    expect(causeShareOfChange({ weight: 0 }, [{ weight: 0 }])).toBe(0)
  })
})

// ──────────────────────────────────────────────────────────────────
// P6-COMP-004

describe('P6-COMP-004 — priorities show their trade and their result', () => {
  it('every priority states one benefit and one tradeoff', () => {
    ensureRequiredStaffPrioritiesRegistered()
    const all = staffPriorityRegistry.all()
    expect(all.length).toBeGreaterThan(0)
    for (const def of all) {
      expect(def.benefit, `${def.id} benefit`).toBeTruthy()
      expect(def.tradeoff, `${def.id} tradeoff`).toBeTruthy()
      // Player terms, not tag names.
      expect(def.benefit, `${def.id} benefit`).toMatch(/\s/)
      expect(def.tradeoff, `${def.id} tradeoff`).toMatch(/\s/)
      expect(def.benefit).not.toContain('_')
      expect(def.tradeoff).not.toContain('_')
    }
  })

  it('covers both cook priorities and one each for server and bouncer', () => {
    ensureRequiredStaffPrioritiesRegistered()
    const byRole = new Map<string, number>()
    for (const def of staffPriorityRegistry.all()) {
      byRole.set(def.roleId, (byRole.get(def.roleId) ?? 0) + 1)
    }
    expect(byRole.get('cook') ?? 0).toBeGreaterThanOrEqual(2)
    expect(byRole.get('server') ?? 0).toBeGreaterThanOrEqual(1)
    expect(byRole.get('cleaner_bouncer') ?? 0).toBeGreaterThanOrEqual(1)
  })

  it('the report attributes the day to each staff member’s focus', () => {
    const day = runDay(createInitialTavernState(), {
      staffPriorities: { cleaner_bouncer: 'prevent_fights' },
    })
    const report = buildDailyReport(day, day.state)
    const row = report.staffFocus.find((r) => r.staffId === 'cleaner_bouncer')
    expect(row, 'no focus line for the bouncer').toBeDefined()
    expect(row!.priorityId).toBe('prevent_fights')
    expect(row!.priorityLabel).toBe('Prevent Fights')
    expect(row!.benefit).toBeTruthy()
    // Directional, not a fabricated count.
    expect(row!.benefit).not.toMatch(/\d/)
  })
})
