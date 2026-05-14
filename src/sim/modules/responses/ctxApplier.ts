import type { SimContext } from '../../core/context'
import type { EffectPreview, EffectResult } from '../../core/effect'
import type {
  AreaState,
  CustomerGroupState,
  ReputationState,
  StaffState,
  StockState,
  TavernState,
} from '../../state/TavernState'
import type { MemoryDraft } from '../memories/memoryTypes'
import { addCoin, spendCoin } from '../stock/ledger'

import type { EffectApplier, ApplyOrigin, ApplierLog } from './applyResponseProfile'
import type {
  PendingResponseEntry,
  ResolvedIntentRecord,
  ResponsesModuleState,
} from './types'
import { createInitialResponsesModuleState, RESPONSES_MODULE_ID } from './types'
import { makePendingId } from './pendingHelpers'

// Phase 41 / ISSUE-001 — engine-path applier.
//
// Routes each effect through the cause-emitting ctx mutators so the
// response pipeline plays by the same cause contract every other module
// does. Pending entries land in `state.modules.responses.pending` via
// `ctx.modifyModuleState`; the suffix counter on the slice is bumped on
// each enqueue so ids stay deterministic across a day.
//
// The drain hook in `responsesModule` reuses this applier to fire
// already-enqueued pending entries when their `scheduledFor` arrives.

const CLAMP_MIN = 0
const CLAMP_MAX = 100

function clamp(value: number, lo = CLAMP_MIN, hi = CLAMP_MAX): number {
  return Math.max(lo, Math.min(hi, value))
}

function readSlice(state: TavernState): ResponsesModuleState {
  const current = (state.modules as Record<string, unknown>)[
    RESPONSES_MODULE_ID
  ] as ResponsesModuleState | undefined
  const defaults = createInitialResponsesModuleState()
  return current ? { ...defaults, ...current } : defaults
}

function writeSlice(
  ctx: SimContext,
  patch: (current: ResponsesModuleState) => ResponsesModuleState,
  reason: string,
): void {
  ctx.modifyModuleState<ResponsesModuleState>(
    RESPONSES_MODULE_ID,
    (current) => {
      const defaults = createInitialResponsesModuleState()
      const base: ResponsesModuleState = current
        ? { ...defaults, ...current }
        : defaults
      return patch(base)
    },
    { source: 'responses', reason },
  )
}

/** Apply one immediate effect to live state via ctx helpers. Returns
 *  the EffectResult for the report. */
