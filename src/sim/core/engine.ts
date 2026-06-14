import {
  advanceCalendar,
  isEndOfMonth,
  isEndOfWeek,
} from "../modules/calendar/index";
import { cloneTavernState } from "../state/defaults";
import { safeValidateState } from "../state/validation";
import { freezeInDev } from "./devGuard";
import type {
  AreaState,
  CauseEntry,
  CultureWorldState,
  CustomerGroupState,
  EntityRef,
  FactionWorldState,
  HistoryEntry,
  LocalEventWorldState,
  MemoryState,
  ExpeditionsState,
  HireableAdventurer,
  NotableNpcWorldState,
  PressureState,
  RecipeState,
  RegularWorldState,
  ReputationState,
  SocialRumourState,
  StaffState,
  StockState,
  SupplierWorldState,
  TavernIdentityState,
  TavernState,
  TeleologyEntry,
  TransformationState,
} from "../state/TavernState";
import type { ValidationIssue, ValidationSummary } from "../state/types";
import {
  MEMORIES_MODULE_ID,
  createInitialMemoryModuleState,
  memoryRegistry,
  ageMemories,
  bumpStrength,
  stampFromCalendar,
} from "../modules/memories/index";
import type { MemoryModuleState } from "../modules/memories/memoryModule";
import type {
  MemoryDraft,
  MemoryDefinition,
} from "../modules/memories/memoryTypes";
import {
  attachEntityOwnerToDraft,
  type EntityMemoryMetadata,
} from "../modules/memories/entityMemory";
import type { HistoryEntryDraft } from "../modules/history/types";
import type {
  CauseDraft,
  CauseDirection,
  CauseSourceType,
  CauseTargetType,
} from "../modules/causes/causeTypes";
import { ageCauses } from "../modules/causes/causeAging";

import { createRngStreams } from "./rng";
import type { SimRngStreams } from "./rng";
import type {
  AddLogInput,
  MutationMeta,
  SimContext,
  SimInput,
} from "./context";
import { type SimulationPhase } from "./phases";
import {
  DAY_SEGMENTS,
  phasesForSegment,
  segmentSeed,
  type DaySegment,
} from "./segments";
import type { ReportSection, SimLog, SimLogLevel } from "./reports";
import type { SimulationModule } from "./module";
import type { SimResult } from "./result";
import { ChangeTracker } from "./changeTracker";
import type { PhaseBoundary, StateDiff, TaggedStateDiff } from "./diff";

// Phase 7 §7.4 / §7.5 — Engine entry point and module ordering.
//
// `simulateDay` runs the canonical pipeline (`SIMULATION_PHASES`) once.
// Modules supply hooks per phase; the engine sorts them by `dependsOn` and
// then iterates each phase, running every dependency-ordered hook.
// `dependsOn` expresses same-phase ordering requirements only. It is not
// a complete cross-phase data-dependency map.
// Validation, calendar advancement, and report collection are built in.

const ENGINE_SOURCE = "engine";

// Phase 16 §16.2 — Helpers for memory draft → memory state assembly.
function mergeTags(
  draftTags: ReadonlyArray<string> | undefined,
  defTags: ReadonlyArray<string> | undefined,
): string[] {
  const out: string[] = [];
  for (const tag of defTags ?? []) {
    if (!out.includes(tag)) out.push(tag);
  }
  for (const tag of draftTags ?? []) {
    if (!out.includes(tag)) out.push(tag);
  }
  return out;
}

function mergeStrings(
  a: ReadonlyArray<string> | undefined,
  b: ReadonlyArray<string> | undefined,
): string[] {
  const out: string[] = [];
  for (const s of a ?? []) if (!out.includes(s)) out.push(s);
  for (const s of b ?? []) if (!out.includes(s)) out.push(s);
  return out;
}

