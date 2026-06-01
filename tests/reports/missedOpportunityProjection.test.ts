// Phase 97 — Tests for projectMissedOpportunities.
//
// The projection has three sub-projectors (pressure-remedy, ignored-
// seed, diff-counterfactual) plus dedup + cap + dismissal. We test the
// behaviours through hand-rolled `(SimResult, TavernState)` pairs —
// faster and more targeted than spinning up the full simulator. End-
// to-end coverage lives in tests/sim/phase97.missedOpportunityRoundtrip.

import { describe, expect, it } from 'vitest'

import {
  projectMissedOpportunities,
} from '../../src/reports/missedOpportunityProjection'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import type { SimResult } from '../../src/sim/core/result'
import type {
  CauseEntry,
  TavernState,
} from '../../src/sim/state/TavernState'
import type {
  PressureSnapshot,
} from '../../src/sim/modules/pressures/pressureTypes'
import type {
  IssueSeed,
} from '../../src/sim/modules/issues/issueSeedTypes'
import type {
  ResolvedIntentRecord,
} from '../../src/sim/modules/responses/types'
import type {
  StateChange,
  TaggedStateDiff,
} from '../../src/sim/core/diff'
import type { ReportSection } from '../../src/sim/core/reports'
import type {
  OwnerActionApplied,
} from '../../src/sim/modules/ownerActions/types'

// ─── Fixtures ─────────────────────────────────────────────────────────

const CLOSED_DAY = 5

function baseState(overrides?: (s: TavernState) => void): TavernState {
  const s = createInitialTavernState()
  s.calendar = { ...s.calendar, totalDaysElapsed: CLOSED_DAY + 1 }
  if (overrides) overrides(s)
  return s
}

function withPressureSnapshot(
  state: TavernState,
  id: string,
  snap: Partial<PressureSnapshot>,
): TavernState {
  const full: PressureSnapshot = {
    id,
    label: snap.label ?? id,
    value: snap.value ?? 50,
    previousValue: snap.previousValue ?? 40,
    delta: snap.delta ?? 10,
    trend: snap.trend ?? 'rising',
    severity: snap.severity ?? 60,
    urgency: snap.urgency ?? 40,
    volatility: snap.volatility ?? 10,
    causes: snap.causes ?? [],
    relatedActors: snap.relatedActors ?? [],
    relatedLocations: snap.relatedLocations ?? [],
    relatedSystems: snap.relatedSystems ?? [],
    tags: snap.tags ?? [],
    consequences: snap.consequences ?? [],
    lastUpdated: snap.lastUpdated ?? {
      year: 1,
      month: 1,
      week: 1,
      day: 1,
      absoluteDay: CLOSED_DAY,
    },
  }
  const slice = (state.modules['pressures'] as
    | { snapshots?: Record<string, PressureSnapshot> }
    | undefined) ?? { snapshots: {} }
  state.modules['pressures'] = {
    ...slice,
    snapshots: { ...(slice.snapshots ?? {}), [id]: full },
  }
  return state
}

function withResolvedToday(
  state: TavernState,
  records: ResolvedIntentRecord[],
): TavernState {
  state.modules['responses'] = {
    ...((state.modules['responses'] as Record<string, unknown>) ?? {}),
    resolvedToday: records,
  }
  return state
}

function withSeedsToday(state: TavernState, seeds: IssueSeed[]): TavernState {
  state.modules['issueSeeds'] = {
    ...((state.modules['issueSeeds'] as Record<string, unknown>) ?? {}),
    seedsToday: seeds,
  }
  return state
}

