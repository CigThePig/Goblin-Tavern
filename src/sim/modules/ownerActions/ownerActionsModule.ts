import { z } from 'zod'

import type { SimulationModule, SimulationHook } from '../../core/module'
import type { SimContext } from '../../core/context'
import type { ReportSection } from '../../core/reports'
import type { ValidationIssue } from '../../state/types'

import {
  actionRegistry,
  ensureRequiredOwnerActionsRegistered,
} from '../../registries/actionRegistry'

import {
  describeTargetLabel,
} from './actionDefinitions'
import type {
  OwnerActionApplied,
  OwnerActionInput,
  OwnerActionRejected,
  OwnerActionsModuleState,
} from './types'

// Phase 13 — Owner actions module.
//
// Responsibilities:
//   - Reset the per-day owner-action slice on `startDay`.
//   - Read `ctx.input.ownerActions` during the `applyOwnerActions`
//     phase (Phase 7 §7.1 — runs before `beforeService`/`service`).
//   - Enforce the 3-slot daily budget (§"Action Point Limit"). Inputs
//     that would push the day over the budget are rejected with code
//     `over_budget`; everything before that applies.
//   - Validate each action via its `canApply`. Rejections do not
//     consume action points.
//   - Apply each accepted action via its `apply`, accumulating the
//     applied summary in the module slice.
//   - Build the OWNER ACTION REPORT during `generateReports`.
//   - Validate that applied actions reference real registry ids.

export const OWNER_ACTIONS_MODULE_ID = 'ownerActions'
const SOURCE = OWNER_ACTIONS_MODULE_ID

// Phase 13 §"Action Point Limit" — 3 slots per day.
export const DEFAULT_ACTION_POINT_BUDGET = 3

export function createInitialOwnerActionsModuleState(): OwnerActionsModuleState {
  return {
    actionPointsUsed: 0,
    actionPointBudget: DEFAULT_ACTION_POINT_BUDGET,
    applied: [],
    rejected: [],
  }
}

export function getOwnerActionsModuleState(state: {
  modules: Record<string, unknown>
}): OwnerActionsModuleState {
  const slice = state.modules[OWNER_ACTIONS_MODULE_ID] as
    | OwnerActionsModuleState
    | undefined
  if (!slice) return createInitialOwnerActionsModuleState()
  return slice
}

function writeSlice(
  ctx: SimContext,
  patch: Partial<OwnerActionsModuleState>,
  reason: string,
): void {
  ctx.modifyModuleState<OwnerActionsModuleState>(
    OWNER_ACTIONS_MODULE_ID,
    (current) => {
      const base = current ?? createInitialOwnerActionsModuleState()
      return { ...base, ...patch }
    },
    { source: SOURCE, reason },
  )
}

function readOwnerActionInput(ctx: SimContext): ReadonlyArray<OwnerActionInput> {
  const raw = (ctx.input as { ownerActions?: ReadonlyArray<unknown> }).ownerActions
  if (!raw) return []
  const out: OwnerActionInput[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue
    const obj = entry as { actionId?: unknown; targetId?: unknown; amount?: unknown; options?: unknown }
    if (typeof obj.actionId !== 'string') continue
    const next: OwnerActionInput = { actionId: obj.actionId }
    if (typeof obj.targetId === 'string') next.targetId = obj.targetId
    if (typeof obj.amount === 'number') next.amount = obj.amount
    if (obj.options && typeof obj.options === 'object') {
      next.options = obj.options as Record<string, unknown>
    }
    out.push(next)
  }
  return out
}

// ---------- Hooks ----------

const startDayHook: SimulationHook = (ctx: SimContext): void => {
  ensureRequiredOwnerActionsRegistered()
  writeSlice(
    ctx,
    {
      actionPointsUsed: 0,
      actionPointBudget: DEFAULT_ACTION_POINT_BUDGET,
      applied: [],
      rejected: [],
    },
    'day_initialize',
  )
}

const applyOwnerActionsHook: SimulationHook = (ctx: SimContext): void => {
  const inputs = readOwnerActionInput(ctx)
  if (inputs.length === 0) return

  const applied: OwnerActionApplied[] = []
  const rejected: OwnerActionRejected[] = []
  let actionPointsUsed = 0
  const budget = DEFAULT_ACTION_POINT_BUDGET

  for (const input of inputs) {
    if (!actionRegistry.has(input.actionId)) {
      rejected.push({
        actionId: input.actionId,
        ...(input.targetId !== undefined ? { targetId: input.targetId } : {}),
        code: 'unknown_action',
        reason: `Unknown owner action '${input.actionId}'`,
      })
      continue
    }
    const def = actionRegistry.get(input.actionId)
    if (actionPointsUsed + def.actionPointCost > budget) {
      rejected.push({
        actionId: input.actionId,
        ...(input.targetId !== undefined ? { targetId: input.targetId } : {}),
        code: 'over_budget',
        reason: `Action would exceed the ${budget}-slot daily budget`,
      })
      continue
    }
    const verdict = def.canApply(ctx, input)
    if (!verdict.ok) {
      rejected.push({
        actionId: input.actionId,
        ...(input.targetId !== undefined ? { targetId: input.targetId } : {}),
        code: verdict.code,
        reason: verdict.reason,
      })
      continue
    }
    const result = def.apply(ctx, input)
    applied.push(result)
    actionPointsUsed += result.actionPointCost
  }

  writeSlice(
    ctx,
    {
      applied,
      rejected,
      actionPointsUsed,
      actionPointBudget: budget,
    },
    'apply_owner_actions',
  )
}

