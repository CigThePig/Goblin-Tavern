// Phase 88 — Convert a CardChoice into a ResponseIntent the engine
// accepts.
//
// The engine's responsesModule looks up the slot via
// `intent.metadata.responseSlotId` first (selectConsequence.ts:30), so
// embedding that id is the most reliable binding. We also include the
// resolved EntityRef when the choice carries a targetId that maps onto
// one of the slot's targetOptions.
//
// Ignore intents are emitted by `buildIgnoreIntent` — the engine sees
// `verb: 'ignore'` and currently treats it as a no-op (the responses
// module logs and skips when no matching slot exists). Always-emit
// keeps the player's "I chose to ignore this" decision auditable from
// the responses report even when the simulation ignores the intent.

import type {
  IssueSeed,
  ResponseIntent,
} from '../../../../src/sim/modules/issues/issueSeedTypes'
import type { CardChoice } from '../cards/types'
import type { PendingChoice } from './daySession'

let counter = 0

function nextIntentId(): string {
  counter += 1
  return `web-intent-${Date.now().toString(36)}-${counter.toString(36)}`
}

export function buildIntent(
  seed: IssueSeed,
  choice: CardChoice,
): ResponseIntent {
  const slot = seed.responseSlots.find((s) => s.id === choice.slotId)
  const target = slot?.targetOptions.find((t) => t.id === choice.targetId)
  const intent: ResponseIntent = {
    id: nextIntentId(),
    seedId: seed.id,
    verb: choice.verb,
    shape: choice.shape,
    tags: [],
    intensity: 1,
    metadata: {
      responseSlotId: choice.slotId,
      // Phase 202 / audit Wave 3 (`P6-COMP-001`) — the player's own words
      // travel with the intent, so the resolved record and the report can
      // repeat the choice instead of the engine's verb.
      selectionLabel: choice.label,
      ...(target ? { targetRef: { kind: target.kind, id: target.id } } : {}),
    },
  }
  if (target) intent.target = target
  return intent
}

/**
 * Phase 202 / audit Wave 3, `DC-02` — an explicit Ignore is a DECISION,
 * and is recorded as one. A card the player simply never answered leaves
 * no resolved-intent record at all, so the day's ledger can tell a
 * considered pass apart from a card that was never reached.
 */
export const IGNORE_SELECTION_LABEL = 'You let it stand'

export function buildIgnoreIntent(seed: IssueSeed): ResponseIntent {
  return {
    id: nextIntentId(),
    seedId: seed.id,
    verb: 'ignore',
    shape: 'ignore',
    tags: ['player_ignored'],
    intensity: 0,
    metadata: {
      responseSlotId: 'ignore',
      selectionLabel: IGNORE_SELECTION_LABEL,
    },
  }
}

/**
 * Phase 2 (teleology) — flush the player's pending day-decisions into the
 * response intents Segment C consumes. Built against the *resolvable* seed
 * set (visible hand ∪ surfaced-but-displaced), not the visible hand alone:
 * on a crowded day the budget can displace a seed from `seedsToday` after
 * the player already chose against its card, so iterating only the visible
 * slices would silently drop that valid choice (the engine's
 * `getResolvableSeedsToday` lookup would never be reached because no intent
 * was constructed for it). Iterating the resolvable set keeps a displaced
 * seed's pending choice resolvable, mirroring the engine's `findSeed`.
 *
 * Pure so it is unit-testable away from the Svelte component; iterates the
 * seed set (preserving its ranked order) and emits one intent per seed that
 * carries a pending decision.
 */
export function buildResponseIntents(
  resolvableSeeds: IssueSeed[],
  pendingBySeedId: Record<string, PendingChoice>,
): ResponseIntent[] {
  const intents: ResponseIntent[] = []
  for (const seed of resolvableSeeds) {
    const pending = pendingBySeedId[seed.id]
    if (!pending) continue
    if (pending.kind === 'ignore') {
      intents.push(buildIgnoreIntent(seed))
    } else {
      intents.push(buildIntent(seed, pending.choice))
    }
  }
  return intents
}