function withCauses(state: TavernState, entries: Partial<CauseEntry>[]): TavernState {
  const causes: CauseEntry[] = entries.map((e, i) => ({
    id: e.id ?? `cause-${i}`,
    timestamp: e.timestamp ?? {
      year: 1,
      month: 1,
      week: 1,
      day: 1,
      absoluteDay: CLOSED_DAY,
    },
    source: e.source ?? 'service',
    sourceType: e.sourceType ?? 'service',
    target: e.target ?? '',
    targetType: e.targetType ?? 'global',
    amount: e.amount ?? 0,
    direction: e.direction ?? 'neutral',
    weight: e.weight ?? Math.abs(e.amount ?? 0),
    readable: e.readable ?? '',
    tags: e.tags ?? [],
    relatedActors: e.relatedActors ?? [],
    relatedLocations: e.relatedLocations ?? [],
    relatedSystems: e.relatedSystems ?? [],
    ageDays: e.ageDays ?? 0,
    ...(e.expiresAfterDays !== undefined
      ? { expiresAfterDays: e.expiresAfterDays }
      : {}),
  }))
  state.causes = [...state.causes, ...causes]
  return state
}

function makeResult(opts: {
  applied?: OwnerActionApplied[]
  significantChanges?: StateChange[]
} = {}): SimResult {
  const reports: ReportSection[] = []
  if (opts.applied) {
    reports.push({
      id: 'ownerActions',
      source: 'ownerActions',
      title: 'OWNER ACTIONS',
      lines: [],
      data: { applied: opts.applied, rejected: [] },
    })
  }
  const dayDiff: TaggedStateDiff = {
    boundary: 'day',
    changes: opts.significantChanges ?? [],
    significantChanges: opts.significantChanges ?? [],
  }
  return {
    state: createInitialTavernState(),
    reports,
    logs: [],
    validation: { errors: [], warnings: [] },
    diffs: [dayDiff],
  }
}

function makeIgnoredSeed(overrides: Partial<IssueSeed> = {}): IssueSeed {
  return {
    id: overrides.id ?? 'seed-ignored',
    family: overrides.family ?? 'stock_shortage',
    type: overrides.type ?? 'warning',
    domain: overrides.domain ?? ['stock'],
    timing: overrides.timing ?? 'morning_prep',
    severity: overrides.severity ?? 50,
    urgency: overrides.urgency ?? 40,
    novelty: overrides.novelty ?? 60,
    cardWorthiness: overrides.cardWorthiness ?? 50,
    affectedActors: overrides.affectedActors ?? [],
    causes: overrides.causes ?? [],
    pressures: overrides.pressures ?? [],
    stakes: overrides.stakes ?? [],
    responseSlots: overrides.responseSlots ?? [
      {
        id: 'do-something',
        labelHint: 'Restock the cellar',
        allowedVerbs: ['buy'],
        shape: 'safe_costly',
        targetOptions: [],
        expectedEffects: ['stock +20'],
      },
      {
        id: 'ignore',
        labelHint: 'Do nothing',
        allowedVerbs: ['ignore'],
        shape: 'ignore',
        targetOptions: [],
        expectedEffects: [],
      },
    ],
    consequenceProfiles: overrides.consequenceProfiles ?? [
      {
        id: 'profile-do-something',
        responseSlotId: 'do-something',
        immediateEffects: [],
        delayedEffects: [],
        memories: [],
        futureHooks: [],
        impactScore: 70,
      },
    ],
    memoriesCreated: overrides.memoriesCreated ?? [],
    futureHooks: overrides.futureHooks ?? [],
    toneHints: overrides.toneHints ?? [],
    textIngredients: overrides.textIngredients ?? {
      subject: 'shortage',
      sensoryDetails: [],
      actorOpinions: {},
      recentContext: [],
      stakesReadable: [],
    },
    validation: overrides.validation ?? {
      valid: true,
      errors: [],
      warnings: [],
      contractChecks: {},
    },
    generatedAt: overrides.generatedAt ?? {
      year: 1,
      month: 1,
      week: 1,
      day: 1,
      absoluteDay: CLOSED_DAY,
    },
  }
}

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length
}

// ─── Empty / day-1 ────────────────────────────────────────────────────

