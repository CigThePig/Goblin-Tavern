import type { SimContext } from "../../core/context";
import type { EffectPreview, EffectResult } from "../../core/effect";
import type {
  AreaState,
  CustomerGroupState,
  ReputationState,
  StaffState,
  StockState,
  TavernState,
  TeleologyEntry,
  TransformationState,
} from "../../state/TavernState";
import type { MemoryDraft } from "../memories/memoryTypes";
import { addCoin, spendCoin } from "../stock/ledger";

import type {
  EffectApplier,
  ApplyOrigin,
  ApplierLog,
} from "./applyResponseProfile";
import type {
  PendingResponseEntry,
  ResolvedIntentRecord,
  ResponsesModuleState,
} from "./types";
import {
  createInitialResponsesModuleState,
  RESPONSES_MODULE_ID,
} from "./types";
import { makePendingId } from "./pendingHelpers";
import { getVentureBlueprint } from "../ventures/ventureCatalog";
import { recordPressureAdjustment } from "../pressures/pressureModule";
import { payRentFromResponse } from "../monthly/rent";
import { RENT_PAYMENT_EFFECT_TARGET } from "../monthly/types";
import { OWNER_TIME_EFFECT_TARGET } from "./responseCost";
import {
  OWNER_ACTIONS_MODULE_ID,
  getOwnerActionsModuleState,
  writePoliciesSlice,
} from "../ownerActions/stateHelpers";
import type { OwnerActionsModuleState } from "../ownerActions/types";
import { findScheduledEventDefinitionForHookName } from "../../contracts/scheduledEvents/registry";
import { scheduleEvent } from "../../contracts/scheduledEvents/state";

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

const CLAMP_MIN = 0;
const CLAMP_MAX = 100;

function clamp(value: number, lo = CLAMP_MIN, hi = CLAMP_MAX): number {
  return Math.max(lo, Math.min(hi, value));
}

function readSlice(state: TavernState): ResponsesModuleState {
  const current = (state.modules as Record<string, unknown>)[
    RESPONSES_MODULE_ID
  ] as ResponsesModuleState | undefined;
  const defaults = createInitialResponsesModuleState();
  return current ? { ...defaults, ...current } : defaults;
}

function writeSlice(
  ctx: SimContext,
  patch: (current: ResponsesModuleState) => ResponsesModuleState,
  reason: string,
): void {
  ctx.modifyModuleState<ResponsesModuleState>(
    RESPONSES_MODULE_ID,
    (current) => {
      const defaults = createInitialResponsesModuleState();
      const base: ResponsesModuleState = current
        ? { ...defaults, ...current }
        : defaults;
      return patch(base);
    },
    { source: "responses", reason },
  );
}

/** Apply one immediate effect to live state via ctx helpers. Returns
 *  the EffectResult for the report. */
