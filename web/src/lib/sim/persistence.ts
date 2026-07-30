// Phase 96 — Session persistence.
//
// `gameStore` is the SOLE caller of `simulateDay`. `persistence` is the
// SOLE owner of `localStorage` I/O for the game session. App boot drives
// the load/save loop; the store provides serialize/hydrate methods over
// its own reactive state.
//
// Save shape is a single versioned envelope keyed by `SAVE_STORAGE_KEY`.
// Reads run through the existing sim-side `ensure*` migrations from
// `src/sim/state/migrations.ts` plus `safeValidateState`, so a save
// created before a schema-additive sim change can still load.
//
// ── The persistence contract ──────────────────────────────────────
//
// Written out in full by Phase 199 / audit Wave 0, whose gate is that a
// reload at any beat or segment changes nothing the player can observe.
// A field belongs on one of these two lists, deliberately.
//
// PERSISTED — everything the resumed session cannot re-derive:
//   - `state`, the canonical sim state and sole source of truth. The
//     calendar rides inside it, so "the calendar survives reload" needs
//     nothing extra.
//   - `simSeed`. Together with `state.calendar.totalDaysElapsed` it
//     re-derives the per-day RNG stream, so a resumed day rolls exactly
//     what an uninterrupted one would. The named identity streams
//     (rule 7) keep their cursors in `state.world.rngStreams` and so
//     travel with state. Nothing else about RNG is persisted, and
//     nothing else needs to be.
//   - `previousCalendar` — the just-closed day's calendar. The engine
//     advances the calendar in Segment C, so `state.calendar` is already
//     tomorrow's by the time the Daily Report renders.
//   - `latestResultLite` — the report archive: `latestResult` minus its
//     state (deduped; we already have state) plus its diffs.
//   - `picks` (the cross-screen owner-action queue) and the sticky
//     `staffPriorities`.
//   - `pendingBySeedId` — the day's unresolved response choices.
//   - `daySession` — beat, segment, and the two deck-completion flags,
//     always written together so beat and segment cannot disagree on
//     resume.
//   - `closedDayStatePatch` — the state the most recent day CLOSED at,
//     encoded as a patch against `state` (see `baselinePatch.ts`). The
//     daily report projects from it, so a closed report keeps its own
//     rows instead of following the next morning (Wave 2).
//   - `dayBaselinePatch` — the start-of-day baseline, encoded against the
//     CLOSED-DAY state (mid-day the two are the same value, so the patch
//     is normally empty; `dayBaselineBase` records which base was used).
//     Present only while a day is in flight; without it a resumed day's
//     report shows a partial diff.
//   - `serviceOutcome` — the service beat's headline strip.
//   - `route` + `subroutes`, so Continue lands on the tab and sub-tab the
//     player was reading.
//   - `dismissedMissedOpportunityIds`, pruned to a 7-day window.
//
// TRANSIENT — reconstructed on resume, and correct to reconstruct:
//   - `transitioning`, the pacing animation flag (always restored false);
//   - bottom sheets, drawers and pickers — an open sheet is a gesture in
//     progress, not a decision;
//   - `tavernSubviewTarget` / `worldSubviewTarget` /
//     `actionPickerRequest` — one-shot routing hints, consumed on arrival;
//   - the store's per-day accumulated `dayLogs`, which only feed the
//     debug bundle's log count;
//   - debug-only fields.
//
// Failure modes return a typed `LoadOutcome`. Callers should treat
// `'invalid'` and `'incompatible'` as "show start screen with a clear
// path to start over".

import {
  ensureWorldBranch,
  ensureAreaIdentityFields,
  ensureAreaConstructionFields,
  ensureStaffIdentityFields,
  ensureCastAttributes,
  ensureWeeklyHistoryField,
  ensureMonthlyHistoryField,
  ensureOwnerTimeFields,
  ensureRecipesSlice,
  ensureRegistryRecords,
  ensureExpeditionsSlice,
  ensureTeleologySlices,
  ensureModuleSlices,
  ensureExpansionContractSlices,
  flipUpkeepRecipesOffMenu,
} from "../../../../src/sim/state/migrations";
import { safeValidateState } from "../../../../src/sim/state/validation";
import { FULL_PIPELINE } from "../../../../src/sim/canonicalPipeline";
import type { TavernState } from "../../../../src/sim/state/TavernState";
import type { CalendarState } from "../../../../src/sim/modules/calendar/types";
import type { SimResult } from "../../../../src/sim/core/result";
import type { TaggedStateDiff } from "../../../../src/sim/core/diff";
import type { IssueSeed } from "../../../../src/sim/modules/issues/issueSeedTypes";
import { sanitizePicks, type PickedAction } from "./actionBuilder";
import type {
  Beat,
  DaySessionSnapshot,
  PendingChoice,
  ServiceOutcome,
} from "./daySession";
import {
  applyBaselinePatch,
  isBaselinePatch,
  type BaselinePatch,
} from "./baselinePatch";

export const SAVE_STORAGE_KEY = "goblin-tavern:save:v1";
export const SAVE_VERSION = 1 as const;

