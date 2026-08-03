import type { EffectPreview, EffectResult } from "../../core/effect";
import type {
  AreaState,
  CalendarStamp,
  CauseEntry,
  CustomerGroupState,
  MemoryState,
  ReputationState,
  StaffState,
  StockState,
  TavernState,
  TeleologyEntry,
  TransformationState,
} from "../../state/TavernState";
import type { MemoryDraft } from "../memories/memoryTypes";
import type { CoinLedgerEntry, StockModuleState } from "../stock/types";
import type { RentState } from "../monthly/types";
import {
  MONTHLY_MODULE_ID,
  RENT_PAYMENT_EFFECT_TARGET,
} from "../monthly/types";
import { LOAN_BORROW_EFFECT_TARGET } from "../finance/types";

import type {
  EffectApplier,
  ApplyOrigin,
  ApplierLog,
} from "./applyResponseProfile";
import type { PendingResponseEntry, ResponsesModuleState } from "./types";
import {
  RESPONSES_MODULE_ID,
  createInitialResponsesModuleState,
} from "./types";
import { makePendingId } from "./pendingHelpers";
import { getVentureBlueprint } from "../ventures/ventureCatalog";
import {
  OWNER_ACTIONS_MODULE_ID,
  getOwnerActionsModuleState,
} from "../ownerActions/stateHelpers";

// Phase 41 / ISSUE-001 — pure-resolver applier.
//
// Mutates a passed-in cloned TavernState directly. Designed for the
// pure `resolveResponseIntent` transform: tests, debug runners, and
// future preview drivers. The mutations mirror the engine path — same
// dispatch table, same scheduling derivation — but do not go through
// ctx helpers, so the resulting state is self-consistent but does not
// also emit causes through the cause module's `endDay` aging pass
// (those are appended directly to `state.causes`).
//
// Stacking strategy for memory: the pure resolver appends a stamped
// `MemoryState` directly. Full stacking dispatch (replace / refresh /
// increase_strength / stack) is the engine path's responsibility via
// `ctx.addMemory`.

const CLAMP_MIN = 0;
const CLAMP_MAX = 100;

function clamp(value: number, lo = CLAMP_MIN, hi = CLAMP_MAX): number {
  return Math.max(lo, Math.min(hi, value));
}

function stampOf(state: TavernState): CalendarStamp {
  return {
    year: state.calendar.year,
    month: state.calendar.month,
    week: state.calendar.week,
    day: state.calendar.day,
    absoluteDay: state.calendar.totalDaysElapsed,
  };
}

function ensureResponsesSlice(state: TavernState): ResponsesModuleState {
  const modules = state.modules as Record<string, unknown>;
  const current = modules[RESPONSES_MODULE_ID] as
    | ResponsesModuleState
    | undefined;
  if (current) return current;
  const fresh = createInitialResponsesModuleState();
  modules[RESPONSES_MODULE_ID] = fresh;
  return fresh;
}

function appendCoinLedgerEntry(
  state: TavernState,
  entry: CoinLedgerEntry,
): void {
  const slice = (state.modules.stock as StockModuleState | undefined) ?? {
    ledger: [],
    shortages: [],
  };
  state.modules = {
    ...state.modules,
    stock: {
      ...slice,
      ledger: [...slice.ledger, entry],
    },
  };
}

