// Expansion Phase 1 §1.4 — the collection-element target convention.
//
// Cause targets are colon strings: `stock:ale`, `area:kitchen`,
// `pressure:pests`, optionally with a field suffix (`stock:ale.quantity`).
// That works for one change to one thing. It does not work for the
// high-volume homogeneous changes the plan calls out — "daily rumour
// decay" touches every live rumour, and emitting one permanent cause
// record per rumour per day would bury every meaningful cause under noise
// while also growing `state.causes` without limit.
//
// So a GROUPED target names the whole set in one string:
//
//   rumour:{r_ale_watered,r_brawl,r_short_measure}   — three named rumours
//   rumour:*                                         — every rumour of the kind
//
// The braces form is preferred and is what §1.4 means by "a grouped cause
// can identify all affected targets": the audit and the UI drilldown can
// both still answer "why did THIS rumour move?" because the cause names it.
// `*` is the overflow form, used only when the set is larger than
// `MAX_NAMED_GROUP_MEMBERS`, and the readable then carries the count.

/** Above this, a grouped target degrades to the `kind:*` wildcard. */
export const MAX_NAMED_GROUP_MEMBERS = 12

export function groupedTarget(kind: string, ids: ReadonlyArray<string>): string {
  if (ids.length === 0) return `${kind}:*`
  if (ids.length === 1) return `${kind}:${ids[0]}`
  // Sorted so the same set always produces the same target string —
  // otherwise a reload that iterates a record map in a different order
  // would produce a different cause and break determinism.
  const sorted = [...ids].sort()
  if (sorted.length > MAX_NAMED_GROUP_MEMBERS) return `${kind}:*`
  return `${kind}:{${sorted.join(',')}}`
}

export function isGroupedTarget(target: string): boolean {
  return target.includes(':{') || target.endsWith(':*')
}

/** The `kind` half of any target form. */
export function targetKind(target: string): string | undefined {
  const colon = target.indexOf(':')
  return colon === -1 ? undefined : target.slice(0, colon)
}

/** The ids a grouped target names, or `undefined` for the wildcard form. */
export function groupedTargetMembers(
  target: string,
): ReadonlyArray<string> | undefined {
  const open = target.indexOf(':{')
  if (open === -1) return undefined
  const close = target.lastIndexOf('}')
  if (close <= open) return undefined
  return target
    .slice(open + 2, close)
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id.length > 0)
}

/**
 * Does a grouped cause target cover a single-element lookup target?
 *
 * Called from `targetMatches` in the causes module, so both the
 * unexplained-change audit and the UI drilldown resolve grouped causes the
 * same way. A cause is only ever matched WITHIN its kind: `rumour:*` must
 * not answer for `stock:ale`.
 */
export function groupedTargetCovers(
  groupTarget: string,
  lookupTarget: string,
): boolean {
  if (!isGroupedTarget(groupTarget)) return false
  const kind = targetKind(groupTarget)
  if (!kind || targetKind(lookupTarget) !== kind) return false

  // Strip any field suffix from the lookup: `rumour:r_brawl.strength`
  // should be answered by a group naming `r_brawl`.
  const rest = lookupTarget.slice(kind.length + 1)
  const id = rest.split('.')[0] ?? rest
  if (id.length === 0) return false

  if (groupTarget.endsWith(':*')) return true
  const members = groupedTargetMembers(groupTarget)
  return members ? members.includes(id) : false
}
