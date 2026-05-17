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
    metadata: { responseSlotId: choice.slotId },
  }
  if (target) intent.target = target
  return intent
}

export function buildIgnoreIntent(seed: IssueSeed): ResponseIntent {
  return {
    id: nextIntentId(),
    seedId: seed.id,
    verb: 'ignore',
    shape: 'ignore',
    tags: ['player_ignored'],
    intensity: 0,
    metadata: { responseSlotId: 'ignore' },
  }
}
