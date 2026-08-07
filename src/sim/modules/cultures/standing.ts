import type { SimContext } from '../../core/context'
import type { CultureWorldState, TavernState } from '../../state/TavernState'
import { clampPercent } from '../../state/normalize'
import { cultureRegistry } from '../../content/cultures/cultureRegistry'

import {
  MAX_ACCOMMODATION_HISTORY,
  MAX_CULTURE_EVIDENCE,
  MISUNDERSTANDING_LIFE_DAYS,
  WALKOUT_LIFE_DAYS,
  bumpCultureTotal,
  createInitialCultureTotals,
  emptyCultureStanding,
  evidenceWeightToday,
  getCultureModuleState,
  isNegativeEvidence,
  liveMisunderstandingFor,
  netCultureStanding,
  writeCultureSlice,
} from './cultureState'
import { scheduleWalkoutRisk } from './cultureEvents'
import type {
  CultureEvidenceEntry,
  CultureEvidenceKind,
  CultureMisunderstanding,
  CultureStanding,
} from './types'

// Expansion Phase 8 §8.2 — the four meters, the accommodation history, and
// the misunderstanding/reconciliation loop.
//
// §8.2 asks for comfort, familiarity, trust and (via the tension meter the
// pressure layer already reads) friction to be DYNAMIC. They were not: the
// three meters `CultureWorldState` carried were seeded at day zero from the
// registry and then never written by anything. A culture's numbers were its
// definition, permanently.
//
// They are now derived, every day, from the evidence the service pass
// records — and each moves on its own terms rather than all four tracking
// one hidden number:
//
//   familiarity  how much of this house they have actually experienced.
//                Only ever climbs, slowly, and only when they came in.
//   comfort      how tonight felt: seats, crowding, being served.
//   trust        whether they expect to be looked after next time. Slow to
//                earn, quick to lose — a taboo costs more trust than a good
//                night buys.
//   tension      the inverse pressure reading the culture layer already fed.
//
// The step caps matter for the same reason they did for factions: without
// them one bad night would swing a culture thirty points and the meters
// would be noise again.

const SOURCE = 'cultures.standing'

const MAX_METER_STEP = 3
const MAX_FAMILIARITY_STEP = 1

/** Evidence this bad opens a misunderstanding the house has to put right. */
const MISUNDERSTANDING_THRESHOLD = 12

/**
 * …and the culture has to be unhappy overall as well.
 *
 * One qualifying slight alone opened seven disputes on day zero, because
 * seven cultures had an unmarked observance on the opening day and each
 * counted on its own. A misunderstanding should mean a relationship has gone
 * wrong, not that one thing did — so it takes a bad night AND a ledger that
 * is already in the red.
 */
const MISUNDERSTANDING_NET_FLOOR = -15

/** Days an unanswered slight stands before the crowd starts talking about leaving. */
const WALKOUT_RISK_AFTER_DAYS = 6
/** …and how badly they have to think of the place for it to get that far. */
const WALKOUT_RISK_NET_FLOOR = -30

/** Kinds that can open a misunderstanding, and what would fix each. */
const REMEDIES: Partial<Record<CultureEvidenceKind, string>> = {
  taboo: 'serve them something they actually eat, or make amends directly',
  seating_friction: 'seat them apart, or make amends directly',
  observance_ignored: 'keep the next observance, or make amends directly',
  bad_seat: 'give them a room that suits them, or make amends directly',
}

export function cultureDefinition(id: string) {
  return cultureRegistry.get(id)
}

/**
 * Record something a culture experienced.
 *
 * Same-day, same-id evidence REINFORCES rather than duplicating, so a night
 * on which the kitchen sent out six plates of the wrong thing is one louder
 * grievance rather than six identical ones filling the whole memory.
 */
