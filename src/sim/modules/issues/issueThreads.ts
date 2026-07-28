import { profileUtility } from './impactScoring'
import {
  ANSWERED_FAMILY_STREAK_LIMIT,
  CONTINUATION_CHOICE_CAP,
  FAMILY_STREAK_LIMIT,
  isTeleologyFamily,
  isUrgentSeed,
} from './handBudget'
import {
  createInitialAttentionState,
  type AttentionState,
  type ConsequenceProfile,
  type FamilyStreakState,
  type IssueSeed,
  type IssueThreadState,
  type ResponseSlot,
  type SeedContinuity,
} from './issueSeedTypes'
import type { ResolvedIntentRecord } from '../responses/types'

// Phase 205 / audit Wave 6 (`P7-EXP-005`) — issue threads: family
// cooldown and recurring-issue continuity.
//
// The audit found `area_atmosphere`, `customer_complaint`,
// `staff_identity` and `stock_shortage` surfacing for 25–27 CONSECUTIVE
// days, each time as a fresh full choice set. Two distinct defects live
// in that one observation:
//
//   · nothing cooled a FAMILY down. `seedRotation.ts` rotates the entity
//     inside a family, which is precisely why the streaks were invisible:
//     a different room every day still means "the rooms" every day. The
//     cooldown here is therefore keyed on family, not family+entity.
//   · a recurrence carried no memory of itself. The same problem returned
//     with no statement that it was the same problem, no age, and no
//     acknowledgement of what the player had already tried — so
//     persistence read as repetition rather than consequence.
//
// The two ledgers answer those separately:
//
//   `attention.families[family]` → the streak, which gates generation.
//   `attention.threads[family:entity]` → the thread, which decorates and
//   trims the seed that does surface.
//
// All pure functions over plain JSON state; the module owns the writes.

/** A thread that has not surfaced for longer than this is a fresh
 *  incident again, not a continuation — long enough to survive a rest day
 *  plus a quiet day, short enough that a problem which genuinely went
 *  away and came back does not claim false history. */
export const CONTINUITY_MEMORY_DAYS = 4

/** Threads older than this are dropped from state. The ledger is small,
 *  but `TavernState` growth is a standing constraint on run length
 *  (Wave 0's observation), so nothing here is allowed to accumulate. */
export const THREAD_PRUNE_AFTER_DAYS = 28

/** Severity rise that counts as material on its own. */
export const MATERIAL_SEVERITY_RISE = 8

/** Quarter bands. Crossing one is material regardless of the rise. */
const SEVERITY_BANDS = [25, 50, 75] as const

function severityBand(value: number): number {
  let band = 0
  for (const edge of SEVERITY_BANDS) {
    if (value >= edge) band += 1
  }
  return band
}

/** Has the issue got materially worse since it last surfaced? Either it
 *  climbed a quarter band or it rose by at least `MATERIAL_SEVERITY_RISE`.
 *  A one- or two-point drift is not news and must not buy a card slot. */
export function materiallyWorsened(before: number, now: number): boolean {
  if (severityBand(now) > severityBand(before)) return true
  return now - before >= MATERIAL_SEVERITY_RISE
}

/** The entity a seed is about, for thread identity. Location first (a
 *  room's problem is the room's), then the primary actor, then the first
 *  affected actor, then the family alone for tavern-wide issues. */
export function threadEntityKey(seed: IssueSeed): string {
  const ref =
    seed.location ?? seed.primaryActor ?? seed.affectedActors[0] ?? undefined
  return ref ? `${ref.kind}:${ref.id}` : 'global'
}

export function threadKeyForSeed(seed: IssueSeed): string {
  return `${seed.family}:${threadEntityKey(seed)}`
}

export function getAttentionState(
  slice: { attention?: AttentionState } | undefined,
): AttentionState {
  return slice?.attention ?? createInitialAttentionState()
}