function applyStateChange(
  state: TavernState,
  preview: EffectPreview,
  source: string,
): EffectResult {
  const amount = preview.amount ?? 0;
  const path = preview.target;

  // Phase 200 / audit Wave 1 (`P7-EXP-001`) — mirror of the engine
  // applier's rent branch, so the pure resolver's preview of a rent
  // payment matches what the engine actually does.
  //
  // Expansion Phase 7 §7.2 — the engine's branch now allows a PART payment,
  // because the tenancy's notice ladder names "a part payment delays the
  // next step" as a remedy. This mirror pays what the till can reach rather
  // than refusing anything short of the full amount, so the two still
  // agree. It works off `modules.monthly.rent`, which is the tenancy
  // module's own projection of the live rent obligations — the pure
  // resolver has no `SimContext` and so cannot walk the obligation ledger,
  // and the projection is exactly the summary it needs.
  if (path === RENT_PAYMENT_EFFECT_TARGET) {
    const monthly = state.modules[MONTHLY_MODULE_ID] as
      | { rent?: RentState }
      | undefined;
    const rent = monthly?.rent;
    if (!rent) {
      return { ...preview, applied: false, notes: ["no rent state"] };
    }
    if (rent.paidThisMonth && rent.arrears <= 0) {
      return { ...preview, applied: false, notes: ["rent already settled"] };
    }
    const amountDue = rent.monthlyAmount + rent.arrears;
    const paid = Math.min(amountDue, state.coin);
    if (paid <= 0) {
      return {
        ...preview,
        applied: false,
        notes: [`rent payment needs coin; ${state.coin} on hand`],
      };
    }
    state.coin -= paid;
    appendCoinLedgerEntry(state, {
      source,
      amount: -paid,
      category: "rent",
      tags: ["response", "rent"],
    });
    // Oldest debt first, matching `payRent`: arrears are cleared before the
    // current month, so a part payment shows up where the ladder reads it.
    const arrearsPaid = Math.min(paid, rent.arrears);
    const currentPaid = paid - arrearsPaid;
    state.modules = {
      ...state.modules,
      [MONTHLY_MODULE_ID]: {
        ...(monthly as object),
        rent: {
          ...rent,
          arrears: rent.arrears - arrearsPaid,
          paidThisMonth: currentPaid >= rent.monthlyAmount,
        },
      },
    };
    return { ...preview, amount: -paid, applied: true };
  }

  // Expansion Phase 7 §7.1 — mirror of the engine applier's borrow branch.
  //
  // The pure resolver has no `SimContext` and so cannot open a loan record;
  // what it CAN do is predict the coin honestly, which is what a preview is
  // for. The engine's branch is the one that creates the agreement.
  if (path === LOAN_BORROW_EFFECT_TARGET) {
    const principal = Math.max(0, amount);
    if (principal <= 0) {
      return { ...preview, applied: false, notes: ["nothing to borrow"] };
    }
    state.coin += principal;
    appendCoinLedgerEntry(state, {
      source,
      amount: principal,
      category: "other",
      tags: ["response", "loan", "loan_proceeds"],
    });
    return { ...preview, amount: principal, applied: true };
  }

  if (path === "coin") {
    const before = state.coin;
    const next = Math.max(0, before + amount);
    const applied = next - before;
    state.coin = next;
    if (applied !== 0) {
      appendCoinLedgerEntry(state, {
        source,
        amount: applied,
        category: "other",
        tags: ["response"],
      });
    }
    return { ...preview, applied: true };
  }

  if (path.startsWith("policies.")) {
    const [, id, field] = path.split(".");
    if (!id) {
      return { ...preview, applied: false, notes: ["missing policy id"] };
    }
    if (field !== "enabled") {
      return {
        ...preview,
        applied: false,
        notes: [`unsupported policy field ${field}`],
      };
    }
    const ownerActions = getOwnerActionsModuleState(state);
    const policy = ownerActions.policies[id];
    if (!policy) {
      return { ...preview, applied: false, notes: [`unknown policy ${id}`] };
    }
    state.modules = {
      ...state.modules,
      [OWNER_ACTIONS_MODULE_ID]: {
        ...ownerActions,
        policies: {
          ...ownerActions.policies,
          [id]: { ...policy, enabled: amount > 0 },
        },
      },
    };
    return { ...preview, applied: true };
  }

  if (path.startsWith("areas.")) {
    const [, id, field] = path.split(".") as [string, string, keyof AreaState];
    const area = state.areas[id];
    if (!area)
      return { ...preview, applied: false, notes: [`unknown area ${id}`] };
    if (typeof area[field] === "number") {
      const isClamped =
        field === "condition" ||
        field === "cleanliness" ||
        field === "mess" ||
        field === "damage" ||
        field === "smell" ||
        field === "risk";
      const next = (area[field] as number) + amount;
      (area as Record<string, unknown>)[field] = isClamped ? clamp(next) : next;
      return { ...preview, applied: true };
    }
    return {
      ...preview,
      applied: false,
      notes: [`unsupported area field ${field}`],
    };
  }

  if (path.startsWith("stock.")) {
    const [, id, field] = path.split(".") as [string, string, keyof StockState];
    const item = state.stock[id];
    if (!item)
      return { ...preview, applied: false, notes: [`unknown stock ${id}`] };
    if (field === "quantity") {
      item.quantity = Math.max(0, item.quantity + amount);
      return { ...preview, applied: true };
    }
    if (field === "quality" || field === "spoilage") {
      item[field] = clamp(item[field] + amount);
      return { ...preview, applied: true };
    }
    if (field === "salePrice" || field === "basePrice") {
      item[field] = Math.max(0, item[field] + amount);
      return { ...preview, applied: true };
    }
    return {
      ...preview,
      applied: false,
      notes: [`unsupported stock field ${field}`],
    };
  }

  if (path.startsWith("staff.")) {
    const [, id, field] = path.split(".") as [string, string, keyof StaffState];
    const member = state.staff[id];
    if (!member)
      return { ...preview, applied: false, notes: [`unknown staff ${id}`] };
    if (
      field === "morale" ||
      field === "stress" ||
      field === "fatigue" ||
      field === "loyalty" ||
      field === "skill"
    ) {
      member[field] = clamp((member[field] as number) + amount);
      return { ...preview, applied: true };
    }
    return {
      ...preview,
      applied: false,
      notes: [`unsupported staff field ${field}`],
    };
  }

  if (path.startsWith("customers.")) {
    const [, id, field] = path.split(".") as [
      string,
      string,
      keyof CustomerGroupState,
    ];
    const group = state.customerGroups[id];
    if (!group)
      return { ...preview, applied: false, notes: [`unknown customer ${id}`] };
    if (
      field === "satisfaction" ||
      field === "patronage" ||
      field === "loyalty" ||
      field === "rowdiness"
    ) {
      group[field] = clamp((group[field] as number) + amount);
      return { ...preview, applied: true };
    }
    return {
      ...preview,
      applied: false,
      notes: [`unsupported customer field ${field}`],
    };
  }

  if (path.startsWith("ventures.")) {
    const [, id, field] = path.split(".") as [
      string,
      string,
      keyof TeleologyEntry | "spawn",
    ];
    // Teleology Phase 2 — spawn the venture for this blueprint when an
    // opening's "pursue" response commits. Mirrors the engine-path applier.
    if (field === "spawn") {
      if (state.ventures[id]) return { ...preview, applied: true };
      const blueprint = getVentureBlueprint(id);
      if (!blueprint)
        return {
          ...preview,
          applied: false,
          notes: [`unknown venture blueprint ${id}`],
        };
      state.ventures[id] = blueprint.createEntry(state.calendar.totalDaysElapsed);
      return { ...preview, applied: true };
    }
    const entry = state.ventures[id];
    if (!entry)
      return { ...preview, applied: false, notes: [`unknown venture ${id}`] };
    if (field === "progress") {
      entry.progress = Math.max(0, entry.progress + amount);
      entry.updatedAtDay = state.calendar.totalDaysElapsed;
      return { ...preview, applied: true };
    }
    if (field === "stage" || field === "status") {
      const value = preview.tags
        .find((tag) => tag.startsWith(`${String(field)}:`))
        ?.slice(String(field).length + 1);
      if (!value)
        return {
          ...preview,
          applied: false,
          notes: [`missing ${String(field)} tag`],
        };
      (entry as Record<string, unknown>)[field] = value;
      entry.updatedAtDay = state.calendar.totalDaysElapsed;
      return { ...preview, applied: true };
    }
    return {
      ...preview,
      applied: false,
      notes: [`unsupported venture field ${String(field)}`],
    };
  }

  if (path.startsWith("arcs.")) {
    const [, id, field] = path.split(".") as [
      string,
      string,
      keyof TeleologyEntry,
    ];
    const entry = state.arcs[id];
    if (!entry)
      return { ...preview, applied: false, notes: [`unknown arc ${id}`] };
    if (field === "progress") {
      entry.progress = Math.max(0, entry.progress + amount);
      entry.updatedAtDay = state.calendar.totalDaysElapsed;
      return { ...preview, applied: true };
    }
    if (field === "stage" || field === "status") {
      const value = preview.tags
        .find((tag) => tag.startsWith(`${String(field)}:`))
        ?.slice(String(field).length + 1);
      if (!value)
        return {
          ...preview,
          applied: false,
          notes: [`missing ${String(field)} tag`],
        };
      (entry as Record<string, unknown>)[field] = value;
      entry.updatedAtDay = state.calendar.totalDaysElapsed;
      return { ...preview, applied: true };
    }
    return {
      ...preview,
      applied: false,
      notes: [`unsupported arc field ${String(field)}`],
    };
  }

  if (path.startsWith("transformations.")) {
    const [, id, field] = path.split(".") as [
      string,
      string,
      keyof TransformationState,
    ];
    if (field !== "active")
      return {
        ...preview,
        applied: false,
        notes: [`unsupported transformation field ${String(field)}`],
      };
    const existing = state.transformations[id];
    state.transformations[id] = {
      id,
      label: existing?.label ?? id,
      active: amount >= 0,
      tags: existing?.tags ?? [],
      createdAtDay: existing?.createdAtDay ?? state.calendar.totalDaysElapsed,
      ...(amount >= 0
        ? { activatedAtDay: state.calendar.totalDaysElapsed }
        : {}),
    };
    return { ...preview, applied: true };
  }

  if (path.startsWith("reputation.")) {
    const [, axis] = path.split(".") as [string, keyof ReputationState];
    const current = state.reputation[axis];
    if (current === undefined) {
      return {
        ...preview,
        applied: false,
        notes: [`unknown reputation axis ${String(axis)}`],
      };
    }
    state.reputation[axis] = clamp((current as number) + amount);
    return { ...preview, applied: true };
  }

  return { ...preview, applied: false, notes: [`unsupported target ${path}`] };
}

