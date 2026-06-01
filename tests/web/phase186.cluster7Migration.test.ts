// Phase 186 / Day-Clock Cluster 7 — in-flight save migration + owner-time
// field rename.
//
// Two coupled pieces ship in Cluster 7:
//
//   1. The owner-time fields Cluster 3 left named `actionPoint*` are
//      renamed to `time*` (`actionPointsUsed → timeSpent`,
//      `actionPointBudget → timeBudget`, `applied[].actionPointCost →
//      timeCost`). A pre-Cluster-7 save carries the old keys, so the
//      `ensureOwnerTimeFields` migration renames them before validation —
//      otherwise the (now `time*`-keyed) Zod schema would bounce the save
//      as `invalid`. The web pick sanitiser accepts the legacy
//      `actionPointCost` key too, so queued picks survive.
//
//   2. The in-flight day migration (contract §4.7). A save written before
//      Cluster 5 carries no `segment` field and pre-baked seeds; resuming
//      it mid-day would play a day whose Segment A never ran. The ruling:
//      reset cleanly to the next morning. A closed-day report beat is a
//      clean boundary and is left as-is.

import { describe, expect, it } from 'vitest'

import { ensureOwnerTimeFields } from '../../src/sim/state/migrations'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import { OWNER_ACTIONS_MODULE_ID } from '../../src/sim/modules/ownerActions/stateHelpers'
import { getOwnerActionsModuleState } from '../../src/sim/modules/ownerActions/ownerActionsModule'
import { sanitizePicks } from '../../web/src/lib/sim/actionBuilder'
import {
  SAVE_VERSION,
  validatePersistedSession,
} from '../../web/src/lib/sim/persistence'

// Build a save envelope around a state, optionally rewriting the
// ownerActions slice to the legacy `actionPoint*` shape and stripping the
// day-session segment field as a pre-Cluster-5/7 save would have it.
function legacyEnvelope(opts: {
  beat: string
  /** Use the pre-Cluster-7 `actionPoint*` slice keys. */
  legacyOwnerFields?: boolean
  /** Use the pre-Cluster-5 (no-segment) day session. */
  legacyDaySession?: boolean
  picks?: unknown[]
  pendingBySeedId?: Record<string, unknown>
}): Record<string, unknown> {
  const state = createInitialTavernState() as unknown as Record<string, unknown>
  const modules = state['modules'] as Record<string, unknown>

  if (opts.legacyOwnerFields) {
    // Hand-write the pre-Cluster-7 owner-actions slice: old key names,
    // old action-point magnitudes, and a populated `applied[]` (as a
    // just-closed day would carry).
    modules[OWNER_ACTIONS_MODULE_ID] = {
      actionPointsUsed: 1,
      actionPointBudget: 3,
      applied: [
        {
          actionId: 'clean_area',
          label: 'Clean an area',
          targetId: 'main_room',
          actionPointCost: 1,
          effects: ['cleanliness +10'],
          data: {},
        },
      ],
      rejected: [],
      projects: {},
      policies: {},
      recentSocialActions: [],
    }
  }

  const daySession: Record<string, unknown> = {
    beat: opts.beat,
    serviceComplete: false,
    closingComplete: false,
  }
  if (!opts.legacyDaySession) daySession['segment'] = 'C'

  return {
    saveVersion: SAVE_VERSION,
    savedAt: '2026-06-01T12:00:00.000Z',
    simSeed: 'tests/cluster7',
    state,
    picks: opts.picks ?? [],
    staffPriorities: {},
    pendingBySeedId: opts.pendingBySeedId ?? {},
    daySession,
    route: 'day',
  }
}

describe('Phase 186 Cluster 7 — ensureOwnerTimeFields', () => {
  it('renames actionPoint* keys to time* on the ownerActions slice', () => {
    const legacy = {
      modules: {
        [OWNER_ACTIONS_MODULE_ID]: {
          actionPointsUsed: 2,
          actionPointBudget: 3,
          applied: [
            { actionId: 'a', label: 'A', actionPointCost: 1, effects: [], data: {} },
          ],
          rejected: [],
          projects: {},
          policies: {},
          recentSocialActions: [],
        },
      },
    }
    const out = ensureOwnerTimeFields(legacy)
    const slice = out.modules[OWNER_ACTIONS_MODULE_ID] as Record<string, unknown>
    expect(slice['timeSpent']).toBe(2)
    expect(slice['timeBudget']).toBe(3)
    expect('actionPointsUsed' in slice).toBe(false)
    expect('actionPointBudget' in slice).toBe(false)
    const applied = slice['applied'] as Array<Record<string, unknown>>
    expect(applied[0]!['timeCost']).toBe(1)
    expect('actionPointCost' in applied[0]!).toBe(false)
  })

  it('is a no-op when the new keys are already present', () => {
    const fresh = { modules: createInitialTavernState().modules }
    const out = ensureOwnerTimeFields(fresh as never)
    expect(out).toBe(fresh) // same reference — nothing to migrate
  })

  it('tolerates a missing modules branch / missing slice', () => {
    expect(ensureOwnerTimeFields({})).toEqual({})
    expect(ensureOwnerTimeFields({ modules: {} })).toEqual({ modules: {} })
  })
})