export function noteEvidence(
  ctx: SimContext,
  input: {
    cultureId: string
    id: string
    kind: CultureEvidenceKind
    weight: number
    readable: string
    subjectId?: string
    tags?: string[]
  },
): void {
  if (!ctx.state.world.cultures[input.cultureId]) return
  const today = ctx.state.calendar.totalDaysElapsed
  const weight = Math.max(1, Math.min(40, Math.round(input.weight)))

  writeCultureSlice(
    ctx,
    (current) => {
      const standing =
        current.standing[input.cultureId] ??
        emptyCultureStanding(input.cultureId, today)
      const evidence = [...standing.evidence]
      const sameIndex = evidence.findIndex(
        (entry) => entry.id === input.id && entry.onDay === today,
      )
      const entry: CultureEvidenceEntry = {
        id: input.id,
        cultureId: input.cultureId,
        onDay: today,
        kind: input.kind,
        weight:
          sameIndex >= 0
            ? Math.min(40, evidence[sameIndex]!.weight + Math.ceil(weight / 2))
            : weight,
        readable: input.readable,
        ...(input.subjectId !== undefined ? { subjectId: input.subjectId } : {}),
        tags: [...(input.tags ?? [])],
      }
      if (sameIndex >= 0) evidence.splice(sameIndex, 1)
      evidence.push(entry)

      // §5.11 — the faintest goes first, not the oldest: a grievance that
      // still stings outlives a pleasant night from last week.
      const trimmed =
        evidence.length <= MAX_CULTURE_EVIDENCE
          ? evidence
          : [...evidence]
              .sort(
                (a, b) =>
                  Math.abs(evidenceWeightToday(b, today)) -
                  Math.abs(evidenceWeightToday(a, today)),
              )
              .slice(0, MAX_CULTURE_EVIDENCE)
              .sort((a, b) => a.onDay - b.onDay)

      const next: CultureStanding = {
        ...standing,
        evidence: trimmed,
        net: 0,
        lastUpdatedOnDay: today,
      }
      next.net = netCultureStanding(next, today)

      // `evidenceToday` dedupes on the same key as the ledger. Without it
      // the day's list grew one entry per PARTY — 190-odd on a busy night —
      // which drowned the report and bloated the day diff, while saying
      // nothing the single reinforced entry does not already say.
      const todayList = current.evidenceToday.filter(
        (existing) =>
          !(existing.cultureId === input.cultureId && existing.id === input.id),
      )
      return {
        ...current,
        standing: { ...current.standing, [input.cultureId]: next },
        evidenceToday: [...todayList, entry],
      }
    },
    `evidence_${input.kind}`,
  )
}

/** Record that the house did — or failed to do — something for them. */
export function noteAccommodation(
  ctx: SimContext,
  input: {
    cultureId: string
    kind: string
    readable: string
    accommodated: boolean
  },
): void {
  const today = ctx.state.calendar.totalDaysElapsed
  writeCultureSlice(
    ctx,
    (current) => {
      const standing =
        current.standing[input.cultureId] ??
        emptyCultureStanding(input.cultureId, today)
      const accommodations = [
        ...standing.accommodations,
        {
          onDay: today,
          kind: input.kind,
          readable: input.readable,
          accommodated: input.accommodated,
        },
      ].slice(-MAX_ACCOMMODATION_HISTORY)
      return {
        ...current,
        standing: {
          ...current.standing,
          [input.cultureId]: { ...standing, accommodations },
        },
      }
    },
    'accommodation',
  )
}

/** How often the house has actually accommodated them, 0..1. */
export function accommodationRate(state: TavernState, cultureId: string): number {
  const standing = getCultureModuleState(state).standing[cultureId]
  if (!standing || standing.accommodations.length === 0) return 0.5
  const kept = standing.accommodations.filter((entry) => entry.accommodated).length
  return Math.round((kept / standing.accommodations.length) * 100) / 100
}

/** The strongest live grievance, for explaining a culture's mood. */
export function worstCultureEvidence(
  state: TavernState,
  cultureId: string,
): CultureEvidenceEntry | undefined {
  const today = state.calendar.totalDaysElapsed
  const standing = getCultureModuleState(state).standing[cultureId]
  if (!standing) return undefined
  return [...standing.evidence]
    .filter((entry) => isNegativeEvidence(entry.kind))
    .sort((a, b) => evidenceWeightToday(a, today) - evidenceWeightToday(b, today))[0]
}

// ---------------------------------------------------------------------------
// Misunderstanding and reconciliation
// ---------------------------------------------------------------------------

/**
 * Open a misunderstanding when a single slight was bad enough.
 *
 * Note what does NOT open one: a calendar tag being present. The old
 * `emitCulturalMisunderstandings` fired for every culture whose observance
 * was live, whether or not anything went wrong — so a misunderstanding was
 * a property of the date rather than of anybody's behaviour. Here it takes
 * a real slight, and it carries a named remedy so the player can find out
 * what would fix it.
 */