export function applyEffectViaCtx(
  ctx: SimContext,
  preview: EffectPreview,
  origin: ApplyOrigin,
): EffectResult {
  const source = `response.${origin.verb}`
  const readable = preview.readable

  // Pressure
  if (preview.kind === 'pressure') {
    const id = preview.target.replace(/^pressure:/, '')
    const existing = ctx.state.pressures[id]
    if (!existing) {
      return {
        ...preview,
        applied: false,
        notes: [`unknown pressure ${id}`],
      }
    }
    const delta = preview.amount ?? 0
    if (delta === 0) return { ...preview, applied: true }
    ctx.modifyPressure(id, delta, {
      source,
      readable,
      tags: ['response', ...preview.tags],
    })
    return { ...preview, applied: true }
  }

  // Cause: emit through ctx.addCause so it lands in state.causes.
  if (preview.kind === 'cause') {
    const amount = preview.amount ?? 0
    const direction =
      amount > 0 ? 'increase' : amount < 0 ? 'decrease' : 'neutral'
    ctx.addCause({
      source,
      sourceType: 'system',
      target: preview.target,
      targetType: 'global',
      amount,
      direction,
      weight: Math.abs(amount),
      readable,
      tags: ['response', ...preview.tags],
    })
    return { ...preview, applied: true, notes: ['cause emitted'] }
  }

  // Memory: route through ctx.addMemory (stacking dispatch lives there).
  if (preview.kind === 'memory') {
    try {
      ctx.addMemory({
        id: preview.target,
        source,
        tags: ['response', ...preview.tags],
      })
      return { ...preview, applied: true, notes: ['memory added'] }
    } catch (err) {
      return {
        ...preview,
        applied: false,
        notes: [`addMemory failed: ${(err as Error).message}`],
      }
    }
  }

  // State change — dispatch by target prefix.
  if (preview.kind !== 'state_change') {
    return {
      ...preview,
      applied: false,
      notes: [`unsupported effect kind ${preview.kind}`],
    }
  }

  const amount = preview.amount ?? 0
  const path = preview.target

  if (path === 'coin') {
    if (amount === 0) return { ...preview, applied: true }
    const meta = {
      source,
      readable,
      tags: ['response', ...preview.tags],
      category: 'other' as const,
    }
    if (amount > 0) {
      addCoin(ctx, amount, meta)
    } else {
      spendCoin(ctx, -amount, meta)
    }
    return { ...preview, applied: true }
  }

  if (path.startsWith('areas.')) {
    const [, id, field] = path.split('.') as [string, string, keyof AreaState]
    const area = ctx.state.areas[id]
    if (!area) {
      return { ...preview, applied: false, notes: [`unknown area ${id}`] }
    }
    if (typeof area[field] !== 'number') {
      return {
        ...preview,
        applied: false,
        notes: [`unsupported area field ${field}`],
      }
    }
    const isClamped =
      field === 'condition' ||
      field === 'cleanliness' ||
      field === 'mess' ||
      field === 'damage' ||
      field === 'smell' ||
      field === 'risk'
    const before = area[field] as number
    const raw = before + amount
    const next = isClamped ? clamp(raw) : raw
    ctx.modifyArea(
      id,
      { [field]: next } as Partial<AreaState>,
      { source, readable, tags: ['response', ...preview.tags] },
    )
    return { ...preview, applied: true }
  }

  if (path.startsWith('stock.')) {
    const [, id, field] = path.split('.') as [string, string, keyof StockState]
    const item = ctx.state.stock[id]
    if (!item) {
      return { ...preview, applied: false, notes: [`unknown stock ${id}`] }
    }
    let next: number | undefined
    if (field === 'quantity') {
      next = Math.max(0, item.quantity + amount)
    } else if (field === 'quality' || field === 'spoilage') {
      next = clamp((item[field] as number) + amount)
    } else if (field === 'salePrice' || field === 'basePrice') {
      next = Math.max(0, (item[field] as number) + amount)
    } else {
      return {
        ...preview,
        applied: false,
        notes: [`unsupported stock field ${field}`],
      }
    }
    ctx.modifyStock(
      id,
      { [field]: next } as Partial<StockState>,
      { source, readable, tags: ['response', ...preview.tags] },
    )
    return { ...preview, applied: true }
  }

  if (path.startsWith('staff.')) {
    const [, id, field] = path.split('.') as [string, string, keyof StaffState]
    const member = ctx.state.staff[id]
    if (!member) {
      return { ...preview, applied: false, notes: [`unknown staff ${id}`] }
    }
    if (
      field !== 'morale' &&
      field !== 'stress' &&
      field !== 'fatigue' &&
      field !== 'loyalty' &&
      field !== 'skill'
    ) {
      return {
        ...preview,
        applied: false,
        notes: [`unsupported staff field ${field}`],
      }
    }
    const next = clamp((member[field] as number) + amount)
    ctx.modifyStaff(
      id,
      { [field]: next } as Partial<StaffState>,
      { source, readable, tags: ['response', ...preview.tags] },
    )
    return { ...preview, applied: true }
  }

  if (path.startsWith('customers.')) {
    const [, id, field] = path.split('.') as [
      string,
      string,
      keyof CustomerGroupState,
    ]
    const group = ctx.state.customerGroups[id]
    if (!group) {
      return {
        ...preview,
        applied: false,
        notes: [`unknown customer ${id}`],
      }
    }
    if (
      field !== 'satisfaction' &&
      field !== 'patronage' &&
      field !== 'loyalty' &&
      field !== 'rowdiness'
    ) {
      return {
        ...preview,
        applied: false,
        notes: [`unsupported customer field ${field}`],
      }
    }
    const next = clamp((group[field] as number) + amount)
    ctx.modifyCustomerGroup(
      id,
      { [field]: next } as Partial<CustomerGroupState>,
      { source, readable, tags: ['response', ...preview.tags] },
    )
    return { ...preview, applied: true }
  }

  if (path.startsWith('reputation.')) {
    const [, axis] = path.split('.') as [string, keyof ReputationState]
    const current = ctx.state.reputation[axis]
    if (current === undefined) {
      return {
        ...preview,
        applied: false,
        notes: [`unknown reputation axis ${String(axis)}`],
      }
    }
    const next: ReputationState = {
      ...ctx.state.reputation,
      [axis]: clamp((current as number) + amount),
    }
    ctx.modifyReputation(next, {
      source,
      readable,
      tags: ['response', ...preview.tags],
    })
    return { ...preview, applied: true }
  }

  return { ...preview, applied: false, notes: [`unsupported target ${path}`] }
}

