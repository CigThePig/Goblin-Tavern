// Phase 199 / gameplay audit Wave 0 — durable progress (P2-RT-001).
//
// The audit's Critical finding: `GameStore.serializeForSave()` called
// `structuredClone` on Svelte `$state` deep proxies, which throws
// `DataCloneError`, so EVERY autosave, snapshot and export failed from day
// zero — and failed *before* `saveSession()` produced its typed result, so
// the save-error banner never appeared either. Reload returned to Start
// with no Continue. Detail: audit Phase 2 §9; plan:
// docs/plans/phase-199-audit-wave-0-durable-progress.md.
//
// The Wave 0 gate (audit Phase 8 §7) is what this file asserts: R11 and
// R12 pass at Morning, Plan, Service, Closing, Report and the next
// Morning, with pending choice, queued action, baseline, Service outcome,
// report archive, RNG and calendar identical across the reload.
//
// Note on the environment: under Vitest the runes compile to their SSR
// forms, where `$state` is identity and no proxy exists — which is exactly
// why the pre-existing round-trip test passed against the broken build.
// The reproduction below therefore injects the proxy itself rather than
// relying on the runtime to produce one.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { gameStore } from '../../web/src/lib/sim/gameStore.svelte'
import {
  SAVE_STORAGE_KEY,
  saveSessionFrom,
  setStorageForTesting,
  validatePersistedSession,
  type PersistedSession,
  type StorageLike,
} from '../../web/src/lib/sim/persistence'
import {
  applyBaselinePatch,
  encodeBaselinePatch,
  isBaselinePatch,
} from '../../web/src/lib/sim/baselinePatch'
import {
  SaveSerializationError,
  toPlainSaveData,
} from '../../web/src/lib/sim/plainSave'
import {
  createSnapshot,
  loadSnapshot,
  setStorageForTesting as setSnapshotStorageForTesting,
} from '../../web/src/lib/sim/snapshots'
import { parseImportedSession } from '../../web/src/lib/sim/exportImport'
import { actionRegistry } from '../../src/sim/registries/actionRegistry'
import type { TavernState } from '../../src/sim/state/TavernState'
import type { PendingChoice } from '../../web/src/lib/sim/daySession'

const SEED = 'wave0-durable'

/**
 * Stand-in for Svelte's deep `$state` proxy: every object read comes back
 * wrapped, so `structuredClone` refuses it the way it refuses Svelte's.
 * Frozen/non-configurable properties are returned unwrapped because the
 * Proxy invariants require it (Svelte's own proxy has the same carve-out).
 */
function deepProxy<T extends object>(target: T): T {
  return new Proxy(target, {
    get(t, k, r) {
      const v = Reflect.get(t, k, r)
      if (!v || typeof v !== 'object') return v
      const desc = Reflect.getOwnPropertyDescriptor(t, k)
      if (desc && desc.configurable === false && desc.writable === false) return v
      return deepProxy(v as object)
    },
  })
}

type MemoryStorage = StorageLike & { map: Map<string, string> }

function memoryStorage(): MemoryStorage {
  const map = new Map<string, string>()
  return {
    map,
    getItem: (k) => (map.has(k) ? map.get(k)! : null),
    setItem: (k, v) => {
      map.set(k, v)
    },
    removeItem: (k) => {
      map.delete(k)
    },
  }
}

let saveStorage: MemoryStorage

/** Save → localStorage-shaped JSON → validate → hydrate a reset store. */
function reload(): PersistedSession {
  const session = gameStore.serializeForSave()
  const outcome = validatePersistedSession(JSON.parse(JSON.stringify(session)))
  if (outcome.kind !== 'loaded') {
    throw new Error(`save did not load: ${JSON.stringify(outcome)}`)
  }
  gameStore.reset('a-different-seed') // prove hydrate replaces everything
  gameStore.hydrateFromSave(outcome.save)
  return outcome.save
}

/**
 * Everything the Wave 0 gate says must be identical after a reload. Kept
 * as one plain snapshot so a new persisted field is one line here rather
 * than an assertion scattered across six beats.
 */
