// Phase 25 §"Migration Guidance" — full save/load migration is still
// deferred until post-Phase 20 work resumes, but pre-Phase-25 saves
// loaded via the save envelope must receive a default `world` branch so
// validation can pass. This helper is intentionally minimal: it returns
// the same object if `world` is already present, or attaches a fresh
// empty world branch from `createInitialWorldState()` otherwise.
//
// Callers wiring this into the save envelope path should run it before
// invoking `validateState()`. Phase 25 keeps the migration step opt-in
// rather than building a full version-keyed migration framework just
// for the world branch — see `phases-22-25` §"Migration Guidance".
//
// Phase 89 / ISSUE-049 — extends the additive helper set with
// `ensureRecipesSlice`, `ensureExpeditionsSlice`, and
// `ensureModuleSlices` so saves predating Phase 65 / Phase 70 / late
// module-state additions migrate forward instead of bouncing as
// `invalid`.
import { FULL_PIPELINE } from '../canonicalPipeline'
import type { SimulationModule } from '../core/module'
import { createInitialWorldState, createInitialTavernState } from './defaults'
import {
  ensureRequiredRecipesRegistered,
  recipeRegistry,
} from '../registries/recipeRegistry'
import { createStaffIdentity } from '../content/staff/staffIdentityFactory'
import { ensureRequiredStaffIdentityProfilesRegistered } from '../content/staff/staffIdentityProfiles'
import {
  createRegularCastAttributes,
  createStaffCastAttributes,
} from '../content/cast/createCastAttributes'
import { ensureRequiredVerbalTicsRegistered } from '../content/cast/verbalTics'
import { createRngStreams } from '../core/rng'
import { WEEKLY_MODULE_ID } from '../modules/weekly/state'
import type { WeeklyModuleState, WeeklyResult } from '../modules/weekly/types'
import { MONTHLY_MODULE_ID } from '../modules/monthly/types'
import type { MonthlyModuleState, MonthlyResult } from '../modules/monthly/types'
import type {
  AreaState,
  ExpeditionsState,
  RecipeState,
  TavernState,
  WorldState,
} from './TavernState'

export function ensureWorldBranch<T extends Partial<TavernState>>(
  state: T,
): T & { world: WorldState } {
  if (state.world) {
    return state as T & { world: WorldState }
  }
  return { ...state, world: createInitialWorldState() }
}

// Phase 28 §28.1 — pre-Phase-28 saves do not carry `traits`, `atmosphere`,
// or `upgrades` on each area. This helper attaches the empty defaults so
// validation passes; it never invents traits or upgrades. Callers wiring
// this into the save envelope path should run it before `validateState`,
// mirroring `ensureWorldBranch`.
type PartialArea = Partial<AreaState> & Pick<AreaState, 'id' | 'label'>

export function ensureAreaIdentityFields<T extends { areas?: Record<string, PartialArea> }>(
  state: T,
): T {
  if (!state.areas) return state
  const areas: Record<string, AreaState> = {}
  let changed = false
  for (const [id, area] of Object.entries(state.areas)) {
    const needsTraits = !Array.isArray(area.traits)
    const needsAtmosphere = !Array.isArray(area.atmosphere)
    const needsUpgrades =
      !area.upgrades || typeof area.upgrades !== 'object' || Array.isArray(area.upgrades)
    if (needsTraits || needsAtmosphere || needsUpgrades) {
      changed = true
    }
    areas[id] = {
      ...(area as AreaState),
      traits: needsTraits ? [] : [...(area.traits as string[])],
      atmosphere: needsAtmosphere ? [] : [...(area.atmosphere as string[])],
      upgrades: needsUpgrades ? {} : { ...(area.upgrades as AreaState['upgrades']) },
    }
  }
  if (!changed) return state
  return { ...state, areas }
}