export function openMisunderstanding(
  ctx: SimContext,
  input: {
    cultureId: string
    cause: CultureEvidenceKind
    reason: string
    severity?: CultureMisunderstanding['severity']
    remedy?: string
  },
): CultureMisunderstanding | undefined {
  const culture = ctx.state.world.cultures[input.cultureId]
  if (!culture) return undefined
  if (liveMisunderstandingFor(ctx.state, input.cultureId)) return undefined
  const remedy = input.remedy ?? REMEDIES[input.cause]
  if (!remedy) return undefined
  const severity = input.severity ?? 'slight'

  const today = ctx.state.calendar.totalDaysElapsed
  const record: CultureMisunderstanding = {
    id: `misunderstanding_${input.cultureId}_${today}`,
    cultureId: input.cultureId,
    severity,
    openedOnDay: today,
    expiresOnDay:
      today + (severity === 'walkout' ? WALKOUT_LIFE_DAYS : MISUNDERSTANDING_LIFE_DAYS),
    reason: input.reason,
    remedy,
    cause: input.cause,
    status: 'live',
  }
  writeCultureSlice(
    ctx,
    (current) => ({
      ...current,
      misunderstandings: { ...current.misunderstandings, [record.id]: record },
    }),
    'misunderstanding_opened',
  )
  bumpCultureTotal(ctx, 'misunderstandingsOpened')

  // The memory the cultural-tension calculator already reads. It keeps its
  // id and tags; what changed is that something has to have happened.
  ctx.addMemory({
    id: 'cultural_misunderstanding_recently',
    source: SOURCE,
    actors: [{ kind: 'culture', id: culture.id }],
    tags: ['cultural_misunderstanding', 'culture', culture.id],
    metadata: { cultureId: culture.id, cause: input.cause },
  })
  return record
}

/** Close a live misunderstanding. `reconciled` when the house put it right. */
export function closeMisunderstanding(
  ctx: SimContext,
  id: string,
  status: 'reconciled' | 'faded',
): void {
  const today = ctx.state.calendar.totalDaysElapsed
  writeCultureSlice(
    ctx,
    (current) => {
      const record = current.misunderstandings[id]
      if (!record || record.status !== 'live') return current
      return {
        ...current,
        misunderstandings: {
          ...current.misunderstandings,
          [id]: { ...record, status, closedOnDay: today },
        },
      }
    },
    `misunderstanding_${status}`,
  )
  bumpCultureTotal(
    ctx,
    status === 'reconciled' ? 'misunderstandingsReconciled' : 'misunderstandingsFaded',
  )
}

/**
 * Open misunderstandings from today's worst slights, and expire stale ones.
 *
 * A culture that is served the same taboo three nights running does not
 * accumulate three misunderstandings — one at a time, each with a remedy,
 * so there is always exactly one thing to put right.
 */
export function reviewMisunderstandings(ctx: SimContext): void {
  const today = ctx.state.calendar.totalDaysElapsed
  const slice = getCultureModuleState(ctx.state)

  for (const record of Object.values(slice.misunderstandings)) {
    if (record.status !== 'live') continue
    if (today <= record.expiresOnDay) continue
    closeMisunderstanding(ctx, record.id, 'faded')
  }

  for (const cultureId of Object.keys(ctx.state.world.cultures).sort()) {
    const standing = getCultureModuleState(ctx.state).standing[cultureId]
    if (!standing) continue

    // A slight that has stood unanswered long enough becomes a walkout
    // RISK — announced on the calendar with a warning window, so the
    // player has a turn to answer it before the crowd actually goes. The
    // event re-reads live state when it fires, so amends in the meantime
    // are what stops it.
    const live = liveMisunderstandingFor(ctx.state, cultureId)
    if (live) {
      if (
        live.severity === 'slight' &&
        today - live.openedOnDay >= WALKOUT_RISK_AFTER_DAYS &&
        standing.net <= WALKOUT_RISK_NET_FLOOR
      ) {
        const culture = ctx.state.world.cultures[cultureId]!
        scheduleWalkoutRisk(ctx, cultureId, {
          source: 'cultures.review',
          readable: `${culture.label} have had no answer about ${live.reason}`,
        })
      }
      continue
    }
    const todaysWorst = standing.evidence
      .filter((entry) => entry.onDay === today && isNegativeEvidence(entry.kind))
      .sort((a, b) => b.weight - a.weight)[0]
    if (!todaysWorst || todaysWorst.weight < MISUNDERSTANDING_THRESHOLD) continue
    if (standing.net > MISUNDERSTANDING_NET_FLOOR) continue
    openMisunderstanding(ctx, {
      cultureId,
      cause: todaysWorst.kind,
      reason: todaysWorst.readable,
    })
  }
}

// ---------------------------------------------------------------------------
// The daily summary
// ---------------------------------------------------------------------------

/**
 * Re-derive the four meters from the evidence, and drop what has faded.
 *
 * Every meter moves at most a few points a day and every point of it is
 * attributable to a named entry — which is what makes `make_amends_to_culture`
 * something a player can reason about rather than a lever they pull blind.
 */
