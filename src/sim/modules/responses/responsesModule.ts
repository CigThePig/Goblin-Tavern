import type { SimContext } from '../../core/context'
import type { SimulationHook, SimulationModule } from '../../core/module'
import type { ReportSection } from '../../core/reports'
import type { ValidationIssue } from '../../state/types'
import { getResolvableSeedsToday } from '../issues/issueSeedQueries'

import {
  applyResponseProfile,
  type ApplyOrigin,
} from './applyResponseProfile'
import {
  applyEffectViaCtx,
  applyMemoryDraftViaCtx,
  createCtxApplier,
  readResponsesSlice,
  recordPendingApplied,
  recordPendingExpired,
  recordResolvedIntent,
  removeFromPending,
  writeResponsesSlice,
} from './ctxApplier'
import { selectConsequence } from './selectConsequence'
import { immediateCoinCost } from './responseCost'
import {
  RESPONSES_MODULE_ID,
  ResponsesModuleStateSchema,
  createInitialResponsesModuleState,
  type PendingResponseEntry,
  type ResponsesModuleState,
} from './types'
import type { IssueSeed } from '../issues/issueSeedTypes'

// Phase 41 / ISSUE-001 — Responses module.
//
// Responsibilities:
//   - On `startDay`: clear per-day bookkeeping (`resolvedToday`,
//     `appliedFromPendingToday`, `expiredFromPendingToday`,
//     `nextPendingSuffix`), then walk the pending queue and apply /
//     expire / keep each entry based on `today` vs.
//     `scheduledFor` / `expiresAt`.
//   - On `applyResponses`: for each `responseIntent` in `ctx.input`,
//     locate the matching seed in `state.modules.issueSeeds.seedsToday`,
//     run `selectConsequence` to find the matching profile, and dispatch
//     the profile through `applyResponseProfile` with a `ctxApplier`.
//     Unknown seeds, slots, or verbs are logged and skipped.

export { RESPONSES_MODULE_ID, createInitialResponsesModuleState }
export type { ResponsesModuleState }

const SOURCE = RESPONSES_MODULE_ID

function applyPendingEntry(
  ctx: SimContext,
  entry: PendingResponseEntry,
): void {
  const origin: ApplyOrigin = entry.origin
  if (entry.payload.kind === 'memory') {
    applyMemoryDraftViaCtx(ctx, entry.payload.draft, origin)
    return
  }
  if (entry.payload.kind === 'memory_future_hook') {
    // Future-hook memories materialize as memories on the scheduled day.
    applyMemoryDraftViaCtx(ctx, entry.payload.draft, origin)
    return
  }
  // state_change | pressure | cause | future_hook payloads carry an
  // EffectPreview. A `future_hook` payload that has reached its
  // scheduled day still has no immediate mutation of its own (it is a
  // marker for downstream systems), so we synthesize a cause to mark
  // its firing and rely on the cause's tags for downstream pickup.
  const effect = entry.payload.effect
  if (entry.payload.kind === 'future_hook') {
    ctx.addCause({
      source: `response.${origin.verb}`,
      sourceType: 'system',
      target: effect.target,
      targetType: 'global',
      amount: 0,
      direction: 'neutral',
      weight: 0,
      readable: effect.readable,
      tags: ['response', 'future_hook', ...effect.tags],
    })
    return
  }
  applyEffectViaCtx(ctx, effect, origin)
}

/**
 * Phase 202 / audit Wave 3 (`P6-COMP-002`) — record a drained entry so the
 * report can name it.
 *
 * The id arrays alone cannot be attributed after the fact: the entry is
 * removed from the queue during this same drain, and `pending-<day>-<n>`
 * carries no origin. Capturing the origin label and the effect's own
 * readable here is what turns "an unexplained number changed" into "the
 * thing you chose on Day 2 came due".
 */
function recordDrained(
  ctx: SimContext,
  entry: PendingResponseEntry,
  status: 'applied' | 'expired',
): void {
  const payload = entry.payload
  const readable =
    payload.kind === 'memory' || payload.kind === 'memory_future_hook'
      ? (payload.draft.label ?? 'Something is remembered.')
      : payload.effect.readable
  writeResponsesSlice(
    ctx,
    (current) => ({
      ...current,
      drainedToday: [
        ...(current.drainedToday ?? []),
        {
          entryId: entry.id,
          status,
          originLabel:
            entry.origin.selectionLabel ??
            entry.origin.responseSlotId.replace(/_/g, ' '),
          readable,
        },
      ],
    }),
    'record_drained',
  )
}