// Phase 31 §31.8 — pre-Phase-31 saves do not carry the `identity`
// branch on each staff member. This helper attaches a deterministic
// default identity using the same `'initial-staff-identity'` seed
// `createInitialStaff` uses, so re-loading an old save produces the
// same identity it would have had if it were freshly created. Callers
// wiring this into the save envelope path should run it before
// `validateState`, mirroring `ensureWorldBranch` / `ensureAreaIdentityFields`.
//
// Audit fixes pass 1 §1.1 — `staff.name` is now `GeneratedName` rather
// than a plain display string. Pre-pass-1 saves carry a `string` here;
// promote it to a synthetic `GeneratedName` so newer code can read
// `staff.name.display` uniformly.
export function ensureStaffIdentityFields<
  T extends {
    staff?: Record<string, { id: string; name?: unknown; role: string; identity?: unknown }>
  },
>(state: T): T {
  if (!state.staff) return state
  ensureRequiredStaffIdentityProfilesRegistered()

  const staffEntries = Object.entries(state.staff)
  let changed = false
  const existingNames = new Set<string>()
  for (const [, member] of staffEntries) {
    const display = readStaffNameDisplay(member?.name)
    if (display) existingNames.add(display)
  }
  const streams = createRngStreams('initial-staff-identity')
  const rng = streams.get('staff_identity')
  const orderedEntries = [...staffEntries].sort(([a], [b]) => a.localeCompare(b))
  const nextStaff: Record<string, unknown> = { ...state.staff }
  for (const [id, member] of orderedEntries) {
    const hasIdentity = Boolean(member?.identity)
    const nameIsGenerated = isGeneratedNameLike(member?.name)
    if (hasIdentity && nameIsGenerated) continue
    changed = true
    const { identity, generatedName } = createStaffIdentity({
      staffId: member.id,
      roleId: member.role,
      rng,
      existingNames,
    })
    existingNames.add(generatedName.display)
    const existingDisplay = readStaffNameDisplay(member?.name)
    const resolvedName = nameIsGenerated
      ? (member.name as { display: string; profileId: string })
      : existingDisplay
        ? {
            display: existingDisplay,
            profileId: identity.namingProfileId,
            parts: { given: existingDisplay },
            patternId: 'legacy_display',
            generatedBy: 'migration:ensureStaffIdentityFields',
          }
        : generatedName
    nextStaff[id] = {
      ...member,
      name: resolvedName,
      identity: hasIdentity ? member.identity : identity,
    }
  }
  if (!changed) return state
  return { ...state, staff: nextStaff as T['staff'] }
}

// Phase 90 — pre-Phase-90 saves do not carry the `weeklyHistory` array on
// the weekly module slice. This helper attaches an empty array when
// missing and preserves any existing `lastWeeklyResult` as-is. Idempotent.
// Callers wiring this into the save envelope path should run it before
// `validateState`, mirroring `ensureWorldBranch` and the other
// `ensure*` helpers above.
export function ensureWeeklyHistoryField<
  T extends { modules?: Record<string, unknown> },
>(state: T): T {
  if (!state.modules) return state
  const slice = state.modules[WEEKLY_MODULE_ID] as
    | (Partial<WeeklyModuleState> & { weeklyHistory?: WeeklyResult[] })
    | undefined
  if (!slice) return state
  if (Array.isArray(slice.weeklyHistory)) return state
  return {
    ...state,
    modules: {
      ...state.modules,
      [WEEKLY_MODULE_ID]: { ...slice, weeklyHistory: [] },
    },
  }
}

// Phase 91 — pre-Phase-91 saves do not carry the `monthlyHistory` array
// on the monthly module slice. This helper attaches an empty array when
// missing and preserves any existing `lastMonthlyResult` as-is. Idempotent.
// Callers wiring this into the save envelope path should run it before
// `validateState`, mirroring `ensureWeeklyHistoryField` and the other
// `ensure*` helpers above.
export function ensureMonthlyHistoryField<
  T extends { modules?: Record<string, unknown> },
>(state: T): T {
  if (!state.modules) return state
  const slice = state.modules[MONTHLY_MODULE_ID] as
    | (Partial<MonthlyModuleState> & { monthlyHistory?: MonthlyResult[] })
    | undefined
  if (!slice) return state
  if (Array.isArray(slice.monthlyHistory)) return state
  return {
    ...state,
    modules: {
      ...state.modules,
      [MONTHLY_MODULE_ID]: { ...slice, monthlyHistory: [] },
    },
  }
}

