import type { TavernState } from '../../state/TavernState'

import { allScheduledEventDefinitions, getScheduledEventDefinition } from './registry'
import { readScheduledEventsSlice } from './state'
import {
  MAX_ARCHIVED_OUTCOMES,
  MAX_EXACT_ONCE_KEYS,
  MAX_QUEUED_EVENTS,
  type ScheduledEventDefinition,
} from './types'

// Expansion Phase 1 §1.1 — the four failing conditions, as checks.
//
// The plan requires validation that FAILS when:
//   1. a mechanical event has no registered owner;
//   2. a response schedules an unregistered event;
//   3. an event resolves without an authoritative mutation or an explicit
//      no-op reason;
//   4. two domains claim ownership of the same event type.
//
// (4) is enforced structurally at registration time — `registerScheduledEvent`
// throws — so it cannot reach state. (1)-(3) are state and registry
// properties, checked here and surfaced both through the module's runtime
// `validate` hook and through the Phase 1 contract tests.

export type ScheduledEventContractProblem = {
  code:
    | 'mechanical_event_without_owner'
    | 'unregistered_event_scheduled'
    | 'resolved_without_mutation'
    | 'no_op_without_reason'
    | 'duplicate_exact_once_key'
    | 'queue_over_cap'
    | 'archive_over_cap'
    | 'spent_keys_over_cap'
    | 'definition_missing_resolver'
  message: string
  detail?: string
}

/**
 * Registry-level checks. Run at test time (and cheaply at startup) so a
 * badly-declared definition fails before any save carries its events.
 */
export function validateScheduledEventRegistry(): ScheduledEventContractProblem[] {
  const problems: ScheduledEventContractProblem[] = []
  for (const definition of allScheduledEventDefinitions()) {
    if (!definition.ownerModuleId) {
      problems.push({
        code: 'mechanical_event_without_owner',
        message: `Mechanical event '${definition.type}' declares no owning module`,
      })
    }
    if (typeof definition.resolve !== 'function') {
      problems.push({
        code: 'definition_missing_resolver',
        message: `Mechanical event '${definition.type}' has no resolver`,
      })
    }
    if (definition.warningWindowDays > definition.defaultOffsetDays) {
      // A warning window longer than the lead time would mean the event is
      // born already warned, which makes "you were told in advance"
      // meaningless.
      problems.push({
        code: 'mechanical_event_without_owner',
        message:
          `Mechanical event '${definition.type}' has a ${definition.warningWindowDays}-day warning ` +
          `window but only ${definition.defaultOffsetDays} days of lead time`,
      })
    }
  }
  return problems
}

/** State-level checks. Everything a loaded or in-flight save can get wrong. */
export function validateScheduledEventState(
  state: TavernState,
): ScheduledEventContractProblem[] {
  const problems: ScheduledEventContractProblem[] = []
  const slice = readScheduledEventsSlice(state)

  for (const record of slice.queue) {
    if (record.kind !== 'mechanical') continue
    if (!getScheduledEventDefinition(record.type)) {
      problems.push({
        code: 'unregistered_event_scheduled',
        message:
          `Queued mechanical event '${record.type}' (${record.id}) has no registered owner`,
        detail: record.origin.source,
      })
    }
  }

  // An event that reached `resolved` must name what it changed, and one
  // that reached `no_op` must say why. This is the check that would have
  // caught the drained-but-inert future hooks (`OBL-02`) as a failure
  // rather than as silence.
  for (const outcome of [...slice.resolvedToday, ...slice.archive]) {
    if (outcome.status === 'resolved' && outcome.mutations.length === 0) {
      problems.push({
        code: 'resolved_without_mutation',
        message:
          `Event '${outcome.type}' (${outcome.eventId}) resolved without an authoritative mutation`,
        detail: outcome.readable,
      })
    }
    if (outcome.status === 'no_op' && !outcome.reason) {
      problems.push({
        code: 'no_op_without_reason',
        message: `Event '${outcome.type}' (${outcome.eventId}) no-op'd without a reason`,
      })
    }
  }

  const liveKeys = new Map<string, string>()
  for (const record of slice.queue) {
    if (record.status !== 'scheduled' && record.status !== 'warned') continue
    const seen = liveKeys.get(record.exactOnceKey)
    if (seen) {
      problems.push({
        code: 'duplicate_exact_once_key',
        message:
          `Exact-once key '${record.exactOnceKey}' is live on two events (${seen}, ${record.id})`,
      })
    } else {
      liveKeys.set(record.exactOnceKey, record.id)
    }
  }

  if (slice.queue.length > MAX_QUEUED_EVENTS) {
    problems.push({
      code: 'queue_over_cap',
      message: `Scheduled-event queue holds ${slice.queue.length} entries, above the ${MAX_QUEUED_EVENTS} cap`,
    })
  }
  if (slice.archive.length > MAX_ARCHIVED_OUTCOMES) {
    problems.push({
      code: 'archive_over_cap',
      message: `Scheduled-event archive holds ${slice.archive.length} entries, above the ${MAX_ARCHIVED_OUTCOMES} cap`,
    })
  }
  if (slice.spentKeys.length > MAX_EXACT_ONCE_KEYS) {
    problems.push({
      code: 'spent_keys_over_cap',
      message: `Exact-once ledger holds ${slice.spentKeys.length} keys, above the ${MAX_EXACT_ONCE_KEYS} cap`,
    })
  }

  return problems
}

/**
 * Wording audit for narrative expectations (§1.1: a narrative expectation
 * "cannot use wording that promises a concrete event").
 *
 * This REPORTS rather than fails. The ~90 existing hook families were
 * written as concrete promises, and rewriting that content is the job of
 * the phase that gives each family a real owner — at which point the hook
 * becomes mechanical and the wording becomes true. Failing here in Phase 1
 * would only force the content to be watered down before the mechanics
 * exist to back it, which is the opposite of what the plan wants.
 */
export const PROMISSORY_WORDING = [
  'will ',
  'is coming',
  'comes due',
  'due on',
  'returns on',
  'guaranteed',
  'promises to',
] as const

export function findPromissoryWording(readable: string): string[] {
  const lower = readable.toLowerCase()
  return PROMISSORY_WORDING.filter((phrase) => lower.includes(phrase))
}

export type NarrativePromiseAuditRow = {
  type: string
  readable: string
  phrases: string[]
}

export function auditNarrativeExpectationWording(
  state: TavernState,
): NarrativePromiseAuditRow[] {
  const rows: NarrativePromiseAuditRow[] = []
  for (const record of readScheduledEventsSlice(state).queue) {
    if (record.kind !== 'narrative_expectation') continue
    const phrases = findPromissoryWording(record.origin.readable)
    if (phrases.length > 0) {
      rows.push({
        type: record.type,
        readable: record.origin.readable,
        phrases: [...phrases],
      })
    }
  }
  return rows
}

/** Definitions grouped by owner. Used by the §1.7 architecture tests. */
export function scheduledEventOwnership(): Map<string, ScheduledEventDefinition[]> {
  const byOwner = new Map<string, ScheduledEventDefinition[]>()
  for (const definition of allScheduledEventDefinitions()) {
    const list = byOwner.get(definition.ownerModuleId) ?? []
    list.push(definition)
    byOwner.set(definition.ownerModuleId, list)
  }
  return byOwner
}
