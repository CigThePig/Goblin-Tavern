// Phase 92 — Read-only ctx helpers for owner-action validation.
//
// Extracted from `web/src/lib/sim/actionBuilder.ts` so the report
// projection layer (and any future non-web caller) can ask the owner
// action registry "what are the valid targets for action X against the
// current state?" without spinning up a full SimContext.
//
// The shim proxies the read-only accessors definitions actually use
// (state, calendar shortcuts, the few entity-getter functions) and
// throws on every mutator. A definition that starts reaching for the
// heavier API gets a loud error rather than a silent wrong answer.
//
// Stays DOM-free — must remain importable from `src/reports/` and any
// other sim-adjacent layer. No browser globals, no nondeterministic RNG,
// no wall-clock reads.

import { actionRegistry } from "../../registries/actionRegistry";
import type { SimContext } from "../../core/context";
import type { TavernState } from "../../state/TavernState";
import type {
  ActionTarget,
  OwnerActionDefinition,
  OwnerActionInput,
} from "./types";

function makeReadOnlyCtx(state: TavernState): SimContext {
  const refuse = (name: string) => () => {
    throw new Error(`readonlyHelpers: readonly ctx — '${name}' not supported`);
  };
  const ctx = {
    state,
    input: { seed: "readonly" },
    rng: {} as never,
    rngStreams: {} as never,
    getRngStream: refuse("getRngStream"),
    getRngStreamByName: refuse("getRngStreamByName"),
    reports: [],
    logs: [],
    addReportSection: refuse("addReportSection"),
    addLog: refuse("addLog"),
    getDayType: () => state.calendar.dayType,
    isEndOfWeek: () => false,
    isEndOfMonth: () => false,
    validate: refuse("validate"),
    modifyArea: refuse("modifyArea"),
    modifyStock: refuse("modifyStock"),
    modifyStaff: refuse("modifyStaff"),
    addStaff: refuse("addStaff"),
    removeStaff: refuse("removeStaff"),
    modifyCustomerGroup: refuse("modifyCustomerGroup"),
    modifyRecipe: refuse("modifyRecipe"),
    modifyExpeditions: refuse("modifyExpeditions"),
    modifyCoin: refuse("modifyCoin"),
    modifyReputation: refuse("modifyReputation"),
    modifyModuleState: refuse("modifyModuleState"),
    modifyCulture: refuse("modifyCulture"),
    modifyFaction: refuse("modifyFaction"),
    modifySupplier: refuse("modifySupplier"),
    modifyRegular: refuse("modifyRegular"),
    modifyNotableNpc: refuse("modifyNotableNpc"),
    modifyHireableAdventurer: refuse("modifyHireableAdventurer"),
    addHireableAdventurer: refuse("addHireableAdventurer"),
    removeHireableAdventurer: refuse("removeHireableAdventurer"),
    addRegular: refuse("addRegular"),
    removeRegular: refuse("removeRegular"),
    addSocialRumour: refuse("addSocialRumour"),
    addLocalEvent: refuse("addLocalEvent"),
    modifyLocalEvent: refuse("modifyLocalEvent"),
    modifySocialRumour: refuse("modifySocialRumour"),
    modifyTavernIdentity: refuse("modifyTavernIdentity"),
    getCulture: (id: string) => state.world.cultures[id],
    getFaction: (id: string) => state.world.factions[id],
    getSupplier: (id: string) => state.world.suppliers[id],
    getRegular: (id: string) => state.world.regulars[id],
    getNotableNpc: (id: string) => state.world.notableNpcs[id],
    getLocalEvent: (id: string) => state.world.localEvents[id],
    getSocialRumour: (id: string) => state.world.socialRumours[id],
    addMemory: refuse("addMemory"),
    addEntityMemory: refuse("addEntityMemory"),
    removeMemory: refuse("removeMemory"),
    hasMemory: (id: string) => state.memories.some((m) => m.id === id),
    getMemory: (id: string) => state.memories.find((m) => m.id === id),
    getMemoriesByTag: (tag: string) =>
      state.memories.filter((m) => m.tags.includes(tag)),
    getMemoriesForActor: refuse("getMemoriesForActor"),
    getMemoriesForLocation: refuse("getMemoriesForLocation"),
    getMemoryStrength: refuse("getMemoryStrength"),
    ageMemoriesEndOfDay: refuse("ageMemoriesEndOfDay"),
    addHistory: refuse("addHistory"),
    getRecentHistory: refuse("getRecentHistory"),
    getHistoryByTag: refuse("getHistoryByTag"),
    pruneHistoryBefore: refuse("pruneHistoryBefore"),
    addCause: refuse("addCause"),
    getCausesForTarget: (target: string) =>
      state.causes.filter((c) => c.target === target),
    getCausesByTag: (tag: string) =>
      state.causes.filter((c) => c.tags.includes(tag)),
    getRecentCauses: refuse("getRecentCauses"),
    getTopCausesForTarget: refuse("getTopCausesForTarget"),
    ageCausesEndOfDay: refuse("ageCausesEndOfDay"),
    modifyPressure: refuse("modifyPressure"),
    addVenture: refuse("addVenture"),
    modifyVenture: refuse("modifyVenture"),
    modifyArc: refuse("modifyArc"),
    modifyTransformation: refuse("modifyTransformation"),
    getDiff: () => undefined,
    getDiffs: () => [],
    getDiffSoFar: () => undefined,
  } satisfies SimContext;
  return ctx;
}

