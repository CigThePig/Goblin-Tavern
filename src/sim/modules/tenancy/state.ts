import type { SimContext } from '../../core/context'
import type { EntityRef, TavernState } from '../../state/TavernState'

import { inSchemaOrder } from '../../state/schemaOrder'
import {
  LANDLORD_ID,
  MAX_LANDLORD_BELIEFS,
  MAX_REPAIR_REQUESTS,
  MAX_TENANCY_NOTICES,
  TENANCY_MODULE_ID,
  TenancyModuleStateSchema,
  type LandlordState,
  type TavernTenancyRecord,
  type TenancyModuleState,
  type TenancyNotice,
  type TenancyTotals,
  type LandlordRepairRequest,
} from './types'

// Expansion Phase 7 §7.2 — the tenancy slice.

export { TENANCY_MODULE_ID }

export function landlordRef(): EntityRef {
  // `other`, for the same reason a lender uses it: a counterparty the
  // reference validator has no collection to check against.
  return { kind: 'other', id: `landlord:${LANDLORD_ID}` }
}

export function emptyTenancyTotals(): TenancyTotals {
  return {
    periodsBilled: 0,
    periodsPaid: 0,
    periodsMissed: 0,
    noticesIssued: 0,
    noticesCured: 0,
    evictionsFiled: 0,
    evictionsGranted: 0,
    rentPaid: 0,
    concessionsGranted: 0,
    repairsRequested: 0,
    repairsCompleted: 0,
  }
}

export function createInitialLandlordState(): LandlordState {
  return {
    // Neutral, not friendly. The tavern has to earn a landlord who cuts it
    // slack, and paying rent is how.
    opinion: 50,
    concern: 0,
    beliefs: [],
    lastContactDay: 0,
    accessRefusals: 0,
    accessGrants: 0,
    negotiationsUsed: 0,
  }
}

export function createInitialTenancyModuleState(): TenancyModuleState {
  return {
    landlord: createInitialLandlordState(),
    notices: [],
    repairs: [],
    nextNoticeSuffix: 0,
    nextRepairSuffix: 0,
    totals: emptyTenancyTotals(),
  }
}

export function getTenancyModuleState(state: TavernState): TenancyModuleState {
  const slice = state.modules[TENANCY_MODULE_ID] as
    | Partial<TenancyModuleState>
    | undefined
  const defaults = createInitialTenancyModuleState()
  if (!slice) return defaults
  return {
    ...defaults,
    ...slice,
    landlord: { ...defaults.landlord, ...(slice.landlord ?? {}) },
    totals: { ...defaults.totals, ...(slice.totals ?? {}) },
  }
}

export function writeTenancyState(
  ctx: SimContext,
  patch: (current: TenancyModuleState) => TenancyModuleState,
  reason: string,
): void {
  ctx.modifyModuleState<TenancyModuleState>(
    TENANCY_MODULE_ID,
    (current) => {
      const defaults = createInitialTenancyModuleState()
      const base: TenancyModuleState = current
        ? {
            ...defaults,
            ...current,
            landlord: { ...defaults.landlord, ...(current.landlord ?? {}) },
            totals: { ...defaults.totals, ...(current.totals ?? {}) },
          }
        : defaults
      // §5.10 — normalise through the schema so an in-memory slice takes
      // exactly the key order a reloaded one takes. See `schemaOrder.ts`.
      return inSchemaOrder(TenancyModuleStateSchema, patch(base))
    },
    { source: `${TENANCY_MODULE_ID}.${reason}`, reason },
  )
}

export function getTenancy(state: TavernState): TavernTenancyRecord | undefined {
  return getTenancyModuleState(state).tenancy
}

export function writeTenancy(
  ctx: SimContext,
  tenancy: TavernTenancyRecord,
  reason: string,
): void {
  writeTenancyState(
    ctx,
    (current) => ({
      ...current,
      tenancy,
    }),
    reason,
  )
}

export function getLandlord(state: TavernState): LandlordState {
  return getTenancyModuleState(state).landlord
}

export function writeLandlord(
  ctx: SimContext,
  patch: (current: LandlordState) => LandlordState,
  reason: string,
): void {
  writeTenancyState(
    ctx,
    (current) => ({ ...current, landlord: patch(current.landlord) }),
    reason,
  )
}

/**
 * Record (or refresh) something the landlord holds against the tavern.
 *
 * Beliefs are keyed by id and refreshed rather than appended, so a
 * fortnight of filthy frontage is one belief the landlord keeps noticing
 * rather than fourteen. `MAX_LANDLORD_BELIEFS` caps the list against a
 * future rule that mints unbounded ids (§5.11).
 */
