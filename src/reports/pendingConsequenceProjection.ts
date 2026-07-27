// Phase 202 / audit Wave 3 (`P6-COMP-002`) — the delayed-consequence
// lifecycle.
//
// A choice that advertises a later effect should enter a visible
// lifecycle: promised → pending with timing and origin → applied or
// expired → reported as resolved. What the audit found instead was a
// promise that vanished at selection and reappeared days later as an
// unexplained number: a canonical replay held four pending entries with
// explicit scheduled days while "What might happen" stayed empty, and a
// Main Room project's completion arrived as two bare report deltas with
// no mention of the project or the Day 2 choice that started it.
//
// The queue already knows everything needed. `PendingResponseEntry`
// carries `origin` (the seed, slot, verb and enqueued day of the choice
// that created it), `scheduledFor` and `expiresAt`, and the responses
// slice records which entries fired or expired today. Nothing projected
// any of it: the report's future section only listed `future_hook`
// MEMORIES created on the closed day.
//
// Both projections read the closed-day state, so Wave 2's report
// immutability carries them: the same explanation survives reload and
// historical revisit.

import type { TavernState } from '../sim/state/TavernState'
import type {
  PendingResponseEntry,
  ResolvedIntentRecord,
  ResponsesModuleState,
} from '../sim/modules/responses/types'
import type {
  ReportPendingConsequence,
  ReportResolvedConsequence,
  PendingConsequenceStatus,
} from './types'

/** Rows are capped so a busy queue cannot crowd out the rest of the report. */
const PENDING_CAP = 6
const RESOLVED_CAP = 6

function readSlice(state: TavernState): ResponsesModuleState | undefined {
  return state.modules['responses'] as ResponsesModuleState | undefined
}

/**
 * What the entry will do, in the words the choice's own preview used.
 * Every payload variant carries either an effect (with a `readable`) or a
 * memory draft (with a label), so there is always something honest to
 * show without inventing a description.
 */
function expectedEffectOf(entry: PendingResponseEntry): string {
  const payload = entry.payload
  if (payload.kind === 'memory' || payload.kind === 'memory_future_hook') {
    return payload.draft.label ?? 'Something is remembered.'
  }
  return payload.effect.readable
}

/**
 * The choice that created this entry, as the player saw it.
 *
 * The label is captured onto `origin` at enqueue time precisely so it
 * survives to the day the effect fires — `resolvedToday` is cleared every
 * morning, and a delayed effect lands days later. The same-day record is
 * a secondary source; the slot id is the honest last resort, never the
 * engine verb.
 */
function originLabelOf(
  entry: PendingResponseEntry,
  resolvedById: Map<string, ResolvedIntentRecord>,
): string {
  if (entry.origin.selectionLabel) return entry.origin.selectionLabel
  const record = resolvedById.get(entry.origin.intentId)
  if (record?.selectionLabel) return record.selectionLabel
  return entry.origin.responseSlotId.replace(/_/g, ' ')
}

function statusFor(
  entry: PendingResponseEntry,
  today: number,
): PendingConsequenceStatus {
  if (today >= entry.expiresAt) return 'expiring'
  if (today >= entry.scheduledFor) return 'due'
  return 'pending'
}

/**
 * Everything the player is still waiting on: what they chose, what it
 * will do, and when. Sorted soonest-first so the next thing to happen
 * reads first.
 */
export function projectPendingConsequences(
  state: TavernState,
  closedDay: number,
): ReportPendingConsequence[] {
  const slice = readSlice(state)
  const pending = slice?.pending ?? []
  if (pending.length === 0) return []

  const resolvedById = new Map<string, ResolvedIntentRecord>()
  for (const record of slice?.resolvedToday ?? []) {
    resolvedById.set(record.intentId, record)
  }

  return [...pending]
    .sort((a, b) => {
      if (a.scheduledFor !== b.scheduledFor) {
        return a.scheduledFor - b.scheduledFor
      }
      return a.id < b.id ? -1 : 1
    })
    .slice(0, PENDING_CAP)
    .map((entry) => ({
      entryId: entry.id,
      originLabel: originLabelOf(entry, resolvedById),
      expectedEffect: expectedEffectOf(entry),
      scheduledFor: entry.scheduledFor,
      // Days from the day that just closed. 0 means "tomorrow morning",
      // which is when the next `startDay` drain runs.
      daysAway: Math.max(0, entry.scheduledFor - closedDay),
      status: statusFor(entry, closedDay),
      seedId: entry.origin.seedId,
    }))
}

/**
 * The completion side: entries that fired or expired today, each named
 * with the choice that created it. This is the link that lets a later
 * state movement be recognised as the result of an earlier decision
 * instead of arriving as an unexplained delta.
 *
 * The entries themselves are removed from the queue during the drain, so
 * this reads the ids the slice recorded and the origin data it kept.
 */
export function projectResolvedConsequences(
  state: TavernState,
): ReportResolvedConsequence[] {
  const slice = readSlice(state)
  if (!slice) return []
  const applied = slice.appliedFromPendingToday ?? []
  const expired = slice.expiredFromPendingToday ?? []
  if (applied.length === 0 && expired.length === 0) return []

  // The drain records each entry with its origin as it removes it from
  // the queue; the id arrays are kept for back-compat and for saves
  // written before Wave 3.
  const drained = slice.drainedToday ?? []
  if (drained.length > 0) {
    return drained
      .map((record) => ({
        entryId: record.entryId,
        status: record.status,
        originLabel: record.originLabel,
        expectedEffect: record.readable,
      }))
      .slice(0, RESOLVED_CAP)
  }

  const rows: ReportResolvedConsequence[] = []
  for (const entryId of applied) {
    rows.push({ entryId, status: 'applied', originLabel: 'An earlier decision' })
  }
  for (const entryId of expired) {
    rows.push({ entryId, status: 'expired', originLabel: 'An earlier decision' })
  }
  return rows.slice(0, RESOLVED_CAP)
}

