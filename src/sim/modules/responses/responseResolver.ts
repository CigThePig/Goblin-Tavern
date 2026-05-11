import type {
  AreaState,
  CauseEntry,
  CustomerGroupState,
  EntityRef,
  ReputationState,
  StaffState,
  StockState,
  TavernState,
} from '../../state/TavernState'
import type { EffectPreview, EffectResult } from '../../core/effect'
import type { ReportSection } from '../../core/reports'
import { createStateDiff } from '../../core/diff'
import type { MemoryDraft } from '../memories/memoryTypes'
import type {
  ConsequenceProfile,
  IssueSeed,
  ResponseIntent,
  ResponseResolutionResult,
  ResponseSlot,
} from '../issues/issueSeedTypes'
import { scoreAppliedEffects } from '../issues/impactScoring'
import type { CoinLedgerEntry, StockModuleState } from '../stock/types'

// Phase 19 §19.10 — Response resolver.
//
// Takes a TavernState, the issue seed, and the player-side response
// intent. Picks the matching consequence profile, applies the effects
// to a cloned state, and returns the resulting state diff + added
// memories/future hooks/causes.
//
// The resolver does not call into the engine — it is a pure transform
// usable from tests, debug runners, and future card-layer drivers.

const CLAMP_MIN = 0
const CLAMP_MAX = 100

function clamp(value: number, lo = CLAMP_MIN, hi = CLAMP_MAX): number {
  return Math.max(lo, Math.min(hi, value))
}

function cloneState(state: TavernState): TavernState {
  return structuredClone(state)
}

function selectConsequence(
  seed: IssueSeed,
  intent: ResponseIntent,
): { profile: ConsequenceProfile | undefined; slot: ResponseSlot | undefined } {
  // Match the intent to a slot first by id (if the intent's metadata
  // names one), then by verb. The first matching slot wins.
  const named = intent.metadata?.responseSlotId as string | undefined
  let slot: ResponseSlot | undefined
  if (named) {
    slot = seed.responseSlots.find((s) => s.id === named)
  }
  if (!slot) {
    slot = seed.responseSlots.find(
      (s) => s.allowedVerbs.includes(intent.verb) && s.shape === intent.shape,
    )
  }
  if (!slot) {
    slot = seed.responseSlots.find((s) => s.allowedVerbs.includes(intent.verb))
  }
  if (!slot) return { profile: undefined, slot: undefined }
  const profile = seed.consequenceProfiles.find(
    (p) => p.responseSlotId === slot!.id,
  )
  return { profile, slot }
}

function appendCoinLedgerEntry(
  state: TavernState,
  entry: CoinLedgerEntry,
): void {
  const slice =
    (state.modules.stock as StockModuleState | undefined) ??
    { ledger: [], shortages: [] }
  state.modules = {
    ...state.modules,
    stock: {
      ...slice,
      ledger: [...slice.ledger, entry],
    },
  }
}

/** Apply a single effect preview to a (mutable copy of) state.
 *  Returns whether the effect was applied. */