// SimResult minus its TavernState. State is deduped at the envelope root.
// Diffs are persisted but with module-container values already excluded by
// the 10 k-char threshold in diffModules, so a day's changes array is
// typically a few KB — well within quota. After reload latestResult.diffs
// defaults to [] when absent (pre-fix saves).
export type LatestResultLite = Omit<SimResult, "state" | "diffs"> & {
  diffs?: TaggedStateDiff[];
};

export type Route = "day" | "reports" | "tavern" | "world" | "more";

// Phase 93 / ISSUE-053 — Sub-tab persistence. Previously these were
// local `$state` in each screen and reset to defaults on reload. The
// envelope now carries the last visited subview per screen so Continue
// lands the player where they were.
export type ReportsSubview =
  | "today"
  | "pressures"
  | "weekly"
  | "monthly"
  | "log";
export type TavernSubview =
  | "areas"
  | "stock"
  | "recipes"
  | "staff"
  | "projects";
export type WorldSubview =
  | "regulars"
  | "suppliers"
  | "factions"
  | "cultures"
  | "npcs"
  | "rumours";

export type SubroutesState = {
  reports?: ReportsSubview;
  tavern?: TavernSubview;
  world?: WorldSubview;
};

export type PersistedSession = {
  saveVersion: typeof SAVE_VERSION;
  savedAt: string;
  simSeed: string;
  state: TavernState;
  /**
   * Phase 186 / Day-Clock Cluster 5 — the full start-of-day baseline. No
   * longer *written* (a second whole `TavernState` mid-day crossed the
   * ~5 MB origin quota from about day 22; see 2026-06-11 audit §1), but
   * still read, so saves that predate `dayBaselinePatch` keep loading.
   */
  dayBaseline?: TavernState;
  /**
   * Phase 199 / audit Wave 0 — the start-of-day baseline, encoded as a
   * patch against `state` (`baselinePatch.ts`). This is how the baseline
   * is written now: a fraction of a second full state (218 KB against
   * 1 585 KB at day 28), so it fits the quota the 2026-06-11 fix was
   * protecting while still restoring the daily report's full-day diff
   * after a mid-day reload. Present only while a day is in flight —
   * segment 'A' or 'B'. Ignored when `dayBaseline` is also present.
   */
  dayBaselinePatch?: BaselinePatch;
  /** True when a start-of-day baseline exists, even if its patch is empty. */
  hasDayBaseline?: boolean;
  /**
   * Which state `dayBaselinePatch` was encoded against. Mid-day the
   * baseline IS the previous day's closing state, so encoding against
   * `closedDayState` makes the patch empty instead of a second ~220 KB
   * copy of the same thing. `'state'` is the fallback for a session with
   * no closed day yet. Absent on pre-Wave-3 saves, which encoded against
   * `state`.
   */
  dayBaselineBase?: 'closedDay' | 'state';
  /**
   * Phase 201 / audit Wave 2 (`P4-SEAM-002`, `P6-COMP-006`) — the state
   * the most recent day CLOSED at, encoded as a patch against `state`
   * exactly like `dayBaselinePatch`. The daily report projects from this,
   * so a closed report keeps its own missed opportunities and resolved
   * choices instead of being rebuilt from whatever the next morning
   * generated.
   *
   * Absent when the closed state equals `state` (the report beat, before
   * the next day opens) — the empty patch carries no information, so
   * `hasClosedDayState` records that a closed day exists at all.
   */
  closedDayStatePatch?: BaselinePatch;
  /** True when a day has closed, even if its patch is empty. */
  hasClosedDayState?: boolean;
  /**
   * Reconstructed at load from `closedDayStatePatch` + `state`. Never
   * written to storage — `validatePersistedSession` fills it in.
   */
  closedDayState?: TavernState;
  /**
   * Phase 199 / audit Wave 0 — the service beat's headline strip
   * (patrons / net coin / incidents). Session-only until Wave 0, whose
   * gate requires the Service outcome to survive reload unchanged.
   */
  serviceOutcome?: ServiceOutcome;
  previousCalendar?: CalendarState;
  latestResultLite?: LatestResultLite;
  picks: PickedAction[];
  staffPriorities: Record<string, string>;
  pendingBySeedId: Record<string, PendingChoice>;
  daySession: DaySessionSnapshot;
  route: Route;
  /**
   * Phase 97 — Per-day dismissed missed-opportunity ids. Pruned at day
   * rollover to a 7-day window. Optional in storage so old saves
   * (created before Phase 97 landed) hydrate to an empty set without
   * an `incompatible` bounce.
   */
  dismissedMissedOpportunityIds?: string[];
  /**
   * Phase 93 / ISSUE-053 — Last visited subview per top-level screen.
   * Optional so older saves (pre-Phase-93) keep loading; absent
   * subroutes fall back to the each screen's default at hydrate time.
   */
  subroutes?: SubroutesState;
};

export type LoadOutcome =
  | { kind: "fresh" }
  | { kind: "loaded"; save: PersistedSession }
  | { kind: "invalid"; reason: string }
  | { kind: "incompatible"; saveVersion: number };

/**
 * Validation outcome for an already-parsed `PersistedSession`-shaped
 * object. Shared by `loadSession`, snapshot load, and import paths so
 * all three go through the same migration + zod validation pipeline.
 */
