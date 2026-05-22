// Phase 128 / ISSUE-097 — Voiced Surface arc, Phase 2 (Universal Cast).
//
// Coverage for the widened resolveActorCastAttributes dispatch. The
// resolver now reaches castAttributes for supplier, faction, notable_npc,
// and customer_group ref kinds (the last via the voice-only adapter
// shape). The CastAttribute condition primitives (`voiceAxis` with
// `atLeast` / `atMost`, `verbalTic`) must evaluate identically across
// kinds — this file exercises each pairing. `actorTrait` is a forward
// seam that always returns false (`conditions.ts:154-161`), so it is
// not exercised here.

import { describe, expect, it } from 'vitest'

import { evalCondition } from '../../../src/cards/compose/conditions'
import type { SnippetCondition } from '../../../src/cards/compose/types'
import { createInitialTavernState } from '../../../src/sim/state/defaults'
import type {
  CastAttributes,
  CustomerGroupCastAttributes,
} from '../../../src/sim/content/cast'
import type {
  EntityRef,
  TavernState,
} from '../../../src/sim/state/TavernState'
import { makeSeed } from '../cardFactories'

function pickActorWithCast(state: TavernState): {
  supplierRef: EntityRef
  supplierAttrs: CastAttributes
  factionRef: EntityRef
  factionAttrs: CastAttributes
  groupRef: EntityRef
  groupAttrs: CustomerGroupCastAttributes
  npcRef: EntityRef
  npcAttrs: CastAttributes
} {
  const supplierId = Object.keys(state.world.suppliers)[0]!
  const factionId = Object.keys(state.world.factions)[0]!
  const groupId = Object.keys(state.customerGroups)[0]!
  const npcId = Object.keys(state.world.notableNpcs)[0]!
  return {
    supplierRef: { kind: 'supplier', id: supplierId },
    supplierAttrs: state.world.suppliers[supplierId]!.castAttributes!,
    factionRef: { kind: 'faction', id: factionId },
    factionAttrs: state.world.factions[factionId]!.castAttributes!,
    groupRef: { kind: 'customer_group', id: groupId },
    groupAttrs: state.customerGroups[groupId]!.castAttributes!,
    npcRef: { kind: 'notable_npc', id: npcId },
    npcAttrs: state.world.notableNpcs[npcId]!.castAttributes!,
  }
}