describe('projectMissedOpportunities — empty / day-1', () => {
  it('returns [] when closedDay < 1', () => {
    const state = baseState()
    const result = makeResult()
    const lines = projectMissedOpportunities(result, state, {
      closedDay: 0,
    })
    expect(lines).toEqual([])
  })

  it('returns [] when nothing has happened today', () => {
    const state = baseState()
    const result = makeResult()
    const lines = projectMissedOpportunities(result, state, {
      closedDay: CLOSED_DAY,
    })
    expect(lines).toEqual([])
  })
})

// ─── Pressure-remedy ──────────────────────────────────────────────────

describe('projectMissedOpportunities — pressure remedy', () => {
  it('surfaces a clean_area opportunity when food_safety rose without applied remedy', () => {
    const state = withPressureSnapshot(baseState(), 'food_safety', {
      label: 'Food Safety',
      value: 55,
      previousValue: 45,
      delta: 10,
      severity: 70,
      relatedLocations: [{ kind: 'area', id: 'kitchen' }],
    })
    const result = makeResult()
    const lines = projectMissedOpportunities(result, state, {
      closedDay: CLOSED_DAY,
    })
    expect(lines.length).toBeGreaterThan(0)
    const cleanLine = lines.find((l) => l.actionId === 'clean_area')
    expect(cleanLine).toBeDefined()
    expect(cleanLine!.kind).toBe('pressure_remedy')
    expect(cleanLine!.pressureId).toBe('food_safety')
    expect(cleanLine!.targetRef?.id).toBe('kitchen')
    expect(cleanLine!.readable.toLowerCase()).toContain('cleaning')
    expect(cleanLine!.readable.toLowerCase()).toContain('food safety')
  })

  it('suppresses the opportunity when the remedy action was applied today', () => {
    const state = withPressureSnapshot(baseState(), 'food_safety', {
      value: 55,
      delta: 10,
      severity: 70,
      relatedLocations: [{ kind: 'area', id: 'kitchen' }],
    })
    const result = makeResult({
      applied: [
        {
          actionId: 'clean_area',
          label: 'Cleaned Kitchen',
          targetId: 'kitchen',
          timeCost: 1,
          effects: [],
          data: {},
        },
      ],
    })
    const lines = projectMissedOpportunities(result, state, {
      closedDay: CLOSED_DAY,
    })
    expect(lines.find((l) => l.actionId === 'clean_area')).toBeUndefined()
  })

  it('respects the value threshold — low-value pressure does not surface', () => {
    const state = withPressureSnapshot(baseState(), 'food_safety', {
      value: 20,
      delta: 5,
      severity: 30,
    })
    const result = makeResult()
    const lines = projectMissedOpportunities(result, state, {
      closedDay: CLOSED_DAY,
    })
    expect(lines.find((l) => l.pressureId === 'food_safety')).toBeUndefined()
  })

  it('respects the delta threshold — a flat pressure does not surface', () => {
    const state = withPressureSnapshot(baseState(), 'food_safety', {
      value: 70,
      delta: 0,
      severity: 80,
    })
    const result = makeResult()
    const lines = projectMissedOpportunities(result, state, {
      closedDay: CLOSED_DAY,
    })
    expect(lines.find((l) => l.pressureId === 'food_safety')).toBeUndefined()
  })

  it('surfaces no line for pressures without an immediate-action remedy', () => {
    const state = withPressureSnapshot(baseState(), 'violence', {
      value: 70,
      delta: 20,
      severity: 80,
    })
    const result = makeResult()
    const lines = projectMissedOpportunities(result, state, {
      closedDay: CLOSED_DAY,
    })
    expect(lines.find((l) => l.pressureId === 'violence')).toBeUndefined()
  })

  it('targets a named staff member for staff_burnout', () => {
    const state = withPressureSnapshot(baseState(), 'staff_burnout', {
      value: 55,
      delta: 10,
      severity: 60,
    })
    const result = makeResult()
    const lines = projectMissedOpportunities(result, state, {
      closedDay: CLOSED_DAY,
    })
    const line = lines.find((l) => l.actionId === 'pay_staff_bonus')
    expect(line).toBeDefined()
    expect(line!.targetRef?.kind).toBe('staff')
    expect(line!.targetLabel).toBeDefined()
  })
})

