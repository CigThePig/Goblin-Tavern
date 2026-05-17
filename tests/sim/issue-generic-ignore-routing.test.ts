import { describe, expect, it } from 'vitest'

import { selectConsequence } from '../../src/sim/modules/responses/selectConsequence'
import type { SelectableSeed } from '../../src/sim/modules/responses/selectConsequence'
import type {
  ConsequenceProfile,
  ResponseIntent,
  ResponseSlot,
} from '../../src/sim/modules/issues/issueSeedTypes'

// ISSUE-047 — the generic web Ignore button emits verb: 'ignore' with no
// `metadata.responseSlotId` for seeds that don't expose an explicit
// `id: 'ignore'` slot. A verb-only fallback in the matcher previously
// bound that intent to slots like staff_burnout's `push_through`
// (allowedVerbs: ['ignore'], shape: 'risky_profitable'), silently
// applying real delayed-burnout consequences. The matcher now stops
// after named-slot and (verb, shape) lookups — these tests pin that.

function makeSlot(partial: Partial<ResponseSlot> & Pick<ResponseSlot, 'id'>): ResponseSlot {
  return {
    labelHint: partial.labelHint ?? partial.id,
    allowedVerbs: partial.allowedVerbs ?? ['ignore'],
    shape: partial.shape ?? 'ignore',
    targetOptions: partial.targetOptions ?? [],
    expectedEffects: partial.expectedEffects ?? [],
    ...partial,
  }
}

function makeProfile(id: string, slotId: string): ConsequenceProfile {
  return {
    id,
    responseSlotId: slotId,
    immediateEffects: [],
    delayedEffects: [],
    memories: [],
    futureHooks: [],
    impactScore: 0,
  }
}

// Mirrors the four staff_burnout slots from
// src/sim/modules/issues/issueSeedGenerators.ts (~line 989) — the seed
// has NO `id: 'ignore'` slot; `push_through` is the modeled
// do-nothing-with-consequences path.
function staffBurnoutLikeSeed(): SelectableSeed {
  return {
    responseSlots: [
      makeSlot({ id: 'pay_bonus', allowedVerbs: ['pay'], shape: 'safe_costly' }),
      makeSlot({ id: 'reduce_workload', allowedVerbs: ['delegate'], shape: 'compromise' }),
      makeSlot({ id: 'push_through', allowedVerbs: ['ignore'], shape: 'risky_profitable' }),
      makeSlot({ id: 'reassign', allowedVerbs: ['delegate'], shape: 'compromise' }),
    ],
    consequenceProfiles: [
      makeProfile('pay_bonus_profile', 'pay_bonus'),
      makeProfile('reduce_workload_profile', 'reduce_workload'),
      makeProfile('push_through_profile', 'push_through'),
      makeProfile('reassign_profile', 'reassign'),
    ],
  }
}

function genericIgnoreIntent(): ResponseIntent {
  // Mirrors web/src/lib/sim/intentBuilder.ts buildIgnoreIntent — but
  // without metadata.responseSlotId, exercising the worst case the
  // matcher must defend against.
  return {
    id: 'r-generic-ignore',
    seedId: 'staff-burnout-1',
    verb: 'ignore',
    shape: 'ignore',
    tags: ['player_ignored'],
    intensity: 0,
  }
}

describe('ISSUE-047 — selectConsequence does not verb-fallback to non-ignore slots', () => {
  it('generic ignore intent does not bind staff_burnout `push_through`', () => {
    const { slot, profile } = selectConsequence(
      staffBurnoutLikeSeed(),
      genericIgnoreIntent(),
    )
    expect(slot).toBeUndefined()
    expect(profile).toBeUndefined()
  })

  it('named-slot lookup still binds `push_through` when responseSlotId is set', () => {
    const intent: ResponseIntent = {
      id: 'r-push-through',
      seedId: 'staff-burnout-1',
      verb: 'ignore',
      shape: 'risky_profitable',
      tags: [],
      intensity: 50,
      metadata: { responseSlotId: 'push_through' },
    }
    const { slot, profile } = selectConsequence(staffBurnoutLikeSeed(), intent)
    expect(slot?.id).toBe('push_through')
    expect(profile?.id).toBe('push_through_profile')
  })

  it('(verb, shape) combo still binds when both match exactly without responseSlotId', () => {
    const intent: ResponseIntent = {
      id: 'r-combo',
      seedId: 'staff-burnout-1',
      verb: 'ignore',
      shape: 'risky_profitable',
      tags: [],
      intensity: 50,
    }
    const { slot, profile } = selectConsequence(staffBurnoutLikeSeed(), intent)
    expect(slot?.id).toBe('push_through')
    expect(profile?.id).toBe('push_through_profile')
  })
})