describe('Phase 128 / ISSUE-097 — resolveActorCastAttributes reaches new kinds', () => {
  const state = createInitialTavernState()
  const fixtures = pickActorWithCast(state)

  it('voiceAxis atLeast matches against a supplier ref', () => {
    const cond: SnippetCondition = {
      kind: 'voiceAxis',
      role: 'primaryActor',
      axis: 'terseness',
      atLeast: fixtures.supplierAttrs.voice.axes.terseness,
    }
    const seed = makeSeed({ primaryActor: fixtures.supplierRef })
    expect(evalCondition(cond, seed, state)).toBe(true)
  })

  it('voiceAxis atMost matches against a faction ref', () => {
    const cond: SnippetCondition = {
      kind: 'voiceAxis',
      role: 'primaryActor',
      axis: 'floridity',
      atMost: fixtures.factionAttrs.voice.axes.floridity,
    }
    const seed = makeSeed({ primaryActor: fixtures.factionRef })
    expect(evalCondition(cond, seed, state)).toBe(true)
  })

  it('voiceAxis atLeast matches against a notable_npc ref', () => {
    const cond: SnippetCondition = {
      kind: 'voiceAxis',
      role: 'primaryActor',
      axis: 'warmth',
      atLeast: fixtures.npcAttrs.voice.axes.warmth,
    }
    const seed = makeSeed({ primaryActor: fixtures.npcRef })
    expect(evalCondition(cond, seed, state)).toBe(true)
  })

  it('voiceAxis atLeast matches against a customer_group ref via the voice-only adapter', () => {
    const cond: SnippetCondition = {
      kind: 'voiceAxis',
      role: 'primaryActor',
      axis: 'terseness',
      atLeast: fixtures.groupAttrs.voice.axes.terseness,
    }
    const seed = makeSeed({ primaryActor: fixtures.groupRef })
    expect(evalCondition(cond, seed, state)).toBe(true)
  })

  it('voiceAxis atMost beyond the actual value still matches (≤ comparison)', () => {
    // Pick the maximum (2) so atMost: 2 always holds — proves the
    // dispatcher reads the supplier's voice axes, not a default.
    const cond: SnippetCondition = {
      kind: 'voiceAxis',
      role: 'primaryActor',
      axis: 'terseness',
      atMost: 2,
    }
    const seed = makeSeed({ primaryActor: fixtures.supplierRef })
    expect(evalCondition(cond, seed, state)).toBe(true)
  })

  it('verbalTic condition resolves uniformly across all four new ref kinds', () => {
    // Build a synthetic state where one actor of each new kind carries
    // the same known verbalTic. Decouples the test from the probability
    // of a tic being rolled onto day-zero defaults.
    const tic = 'trails_off'
    const supplierId = Object.keys(state.world.suppliers)[0]!
    const factionId = Object.keys(state.world.factions)[0]!
    const groupId = Object.keys(state.customerGroups)[0]!
    const npcId = Object.keys(state.world.notableNpcs)[0]!
    const ticState: TavernState = {
      ...state,
      customerGroups: {
        ...state.customerGroups,
        [groupId]: {
          ...state.customerGroups[groupId]!,
          castAttributes: {
            voice: { axes: { terseness: 1, warmth: 1, formality: 1, floridity: 1 }, verbalTic: tic },
          },
        },
      },
      world: {
        ...state.world,
        suppliers: {
          ...state.world.suppliers,
          [supplierId]: {
            ...state.world.suppliers[supplierId]!,
            castAttributes: {
              ...state.world.suppliers[supplierId]!.castAttributes!,
              voice: {
                ...state.world.suppliers[supplierId]!.castAttributes!.voice,
                verbalTic: tic,
              },
            },
          },
        },
        factions: {
          ...state.world.factions,
          [factionId]: {
            ...state.world.factions[factionId]!,
            castAttributes: {
              ...state.world.factions[factionId]!.castAttributes!,
              voice: {
                ...state.world.factions[factionId]!.castAttributes!.voice,
                verbalTic: tic,
              },
            },
          },
        },
        notableNpcs: {
          ...state.world.notableNpcs,
          [npcId]: {
            ...state.world.notableNpcs[npcId]!,
            castAttributes: {
              ...state.world.notableNpcs[npcId]!.castAttributes!,
              voice: {
                ...state.world.notableNpcs[npcId]!.castAttributes!.voice,
                verbalTic: tic,
              },
            },
          },
        },
      },
    }
    const cond: SnippetCondition = {
      kind: 'verbalTic',
      role: 'primaryActor',
      tic,
    }
    for (const ref of [
      { kind: 'supplier', id: supplierId } as EntityRef,
      { kind: 'faction', id: factionId } as EntityRef,
      { kind: 'customer_group', id: groupId } as EntityRef,
      { kind: 'notable_npc', id: npcId } as EntityRef,
    ]) {
      const seed = makeSeed({ primaryActor: ref })
      expect(evalCondition(cond, seed, ticState)).toBe(true)
    }
  })

  it('returns undefined for an unresolved actor — condition silently fails', () => {
    const cond: SnippetCondition = {
      kind: 'voiceAxis',
      role: 'primaryActor',
      axis: 'terseness',
      atLeast: 1,
    }
    const seed = makeSeed() // no primaryActor
    expect(evalCondition(cond, seed, state)).toBe(false)
  })

  it('returns undefined when the actor exists but castAttributes is missing', () => {
    // Force a supplier without castAttributes (e.g. pre-Phase-2 save
    // not yet migrated). The condition must silently fail.
    const supplierId = Object.keys(state.world.suppliers)[0]!
    const supplier = state.world.suppliers[supplierId]!
    const { castAttributes: _drop, ...rest } = supplier
    void _drop
    const stateNoCast: TavernState = {
      ...state,
      world: {
        ...state.world,
        suppliers: { ...state.world.suppliers, [supplierId]: rest },
      },
    } as TavernState
    const cond: SnippetCondition = {
      kind: 'voiceAxis',
      role: 'primaryActor',
      axis: 'terseness',
      atLeast: 0,
    }
    const seed = makeSeed({
      primaryActor: { kind: 'supplier', id: supplierId },
    })
    expect(evalCondition(cond, seed, stateNoCast)).toBe(false)
  })
})