export type ValidationOutcome =
  | { kind: "loaded"; save: PersistedSession }
  | { kind: "invalid"; reason: string }
  | { kind: "incompatible"; saveVersion: number };

const VALID_BEATS: ReadonlySet<Beat> = new Set<Beat>([
  "morning",
  "plan",
  "service",
  "closing",
  "report",
]);
const VALID_ROUTES: ReadonlySet<Route> = new Set<Route>([
  "day",
  "reports",
  "tavern",
  "world",
  "more",
]);
const VALID_REPORTS_SUBVIEWS: ReadonlySet<ReportsSubview> = new Set([
  "today",
  "pressures",
  "weekly",
  "monthly",
  "log",
]);
const VALID_TAVERN_SUBVIEWS: ReadonlySet<TavernSubview> = new Set([
  "areas",
  "stock",
  "recipes",
  "staff",
  "projects",
]);
const VALID_WORLD_SUBVIEWS: ReadonlySet<WorldSubview> = new Set([
  "regulars",
  "suppliers",
  "factions",
  "cultures",
  "npcs",
  "rumours",
]);

// ──────────────────────────────────────────────────────────────────
// Storage adapter — abstracted so tests can supply an in-memory
// store without touching `window`. Defaults to `localStorage` when
// available; falls back to an in-memory map (test runners,
// SSR-style preview).

export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

let memoryFallback: Map<string, string> | undefined;
let activeStorage: StorageLike | undefined;

function defaultStorage(): StorageLike {
  if (typeof globalThis !== "undefined") {
    const candidate = (globalThis as { localStorage?: StorageLike })
      .localStorage;
    if (candidate) return candidate;
  }
  if (!memoryFallback) memoryFallback = new Map<string, string>();
  const fallback = memoryFallback;
  return {
    getItem: (k) => (fallback.has(k) ? fallback.get(k)! : null),
    setItem: (k, v) => fallback.set(k, v),
    removeItem: (k) => fallback.delete(k),
  };
}

/** Test seam — pass a fresh storage adapter between cases. */
export function setStorageForTesting(s: StorageLike | undefined): void {
  activeStorage = s;
}

function getStorage(): StorageLike {
  return activeStorage ?? defaultStorage();
}

// ──────────────────────────────────────────────────────────────────
// Save

// Phase 89 / ISSUE-049 — `saveSession()` previously returned `void` and
// silently swallowed storage failures, so the UI's `lastSavedAt`
// timestamp updated unconditionally even on a failed write. The typed
// result lets the App layer keep the timestamp pinned to the last
// successful write and surface a recoverable banner.
export type SaveResult =
  | { ok: true; savedAt: string }
  | { ok: false; reason: SaveFailureReason; message: string };

/**
 * `'serialize'` was added by Phase 199 / audit Wave 0. `P2-RT-001` threw
 * while *building* the envelope, before `saveSession` was ever reached, so
 * the failure never became a `SaveResult` and the banner never appeared:
 * the player's run stopped being saved with no indication at all. Build
 * failures are now a save failure like any other — see `saveSessionFrom`.
 */
export type SaveFailureReason =
  | "quota"
  | "unavailable"
  | "unknown"
  | "serialize";

let quotaWarned = false;

function classifyStorageError(err: unknown): SaveFailureReason {
  if (err && typeof err === "object") {
    const e = err as { name?: unknown; code?: unknown };
    if (
      e.name === "QuotaExceededError" ||
      e.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
      e.code === 22 ||
      e.code === 1014
    ) {
      return "quota";
    }
  }
  return "unknown";
}

export function saveSession(session: PersistedSession): SaveResult {
  let storage: StorageLike;
  try {
    storage = getStorage();
  } catch (err) {
    return {
      ok: false,
      reason: "unavailable",
      message: describeErr(err),
    };
  }
  try {
    const payload = JSON.stringify(session);
    storage.setItem(SAVE_STORAGE_KEY, payload);
    return { ok: true, savedAt: session.savedAt };
  } catch (err) {
    const reason = classifyStorageError(err);
    if (!quotaWarned) {
      quotaWarned = true;
      // Quota errors are noisy but non-fatal. Drop a single warning so
      // a developer can spot the problem in the console, but don't
      // break the play session.
      // eslint-disable-next-line no-console
      console.warn("goblin-tavern: failed to write save to localStorage", err);
    }
    return { ok: false, reason, message: describeErr(err) };
  }
}

/**
 * Build a session and write it, as one operation with one typed outcome.
 *
 * Phase 199 / audit Wave 0 — every save call site should use this rather
 * than calling `serializeForSave()` itself and passing the result to
 * `saveSession`. A throw inside the builder is the failure mode
 * `P2-RT-001` actually had, and splitting build from write is what let it
 * escape as an uncaught exception instead of a banner the player could
 * act on.
 */
export function saveSessionFrom(build: () => PersistedSession): SaveResult {
  let session: PersistedSession;
  try {
    session = build();
  } catch (err) {
    return {
      ok: false,
      reason: "serialize",
      message: describeErr(err),
    };
  }
  return saveSession(session);
}