const startDayHook: SimulationHook = (ctx: SimContext): void => {
  // 1) Reset per-day bookkeeping AND the suffix counter (suffixes
  //    are per-day; tomorrow's enqueues start at 0 again so ids
  //    embed the day cleanly).
  writeResponsesSlice(
    ctx,
    (current) => ({
      ...current,
      resolvedToday: [],
      appliedFromPendingToday: [],
      expiredFromPendingToday: [],
      drainedToday: [],
      nextPendingSuffix: 0,
    }),
    'day_initialize',
  )

  // 2) Snapshot the pending list. Drain decisions are taken from this
  //    snapshot so writes during apply don't perturb iteration.
  const today = ctx.state.calendar.totalDaysElapsed
  const snapshot = readResponsesSlice(ctx.state).pending
  if (snapshot.length === 0) return

  const toApply: PendingResponseEntry[] = []
  const toExpire: PendingResponseEntry[] = []
  for (const entry of snapshot) {
    if (today > entry.expiresAt) {
      toExpire.push(entry)
    } else if (today >= entry.scheduledFor) {
      toApply.push(entry)
    }
  }

  for (const entry of toExpire) {
    ctx.addLog(
      {
        message: `Pending response entry ${entry.id} expired without firing`,
        level: 'info',
        data: {
          entryId: entry.id,
          kind: entry.payload.kind,
          scheduledFor: entry.scheduledFor,
          expiresAt: entry.expiresAt,
          today,
          origin: entry.origin,
        },
      },
      SOURCE,
    )
    recordPendingExpired(ctx, entry.id)
    recordDrained(ctx, entry, 'expired')
  }

  for (const entry of toApply) {
    try {
      applyPendingEntry(ctx, entry)
      recordPendingApplied(ctx, entry.id)
      recordDrained(ctx, entry, 'applied')
    } catch (err) {
      ctx.addLog(
        {
          message: `Pending response entry ${entry.id} failed to apply: ${(err as Error).message}`,
          level: 'warn',
          data: { entryId: entry.id, kind: entry.payload.kind },
        },
        SOURCE,
      )
    }
  }

  const drainedIds = [...toApply, ...toExpire].map((e) => e.id)
  removeFromPending(ctx, drainedIds)
}

function findSeed(ctx: SimContext, seedId: string): IssueSeed | undefined {
  // Phase 186 / Cluster 1 — the issueSeedsModule now clears `seedsToday`
  // at `startDay` and regenerates the day's seeds segment-locally
  // (morning at `startDay`, during-service at `afterService`, closing at
  // `closing`). By the time `applyResponses` runs, `seedsToday` holds
  // THIS day's accumulated surface, so a response resolves against a seed
  // generated *earlier the same day* across the preceding passes — the
  // two-pause model the day-clock contract is moving toward. (The seam
  // is timing-agnostic, so morning/service/closing seeds all resolve
  // through this one path — contract §1.9.)
  //
  // Phase 2 (teleology) — resolve against `getResolvableSeedsToday`, not the
  // visible hand alone. Each generation pass re-applies the hand budget, so a
  // seed surfaced in an earlier pass can be displaced from `seedsToday` by a
  // later, higher-ranked seed. A card the player was shown must still resolve
  // its response; `getResolvableSeedsToday` adds those displaced-but-surfaced
  // seeds back so a valid choice on a crowded day is never silently dropped.
  return getResolvableSeedsToday(ctx.state).find((s) => s.id === seedId)
}