/**
 * Should this family rest today? True when it surfaced yesterday, has
 * already run `FAMILY_STREAK_LIMIT` consecutive days, and has not
 * materially worsened.
 *
 * Note what is deliberately NOT a reason to rest: a long non-consecutive
 * history. A problem that surfaces every other day is exactly the rhythm
 * the cooldown is trying to produce.
 *
 * And note what is deliberately NOT an exemption: urgency. This looked
 * wrong at first — surely a live incident should always come through? —
 * but `customer_complaint` is a `during_service` family that sat at
 * urgency 80 for nineteen consecutive days on the measured route while
 * rotating its customer group (ogres, merchants, local goblins, miners,
 * adventurers…). Exempting urgency, or exempting a "new" thread, hands
 * the streak straight back: rotating the entity inside a family is the
 * mechanism the audit identified, so any per-entity escape reopens it.
 *
 * Reachability for urgent incidents is honoured where starvation actually
 * happens — at the ceiling, where `selectVisibleHand` lets an urgent seed
 * displace a non-urgent card rather than wait. And escalation is still an
 * exemption here: a family whose severity climbs a band or rises by
 * `MATERIAL_SEVERITY_RISE` returns immediately, so a genuinely worsening
 * crisis is never held back by pacing.
 */
export function shouldRestFamily(
  streak: FamilyStreakState | undefined,
  seed: Pick<IssueSeed, 'family' | 'severity' | 'urgency'>,
  today: number,
  thread?: IssueThreadState,
): boolean {
  if (!streak) return false
  if (streak.lastSurfacedDay !== today - 1) return false
  if (streak.consecutiveDays < FAMILY_STREAK_LIMIT) return false
  if (materiallyWorsened(streak.lastSeverity, seed.severity)) return false
  // A thread the player ANSWERED last time it appeared is engagement, not
  // noise: they committed to something and are owed the outcome. A venture
  // being invested in on consecutive days is the clearest case — resting
  // it strands the loop the player is deliberately running.
  //
  // Phase 206 / audit Wave 7 (`DC-06` re-opened) — the exemption is now
  // CAPPED for ordinary families. Wave 6's uncapped version reasoned it
  // could not reopen the audit's streaks because those were measured on a
  // route that answered nothing — which was exactly the gap: the exemption
  // is only reachable by answering, so the Wave 7 balance sweep (the first
  // instrument to answer cards) measured `staff_identity` at 17–26
  // consecutive days on every answering route. The recorded decision:
  // engagement buys a longer run (`ANSWERED_FAMILY_STREAK_LIMIT` days),
  // not an unbounded one. Teleology families stay uncapped — a venture
  // answered daily IS the loop the reserve exists for — and material
  // worsening already returned `false` above, so a genuine crisis is
  // never held back.
  if (
    thread &&
    thread.lastAnsweredDay !== undefined &&
    thread.lastAnsweredDay >= thread.lastSurfacedDay &&
    (isTeleologyFamily(seed.family as string) ||
      streak.consecutiveDays < ANSWERED_FAMILY_STREAK_LIMIT)
  ) {
    return false
  }
  return true
}

/** Is this seed a continuation of a thread the player has already seen? */
export function continuesThread(
  thread: IssueThreadState | undefined,
  today: number,
): boolean {
  if (!thread) return false
  if (thread.lastSurfacedDay >= today) return true
  return today - thread.lastSurfacedDay <= CONTINUITY_MEMORY_DAYS
}

/**
 * Attach continuity to a recurring seed and, when it has not escalated,
 * narrow the offered set.
 *
 * Trimming edits `responseSlots` rather than annotating them: the offer
 * set is simulation truth (an option that is not on the table must not be
 * applicable, and `selectConsequence` matches against these slots), while
 * every `consequenceProfile` stays on the seed so the model is intact and
 * the report can still explain what any option would have done.
 *
 * What survives a trim, in order: the inaction slot (always — the player
 * must be able to let a standing problem stand), then the best-utility
 * slots not already tried on this thread. An option the player already
 * committed to, on a problem that is still here, has demonstrably not
 * settled it; re-offering it as if nothing happened is the "fresh
 * incident" the finding is about.
 */