function observableSession() {
  return JSON.parse(
    JSON.stringify({
      state: gameStore.state,
      calendar: gameStore.state.calendar,
      rngStreams: gameStore.state.world.rngStreams ?? null,
      seedString: gameStore.seedString,
      previousCalendar: gameStore.previousCalendar ?? null,
      reportArchive: gameStore.latestResult
        ? {
            reports: gameStore.latestResult.reports,
            logs: gameStore.latestResult.logs,
            validation: gameStore.latestResult.validation,
            diffs: gameStore.latestResult.diffs,
          }
        : null,
      picks: gameStore.picks,
      staffPriorities: gameStore.staffPriorities,
      pendingBySeedId: gameStore.pendingBySeedId,
      beat: gameStore.beat,
      segment: gameStore.segment,
      serviceComplete: gameStore.serviceComplete,
      closingComplete: gameStore.closingComplete,
      serviceOutcome: gameStore.serviceOutcome ?? null,
      dayBaseline: gameStore.dayBaseline ?? null,
      route: gameStore.route,
      subroutes: {
        reports: gameStore.reportsSubview,
        tavern: gameStore.tavernSubview,
        world: gameStore.worldSubview,
      },
      dismissed: [...gameStore.dismissedMissedOpportunityIds].sort(),
    }),
  ) as Record<string, unknown>
}

/**
 * Queue one owner action against a real area. Built from the registry
 * definition rather than hand-written literals, because the load path
 * re-validates category / targetType / target against the registry and
 * silently drops a pick that disagrees.
 */
function queuePick(targetId = Object.keys(gameStore.state.areas)[0]!): void {
  const def = actionRegistry.get('clean_area')
  gameStore.addPick({
    actionId: def.id,
    label: def.label,
    category: def.category,
    targetType: def.targetType,
    targetId,
    timeCost: def.timeCost,
  })
}

/**
 * Resolve one of today's real seeds with a choice built from its own
 * response slot, so the choice survives `sanitizePending` on reload (it
 * re-checks slot, verb, shape and target against the live seed).
 */
function resolveOneRealSeed(): { seedId: string; pending: PendingChoice } | undefined {
  const seed = gameStore.todaysSeeds.find((s) => s.responseSlots.length > 0)
  if (!seed) return undefined
  const slot = seed.responseSlots[0]!
  const verb = slot.allowedVerbs[0]!
  const targetId = slot.targetOptions[0]?.id
  const pending: PendingChoice = {
    kind: 'choice',
    slotId: slot.id,
    verb,
    choice: {
      slotId: slot.id,
      label: 'Handle it',
      verb: verb as never,
      shape: slot.shape as never,
      previewEffects: ['something shifts'],
      ...(targetId !== undefined ? { targetId } : {}),
    },
  }
  gameStore.resolveSeed(seed.id, pending)
  return { seedId: seed.id, pending }
}

/** Mark a second seed as explicitly ignored, if there is one. */
function ignoreAnotherSeed(exceptId: string): string | undefined {
  const seed = gameStore.todaysSeeds.find((s) => s.id !== exceptId)
  if (!seed) return undefined
  gameStore.resolveSeed(seed.id, { kind: 'ignore' })
  return seed.id
}

beforeEach(() => {
  saveStorage = memoryStorage()
  setStorageForTesting(saveStorage)
  setSnapshotStorageForTesting(memoryStorage())
  gameStore.reset(SEED)
})

afterEach(() => {
  setStorageForTesting(undefined)
  setSnapshotStorageForTesting(undefined)
})

// ──────────────────────────────────────────────────────────────────

describe('P2-RT-001 — save serialization survives Svelte proxies', () => {
  it('serializeForSave returns a structured-clone-safe, JSON-stable envelope', () => {
    gameStore.runDay({})
    gameStore.beginDay()
    resolveOneRealSeed()
    queuePick()

    // In the browser every one of these is a deep proxy. This is the
    // shape that threw `DataCloneError` inside serializeForSave.
    gameStore.state = deepProxy(gameStore.state)
    gameStore.pendingBySeedId = deepProxy({ ...gameStore.pendingBySeedId })
    gameStore.latestResult = deepProxy({ ...gameStore.latestResult! })
    gameStore.picks = deepProxy([...gameStore.picks])
    gameStore.dayBaseline = deepProxy(gameStore.dayBaseline!)

    const session = gameStore.serializeForSave()

    expect(() => structuredClone(session)).not.toThrow()
    // Plain all the way down: the envelope is already what JSON.stringify
    // would produce, so nothing is lost or re-shaped on the way to storage.
    expect(session).toEqual(JSON.parse(JSON.stringify(session)))
    // And the payload actually carries the run, not an empty husk.
    expect(session.state.calendar.totalDaysElapsed).toBeGreaterThan(0)
    expect(Object.keys(session.pendingBySeedId).length).toBeGreaterThan(0)
    expect(session.picks.length).toBe(1)
    expect(session.latestResultLite?.reports.length).toBeGreaterThan(0)
  })

  it('a save written through a proxied store still loads', () => {
    gameStore.runDay({})
    gameStore.state = deepProxy(gameStore.state)
    const result = saveSessionFrom(() => gameStore.serializeForSave())
    expect(result.ok).toBe(true)

    // Read it back the way boot does — out of storage, as a string.
    const raw = saveStorage.map.get(SAVE_STORAGE_KEY)
    expect(raw).toBeDefined()
    const outcome = validatePersistedSession(JSON.parse(raw!))
    expect(outcome.kind).toBe('loaded')
  })
})