function applyPressure(
  state: TavernState,
  preview: EffectPreview,
): EffectResult {
  const amount = preview.amount ?? 0;
  const id = preview.target.replace(/^pressure:/, "");
  const existing = state.pressures[id];
  if (!existing) {
    return { ...preview, applied: false, notes: [`unknown pressure ${id}`] };
  }
  const next = clamp(existing.value + amount);
  state.pressures[id] = {
    ...existing,
    value: next,
    trend: amount > 0 ? 1 : amount < 0 ? -1 : 0,
  };
  return { ...preview, applied: true };
}

function applyCauseEffect(
  state: TavernState,
  preview: EffectPreview,
  origin: ApplyOrigin,
): EffectResult {
  const amount = preview.amount ?? 0;
  const direction: CauseEntry["direction"] =
    amount > 0 ? "increase" : amount < 0 ? "decrease" : "neutral";
  const stamp = stampOf(state);
  const cause: CauseEntry = {
    id: `response-${stamp.absoluteDay}-${origin.intentId}-${state.causes.length}`,
    timestamp: stamp,
    source: `response.${origin.verb}`,
    sourceType: "system",
    target: preview.target,
    targetType: "global",
    amount,
    direction,
    weight: Math.abs(amount),
    readable: preview.readable,
    tags: ["response", ...preview.tags],
    relatedActors: [],
    relatedLocations: [],
    relatedSystems: [],
    ageDays: 0,
  };
  state.causes = [...state.causes, cause];
  return { ...preview, applied: true, notes: ["cause emitted"] };
}