export function clearSession(): void {
  try {
    getStorage().removeItem(SAVE_STORAGE_KEY);
  } catch {
    // Ignore — storage may be unavailable.
  }
}

// ──────────────────────────────────────────────────────────────────
// Load

export function loadSession(): LoadOutcome {
  let raw: string | null;
  try {
    raw = getStorage().getItem(SAVE_STORAGE_KEY);
  } catch (err) {
    return {
      kind: "invalid",
      reason: `storage read failed: ${describeErr(err)}`,
    };
  }
  if (raw === null || raw === "") return { kind: "fresh" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return { kind: "invalid", reason: `malformed JSON: ${describeErr(err)}` };
  }

  return validatePersistedSession(parsed);
}

/**
 * Validate a parsed payload against the `PersistedSession` shape. Runs
 * the same migration + zod pipeline as `loadSession`. Used by snapshot
 * load (`snapshots.loadSnapshot`) and JSON import (`exportImport.parseImportedSession`).
 *
 * Accepts the unknown JSON, returns a typed outcome with either the
 * fully migrated + sanitized session, an `invalid` reason, or
 * `incompatible` with the discovered saveVersion.
 */
export function validatePersistedSession(parsed: unknown): ValidationOutcome {
  if (!isObject(parsed)) {
    return { kind: "invalid", reason: "save root is not an object" };
  }

  const version = (parsed as { saveVersion?: unknown }).saveVersion;
  if (typeof version !== "number") {
    return { kind: "invalid", reason: "saveVersion missing" };
  }
  if (version !== SAVE_VERSION) {
    return { kind: "incompatible", saveVersion: version };
  }

  const rawState = (parsed as { state?: unknown }).state;
  if (!isObject(rawState)) {
    return { kind: "invalid", reason: "state missing" };
  }

  const stateOutcome = migrateAndValidateState(rawState);
  if (!stateOutcome.ok) {
    return { kind: "invalid", reason: stateOutcome.reason };
  }
  const migratedState = stateOutcome.state;

  // Phase 201 / audit Wave 2 — rebuild the closed day's state. Runs
  // BEFORE the start-of-day baseline below, which is encoded against it
  // (see `dayBaselineBase`). Failure policy: a patch that will not apply
  // or validate is dropped with a warning, and the report falls back to
  // projecting from `state` — the pre-Wave-2 behaviour for one report,
  // rather than a failed load.
  const closedDayPatchRaw = (parsed as { closedDayStatePatch?: unknown })
    .closedDayStatePatch;
  const hasClosedDay =
    (parsed as { hasClosedDayState?: unknown }).hasClosedDayState === true;
  let closedDayState: TavernState | undefined;
  // The RAW (pre-migration) reconstruction, kept because the day-baseline
  // patch below is encoded against it.
  let rawClosedDayState: TavernState | undefined;
  if (closedDayPatchRaw !== undefined) {
    if (!isBaselinePatch(closedDayPatchRaw)) {
      // eslint-disable-next-line no-console
      console.warn(
        "goblin-tavern: dropped malformed closedDayStatePatch during load",
      );
    } else {
      try {
        rawClosedDayState = applyBaselinePatch(
          rawState as unknown as TavernState,
          closedDayPatchRaw,
        );
        closedDayState = migrateBaseline(
          rawClosedDayState as unknown as Record<string, unknown>,
          "closedDayStatePatch",
        );
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(
          `goblin-tavern: closedDayStatePatch failed to apply during load (${describeErr(err)})`,
        );
      }
    }
  } else if (hasClosedDay) {
    // Empty patch: the day closed and nothing has moved since.
    rawClosedDayState = rawState as unknown as TavernState;
    closedDayState = migratedState;
  }

  // Phase 186 / Day-Clock Cluster 5 — the start-of-day baseline (present
  // only mid-day) runs through the same pipeline. If it's missing or
  // fails, drop it: the store's segment methods fall back to the current
  // state, which only loses the full-day-diff bracket for the single
  // resumed day. (Cluster 7 also drops it when an in-flight pre-Cluster-5
  // day is reset to a clean morning — see `restoreDaySession`.)
  //
  // Phase 199 / audit Wave 0 — two accepted forms. `dayBaseline` is the
  // whole state, written by saves older than Wave 0. `dayBaselinePatch`
  // is the current form: applied to the *raw* (pre-migration) state so
  // the reconstruction is byte-identical to what was encoded, then put
  // through the same migration + validation as `state`.
  const dayBaselineRaw = (parsed as { dayBaseline?: unknown }).dayBaseline;
  const dayBaselinePatchRaw = (parsed as { dayBaselinePatch?: unknown })
    .dayBaselinePatch;
  const hasDayBaseline =
    (parsed as { hasDayBaseline?: unknown }).hasDayBaseline === true;
  const dayBaselineBase =
    (parsed as { dayBaselineBase?: unknown }).dayBaselineBase === "closedDay"
      ? "closedDay"
      : "state";
  let dayBaseline: TavernState | undefined;
  if (isObject(dayBaselineRaw)) {
    dayBaseline = migrateBaseline(dayBaselineRaw, "dayBaseline");
  } else if (hasDayBaseline || dayBaselinePatchRaw !== undefined) {
    // Mirror the base the store encoded against — see `dayBaselineBase`.
    // Both bases are the RAW (pre-migration) forms so the reconstruction
    // is byte-identical to what was encoded.
    const base =
      dayBaselineBase === "closedDay" && rawClosedDayState
        ? rawClosedDayState
        : (rawState as unknown as TavernState);
    if (dayBaselinePatchRaw !== undefined && !isBaselinePatch(dayBaselinePatchRaw)) {
      // eslint-disable-next-line no-console
      console.warn("goblin-tavern: dropped malformed dayBaselinePatch during load");
    } else {
      try {
        const rebuilt =
          dayBaselinePatchRaw === undefined
            ? base
            : applyBaselinePatch(base, dayBaselinePatchRaw);
        dayBaseline = migrateBaseline(
          rebuilt as unknown as Record<string, unknown>,
          "dayBaselinePatch",
        );
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(
          `goblin-tavern: dayBaselinePatch failed to apply during load (${describeErr(err)})`,
        );
      }
    }
  }

  const simSeed = readString(parsed, "simSeed") ?? "crooked-keg";
  const savedAt = readString(parsed, "savedAt") ?? new Date(0).toISOString();
  const route = readRoute(parsed, "route") ?? "day";

  // Phase 89 / ISSUE-049 — Saved owner-action picks now run through a
  // sanitiser before reaching the cross-screen queue. Drops shape
  // errors, unknown actions, target-type drift, and dangling target
  // ids. A console.warn surfaces the dropped count once per load.
  const picksRaw = (parsed as { picks?: unknown }).picks;
  const { picks, droppedCount: droppedPicks } = sanitizePicks(
    picksRaw,
    migratedState,
  );
  if (droppedPicks > 0) {
    // eslint-disable-next-line no-console
    console.warn(
      `goblin-tavern: dropped ${droppedPicks} invalid owner-action pick(s) during load`,
    );
  }

  const staffPrioritiesRaw = (parsed as { staffPriorities?: unknown })
    .staffPriorities;
  const staffPriorities: Record<string, string> = isObject(staffPrioritiesRaw)
    ? Object.fromEntries(
        Object.entries(staffPrioritiesRaw).filter(
          (entry): entry is [string, string] => typeof entry[1] === "string",
        ),
      )
    : {};

  const pendingRaw = (parsed as { pendingBySeedId?: unknown }).pendingBySeedId;
  let pendingBySeedId: Record<string, PendingChoice> = isObject(pendingRaw)
    ? sanitizePending(pendingRaw as Record<string, unknown>, migratedState)
    : {};

  const daySessionRaw = (parsed as { daySession?: unknown }).daySession;
  const { daySession, resetInFlightDay } = restoreDaySession(daySessionRaw);

  // Phase 186 Cluster 7 — when a pre-Cluster-5 in-flight day is reset to a
  // clean morning (see `restoreDaySession`), drop the day's pending response
  // intents and start-of-day baseline: the intents point at pre-baked seed
  // ids that Segment A's regeneration clears, and the baseline belongs to a
  // day that never properly ran. `beginDay` mints a fresh baseline when it
  // re-opens the day. Queued owner-action `picks` are intentionally kept.
  if (resetInFlightDay) {
    pendingBySeedId = {};
    dayBaseline = undefined;
    // eslint-disable-next-line no-console
    console.warn(
      "goblin-tavern: reset a pre-Cluster-5 in-flight day to a clean morning during load (Phase 186 Cluster 7 migration)",
    );
  }

  const previousCalendarRaw = (parsed as { previousCalendar?: unknown })
    .previousCalendar;
  const previousCalendar = isObject(previousCalendarRaw)
    ? (previousCalendarRaw as CalendarState)
    : undefined;

  const latestResultLiteRaw = (parsed as { latestResultLite?: unknown })
    .latestResultLite;
  const latestResultLite = isObject(latestResultLiteRaw)
    ? (latestResultLiteRaw as LatestResultLite)
    : undefined;

  const dismissedRaw = (parsed as { dismissedMissedOpportunityIds?: unknown })
    .dismissedMissedOpportunityIds;
  const dismissedMissedOpportunityIds: string[] = Array.isArray(dismissedRaw)
    ? dismissedRaw.filter((v): v is string => typeof v === "string")
    : [];

  // Phase 199 / audit Wave 0 — the service beat's headline strip. Three
  // finite numbers or nothing; a partial object is dropped rather than
  // rendered as a strip with holes in it.
  const serviceOutcome = readServiceOutcome(
    (parsed as { serviceOutcome?: unknown }).serviceOutcome,
  );

  // Phase 93 / ISSUE-053 — Sanitise subroutes. Unknown enum values
  // drop the field so the screen falls back to its default subview.
  const subroutesRaw = (parsed as { subroutes?: unknown }).subroutes;
  const subroutes: SubroutesState = isObject(subroutesRaw)
    ? sanitizeSubroutes(subroutesRaw)
    : {};

  const save: PersistedSession = {
    saveVersion: SAVE_VERSION,
    savedAt,
    simSeed,
    state: migratedState,
    picks,
    staffPriorities,
    pendingBySeedId,
    daySession,
    route,
    dismissedMissedOpportunityIds,
    ...(Object.keys(subroutes).length > 0 ? { subroutes } : {}),
    ...(serviceOutcome ? { serviceOutcome } : {}),
    ...(closedDayState ? { closedDayState, hasClosedDayState: true } : {}),
    ...(dayBaseline ? { dayBaseline } : {}),
    ...(previousCalendar ? { previousCalendar } : {}),
    ...(latestResultLite ? { latestResultLite } : {}),
  };

  return { kind: "loaded", save };
}