export function summariseCultures(ctx: SimContext): void {
  const today = ctx.state.calendar.totalDaysElapsed
  const slice = getCultureModuleState(ctx.state)
  const nextStanding: Record<string, CultureStanding> = {}

  const cultureIds = Object.keys(ctx.state.world.cultures).sort()
  for (const cultureId of cultureIds) {
    const existing = slice.standing[cultureId]
    if (!existing) continue
    const evidence = existing.evidence.filter(
      (entry) => evidenceWeightToday(entry, today) !== 0,
    )
    const summarised: CultureStanding = {
      ...existing,
      evidence,
      net: 0,
      lastUpdatedOnDay: today,
    }
    summarised.net = netCultureStanding(summarised, today)
    nextStanding[cultureId] = summarised
  }

  writeCultureSlice(
    ctx,
    (current) => ({
      ...current,
      standing: { ...current.standing, ...nextStanding },
      totals: { ...createInitialCultureTotals(), ...current.totals },
    }),
    'summary',
  )

  for (const cultureId of cultureIds) {
    const culture = ctx.state.world.cultures[cultureId]
    if (!culture) continue
    applyMeterSummary(ctx, culture, nextStanding[cultureId])
  }
}

function applyMeterSummary(
  ctx: SimContext,
  culture: CultureWorldState,
  standing: CultureStanding | undefined,
): void {
  const def = cultureDefinition(culture.id)
  const today = ctx.state.calendar.totalDaysElapsed
  const net = standing?.net ?? 0
  const cameInToday = (standing?.evidence ?? []).some(
    (entry) => entry.onDay === today,
  )

  // Familiarity only moves when they were actually here, and only upward:
  // you cannot become less familiar with a place, only less fond of it.
  const familiarityTarget = cameInToday
    ? clampPercent(culture.familiarity + MAX_FAMILIARITY_STEP)
    : culture.familiarity

  // A quarter rather than a half: a fully positive ledger is worth 25 points
  // of comfort, not 50. At a half, an ordinary well-run fortnight pinned
  // every culture at 100 and the meter stopped carrying information — which
  // is the §1.5 failure the arc already fixed once for pressures.
  const comfortAnchor = def?.defaultComfort ?? 50
  const comfortTarget = clampPercent(Math.round(comfortAnchor + net / 4))

  // Trust is slow to earn and quick to lose: the step up is one, the step
  // down is the full three. That asymmetry is what makes a taboo expensive.
  const trustAnchor = def?.defaultTrust ?? 50
  const currentTrust = culture.trust ?? trustAnchor
  const trustTarget = clampPercent(
    Math.round(trustAnchor + net / 4 + (accommodationRate(ctx.state, culture.id) - 0.5) * 20),
  )

  const tensionAnchor = def?.defaultTension ?? 50
  const tensionTarget = clampPercent(Math.round(tensionAnchor - net / 4))

  const nextComfort = step(culture.comfort, comfortTarget, MAX_METER_STEP)
  const nextTension = step(culture.tension, tensionTarget, MAX_METER_STEP)
  const nextTrust = step(
    currentTrust,
    trustTarget,
    trustTarget < currentTrust ? MAX_METER_STEP : 1,
  )

  if (
    nextComfort === culture.comfort &&
    nextTension === culture.tension &&
    nextTrust === currentTrust &&
    familiarityTarget === culture.familiarity
  ) {
    return
  }

  const driver = dominantEvidence(ctx.state, culture.id)
  ctx.modifyCulture(
    culture.id,
    {
      comfort: nextComfort,
      tension: nextTension,
      trust: nextTrust,
      familiarity: familiarityTarget,
    },
    {
      source: `${SOURCE}.summary`,
      sourceType: 'culture',
      target: culture.id,
      targetType: 'culture',
      amount: nextComfort - culture.comfort,
      readable: driver
        ? `${culture.label}: comfort ${culture.comfort} → ${nextComfort}, trust ${currentTrust} → ${nextTrust} (${driver.readable})`
        : `${culture.label}: comfort ${culture.comfort} → ${nextComfort}, trust ${currentTrust} → ${nextTrust} (settling back toward normal).`,
      tags: ['culture', 'standing', culture.id],
      relatedActors: [{ kind: 'culture', id: culture.id }],
      relatedSystems: ['cultures'],
    },
  )
}

function step(current: number, target: number, cap: number): number {
  if (target === current) return current
  const delta = Math.max(-cap, Math.min(cap, target - current))
  return clampPercent(Math.round(current + delta))
}

function dominantEvidence(
  state: TavernState,
  cultureId: string,
): CultureEvidenceEntry | undefined {
  const today = state.calendar.totalDaysElapsed
  const standing = getCultureModuleState(state).standing[cultureId]
  if (!standing || standing.evidence.length === 0) return undefined
  return [...standing.evidence].sort(
    (a, b) =>
      Math.abs(evidenceWeightToday(b, today)) -
      Math.abs(evidenceWeightToday(a, today)),
  )[0]
}
