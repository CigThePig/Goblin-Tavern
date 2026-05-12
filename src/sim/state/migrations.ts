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
import { createInitialWorldState } from './defaults'
import { createStaffIdentity } from '../content/staff/staffIdentityFactory'
import { ensureRequiredStaffIdentityProfilesRegistered } from '../content/staff/staffIdentityProfiles'
import { createRngStreams } from '../core/rng'
import type { AreaState, TavernState, WorldState } from './TavernState'

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
