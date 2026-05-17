// Phase 88 — Owner-action picker support.
//
// Wraps the actionRegistry so the UI can:
//   - list available actions by category,
//   - query a definition's valid targets against the current state
//     (cheap memoization on a state-version key — recomputed every day
//     since most state mutations affect target validity),
//   - format a SimInputOwnerAction for `gameStore.runDay`,
//   - track the running action-point total so the 3-point cap can be
//     enforced before submission.
//
// The engine validates again on `applyOwnerActions`; the UI layer is
// belt-and-suspenders, not the source of truth.

import {
  actionRegistry,
  type OwnerActionDefinition,
} from '../../../../src/sim/registries/actionRegistry'
import type {
  ActionTarget,
  OwnerActionCategory,
  OwnerActionInput,
} from '../../../../src/sim/modules/ownerActions/types'
import type { SimContext, SimInputOwnerAction } from '../../../../src/sim/core/context'
import type { TavernState } from '../../../../src/sim/state/TavernState'

export const ACTION_POINT_BUDGET = 3

export type PickedAction = {
  /** Unique per pick; the picker uses this to dedupe and remove. */
  pickId: string
  actionId: string
  label: string
  category: OwnerActionCategory
  targetType: OwnerActionDefinition['targetType']
  targetId?: string
  targetLabel?: string
  actionPointCost: number
}

let pickIdCounter = 0
export function nextPickId(): string {
  pickIdCounter += 1
  return `pick-${Date.now().toString(36)}-${pickIdCounter.toString(36)}`
}

export function listActionsByCategory(
  category: OwnerActionCategory,
): OwnerActionDefinition[] {
  return actionRegistry
    .all()
    .filter((a) => a.category === category)
    .sort((a, b) => a.label.localeCompare(b.label))
}

export function getActionCategories(): OwnerActionCategory[] {
  return ['immediate', 'project', 'policy', 'social']
}

/**
 * Cheap shim that gives action definitions a `getValidTargets`-callable
 * context without spinning up a full `SimContext`. The owner-action
 * definitions only read `ctx.state` (and a couple of metadata accessors)
 * from `getValidTargets`; we proxy those and throw on anything else so
 * a regression that starts using the heavier API surface is loud.
 */