function synthesizeMemoryState(
  draft: MemoryDraft,
  stamp: CalendarStamp,
  source: string,
): MemoryState {
  const out: MemoryState = {
    id: draft.id,
    type: (draft.type ?? "fact") as MemoryState["type"],
    strength: draft.strength ?? 50,
    ageDays: 0,
    createdAt: stamp,
    actors: draft.actors ? [...draft.actors] : [],
    locations: draft.locations ? [...draft.locations] : [],
    relatedSystems: draft.relatedSystems ? [...draft.relatedSystems] : [],
    tags: draft.tags ? [...draft.tags] : [],
    source: draft.source ?? source,
  };
  if (draft.label !== undefined) out.label = draft.label;
  if (draft.durationDays !== undefined) out.durationDays = draft.durationDays;
  if (draft.decayRate !== undefined) out.decayRate = draft.decayRate;
  if (draft.metadata !== undefined) out.metadata = draft.metadata;
  return out;
}

function applyMemoryEffect(
  state: TavernState,
  preview: EffectPreview,
  origin: ApplyOrigin,
): EffectResult {
  const stamp = stampOf(state);
  const synth = synthesizeMemoryState(
    {
      id: preview.target,
      tags: preview.tags,
    },
    stamp,
    `response.${origin.verb}`,
  );
  state.memories = [...state.memories, synth];
  return { ...preview, applied: true, notes: ["memory appended"] };
}

