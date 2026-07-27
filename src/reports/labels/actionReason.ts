// Phase 204 / audit Wave 5 (`P6-COMP-007`) — the controlled vocabulary for
// engine rejection reasons.
//
// This lived in `web/src/lib/sim/actionBuilder.ts`, so only the components
// that remembered to call it were protected: the Tavern projections handed
// their `disabledReason` straight to whichever surface rendered it, and one
// row in `ProjectsPanel` showed `adjust_prices requires a numeric amount
// delta` verbatim. Moving it beside the other id→label tables lets the
// PROJECTION emit player-ready text, so a new consumer cannot reintroduce
// the leak by forgetting a call.
//
// Idempotent by construction: already-humanized copy carries no leading
// machine token and no underscores, so a second pass returns it unchanged
// (the web helper re-exports this, and several call sites still apply it).

/**
 * Translate an engine rejection reason into player-facing copy.
 *
 * `canApply` reasons are written for the engine and tests
 * ("adjust_prices requires a numeric amount delta"); shown raw they read
 * like crashes. Actions that need extra input (an amount, a runner) have
 * dedicated flows on the Tavern screen — point the player there instead
 * of echoing the validation internals. Unknown reasons fall back to a
 * light cleanup (underscores stripped) so future engine strings degrade
 * gracefully rather than leaking ids.
 */
export function humanizeActionReason(reason: string): string {
  if (/requires a numeric amount/i.test(reason)) {
    return 'Set per item from Tavern → Stock'
  }
  if (/requires a runner/i.test(reason)) {
    return 'Commission from Tavern → Stock — pick a runner there'
  }
  if (/targetId|target id/i.test(reason)) {
    return 'Needs a specific target — pick one from the Tavern screen'
  }
  // Generic cleanup: drop a leading machine id token ("some_action_id
  // cannot …" → "Cannot …") and strip remaining underscores.
  const cleaned = reason
    .replace(/^[a-z0-9]+(?:_[a-z0-9]+)+\s+/, '')
    .replace(/_/g, ' ')
    .trim()
  if (!cleaned) return reason.replace(/_/g, ' ')
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
}