export { makeReadOnlyCtx };

export function listValidTargets(
  def: OwnerActionDefinition,
  state: TavernState,
): ActionTarget[] {
  try {
    return def.getValidTargets(makeReadOnlyCtx(state));
  } catch (err) {
    if (typeof console !== "undefined") {
      console.warn(
        `readonlyHelpers: getValidTargets('${def.id}') threw — falling back to empty list`,
        err,
      );
    }
    return [];
  }
}

export function canApplyAction(
  def: OwnerActionDefinition,
  state: TavernState,
  input: OwnerActionInput,
): { ok: true } | { ok: false; reason: string } {
  try {
    const result = def.canApply(makeReadOnlyCtx(state), input);
    if (result.ok) return { ok: true };
    return { ok: false, reason: result.reason };
  } catch (err) {
    return { ok: false, reason: (err as Error).message };
  }
}

/**
 * Reason an action should be disabled in a picker UI, or `undefined` if
 * it's selectable. Mirrors the engine's applyOwnerActions validation so
 * the UI doesn't silently queue actions the engine will reject.
 *
 * Order: budget first (cheapest, blocks before any canApply call); then
 * for global / target-less defs run canApply once; for targeted defs
 * require at least one target for which canApply succeeds — surfacing
 * the first rejection reason when every target fails for the same
 * cause.
 */
export function actionDisabledReason(
  def: OwnerActionDefinition,
  state: TavernState,
  pointsLeft: number,
): string | undefined {
  if (def.timeCost > pointsLeft) return "budget full";

  if (!def.targetType || def.targetType === "global") {
    const verdict = canApplyAction(def, state, { actionId: def.id });
    return verdict.ok ? undefined : verdict.reason;
  }

  const targets = listValidTargets(def, state);
  if (targets.length === 0) return "no valid targets";

  let firstReason: string | undefined;
  for (const t of targets) {
    const verdict = canApplyAction(def, state, {
      actionId: def.id,
      targetId: t.id,
    });
    if (verdict.ok) return undefined;
    if (firstReason === undefined) firstReason = verdict.reason;
  }
  return firstReason ?? "cannot apply now";
}

/**
 * Reason a specific (action, target) pair is currently invalid, or
 * `undefined` if it's selectable. Used by Tavern panels that have a
 * concrete target already (the area in front of you, the staff member
 * being inspected) and want to know whether the matching action can
 * actually run.
 */
export function actionDisabledReasonForTarget(
  def: OwnerActionDefinition,
  state: TavernState,
  targetId: string | undefined,
  pointsLeft: number,
): string | undefined {
  if (def.timeCost > pointsLeft) return "budget full";

  if (!def.targetType || def.targetType === "global") {
    const verdict = canApplyAction(def, state, { actionId: def.id });
    return verdict.ok ? undefined : verdict.reason;
  }

  if (!targetId) return "no target";

  const targets = listValidTargets(def, state);
  if (!targets.some((t) => t.id === targetId)) return "invalid target";

  const verdict = canApplyAction(def, state, { actionId: def.id, targetId });
  return verdict.ok ? undefined : verdict.reason;
}

/**
 * All owner-action definitions whose targetType matches the given kind
 * and whose getValidTargets includes the given targetId. The Tavern
 * panels use this to surface row-level quick actions.
 */
export function applicableActionsForTarget(
  state: TavernState,
  targetType: OwnerActionDefinition["targetType"],
  targetId: string,
): OwnerActionDefinition[] {
  return actionRegistry
    .all()
    .filter((def) => def.targetType === targetType)
    .filter((def) => {
      const targets = listValidTargets(def, state);
      return targets.some((t) => t.id === targetId);
    });
}