function applyStateEffect(
  state: TavernState,
  preview: EffectPreview,
  source: string,
): { applied: boolean; notes?: string[] } {
  if (preview.kind !== 'state_change' && preview.kind !== 'pressure') {
    return { applied: false, notes: ['non-state effect, recorded only'] }
  }
  const amount = preview.amount ?? 0
  if (preview.kind === 'pressure') {
    const id = preview.target.replace(/^pressure:/, '')
    const existing = state.pressures[id]
    if (!existing) return { applied: false, notes: [`unknown pressure ${id}`] }
    const next = clamp(existing.value + amount)
    state.pressures[id] = {
      ...existing,
      value: next,
      trend: amount > 0 ? 1 : amount < 0 ? -1 : 0,
    }
    return { applied: true }
  }
  const path = preview.target
  if (path === 'coin') {
    const before = state.coin
    const next = Math.max(0, before + amount)
    const applied = next - before
    state.coin = next
    // Phase 9 §9.3 — coin moves are always paired with a ledger entry.
    // Even though the resolver is a preview-only transform (the engine
    // never runs it), the returned state is meant to be self-consistent
    // so callers can commit it; downstream `getDailyProfitLoss` reads
    // the ledger, not the bare coin field.
    if (applied !== 0) {
      appendCoinLedgerEntry(state, {
        source,
        amount: applied,
        category: 'other',
        tags: ['response'],
      })
    }
    return { applied: true }
  }
  if (path.startsWith('areas.')) {
    const [, id, field] = path.split('.') as [string, string, keyof AreaState]
    const area = state.areas[id]
    if (!area) return { applied: false, notes: [`unknown area ${id}`] }
    if (typeof area[field] === 'number') {
      const isClamped =
        field === 'condition' ||
        field === 'cleanliness' ||
        field === 'mess' ||
        field === 'damage' ||
        field === 'smell' ||
        field === 'risk'
      const next = (area[field] as number) + amount
      ;(area as Record<string, unknown>)[field] = isClamped ? clamp(next) : next
      return { applied: true }
    }
    return { applied: false, notes: [`unsupported area field ${field}`] }
  }
  if (path.startsWith('stock.')) {
    const [, id, field] = path.split('.') as [string, string, keyof StockState]
    const item = state.stock[id]
    if (!item) return { applied: false, notes: [`unknown stock ${id}`] }
    if (field === 'quantity') {
      item.quantity = Math.max(0, item.quantity + amount)
      return { applied: true }
    }
    if (field === 'quality' || field === 'spoilage') {
      item[field] = clamp(item[field] + amount)
      return { applied: true }
    }
    if (field === 'salePrice' || field === 'basePrice') {
      item[field] = Math.max(0, item[field] + amount)
      return { applied: true }
    }
    return { applied: false, notes: [`unsupported stock field ${field}`] }
  }
  if (path.startsWith('staff.')) {
    const [, id, field] = path.split('.') as [string, string, keyof StaffState]
    const member = state.staff[id]
    if (!member) return { applied: false, notes: [`unknown staff ${id}`] }
    if (
      field === 'morale' ||
      field === 'stress' ||
      field === 'fatigue' ||
      field === 'loyalty' ||
      field === 'skill'
    ) {
      member[field] = clamp((member[field] as number) + amount)
      return { applied: true }
    }
    return { applied: false, notes: [`unsupported staff field ${field}`] }
  }
  if (path.startsWith('customers.')) {
    const [, id, field] = path.split('.') as [
      string,
      string,
      keyof CustomerGroupState,
    ]
    const group = state.customerGroups[id]
    if (!group) return { applied: false, notes: [`unknown customer ${id}`] }
    if (
      field === 'satisfaction' ||
      field === 'patronage' ||
      field === 'loyalty' ||
      field === 'rowdiness'
    ) {
      group[field] = clamp((group[field] as number) + amount)
      return { applied: true }
    }
    return { applied: false, notes: [`unsupported customer field ${field}`] }
  }
  if (path.startsWith('reputation.')) {
    const [, axis] = path.split('.') as [string, keyof ReputationState]
    const current = state.reputation[axis]
    if (current === undefined) {
      return { applied: false, notes: [`unknown reputation axis ${axis}`] }
    }
    state.reputation[axis] = clamp(current + amount)
    return { applied: true }
  }
  return { applied: false, notes: [`unsupported target ${path}`] }
}

function targetForEffect(preview: EffectPreview): string {
  return preview.target
}

function entityRefFromPreview(preview: EffectPreview): EntityRef[] {
  const refs: EntityRef[] = []
  const path = preview.target
  if (path.startsWith('areas.')) {
    const id = path.split('.')[1]
    if (id) refs.push({ kind: 'area', id })
  } else if (path.startsWith('stock.')) {
    const id = path.split('.')[1]
    if (id) refs.push({ kind: 'stock', id })
  } else if (path.startsWith('staff.')) {
    const id = path.split('.')[1]
    if (id) refs.push({ kind: 'staff', id })
  } else if (path.startsWith('customers.')) {
    const id = path.split('.')[1]
    if (id) refs.push({ kind: 'customer_group', id })
  }
  return refs
}