export function applyEffectViaCtx(
  ctx: SimContext,
  preview: EffectPreview,
  origin: ApplyOrigin,
): EffectResult {
  const source = `response.${origin.verb}`;
  const readable = preview.readable;

  // Pressure
  if (preview.kind === "pressure") {
    const id = preview.target.replace(/^pressure:/, "");
    const existing = ctx.state.pressures[id];
    if (!existing) {
      return {
        ...preview,
        applied: false,
        notes: [`unknown pressure ${id}`],
      };
    }
    const delta = preview.amount ?? 0;
    if (delta === 0) return { ...preview, applied: true };
    ctx.modifyPressure(id, delta, {
      source,
      readable,
      tags: ["response", ...preview.tags],
    });
    // Phase 200 / audit Wave 1 (`P4-SEAM-003`) — a direct pressure delta
    // changes no state the pressure's calculator reads, so without a
    // record of it the next recalculation would simply put the pressure
    // back and the card's own preview would stop being true. Record it as
    // a decaying adjustment the calculator's result is combined with.
    // This is the single path both immediate and drained-pending response
    // effects take to a pressure, so recording here covers both.
    recordPressureAdjustment(ctx, id, delta, source);
    return { ...preview, applied: true };
  }

  // Cause: emit through ctx.addCause so it lands in state.causes.
  if (preview.kind === "cause") {
    const amount = preview.amount ?? 0;
    const direction =
      amount > 0 ? "increase" : amount < 0 ? "decrease" : "neutral";
    ctx.addCause({
      source,
      sourceType: "system",
      target: preview.target,
      targetType: "global",
      amount,
      direction,
      weight: Math.abs(amount),
      readable,
      tags: ["response", ...preview.tags],
    });
    return { ...preview, applied: true, notes: ["cause emitted"] };
  }

  // Memory: route through ctx.addMemory (stacking dispatch lives there).
  if (preview.kind === "memory") {
    try {
      ctx.addMemory({
        id: preview.target,
        source,
        tags: ["response", ...preview.tags],
      });
      return { ...preview, applied: true, notes: ["memory added"] };
    } catch (err) {
      return {
        ...preview,
        applied: false,
        notes: [`addMemory failed: ${(err as Error).message}`],
      };
    }
  }

  // State change — dispatch by target prefix.
  if (preview.kind !== "state_change") {
    return {
      ...preview,
      applied: false,
      notes: [`unsupported effect kind ${preview.kind}`],
    };
  }

  const amount = preview.amount ?? 0;
  const path = preview.target;

  // Phase 200 / audit Wave 1 (`P7-EXP-001`) — paying the rent is a
  // transition, not a coin spend. Routing the card through the same
  // function the month-end settlement uses is what makes the payment
  // actually mark the month paid and clear arrears, instead of taking the
  // coin and leaving the obligation outstanding to be charged again
  // tomorrow. It also fails closed: an unaffordable payment mutates
  // nothing and reports itself as not applied.
  if (path === RENT_PAYMENT_EFFECT_TARGET) {
    const paidAmount = payRentFromResponse(ctx, source);
    if (paidAmount === 0) {
      return {
        ...preview,
        applied: false,
        notes: ["rent payment not applied (nothing owed, or not affordable)"],
      };
    }
    return { ...preview, amount: -paidAmount, applied: true };
  }

  if (path === "coin") {
    if (amount === 0) return { ...preview, applied: true };
    const meta = {
      source,
      readable,
      tags: ["response", ...preview.tags],
      category: "other" as const,
    };
    if (amount > 0) {
      addCoin(ctx, amount, meta);
    } else {
      spendCoin(ctx, -amount, meta);
    }
    return { ...preview, applied: true };
  }

  // Phase 203 / audit Wave 4 (`P6-COMP-005`) — owner time is a real spend
  // against the day clock (`phase-186-day-clock-time-economy.md`). Five
  // profiles claimed it; the target reached the bottom of this function and
  // returned `unsupported target`, so a choice that said it cost the owner
  // an hour cost nothing at all. It lands on `modules.ownerActions.timeSpent`
  // — the same ledger Segment B writes when owner actions run — so one
  // number holds the whole day's time.
  //
  // Refuses rather than overruns: the module's own validator treats
  // `timeSpent > timeBudget` as a state error, and the day cannot be longer
  // than a day. `applyResponsesHook` prices the profile before it starts
  // (DC-07, skip WHOLE), so this is the atomic backstop for a drained
  // pending effect firing into an already-full day.
  if (path === OWNER_TIME_EFFECT_TARGET) {
    if (amount === 0) return { ...preview, applied: true };
    const slice = getOwnerActionsModuleState(ctx.state);
    const minutes = -amount; // negative amount = time spent
    const nextSpent = slice.timeSpent + minutes;
    if (nextSpent > slice.timeBudget) {
      return {
        ...preview,
        applied: false,
        notes: [
          `not enough of the day left (${slice.timeBudget - slice.timeSpent}m free, needs ${minutes}m)`,
        ],
      };
    }
    ctx.modifyModuleState<OwnerActionsModuleState>(
      OWNER_ACTIONS_MODULE_ID,
      (current) => ({
        ...(current ?? slice),
        timeSpent: Math.max(0, nextSpent),
      }),
      { source, reason: "response_owner_time" },
    );
    ctx.addCause({
      source,
      sourceType: "owner_action",
      target: OWNER_TIME_EFFECT_TARGET,
      targetType: "global",
      amount,
      direction: "decrease",
      weight: minutes,
      readable,
      tags: ["response", "owner_time", ...preview.tags],
      relatedSystems: ["ownerActions", "responses"],
    });
    return { ...preview, applied: true };
  }

  // Expansion Phase 5 review — a policy response that says "repeal" must
  // update the standing policy record before its delayed reversal event is
  // scheduled. Negative amounts disable; positive amounts enable.
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
    const policy = getOwnerActionsModuleState(ctx.state).policies[id];
    if (!policy) {
      return { ...preview, applied: false, notes: [`unknown policy ${id}`] };
    }
    writePoliciesSlice(
      ctx,
      { [id]: { ...policy, enabled: amount > 0 } },
      "response_policy_toggle",
    );
    return { ...preview, applied: true };
  }

  if (path.startsWith("areas.")) {
    const [, id, field] = path.split(".") as [string, string, keyof AreaState];
    const area = ctx.state.areas[id];
    if (!area) {
      return { ...preview, applied: false, notes: [`unknown area ${id}`] };
    }
    if (typeof area[field] !== "number") {
      return {
        ...preview,
        applied: false,
        notes: [`unsupported area field ${field}`],
      };
    }
    const isClamped =
      field === "condition" ||
      field === "cleanliness" ||
      field === "mess" ||
      field === "damage" ||
      field === "smell" ||
      field === "risk";
    const before = area[field] as number;
    const raw = before + amount;
    const next = isClamped ? clamp(raw) : raw;
    ctx.modifyArea(id, { [field]: next } as Partial<AreaState>, {
      source,
      readable,
      tags: ["response", ...preview.tags],
    });
    return { ...preview, applied: true };
  }

  if (path.startsWith("stock.")) {
    const [, id, field] = path.split(".") as [string, string, keyof StockState];
    const item = ctx.state.stock[id];
    if (!item) {
      return { ...preview, applied: false, notes: [`unknown stock ${id}`] };
    }
    let next: number | undefined;
    if (field === "quantity") {
      next = Math.max(0, item.quantity + amount);
    } else if (field === "quality" || field === "spoilage") {
      next = clamp((item[field] as number) + amount);
    } else if (field === "salePrice" || field === "basePrice") {
      next = Math.max(0, (item[field] as number) + amount);
    } else {
      return {
        ...preview,
        applied: false,
        notes: [`unsupported stock field ${field}`],
      };
    }
    ctx.modifyStock(id, { [field]: next } as Partial<StockState>, {
      source,
      readable,
      tags: ["response", ...preview.tags],
    });
    return { ...preview, applied: true };
  }

  if (path.startsWith("staff.")) {
    const [, id, field] = path.split(".") as [string, string, keyof StaffState];
    const member = ctx.state.staff[id];
    if (!member) {
      return { ...preview, applied: false, notes: [`unknown staff ${id}`] };
    }
    if (
      field !== "morale" &&
      field !== "stress" &&
      field !== "fatigue" &&
      field !== "loyalty" &&
      field !== "skill"
    ) {
      return {
        ...preview,
        applied: false,
        notes: [`unsupported staff field ${field}`],
      };
    }
    const next = clamp((member[field] as number) + amount);
    ctx.modifyStaff(id, { [field]: next } as Partial<StaffState>, {
      source,
      readable,
      tags: ["response", ...preview.tags],
    });
    return { ...preview, applied: true };
  }

  if (path.startsWith("customers.")) {
    const [, id, field] = path.split(".") as [
      string,
      string,
      keyof CustomerGroupState,
    ];
    const group = ctx.state.customerGroups[id];
    if (!group) {
      return {
        ...preview,
        applied: false,
        notes: [`unknown customer ${id}`],
      };
    }
    if (
      field !== "satisfaction" &&
      field !== "patronage" &&
      field !== "loyalty" &&
      field !== "rowdiness"
    ) {
      return {
        ...preview,
        applied: false,
        notes: [`unsupported customer field ${field}`],
      };
    }
    const next = clamp((group[field] as number) + amount);
    ctx.modifyCustomerGroup(
      id,
      { [field]: next } as Partial<CustomerGroupState>,
      { source, readable, tags: ["response", ...preview.tags] },
    );
    return { ...preview, applied: true };
  }

  if (path.startsWith("ventures.")) {
    const [, id, field] = path.split(".") as [
      string,
      string,
      keyof TeleologyEntry | "spawn",
    ];
    // Commit a "pursue" response on an opening: spawn the venture for this
    // blueprint (teleology Phase 2). Spawning requires the entry NOT to
    // exist yet, so this case precedes the existing-entry guard. Idempotent
    // — re-applying when the venture already exists is a no-op success.
    if (field === "spawn") {
      if (ctx.state.ventures[id]) return { ...preview, applied: true };
      const blueprint = getVentureBlueprint(id);
      if (!blueprint)
        return {
          ...preview,
          applied: false,
          notes: [`unknown venture blueprint ${id}`],
        };
      ctx.addVenture(
        blueprint.createEntry(ctx.state.calendar.totalDaysElapsed),
        { source, readable, tags: ["response", ...preview.tags] },
      );
      return { ...preview, applied: true };
    }
    const entry = ctx.state.ventures[id];
    if (!entry)
      return { ...preview, applied: false, notes: [`unknown venture ${id}`] };
    if (field === "progress") {
      ctx.modifyVenture(
        id,
        {
          progress: Math.max(0, entry.progress + amount),
          updatedAtDay: ctx.state.calendar.totalDaysElapsed,
        },
        { source, readable, tags: ["response", ...preview.tags] },
      );
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
      ctx.modifyVenture(
        id,
        {
          [field]: value,
          updatedAtDay: ctx.state.calendar.totalDaysElapsed,
        } as Partial<TeleologyEntry>,
        { source, readable, tags: ["response", ...preview.tags] },
      );
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
    const entry = ctx.state.arcs[id];
    if (!entry)
      return { ...preview, applied: false, notes: [`unknown arc ${id}`] };
    if (field === "progress") {
      ctx.modifyArc(
        id,
        {
          progress: Math.max(0, entry.progress + amount),
          updatedAtDay: ctx.state.calendar.totalDaysElapsed,
        },
        { source, readable, tags: ["response", ...preview.tags] },
      );
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
      ctx.modifyArc(
        id,
        {
          [field]: value,
          updatedAtDay: ctx.state.calendar.totalDaysElapsed,
        } as Partial<TeleologyEntry>,
        { source, readable, tags: ["response", ...preview.tags] },
      );
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
    ctx.modifyTransformation(
      id,
      amount >= 0
        ? { active: true, activatedAtDay: ctx.state.calendar.totalDaysElapsed }
        : { active: false },
      { source, readable, tags: ["response", ...preview.tags] },
    );
    return { ...preview, applied: true };
  }

  if (path.startsWith("reputation.")) {
    const [, axis] = path.split(".") as [string, keyof ReputationState];
    const current = ctx.state.reputation[axis];
    if (current === undefined) {
      return {
        ...preview,
        applied: false,
        notes: [`unknown reputation axis ${String(axis)}`],
      };
    }
    const next: ReputationState = {
      ...ctx.state.reputation,
      [axis]: clamp((current as number) + amount),
    };
    ctx.modifyReputation(next, {
      source,
      readable,
      tags: ["response", ...preview.tags],
    });
    return { ...preview, applied: true };
  }

  return { ...preview, applied: false, notes: [`unsupported target ${path}`] };
}

export function applyMemoryDraftViaCtx(
  ctx: SimContext,
  draft: MemoryDraft,
  origin: ApplyOrigin,
): void {
  const source = draft.source ?? `response.${origin.verb}`;
  try {
    ctx.addMemory({ ...draft, source });
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
  );
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
    "intent_resolved",
  );
}