/**
 * Run a reconstructed start-of-day baseline through the same migration +
 * validation pipeline as `state`. A baseline that fails is dropped with a
 * warning rather than failing the load: the store then falls back to the
 * current state, costing only the resumed day's full-day diff bracket.
 */
function migrateBaseline(
  raw: Record<string, unknown>,
  source: string,
): TavernState | undefined {
  const outcome = migrateAndValidateState(raw);
  if (outcome.ok) return outcome.state;
  // eslint-disable-next-line no-console
  console.warn(
    `goblin-tavern: dropped invalid ${source} during load (${outcome.reason})`,
  );
  return undefined;
}

type StateMigrationOutcome =
  | { ok: true; state: TavernState }
  | { ok: false; reason: string };

/**
 * Phase 89 / ISSUE-049 — additive migration chain + validation, shared by
 * `state` and (Cluster 5) `dayBaseline`. Each `ensure*` helper is
 * idempotent and a no-op when the slice already matches the current
 * shape. Order matters only where one helper depends on another's output;
 * today that's just `ensureModuleSlices` running last after
 * module-state-bearing slices are guaranteed.
 */
function migrateAndValidateState(
  rawState: Record<string, unknown>,
): StateMigrationOutcome {
  try {
    const s0 = rawState as Partial<TavernState>;
    const s1 = ensureWorldBranch(s0);
    const s2a = ensureAreaIdentityFields(s1);
    // Expansion Phase 2 §5.7 — fill in the construction bookkeeping an older
    // upgrade record lacks, and convert the five retired owner-project types
    // into authoritative upgrade records. Runs immediately after the identity
    // pass because it needs `upgrades` to be a real object first.
    const s2 = ensureAreaConstructionFields(s2a);
    const s3 = ensureStaffIdentityFields(s2);
    const s4a = ensureRecipesSlice(s3);
    // Expansion Phase 2 §5.7 — merge stock/recipe records the registries have
    // gained since the save was written. `ensureRecipesSlice` only installs the
    // whole map when there is none, and nothing covered `stock` at all, so a
    // saved game would never see `timber` / `cut_stone` — and an upgrade quote
    // that cannot find its material record rejects the build forever.
    const s4 = ensureRegistryRecords(s4a);
    const s4b = flipUpkeepRecipesOffMenu(s4);
    const s5 = ensureExpeditionsSlice(s4b);
    const s5b = ensureTeleologySlices(s5);
    const s6 = ensureWeeklyHistoryField(s5b);
    const s7a = ensureMonthlyHistoryField(s6);
    // Phase 186 Cluster 7 — rename the owner-time fields
    // (`actionPoint* → time*`) so a pre-Cluster-7 save validates against
    // the renamed schema. No-op once the new keys are present.
    const s7 = ensureOwnerTimeFields(s7a);
    // Phase 121 / ISSUE-090 — Living Cast Phase A. Attaches cast
    // attributes to pre-Phase-A staff + regulars; no-op when already
    // present. Runs after the other ensure* helpers so that any
    // identity/world slice it depends on is already populated, and before
    // `ensureModuleSlices` for ordering symmetry with the rest of the chain.
    const s8 = ensureCastAttributes(s7);
    // Expansion Phase 1 §5.7 — the ruleset / meters / scheduled-event /
    // obligation slices. Explicit and named rather than left to the generic
    // sweep below, because the ruleset default is a judgement about what the
    // save was played under (always `standard`), not a blank.
    const s8b = ensureExpansionContractSlices(s8);
    const s9 = ensureModuleSlices(s8b);
    const validation = safeValidateState(s9, { modules: FULL_PIPELINE });
    if (!validation.success) {
      const first = validation.errors[0];
      return {
        ok: false,
        reason:
          `state failed validation: ${first?.path ?? ""} ${first?.message ?? ""}`.trim(),
      };
    }
    return { ok: true, state: validation.state };
  } catch (err) {
    return { ok: false, reason: `migration threw: ${describeErr(err)}` };
  }
}