describe('toPlainSaveData', () => {
  it('reads through proxies and returns plain, unproxied data', () => {
    const source = { a: [1, { b: 'x' }], c: { d: true } }
    const plain = toPlainSaveData(deepProxy(source))
    expect(plain).toEqual(source)
    expect(() => structuredClone(plain)).not.toThrow()
  })

  it('matches JSON.stringify semantics for undefined, functions and toJSON', () => {
    const source = {
      keep: 1,
      dropped: undefined,
      alsoDropped: () => 1,
      when: new Date('2026-07-26T00:00:00.000Z'),
      holes: [undefined, 2],
    }
    expect(toPlainSaveData(source)).toEqual(JSON.parse(JSON.stringify(source)))
  })

  it('throws a located error rather than silently dropping non-JSON data', () => {
    // JSON.stringify would write `{}` for a Map — state that looks present
    // on save and is gone on reload. The save boundary is where the
    // "state is plain JSON" rule has to be enforced.
    expect(() => toPlainSaveData({ modules: { m: new Map([['a', 1]]) } })).toThrow(
      SaveSerializationError,
    )
    expect(() => toPlainSaveData({ tags: new Set(['a']) })).toThrow(
      SaveSerializationError,
    )
    expect(() => toPlainSaveData({ coin: Number.NaN })).toThrow(
      SaveSerializationError,
    )

    const cyclic: Record<string, unknown> = {}
    cyclic['self'] = cyclic
    expect(() => toPlainSaveData(cyclic)).toThrow(SaveSerializationError)

    try {
      toPlainSaveData({ modules: { issues: { seen: new Set() } } })
    } catch (err) {
      expect((err as SaveSerializationError).path).toBe('modules.issues.seen')
    }
  })
})

describe('start-of-day baseline patch', () => {
  it('round-trips the baseline exactly at both mid-day segments', () => {
    // Compared as JSON, which is the form the patch is stored and read
    // back in — see the equality note in baselinePatch.ts.
    const asJson = (v: unknown) => JSON.parse(JSON.stringify(v))

    for (let day = 0; day < 3; day++) {
      gameStore.beginDay()
      const baseline = structuredClone(gameStore.dayBaseline!)
      const patchA = encodeBaselinePatch(gameStore.state, baseline)
      expect(isBaselinePatch(patchA!)).toBe(true)
      expect(asJson(applyBaselinePatch(gameStore.state as TavernState, patchA))).toEqual(
        asJson(baseline),
      )

      gameStore.runService()
      const patchB = encodeBaselinePatch(gameStore.state, baseline)
      expect(isBaselinePatch(patchB!)).toBe(true)
      expect(asJson(applyBaselinePatch(gameStore.state as TavernState, patchB))).toEqual(
        asJson(baseline),
      )

      gameStore.endDay({ responseIntents: [] })
    }
  })

  it('costs a fraction of a second full state', () => {
    // The reason the baseline was dropped from the envelope in the first
    // place (2026-06-11 audit §1) was payload size. Encode a week in so
    // the append-heavy ledgers have grown.
    for (let day = 0; day < 7; day++) gameStore.runDay({})
    gameStore.beginDay()
    gameStore.runService()

    const baseline = gameStore.dayBaseline!
    const patch = encodeBaselinePatch(gameStore.state, baseline)
    const baselineBytes = JSON.stringify(baseline).length
    const patchBytes = JSON.stringify(patch).length
    expect(patchBytes).toBeLessThan(baselineBytes / 2)
  })

  it('does not store the same state twice mid-day', () => {
    // Mid-day the start-of-day baseline IS the previous day's closing
    // state — a day opens from where the last one ended. Encoding the
    // baseline against `closedDayState` rather than against `state` makes
    // that patch empty instead of a second ~220 KB copy, which matters:
    // a day-28 mid-day save is already ~4.4 MB UTF-16 against a typical
    // 5 MB origin budget.
    gameStore.runDay({})
    gameStore.beginDay()
    gameStore.runService()

    const session = gameStore.serializeForSave()
    expect(session.closedDayStatePatch).toBeDefined()
    expect(session.dayBaselinePatch).toBeUndefined()
    expect(session.hasDayBaseline).toBe(true)
    expect(session.dayBaselineBase).toBe('closedDay')

    // And the reconstruction is still exact.
    const baseline = structuredClone(gameStore.dayBaseline!)
    reload()
    expect(gameStore.dayBaseline).toEqual(baseline)
    expect(gameStore.closedDayState).toEqual(baseline)
  })

  it('drops a malformed patch instead of failing the load', () => {
    gameStore.beginDay()
    gameStore.runService()
    const session = gameStore.serializeForSave() as Record<string, unknown>
    session['dayBaselinePatch'] = { nonsense: true }

    const outcome = validatePersistedSession(JSON.parse(JSON.stringify(session)))
    expect(outcome.kind).toBe('loaded')
    if (outcome.kind !== 'loaded') return
    // Baseline gone, run intact — the documented degradation is a partial
    // full-day diff for the resumed day, not a lost session.
    expect(outcome.save.dayBaseline).toBeUndefined()
    expect(outcome.save.daySession.segment).toBe('B')
  })
})

