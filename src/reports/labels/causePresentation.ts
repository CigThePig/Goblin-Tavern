// Phase 202 / audit Wave 3 (`P6-COMP-003`) — make the "why" surface
// readable.
//
// The cause drilldown is the game's dedicated explanation surface, and it
// was answering with machine strings: the Coin drilldown listed
// `customers.merchants.dish_ale`, `customers.local_goblins.dish_ale` and
// `service.tabs.local_goblins`, showed actor references as raw
// `kind/id` pairs, and printed `weight 72` on a scale the player has no
// reference for. Even a correctly selected cause (Wave 2 fixed the
// selection) is useless if it is unreadable.
//
// Three translations, all at the projection boundary so the sim keeps
// emitting its machine-precise strings for logs and tests:
//
//   - known source families become tavern sentences;
//   - actor and location refs resolve through `resolveEntityLabel`;
//   - importance becomes a share of the change (`DC` decision, Wave 3).
//
// An unrecognised source falls back to a safe generic sentence rather
// than leaking its path.

import type { CauseEntry, EntityRef, TavernState } from '../../sim/state/TavernState'
import { resolveEntityLabel } from '../entityLabels'
import { idLabel, humanizeId } from './idLabel'

/** A `readable` that is really a dotted/colon-joined machine path. */
function looksMachine(text: string): boolean {
  if (!text) return true
  // A sentence has spaces; a path does not, and carries separators.
  if (/\s/.test(text)) return false
  return /[.:]/.test(text)
}

/**
 * Translate a known machine cause string into a tavern sentence.
 * Returns `undefined` when the shape is not recognised, so the caller
 * can fall back rather than guess.
 */
function translateKnownSource(
  state: TavernState,
  text: string,
): string | undefined {
  const segments = text.split(/[.:]/).filter(Boolean)
  if (segments.length < 2) return undefined

  // customers.<group>.dish_<item> — a group bought something.
  if (segments[0] === 'customers' && segments.length >= 3) {
    const group = idLabel('customerGroup', segments[1]!)
    const leaf = segments[2]!
    if (leaf.startsWith('dish_')) {
      const item = idLabel('stock', leaf.slice('dish_'.length))
      return `${group} bought ${item}.`
    }
    return `${group} ${humanizeId(leaf).toLowerCase()}.`
  }

  // service.tabs.<group> — an unpaid tab.
  if (segments[0] === 'service' && segments[1] === 'tabs' && segments[2]) {
    return `${idLabel('customerGroup', segments[2])} left a tab unpaid.`
  }

  if (segments[0] === 'service' && segments[1]) {
    return `Service: ${humanizeId(segments[1]).toLowerCase()}.`
  }

  // areas.<id>.<field>
  if (segments[0] === 'areas' && segments[1]) {
    const area = idLabel('area', segments[1])
    const field = segments[2] ? idLabel('areaField', segments[2]) : 'condition'
    return `${area} ${String(field).toLowerCase()} changed.`
  }

  // stock.<id>.<field>
  if (segments[0] === 'stock' && segments[1]) {
    return `${idLabel('stock', segments[1])} stock changed.`
  }

  // pressure(s):<id>
  if (segments[0] === 'pressure' || segments[0] === 'pressures') {
    if (segments[1]) return `${idLabel('pressure', segments[1])} shifted.`
  }

  // ownerActions.<actionId>...
  if (segments[0] === 'ownerActions' && segments[1]) {
    return `You ${idLabel('action', segments[1]).toLowerCase()}.`
  }

  // response.<verb>
  if (segments[0] === 'response') {
    return 'A decision you made took effect.'
  }

  void state
  return undefined
}

/**
 * The player-facing sentence for a cause. Already-prose `readable` values
 * — which most causes carry — pass through untouched.
 */
export function humanizeCauseReadable(
  state: TavernState,
  cause: Pick<CauseEntry, 'readable' | 'source'>,
): string {
  const readable = cause.readable?.trim() ?? ''
  if (readable && !looksMachine(readable)) return readable

  const fromReadable = readable
    ? translateKnownSource(state, readable)
    : undefined
  if (fromReadable) return fromReadable

  const fromSource = cause.source
    ? translateKnownSource(state, cause.source)
    : undefined
  if (fromSource) return fromSource

  // Safe generic — never leak the path.
  return 'Something in the day’s trade moved this.'
}

/** Display names for the people and places a cause names. */
export function humanizeCauseEntities(
  state: TavernState,
  cause: Pick<CauseEntry, 'relatedActors' | 'relatedLocations'>,
  limit = 2,
): string[] {
  const refs: EntityRef[] = [
    ...(cause.relatedActors ?? []),
    ...(cause.relatedLocations ?? []),
  ]
  const out: string[] = []
  for (const ref of refs) {
    const label = resolveEntityLabel(state, ref)
    if (label && !out.includes(label)) out.push(label)
    if (out.length >= limit) break
  }
  return out
}

/**
 * A cause's share of the change being explained, as a percentage of the
 * total weight in the list. Replaces the raw `weight 72`, which exposed
 * an internal scale; the ranking information survives, the invented
 * precision does not.
 */
export function causeShareOfChange(
  cause: Pick<CauseEntry, 'weight'>,
  all: ReadonlyArray<Pick<CauseEntry, 'weight'>>,
): number {
  const total = all.reduce((sum, c) => sum + Math.abs(c.weight), 0)
  if (total <= 0) return 0
  return Math.round((Math.abs(cause.weight) / total) * 100)
}

/** Player-facing phrasing for a share. Deliberately coarse. */
export function describeShare(share: number): string {
  if (share >= 60) return 'most of the change'
  if (share >= 35) return 'about a third of the change'
  if (share >= 15) return 'a noticeable part'
  return 'a small part'
}