// ─── Ignored-seed ─────────────────────────────────────────────────────

describe('projectMissedOpportunities — ignored seed', () => {
  it('surfaces a line for a seed with no matching response intent', () => {
    const state = withSeedsToday(baseState(), [
      makeIgnoredSeed({ id: 'seed-cellar', severity: 60, novelty: 70 }),
    ])
    const result = makeResult()
    const lines = projectMissedOpportunities(result, state, {
      closedDay: CLOSED_DAY,
    })
    const ignored = lines.find((l) => l.kind === 'ignored_seed')
    expect(ignored).toBeDefined()
    expect(ignored!.seedId).toBe('seed-cellar')
    expect(ignored!.readable).toMatch(/would have/i)
  })

  it('suppresses the line when the seed is in resolvedToday', () => {
    const seed = makeIgnoredSeed({ id: 'seed-resolved' })
    const state = withResolvedToday(
      withSeedsToday(baseState(), [seed]),
      [
        {
          intentId: 'i1',
          seedId: 'seed-resolved',
          responseSlotId: 'do-something',
          profileId: 'profile-do-something',
          verb: 'buy',
          resolvedOn: CLOSED_DAY,
        },
      ],
    )
    const result = makeResult()
    const lines = projectMissedOpportunities(result, state, {
      closedDay: CLOSED_DAY,
    })
    expect(lines.find((l) => l.kind === 'ignored_seed')).toBeUndefined()
  })

  it('skips seeds where validation.valid === false', () => {
    const seed = makeIgnoredSeed({
      id: 'seed-invalid',
      validation: {
        valid: false,
        errors: ['bad'],
        warnings: [],
        contractChecks: {},
      },
    })
    const state = withSeedsToday(baseState(), [seed])
    const result = makeResult()
    const lines = projectMissedOpportunities(result, state, {
      closedDay: CLOSED_DAY,
    })
    expect(lines.find((l) => l.kind === 'ignored_seed')).toBeUndefined()
  })

  it('skips seeds with no non-ignore response slot', () => {
    const seed = makeIgnoredSeed({
      id: 'seed-only-ignore',
      responseSlots: [
        {
          id: 'ignore',
          labelHint: 'Do nothing',
          allowedVerbs: ['ignore'],
          shape: 'ignore',
          targetOptions: [],
          expectedEffects: [],
        },
      ],
    })
    const state = withSeedsToday(baseState(), [seed])
    const result = makeResult()
    const lines = projectMissedOpportunities(result, state, {
      closedDay: CLOSED_DAY,
    })
    expect(lines.find((l) => l.kind === 'ignored_seed')).toBeUndefined()
  })
})

// ─── Diff-counterfactual ──────────────────────────────────────────────