function projectExpiry(
  stamp: {
    year: number;
    month: number;
    week: number;
    day: number;
    absoluteDay: number;
  },
  durationDays: number,
): typeof stamp {
  // Project an expiry stamp `durationDays` ahead. The calendar wraps
  // at 28 days per month / 12 months per year (Phase 3); replicate the
  // arithmetic here so the projected stamp stays JSON-safe.
  const totalDays = stamp.absoluteDay + durationDays;
  // We do not have access to the engine's calendar helpers without a
  // circular import, so synthesize an approximate stamp directly. The
  // values are advisory — `ageDays >= durationDays` is the canonical
  // expiration check; `expiresAt` is for debug/report inspection.
  let dayOfMonth = stamp.day + durationDays;
  let month = stamp.month;
  let year = stamp.year;
  while (dayOfMonth > 28) {
    dayOfMonth -= 28;
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  const week = Math.floor((dayOfMonth - 1) / 7) + 1;
  return {
    year,
    month,
    week,
    day: dayOfMonth,
    absoluteDay: totalDays,
  };
}

function countByDefinition(
  memories: ReadonlyArray<MemoryState>,
  defId: string,
): number {
  let count = 0;
  for (const m of memories) {
    if (
      m.definitionId === defId ||
      m.id === defId ||
      m.id.startsWith(`${defId}__`)
    ) {
      count += 1;
    }
  }
  return count;
}

function topologicallySortModules(
  modules: ReadonlyArray<SimulationModule>,
): SimulationModule[] {
  const byId = new Map<string, SimulationModule>();
  for (const mod of modules) {
    if (byId.has(mod.id)) {
      throw new Error(`simulateDay: duplicate module id '${mod.id}'`);
    }
    byId.set(mod.id, mod);
  }

  // Validate declared dependencies exist.
  for (const mod of modules) {
    for (const depId of mod.dependsOn ?? []) {
      if (!byId.has(depId)) {
        throw new Error(
          `simulateDay: module '${mod.id}' declares missing dependency '${depId}'`,
        );
      }
    }
  }

  const sorted: SimulationModule[] = [];
  const tempMark = new Set<string>();
  const permMark = new Set<string>();
  const stack: string[] = [];

  const visit = (id: string): void => {
    if (permMark.has(id)) return;
    if (tempMark.has(id)) {
      const cycleStart = stack.indexOf(id);
      const cyclePath = [...stack.slice(cycleStart), id].join(" -> ");
      throw new Error(
        `simulateDay: cyclic module dependency detected: ${cyclePath}`,
      );
    }
    const mod = byId.get(id);
    if (!mod) return;
    tempMark.add(id);
    stack.push(id);
    for (const depId of mod.dependsOn ?? []) {
      visit(depId);
    }
    stack.pop();
    tempMark.delete(id);
    permMark.add(id);
    sorted.push(mod);
  };

  for (const mod of modules) {
    visit(mod.id);
  }

  return sorted;
}

function normalizeLog(input: AddLogInput, fallbackSource: string): SimLog {
  if (typeof input === "string") {
    return { source: fallbackSource, level: "info", message: input };
  }
  if (
    "source" in input &&
    typeof input.source === "string" &&
    "level" in input
  ) {
    return input;
  }
  const level: SimLogLevel = (input as { level?: SimLogLevel }).level ?? "info";
  return {
    source: fallbackSource,
    level,
    message: input.message,
    ...(input.data !== undefined ? { data: input.data } : {}),
  };
}

type EngineRuntime = {
  current: TavernState;
  reports: ReportSection[];
  logs: SimLog[];
  hookSource: string;
  validationErrors: ValidationIssue[];
  validationWarnings: ValidationIssue[];
  changeTracker: ChangeTracker;
  causeCounter: number;
  // Phase 186 (Cluster 2) — the active RNG stream set. Swapped per
  // segment (`reseedSegmentRng`) so each segment derives deterministic,
  // isolated rolls from its sub-seed without any RNG serialization
  // crossing a pause. `ctx` reads it through getters, so a swap is seen
  // by every later hook.
  rngStreams: SimRngStreams;
};

// Phase 186 (Cluster 2) — point the runtime's RNG at a segment's sub-seed.
// Called at each segment boundary in `simulateDay` and once per
// `advanceDaySegment` call. Recreating the stream set resets every named
// stream to calls=0 under the segment seed.
function reseedSegmentRng(
  runtime: EngineRuntime,
  baseSeed: string,
  segment: DaySegment,
): void {
  runtime.rngStreams = createRngStreams(segmentSeed(baseSeed, segment));
}

// Phase 186 (Cluster 2) — derive the next per-day counter value from
// already-recorded ids so cause/history numbering is *resumable* from
// `TavernState` alone. A segment run starts a fresh runtime, so without
// this the counter would reset to 0 mid-day and collide with ids an
// earlier segment already wrote (`c-<day>-1` twice). Scanning for the
// highest existing `<prefix><n>` and continuing from there reproduces the
// continuous numbering a single `simulateDay` call would have produced.
function deriveDayCounter(ids: Iterable<string>, prefix: string): number {
  let max = 0;
  for (const id of ids) {
    if (!id.startsWith(prefix)) continue;
    const n = Number(id.slice(prefix.length));
    if (Number.isInteger(n) && n > max) max = n;
  }
  return max;
}

// Phase 17 §"Cause Shape" — helpers to infer the `sourceType` and
// `targetType` from the mutation context. Source inference favours the
// caller-supplied value, then falls back to the source-string prefix
// (e.g. `ownerActions.clean_area` → `owner_action`).

const SOURCE_PREFIX_TO_TYPE: ReadonlyArray<[string, CauseSourceType]> = [
  ["ownerActions", "owner_action"],
  ["owner_action", "owner_action"],
  ["service", "service"],
  ["weekly", "weekly"],
  ["monthly", "monthly"],
  ["areas", "area"],
  ["stock", "stock"],
  ["staff", "staff"],
  ["customers", "customer"],
  ["customer", "customer"],
  ["memories", "memory"],
  ["memory", "memory"],
  ["pressures", "pressure"],
  ["pressure", "pressure"],
  // Phase 27 §27.2 — world source prefixes.
  ["cultures", "culture"],
  ["culture", "culture"],
  ["factions", "faction"],
  ["faction", "faction"],
  ["suppliers", "supplier"],
  ["supplier", "supplier"],
  ["regulars", "regular"],
  ["regular", "regular"],
  ["localEvents", "local_event"],
  ["local_event", "local_event"],
  ["rumours", "rumour"],
  ["rumour", "rumour"],
];

function inferSourceType(draft: CauseDraft): CauseSourceType {
  if (draft.sourceType) return draft.sourceType;
  const src = draft.source;
  for (const [prefix, type] of SOURCE_PREFIX_TO_TYPE) {
    if (src === prefix || src.startsWith(`${prefix}.`)) return type;
  }
  return "system";
}

function inferDirection(amount: number): CauseDirection {
  if (amount > 0) return "increase";
  if (amount < 0) return "decrease";
  return "neutral";
}

function defaultReadable(draft: CauseDraft): string {
  if (draft.readable && draft.readable.length > 0) return draft.readable;
  if (draft.reason && draft.reason.length > 0) return draft.reason;
  return draft.source;
}

function createContext(
  runtime: EngineRuntime,
  input: SimInput,
  modules: ReadonlyArray<SimulationModule>,
): SimContext {
  // Phase 24 §"Engine Changes" — RNG streams.
  //
  // `createRngStreams` builds isolated, deterministic streams keyed by
  // `RngStreamId`. Existing call sites that reach for `ctx.rng` get the
  // `service` stream so per-day, ad-hoc rolls keep their old behaviour.
  //
  // Phase 186 (Cluster 2) — the stream set lives on the runtime and is
  // swapped per segment, so `ctx.rng` / `ctx.rngStreams` / `getRngStream`
  // read it lazily rather than capturing a fixed reference.

  const requireRecord = <T>(
    record: Record<string, T>,
    id: string,
    kind: string,
  ): T => {
    const value = record[id];
    if (value === undefined) {
      throw new Error(
        `ctx.modify${kind}: unknown ${kind.toLowerCase()} id '${id}'`,
      );
    }
    return value;
  };

  // ---------- Phase 16 §16.2 — memory helpers ----------

  const findMemoryIndex = (id: string): number => {
    return runtime.current.memories.findIndex((m) => m.id === id);
  };

  const updateMemoryModuleState = (
    updater: (current: MemoryModuleState) => MemoryModuleState,
    reason: string,
  ): void => {
    runtime.current = {
      ...runtime.current,
      modules: {
        ...runtime.current.modules,
        [MEMORIES_MODULE_ID]: updater(
          (runtime.current.modules[MEMORIES_MODULE_ID] as
            | MemoryModuleState
            | undefined) ?? createInitialMemoryModuleState(),
        ),
      },
    };
    void reason;
  };

  const writeMemories = (next: MemoryState[]): void => {
    runtime.current = { ...runtime.current, memories: next };
  };

  const recordNew = (id: string): void => {
    updateMemoryModuleState((current) => {
      if (current.newToday.includes(id)) return current;
      return { ...current, newToday: [...current.newToday, id] };
    }, "memory_added");
  };

  const recordExpired = (ids: ReadonlyArray<string>): void => {
    if (ids.length === 0) return;
    updateMemoryModuleState((current) => {
      const merged = [...current.expiredToday];
      for (const id of ids) {
        if (!merged.includes(id)) merged.push(id);
      }
      return { ...current, expiredToday: merged };
    }, "memory_expired");
  };

  const buildMemoryFromDraft = (
    draft: MemoryDraft,
    definition: MemoryDefinition | undefined,
    instanceId: string,
  ): MemoryState => {
    const type = draft.type ?? definition?.type ?? "timed";
    const strength = draft.strength ?? definition?.defaultStrength ?? 50;
    const durationDays = draft.durationDays ?? definition?.defaultDurationDays;
    const decayRate = draft.decayRate ?? definition?.defaultDecayRate;
    const tags = mergeTags(draft.tags, definition?.tags);
    const relatedSystems = mergeStrings(
      draft.relatedSystems,
      definition?.relatedSystems,
    );
    const stamp = stampFromCalendar(runtime.current.calendar);
    const memory: MemoryState = {
      id: instanceId,
      type,
      strength,
      ageDays: 0,
      createdAt: stamp,
      actors: draft.actors ? draft.actors.map((a) => ({ ...a })) : [],
      locations: draft.locations ? draft.locations.map((l) => ({ ...l })) : [],
      relatedSystems,
      tags,
    };
    if (definition?.id !== undefined) memory.definitionId = definition.id;
    else memory.definitionId = draft.id;
    if (definition?.label !== undefined) memory.label = definition.label;
    if (draft.label !== undefined) memory.label = draft.label;
    if (durationDays !== undefined) {
      memory.durationDays = durationDays;
      memory.expiresAt = projectExpiry(stamp, durationDays);
    }
    if (decayRate !== undefined) memory.decayRate = decayRate;
    if (draft.source !== undefined) memory.source = draft.source;
    if (draft.metadata !== undefined) memory.metadata = { ...draft.metadata };
    return memory;
  };

  const addMemoryInternal = (draft: MemoryDraft): MemoryState => {
    const def = memoryRegistry.has(draft.id)
      ? memoryRegistry.get(draft.id)
      : undefined;
    const stacking = def?.stacking ?? "replace";
    const existingIdx = findMemoryIndex(draft.id);

    // Stack strategy: keep all instances around with unique state ids
    // (definitionId stays equal to the registry id so queries can find
    // the whole group).
    if (stacking === "stack") {
      const memories = [...runtime.current.memories];
      const counter = countByDefinition(memories, draft.id) + 1;
      const instanceId = `${draft.id}__${counter}`;
      const built = buildMemoryFromDraft(draft, def, instanceId);
      memories.push(built);
      writeMemories(memories);
      recordNew(instanceId);
      return built;
    }

    if (existingIdx === -1) {
      const built = buildMemoryFromDraft(draft, def, draft.id);
      writeMemories([...runtime.current.memories, built]);
      recordNew(built.id);
      return built;
    }

    const existing = runtime.current.memories[existingIdx]!;

    if (stacking === "replace") {
      const built = buildMemoryFromDraft(draft, def, draft.id);
      const memories = [...runtime.current.memories];
      memories[existingIdx] = built;
      writeMemories(memories);
      recordNew(built.id);
      return built;
    }

    if (stacking === "refresh") {
      const stamp = stampFromCalendar(runtime.current.calendar);
      const durationDays =
        draft.durationDays ?? existing.durationDays ?? def?.defaultDurationDays;
      const refreshed: MemoryState = {
        ...existing,
        ageDays: 0,
        createdAt: stamp,
      };
      if (durationDays !== undefined) {
        refreshed.durationDays = durationDays;
        refreshed.expiresAt = projectExpiry(stamp, durationDays);
      }
      // A refresh may also lift the strength back to the default.
      if (draft.strength !== undefined) {
        refreshed.strength = draft.strength;
      } else if (def?.defaultStrength !== undefined) {
        refreshed.strength = bumpStrength(existing.strength, 0); // no-op floor/ceil
        if (refreshed.strength < def.defaultStrength) {
          refreshed.strength = def.defaultStrength;
        }
      }
      const memories = [...runtime.current.memories];
      memories[existingIdx] = refreshed;
      writeMemories(memories);
      recordNew(refreshed.id);
      return refreshed;
    }

    // increase_strength
    const stamp = stampFromCalendar(runtime.current.calendar);
    const bump = draft.strength ?? def?.defaultStrength ?? 25;
    const nextStrength = bumpStrength(existing.strength, bump);
    const durationDays =
      draft.durationDays ?? existing.durationDays ?? def?.defaultDurationDays;
    const updated: MemoryState = {
      ...existing,
      strength: nextStrength,
      ageDays: 0,
      createdAt: stamp,
    };
    if (durationDays !== undefined) {
      updated.durationDays = durationDays;
      updated.expiresAt = projectExpiry(stamp, durationDays);
    }
    const memories = [...runtime.current.memories];
    memories[existingIdx] = updated;
    writeMemories(memories);
    recordNew(updated.id);
    return updated;
  };

  // ---------- Phase 17 §17.2 — cause helpers ----------

  const buildCauseFromDraft = (
    draft: CauseDraft,
    defaults: {
      target?: string;
      targetType?: CauseTargetType;
      amount?: number;
      tags?: string[];
    } = {},
  ): CauseEntry => {
    runtime.causeCounter += 1;
    const stamp = stampFromCalendar(runtime.current.calendar);
    const id = `c-${stamp.absoluteDay}-${runtime.causeCounter}`;
    const amount = draft.amount ?? defaults.amount ?? 0;
    const direction = draft.direction ?? inferDirection(amount);
    const weight = draft.weight ?? Math.abs(amount);
    const target = draft.target ?? defaults.target ?? "global";
    const targetType =
      draft.targetType ?? defaults.targetType ?? ("global" as CauseTargetType);
    const tags: string[] = [];
    for (const t of defaults.tags ?? []) {
      if (!tags.includes(t)) tags.push(t);
    }
    for (const t of draft.tags ?? []) {
      if (!tags.includes(t)) tags.push(t);
    }
    return {
      id,
      timestamp: stamp,
      source: draft.source,
      sourceType: inferSourceType(draft),
      target,
      targetType,
      amount,
      direction,
      weight,
      readable: defaultReadable(draft),
      tags,
      relatedActors: draft.relatedActors
        ? draft.relatedActors.map((a) => ({ ...a }))
        : [],
      relatedLocations: draft.relatedLocations
        ? draft.relatedLocations.map((l) => ({ ...l }))
        : [],
      relatedSystems: draft.relatedSystems ? [...draft.relatedSystems] : [],
      ageDays: 0,
      ...(draft.expiresAfterDays !== undefined
        ? { expiresAfterDays: draft.expiresAfterDays }
        : {}),
    };
  };

  const appendCause = (entry: CauseEntry): void => {
    runtime.current = {
      ...runtime.current,
      causes: [...runtime.current.causes, entry],
    };
  };

  const addCauseInternal = (
    draft: CauseDraft,
    defaults: {
      target?: string;
      targetType?: CauseTargetType;
      amount?: number;
      tags?: string[];
    } = {},
  ): CauseEntry => {
    const entry = buildCauseFromDraft(draft, defaults);
    appendCause(entry);
    return entry;
  };

  // Phase 197 / ISSUE-164 — The Phase 7 `modify*` helpers each accept a
  // `MutationMeta` (alias `CauseDraft`) describing the change. This helper
  // walks the partial `changes` map, finds the numeric fields that actually
  // moved, and emits one cause per change using the colon-style target
  // convention (`area:<id>.<field>`, `staff:<id>.<field>`, etc.) so both
  // the cause-coverage audit (`causeReport.targetForChange`) and the UI
  // drilldown (`causeLookup.pathToCauseTarget`) find a matching entry.
  //
  // Returns the number of causes emitted so callers (e.g. Phase 27 world
  // mutators) can fall back to an aggregate cause when no numeric field
  // moved — preserving attribution for non-numeric-only updates without
  // changing the per-field behaviour for ordinary numeric mutations.
  const emitDiffPathCausesForRecord = (
    meta: CauseDraft | undefined,
    before: Record<string, unknown>,
    after: Record<string, unknown>,
    changes: Record<string, unknown>,
    targetForField: (field: string) => string,
    targetType: CauseTargetType,
    extraTags: string[],
  ): number => {
    if (!meta) return 0;
    // Phase 197 Cluster 3 — strip caller-supplied target/targetType/amount so
    // the computed per-field values always win. The aggregate fallback
    // (emitted === 0) uses the original meta from the call site, preserving
    // caller intent there. direction/weight overrides are intentionally kept.
    const { target: _t, targetType: _tt, amount: _a, ...metaRest } = meta;
    let emitted = 0;
    for (const field of Object.keys(changes)) {
      const beforeVal = before[field];
      const afterVal = after[field];
      if (typeof beforeVal !== "number" || typeof afterVal !== "number")
        continue;
      if (afterVal === beforeVal) continue;
      addCauseInternal(metaRest, {
        target: targetForField(field),
        targetType,
        amount: afterVal - beforeVal,
        tags: [...extraTags, field],
      });
      emitted += 1;
    }
    return emitted;
  };

  // ---------- Phase 16 §16.8 — history helpers ----------

  // Phase 186 (Cluster 2) — resume cause/history numbering from ids
  // already stamped for today, so a per-segment runtime continues the
  // day's sequence instead of restarting at 1 and colliding. `today` is
  // the pre-`advanceCalendar` absolute day every id this run is stamped
  // with. For a fresh day (or a single `simulateDay` call) nothing matches
  // yet, so both counters start at 0 exactly as before.
  const todayAbsolute = runtime.current.calendar.totalDaysElapsed;
  runtime.causeCounter = deriveDayCounter(
    runtime.current.causes.map((c) => c.id),
    `c-${todayAbsolute}-`,
  );
  let historyCounter = deriveDayCounter(
    runtime.current.history.map((h) => h.id),
    `h-${todayAbsolute}-`,
  );

  const addHistoryInternal = (draft: HistoryEntryDraft): HistoryEntry => {
    const stamp = stampFromCalendar(runtime.current.calendar);
    historyCounter += 1;
    const id = draft.id ?? `h-${stamp.absoluteDay}-${historyCounter}`;
    const entry: HistoryEntry = {
      id,
      timestamp: stamp,
      category: draft.category,
      summary: draft.summary,
      tags: draft.tags ? [...draft.tags] : [],
      relatedActors: draft.relatedActors
        ? draft.relatedActors.map((a) => ({ ...a }))
        : [],
      relatedLocations: draft.relatedLocations
        ? draft.relatedLocations.map((l) => ({ ...l }))
        : [],
      relatedSystems: draft.relatedSystems ? [...draft.relatedSystems] : [],
    };
    if (draft.mechanicalRefs && draft.mechanicalRefs.length > 0) {
      entry.mechanicalRefs = [...draft.mechanicalRefs];
    }
    runtime.current = {
      ...runtime.current,
      history: [...runtime.current.history, entry],
    };
    return entry;
  };

  const ctx: SimContext = {
    get state() {
      return runtime.current;
    },
    input,
    // Phase 186 (Cluster 2) — read the active (per-segment) stream set
    // from the runtime so a mid-day segment swap is seen by every hook.
    get rng() {
      return runtime.rngStreams.get("service");
    },
    get rngStreams() {
      return runtime.rngStreams;
    },
    getRngStream(streamId) {
      return runtime.rngStreams.get(streamId);
    },
    // Phase 70 / ISSUE-030 §6.3 — dynamic named stream.
    getRngStreamByName(name) {
      return runtime.rngStreams.getByName(name);
    },
    get reports() {
      return runtime.reports;
    },
    get logs() {
      return runtime.logs;
    },
    addReportSection(section: ReportSection): void {
      runtime.reports.push(section);
    },
    addLog(log, source): void {
      runtime.logs.push(normalizeLog(log, source ?? runtime.hookSource));
    },
    getDayType() {
      return runtime.current.calendar.dayType;
    },
    isEndOfWeek() {
      return isEndOfWeek(runtime.current.calendar);
    },
    isEndOfMonth() {
      return isEndOfMonth(runtime.current.calendar);
    },
    validate(): ValidationSummary {
      const result = safeValidateState(runtime.current, { modules });
      if (result.success) {
        return { errors: [], warnings: result.warnings };
      }
      return { errors: result.errors, warnings: result.warnings };
    },
    modifyArea(id, changes, meta): void {
      const area = requireRecord<AreaState>(runtime.current.areas, id, "Area");
      const next = { ...area, ...changes };
      runtime.current = {
        ...runtime.current,
        areas: {
          ...runtime.current.areas,
          [id]: next,
        },
      };
      emitDiffPathCausesForRecord(
        meta,
        area as unknown as Record<string, unknown>,
        next as unknown as Record<string, unknown>,
        changes as unknown as Record<string, unknown>,
        (field) => `area:${id}.${field}`,
        "area",
        ["area", id],
      );
    },
    modifyStock(id, changes, meta): void {
      const item = requireRecord<StockState>(
        runtime.current.stock,
        id,
        "Stock",
      );
      const next = { ...item, ...changes };
      runtime.current = {
        ...runtime.current,
        stock: {
          ...runtime.current.stock,
          [id]: next,
        },
      };
      emitDiffPathCausesForRecord(
        meta,
        item as unknown as Record<string, unknown>,
        next as unknown as Record<string, unknown>,
        changes as unknown as Record<string, unknown>,
        (field) => `stock:${id}.${field}`,
        "stock",
        ["stock", id],
      );
    },
    modifyStaff(id, changes, meta): void {
      const member = requireRecord<StaffState>(
        runtime.current.staff,
        id,
        "Staff",
      );
      const next = { ...member, ...changes };
      runtime.current = {
        ...runtime.current,
        staff: {
          ...runtime.current.staff,
          [id]: next,
        },
      };
      emitDiffPathCausesForRecord(
        meta,
        member as unknown as Record<string, unknown>,
        next as unknown as Record<string, unknown>,
        changes as unknown as Record<string, unknown>,
        (field) => `staff:${id}.${field}`,
        "staff",
        ["staff", id],
      );
    },
    addStaff(staff, meta): void {
      // Phase 86 / ISSUE-046 — duplicate id is a programmer error;
      // a bad action input would have been caught by canApply.
      if (runtime.current.staff[staff.id]) {
        throw new Error(`addStaff: duplicate staff id '${staff.id}'`);
      }
      runtime.current = {
        ...runtime.current,
        staff: {
          ...runtime.current.staff,
          [staff.id]: staff,
        },
      };
      if (meta) {
        addCauseInternal(meta, {
          target: `staff:${staff.id}`,
          targetType: "staff",
        });
      }
    },
    removeStaff(id, meta): void {
      if (!runtime.current.staff[id]) return;
      const nextStaff = { ...runtime.current.staff };
      delete nextStaff[id];
      runtime.current = {
        ...runtime.current,
        staff: nextStaff,
      };
      if (meta) {
        addCauseInternal(meta, {
          target: `staff:${id}`,
          targetType: "staff",
        });
      }
    },
    modifyCustomerGroup(id, changes, meta): void {
      const group = requireRecord<CustomerGroupState>(
        runtime.current.customerGroups,
        id,
        "CustomerGroup",
      );
      const next = { ...group, ...changes };
      runtime.current = {
        ...runtime.current,
        customerGroups: {
          ...runtime.current.customerGroups,
          [id]: next,
        },
      };
      emitDiffPathCausesForRecord(
        meta,
        group as unknown as Record<string, unknown>,
        next as unknown as Record<string, unknown>,
        changes as unknown as Record<string, unknown>,
        (field) => `customer:${id}.${field}`,
        "customer",
        ["customer", id],
      );
    },
    modifyRecipe(id, changes, meta): void {
      const recipe = requireRecord<RecipeState>(
        runtime.current.recipes,
        id,
        "Recipe",
      );
      const next = { ...recipe, ...changes };
      runtime.current = {
        ...runtime.current,
        recipes: {
          ...runtime.current.recipes,
          [id]: next,
        },
      };
      // Phase 65 / ISSUE-025 — recipe state mutations are bookkeeping
      // (timesServed, daysSinceLastServed, lastServedDay, onMenu).
      // They still flow through the cause pipeline for parity with
      // other record-slice mutations; non-numeric / unchanged fields
      // are skipped by the helper.
      emitDiffPathCausesForRecord(
        meta,
        recipe as unknown as Record<string, unknown>,
        next as unknown as Record<string, unknown>,
        changes as unknown as Record<string, unknown>,
        (field) => `recipe:${id}.${field}`,
        "recipe",
        ["recipe", id],
      );
    },
    modifyExpeditions(updater, meta): void {
      const before = runtime.current.expeditions;
      const next = updater(before);
      runtime.current = {
        ...runtime.current,
        expeditions: next,
      };
      if (meta) {
        addCauseInternal(meta, {
          target: "expeditions",
          targetType: "global",
        });
      }
    },
    modifyCoin(delta, meta): void {
      if (!Number.isFinite(delta)) {
        throw new Error(
          `ctx.modifyCoin: delta must be a finite number, got ${delta}`,
        );
      }
      runtime.current = {
        ...runtime.current,
        coin: runtime.current.coin + delta,
      };
      if (delta !== 0 && meta) {
        addCauseInternal(meta, {
          target: "coin",
          targetType: "coin",
          amount: delta,
          tags: ["coin"],
        });
      }
    },
    modifyReputation(next: ReputationState, meta): void {
      const before = runtime.current.reputation;
      runtime.current = {
        ...runtime.current,
        reputation: { ...next },
      };
      if (meta) {
        for (const key of Object.keys(before) as (keyof ReputationState)[]) {
          const beforeVal = before[key];
          const afterVal = next[key];
          if (
            typeof beforeVal === "number" &&
            typeof afterVal === "number" &&
            afterVal !== beforeVal
          ) {
            addCauseInternal(meta, {
              target: `reputation:${String(key)}`,
              targetType: "reputation",
              amount: afterVal - beforeVal,
              tags: ["reputation", String(key)],
            });
          }
        }
      }
    },
    modifyPressure(id, change, cause): void {
      if (!Number.isFinite(change)) {
        throw new Error(
          `ctx.modifyPressure: change must be a finite number, got ${change}`,
        );
      }
      const existing = runtime.current.pressures[id];
      if (!existing) {
        throw new Error(`ctx.modifyPressure: unknown pressure id '${id}'`);
      }
      const nextValue = Math.max(0, Math.min(100, existing.value + change));
      const trend =
        nextValue > existing.value ? 1 : nextValue < existing.value ? -1 : 0;
      const updated: PressureState = {
        ...existing,
        value: nextValue,
        trend,
      };
      runtime.current = {
        ...runtime.current,
        pressures: {
          ...runtime.current.pressures,
          [id]: updated,
        },
      };
      if (cause && nextValue !== existing.value) {
        addCauseInternal(cause, {
          target: `pressure:${id}.value`,
          targetType: "pressure",
          amount: nextValue - existing.value,
          tags: ["pressure", id],
        });
      }
    },
    modifyModuleState(moduleId, updater, _meta): void {
      const current = runtime.current.modules[moduleId];
      const next = updater(current as never);
      runtime.current = {
        ...runtime.current,
        modules: {
          ...runtime.current.modules,
          [moduleId]: next,
        },
      };
    },

    // Phase 27 §27.2 — World mutation helpers.
    //
    // Each helper clones the world branch immutably, validates the
    // target id, and applies the partial change. `meta` is the
    // mutation's `CauseDraft`; the engine records the cause through
    // `addCauseInternal` so the existing cause contract continues to
    // hold for world changes (the same way `modifyArea` already
    // records causes elsewhere in later phases).
    modifyCulture(id, changes, meta): void {
      const before = requireRecord<CultureWorldState>(
        runtime.current.world.cultures,
        id,
        "Culture",
      );
      const next = { ...before, ...changes };
      runtime.current = {
        ...runtime.current,
        world: {
          ...runtime.current.world,
          cultures: {
            ...runtime.current.world.cultures,
            [id]: next,
          },
        },
      };
      // ISSUE-002 (phase 42) — emit one cause per changed numeric field so
      // the cause-coverage audit can match `cause.target === change.path`
      // for world-entity mutations. If no numeric field moved, fall back
      // to an aggregate cause so non-numeric-only updates (e.g. tag/flag
      // changes) still get attributed.
      const emitted = emitDiffPathCausesForRecord(
        meta,
        before as unknown as Record<string, unknown>,
        next as unknown as Record<string, unknown>,
        changes as unknown as Record<string, unknown>,
        (field) => `culture:${id}.${field}`,
        "culture",
        ["culture", id],
      );
      if (emitted === 0 && meta) {
        addCauseInternal(meta, { target: id, targetType: "culture" });
      }
    },
    modifyFaction(id, changes, meta): void {
      const before = requireRecord<FactionWorldState>(
        runtime.current.world.factions,
        id,
        "Faction",
      );
      const next = { ...before, ...changes };
      runtime.current = {
        ...runtime.current,
        world: {
          ...runtime.current.world,
          factions: {
            ...runtime.current.world.factions,
            [id]: next,
          },
        },
      };
      const emitted = emitDiffPathCausesForRecord(
        meta,
        before as unknown as Record<string, unknown>,
        next as unknown as Record<string, unknown>,
        changes as unknown as Record<string, unknown>,
        (field) => `faction:${id}.${field}`,
        "faction",
        ["faction", id],
      );
      if (emitted === 0 && meta) {
        addCauseInternal(meta, { target: id, targetType: "faction" });
      }
    },
    modifySupplier(id, changes, meta): void {
      const before = requireRecord<SupplierWorldState>(
        runtime.current.world.suppliers,
        id,
        "Supplier",
      );
      const next = { ...before, ...changes };
      runtime.current = {
        ...runtime.current,
        world: {
          ...runtime.current.world,
          suppliers: {
            ...runtime.current.world.suppliers,
            [id]: next,
          },
        },
      };
      const emitted = emitDiffPathCausesForRecord(
        meta,
        before as unknown as Record<string, unknown>,
        next as unknown as Record<string, unknown>,
        changes as unknown as Record<string, unknown>,
        (field) => `supplier:${id}.${field}`,
        "supplier",
        ["supplier", id],
      );
      if (emitted === 0 && meta) {
        addCauseInternal(meta, { target: id, targetType: "supplier" });
      }
    },
    modifyRegular(id, changes, meta): void {
      const before = requireRecord<RegularWorldState>(
        runtime.current.world.regulars,
        id,
        "Regular",
      );
      const next = { ...before, ...changes };
      runtime.current = {
        ...runtime.current,
        world: {
          ...runtime.current.world,
          regulars: {
            ...runtime.current.world.regulars,
            [id]: next,
          },
        },
      };
      const emitted = emitDiffPathCausesForRecord(
        meta,
        before as unknown as Record<string, unknown>,
        next as unknown as Record<string, unknown>,
        changes as unknown as Record<string, unknown>,
        (field) => `regular:${id}.${field}`,
        "regular",
        ["regular", id],
      );
      if (emitted === 0 && meta) {
        addCauseInternal(meta, { target: id, targetType: "regular" });
      }
    },
    modifyNotableNpc(id, changes, meta): void {
      const before = requireRecord<NotableNpcWorldState>(
        runtime.current.world.notableNpcs,
        id,
        "NotableNpc",
      );
      const next = { ...before, ...changes };
      runtime.current = {
        ...runtime.current,
        world: {
          ...runtime.current.world,
          notableNpcs: {
            ...runtime.current.world.notableNpcs,
            [id]: next,
          },
        },
      };
      const emitted = emitDiffPathCausesForRecord(
        meta,
        before as unknown as Record<string, unknown>,
        next as unknown as Record<string, unknown>,
        changes as unknown as Record<string, unknown>,
        (field) => `notable_npc:${id}.${field}`,
        "notable_npc",
        ["notable_npc", id],
      );
      if (emitted === 0 && meta) {
        addCauseInternal(meta, { target: id, targetType: "notable_npc" });
      }
    },
    // Phase 69 / ISSUE-029 §5.4 — hireable adventurer record helpers.
    modifyHireableAdventurer(id, changes, meta): void {
      const before = requireRecord<HireableAdventurer>(
        runtime.current.world.hireableAdventurers,
        id,
        "HireableAdventurer",
      );
      const next = { ...before, ...changes };
      runtime.current = {
        ...runtime.current,
        world: {
          ...runtime.current.world,
          hireableAdventurers: {
            ...runtime.current.world.hireableAdventurers,
            [id]: next,
          },
        },
      };
      const emitted = emitDiffPathCausesForRecord(
        meta,
        before as unknown as Record<string, unknown>,
        next as unknown as Record<string, unknown>,
        changes as unknown as Record<string, unknown>,
        (field) => `world.hireableAdventurers.${id}.${field}`,
        "global",
        ["adventurer", id],
      );
      if (emitted === 0 && meta) {
        addCauseInternal(meta, { target: id, targetType: "global" });
      }
    },
    addHireableAdventurer(adventurer, meta): void {
      if (runtime.current.world.hireableAdventurers[adventurer.id]) {
        throw new Error(
          `addHireableAdventurer: duplicate adventurer id '${adventurer.id}'`,
        );
      }
      runtime.current = {
        ...runtime.current,
        world: {
          ...runtime.current.world,
          hireableAdventurers: {
            ...runtime.current.world.hireableAdventurers,
            [adventurer.id]: adventurer,
          },
        },
      };
      if (meta) {
        addCauseInternal(meta, {
          target: `world.hireableAdventurers.${adventurer.id}`,
          targetType: "global",
        });
      }
    },
    removeHireableAdventurer(id, meta): void {
      if (!runtime.current.world.hireableAdventurers[id]) return;
      const nextRoster = { ...runtime.current.world.hireableAdventurers };
      delete nextRoster[id];
      runtime.current = {
        ...runtime.current,
        world: {
          ...runtime.current.world,
          hireableAdventurers: nextRoster,
        },
      };
      if (meta) {
        addCauseInternal(meta, {
          target: `world.hireableAdventurers.${id}`,
          targetType: "global",
        });
      }
    },
    modifyLocalEvent(id, changes, meta): void {
      const before = requireRecord<LocalEventWorldState>(
        runtime.current.world.localEvents,
        id,
        "LocalEvent",
      );
      const next = { ...before, ...changes };
      runtime.current = {
        ...runtime.current,
        world: {
          ...runtime.current.world,
          localEvents: {
            ...runtime.current.world.localEvents,
            [id]: next,
          },
        },
      };
      const emitted = emitDiffPathCausesForRecord(
        meta,
        before as unknown as Record<string, unknown>,
        next as unknown as Record<string, unknown>,
        changes as unknown as Record<string, unknown>,
        (field) => `local_event:${id}.${field}`,
        "local_event",
        ["local_event", id],
      );
      if (emitted === 0 && meta) {
        addCauseInternal(meta, { target: id, targetType: "local_event" });
      }
    },
    modifySocialRumour(id, changes, meta): void {
      const before = requireRecord<SocialRumourState>(
        runtime.current.world.socialRumours,
        id,
        "SocialRumour",
      );
      const next = { ...before, ...changes };
      runtime.current = {
        ...runtime.current,
        world: {
          ...runtime.current.world,
          socialRumours: {
            ...runtime.current.world.socialRumours,
            [id]: next,
          },
        },
      };
      const emitted = emitDiffPathCausesForRecord(
        meta,
        before as unknown as Record<string, unknown>,
        next as unknown as Record<string, unknown>,
        changes as unknown as Record<string, unknown>,
        (field) => `rumour:${id}.${field}`,
        "rumour",
        ["rumour", id],
      );
      if (emitted === 0 && meta) {
        addCauseInternal(meta, { target: id, targetType: "rumour" });
      }
    },
    // World entity creation/removal. Mirrors the
    // `addHireableAdventurer`/`removeHireableAdventurer` pattern: clone the
    // target branch, write the new/removed record, and route attribution
    // through `addCauseInternal` so creation is never invisible to the
    // cause trail. Callers pass a full `CauseDraft` (with `target`/
    // `targetType` already set); the second-arg defaults are a fallback.
    addRegular(regular, meta): void {
      if (runtime.current.world.regulars[regular.id]) {
        throw new Error(`addRegular: duplicate regular id '${regular.id}'`);
      }
      runtime.current = {
        ...runtime.current,
        world: {
          ...runtime.current.world,
          regulars: {
            ...runtime.current.world.regulars,
            [regular.id]: regular,
          },
        },
      };
      addCauseInternal(meta, { target: regular.id, targetType: "regular" });
    },
    removeRegular(id, meta): void {
      if (!runtime.current.world.regulars[id]) return;
      const nextRegulars = { ...runtime.current.world.regulars };
      delete nextRegulars[id];
      runtime.current = {
        ...runtime.current,
        world: {
          ...runtime.current.world,
          regulars: nextRegulars,
        },
      };
      addCauseInternal(meta, { target: id, targetType: "regular" });
    },
    addSocialRumour(rumour, meta): void {
      if (runtime.current.world.socialRumours[rumour.id]) {
        throw new Error(`addSocialRumour: duplicate rumour id '${rumour.id}'`);
      }
      runtime.current = {
        ...runtime.current,
        world: {
          ...runtime.current.world,
          socialRumours: {
            ...runtime.current.world.socialRumours,
            [rumour.id]: rumour,
          },
        },
      };
      addCauseInternal(meta, { target: rumour.id, targetType: "rumour" });
    },
    addLocalEvent(event, meta): void {
      if (runtime.current.world.localEvents[event.id]) {
        throw new Error(
          `addLocalEvent: duplicate local event id '${event.id}'`,
        );
      }
      runtime.current = {
        ...runtime.current,
        world: {
          ...runtime.current.world,
          localEvents: {
            ...runtime.current.world.localEvents,
            [event.id]: event,
          },
        },
      };
      addCauseInternal(meta, { target: event.id, targetType: "local_event" });
    },
    modifyTavernIdentity(changes, meta): void {
      const before = runtime.current.world.tavernIdentity;
      const next: TavernIdentityState = { ...before, ...changes };
      runtime.current = {
        ...runtime.current,
        world: {
          ...runtime.current.world,
          tavernIdentity: next,
        },
      };
      const emitted = emitDiffPathCausesForRecord(
        meta,
        before as unknown as Record<string, unknown>,
        next as unknown as Record<string, unknown>,
        changes as unknown as Record<string, unknown>,
        (field) => `tavernIdentity.${field}`,
        "tavern_identity",
        ["tavern_identity"],
      );
      if (emitted === 0 && meta) {
        addCauseInternal(meta, {
          target: runtime.current.meta.tavernId,
          targetType: "tavern_identity",
        });
      }
    },

    addVenture(venture, meta): void {
      if (runtime.current.ventures[venture.id]) {
        throw new Error(`addVenture: duplicate venture id '${venture.id}'`);
      }
      runtime.current = {
        ...runtime.current,
        ventures: { ...runtime.current.ventures, [venture.id]: venture },
      };
      addCauseInternal(meta, {
        target: `venture:${venture.id}`,
        targetType: "global",
        tags: ["teleology", "venture", "start", venture.id],
      });
    },
    modifyVenture(id, changes, meta): void {
      const before = requireRecord<TeleologyEntry>(
        runtime.current.ventures,
        id,
        "Venture",
      );
      const next = { ...before, ...changes };
      runtime.current = {
        ...runtime.current,
        ventures: { ...runtime.current.ventures, [id]: next },
      };
      const emitted = emitDiffPathCausesForRecord(
        meta,
        before as unknown as Record<string, unknown>,
        next as unknown as Record<string, unknown>,
        changes as unknown as Record<string, unknown>,
        (field) => `venture:${id}.${field}`,
        "global",
        ["teleology", "venture", id],
      );
      // Lifecycle transitions move only `stage`/`status` (non-numeric), so
      // no per-field cause is emitted and the engine-path
      // `recordSynthesizedCause` is a no-op — fall back to an aggregate
      // cause so the transition is still attributed. Mirrors the world
      // mutators (`modifyCulture` et al.).
      if (emitted === 0 && meta) {
        addCauseInternal(meta, {
          target: `venture:${id}`,
          targetType: "global",
          tags: ["teleology", "venture", id],
        });
      }
    },
    modifyArc(id, changes, meta): void {
      const before = requireRecord<TeleologyEntry>(
        runtime.current.arcs,
        id,
        "Arc",
      );
      const next = { ...before, ...changes };
      runtime.current = {
        ...runtime.current,
        arcs: { ...runtime.current.arcs, [id]: next },
      };
      const emitted = emitDiffPathCausesForRecord(
        meta,
        before as unknown as Record<string, unknown>,
        next as unknown as Record<string, unknown>,
        changes as unknown as Record<string, unknown>,
        (field) => `arc:${id}.${field}`,
        "global",
        ["teleology", "arc", id],
      );
      // See `modifyVenture` — non-numeric lifecycle transitions need an
      // aggregate fallback cause so they are still attributed.
      if (emitted === 0 && meta) {
        addCauseInternal(meta, {
          target: `arc:${id}`,
          targetType: "global",
          tags: ["teleology", "arc", id],
        });
      }
    },
    modifyTransformation(id, changes, meta): void {
      const before = runtime.current.transformations[id];
      const next: TransformationState = before
        ? { ...before, ...changes }
        : {
            id,
            label: id,
            active: false,
            tags: [],
            createdAtDay: runtime.current.calendar.totalDaysElapsed,
            ...changes,
          };
      runtime.current = {
        ...runtime.current,
        transformations: { ...runtime.current.transformations, [id]: next },
      };
      if (meta) {
        addCauseInternal(meta, {
          target: `transformation:${id}`,
          targetType: "global",
          tags: ["teleology", "transformation", id],
        });
      }
    },

    // Phase 27 §27.3 — World query helpers. Thin readers; return
    // `undefined` for unknown ids. The returned record is a live
    // reference into state; `freezeInDev` makes an accidental in-place
    // write (bypassing `ctx.modify*`) throw under tests while staying a
    // no-op in production.
    getCulture(id): CultureWorldState | undefined {
      return freezeInDev(runtime.current.world.cultures[id]);
    },
    getFaction(id): FactionWorldState | undefined {
      return freezeInDev(runtime.current.world.factions[id]);
    },
    getSupplier(id): SupplierWorldState | undefined {
      return freezeInDev(runtime.current.world.suppliers[id]);
    },
    getRegular(id): RegularWorldState | undefined {
      return freezeInDev(runtime.current.world.regulars[id]);
    },
    getNotableNpc(id): NotableNpcWorldState | undefined {
      return freezeInDev(runtime.current.world.notableNpcs[id]);
    },
    getLocalEvent(id): LocalEventWorldState | undefined {
      return freezeInDev(runtime.current.world.localEvents[id]);
    },
    getSocialRumour(id): SocialRumourState | undefined {
      return freezeInDev(runtime.current.world.socialRumours[id]);
    },

    // Phase 16 §16.2 — Memory context API.
    addMemory(draft): MemoryState {
      return addMemoryInternal(draft);
    },
    // Phase 36 §36.4 — Entity-scoped memory creation.
    addEntityMemory(
      owner: EntityRef,
      draft: MemoryDraft,
      metadata?: Omit<EntityMemoryMetadata, "owner">,
    ): MemoryState {
      const enriched = attachEntityOwnerToDraft(draft, owner, metadata);
      return addMemoryInternal(enriched);
    },
    removeMemory(id): boolean {
      const idx = findMemoryIndex(id);
      if (idx === -1) return false;
      const memories = [...runtime.current.memories];
      memories.splice(idx, 1);
      writeMemories(memories);
      return true;
    },
    hasMemory(id): boolean {
      return findMemoryIndex(id) !== -1;
    },
    getMemory(id): MemoryState | undefined {
      const idx = findMemoryIndex(id);
      if (idx === -1) return undefined;
      return freezeInDev(runtime.current.memories[idx]);
    },
    getMemoriesByTag(tag): MemoryState[] {
      return freezeInDev(
        runtime.current.memories.filter((m) => m.tags.includes(tag)),
      );
    },
    getMemoriesForActor(actor: EntityRef): MemoryState[] {
      return freezeInDev(
        runtime.current.memories.filter((m) =>
          m.actors.some((a) => a.kind === actor.kind && a.id === actor.id),
        ),
      );
    },
    getMemoriesForLocation(location: EntityRef): MemoryState[] {
      return freezeInDev(
        runtime.current.memories.filter((m) =>
          m.locations.some(
            (l) => l.kind === location.kind && l.id === location.id,
          ),
        ),
      );
    },
    getMemoryStrength(id): number {
      const idx = findMemoryIndex(id);
      if (idx === -1) return 0;
      return runtime.current.memories[idx]!.strength;
    },
    ageMemoriesEndOfDay(): void {
      const { next, expired } = ageMemories(runtime.current.memories, 1);
      writeMemories(next);
      if (expired.length > 0) {
        recordExpired(expired.map((m) => m.id));
      }
    },

    // Phase 16 §16.8 — History context API.
    addHistory(draft): HistoryEntry {
      return addHistoryInternal(draft);
    },
    getRecentHistory(days): HistoryEntry[] {
      if (days <= 0) return [];
      const cutoff = runtime.current.calendar.totalDaysElapsed - days;
      return freezeInDev(
        runtime.current.history.filter(
          (e) => e.timestamp.absoluteDay >= cutoff,
        ),
      );
    },
    getHistoryByTag(tag): HistoryEntry[] {
      return freezeInDev(
        runtime.current.history.filter((e) => e.tags.includes(tag)),
      );
    },
    pruneHistoryBefore(absoluteDay): number {
      const before = runtime.current.history.length;
      if (before === 0) return 0;
      const next = runtime.current.history.filter(
        (e) => e.timestamp.absoluteDay >= absoluteDay,
      );
      if (next.length === before) return 0;
      runtime.current = { ...runtime.current, history: next };
      return before - next.length;
    },

    // Phase 17 §17.2 — Cause context API.
    addCause(draft): CauseEntry {
      return addCauseInternal(draft);
    },
    getCausesForTarget(target): CauseEntry[] {
      return freezeInDev(
        runtime.current.causes.filter((c) => c.target === target),
      );
    },
    getCausesByTag(tag): CauseEntry[] {
      return freezeInDev(
        runtime.current.causes.filter((c) => c.tags.includes(tag)),
      );
    },
    getRecentCauses(days): CauseEntry[] {
      if (days <= 0) return [];
      const cutoff = runtime.current.calendar.totalDaysElapsed - days;
      return freezeInDev(
        runtime.current.causes.filter((c) => c.timestamp.absoluteDay >= cutoff),
      );
    },
    getTopCausesForTarget(target, limit): CauseEntry[] {
      const matching = runtime.current.causes
        .filter((c) => c.target === target)
        .slice();
      matching.sort((a, b) => b.weight - a.weight);
      if (limit <= 0) return [];
      return freezeInDev(matching.slice(0, limit));
    },
    ageCausesEndOfDay(): void {
      const { next, expired } = ageCauses(runtime.current.causes, 1);
      runtime.current = { ...runtime.current, causes: next };
      void expired;
    },

    // Phase 17 §17.8 — Phase-boundary state diffs.
    getDiff(boundary: PhaseBoundary): StateDiff | undefined {
      const tagged = runtime.changeTracker.getByBoundary(boundary);
      if (!tagged) return undefined;
      return {
        changes: tagged.changes,
        significantChanges: tagged.significantChanges,
      };
    },
    getDiffs(): ReadonlyArray<TaggedStateDiff> {
      return runtime.changeTracker.all();
    },
    // Phase 197 / ISSUE-164 — Cluster 1. Live snapshot→now diff, usable
    // during `generateReports` before `finalize('day')` runs.
    getDiffSoFar(boundary: PhaseBoundary): StateDiff | undefined {
      return runtime.changeTracker.diffAgainst(boundary, runtime.current);
    },
  };

  // The mutation helpers do not yet wire a real cause draft (Phase 17),
  // but `meta` is intentionally part of the signature so callers cannot
  // bypass the contract. Reference the parameter so unused-arg lint stays
  // quiet in strict configurations.
  void ctx;
  return ctx;
}

function runHooks(
  phase: SimulationPhase,
  modules: ReadonlyArray<SimulationModule>,
  ctx: SimContext,
  runtime: EngineRuntime,
): void {
  for (const mod of modules) {
    const hooks = mod.hooks?.[phase];
    if (!hooks || hooks.length === 0) continue;
    runtime.hookSource = mod.id;
    for (const hook of hooks) {
      hook(ctx);
    }
  }
  runtime.hookSource = ENGINE_SOURCE;
}

function collectReports(
  modules: ReadonlyArray<SimulationModule>,
  ctx: SimContext,
  runtime: EngineRuntime,
): void {
  for (const mod of modules) {
    if (!mod.buildReport) continue;
    const result = mod.buildReport(ctx);
    if (result === null || result === undefined) continue;
    if (Array.isArray(result)) {
      for (const section of result) {
        runtime.reports.push(section);
      }
    } else {
      runtime.reports.push(result);
    }
  }
}

function collectModuleValidations(
  modules: ReadonlyArray<SimulationModule>,
  ctx: SimContext,
  runtime: EngineRuntime,
): void {
  for (const mod of modules) {
    if (!mod.validate) continue;
    const issues = mod.validate(ctx);
    for (const issue of issues) {
      runtime.validationErrors.push(issue);
    }
  }
}

function createRuntime(state: TavernState): EngineRuntime {
  return {
    current: cloneTavernState(state),
    reports: [],
    logs: [],
    hookSource: ENGINE_SOURCE,
    validationErrors: [],
    validationWarnings: [],
    changeTracker: new ChangeTracker(),
    causeCounter: 0,
    // Placeholder seed; `reseedSegmentRng` overwrites this before any hook
    // runs in either entry path, so the value is never observed.
    rngStreams: createRngStreams("__unseeded__"),
  };
}

// Phase 186 (Cluster 2) — run one contiguous slice of the pipeline. Shared
// by `simulateDay` (all three segments back-to-back) and
// `advanceDaySegment` (one segment in isolation), so the two paths are the
// same code and cannot drift. The caller is responsible for reseeding the
// runtime's RNG before the slice and for the day-diff bracketing around it.
function runSegmentPhases(
  phases: ReadonlyArray<SimulationPhase>,
  sortedModules: ReadonlyArray<SimulationModule>,
  ctx: SimContext,
  runtime: EngineRuntime,
): void {
  for (const phase of phases) {
    if (phase === "endWeek" && !isEndOfWeek(runtime.current.calendar)) {
      continue;
    }
    if (phase === "endMonth" && !isEndOfMonth(runtime.current.calendar)) {
      continue;
    }

    runHooks(phase, sortedModules, ctx, runtime);

    // Phase 91 / ISSUE-051 — `collectReports` runs AFTER the
    // `generateReports` hook so report builders see state mutations the
    // hook just wrote. Previously `collectReports` ran first, leaving
    // SimResult.reports[issueSeeds] describing the previous day's seeds
    // while state already held today's. Modules that build reports from
    // settled state (everyone today) get the correct picture.
    if (phase === "generateReports") {
      collectReports(sortedModules, ctx, runtime);
    }

    if (phase === "validate") {
      collectModuleValidations(sortedModules, ctx, runtime);
      const summary = ctx.validate();
      for (const e of summary.errors) runtime.validationErrors.push(e);
      for (const w of summary.warnings) runtime.validationWarnings.push(w);
    }

    if (phase === "advanceCalendar") {
      runtime.current = {
        ...runtime.current,
        calendar: advanceCalendar(runtime.current.calendar),
      };
    }
  }
}

function runtimeToResult(runtime: EngineRuntime): SimResult {
  return {
    state: runtime.current,
    reports: runtime.reports,
    logs: runtime.logs,
    validation: {
      errors: runtime.validationErrors,
      warnings: runtime.validationWarnings,
    },
    diffs: [...runtime.changeTracker.all()],
  };
}

export function simulateDay(
  state: TavernState,
  input: SimInput,
  modules: ReadonlyArray<SimulationModule>,
): SimResult {
  const sortedModules = topologicallySortModules(modules);
  const runtime = createRuntime(state);
  const ctx = createContext(runtime, input, sortedModules);

  // Phase 17 §17.8 — Snapshot the full-day baseline up front. Phase 76
  // (ISSUE-036) dropped the `owner_actions` / `service` / `end_week` /
  // `end_month` tagged boundaries: the only consumers were two phase-17
  // test asserts (now reading `'day'`), no production code read them,
  // and the `service` boundary was finalized five phase slots before
  // `generateReports`, leaving any future consumer reading stale state.
  runtime.changeTracker.snapshot("day", runtime.current);

  // Phase 186 (Cluster 2) — run the three segments in order, reseeding the
  // RNG at each boundary. This is exactly what `advanceDaySegment` does one
  // segment at a time, so the run-all and run-one paths produce identical
  // final state (asserted by the segmented-equivalence tests).
  for (const segment of DAY_SEGMENTS) {
    reseedSegmentRng(runtime, input.seed, segment);
    runSegmentPhases(phasesForSegment(segment), sortedModules, ctx, runtime);
  }

  // Phase 17 §17.8 — Close the day-level diff after the calendar tick.
  // The diff captures the full mechanical movement of the simulated day.
  runtime.changeTracker.finalize("day", runtime.current);

  return runtimeToResult(runtime);
}

/**
 * Phase 186 (Cluster 2) — run a single day segment and yield a serializable
 * checkpoint (`result.state` — `TavernState` only; §1.2/§1.3).
 *
 * The three segments compose to exactly one `simulateDay`:
 *
 *   const a = advanceDaySegment(state, input, modules, 'A')
 *   const b = advanceDaySegment(a.state, input, modules, 'B', { dayBaseline: state })
 *   const c = advanceDaySegment(b.state, input, modules, 'C', { dayBaseline: state })
 *   // c.state deep-equals simulateDay(state, input, modules).state
 *
 * GATE B (contract §4.2): the daily report and missed-opportunity
 * projections read a *single* full-day diff (`diffs.find(d => d.boundary ===
 * 'day')`). Running segments in isolation would shatter that into partial
 * per-segment diffs. Pass `dayBaseline` — the start-of-day `TavernState` —
 * so the diff is always bracketed start-of-day → end-of-this-segment; the
 * final segment (C) therefore carries the true full-day diff. The store
 * holds the baseline as one field (state is already persisted).
 */
export type AdvanceDaySegmentOptions = {
  /**
   * Start-of-day `TavernState` for the full-day diff (GATE B). Defaults to
   * `state`, which is correct for Segment A (its input *is* start-of-day).
   * Segments B and C must pass the original Segment-A input state.
   */
  dayBaseline?: TavernState;
};

export function advanceDaySegment(
  state: TavernState,
  input: SimInput,
  modules: ReadonlyArray<SimulationModule>,
  segment: DaySegment,
  options: AdvanceDaySegmentOptions = {},
): SimResult {
  const sortedModules = topologicallySortModules(modules);
  const runtime = createRuntime(state);
  const ctx = createContext(runtime, input, sortedModules);

  reseedSegmentRng(runtime, input.seed, segment);

  // GATE B — bracket the day-diff from the start-of-day baseline (defaults
  // to this segment's input, i.e. Segment A) to the end of this segment.
  const baseline = options.dayBaseline ?? state;
  runtime.changeTracker.snapshot("day", baseline);

  runSegmentPhases(phasesForSegment(segment), sortedModules, ctx, runtime);

  runtime.changeTracker.finalize("day", runtime.current);

  return runtimeToResult(runtime);
}

// Legacy compatibility export kept for early Phase 2 callers/tests that
// imported the placeholder name directly. `simulateDay` is the canonical
// production entry point; no runtime host should call `runSimulation`.
export function runSimulation(): SimResult {
  throw new Error("runSimulation is deprecated; use simulateDay (Phase 7).");
}