const applyResponsesHook: SimulationHook = (ctx: SimContext): void => {
  const intents = ctx.input.responseIntents
  if (!intents || intents.length === 0) return

  const today = ctx.state.calendar.totalDaysElapsed

  for (const intent of intents) {
    const seed = findSeed(ctx, intent.seedId)
    if (!seed) {
      ctx.addLog(
        {
          message: `Response intent ${intent.id} references unknown seed ${intent.seedId}`,
          level: 'warn',
          data: { intentId: intent.id, seedId: intent.seedId },
        },
        SOURCE,
      )
      continue
    }
    const { profile, slot } = selectConsequence(seed, intent)
    if (!profile || !slot) {
      ctx.addLog(
        {
          message: `Response intent ${intent.id} did not match any slot on seed ${intent.seedId}`,
          level: 'warn',
          data: {
            intentId: intent.id,
            seedId: intent.seedId,
            verb: intent.verb,
            shape: intent.shape,
          },
        },
        SOURCE,
      )
      continue
    }
    // Phase 200 / audit Wave 1 (`P7-EXP-001`), DC-07 — the day's
    // responses are priced against the till as it stands at each
    // intent's turn, and an intent that no longer fits is skipped
    // WHOLE. Nothing checked this before: several individually
    // affordable choices resolved together into 183 coin of spending
    // against 98 coin on hand, took the coin negative, and broke the
    // state schema's `coin >= 0`. Skipping whole (rather than letting
    // the first unaffordable effect throw mid-profile) is what keeps a
    // refused response from leaving half its consequences behind.
    // Phase 202 / audit Wave 3 (`P6-COMP-001`) — the player's own wording,
    // carried on the intent by the card layer.
    const meta = intent.metadata as
      | { selectionLabel?: unknown; targetRef?: { kind?: unknown; id?: unknown } }
      | undefined
    const cost = immediateCoinCost(profile)
    if (cost > ctx.state.coin) {
      ctx.addLog(
        {
          message: `Response intent ${intent.id} skipped: costs ${cost} coin, ${ctx.state.coin} available`,
          level: 'info',
          data: {
            intentId: intent.id,
            seedId: seed.id,
            responseSlotId: slot.id,
            cost,
            coin: ctx.state.coin,
          },
        },
        SOURCE,
      )
      recordResolvedIntent(ctx, {
        intentId: intent.id,
        seedId: seed.id,
        responseSlotId: slot.id,
        profileId: profile.id,
        verb: intent.verb,
        resolvedOn: today,
        outcome: 'skipped_unaffordable',
        note: `Needed ${cost} coin; only ${ctx.state.coin} on hand.`,
      })
      continue
    }

    const origin: ApplyOrigin = {
      seedId: seed.id,
      intentId: intent.id,
      profileId: profile.id,
      responseSlotId: slot.id,
      verb: intent.verb,
      enqueuedDay: today,
      // Phase 202 / audit Wave 3 (`P6-COMP-002`) — the label travels with
      // anything this profile queues, so a delayed effect can still name
      // the choice that promised it days later, when `resolvedToday` has
      // long since been cleared.
      ...(typeof meta?.selectionLabel === 'string'
        ? { selectionLabel: meta.selectionLabel }
        : {}),
    }
    const applier = createCtxApplier(ctx)
    applyResponseProfile(profile, origin, applier)
    recordResolvedIntent(ctx, {
      intentId: intent.id,
      seedId: seed.id,
      responseSlotId: slot.id,
      profileId: profile.id,
      verb: intent.verb,
      resolvedOn: today,
      outcome: 'applied',
      ...(typeof meta?.selectionLabel === 'string'
        ? { selectionLabel: meta.selectionLabel }
        : {}),
      ...(typeof meta?.targetRef?.kind === 'string' &&
      typeof meta.targetRef.id === 'string'
        ? { targetRef: { kind: meta.targetRef.kind, id: meta.targetRef.id } }
        : {}),
    })
  }
}

function validate(ctx: SimContext): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const slice = readResponsesSlice(ctx.state)
  if (slice.totalApplied < 0 || slice.totalExpired < 0 || slice.totalResolved < 0) {
    issues.push({
      path: `modules.${RESPONSES_MODULE_ID}`,
      message: 'Responses module has negative counters',
      code: 'responses_negative_counter',
    })
  }
  for (let i = 0; i < slice.pending.length; i += 1) {
    const p = slice.pending[i]!
    if (p.scheduledFor < 0 || p.expiresAt < p.scheduledFor) {
      issues.push({
        path: `modules.${RESPONSES_MODULE_ID}.pending[${i}]`,
        message: `Pending entry '${p.id}' has invalid scheduling window`,
        code: 'responses_invalid_schedule',
      })
    }
  }
  return issues
}

function buildReport(ctx: SimContext): ReportSection {
  const slice = readResponsesSlice(ctx.state)
  const lines: string[] = []
  lines.push(`Resolved today: ${slice.resolvedToday.length}`)
  lines.push(`Pending applied today: ${slice.appliedFromPendingToday.length}`)
  lines.push(`Pending expired today: ${slice.expiredFromPendingToday.length}`)
  lines.push(`Pending queue size: ${slice.pending.length}`)
  if (slice.resolvedToday.length > 0) {
    lines.push('Intents resolved:')
    for (const r of slice.resolvedToday.slice(0, 8)) {
      lines.push(`  - ${r.verb} on ${r.seedId} → ${r.responseSlotId}`)
    }
  }
  return {
    id: 'responses',
    source: SOURCE,
    title: 'RESPONSES',
    lines,
    data: {
      resolvedToday: slice.resolvedToday.length,
      appliedFromPendingToday: slice.appliedFromPendingToday.length,
      expiredFromPendingToday: slice.expiredFromPendingToday.length,
      pendingTotal: slice.pending.length,
      totalResolved: slice.totalResolved,
      totalApplied: slice.totalApplied,
      totalExpired: slice.totalExpired,
    },
  }
}

export const responsesModule: SimulationModule = {
  id: RESPONSES_MODULE_ID,
  version: '0.1.0',
  // Run after `issueSeeds` so any future per-phase ordering against
  // its slice is consistent.
  dependsOn: ['issueSeeds'],
  hooks: {
    startDay: [startDayHook],
    applyResponses: [applyResponsesHook],
  },
  buildReport,
  validate,
  stateSchema: ResponsesModuleStateSchema,
}