describe('projectMissedOpportunities — diff counterfactual', () => {
  it('surfaces a clean_area line when an area cleanliness slid with cleanliness-tagged causes', () => {
    const state = withCauses(baseState(), [
      {
        target: 'area:kitchen',
        targetType: 'area',
        sourceType: 'service',
        readable: 'Kitchen got dirtier during service.',
        amount: -8,
        direction: 'decrease',
        weight: 8,
        tags: ['cleanliness', 'service'],
        relatedLocations: [{ kind: 'area', id: 'kitchen' }],
      },
    ])
    const result = makeResult({
      significantChanges: [
        {
          path: 'areas.kitchen.cleanliness',
          before: 60,
          after: 50,
          delta: -10,
          readable: 'kitchen cleanliness 60 → 50',
          tags: ['area', 'kitchen', 'cleanliness'],
        },
      ],
    })
    const lines = projectMissedOpportunities(result, state, {
      closedDay: CLOSED_DAY,
    })
    const diffLine = lines.find((l) => l.kind === 'diff_counterfactual')
    expect(diffLine).toBeDefined()
    expect(diffLine!.actionId).toBe('clean_area')
    expect(diffLine!.diffPath).toBe('areas.kitchen.cleanliness')
    expect(diffLine!.targetRef?.id).toBe('kitchen')
  })

  it('suppresses the diff-counterfactual line when the remedy was applied today', () => {
    const state = withCauses(baseState(), [
      {
        target: 'area:kitchen',
        targetType: 'area',
        sourceType: 'service',
        readable: 'Kitchen got dirtier during service.',
        amount: -8,
        direction: 'decrease',
        weight: 8,
        tags: ['cleanliness'],
      },
    ])
    const result = makeResult({
      applied: [
        {
          actionId: 'clean_area',
          label: 'Cleaned Kitchen',
          targetId: 'kitchen',
          timeCost: 1,
          effects: [],
          data: {},
        },
      ],
      significantChanges: [
        {
          path: 'areas.kitchen.cleanliness',
          before: 60,
          after: 50,
          delta: -10,
          readable: 'cleanliness fell',
          tags: ['area', 'kitchen'],
        },
      ],
    })
    const lines = projectMissedOpportunities(result, state, {
      closedDay: CLOSED_DAY,
    })
    expect(lines.find((l) => l.kind === 'diff_counterfactual')).toBeUndefined()
  })

  it('skips changes outside the tracked domains', () => {
    const state = baseState()
    const result = makeResult({
      significantChanges: [
        {
          path: 'coin',
          before: 100,
          after: 90,
          delta: -10,
          readable: 'coin -10',
          tags: ['coin'],
        },
      ],
    })
    const lines = projectMissedOpportunities(result, state, {
      closedDay: CLOSED_DAY,
    })
    expect(lines.find((l) => l.kind === 'diff_counterfactual')).toBeUndefined()
  })

  it('skips changes with no traceable cause-tag → remedy mapping', () => {
    const state = withCauses(baseState(), [
      {
        target: 'reputation:tasty',
        targetType: 'reputation',
        readable: 'Tasty fell.',
        amount: -3,
        direction: 'decrease',
        weight: 3,
        tags: ['reputation'],
      },
    ])
    const result = makeResult({
      significantChanges: [
        {
          path: 'reputation.tasty',
          before: 40,
          after: 35,
          delta: -5,
          readable: 'tasty -5',
          tags: ['reputation'],
        },
      ],
    })
    const lines = projectMissedOpportunities(result, state, {
      closedDay: CLOSED_DAY,
    })
    expect(lines.find((l) => l.kind === 'diff_counterfactual')).toBeUndefined()
  })
})

// ─── Dedup / cap / dismissal ─────────────────────────────────────────