export function createCloneApplier(
  stateClone: TavernState,
  options?: { logs?: ApplierLog[] },
): EffectApplier & {
  /** Causes synthesized during this resolve, for the resolver's return shape. */
  causesAdded: Array<{
    source: string;
    target: string;
    readable: string;
    amount: number;
  }>;
  logs: ApplierLog[];
} {
  ensureResponsesSlice(stateClone);
  const logs: ApplierLog[] = options?.logs ?? [];
  const causesAdded: Array<{
    source: string;
    target: string;
    readable: string;
    amount: number;
  }> = [];

  const today = stateClone.calendar.totalDaysElapsed;
  const slice = ensureResponsesSlice(stateClone);
  let suffix = slice.nextPendingSuffix;

  const applier: EffectApplier & {
    causesAdded: typeof causesAdded;
    logs: ApplierLog[];
  } = {
    today,
    causesAdded,
    logs,
    mintNextPendingId(t: number): string {
      const id = makePendingId(t, suffix);
      suffix += 1;
      const liveSlice = ensureResponsesSlice(stateClone);
      stateClone.modules = {
        ...stateClone.modules,
        [RESPONSES_MODULE_ID]: { ...liveSlice, nextPendingSuffix: suffix },
      };
      return id;
    },
    applyImmediateEffect(effect, origin) {
      const source = `response.${origin.verb}`;
      if (effect.kind === "pressure") return applyPressure(stateClone, effect);
      if (effect.kind === "state_change") {
        return applyStateChange(stateClone, effect, source);
      }
      if (effect.kind === "cause") {
        return applyCauseEffect(stateClone, effect, origin);
      }
      if (effect.kind === "memory") {
        return applyMemoryEffect(stateClone, effect, origin);
      }
      // future_hook never reaches here — applyResponseProfile enqueues it.
      return { ...effect, applied: false, notes: ["unhandled kind"] };
    },
    applyMemoryDraft(draft, origin) {
      const stamp = stampOf(stateClone);
      const synth = synthesizeMemoryState(
        draft,
        stamp,
        `response.${origin.verb}`,
      );
      stateClone.memories = [...stateClone.memories, synth];
    },
    enqueuePending(entry: PendingResponseEntry) {
      const liveSlice = ensureResponsesSlice(stateClone);
      stateClone.modules = {
        ...stateClone.modules,
        [RESPONSES_MODULE_ID]: {
          ...liveSlice,
          pending: [...liveSlice.pending, entry],
        },
      };
    },
    recordSynthesizedCause(record) {
      causesAdded.push(record);
    },
    log(entry: ApplierLog) {
      logs.push(entry);
    },
  };
  return applier;
}
