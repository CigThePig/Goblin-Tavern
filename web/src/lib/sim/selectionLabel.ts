// Phase 202 / audit Wave 3 (`P6-COMP-001`, `DC-02`) — what the player
// chose, in the words they read.
//
// Every confirmation surface used to render the engine's intent verb, so
// "Back Mira against the Ogres" came back as `noted: blame` and four
// unrelated commitments all as `noted: upgrade`. The verbs are valid
// engine intents; they are not a faithful record of a decision.
//
// One helper, used by both pending chips and by anything else that needs
// to name a pending decision, so the two cannot drift.

import { IGNORE_SELECTION_LABEL } from './intentBuilder'
import type { PendingChoice } from './daySession'

/**
 * The player-facing summary of a pending decision.
 *
 * An explicit Ignore reads as the deliberate refusal it is (`DC-02`) —
 * distinct from a card that was never answered, which has no pending
 * entry and so never reaches this function.
 */
export function selectionLabelOf(pending: PendingChoice): string {
  if (pending.kind === 'ignore') return IGNORE_SELECTION_LABEL
  const label = pending.choice.label.trim()
  // Fall back to the verb only if a template somehow shipped an empty
  // label — better a machine word than a blank confirmation.
  return label.length > 0 ? label : pending.verb
}
