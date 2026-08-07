import { z } from 'zod'

import type { SimContext } from '../../core/context'
import type { TavernState } from '../../state/TavernState'

import type {
  CultureEvidenceEntry,
  CultureFrictionState,
  CultureMisunderstanding,
  CultureModuleState,
  CultureStanding,
  CultureTotals,
} from './types'

// Expansion Phase 8 §8.2 — reading and writing the cultures slice.
//
// Every accessor normalises, for the same reason the factions slice does: a
// save written before this phase has `modules.cultures = {}` — PRESENT and
// empty, because the module's schema was an empty passthrough object — so
// the generic `ensureModuleSlices` sweep, which only fills slices that are
// missing entirely, walks straight past it. `ensureCultureAgencyFields` in
// `state/migrations.ts` is the named §5.7 migration; this is the
// belt-and-braces under it.

export const CULTURES_MODULE_ID = 'cultures'

// -- §5.11 bounded growth ---------------------------------------------------

/** How many things a culture holds in mind at once. */
export const MAX_CULTURE_EVIDENCE = 16
/** Days before a piece of evidence has faded to nothing. */
export const CULTURE_MEMORY_DAYS = 24
/** How much of the accommodation history is kept. */
export const MAX_ACCOMMODATION_HISTORY = 12
/** Dishes and areas tracked per culture, most-experienced first. */
export const MAX_TRACKED_SUBJECTS = 12
/** Closed misunderstandings are pruned this many days after they close. */
export const MISUNDERSTANDING_RETENTION_DAYS = 14
/** Days a misunderstanding stays live before it fades of its own accord. */
export const MISUNDERSTANDING_LIFE_DAYS = 12

/** A culture that has walked out stays away longer than one merely slighted. */
export const WALKOUT_LIFE_DAYS = 20
/** Learned preferences and dislikes per culture. */
export const MAX_LEARNED_TAGS = 6

export function createInitialCultureTotals(): CultureTotals {
  return {
    dishesServed: 0,
    taboosServed: 0,
    delightsServed: 0,
    seatingFrictionDays: 0,
    observancesHonoured: 0,
    observancesIgnored: 0,
    misunderstandingsOpened: 0,
    misunderstandingsReconciled: 0,
    misunderstandingsFaded: 0,
    amendsMade: 0,
    preferenceShifts: 0,
    recommendationsMade: 0,
    walkouts: 0,
    seatingBacklashes: 0,
  }
}

export function createInitialCultureModuleState(): CultureModuleState {
  return {
    standing: {},
    misunderstandings: {},
    friction: {},
    observances: [],
    evidenceToday: [],
    totals: createInitialCultureTotals(),
  }
}

export function emptyCultureStanding(
  cultureId: string,
  today: number,
): CultureStanding {
  return {
    cultureId,
    evidence: [],
    net: 0,
    accommodations: [],
    dishExperience: {},
    areaExperience: {},
    learnedPreferences: [],
    learnedDislikes: [],
    lastUpdatedOnDay: today,
  }
}

export function normalizeCultureSlice(
  slice: Partial<CultureModuleState> | undefined,
): CultureModuleState {
  const base = createInitialCultureModuleState()
  if (!slice) return base
  return {
    standing: slice.standing ?? base.standing,
    misunderstandings: slice.misunderstandings ?? base.misunderstandings,
    friction: slice.friction ?? base.friction,
    observances: slice.observances ?? base.observances,
    evidenceToday: slice.evidenceToday ?? base.evidenceToday,
    totals: { ...base.totals, ...(slice.totals ?? {}) },
  }
}

export function getCultureModuleState(state: {
  modules: Record<string, unknown>
}): CultureModuleState {
  return normalizeCultureSlice(
    state.modules[CULTURES_MODULE_ID] as Partial<CultureModuleState> | undefined,
  )
}

export function writeCultureSlice(
  ctx: SimContext,
  updater: (current: CultureModuleState) => CultureModuleState,
  reason: string,
): void {
  ctx.modifyModuleState<CultureModuleState>(
    CULTURES_MODULE_ID,
    (current) => updater(normalizeCultureSlice(current)),
    { source: `${CULTURES_MODULE_ID}.${reason}`, reason },
  )
}

