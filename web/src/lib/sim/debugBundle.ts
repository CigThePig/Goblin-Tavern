// Debug bundle — narrow, stable JSON snapshot of UI + sim state for
// bug reports. Pulled together at one moment in time so the user can
// copy + paste a triage-friendly blob into an issue.
//
// Intentionally narrower than a full save: omits card prose, history,
// memories, and the heavy modules slot. The Saves section already
// exposes a full state export for cases that need it.

import { gameStore } from './gameStore.svelte'
import { prefsStore } from '../prefs/prefsStore.svelte'

type CustomerGroupSummary = {
  id: string
  satisfaction: number
  patronage: number
  loyalty: number
}

type PressureSummary = {
  id: string
  value: number
  trend: number
}

type PendingSummary =
  | { kind: 'choice'; slotId: string; verb: string }
  | { kind: 'ignore' }

type PickSummary = {
  pickId: string
  actionId: string
  label: string
  targetLabel?: string
}

type LatestResultSummary = {
  reportCount: number
  logCount: number
  diffCount: number
  validationErrors: number
  validationWarnings: number
}

export type DebugBundle = {
  capturedAt: string
  userAgent?: string
  build: {
    simVersion: string
    tavernId: string
    tavernName: string
  }
  ui: {
    route: string
    reportsSubview: string
    tavernSubview: string
    worldSubview: string
    beat: string
    serviceComplete: boolean
    closingComplete: boolean
    savedSnapshotJustLoaded: boolean
  }
  sim: {
    seedString: string
    calendar: {
      day: number
      week: number
      month: number
      year: number
      totalDaysElapsed: number
      dayOfWeek: number
      dayType: string
      season: string
      tags: string[]
    }
    coin: number
    staffCount: number
    areaCount: number
    customerGroups: CustomerGroupSummary[]
    topPressures: PressureSummary[]
  }
  player: {
    pendingBySeedId: Record<string, PendingSummary>
    picks: PickSummary[]
    staffPriorities: Record<string, string>
  }
  errors: {
    runError?: { message: string; stack?: string }
    saveError?: unknown
    hydrationError?: string
  }
  persistence: {
    lastSavedAt?: string
  }
  preferences: Record<string, unknown>
  latestResult?: LatestResultSummary
}

function summarizePending(
  pending: Record<string, unknown>,
): Record<string, PendingSummary> {
  const out: Record<string, PendingSummary> = {}
  for (const [seedId, value] of Object.entries(pending)) {
    if (!value || typeof value !== 'object') continue
    const v = value as { kind?: string; slotId?: string; verb?: string }
    if (v.kind === 'ignore') {
      out[seedId] = { kind: 'ignore' }
    } else if (v.kind === 'choice' && v.slotId && v.verb) {
      out[seedId] = { kind: 'choice', slotId: v.slotId, verb: v.verb }
    }
  }
  return out
}

function summarizePicks(picks: readonly unknown[]): PickSummary[] {
  const out: PickSummary[] = []
  for (const raw of picks) {
    if (!raw || typeof raw !== 'object') continue
    const p = raw as {
      pickId?: string
      actionId?: string
      label?: string
      targetLabel?: string
    }
    if (!p.pickId || !p.actionId || !p.label) continue
    const entry: PickSummary = {
      pickId: p.pickId,
      actionId: p.actionId,
      label: p.label,
    }
    if (p.targetLabel) entry.targetLabel = p.targetLabel
    out.push(entry)
  }
  return out
}

function summarizeCustomerGroups(
  groups: Record<string, unknown>,
): CustomerGroupSummary[] {
  const out: CustomerGroupSummary[] = []
  for (const [id, raw] of Object.entries(groups)) {
    if (!raw || typeof raw !== 'object') continue
    const g = raw as {
      satisfaction?: number
      patronage?: number
      loyalty?: number
    }
    out.push({
      id,
      satisfaction: g.satisfaction ?? 0,
      patronage: g.patronage ?? 0,
      loyalty: g.loyalty ?? 0,
    })
  }
  out.sort((a, b) => a.id.localeCompare(b.id))
  return out
}

