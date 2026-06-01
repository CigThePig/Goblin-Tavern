import { z } from 'zod'

import type { SimulationModule, SimulationHook } from '../../core/module'
import type { SimContext } from '../../core/context'
import type { ReportSection } from '../../core/reports'
import type { ValidationIssue } from '../../state/types'

import {
  actionRegistry,
  ensureRequiredOwnerActionsRegistered,
} from '../../registries/actionRegistry'

import { describeTargetLabel } from './actionDefinitions'
import {
  DAY_MINUTES,
  OWNER_ACTIONS_MODULE_ID,
  createInitialOwnerActionsModuleState,
  formatDuration,
  getOwnerActionsModuleState,
} from './stateHelpers'
import { tickProjects } from './projectProgress'
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
//   - Enforce the daily time budget (`DAY_MINUTES`; Phase 186 Cluster 3
//     converted the old 3-slot action-point budget into minutes). Inputs
//     that would push the day over the budget are rejected with code
//     `over_budget`; everything before that applies.
//   - Validate each action via its `canApply`. Rejections do not
//     consume time.
//   - Apply each accepted action via its `apply`, accumulating the
//     applied summary in the module slice.
//   - Build the OWNER ACTION REPORT during `generateReports`.
//   - Validate that applied actions reference real registry ids.
//
// Phase 33 — Persistent projects, policies, and social actions.
//
//   - `startDay` preserves `projects`, `policies`, and
//     `recentSocialActions` while resetting the daily fields
//     (§33.3). Wiping the whole slice was the Phase 13 default; that
//     reset would have nuked active projects every morning, which
//     Phase 33 explicitly flags as the wrong way.
//   - `endDay` advances active project progress and applies completion
//     effects via the project tick (§33.5). The project tick runs
//     before the cause module's daily age sweep so completion causes
//     stamp with today's age zero.

const SOURCE = OWNER_ACTIONS_MODULE_ID

export { DAY_MINUTES, OWNER_ACTIONS_MODULE_ID }

export { createInitialOwnerActionsModuleState, getOwnerActionsModuleState }

