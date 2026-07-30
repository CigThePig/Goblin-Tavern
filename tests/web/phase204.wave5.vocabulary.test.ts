// Phase 204 / gameplay audit Wave 5 — the surface half of the wave.
//
// Plan: docs/plans/phase-204-audit-wave-5-secondary-surfaces-and-identity.md.
//
//   P6-COMP-007  implementation vocabulary leaks onto default player
//                surfaces (`staff_arc`, `cleanliness_negative`,
//                `ogres_dismissed`, "engine fallback")
//
// Also carries the wave's gate: R15 crosses every root/detail/support
// surface without error, on a populated day and after a reload.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { gameStore } from '../../web/src/lib/sim/gameStore.svelte'
import {
  setStorageForTesting,
  type StorageLike,
} from '../../web/src/lib/sim/persistence'
import {
  getDefaultPreferences,
  loadPreferences,
} from '../../web/src/lib/prefs/preferences'
import { renderCard } from '../../web/src/lib/cards/realCardRegistry'
import { buildTavernOverview } from '../../src/reports/tavernOverviewProjection'
import { buildWorldOverview } from '../../src/reports/worldOverviewProjection'
import { buildTavernLog } from '../../src/reports/tavernLogProjection'
import { buildWeeklyOverview } from '../../src/reports/weeklyOverviewProjection'
import { buildMonthlyOverview } from '../../src/reports/monthlyOverviewProjection'
import { buildDailyReport } from '../../src/reports/dailyReportProjection'
import { idLabel } from '../../src/reports/labels/idLabel'

const SEED = 'phase204-wave5-web'

function memoryStorage(): StorageLike {
  const map = new Map<string, string>()
  return {
    getItem: (k) => (map.has(k) ? map.get(k)! : null),
    setItem: (k, v) => {
      map.set(k, v)
    },
    removeItem: (k) => {
      map.delete(k)
    },
  }
}

beforeEach(() => {
  setStorageForTesting(memoryStorage())
  gameStore.reset(SEED)
})

afterEach(() => {
  setStorageForTesting(undefined)
})

/** Close `days` full days so every surface has something to render. */
function playDays(days: number): void {
  for (let i = 0; i < days; i += 1) gameStore.runDay()
}

/**
 * Every string a projection would put in front of the player, flattened.
 * Keys are skipped — an object key is never rendered — as are the fields
 * that ARE identifiers by contract (`id`, `actionId`, `targetId`, …),
 * which surfaces use for keys and routing, not as copy.
 */
const ID_FIELDS = new Set([
  'id',
  'seedId',
  'cardId',
  'actionId',
  'targetId',
  'pickId',
  'definitionId',
  'profileId',
  'intentId',
  'responseSlotId',
  'slotId',
  'policyId',
  'projectType',
  'runnerId',
  'ingredientId',
  'stockId',
  'areaId',
  // Expansion Phase 2 §2.2 — the construction planner routes on
  // `<areaId>:<upgradeId>` composite targets, so `upgradeId` joins the
  // identifier-by-contract list beside `areaId` and `stockId`. Every upgrade a
  // player reads is rendered from its catalogue `label`; the quote's
  // `replacesLabel` is likewise a label, not the id it resolves.
  'upgradeId',
  'edgeId',
  'staffId',
  'path',
  'source',
  'kind',
  'category',
  'family',
  'meterId',
  'type',
  'status',
  'verb',
  'shape',
  'tags',
  'systems',
  'relatedSystems',
  'mechanicalRefs',
  'activeFlags',
  'personalityTags',
  'culturalTags',
  'toneHints',
  'domain',
  'workStyle',
  'stressResponse',
  'worstMeterKey',
  'conditionAdjectiveKey',
  'targetType',
  'sourceType',
  'outcome',
  'stage',
  'rarity',
  'demandTier',
  'timing',
  'direction',
  'dayType',
  'currentPriority',
  'magnitudeBand',
  'meterDisplayCategory',
  // Structural ids the panels key and queue on, never render as copy.
  'policyType',
  'toggleActionId',
  'storageAreaId',
  'role',
  'favoriteStockId',
  'currentExpeditionId',
  'targetIngredientId',
  'targetTier',
  'conflictsWith',
  'knownIncidentIds',
])