describe('projectMissedOpportunities — dedup / cap / dismissal', () => {
  it('collapses pressure-remedy and diff-counterfactual lines pointing at the same (action, target)', () => {
    let state = withPressureSnapshot(baseState(), 'food_safety', {
      value: 55,
      delta: 10,
      severity: 70,
      relatedLocations: [{ kind: 'area', id: 'kitchen' }],
    })
    state = withCauses(state, [
      {
        target: 'area:kitchen',
        targetType: 'area',
        sourceType: 'service',
        readable: 'Kitchen got dirtier during service.',
        amount: -8,
        direction: 'decrease',
        weight: 8,
        tags: ['cleanliness'],
      },
    ])
    const result = makeResult({
      significantChanges: [
        {
          path: 'areas.kitchen.cleanliness',
          before: 60,
          after: 50,
          delta: -10,
          readable: 'cleanliness fell',
          tags: ['area', 'kitchen'],
        },
      ],
    })
    const lines = projectMissedOpportunities(result, state, {
      closedDay: CLOSED_DAY,
    })
    const cleanKitchen = lines.filter(
      (l) => l.actionId === 'clean_area' && l.targetRef?.id === 'kitchen',
    )
    expect(cleanKitchen).toHaveLength(1)
  })

  it('caps output at the requested number (default 3)', () => {
    let state = baseState()
    state = withPressureSnapshot(state, 'food_safety', {
      value: 60,
      delta: 10,
      severity: 70,
    })
    state = withPressureSnapshot(state, 'staff_burnout', {
      value: 60,
      delta: 10,
      severity: 70,
    })
    state = withPressureSnapshot(state, 'maintenance', {
      value: 60,
      delta: 10,
      severity: 70,
    })
    state = withPressureSnapshot(state, 'pests', {
      value: 60,
      delta: 10,
      severity: 70,
    })
    state = withPressureSnapshot(state, 'stock_shortage', {
      value: 60,
      delta: 10,
      severity: 70,
    })
    const result = makeResult()
    const lines = projectMissedOpportunities(result, state, {
      closedDay: CLOSED_DAY,
    })
    expect(lines.length).toBeLessThanOrEqual(3)
  })

  it('honours an explicit cap option', () => {
    let state = baseState()
    state = withPressureSnapshot(state, 'food_safety', {
      value: 60,
      delta: 10,
      severity: 70,
    })
    state = withPressureSnapshot(state, 'staff_burnout', {
      value: 60,
      delta: 10,
      severity: 70,
    })
    const result = makeResult()
    const lines = projectMissedOpportunities(result, state, {
      closedDay: CLOSED_DAY,
      cap: 1,
    })
    expect(lines.length).toBe(1)
  })

  it('filters out dismissed ids', () => {
    const state = withPressureSnapshot(baseState(), 'food_safety', {
      value: 55,
      delta: 10,
      severity: 70,
      relatedLocations: [{ kind: 'area', id: 'kitchen' }],
    })
    const result = makeResult()
    const undismissed = projectMissedOpportunities(result, state, {
      closedDay: CLOSED_DAY,
    })
    expect(undismissed.length).toBeGreaterThan(0)
    const idToDismiss = undismissed[0]!.id
    const dismissed = projectMissedOpportunities(result, state, {
      closedDay: CLOSED_DAY,
      dismissedIds: new Set([idToDismiss]),
    })
    expect(dismissed.find((l) => l.id === idToDismiss)).toBeUndefined()
  })

  it('produces deterministic ordering across repeated calls', () => {
    let state = baseState()
    state = withPressureSnapshot(state, 'food_safety', {
      value: 60,
      delta: 10,
      severity: 70,
    })
    state = withPressureSnapshot(state, 'maintenance', {
      value: 60,
      delta: 10,
      severity: 70,
    })
    const result = makeResult()
    const a = projectMissedOpportunities(result, state, {
      closedDay: CLOSED_DAY,
    })
    const b = projectMissedOpportunities(result, state, {
      closedDay: CLOSED_DAY,
    })
    expect(a.map((l) => l.id)).toEqual(b.map((l) => l.id))
  })
})

// ─── Word budgets & non-mutation ─────────────────────────────────────

describe('projectMissedOpportunities — word budgets', () => {
  it('every readable line is within budget', () => {
    let state = baseState()
    state = withPressureSnapshot(state, 'food_safety', {
      label: 'Food Safety with extra extra extra long words',
      value: 60,
      delta: 12,
      severity: 80,
      relatedLocations: [{ kind: 'area', id: 'main_room' }],
    })
    const result = makeResult()
    const lines = projectMissedOpportunities(result, state, {
      closedDay: CLOSED_DAY,
    })
    for (const line of lines) {
      expect(wordCount(line.readable)).toBeLessThanOrEqual(14)
      if (line.secondary) {
        expect(wordCount(line.secondary)).toBeLessThanOrEqual(10)
      }
    }
  })
})

describe('projectMissedOpportunities — non-mutation', () => {
  it('does not mutate the input state or result', () => {
    const state = withPressureSnapshot(baseState(), 'food_safety', {
      value: 55,
      delta: 10,
      severity: 70,
      relatedLocations: [{ kind: 'area', id: 'kitchen' }],
    })
    const result = makeResult()
    const stateBefore = JSON.stringify(state)
    const resultBefore = JSON.stringify(result)
    projectMissedOpportunities(result, state, { closedDay: CLOSED_DAY })
    expect(JSON.stringify(state)).toBe(stateBefore)
    expect(JSON.stringify(result)).toBe(resultBefore)
  })
})
