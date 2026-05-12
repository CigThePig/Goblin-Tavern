import type { SimContext } from '../../core/context'

import { spendCoin } from '../stock/ledger'

import {
  getOwnerActionsModuleState,
  writeProjectsSlice,
} from './stateHelpers'
import type {
  ActionTarget,
  ActionValidationResult,
  OwnerActionApplied,
  OwnerActionDefinition,
  OwnerProjectState,
} from './types'

// Phase 33 §33.4 / §33.5 — Project actions.
//
// Projects are long-running owner investments. Each `start_<project>`
// action stamps a new `OwnerProjectState` into `state.modules.ownerActions.projects`
// with a required progress count and an effects preview. The project
// progress hook (`endDay` in ownerActionsModule) advances active
// projects by one progress point per day; players may also spend extra
// action points via `fund_active_project` for a faster build.
//
// When a project completes the project tick applies a structural effect —
// adding a trait to the targeted area when the Phase 28 trait registry
// recognises it, otherwise leaving the effects preview as the canonical
// record. Phase 33 keeps the effect set deliberately modest so the
// machinery can be tested without smuggling Phase 34/35 work in.

const OK: ActionValidationResult = { ok: true }

function reject(code: string, reason: string): ActionValidationResult {
  return { ok: false, code, reason }
}

// Each starter definition is data: an id, a target area, a label, a
// progress requirement, an optional one-time coin cost, and an effects
// preview the report can surface before completion lands.
export type ProjectStarterDefinition = {
  id: string
  projectType: string
  label: string
  targetAreaId: string
  requiredProgress: number
  initialCoinCost: number
  tags: string[]
  effectsPreview: string[]
  /** Trait id added to the target area when the project completes.
   *  When omitted, the project still completes but only the effects
   *  preview record is preserved (acceptable: this lets the project
   *  system carry weight before every Phase 28 trait is wired). */
  addsTrait?: string
  /** Trait id removed from the target area when the project completes.
   *  Used by `rat_proof_storage` to scrub `pest_prone`. */
  removesTrait?: string
}

export const PROJECT_STARTERS: ProjectStarterDefinition[] = [
  {
    id: 'start_private_booths',
    projectType: 'private_booths',
    label: 'Start Private Booths',
    targetAreaId: 'main_room',
    requiredProgress: 5,
    initialCoinCost: 10,
    tags: ['project', 'main_room', 'merchants', 'private_booths'],
    effectsPreview: [
      'main_room gains private trait',
      'merchant comfort improves slightly',
    ],
    addsTrait: 'private',
  },
  {
    id: 'start_hearth_repair',
    projectType: 'repair_hearth',
    label: 'Start Hearth Repair',
    targetAreaId: 'main_room',
    requiredProgress: 4,
    initialCoinCost: 8,
    tags: ['project', 'main_room', 'cozy', 'repair_hearth'],
    effectsPreview: [
      'main_room gains cozy trait',
      'comfort improves on cold nights',
    ],
    addsTrait: 'cozy',
  },
  {
    id: 'start_rat_proof_storage',
    projectType: 'rat_proof_storage',
    label: 'Start Rat-Proof Storage',
    targetAreaId: 'cellar',
    requiredProgress: 5,
    initialCoinCost: 12,
    tags: ['project', 'cellar', 'pests', 'rat_proof_storage'],
    effectsPreview: [
      'cellar loses pest_prone trait',
      'stock spoilage risk falls',
    ],
    removesTrait: 'pest_prone',
  },
  {
    id: 'start_music_corner',
    projectType: 'music_corner',
    label: 'Start Music Corner',
    targetAreaId: 'main_room',
    requiredProgress: 4,
    initialCoinCost: 6,
    tags: ['project', 'main_room', 'music', 'music_corner'],
    effectsPreview: [
      'main_room gains music_friendly trait',
      'rowdy groups may visit more often',
    ],
    addsTrait: 'music_friendly',
  },
  {
    id: 'start_larger_stew_pot',
    projectType: 'larger_stew_pot',
    label: 'Start Larger Stew Pot',
    targetAreaId: 'kitchen',
    requiredProgress: 3,
    initialCoinCost: 8,
    tags: ['project', 'kitchen', 'food', 'larger_stew_pot'],
    effectsPreview: [
      'kitchen service capacity improves',
      'stew supply less likely to bottleneck',
    ],
  },
]

function findStarterByProjectType(
  projectType: string,
): ProjectStarterDefinition | undefined {
  return PROJECT_STARTERS.find((s) => s.projectType === projectType)
}