function collectCopy(value: unknown, key?: string, out: string[] = []): string[] {
  if (typeof value === 'string') {
    if (!key || !ID_FIELDS.has(key)) out.push(value)
    return out
  }
  if (Array.isArray(value)) {
    for (const item of value) collectCopy(item, key, out)
    return out
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      collectCopy(v, k, out)
    }
  }
  return out
}

/**
 * A raw identifier that reached player copy: two or more lowercase words
 * joined by underscores, with no spaces around it that would make it a
 * deliberate code sample. This is the audit's "vocabulary scan".
 */
const RAW_ID = /\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/

function leaks(strings: string[]): string[] {
  return [...new Set(strings.filter((s) => RAW_ID.test(s)))]
}

// ── P6-COMP-007 — the vocabulary layer ──────────────────────────────

describe('P6-COMP-007 — default surfaces speak English', () => {
  it('names a seed family for the player, and keeps the id for diagnostics', () => {
    // The audit saw `staff_arc` and `area_atmosphere` in card corners.
    expect(idLabel('seedFamily', 'staff_arc')).toBe('Your people')
    expect(idLabel('seedFamily', 'area_atmosphere')).toBe('The rooms')
    // An unmapped family still reads as words, never as an id.
    expect(idLabel('seedFamily', 'some_new_family')).toBe('Some new family')
  })

  it('names area trait mechanical tags for the player', () => {
    // `cleanliness_negative`, `risk_positive`, `merchant_sensitive` were
    // rendered verbatim on the area detail sheet.
    expect(idLabel('mechanicalTag', 'cleanliness_negative')).toBe(
      'harder to keep clean',
    )
    expect(idLabel('mechanicalTag', 'risk_positive')).toBe('riskier')
    expect(idLabel('mechanicalTag', 'merchant_sensitive')).toBe(
      'merchants notice',
    )
    expect(RAW_ID.test(idLabel('mechanicalTag', 'a_brand_new_hook'))).toBe(false)
  })

  it('keeps raw identifiers off by default', () => {
    const prefs = getDefaultPreferences()
    expect(prefs.showDiagnostics).toBe(false)
    // …and the preference survives a load, so turning it on sticks.
    const loaded = loadPreferences()
    expect(loaded.prefs.showDiagnostics).toBe(false)
  })

  it('renders no raw identifier in the area detail projection', () => {
    playDays(2)
    const overview = buildTavernOverview(gameStore.state)
    const traitCopy = overview.areas.rows.flatMap((row) =>
      row.traits.flatMap((t) => [t.label, t.description, ...t.tags]),
    )
    expect(traitCopy.length).toBeGreaterThan(0)
    expect(leaks(traitCopy)).toEqual([])
  })

  it('renders no raw identifier in memory rows', () => {
    playDays(4)
    const world = buildWorldOverview(gameStore.state)
    const memoryLabels = world.regulars.rows.flatMap((r) =>
      r.recentMemories.map((m) => m.label),
    )
    // `ogres_dismissed` was surfacing where a sentence belonged.
    expect(leaks(memoryLabels)).toEqual([])
  })

  it('renders no raw identifier across a swept day of player copy', () => {
    playDays(4)
    // The audit's own verification method: a vocabulary scan over default
    // cards, reports and detail sheets. `collectCopy` flattens every
    // string a projection carries EXCEPT the fields that are identifiers
    // by contract — surfaces use those for keys and routing, never as
    // copy — so what is left is what the player reads.
    const swept = [
      ...collectCopy(buildTavernOverview(gameStore.state)),
      // The report renders `humanReadable` for every diff row;
      // `readable` is the sim's own machine line, carried as data beside
      // it and never shown.
      ...Object.values(
        buildDailyReport(
          gameStore.latestResult!,
          gameStore.closedDayState ?? gameStore.state,
        ).groupedDiffs,
      ).flatMap((rows) => rows.map((d) => d.humanReadable)),
    ]
    expect(swept.length).toBeGreaterThan(50)
    expect(leaks(swept)).toEqual([])
  })

  it('renders no raw identifier in a full day of cards', () => {
    gameStore.beginDay()
    const seeds = gameStore.todaysSeeds
    const copy: string[] = []
    for (const seed of seeds) {
      const view = renderCard(seed, gameStore.state)
      copy.push(view.title, ...view.body)
      for (const choice of view.choices) {
        copy.push(choice.label, ...(choice.previewEffects ?? []))
      }
      const ctx = view.context
      copy.push(
        ...[
          ...(ctx?.whyNow ?? []),
          ...(ctx?.causes ?? []),
          ...(ctx?.history ?? []),
          ...(ctx?.future ?? []),
        ].map((l) => l.readable),
      )
    }
    expect(leaks(copy)).toEqual([])
  })
})