// ──────────────────────────────────────────────────────────────────
// Welcome-back pill helper

export type RelativeTime = {
  hours: number;
  days: number;
  phrase: string;
};

/**
 * Returns a human-friendly phrase for the gap between `savedAtIso` and
 * `now`. Returns `undefined` for gaps under 4 hours (no pill shown).
 *
 * Thresholds:
 *   < 4h    → undefined (player hasn't really "been away")
 *   < 24h   → "~Nh"
 *   < 14d   → "Nd"  (rounded down; "1d" at 24-48h, etc.)
 *   ≥ 14d   → "2+ weeks"
 */
export function relativeTime(
  savedAtIso: string,
  now: Date,
): RelativeTime | undefined {
  const savedAt = Date.parse(savedAtIso);
  if (!Number.isFinite(savedAt)) return undefined;
  const deltaMs = now.getTime() - savedAt;
  if (deltaMs < 0) return undefined;
  const hours = Math.floor(deltaMs / (60 * 60 * 1000));
  const days = Math.floor(hours / 24);
  if (hours < 4) return undefined;
  if (hours < 24) return { hours, days, phrase: `~${hours}h` };
  if (days < 14) return { hours, days, phrase: `${days}d` };
  return { hours, days, phrase: "2+ weeks" };
}

// ──────────────────────────────────────────────────────────────────
// Helpers

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function readString(obj: unknown, key: string): string | undefined {
  if (!isObject(obj)) return undefined;
  const v = obj[key];
  return typeof v === "string" ? v : undefined;
}