function buildResolutionReport(
  intent: ResponseIntent,
  applied: EffectResult[],
  diff: { significantChanges: { readable: string }[] },
  impact: number,
): ReportSection {
  const lines: string[] = []
  lines.push(`Response: ${intent.verb} (${intent.shape})`)
  lines.push(`Impact: ${impact}`)
  lines.push('Effects:')
  if (applied.length === 0) {
    lines.push('  (none)')
  } else {
    for (const e of applied) {
      lines.push(`  - ${e.readable}${e.applied ? '' : ' (not applied)'}`)
    }
  }
  lines.push('Significant state changes:')
  if (diff.significantChanges.length === 0) {
    lines.push('  (none)')
  } else {
    for (const c of diff.significantChanges.slice(0, 8)) {
      lines.push(`  - ${c.readable}`)
    }
  }
  return {
    id: 'response_resolution',
    source: 'responses',
    title: 'RESPONSE RESOLUTION',
    lines,
    data: { impact, intent },
  }
}

/** Phase 19 §19.10 — resolve a response intent against an issue seed.
 *  Returns the diff + applied effects + memories that would land if the
 *  player chose this response. The caller is responsible for actually
 *  persisting the returned state (the resolver does not mutate the
 *  input). */
export function resolveResponseIntent(
  state: TavernState,
  seed: IssueSeed,
  intent: ResponseIntent,
): ResponseResolutionResult & { state: TavernState } {
  const before = cloneState(state)
  const after = cloneState(state)
  const { profile, slot } = selectConsequence(seed, intent)

  const applied: EffectResult[] = []
  const causesAdded: ResponseResolutionResult['causesAdded'] = []
  let memoriesAdded: MemoryDraft[] = []
  let futureHooksAdded: MemoryDraft[] = []

  const effectSource = `response.${intent.verb}`

  if (profile) {
    for (const preview of profile.immediateEffects) {
      const { applied: ok, notes } = applyStateEffect(after, preview, effectSource)
      const result: EffectResult = {
        ...preview,
        applied: ok,
        ...(notes ? { notes } : {}),
      }
      applied.push(result)
      if (ok && preview.kind === 'state_change') {
        causesAdded.push({
          source: effectSource,
          target: targetForEffect(preview),
          readable: preview.readable,
          amount: preview.amount ?? 0,
        })
      }
    }
    // Delayed effects are not applied immediately — they're recorded as
    // future hook memories (when the preview is a future_hook) or noted
    // in the applied list so reports can surface them.
    for (const preview of profile.delayedEffects) {
      const result: EffectResult = {
        ...preview,
        applied: false,
        notes: ['delayed'],
      }
      applied.push(result)
    }
    memoriesAdded = profile.memories.map((m) => ({ ...m }))
    futureHooksAdded = [
      ...profile.futureHooks.map((m) => ({ ...m })),
      ...profile.delayedEffects
        .filter((e) => e.kind === 'future_hook')
        .map((e) => ({
          id: e.target,
          tags: e.tags,
        })) as MemoryDraft[],
    ]
  }

  const stateDiff = createStateDiff(before, after)
  const impactScore = scoreAppliedEffects(applied)
  const report = buildResolutionReport(intent, applied, stateDiff, impactScore)

  return {
    state: after,
    appliedEffects: applied,
    stateDiff,
    memoriesAdded,
    futureHooksAdded,
    causesAdded,
    impactScore,
    report,
  }
}

/** Synthesize a CauseEntry from a resolver-added cause record. Tests and
 *  drivers can use this to mirror cause attribution into state.causes. */
export function causeEntryFromAdded(
  added: ResponseResolutionResult['causesAdded'][number],
  stamp: CauseEntry['timestamp'],
): CauseEntry {
  const amount = added.amount
  const direction: CauseEntry['direction'] =
    amount > 0 ? 'increase' : amount < 0 ? 'decrease' : 'neutral'
  return {
    id: `response-${stamp.absoluteDay}-${added.target}`,
    timestamp: stamp,
    source: added.source,
    sourceType: 'system',
    target: added.target,
    targetType: 'global',
    amount,
    direction,
    weight: Math.abs(amount),
    readable: added.readable,
    tags: ['response'],
    relatedActors: [],
    relatedLocations: [],
    relatedSystems: [],
    ageDays: 0,
  }
}

void entityRefFromPreview