function writeSlice(
  ctx: SimContext,
  updater: (current: OwnerActionsModuleState) => OwnerActionsModuleState,
  reason: string,
): void {
  ctx.modifyModuleState<OwnerActionsModuleState>(
    OWNER_ACTIONS_MODULE_ID,
    (current) => {
      const base = current ?? createInitialOwnerActionsModuleState()
      return updater(base)
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
  // Phase 33 §33.3 — preserve persistent fields across the daily reset.
  // Only the daily audit (applied / rejected / time spent) is wiped.
  writeSlice(
    ctx,
    (current) => ({
      ...current,
      timeSpent: 0,
      timeBudget: DAY_MINUTES,
      applied: [],
      rejected: [],
    }),
    'day_initialize',
  )
}

const applyOwnerActionsHook: SimulationHook = (ctx: SimContext): void => {
  const inputs = readOwnerActionInput(ctx)
  if (inputs.length === 0) return

  const applied: OwnerActionApplied[] = []
  const rejected: OwnerActionRejected[] = []
  let timeSpent = 0
  const budget = DAY_MINUTES

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
    if (timeSpent + def.timeCost > budget) {
      rejected.push({
        actionId: input.actionId,
        ...(input.targetId !== undefined ? { targetId: input.targetId } : {}),
        code: 'over_budget',
        reason: `Action would exceed the ${formatDuration(budget)} daily time budget`,
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
    timeSpent += result.timeCost
  }

  writeSlice(
    ctx,
    (current) => ({
      ...current,
      applied,
      rejected,
      timeSpent,
      timeBudget: budget,
    }),
    'apply_owner_actions',
  )
}

// Phase 33 §33.5 — project progress runs at `endDay`. Splitting it from
// `closing` keeps the service module's `closing` hook (Phase 32) free
// of unrelated state churn.
const endDayHook: SimulationHook = (ctx: SimContext): void => {
  tickProjects(ctx)
}

// ---------- Reports ----------

function buildOwnerActionsReport(ctx: SimContext): ReportSection {
  const slice = getOwnerActionsModuleState(ctx.state)
  const lines: string[] = []
  lines.push(
    `Time Spent: ${formatDuration(slice.timeSpent)} / ${formatDuration(slice.timeBudget)}`,
  )
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

  // Phase 33 §33.9 — project / policy / social-action sections.
  // Phase 13's section stays first; the new groups are appended only
  // when they have content so the report stays readable on empty days.
  const activeProjects = Object.values(slice.projects).filter(
    (p) => p.status === 'active',
  )
  const completedProjects = Object.values(slice.projects).filter(
    (p) => p.status === 'completed',
  )
  const enabledPolicies = Object.values(slice.policies).filter((p) => p.enabled)

  if (activeProjects.length > 0 || completedProjects.length > 0) {
    lines.push('')
    lines.push('Active Projects')
    if (activeProjects.length === 0) {
      lines.push('  (none)')
    } else {
      for (const project of activeProjects) {
        lines.push(
          `  - ${project.label}: ${project.progress}/${project.requiredProgress} progress`,
        )
      }
    }
    if (completedProjects.length > 0) {
      lines.push('Completed Projects')
      for (const project of completedProjects) {
        lines.push(`  - ${project.label}: completed`)
      }
    }
  }

  if (enabledPolicies.length > 0) {
    lines.push('')
    lines.push('Enabled Policies')
    for (const policy of enabledPolicies) {
      const detail = policy.effects[0] ?? 'active'
      lines.push(`  - ${policy.label}: ${detail}`)
    }
  }

  if (slice.recentSocialActions.length > 0) {
    lines.push('')
    lines.push('Recent Social Actions')
    for (const record of slice.recentSocialActions.slice(0, 5)) {
      const note = record.notes[0] ?? record.outcome
      lines.push(`  - ${record.actionId} → ${record.targetId}: ${note}`)
    }
  }

  return {
    id: 'ownerActions',
    source: SOURCE,
    title: 'OWNER ACTION REPORT',
    lines,
    data: {
      timeSpent: slice.timeSpent,
      timeBudget: slice.timeBudget,
      applied: slice.applied.map((a) => ({
        ...a,
        effects: [...a.effects],
        data: { ...a.data },
      })),
      rejected: slice.rejected.map((r) => ({ ...r })),
      projects: Object.fromEntries(
        Object.values(slice.projects).map((p) => [
          p.id,
          { ...p, tags: [...p.tags], effectsPreview: [...p.effectsPreview] },
        ]),
      ),
      policies: Object.fromEntries(
        Object.values(slice.policies).map((p) => [
          p.id,
          { ...p, tags: [...p.tags], effects: [...p.effects] },
        ]),
      ),
      recentSocialActions: slice.recentSocialActions.map((r) => ({
        ...r,
        notes: [...r.notes],
        tags: [...r.tags],
      })),
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
  if (slice.timeSpent > slice.timeBudget) {
    issues.push({
      path: `modules.${OWNER_ACTIONS_MODULE_ID}.timeSpent`,
      message: `Time spent (${slice.timeSpent}m) exceeds daily budget (${slice.timeBudget}m)`,
      code: 'over_action_budget',
    })
  }

  // Phase 33 §33.10 — project / policy reference checks. A project that
  // claims to target an area must point at a real area; a policy must
  // carry the `policyType` it was registered under.
  for (const [id, project] of Object.entries(slice.projects)) {
    if (id !== project.id) {
      issues.push({
        path: `modules.${OWNER_ACTIONS_MODULE_ID}.projects.${id}.id`,
        message: `Project key '${id}' does not match record id '${project.id}'`,
        code: 'project_id_mismatch',
      })
    }
    if (
      project.targetType === 'area' &&
      project.targetId !== undefined &&
      !ctx.state.areas[project.targetId]
    ) {
      issues.push({
        path: `modules.${OWNER_ACTIONS_MODULE_ID}.projects.${id}.targetId`,
        message: `Project '${id}' targets unknown area '${project.targetId}'`,
        code: 'unknown_project_target',
      })
    }
  }
  return issues
}

// ---------- Module schema ----------

const OwnerActionAppliedSchema = z.object({
  actionId: z.string(),
  label: z.string(),
  targetId: z.string().optional(),
  timeCost: z.number().int().min(0),
  effects: z.array(z.string()),
  data: z.record(z.string(), z.unknown()),
})

const OwnerActionRejectedSchema = z.object({
  actionId: z.string(),
  targetId: z.string().optional(),
  code: z.string(),
  reason: z.string(),
})

const OwnerActionTargetTypeSchema = z.enum([
  'area',
  'stock',
  'staff',
  'customer_group',
  'regular',
  'supplier',
  'faction',
  'project',
  'policy',
  'recipe',
  'global',
])

const OwnerProjectStateSchema = z.object({
  id: z.string(),
  projectType: z.string(),
  label: z.string(),
  targetType: OwnerActionTargetTypeSchema.optional(),
  targetId: z.string().optional(),
  startedAtDay: z.number().int().min(0),
  progress: z.number().min(0),
  requiredProgress: z.number().min(1),
  coinInvested: z.number().min(0),
  status: z.enum(['active', 'completed', 'cancelled', 'blocked']),
  tags: z.array(z.string()),
  effectsPreview: z.array(z.string()),
})

const OwnerPolicyStateSchema = z.object({
  id: z.string(),
  policyType: z.string(),
  label: z.string(),
  enabled: z.boolean(),
  startedAtDay: z.number().int().min(0),
  targetType: OwnerActionTargetTypeSchema.optional(),
  targetId: z.string().optional(),
  tags: z.array(z.string()),
  effects: z.array(z.string()),
})

const OwnerSocialActionRecordSchema = z.object({
  id: z.string(),
  actionId: z.string(),
  targetType: OwnerActionTargetTypeSchema,
  targetId: z.string(),
  day: z.number().int().min(0),
  outcome: z.enum(['improved', 'worsened', 'neutral']),
  notes: z.array(z.string()),
  tags: z.array(z.string()),
})

const OwnerActionsModuleStateSchema = z.object({
  timeSpent: z.number().int().min(0),
  timeBudget: z.number().int().min(0),
  applied: z.array(OwnerActionAppliedSchema),
  rejected: z.array(OwnerActionRejectedSchema),
  projects: z.record(z.string(), OwnerProjectStateSchema),
  policies: z.record(z.string(), OwnerPolicyStateSchema),
  recentSocialActions: z.array(OwnerSocialActionRecordSchema),
})

export const ownerActionsModule: SimulationModule = {
  id: OWNER_ACTIONS_MODULE_ID,
  version: '0.2.0',
  // The owner-actions module routes coin through Phase 9's ledger
  // (`spendCoin` / `restockItem`), which writes the `state.modules.stock`
  // slice. Declaring stock as a dependency keeps the engine's topological
  // sort honest: the stock module's `startDay` reset runs before this
  // module's first ledger write of the day.
  dependsOn: ['stock'],
  hooks: {
    startDay: [startDayHook],
    applyOwnerActions: [applyOwnerActionsHook],
    endDay: [endDayHook],
  },
  buildReport: buildOwnerActionsReport,
  validate: validateOwnerActions,
  stateSchema: OwnerActionsModuleStateSchema,
}

export { actionRegistry, ensureRequiredOwnerActionsRegistered }