function readRoute(obj: unknown, key: string): Route | undefined {
  const v = readString(obj, key);
  return v && VALID_ROUTES.has(v as Route) ? (v as Route) : undefined;
}

function readServiceOutcome(raw: unknown): ServiceOutcome | undefined {
  if (!isObject(raw)) return undefined;
  const patrons = raw["patrons"];
  const netCoin = raw["netCoin"];
  const incidents = raw["incidents"];
  if (
    typeof patrons !== "number" ||
    typeof netCoin !== "number" ||
    typeof incidents !== "number" ||
    !Number.isFinite(patrons) ||
    !Number.isFinite(netCoin) ||
    !Number.isFinite(incidents)
  ) {
    return undefined;
  }
  return { patrons, netCoin, incidents };
}

function sanitizeSubroutes(raw: Record<string, unknown>): SubroutesState {
  const out: SubroutesState = {};
  const reportsRaw = raw["reports"];
  if (
    typeof reportsRaw === "string" &&
    VALID_REPORTS_SUBVIEWS.has(reportsRaw as ReportsSubview)
  ) {
    out.reports = reportsRaw as ReportsSubview;
  }
  const tavernRaw = raw["tavern"];
  if (
    typeof tavernRaw === "string" &&
    VALID_TAVERN_SUBVIEWS.has(tavernRaw as TavernSubview)
  ) {
    out.tavern = tavernRaw as TavernSubview;
  }
  const worldRaw = raw["world"];
  if (
    typeof worldRaw === "string" &&
    VALID_WORLD_SUBVIEWS.has(worldRaw as WorldSubview)
  ) {
    out.world = worldRaw as WorldSubview;
  }
  return out;
}

type DaySessionRestore = {
  daySession: DaySessionSnapshot;
  /**
   * Phase 186 Cluster 7 — true when a pre-Cluster-5 in-flight day was reset
   * to a clean morning (contract §4.7). Callers drop the day's stale
   * pending response intents and start-of-day baseline when this is set.
   */
  resetInFlightDay: boolean;
};

const FRESH_MORNING: DaySessionSnapshot = {
  beat: "morning",
  serviceComplete: false,
  closingComplete: false,
  segment: "C",
};

// Phase 186 Cluster 7 — in-flight save migration (contract §4.7).
//
// A save written before Cluster 5 carries no `segment` field. The day was
// a single end-of-day `simulateDay` then, so a save caught past the morning
// (plan/service/closing) sits on a state whose Segment A never ran and whose
// `seedsToday` was pre-baked by the old end-of-day model. Cluster 5's
// `sanitizeSegment` derives those beats to segment 'A'/'B' — which tells the
// store Segment A already ran, so `beginDay` is skipped and the day plays on
// against the stale pre-baked surface (skipped world advance, orphaned
// response intents).
//
// The ruling: reset those beats cleanly to the next morning. The reset
// lands at {beat:'morning', segment:'C'} — the "ready to begin" state — so
// `beginDay` (Segment A) re-opens the day from the top on the (start-of-day)
// state and regenerates today's surface honestly. Queued owner-action
// `picks` are kept (Segment B consumes them); the day's pending response
// intents are dropped by the caller (they reference pre-baked seed ids the
// regeneration clears).
//
// `morning` and `report` are NOT reset: both already derive to segment 'C'
// (the clean day boundary), where `beginDay` runs Segment A fresh anyway, so
// no Segment A is skipped and any pending survives the round-trip. A
// Cluster-5+ save carries an explicit `segment` and is trusted as-is.
const IN_FLIGHT_BEATS: ReadonlySet<Beat> = new Set<Beat>([
  "plan",
  "service",
  "closing",
]);

