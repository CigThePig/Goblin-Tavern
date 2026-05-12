import type { SimContext } from '../../core/context'

import {
  PROJECT_STARTERS,
  findStarterByProjectType,
  type ProjectStarterDefinition,
} from './projectActions'
import {
  getOwnerActionsModuleState,
  writeProjectsSlice,
} from './stateHelpers'
import type { OwnerProjectState } from './types'

// Phase 33 §33.5 — Project progress tick.
//
// Runs from the owner-actions module's `endDay` hook so today's funding
// actions are already on state. Every active project gains
// `PASSIVE_PROGRESS_PER_DAY` progress. Projects whose progress crosses
// `requiredProgress` complete and apply their structural effect: the
// matching Phase 28 trait is added to (or removed from) the target
// area, and a memory/cause pair is recorded.
//
// The plan (Phase 33 §33.5) keeps the rule deliberately simple: 1 point
// per day, no per-staff modifiers. Phase 38+ will add the richer
// project-blocking logic.

const PASSIVE_PROGRESS_PER_DAY = 1

function buildEffectsAndApply(
  ctx: SimContext,
  project: OwnerProjectState,
  starter: ProjectStarterDefinition,
): string[] {
  const effects: string[] = []
  const areaId = starter.targetAreaId
  const area = ctx.state.areas[areaId]
  if (!area) return effects

  let nextTraits = area.traits

  if (starter.addsTrait && !area.traits.includes(starter.addsTrait)) {
    nextTraits = [...nextTraits, starter.addsTrait]
    effects.push(`${areaId} gained trait ${starter.addsTrait}`)
  }
  if (starter.removesTrait && area.traits.includes(starter.removesTrait)) {
    nextTraits = nextTraits.filter((t) => t !== starter.removesTrait)
    effects.push(`${areaId} lost trait ${starter.removesTrait}`)
  }

  if (nextTraits !== area.traits) {
    ctx.modifyArea(
      areaId,
      { traits: nextTraits },
      {
        source: `ownerActions.project.${project.projectType}.complete`,
        reason: 'project_completed',
        target: `area:${areaId}.traits`,
        targetType: 'area',
        readable: `Project ${project.label} reshaped ${areaId}.`,
        tags: ['owner_action', 'project_completed', project.projectType, areaId],
        relatedLocations: [{ kind: 'area', id: areaId }],
        relatedSystems: ['areas', 'ownerActions'],
      },
    )
  }

  return effects
}

export function tickProjects(ctx: SimContext): void {
  const slice = getOwnerActionsModuleState(ctx.state)
  const projects = slice.projects
  const updates: Record<string, OwnerProjectState> = {}

  for (const project of Object.values(projects)) {
    if (project.status !== 'active') continue

    const advanced: OwnerProjectState = {
      ...project,
      progress: project.progress + PASSIVE_PROGRESS_PER_DAY,
    }

    if (advanced.progress >= advanced.requiredProgress) {
      const starter = findStarterByProjectType(project.projectType)
      const completed: OwnerProjectState = {
        ...advanced,
        progress: advanced.requiredProgress,
        status: 'completed',
      }
      updates[project.id] = completed

      let appliedEffects: string[] = []
      if (starter) {
        appliedEffects = buildEffectsAndApply(ctx, completed, starter)
      }

      ctx.addCause({
        source: `ownerActions.project.${project.projectType}.complete`,
        sourceType: 'owner_action',
        target: project.id,
        targetType: project.targetType === 'area' ? 'area' : 'global',
        amount: 1,
        readable: `Project ${project.label} completed.`,
        tags: ['owner_action', 'project_completed', project.projectType],
        relatedSystems: ['ownerActions', 'projects'],
      })
      ctx.addMemory({
        id: 'project_completed_recently',
        source: `ownerActions.project.${project.projectType}.complete`,
        ...(project.targetId
          ? { locations: [{ kind: 'area', id: project.targetId }] }
          : {}),
        metadata: {
          projectId: project.id,
          projectType: project.projectType,
          appliedEffects,
        },
      })
      ctx.addHistory({
        category: 'owner_action',
        summary: `Project ${project.label} completed.`,
        tags: ['owner_action', 'project_completed', project.projectType],
        ...(project.targetId
          ? { relatedLocations: [{ kind: 'area', id: project.targetId }] }
          : {}),
        relatedSystems: ['ownerActions', 'projects'],
        mechanicalRefs: [project.id, project.projectType],
      })
    } else {
      updates[project.id] = advanced
    }
  }

  if (Object.keys(updates).length > 0) {
    writeProjectsSlice(ctx, updates, 'project_progress_tick')
  }
}

export { PROJECT_STARTERS, PASSIVE_PROGRESS_PER_DAY }