export function applyContinuity(
  seed: IssueSeed,
  thread: IssueThreadState,
  today: number,
): IssueSeed {
  const escalated = materiallyWorsened(thread.lastSeverity, seed.severity)
  const timesSurfaced =
    thread.lastSurfacedDay >= today
      ? thread.timesSurfaced
      : thread.timesSurfaced + 1
  const shouldTrim =
    !escalated &&
    !isUrgentSeed(seed) &&
    timesSurfaced >= 2 &&
    seed.responseSlots.length > CONTINUATION_CHOICE_CAP
  const slots = shouldTrim
    ? trimSlots(seed, thread.triedSlotIds)
    : seed.responseSlots

  const continuity: SeedContinuity = {
    threadKey: thread.key,
    daysStanding: Math.max(0, today - thread.firstSurfacedDay),
    timesSurfaced,
    lastSurfacedDay: thread.lastSurfacedDay,
    unanswered: thread.lastAnsweredDay === undefined,
    escalated,
    triedSlotIds: [...thread.triedSlotIds],
    trimmed: slots.length < seed.responseSlots.length,
    ...(thread.lastSelectionLabel !== undefined
      ? { lastSelectionLabel: thread.lastSelectionLabel }
      : {}),
    ...(thread.lastSelectionDay !== undefined
      ? { lastSelectionDay: thread.lastSelectionDay }
      : {}),
  }

  seed.responseSlots = slots
  seed.continuity = continuity
  return seed
}

function isInaction(
  slot: ResponseSlot,
  profile: ConsequenceProfile | undefined,
): boolean {
  if (slot.allowedVerbs[0] === 'ignore') return true
  if (slot.shape === 'ignore') return true
  return (
    (profile?.immediateEffects.length ?? 0) === 0 &&
    (profile?.delayedEffects.length ?? 0) > 0
  )
}

function trimSlots(
  seed: IssueSeed,
  triedSlotIds: readonly string[],
): ResponseSlot[] {
  const profileFor = (slotId: string): ConsequenceProfile | undefined =>
    seed.consequenceProfiles.find((p) => p.responseSlotId === slotId)

  const inaction = seed.responseSlots.filter((slot) =>
    isInaction(slot, profileFor(slot.id)),
  )
  const actions = seed.responseSlots.filter(
    (slot) => !isInaction(slot, profileFor(slot.id)),
  )
  const untried = actions.filter((slot) => !triedSlotIds.includes(slot.id))
  const tried = actions.filter((slot) => triedSlotIds.includes(slot.id))

  const byUtility = (a: ResponseSlot, b: ResponseSlot): number => {
    const ua = profileFor(a.id)
    const ub = profileFor(b.id)
    return (
      (ub ? profileUtility(ub) : 0) - (ua ? profileUtility(ua) : 0)
    )
  }

  const keptInaction = inaction.slice(0, 1)
  const actionBudget = Math.max(1, CONTINUATION_CHOICE_CAP - keptInaction.length)
  // Untried options first, best-utility within each group. Tried options
  // backfill only when there are not enough untried ones to reach a
  // playable set — never dropping the player below two choices.
  const chosenActions = [
    ...untried.slice().sort(byUtility),
    ...tried.slice().sort(byUtility),
  ].slice(0, actionBudget)

  const keptIds = new Set(
    [...keptInaction, ...chosenActions].map((slot) => slot.id),
  )
  // Emit in the seed's own authored order so the card's choice order is
  // stable across a thread's appearances.
  const kept = seed.responseSlots.filter((slot) => keptIds.has(slot.id))
  return kept.length >= 2 ? kept : seed.responseSlots
}

/**
 * Fold today's visible hand into the family and thread ledgers. Called at
 * the end of every generation pass; idempotent per day, so the later
 * passes of a day do not re-count a family's streak or a thread's age.
 */