function restoreDaySession(raw: unknown): DaySessionRestore {
  if (!isObject(raw)) {
    return { daySession: { ...FRESH_MORNING }, resetInFlightDay: false };
  }
  const beatRaw = raw["beat"];
  const beat: Beat =
    typeof beatRaw === "string" && VALID_BEATS.has(beatRaw as Beat)
      ? (beatRaw as Beat)
      : "morning";

  const segmentRaw = raw["segment"];
  const hasSegment =
    segmentRaw === "A" || segmentRaw === "B" || segmentRaw === "C";

  // Cluster-5+ save: an explicit segment is the real checkpoint — trust it.
  if (hasSegment) {
    return {
      daySession: {
        beat,
        serviceComplete: raw["serviceComplete"] === true,
        closingComplete: raw["closingComplete"] === true,
        segment: segmentRaw,
      },
      resetInFlightDay: false,
    };
  }

  // Pre-Cluster-5 save (no segment). plan/service/closing were genuinely
  // mid-day under the old single end-of-day model → reset to a clean morning.
  if (IN_FLIGHT_BEATS.has(beat)) {
    return { daySession: { ...FRESH_MORNING }, resetInFlightDay: true };
  }

  // morning/report are clean day boundaries. Keep the beat but sit at
  // segment 'C' (NOT the Cluster-5 morning→'A' derivation): 'C' is the
  // "ready to begin" state, so the begin-day effect re-runs Segment A for
  // this resumed day instead of trusting the stale pre-baked surface. This
  // is not a reset — pending survives the round-trip.
  return {
    daySession: {
      beat,
      serviceComplete: raw["serviceComplete"] === true,
      closingComplete: raw["closingComplete"] === true,
      segment: "C",
    },
    resetInFlightDay: false,
  };
}

function sanitizePending(
  raw: Record<string, unknown>,
  state: TavernState,
): Record<string, PendingChoice> {
  const seedsById = currentIssueSeedsById(state);
  const out: Record<string, PendingChoice> = {};
  for (const [seedId, entry] of Object.entries(raw)) {
    const seed = seedsById.get(seedId);
    if (!seed) continue;
    if (!isObject(entry)) continue;
    const kind = entry["kind"];
    if (kind === "ignore") {
      out[seedId] = { kind: "ignore" };
      continue;
    }
    if (kind !== "choice") continue;
    const slotId = entry["slotId"];
    const verb = entry["verb"];
    const choice = entry["choice"];
    if (typeof slotId !== "string") continue;
    if (typeof verb !== "string") continue;
    if (!isObject(choice)) continue;
    const validChoice = sanitizeChoice(choice);
    if (!validChoice) continue;
    if (!pendingChoiceMatchesCurrentSeed(seed, slotId, verb, validChoice))
      continue;
    out[seedId] = { kind: "choice", slotId, verb, choice: validChoice };
  }
  return out;
}

function currentIssueSeedsById(state: TavernState): Map<string, IssueSeed> {
  const issueSeedsState = state.modules["issueSeeds"] as
    | { seedsToday?: unknown }
    | undefined;
  const seeds = Array.isArray(issueSeedsState?.seedsToday)
    ? issueSeedsState.seedsToday
    : [];
  const out = new Map<string, IssueSeed>();
  for (const seed of seeds) {
    if (isObject(seed) && typeof seed["id"] === "string") {
      out.set(seed["id"], seed as IssueSeed);
    }
  }
  return out;
}

function pendingChoiceMatchesCurrentSeed(
  seed: IssueSeed,
  slotId: string,
  verb: string,
  choice: import("../cards/types").CardChoice,
): boolean {
  if (choice.slotId !== slotId || choice.verb !== verb) return false;
  const slot = seed.responseSlots.find((candidate) => candidate.id === slotId);
  if (!slot) return false;
  if (!slot.allowedVerbs.includes(choice.verb)) return false;
  if (slot.shape !== choice.shape) return false;

  const targetId = choice.targetId;
  if (targetId === undefined) return true;
  return slot.targetOptions.some((target) => target.id === targetId);
}

function sanitizeChoice(
  raw: Record<string, unknown>,
): import("../cards/types").CardChoice | undefined {
  const slotId = raw["slotId"];
  const label = raw["label"];
  const verb = raw["verb"];
  const shape = raw["shape"];
  const previewEffectsRaw = raw["previewEffects"];
  if (
    typeof slotId !== "string" ||
    typeof label !== "string" ||
    typeof verb !== "string" ||
    typeof shape !== "string" ||
    !Array.isArray(previewEffectsRaw)
  ) {
    return undefined;
  }
  const previewEffects = previewEffectsRaw.filter(
    (s): s is string => typeof s === "string",
  );
  const mechanicalEffectsRaw = raw["mechanicalEffects"];
  const mechanicalEffects = Array.isArray(mechanicalEffectsRaw)
    ? mechanicalEffectsRaw.filter((s): s is string => typeof s === "string")
    : undefined;
  const targetId =
    typeof raw["targetId"] === "string"
      ? (raw["targetId"] as string)
      : undefined;
  const disabledReason =
    typeof raw["disabledReason"] === "string"
      ? (raw["disabledReason"] as string)
      : undefined;
  return {
    slotId,
    label,
    verb: verb as import("../cards/types").CardChoice["verb"],
    shape: shape as import("../cards/types").CardChoice["shape"],
    previewEffects,
    ...(mechanicalEffects !== undefined ? { mechanicalEffects } : {}),
    ...(targetId !== undefined ? { targetId } : {}),
    ...(disabledReason !== undefined ? { disabledReason } : {}),
  };
}

function describeErr(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "unknown error";
}