function topPressures(
  pressures: Record<string, unknown>,
  limit = 5,
): PressureSummary[] {
  const all: PressureSummary[] = []
  for (const [id, raw] of Object.entries(pressures)) {
    if (!raw || typeof raw !== 'object') continue
    const p = raw as { value?: number; trend?: number }
    all.push({ id, value: p.value ?? 0, trend: p.trend ?? 0 })
  }
  all.sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
  return all.slice(0, limit)
}

function summarizeLatestResult(
  result: unknown,
): LatestResultSummary | undefined {
  if (!result || typeof result !== 'object') return undefined
  const r = result as {
    reports?: unknown[]
    logs?: unknown[]
    diffs?: unknown[]
    validation?: { errors?: unknown[]; warnings?: unknown[] }
  }
  return {
    reportCount: Array.isArray(r.reports) ? r.reports.length : 0,
    logCount: Array.isArray(r.logs) ? r.logs.length : 0,
    diffCount: Array.isArray(r.diffs) ? r.diffs.length : 0,
    validationErrors: Array.isArray(r.validation?.errors)
      ? r.validation!.errors.length
      : 0,
    validationWarnings: Array.isArray(r.validation?.warnings)
      ? r.validation!.warnings.length
      : 0,
  }
}

export function buildDebugBundle(): DebugBundle {
  const state = gameStore.state
  const bundle: DebugBundle = {
    capturedAt: new Date().toISOString(),
    build: {
      simVersion: state.meta.simVersion,
      tavernId: state.meta.tavernId,
      tavernName: state.meta.tavernName,
    },
    ui: {
      route: gameStore.route,
      reportsSubview: gameStore.reportsSubview,
      tavernSubview: gameStore.tavernSubview,
      worldSubview: gameStore.worldSubview,
      beat: gameStore.beat,
      serviceComplete: gameStore.serviceComplete,
      closingComplete: gameStore.closingComplete,
      savedSnapshotJustLoaded: gameStore.savedSnapshotJustLoaded,
    },
    sim: {
      seedString: gameStore.seedString,
      calendar: {
        day: state.calendar.day,
        week: state.calendar.week,
        month: state.calendar.month,
        year: state.calendar.year,
        totalDaysElapsed: state.calendar.totalDaysElapsed,
        dayOfWeek: state.calendar.dayOfWeek,
        dayType: state.calendar.dayType,
        season: state.calendar.season,
        tags: [...state.calendar.tags],
      },
      coin: state.coin,
      staffCount: Object.keys(state.staff).length,
      areaCount: Object.keys(state.areas).length,
      customerGroups: summarizeCustomerGroups(state.customerGroups),
      topPressures: topPressures(state.pressures),
    },
    player: {
      pendingBySeedId: summarizePending(gameStore.pendingBySeedId),
      picks: summarizePicks(gameStore.picks),
      staffPriorities: { ...gameStore.staffPriorities },
    },
    errors: {},
    persistence: {},
    preferences: { ...prefsStore.preferences },
  }

  if (gameStore.runError) bundle.errors.runError = { ...gameStore.runError }
  if (gameStore.saveError) bundle.errors.saveError = gameStore.saveError
  if (gameStore.hydrationError) bundle.errors.hydrationError = gameStore.hydrationError

  if (gameStore.lastSavedAt) bundle.persistence.lastSavedAt = gameStore.lastSavedAt

  // `web/**/*.ts` is checked under the main tsconfig (no DOM lib), so
  // DOM globals are reached via `globalThis` with a narrow cast —
  // matching the convention in persistence.ts / snapshots.ts.
  const nav = (globalThis as { navigator?: { userAgent?: string } }).navigator
  if (nav && typeof nav.userAgent === 'string') {
    bundle.userAgent = nav.userAgent
  }

  const latest = summarizeLatestResult(gameStore.latestResult)
  if (latest) bundle.latestResult = latest

  return bundle
}

export function debugBundleAsText(): string {
  return JSON.stringify(buildDebugBundle(), null, 2)
}