export function recordSurfaced(
  attention: AttentionState,
  exposed: readonly IssueSeed[],
  today: number,
): AttentionState {
  const families = { ...attention.families }
  const threads = { ...attention.threads }

  for (const seed of exposed) {
    const family = seed.family as string
    const streak = families[family]
    if (!streak || streak.lastSurfacedDay !== today) {
      const consecutive =
        streak && streak.lastSurfacedDay === today - 1
          ? streak.consecutiveDays + 1
          : 1
      families[family] = {
        family,
        lastSurfacedDay: today,
        consecutiveDays: consecutive,
        lastSeverity: seed.severity,
      }
    }

    const key = threadKeyForSeed(seed)
    const thread = threads[key]
    if (!thread) {
      threads[key] = {
        key,
        family,
        firstSurfacedDay: today,
        lastSurfacedDay: today,
        timesSurfaced: 1,
        lastSeverity: seed.severity,
        peakSeverity: seed.severity,
        triedSlotIds: [],
      }
      continue
    }
    if (thread.lastSurfacedDay === today) continue
    const stale = today - thread.lastSurfacedDay > CONTINUITY_MEMORY_DAYS
    threads[key] = stale
      ? {
          // The problem went away and came back: a new thread under the
          // same key, so it cannot claim an age it does not have.
          key,
          family,
          firstSurfacedDay: today,
          lastSurfacedDay: today,
          timesSurfaced: 1,
          lastSeverity: seed.severity,
          peakSeverity: seed.severity,
          triedSlotIds: [],
        }
      : {
          ...thread,
          lastSurfacedDay: today,
          timesSurfaced: thread.timesSurfaced + 1,
          lastSeverity: seed.severity,
          peakSeverity: Math.max(thread.peakSeverity, seed.severity),
        }
  }

  return { families, threads }
}

/**
 * Fold the day's resolved intents into their threads, so tomorrow's
 * recurrence can say what the player chose. Runs at `endDay`:
 * `responses` depends on `issueSeeds` and cannot be depended on in
 * return, but `applyResponses` runs before `endDay`, so the records are
 * already written by the time this reads them.
 *
 * `selectionLabel` is the Wave 3 player-facing label. When an intent
 * carries none (a bot or a test built it directly) the slot id is still
 * recorded as tried, but the thread stays `unanswered` for presentation
 * purposes rather than inventing wording for a decision the sim cannot
 * quote.
 */
export function recordResolutions(
  attention: AttentionState,
  resolved: readonly ResolvedIntentRecord[],
  seedsById: ReadonlyMap<string, IssueSeed>,
  today: number,
): AttentionState {
  if (resolved.length === 0) return attention
  const threads = { ...attention.threads }
  for (const record of resolved) {
    const seed = seedsById.get(record.seedId)
    if (!seed) continue
    const key = threadKeyForSeed(seed)
    const thread = threads[key]
    if (!thread) continue
    const tried = thread.triedSlotIds.includes(record.responseSlotId)
      ? thread.triedSlotIds
      : [...thread.triedSlotIds, record.responseSlotId]
    threads[key] = {
      ...thread,
      triedSlotIds: tried,
      lastAnsweredDay: today,
      ...(record.selectionLabel !== undefined
        ? {
            lastSelectionLabel: record.selectionLabel,
            lastSelectionDay: today,
          }
        : {}),
    }
  }
  return { ...attention, threads }
}

/** Drop ledger entries nothing will read again. */
export function pruneAttention(
  attention: AttentionState,
  today: number,
): AttentionState {
  const families: Record<string, FamilyStreakState> = {}
  for (const [key, streak] of Object.entries(attention.families)) {
    if (today - streak.lastSurfacedDay <= THREAD_PRUNE_AFTER_DAYS) {
      families[key] = streak
    }
  }
  const threads: Record<string, IssueThreadState> = {}
  for (const [key, thread] of Object.entries(attention.threads)) {
    if (today - thread.lastSurfacedDay <= THREAD_PRUNE_AFTER_DAYS) {
      threads[key] = thread
    }
  }
  return { families, threads }
}