// Phase 121 / ISSUE-090 — Living Cast Phase A.
//
// Pre-Phase-A saves carry no `castAttributes` on staff or regulars.
// This helper walks both collections, attaches deterministic
// attributes via a dedicated RNG stream pair (`initial-cast-attributes`)
// so the migration is reproducible regardless of save age, and is a
// structural no-op when every entity already carries the field.
// Idempotent. Callers wiring this into the save envelope path should
// run it after the other `ensure*` helpers and before `validateState`,
// mirroring the existing chain in `web/src/lib/sim/persistence.ts`.
export function ensureCastAttributes<
  T extends Partial<Pick<TavernState, 'staff' | 'world'>>,
>(state: T): T {
  ensureRequiredVerbalTicsRegistered()

  const staffNeedsMigration = staffEntriesNeedingCastAttributes(state.staff)
  const regularsNeedingMigration = regularsNeedingCastAttributes(
    state.world?.regulars,
  )
  if (
    staffNeedsMigration.length === 0 &&
    regularsNeedingMigration.length === 0
  ) {
    return state
  }

  const streams = createRngStreams('initial-cast-attributes')
  let next = state

  if (staffNeedsMigration.length > 0 && state.staff) {
    const rng = streams.get('staff_identity')
    const nextStaff: Record<string, unknown> = { ...state.staff }
    const ordered = [...staffNeedsMigration].sort((a, b) =>
      a.id.localeCompare(b.id),
    )
    for (const member of ordered) {
      const cultureId = member.identity?.cultureId
      const castAttributes = createStaffCastAttributes({
        roleId: member.role,
        ...(cultureId !== undefined ? { cultureId } : {}),
        rng,
      })
      nextStaff[member.id] = { ...member, castAttributes }
    }
    next = { ...next, staff: nextStaff as T['staff'] }
  }

  if (regularsNeedingMigration.length > 0 && next.world?.regulars) {
    const rng = streams.get('regular_identity')
    const nextRegulars: Record<string, unknown> = { ...next.world.regulars }
    const ordered = [...regularsNeedingMigration].sort((a, b) =>
      a.id.localeCompare(b.id),
    )
    for (const regular of ordered) {
      const castAttributes = createRegularCastAttributes({
        ...(regular.cultureId !== undefined
          ? { cultureId: regular.cultureId }
          : {}),
        customerGroupId: regular.customerGroupId,
        rng,
      })
      nextRegulars[regular.id] = { ...regular, castAttributes }
    }
    next = {
      ...next,
      world: {
        ...next.world,
        regulars: nextRegulars as NonNullable<typeof next.world.regulars>,
      },
    } as T
  }

  return next
}

type StaffMigrationCandidate = {
  id: string
  role: string
  identity?: { cultureId?: string }
  castAttributes?: unknown
}

function staffEntriesNeedingCastAttributes(
  staff: Record<string, StaffMigrationCandidate> | undefined,
): StaffMigrationCandidate[] {
  if (!staff) return []
  const out: StaffMigrationCandidate[] = []
  for (const member of Object.values(staff)) {
    if (!member) continue
    if (member.castAttributes) continue
    out.push(member)
  }
  return out
}

type RegularMigrationCandidate = {
  id: string
  customerGroupId: string
  cultureId?: string
  castAttributes?: unknown
}

function regularsNeedingCastAttributes(
  regulars: Record<string, RegularMigrationCandidate> | undefined,
): RegularMigrationCandidate[] {
  if (!regulars) return []
  const out: RegularMigrationCandidate[] = []
  for (const regular of Object.values(regulars)) {
    if (!regular) continue
    if (regular.castAttributes) continue
    out.push(regular)
  }
  return out
}