export function recordLandlordBelief(
  ctx: SimContext,
  belief: { id: string; readable: string; weight: number },
): void {
  const today = ctx.state.calendar.totalDaysElapsed
  writeLandlord(
    ctx,
    (current) => {
      const existing = current.beliefs.find((entry) => entry.id === belief.id)
      const beliefs = existing
        ? current.beliefs.map((entry) =>
            entry.id === belief.id
              ? { ...entry, ...belief, lastSeenOnDay: today }
              : entry,
          )
        : [...current.beliefs, { ...belief, lastSeenOnDay: today }]
      // Drop the stalest when over cap — the landlord forgets the oldest
      // grievance first, which is also the kindest reading for the player.
      const capped =
        beliefs.length > MAX_LANDLORD_BELIEFS
          ? [...beliefs]
              .sort((a, b) => b.lastSeenOnDay - a.lastSeenOnDay)
              .slice(0, MAX_LANDLORD_BELIEFS)
          : beliefs
      return { ...current, beliefs: capped }
    },
    'landlord_belief',
  )
}

/** Forget beliefs nothing has refreshed for a fortnight. */
export function ageLandlordBeliefs(ctx: SimContext, windowDays = 14): void {
  const today = ctx.state.calendar.totalDaysElapsed
  const landlord = getLandlord(ctx.state)
  const surviving = landlord.beliefs.filter(
    (belief) => today - belief.lastSeenOnDay <= windowDays,
  )
  if (surviving.length === landlord.beliefs.length) return
  writeLandlord(
    ctx,
    (current) => ({ ...current, beliefs: surviving }),
    'landlord_beliefs_aged',
  )
}

// ---------- Notices ----------

export function nextNoticeId(state: TavernState): string {
  return `notice-${getTenancyModuleState(state).nextNoticeSuffix}`
}

export function upsertNotice(
  ctx: SimContext,
  notice: TenancyNotice,
  reason: string,
): void {
  writeTenancyState(
    ctx,
    (current) => {
      const isNew = !current.notices.some((entry) => entry.id === notice.id)
      const notices = isNew
        ? [...current.notices, notice]
        : current.notices.map((entry) => (entry.id === notice.id ? notice : entry))
      return {
        ...current,
        notices: capNotices(notices),
        nextNoticeSuffix: isNew
          ? current.nextNoticeSuffix + 1
          : current.nextNoticeSuffix,
        totals: {
          ...current.totals,
          noticesIssued: isNew
            ? current.totals.noticesIssued + 1
            : current.totals.noticesIssued,
        },
      }
    },
    reason,
  )
}

/**
 * §5.11 — resolved notices are trimmed first, so the history a player needs
 * (what is live, and what it would take to fix) is never the part dropped.
 */
function capNotices(notices: TenancyNotice[]): TenancyNotice[] {
  if (notices.length <= MAX_TENANCY_NOTICES) return notices
  const live = notices.filter((notice) => notice.status === 'live')
  const resolved = notices.filter((notice) => notice.status !== 'live')
  const room = Math.max(0, MAX_TENANCY_NOTICES - live.length)
  return [...resolved.slice(resolved.length - room), ...live]
}

// ---------- Repairs ----------

export function nextRepairId(state: TavernState): string {
  return `repair-${getTenancyModuleState(state).nextRepairSuffix}`
}

export function upsertRepairRequest(
  ctx: SimContext,
  request: LandlordRepairRequest,
  reason: string,
): void {
  writeTenancyState(
    ctx,
    (current) => {
      const isNew = !current.repairs.some((entry) => entry.id === request.id)
      const repairs = isNew
        ? [...current.repairs, request]
        : current.repairs.map((entry) =>
            entry.id === request.id ? request : entry,
          )
      const open = repairs.filter((entry) => entry.status !== 'completed' && entry.status !== 'refused')
      const closed = repairs.filter((entry) => entry.status === 'completed' || entry.status === 'refused')
      const room = Math.max(0, MAX_REPAIR_REQUESTS - open.length)
      return {
        ...current,
        repairs: [...closed.slice(closed.length - room), ...open],
        nextRepairSuffix: isNew
          ? current.nextRepairSuffix + 1
          : current.nextRepairSuffix,
        totals: {
          ...current.totals,
          repairsRequested: isNew
            ? current.totals.repairsRequested + 1
            : current.totals.repairsRequested,
          repairsCompleted:
            request.status === 'completed' && !isNew
              ? current.totals.repairsCompleted + 1
              : current.totals.repairsCompleted,
        },
      }
    },
    reason,
  )
}

export function bumpTenancyTotals(
  ctx: SimContext,
  changes: Partial<TenancyTotals>,
  reason: string,
): void {
  writeTenancyState(
    ctx,
    (current) => {
      const totals = { ...current.totals }
      for (const [key, delta] of Object.entries(changes)) {
        if (typeof delta !== 'number') continue
        totals[key as keyof TenancyTotals] += delta
      }
      return { ...current, totals }
    },
    reason,
  )
}