export function recordPendingApplied(ctx: SimContext, id: string): void {
  writeSlice(
    ctx,
    (current) => ({
      ...current,
      appliedFromPendingToday: [...current.appliedFromPendingToday, id],
      totalApplied: current.totalApplied + 1,
    }),
    "pending_applied",
  );
}

export function recordPendingExpired(ctx: SimContext, id: string): void {
  writeSlice(
    ctx,
    (current) => ({
      ...current,
      expiredFromPendingToday: [...current.expiredFromPendingToday, id],
      totalExpired: current.totalExpired + 1,
    }),
    "pending_expired",
  );
}

export function removeFromPending(
  ctx: SimContext,
  ids: ReadonlyArray<string>,
): void {
  if (ids.length === 0) return;
  const drop = new Set(ids);
  writeSlice(
    ctx,
    (current) => ({
      ...current,
      pending: current.pending.filter((p) => !drop.has(p.id)),
    }),
    "pending_drained",
  );
}

export function createCtxApplier(ctx: SimContext): EffectApplier {
  return {
    today: ctx.state.calendar.totalDaysElapsed,
    mintNextPendingId(today: number): string {
      // Read+bump suffix on the slice. modifyModuleState callback runs
      // synchronously, so the suffix is visible immediately to the
      // next call within this same response apply pass.
      let id = "";
      writeSlice(
        ctx,
        (current) => {
          const suffix = current.nextPendingSuffix;
          id = makePendingId(today, suffix);
          return { ...current, nextPendingSuffix: suffix + 1 };
        },
        "mint_pending_id",
      );
      return id;
    },
    applyImmediateEffect(effect, origin) {
      return applyEffectViaCtx(ctx, effect, origin);
    },
    applyMemoryDraft(draft, origin) {
      applyMemoryDraftViaCtx(ctx, draft, origin);
    },
    enqueuePending(entry) {
      enqueuePendingViaCtx(ctx, entry);
    },
    recordSynthesizedCause(_record) {
      // The engine path already emits the cause via the ctx mutator
      // (every modify* call passes a CauseDraft). No need to mirror it
      // again — the resolver-side path uses this method to populate the
      // standalone return shape, but in-engine the cause is already in
      // state.causes by the time recordSynthesizedCause is called.
    },
    /**
     * Expansion Phase 1 §1.1 — the future-hook bridge.
     *
     * Every hook a response declares now becomes a TYPED record. If a
     * module has registered the hook's name as a mechanical event, that
     * module owns it: it is scheduled through `scheduleEvent`, its resolver
     * will perform a real mutation, and this applier reports `'mechanical'`
     * so the caller does not also queue it on the pending list.
     *
     * If no module owns the name — which is every one of the ~90 existing
     * hook families as of this phase — the honest classification is
     * `narrative_expectation`: a promise the simulation is tracking but
     * cannot yet keep. The hook still goes on the pending queue exactly as
     * it did before, so behaviour is unchanged, but it is now visible,
     * acknowledgeable, expiring, and above all COUNTABLE. Driving that
     * count to zero is what Phases 2-11 are for.
     */
    routeFutureHook(input) {
      const expiryDays = Math.max(
        0,
        input.expiresAfterDay - input.scheduledForDay,
      );
      const origin = {
        source: `response.${input.origin.verb}`,
        readable: input.readable,
        ...(input.origin.selectionLabel
          ? { selectionLabel: input.origin.selectionLabel }
          : {}),
      };

      // A hook is only mechanical if a registered owner both claims the name
      // AND supplies an adapter that turns the bare hook into a valid
      // payload. The bridge deliberately does not guess a payload shape:
      // only the owning domain knows what its event needs, and a guessed
      // payload would either fail the schema days later or, worse, pass it
      // with meaningless contents.
      //
      // Expansion Phase 2 §2.2 — the lookup also honours declared name
      // PREFIXES, so a parameterised family (`area_collapse_risk_main_room`)
      // can be claimed by one registered type. The queued record then carries
      // the registered TYPE, not the hook name, because the drain resolves by
      // type; the subject travels in the payload the owner's adapter built.
      const definition = findScheduledEventDefinitionForHookName(
        input.hookName,
      );
      const adapted = definition?.fromFutureHook?.({
        hookName: input.hookName,
        readable: input.readable,
        scheduledForDay: input.scheduledForDay,
        ...(input.metadata ? { metadata: input.metadata } : {}),
      });

      if (definition && adapted) {
        const result = scheduleEvent(ctx, {
          type: definition.type,
          ...(adapted.target ? { target: adapted.target } : {}),
          scheduledForDay: input.scheduledForDay,
          expiryDays,
          payload: adapted.payload,
          origin,
        });
        if (result.status !== "rejected") return "mechanical";
        // The owner's adapter and its own schema disagree. Log loudly —
        // that is a bug in the owning domain — and fall through to the
        // narrative path so the promise is tracked rather than dropped.
        ctx.addLog(
          {
            message: `Future hook '${input.hookName}' has an owner but its adapter produced an invalid payload: ${result.reason}`,
            level: "warn",
            data: { hookName: input.hookName },
          },
          RESPONSES_MODULE_ID,
        );
      }

      scheduleEvent(ctx, {
        type: input.hookName,
        kind: "narrative_expectation",
        ownerModuleId: RESPONSES_MODULE_ID,
        scheduledForDay: input.scheduledForDay,
        expiryDays,
        payload: null,
        origin,
      });
      return "narrative";
    },
    log(entry: ApplierLog) {
      const log: {
        message: string;
        level: "warn" | "info";
        data?: Record<string, unknown>;
      } = {
        message: entry.message,
        level: entry.level === "warn" ? "warn" : "info",
      };
      if (entry.data) log.data = entry.data;
      ctx.addLog(log, "responses");
    },
  };
}

export {
  RESPONSES_MODULE_ID,
  readSlice as readResponsesSlice,
  writeSlice as writeResponsesSlice,
};