function projectInstanceIdFor(starter: ProjectStarterDefinition): string {
  // Project instance ids are stable across days so progress accumulates
  // on the same record. Players cannot start the same project twice;
  // they fund the existing instance instead.
  return `project:${starter.projectType}`
}

function activeProjectExists(
  ctx: SimContext,
  starter: ProjectStarterDefinition,
): boolean {
  const slice = getOwnerActionsModuleState(ctx.state)
  const id = projectInstanceIdFor(starter)
  const existing = slice.projects[id]
  return existing !== undefined && existing.status === 'active'
}

function listProjectTargets(_ctx: SimContext): ActionTarget[] {
  // Each start_* action defines its own intrinsic target; listing here
  // just surfaces the starter definitions so a future UI can render
  // the option set.
  return PROJECT_STARTERS.map((s) => ({
    id: s.id,
    label: s.label,
    hint: `target ${s.targetAreaId}, ${s.requiredProgress} progress`,
  }))
}

function buildStartProjectDefinition(
  starter: ProjectStarterDefinition,
): OwnerActionDefinition {
  return {
    id: starter.id,
    label: starter.label,
    category: 'project',
    tags: starter.tags,
    targetType: 'area',
    actionPointCost: 1,
    getValidTargets: () => [
      {
        id: starter.targetAreaId,
        label: starter.targetAreaId,
        hint: `requires ${starter.initialCoinCost} coin`,
      },
    ],
    canApply: (ctx) => {
      if (!ctx.state.areas[starter.targetAreaId]) {
        return reject(
          'unknown_target',
          `Project ${starter.id} requires area '${starter.targetAreaId}'`,
        )
      }
      if (activeProjectExists(ctx, starter)) {
        return reject(
          'project_already_active',
          `Project ${starter.projectType} is already active`,
        )
      }
      if (ctx.state.coin < starter.initialCoinCost) {
        return reject(
          'insufficient_coin',
          `Starting ${starter.label} costs ${starter.initialCoinCost} coin; only ${ctx.state.coin} available`,
        )
      }
      return OK
    },
    apply: (ctx): OwnerActionApplied => {
      const today = ctx.state.calendar.totalDaysElapsed
      const instanceId = projectInstanceIdFor(starter)
      const next: OwnerProjectState = {
        id: instanceId,
        projectType: starter.projectType,
        label: starter.label.replace(/^Start /, ''),
        targetType: 'area',
        targetId: starter.targetAreaId,
        startedAtDay: today,
        progress: 0,
        requiredProgress: starter.requiredProgress,
        coinInvested: starter.initialCoinCost,
        status: 'active',
        tags: [...starter.tags],
        effectsPreview: [...starter.effectsPreview],
      }
      writeProjectsSlice(ctx, { [instanceId]: next }, 'project_started')

      if (starter.initialCoinCost > 0) {
        spendCoin(ctx, starter.initialCoinCost, {
          source: `ownerActions.${starter.id}`,
          category: 'repair',
          tags: ['project', starter.projectType],
        })
      }

      ctx.addCause({
        source: `ownerActions.${starter.id}`,
        sourceType: 'owner_action',
        target: instanceId,
        targetType: 'area',
        amount: 1,
        readable: `Owner started project ${next.label}.`,
        tags: ['owner_action', 'project_started', starter.projectType, starter.targetAreaId],
        relatedLocations: [{ kind: 'area', id: starter.targetAreaId }],
        relatedSystems: ['ownerActions', 'projects'],
      })
      ctx.addHistory({
        category: 'owner_action',
        summary: `Owner started project ${next.label}.`,
        tags: ['owner_action', 'project_started', starter.projectType],
        relatedLocations: [{ kind: 'area', id: starter.targetAreaId }],
        relatedSystems: ['ownerActions', 'projects'],
        mechanicalRefs: [starter.id, instanceId],
      })

      return {
        actionId: starter.id,
        label: starter.label,
        targetId: starter.targetAreaId,
        actionPointCost: 1,
        effects: [
          `project ${starter.projectType} started`,
          `coin -${starter.initialCoinCost}`,
          ...starter.effectsPreview,
        ],
        data: {
          projectId: instanceId,
          projectType: starter.projectType,
          requiredProgress: starter.requiredProgress,
          coin: { spent: starter.initialCoinCost },
        },
      }
    },
  }
}

// ---------- fund_active_project ----------

const FUND_PROGRESS_PER_POINT = 1
const FUND_COIN_COST = 4