describe('R11 — reload at every day position', () => {
  it('Morning: pending choice, queued action and baseline survive', () => {
    gameStore.beginDay()
    gameStore.setBeat('morning')
    const resolved = resolveOneRealSeed()
    queuePick()
    gameStore.setStaffPriority(Object.keys(gameStore.state.staff)[0]!, 'speed')
    gameStore.setRoute('tavern')
    gameStore.setTavernSubview('stock')

    const before = observableSession()
    reload()
    expect(observableSession()).toEqual(before)
    expect(gameStore.segment).toBe('A')
    expect(gameStore.dayBaseline).toBeDefined()
    if (resolved) {
      expect(gameStore.pendingBySeedId[resolved.seedId]).toEqual(resolved.pending)
    }
    expect(gameStore.picks).toHaveLength(1)
  })

  it('Plan: the queue and staff priorities survive', () => {
    gameStore.beginDay()
    gameStore.setBeat('plan')
    queuePick()
    queuePick()
    gameStore.setStaffPriority(Object.keys(gameStore.state.staff)[0]!, 'care')

    const before = observableSession()
    reload()
    expect(observableSession()).toEqual(before)
    expect(gameStore.beat).toBe('plan')
    expect(gameStore.picks).toHaveLength(2)
  })

  it('Service: the Service outcome strip survives', () => {
    gameStore.beginDay()
    gameStore.runService()
    gameStore.setBeat('service')
    gameStore.setServiceComplete(true)
    const resolved = resolveOneRealSeed()
    if (resolved) ignoreAnotherSeed(resolved.seedId)

    expect(gameStore.serviceOutcome).toBeDefined()
    const before = observableSession()
    reload()
    expect(observableSession()).toEqual(before)
    expect(gameStore.segment).toBe('B')
    // The gate's named field: the strip explaining the coin that already
    // moved must not vanish on refresh.
    expect(gameStore.serviceOutcome).toEqual(before['serviceOutcome'])
    expect(gameStore.serviceComplete).toBe(true)
  })

  it('Closing: pending responses and both completion flags survive', () => {
    gameStore.beginDay()
    gameStore.runService()
    gameStore.setBeat('closing')
    gameStore.setServiceComplete(true)
    gameStore.setClosingComplete(true)
    resolveOneRealSeed()

    const before = observableSession()
    reload()
    expect(observableSession()).toEqual(before)
    expect(gameStore.beat).toBe('closing')
    expect(gameStore.closingComplete).toBe(true)
  })

  it('Report: the closed report archive and calendar survive', () => {
    gameStore.runDay({})
    gameStore.setBeat('report')
    gameStore.setRoute('reports')
    gameStore.setReportsSubview('log')
    gameStore.dismissMissedOpportunity('missed_opp:1:action:clean_area:common_room')

    const before = observableSession()
    expect(gameStore.latestResult?.reports.length).toBeGreaterThan(0)
    reload()
    expect(observableSession()).toEqual(before)
    expect(gameStore.segment).toBe('C')
    expect(gameStore.route).toBe('reports')
    expect(gameStore.reportsSubview).toBe('log')
    expect(gameStore.dismissedMissedOpportunityIds.size).toBe(1)
  })

  it('Next morning: the prior day report survives opening a new day', () => {
    gameStore.runDay({})
    gameStore.beginDay()
    gameStore.setBeat('morning')

    const before = observableSession()
    reload()
    expect(observableSession()).toEqual(before)
    expect(gameStore.state.calendar.totalDaysElapsed).toBe(1)
    expect(gameStore.previousCalendar).toBeDefined()
  })
})