export function applyMemoryDraftViaCtx(
  ctx: SimContext,
  draft: MemoryDraft,
  origin: ApplyOrigin,
): void {
  const source = draft.source ?? `response.${origin.verb}`
  try {
    ctx.addMemory({ ...draft, source })
  } catch {
    // Memory layer rejects unknown ids in some configurations; keep
    // best-effort behavior so a missing definition does not crash the
    // response pipeline.
  }
}

export function enqueuePendingViaCtx(
  ctx: SimContext,
  entry: PendingResponseEntry,
): void {
  writeSlice(
    ctx,
    (current) => ({
      ...current,
      pending: [...current.pending, entry],
    }),
    `enqueue_${entry.payload.kind}`,
  )
}

export function recordResolvedIntent(
  ctx: SimContext,
  record: ResolvedIntentRecord,
): void {
  writeSlice(
    ctx,
    (current) => ({
      ...current,
      resolvedToday: [...current.resolvedToday, record],
      totalResolved: current.totalResolved + 1,
    }),
    'intent_resolved',
  )
}

export function recordPendingApplied(ctx: SimContext, id: string): void {
  writeSlice(
    ctx,
    (current) => ({
      ...current,
      appliedFromPendingToday: [...current.appliedFromPendingToday, id],
      totalApplied: current.totalApplied + 1,
    }),
    'pending_applied',
  )
}

export function recordPendingExpired(ctx: SimContext, id: string): void {
  writeSlice(
    ctx,
    (current) => ({
      ...current,
      expiredFromPendingToday: [...current.expiredFromPendingToday, id],
      totalExpired: current.totalExpired + 1,
    }),
    'pending_expired',
  )
}

export function removeFromPending(ctx: SimContext, ids: ReadonlyArray<string>): void {
  if (ids.length === 0) return
  const drop = new Set(ids)
  writeSlice(
    ctx,
    (current) => ({
      ...current,
      pending: current.pending.filter((p) => !drop.has(p.id)),
    }),
    'pending_drained',
  )
}

export function createCtxApplier(ctx: SimContext): EffectApplier {
  return {
    today: ctx.state.calendar.totalDaysElapsed,
    mintNextPendingId(today: number): string {
      // Read+bump suffix on the slice. modifyModuleState callback runs
      // synchronously, so the suffix is visible immediately to the
      // next call within this same response apply pass.
      let id = ''
      writeSlice(
        ctx,
        (current) => {
          const suffix = current.nextPendingSuffix
          id = makePendingId(today, suffix)
          return { ...current, nextPendingSuffix: suffix + 1 }
        },
        'mint_pending_id',
      )
      return id
    },
    applyImmediateEffect(effect, origin) {
      return applyEffectViaCtx(ctx, effect, origin)
    },
    applyMemoryDraft(draft, origin) {
      applyMemoryDraftViaCtx(ctx, draft, origin)
    },
    enqueuePending(entry) {
      enqueuePendingViaCtx(ctx, entry)
    },
    recordSynthesizedCause(_record) {
      // The engine path already emits the cause via the ctx mutator
      // (every modify* call passes a CauseDraft). No need to mirror it
      // again — the resolver-side path uses this method to populate the
      // standalone return shape, but in-engine the cause is already in
      // state.causes by the time recordSynthesizedCause is called.
    },
    log(entry: ApplierLog) {
      const log: { message: string; level: 'warn' | 'info'; data?: Record<string, unknown> } = {
        message: entry.message,
        level: entry.level === 'warn' ? 'warn' : 'info',
      }
      if (entry.data) log.data = entry.data
      ctx.addLog(log, 'responses')
    },
  }
}

export {
  RESPONSES_MODULE_ID,
  readSlice as readResponsesSlice,
  writeSlice as writeResponsesSlice,
}