const fundActiveProject: OwnerActionDefinition = {
  id: 'fund_active_project',
  label: 'Fund Active Project',
  category: 'project',
  tags: ['project', 'fund'],
  targetType: 'project',
  actionPointCost: 1,
  getValidTargets: (ctx: SimContext) => {
    const slice = getOwnerActionsModuleState(ctx.state)
    return Object.values(slice.projects)
      .filter((p) => p.status === 'active')
      .map((p) => ({
        id: p.id,
        label: p.label,
        hint: `${p.progress}/${p.requiredProgress} progress`,
      }))
  },
  canApply: (ctx, input) => {
    if (!input.targetId) {
      return reject('missing_target', 'fund_active_project requires targetId')
    }
    const slice = getOwnerActionsModuleState(ctx.state)
    const project = slice.projects[input.targetId]
    if (!project) return reject('unknown_target', `Unknown project '${input.targetId}'`)
    if (project.status !== 'active') {
      return reject('not_active', `Project '${input.targetId}' is not active`)
    }
    if (ctx.state.coin < FUND_COIN_COST) {
      return reject(
        'insufficient_coin',
        `Funding costs ${FUND_COIN_COST} coin; only ${ctx.state.coin} available`,
      )
    }
    return OK
  },
  apply: (ctx, input): OwnerActionApplied => {
    const slice = getOwnerActionsModuleState(ctx.state)
    const project = slice.projects[input.targetId!]!
    const beforeProgress = project.progress
    const beforeCoin = project.coinInvested

    const updated: OwnerProjectState = {
      ...project,
      progress: project.progress + FUND_PROGRESS_PER_POINT,
      coinInvested: project.coinInvested + FUND_COIN_COST,
    }
    writeProjectsSlice(ctx, { [project.id]: updated }, 'project_funded')
    spendCoin(ctx, FUND_COIN_COST, {
      source: `ownerActions.fund_active_project.${project.projectType}`,
      category: 'repair',
      tags: ['project', 'fund', project.projectType],
    })

    return {
      actionId: fundActiveProject.id,
      label: `Funded ${project.label}`,
      targetId: project.id,
      actionPointCost: 1,
      effects: [
        `progress ${beforeProgress} → ${updated.progress}`,
        `coinInvested ${beforeCoin} → ${updated.coinInvested}`,
      ],
      data: {
        projectId: project.id,
        progress: { before: beforeProgress, after: updated.progress },
        coin: { spent: FUND_COIN_COST },
      },
    }
  },
}

// ---------- cancel_project ----------

const cancelProject: OwnerActionDefinition = {
  id: 'cancel_project',
  label: 'Cancel Project',
  category: 'project',
  tags: ['project', 'cancel'],
  targetType: 'project',
  actionPointCost: 1,
  getValidTargets: (ctx: SimContext) => {
    const slice = getOwnerActionsModuleState(ctx.state)
    return Object.values(slice.projects)
      .filter((p) => p.status === 'active')
      .map((p) => ({ id: p.id, label: p.label }))
  },
  canApply: (ctx, input) => {
    if (!input.targetId) {
      return reject('missing_target', 'cancel_project requires targetId')
    }
    const slice = getOwnerActionsModuleState(ctx.state)
    const project = slice.projects[input.targetId]
    if (!project) return reject('unknown_target', `Unknown project '${input.targetId}'`)
    if (project.status !== 'active') {
      return reject('not_active', `Project '${input.targetId}' is not active`)
    }
    return OK
  },
  apply: (ctx, input): OwnerActionApplied => {
    const slice = getOwnerActionsModuleState(ctx.state)
    const project = slice.projects[input.targetId!]!
    const updated: OwnerProjectState = { ...project, status: 'cancelled' }
    writeProjectsSlice(ctx, { [project.id]: updated }, 'project_cancelled')

    ctx.addHistory({
      category: 'owner_action',
      summary: `Owner cancelled project ${project.label}.`,
      tags: ['owner_action', 'project_cancelled', project.projectType],
      relatedSystems: ['ownerActions', 'projects'],
      mechanicalRefs: [project.id],
    })

    return {
      actionId: cancelProject.id,
      label: `Cancelled ${project.label}`,
      targetId: project.id,
      actionPointCost: 1,
      effects: [`project ${project.projectType} cancelled`],
      data: {
        projectId: project.id,
        progress: project.progress,
        requiredProgress: project.requiredProgress,
      },
    }
  },
}

// ---------- Exports ----------

export const PROJECT_ACTIONS: OwnerActionDefinition[] = [
  ...PROJECT_STARTERS.map(buildStartProjectDefinition),
  fundActiveProject,
  cancelProject,
]

export { findStarterByProjectType, projectInstanceIdFor }