// ---------- Reports ----------

function buildOwnerActionsReport(ctx: SimContext): ReportSection {
  const slice = getOwnerActionsModuleState(ctx.state)
  const lines: string[] = []
  lines.push(`Actions Used: ${slice.actionPointsUsed}/${slice.actionPointBudget}`)
  lines.push('')

  if (slice.applied.length === 0) {
    lines.push('(no owner actions applied today)')
  } else {
    slice.applied.forEach((entry, index) => {
      lines.push(`${index + 1}. ${entry.label}`)
      for (const effect of entry.effects) {
        lines.push(`   ${effect}`)
      }
    })
  }

  if (slice.rejected.length > 0) {
    lines.push('')
    lines.push('Rejected:')
    for (const r of slice.rejected) {
      const def = actionRegistry.has(r.actionId)
        ? actionRegistry.get(r.actionId)
        : undefined
      const label = def?.label ?? r.actionId
      const target = r.targetId
        ? ` → ${describeTargetLabel(def?.targetType, r.targetId)}`
        : ''
      lines.push(`  ${label}${target}: ${r.reason} (${r.code})`)
    }
  }

  return {
    id: 'ownerActions',
    source: SOURCE,
    title: 'OWNER ACTION REPORT',
    lines,
    data: {
      actionPointsUsed: slice.actionPointsUsed,
      actionPointBudget: slice.actionPointBudget,
      applied: slice.applied.map((a) => ({
        ...a,
        effects: [...a.effects],
        data: { ...a.data },
      })),
      rejected: slice.rejected.map((r) => ({ ...r })),
    },
  }
}

// ---------- Validation ----------

function validateOwnerActions(ctx: SimContext): ValidationIssue[] {
  const slice = getOwnerActionsModuleState(ctx.state)
  const issues: ValidationIssue[] = []
  for (const entry of slice.applied) {
    if (!actionRegistry.has(entry.actionId)) {
      issues.push({
        path: `modules.${OWNER_ACTIONS_MODULE_ID}.applied`,
        message: `Applied action '${entry.actionId}' is not registered`,
        code: 'unknown_applied_action',
      })
    }
  }
  if (slice.actionPointsUsed > slice.actionPointBudget) {
    issues.push({
      path: `modules.${OWNER_ACTIONS_MODULE_ID}.actionPointsUsed`,
      message: `Action points used (${slice.actionPointsUsed}) exceeds budget (${slice.actionPointBudget})`,
      code: 'over_action_budget',
    })
  }
  return issues
}

// ---------- Module schema ----------

const OwnerActionAppliedSchema = z.object({
  actionId: z.string(),
  label: z.string(),
  targetId: z.string().optional(),
  actionPointCost: z.number().int().min(0),
  effects: z.array(z.string()),
  data: z.record(z.string(), z.unknown()),
})

const OwnerActionRejectedSchema = z.object({
  actionId: z.string(),
  targetId: z.string().optional(),
  code: z.string(),
  reason: z.string(),
})

const OwnerActionsModuleStateSchema = z.object({
  actionPointsUsed: z.number().int().min(0),
  actionPointBudget: z.number().int().min(0),
  applied: z.array(OwnerActionAppliedSchema),
  rejected: z.array(OwnerActionRejectedSchema),
})

export const ownerActionsModule: SimulationModule = {
  id: OWNER_ACTIONS_MODULE_ID,
  version: '0.1.0',
  // The owner-actions module routes coin through Phase 9's ledger
  // (`spendCoin` / `restockItem`), which writes the `state.modules.stock`
  // slice. Declaring stock as a dependency keeps the engine's topological
  // sort honest: the stock module's `startDay` reset runs before this
  // module's first ledger write of the day.
  dependsOn: ['stock'],
  hooks: {
    startDay: [startDayHook],
    applyOwnerActions: [applyOwnerActionsHook],
  },
  buildReport: buildOwnerActionsReport,
  validate: validateOwnerActions,
  stateSchema: OwnerActionsModuleStateSchema,
}

export { actionRegistry, ensureRequiredOwnerActionsRegistered }