describe('Phase 186 Cluster 7 — legacy save loads through validation', () => {
  it('a pre-Cluster-7 save (old actionPoint* keys) migrates and validates', () => {
    const env = legacyEnvelope({ beat: 'report', legacyOwnerFields: true })
    const outcome = validatePersistedSession(env)
    expect(outcome.kind).toBe('loaded')
    if (outcome.kind !== 'loaded') return
    const slice = getOwnerActionsModuleState(outcome.save.state)
    // The migrated slice exposes the new field names with the carried
    // magnitudes (cosmetic — startDay resets them next morning).
    expect(slice.timeSpent).toBe(1)
    expect(slice.timeBudget).toBe(3)
    expect(slice.applied[0]!.timeCost).toBe(1)
  })
})

describe('Phase 186 Cluster 7 — pick sanitiser accepts the legacy cost key', () => {
  it('keeps a pick that carries actionPointCost instead of timeCost', () => {
    const state = createInitialTavernState()
    const raw = [
      {
        pickId: 'p1',
        actionId: 'clean_area',
        label: 'Clean an area',
        category: 'immediate',
        targetType: 'area',
        targetId: 'main_room',
        actionPointCost: 120,
      },
    ]
    const { picks, droppedCount } = sanitizePicks(raw, state)
    expect(droppedCount).toBe(0)
    expect(picks).toHaveLength(1)
    expect(picks[0]!.timeCost).toBe(120)
  })
})

describe('Phase 186 Cluster 7 — in-flight day reset (contract §4.7)', () => {
  // morning/report are clean boundaries (they derive to segment 'C' where
  // beginDay re-runs Segment A anyway); only plan/service/closing — which
  // derive to 'A'/'B' and would skip a fresh Segment A — need the reset.
  const IN_FLIGHT_BEATS = ['plan', 'service', 'closing'] as const

  for (const beat of IN_FLIGHT_BEATS) {
    it(`resets a pre-Cluster-5 save at the ${beat} beat to a clean morning`, () => {
      const env = legacyEnvelope({
        beat,
        legacyDaySession: true,
        // Queued picks survive the reset; pending intents do not.
        picks: [
          {
            pickId: 'p1',
            actionId: 'clean_area',
            label: 'Clean an area',
            category: 'immediate',
            targetType: 'area',
            targetId: 'main_room',
            actionPointCost: 120,
          },
        ],
        pendingBySeedId: { 'seed-old': { kind: 'ignore' } },
      })
      const outcome = validatePersistedSession(env)
      expect(outcome.kind).toBe('loaded')
      if (outcome.kind !== 'loaded') return

      // Re-opened from the top: Segment A re-runs via beginDay.
      expect(outcome.save.daySession.beat).toBe('morning')
      expect(outcome.save.daySession.segment).toBe('C')
      expect(outcome.save.daySession.serviceComplete).toBe(false)
      expect(outcome.save.daySession.closingComplete).toBe(false)

      // Stale pre-baked response intents are dropped; queued owner-action
      // picks are kept (Segment B consumes them).
      expect(outcome.save.pendingBySeedId).toEqual({})
      expect(outcome.save.picks).toHaveLength(1)
      expect(outcome.save.picks[0]!.actionId).toBe('clean_area')

      // No stale start-of-day baseline lingers.
      expect(outcome.save.dayBaseline).toBeUndefined()
    })
  }

  for (const beat of ['morning', 'report'] as const) {
    it(`leaves a pre-Cluster-5 save at the ${beat} beat untouched (clean boundary)`, () => {
      const env = legacyEnvelope({
        beat,
        legacyDaySession: true,
        pendingBySeedId: { 'seed-x': { kind: 'ignore' } },
      })
      const outcome = validatePersistedSession(env)
      expect(outcome.kind).toBe('loaded')
      if (outcome.kind !== 'loaded') return
      // Both clean boundaries derive to segment 'C'; beginDay re-runs
      // Segment A fresh, so no reset is owed and pending survives.
      expect(outcome.save.daySession.beat).toBe(beat)
      expect(outcome.save.daySession.segment).toBe('C')
      expect(outcome.save.pendingBySeedId).toEqual({ 'seed-x': { kind: 'ignore' } })
    })
  }

  it('does NOT reset a Cluster-5+ save that carries an explicit segment', () => {
    const env = legacyEnvelope({ beat: 'service' }) // legacyDaySession omitted → segment 'C'
    ;(env.daySession as Record<string, unknown>).segment = 'B'
    const outcome = validatePersistedSession(env)
    expect(outcome.kind).toBe('loaded')
    if (outcome.kind !== 'loaded') return
    // Explicit segment is trusted: the mid-day position is preserved.
    expect(outcome.save.daySession.beat).toBe('service')
    expect(outcome.save.daySession.segment).toBe('B')
  })
})