// ── Wave 5 gate — R15 crosses every surface without error ───────────

describe('Wave 5 gate — R15 crosses every surface', () => {
  /** Every root/detail/support projection a player can reach. */
  function crossEverySurface(): Record<string, unknown> {
    const state = gameStore.state
    const result = gameStore.latestResult
    return {
      tavern: buildTavernOverview(state),
      world: buildWorldOverview(state),
      log: buildTavernLog(state),
      weekly: buildWeeklyOverview(state),
      monthly: buildMonthlyOverview(state),
      ...(result
        ? { daily: buildDailyReport(result, gameStore.closedDayState ?? state) }
        : {}),
    }
  }

  it('crosses every surface on a populated day', () => {
    playDays(3)
    // The audit reached the Log and the glossary and both took the app to
    // its error boundary. Nothing here may throw.
    const surfaces = crossEverySurface()
    expect(Object.keys(surfaces).length).toBeGreaterThan(4)
    const log = surfaces['log'] as { rows: { tags: string[] }[] }
    expect(log.rows.length).toBeGreaterThan(0)
    for (const row of log.rows) {
      expect(new Set(row.tags).size).toBe(row.tags.length)
    }
  })

  it('crosses every surface again after a reload', () => {
    playDays(3)
    const before = JSON.stringify(crossEverySurface())

    const save = gameStore.serializeForSave()
    gameStore.reset(SEED)
    gameStore.hydrateFromSave(save as never)

    // Entity names and historical labels survive the round trip, which is
    // the second half of the wave's gate.
    expect(JSON.stringify(crossEverySurface())).toBe(before)
  })

  it('keeps a fired staff member named across close, next day and reload', () => {
    gameStore.runDay()
    // Hire, then fire on a later day.
    gameStore.beginDay()
    gameStore.tryAddPick({
      actionId: 'hire_staff',
      label: 'Hire Staff',
      category: 'immediate',
      targetType: 'staff',
      targetId: 'kitchen_hand',
      targetLabel: 'Kitchen Hand',
      timeCost: 240,
    })
    const before = new Set(Object.keys(gameStore.state.staff))
    gameStore.runService()
    gameStore.endDay()
    const hiredId = Object.keys(gameStore.state.staff).find(
      (id) => !before.has(id),
    )
    expect(hiredId).toBeDefined()
    const name = gameStore.state.staff[hiredId!]!.name.display

    gameStore.beginDay()
    const queued = gameStore.tryAddPick({
      actionId: 'fire_staff',
      label: 'Fire Staff',
      category: 'immediate',
      targetType: 'staff',
      targetId: hiredId!,
      targetLabel: name,
      timeCost: 120,
    })
    expect(queued.ok).toBe(true)
    gameStore.runService()
    gameStore.endDay()

    expect(gameStore.state.staff[hiredId!]).toBeUndefined()

    const report = () =>
      buildDailyReport(
        gameStore.latestResult!,
        gameStore.closedDayState ?? gameStore.state,
      )
    const named = () =>
      report().ownerActionsApplied.find((l) => l.actionId === 'fire_staff')
        ?.targetLabel

    // Immediately after close…
    expect(named()).toBe(name)

    // …and after a reload of that same closed day.
    const save = gameStore.serializeForSave()
    gameStore.reset(SEED)
    gameStore.hydrateFromSave(save as never)
    expect(named()).toBe(name)
  })
})