export function bumpCultureTotal(
  ctx: SimContext,
  key: keyof CultureTotals,
  by = 1,
): void {
  if (by === 0) return
  writeCultureSlice(
    ctx,
    (current) => ({
      ...current,
      totals: {
        ...createInitialCultureTotals(),
        ...current.totals,
        [key]: (current.totals[key] ?? 0) + by,
      },
    }),
    'totals',
  )
}

// -- evidence ---------------------------------------------------------------

/** Kinds that count AGAINST the house. Everything else counts for it. */
const NEGATIVE_KINDS = new Set<CultureEvidenceEntry['kind']>([
  'taboo',
  'bad_seat',
  'seating_friction',
  'turned_away',
  'observance_ignored',
])

export function isNegativeEvidence(kind: CultureEvidenceEntry['kind']): boolean {
  return NEGATIVE_KINDS.has(kind)
}

/** An entry's remaining force today. Linear decay to nothing at 24 days. */
export function evidenceWeightToday(
  entry: CultureEvidenceEntry,
  today: number,
): number {
  const age = Math.max(0, today - entry.onDay)
  if (age >= CULTURE_MEMORY_DAYS) return 0
  const fade = 1 - age / CULTURE_MEMORY_DAYS
  const signed = isNegativeEvidence(entry.kind) ? -entry.weight : entry.weight
  return Math.round(signed * fade * 100) / 100
}

/** -100..100, derived. */
export function netCultureStanding(
  standing: CultureStanding,
  today: number,
): number {
  const total = standing.evidence.reduce(
    (sum, entry) => sum + evidenceWeightToday(entry, today),
    0,
  )
  return Math.max(-100, Math.min(100, Math.round(total)))
}

export function getCultureStanding(
  state: TavernState,
  cultureId: string,
): CultureStanding | undefined {
  return getCultureModuleState(state).standing[cultureId]
}

export function cultureNet(state: TavernState, cultureId: string): number {
  const standing = getCultureModuleState(state).standing[cultureId]
  if (!standing) return 0
  return netCultureStanding(standing, state.calendar.totalDaysElapsed)
}

/** The pair key for two cultures, order-independent. */
export function frictionKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

export function liveMisunderstandings(state: TavernState): CultureMisunderstanding[] {
  return Object.values(getCultureModuleState(state).misunderstandings)
    .filter((entry) => entry.status === 'live')
    .sort((a, b) => a.expiresOnDay - b.expiresOnDay || a.id.localeCompare(b.id))
}

export function liveMisunderstandingFor(
  state: TavernState,
  cultureId: string,
): CultureMisunderstanding | undefined {
  return liveMisunderstandings(state).find((entry) => entry.cultureId === cultureId)
}

export function activeFriction(state: TavernState): CultureFrictionState[] {
  return Object.values(getCultureModuleState(state).friction)
    .filter((entry) => entry.level > 0)
    .sort((a, b) => b.level - a.level || a.id.localeCompare(b.id))
}

// -- pruning ----------------------------------------------------------------

/** Keep the busiest subjects, so a long game does not grow a record per dish forever. */
function capSubjects<T extends Record<string, { served?: number; seated?: number }>>(
  subjects: T,
  score: (value: T[keyof T]) => number,
): T {
  const entries = Object.entries(subjects)
  if (entries.length <= MAX_TRACKED_SUBJECTS) return subjects
  const kept = entries
    .sort((a, b) => score(b[1] as T[keyof T]) - score(a[1] as T[keyof T]) || a[0].localeCompare(b[0]))
    .slice(0, MAX_TRACKED_SUBJECTS)
  return Object.fromEntries(kept) as T
}

/**
 * Drop what nobody needs any more.
 *
 * Friction that has decayed to nothing goes entirely rather than sitting at
 * zero forever, and a closed misunderstanding lingers a fortnight so "you
 * put that right last week" is still answerable before it goes.
 */