function makeReadOnlyCtx(state: TavernState): SimContext {
  const refuse = (name: string) => () => {
    throw new Error(`actionBuilder: readonly ctx — '${name}' not supported`)
  }
  // The cast is intentional: this is a UI-only shim. The owner-action
  // definitions whose `getValidTargets` we want to call only touch
  // `state`, the calendar accessors, and (rarely) `getMemoriesByTag`.
  // Everything else throws so any future drift is caught loudly.
  const ctx = {
    state,
    input: { seed: 'ui-readonly' },
    rng: {} as never,
    rngStreams: {} as never,
    getRngStream: refuse('getRngStream'),
    getRngStreamByName: refuse('getRngStreamByName'),
    reports: [],
    logs: [],
    addReportSection: refuse('addReportSection'),
    addLog: refuse('addLog'),
    getDayType: () => state.calendar.dayType,
    isEndOfWeek: () => false,
    isEndOfMonth: () => false,
    validate: refuse('validate'),
    modifyArea: refuse('modifyArea'),
    modifyStock: refuse('modifyStock'),
    modifyStaff: refuse('modifyStaff'),
    addStaff: refuse('addStaff'),
    removeStaff: refuse('removeStaff'),
    modifyCustomerGroup: refuse('modifyCustomerGroup'),
    modifyRecipe: refuse('modifyRecipe'),
    modifyExpeditions: refuse('modifyExpeditions'),
    modifyCoin: refuse('modifyCoin'),
    modifyReputation: refuse('modifyReputation'),
    modifyModuleState: refuse('modifyModuleState'),
    modifyCulture: refuse('modifyCulture'),
    modifyFaction: refuse('modifyFaction'),
    modifySupplier: refuse('modifySupplier'),
    modifyRegular: refuse('modifyRegular'),
    modifyNotableNpc: refuse('modifyNotableNpc'),
    modifyHireableAdventurer: refuse('modifyHireableAdventurer'),
    addHireableAdventurer: refuse('addHireableAdventurer'),
    removeHireableAdventurer: refuse('removeHireableAdventurer'),
    modifyLocalEvent: refuse('modifyLocalEvent'),
    modifySocialRumour: refuse('modifySocialRumour'),
    modifyTavernIdentity: refuse('modifyTavernIdentity'),
    getCulture: (id: string) => state.world.cultures[id],
    getFaction: (id: string) => state.world.factions[id],
    getSupplier: (id: string) => state.world.suppliers[id],
    getRegular: (id: string) => state.world.regulars[id],
    getNotableNpc: (id: string) => state.world.notableNpcs[id],
    getLocalEvent: (id: string) => state.world.localEvents[id],
    getSocialRumour: (id: string) => state.world.socialRumours[id],
    addMemory: refuse('addMemory'),
    addEntityMemory: refuse('addEntityMemory'),
    removeMemory: refuse('removeMemory'),
    hasMemory: (id: string) => state.memories.some((m) => m.id === id),
    getMemory: (id: string) => state.memories.find((m) => m.id === id),
    getMemoriesByTag: (tag: string) =>
      state.memories.filter((m) => m.tags.includes(tag)),
    getMemoriesForActor: refuse('getMemoriesForActor'),
    getMemoriesForLocation: refuse('getMemoriesForLocation'),
    getMemoryStrength: refuse('getMemoryStrength'),
    ageMemoriesEndOfDay: refuse('ageMemoriesEndOfDay'),
    addHistory: refuse('addHistory'),
    getRecentHistory: refuse('getRecentHistory'),
    getHistoryByTag: refuse('getHistoryByTag'),
    pruneHistoryBefore: refuse('pruneHistoryBefore'),
    addCause: refuse('addCause'),
    getCausesForTarget: (target: string) =>
      state.causes.filter((c) => c.target === target),
    getCausesByTag: (tag: string) =>
      state.causes.filter((c) => c.tags.includes(tag)),
    getRecentCauses: refuse('getRecentCauses'),
    getTopCausesForTarget: refuse('getTopCausesForTarget'),
    ageCausesEndOfDay: refuse('ageCausesEndOfDay'),
    modifyPressure: refuse('modifyPressure'),
    getDiff: () => undefined,
    getDiffs: () => [],
  } satisfies SimContext
  return ctx
}

export function listValidTargets(
  def: OwnerActionDefinition,
  state: TavernState,
): ActionTarget[] {
  try {
    return def.getValidTargets(makeReadOnlyCtx(state))
  } catch (err) {
    // Some action definitions reach for ctx APIs the UI shim refuses.
    // Failing soft is better than blocking the picker.
    if (typeof console !== 'undefined') {
      console.warn(
        `actionBuilder: getValidTargets('${def.id}') threw — falling back to empty target list`,
        err,
      )
    }
    return []
  }
}

export function canApplyAction(
  def: OwnerActionDefinition,
  state: TavernState,
  input: OwnerActionInput,
): { ok: true } | { ok: false; reason: string } {
  try {
    const result = def.canApply(makeReadOnlyCtx(state), input)
    if (result.ok) return { ok: true }
    return { ok: false, reason: result.reason }
  } catch (err) {
    return { ok: false, reason: (err as Error).message }
  }
}

export function picksToInputs(
  picks: ReadonlyArray<PickedAction>,
): SimInputOwnerAction[] {
  return picks.map((p) => {
    const input: SimInputOwnerAction = { actionId: p.actionId }
    if (p.targetId !== undefined) input.targetId = p.targetId
    return input
  })
}

export function totalActionPoints(picks: ReadonlyArray<PickedAction>): number {
  return picks.reduce((n, p) => n + p.actionPointCost, 0)
}

export function categoryLabel(c: OwnerActionCategory): string {
  switch (c) {
    case 'immediate':
      return 'Immediate'
    case 'project':
      return 'Projects'
    case 'policy':
      return 'Policies'
    case 'social':
      return 'Social'
  }
}
