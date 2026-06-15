import { beforeEach, describe, expect, it } from 'vitest'

import { gameStore } from '../../web/src/lib/sim/gameStore.svelte'
import { buildResponseIntents } from '../../web/src/lib/sim/intentBuilder'
import type { PendingChoice } from '../../web/src/lib/sim/daySession'
import {
  createInitialIssueSeedModuleState,
  type IssueSeed,
  type IssueSeedModuleState,
} from '../../src/sim/modules/issues/issueSeedTypes'
import { ISSUE_SEEDS_MODULE_ID } from '../../src/sim/modules/issues/issueSeedQueries'
import type { CardChoice } from '../../web/src/lib/cards/types'

// Phase 2 (teleology) follow-up — the WEB path must build response intents
// against the resolvable seed set, not the visible hand alone.
//
// The engine fix (`getResolvableSeedsToday`) only helps if an intent is
// actually constructed for a displaced seed. The interactive DayScreen used
// to iterate the three visible-hand slices (`morningSeeds/serviceSeeds/
// closingSeeds`), all derived from `seedsToday`. On a crowded day Segment B
// can displace a seed from the budgeted hand AFTER the player chose against
// its card; the choice stays in `pendingBySeedId` but, with no seed in the
// visible slices, no intent was built and the valid choice was silently
// dropped. `buildResponseIntents(gameStore.resolvableSeeds, …)` fixes that.

// A minimal seed carrying one resolvable slot, enough for `buildIntent`.
function seedWithSlot(id: string): IssueSeed {
  return {
    id,
    responseSlots: [
      {
        id: 'slot-1',
        targetOptions: [{ kind: 'area', id: 'kitchen' }],
      },
    ],
  } as unknown as IssueSeed
}

function installSlice(slice: IssueSeedModuleState): void {
  gameStore.state.modules[ISSUE_SEEDS_MODULE_ID] = slice
}

describe('teleology phase 2 — web intents resolve displaced seeds', () => {
  beforeEach(() => {
    gameStore.reset('resolvable-intents-seed')
  })

  it('resolvableSeeds unions the visible hand with displaced surfaced seeds', () => {
    const displaced = seedWithSlot('displaced')
    const visible = seedWithSlot('visible')
    installSlice({
      ...createInitialIssueSeedModuleState(),
      seedsToday: [visible],
      surfacedToday: [displaced, visible],
    })

    const ids = gameStore.resolvableSeeds.map((s) => s.id)
    expect(ids).toContain('displaced')
    expect(ids).toContain('visible')
  })

  it('builds an intent for a pending choice against a displaced seed', () => {
    const displaced = seedWithSlot('displaced')
    const visible = seedWithSlot('visible')
    installSlice({
      ...createInitialIssueSeedModuleState(),
      // `displaced` is NOT in the visible hand — only surfaced. The old
      // visible-hand-only loop would have skipped it.
      seedsToday: [visible],
      surfacedToday: [displaced, visible],
    })

    const choice: CardChoice = {
      slotId: 'slot-1',
      label: 'Scrub it',
      verb: 'clean',
      targetId: 'kitchen',
      shape: 'safe_costly',
      previewEffects: [],
    }
    const pendingBySeedId: Record<string, PendingChoice> = {
      displaced: { kind: 'choice', slotId: 'slot-1', verb: 'clean', choice },
    }

    const intents = buildResponseIntents(
      gameStore.resolvableSeeds,
      pendingBySeedId,
    )
    expect(intents).toHaveLength(1)
    expect(intents[0]?.seedId).toBe('displaced')
    expect(intents[0]?.verb).toBe('clean')
    // The resolved target is carried through from the seed's slot.
    expect(intents[0]?.target).toEqual({ kind: 'area', id: 'kitchen' })
  })

  it('builds an ignore intent for a displaced seed the player dismissed', () => {
    const displaced = seedWithSlot('displaced')
    installSlice({
      ...createInitialIssueSeedModuleState(),
      seedsToday: [],
      surfacedToday: [displaced],
    })

    const intents = buildResponseIntents(gameStore.resolvableSeeds, {
      displaced: { kind: 'ignore' },
    })
    expect(intents).toHaveLength(1)
    expect(intents[0]?.seedId).toBe('displaced')
    expect(intents[0]?.verb).toBe('ignore')
  })

  it('emits no intent for a seed without a pending decision', () => {
    installSlice({
      ...createInitialIssueSeedModuleState(),
      seedsToday: [seedWithSlot('untouched')],
      surfacedToday: [seedWithSlot('untouched')],
    })
    expect(buildResponseIntents(gameStore.resolvableSeeds, {})).toHaveLength(0)
  })
})