export function pruneCultureRecords(
  slice: CultureModuleState,
  today: number,
): CultureModuleState {
  const standing: Record<string, CultureStanding> = {}
  for (const [cultureId, entry] of Object.entries(slice.standing)) {
    standing[cultureId] = {
      ...entry,
      evidence: entry.evidence
        .filter((e) => today - e.onDay < CULTURE_MEMORY_DAYS)
        .slice(-MAX_CULTURE_EVIDENCE),
      accommodations: entry.accommodations.slice(-MAX_ACCOMMODATION_HISTORY),
      dishExperience: capSubjects(entry.dishExperience, (v) => v.served ?? 0),
      areaExperience: capSubjects(entry.areaExperience, (v) => v.seated ?? 0),
      learnedPreferences: entry.learnedPreferences.slice(-MAX_LEARNED_TAGS),
      learnedDislikes: entry.learnedDislikes.slice(-MAX_LEARNED_TAGS),
    }
  }

  const misunderstandings = Object.fromEntries(
    Object.entries(slice.misunderstandings).filter(([, entry]) => {
      if (entry.status === 'live') return true
      const closed = entry.closedOnDay
      if (closed === undefined) return true
      return today - closed <= MISUNDERSTANDING_RETENTION_DAYS
    }),
  )

  const friction = Object.fromEntries(
    Object.entries(slice.friction).filter(([, entry]) => entry.level > 0),
  )

  return { ...slice, standing, misunderstandings, friction }
}

// -- schema -----------------------------------------------------------------

const EvidenceSchema = z.object({
  id: z.string(),
  cultureId: z.string(),
  onDay: z.number().int(),
  kind: z.enum([
    'delight',
    'taboo',
    'good_seat',
    'bad_seat',
    'seating_friction',
    'well_served',
    'turned_away',
    'observance_honoured',
    'observance_ignored',
    'amends',
  ]),
  weight: z.number(),
  readable: z.string(),
  subjectId: z.string().optional(),
  tags: z.array(z.string()),
})

const StandingSchema = z.object({
  cultureId: z.string(),
  evidence: z.array(EvidenceSchema),
  net: z.number(),
  accommodations: z.array(
    z.object({
      onDay: z.number().int(),
      kind: z.string(),
      readable: z.string(),
      accommodated: z.boolean(),
    }),
  ),
  dishExperience: z.record(
    z.string(),
    z.object({ served: z.number(), delight: z.number(), taboo: z.number() }),
  ),
  areaExperience: z.record(
    z.string(),
    z.object({ seated: z.number(), good: z.number(), bad: z.number() }),
  ),
  learnedPreferences: z.array(z.string()),
  learnedDislikes: z.array(z.string()),
  lastUpdatedOnDay: z.number().int(),
})

const MisunderstandingSchema = z.object({
  id: z.string(),
  cultureId: z.string(),
  severity: z.enum(['slight', 'walkout']).default('slight'),
  openedOnDay: z.number().int(),
  expiresOnDay: z.number().int(),
  reason: z.string(),
  remedy: z.string(),
  cause: z.string(),
  status: z.enum(['live', 'reconciled', 'faded']),
  closedOnDay: z.number().int().optional(),
})

const FrictionSchema = z.object({
  id: z.string(),
  cultureA: z.string(),
  cultureB: z.string(),
  level: z.number(),
  sharedDays: z.number().int(),
  lastSharedOnDay: z.number().int(),
  areaId: z.string().optional(),
})

export const CultureModuleStateSchema = z
  .object({
    standing: z.record(z.string(), StandingSchema).default({}),
    misunderstandings: z.record(z.string(), MisunderstandingSchema).default({}),
    friction: z.record(z.string(), FrictionSchema).default({}),
    observances: z
      .array(
        z.object({
          cultureId: z.string(),
          tag: z.string(),
          startedOnDay: z.number().int(),
          honoured: z.boolean().optional(),
        }),
      )
      .default([]),
    evidenceToday: z.array(EvidenceSchema).default([]),
    totals: z.record(z.string(), z.number()).default({}),
  })
  .partial()
  .passthrough()
  .optional()