// Phase 89 / ISSUE-049 — pre-Phase-65 saves do not carry the
// `recipes` slice. The schema now requires it, so without this helper
// older saves bounce as `invalid` rather than migrating. We use the
// default-state factory as the source of truth: any new starter recipe
// added by `createInitialRecipes` reaches old saves through this path.
export function ensureRecipesSlice<T extends { recipes?: unknown }>(
  state: T,
): T {
  if (state.recipes && typeof state.recipes === 'object' && !Array.isArray(state.recipes)) {
    return state
  }
  const defaults = createInitialTavernState().recipes
  return { ...state, recipes: defaults as Record<string, RecipeState> }
}

// Phase 117 / ISSUE-078 — pre-clarity-pass saves may have the three
// upkeep recipes (dish_firewood, dish_mugs, dish_ingredients) stuck
// `onMenu: true`. These were never meaningful menu items, so we flip
// them off across all existing saves and refresh their `tags` from
// the registry so the `'upkeep'` marker is present in state for
// downstream filters. New saves start them off via the registry's
// `defaultState`. Recipe instances stay in state for sim continuity.
export function flipUpkeepRecipesOffMenu<T extends { recipes?: Record<string, RecipeState> }>(
  state: T,
): T {
  if (!state.recipes || typeof state.recipes !== 'object') return state
  ensureRequiredRecipesRegistered()
  let changed = false
  const next: Record<string, RecipeState> = { ...state.recipes }
  for (const [id, recipe] of Object.entries(state.recipes)) {
    if (!recipe || typeof recipe !== 'object') continue
    if (!recipeRegistry.has(id)) continue
    const def = recipeRegistry.get(id)
    if (!def.tags.includes('upkeep')) continue
    const tagsAlready = recipe.tags?.includes('upkeep') ?? false
    if (recipe.onMenu === false && tagsAlready) continue
    next[id] = {
      ...recipe,
      onMenu: false,
      tags: tagsAlready ? recipe.tags : [...(recipe.tags ?? []), 'upkeep'],
    }
    changed = true
  }
  if (!changed) return state
  return { ...state, recipes: next }
}

// Phase 89 / ISSUE-049 — pre-Phase-70 saves do not carry the
// `expeditions` slice. The schema now requires it as a structured
// object with `active` and `completed` arrays.
export function ensureExpeditionsSlice<T extends { expeditions?: unknown }>(
  state: T,
): T {
  const existing = state.expeditions as Partial<ExpeditionsState> | undefined
  if (
    existing &&
    Array.isArray(existing.active) &&
    Array.isArray(existing.completed)
  ) {
    return state
  }
  const next: ExpeditionsState = {
    active: Array.isArray(existing?.active) ? existing.active : [],
    completed: Array.isArray(existing?.completed) ? existing.completed : [],
  }
  return { ...state, expeditions: next }
}

// Phase 89 / ISSUE-049 — synthesise any module-state slot the current
// pipeline expects but the loaded save omits. The default factory holds
// the fresh slice for every module registered today, so this helper
// guarantees that loading a save written before a later module landed
// produces a schema-valid state.
//
// Existing module slices in the save are preserved untouched; only
// missing keys are added. This is the additive contract used elsewhere
// in this file.
export function ensureModuleSlices<T extends { modules?: Record<string, unknown> }>(
  state: T,
  modules: ReadonlyArray<SimulationModule> = FULL_PIPELINE,
): T {
  const defaults = createInitialTavernState().modules
  const current = (state.modules ?? {}) as Record<string, unknown>
  const next: Record<string, unknown> = { ...current }
  let changed = false
  for (const mod of modules) {
    if (!mod.stateSchema) continue
    if (!(mod.id in next) && mod.id in defaults) {
      next[mod.id] = (defaults as Record<string, unknown>)[mod.id]
      changed = true
    }
  }
  if (!changed && state.modules) return state
  return { ...state, modules: next }
}

function isGeneratedNameLike(value: unknown): value is { display: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { display?: unknown }).display === 'string'
  )
}

function readStaffNameDisplay(value: unknown): string | undefined {
  if (typeof value === 'string' && value.length > 0) return value
  if (isGeneratedNameLike(value)) return value.display
  return undefined
}

export {}