describe('R11 — a resumed day matches an uninterrupted one', () => {
  it('reloading at every pause changes neither the day nor the report', () => {
    // Uninterrupted reference run.
    gameStore.reset(SEED)
    gameStore.beginDay()
    const referencePick = Object.keys(gameStore.state.areas)[0]!
    queuePick()
    gameStore.runService()
    const referenceIntents = { responseIntents: [] }
    gameStore.endDay(referenceIntents)
    const reference = {
      state: JSON.parse(JSON.stringify(gameStore.state)),
      reports: JSON.parse(JSON.stringify(gameStore.latestResult!.reports)),
      dayChanges: dayChangesByPath(),
    }

    // Same run, reloaded at each pause.
    gameStore.reset(SEED)
    gameStore.beginDay()
    reload()
    queuePick(referencePick)
    reload()
    gameStore.runService()
    reload()
    gameStore.endDay(referenceIntents)

    // Identical state means the RNG resumed on the same stream position
    // and the calendar advanced exactly once, not twice.
    expect(JSON.parse(JSON.stringify(gameStore.state))).toEqual(reference.state)
    expect(JSON.parse(JSON.stringify(gameStore.latestResult!.reports))).toEqual(
      reference.reports,
    )
    // GATE B: the full-day diff is still bracketed start-of-day →
    // end-of-day despite the mid-day reloads — every change the
    // uninterrupted day recorded, with the same before/after values.
    //
    // Compared per path rather than as an ordered array: hydration runs
    // state through Zod, which rebuilds objects in schema key order, so a
    // resumed state enumerates its keys in a different sequence than a
    // live one. That reorders the change LIST without changing any
    // change, and it is a property of loading `state` at all — not of the
    // baseline restored alongside it.
    expect(dayChangesByPath()).toEqual(reference.dayChanges)
  })
})

/**
 * The day-boundary diff's changes, keyed by path. See the ordering note
 * at the call site.
 */
function dayChangesByPath(): Record<string, unknown> {
  const day = gameStore.latestResult!.diffs.find((d) => d.boundary === 'day')
  expect(day).toBeDefined()
  const out: Record<string, unknown> = {}
  for (const change of day!.changes as { path: string }[]) {
    out[change.path] = JSON.parse(JSON.stringify(change))
  }
  return out
}

describe('R12 — snapshot, export/import and failure recovery', () => {
  it('a named snapshot round-trips a mid-day run', () => {
    gameStore.runDay({})
    gameStore.beginDay()
    gameStore.runService()
    gameStore.setBeat('closing')
    resolveOneRealSeed()
    const before = observableSession()

    const created = createSnapshot('mid-day', gameStore.serializeForSave())
    expect(created.ok).toBe(true)
    if (!created.ok) return

    gameStore.reset('unrelated-run')
    const outcome = loadSnapshot(created.snapshot.id)
    expect(outcome.kind).toBe('loaded')
    if (outcome.kind !== 'loaded') return
    gameStore.hydrateFromSave(outcome.save)
    expect(observableSession()).toEqual(before)
  })

  it('an exported save re-imports unchanged', () => {
    gameStore.runDay({})
    gameStore.beginDay()
    gameStore.runService()
    const before = observableSession()

    // `exportSessionToFile` only wraps this payload in a download.
    const exported = JSON.stringify(gameStore.serializeForSave(), null, 2)
    const parsed = parseImportedSession(exported)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return

    gameStore.reset('unrelated-run')
    gameStore.hydrateFromSave(parsed.session)
    expect(observableSession()).toEqual(before)
  })

  it('a serialization failure is a reportable save error, not an uncaught throw', () => {
    // The second half of P2-RT-001: the throw happened while BUILDING the
    // envelope, so it never became a `SaveResult` and the banner (and its
    // Retry) never appeared — the run silently stopped being saved.
    const result = saveSessionFrom(() => {
      throw new SaveSerializationError('modules.x', 'Set')
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('serialize')
    expect(result.message).toContain('modules.x')
  })

  it('a storage write failure is still reported separately', () => {
    setStorageForTesting({
      getItem: () => null,
      setItem: () => {
        throw Object.assign(new Error('full'), { name: 'QuotaExceededError' })
      },
      removeItem: () => {},
    })
    const result = saveSessionFrom(() => gameStore.serializeForSave())
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('quota')
  })
})
