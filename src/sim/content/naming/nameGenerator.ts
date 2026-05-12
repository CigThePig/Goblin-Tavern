// Phase 24 §"Name Generator Starter" — deterministic name generation.
//
// Phase 22 reserved the seam; Phase 24 implements a minimal name
// generator that:
//   - picks a pattern weighted by `pattern.weight`,
//   - fills the requested name parts from the profile's pools,
//   - returns a `GeneratedName` describing the result.
//
// Names are not yet attached to staff or stored in `TavernState` —
// callers (tests, later identity phases) drive generation through a
// named RNG stream so re-rolling unrelated systems cannot shift the
// outcome.

import type { SimRng } from '../../core/rng'
import type {
  GeneratedName,
  NamePartKind,
  NamePattern,
  NamingProfile,
} from './nameTypes'

const PART_PLACEHOLDER_KEYS: Record<NamePartKind, string> = {
  given: '{given}',
  family: '{family}',
  nickname: '{nickname}',
  title: '{title}',
  clan: '{clan}',
  origin: '{origin}',
}

function partPool(
  profile: NamingProfile,
  kind: NamePartKind,
): ReadonlyArray<string> | undefined {
  switch (kind) {
    case 'given':
      return profile.given
    case 'family':
      return profile.family
    case 'nickname':
      return profile.nicknames
    case 'title':
      return profile.titles
    case 'clan':
    case 'origin':
      return undefined
  }
}

function pickPattern(profile: NamingProfile, rng: SimRng): NamePattern {
  if (profile.patterns.length === 0) {
    throw new Error(
      `generateName: naming profile '${profile.id}' has no patterns`,
    )
  }
  return rng.weightedPick(
    profile.patterns.map((p) => ({ item: p, weight: p.weight })),
  )
}

// Phase 31 §31.5 — `existingDisplayNames` lets callers retry briefly
// when a freshly generated display name collides with one already in
// use (existing staff/regulars/etc.). The retry count is capped so the
// generator stays deterministic and never spins on a sparse pool.
const MAX_DUPLICATE_RETRIES = 8

function buildOnce(
  profile: NamingProfile,
  rng: SimRng,
  generatedBy: string,
): GeneratedName {
  const pattern = pickPattern(profile, rng)

  const parts: Partial<Record<NamePartKind, string>> = {}
  for (const kind of pattern.partKinds) {
    const pool = partPool(profile, kind)
    if (!pool || pool.length === 0) {
      throw new Error(
        `generateName: profile '${profile.id}' pattern '${pattern.id}' ` +
          `requires part '${kind}' but no pool is defined`,
      )
    }
    parts[kind] = rng.pick(pool as string[])
  }

  let display = pattern.template
  for (const kind of pattern.partKinds) {
    const placeholder = PART_PLACEHOLDER_KEYS[kind]
    const value = parts[kind]
    if (value === undefined) {
      throw new Error(
        `generateName: profile '${profile.id}' pattern '${pattern.id}' ` +
          `picked no value for part '${kind}'`,
      )
    }
    display = display.split(placeholder).join(value)
  }

  if (profile.reservedNames && profile.reservedNames.includes(display)) {
    return { display: `${display} the Younger`, profileId: profile.id, parts, patternId: pattern.id, generatedBy }
  }

  return {
    display,
    profileId: profile.id,
    parts,
    patternId: pattern.id,
    generatedBy,
  }
}

export function generateName(
  profile: NamingProfile,
  rng: SimRng,
  generatedBy: string,
  options?: { existingDisplayNames?: ReadonlySet<string> },
): GeneratedName {
  const existing = options?.existingDisplayNames
  if (!existing || existing.size === 0) {
    return buildOnce(profile, rng, generatedBy)
  }

  let last = buildOnce(profile, rng, generatedBy)
  for (let i = 0; i < MAX_DUPLICATE_RETRIES; i++) {
    if (!existing.has(last.display)) return last
    last = buildOnce(profile, rng, generatedBy)
  }
  // Retry budget exhausted — return the last candidate even if it
  // collides. The caller can disambiguate via the staff id (e.g. by
  // appending a numeric suffix) without giving up determinism.
  return last
}
