// Phase 139 / ISSUE-108 — Voiced Surface arc, Phase 13 (Reputation, Rumour & Rivals).
//
// Integration tests for `rumourCrisisCard` — the first dedicated card
// for the `rumour_crisis.rumour` seed family (pre-Phase 13 these
// seeds routed to `fallbackCard`). Actor-voiced via the target's
// Phase-128 castAttributes; the predicate accepts any of supplier /
// regular / faction / staff / customer_group / notable_npc and
// rejects `tavern_identity` / `rumour` / `system` (no castAttributes).

import { describe, expect, it } from 'vitest'

import { rumourCrisisCard, fallbackCard } from '../../src/cards/index'
import { pickCardForSeed } from '../../src/cards/selection'
import {
  rumourCrisisEstablishingLinePool,
  rumourCrisisReactionLinePool,
} from '../../src/cards/compose/pools/rumourCrisis'
import { REQUIRED_CARDS } from '../../src/cards/templates/index'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import type {
  CastAttributes,
  CustomerGroupCastAttributes,
  FactionCastAttributes,
  SupplierCastAttributes,
} from '../../src/sim/content/cast'
import type {
  IssueSeed,
  IssueSeedFamilyId,
} from '../../src/sim/modules/issues/issueSeedTypes'
import type {
  EntityRef,
  TavernState,
} from '../../src/sim/state/TavernState'
import { makeSeed } from './cardFactories'

function firstSupplierId(state: TavernState): string {
  const id = Object.keys(state.world.suppliers)[0]
  if (!id) throw new Error('test setup expects at least one supplier')
  return id
}
function firstRegularId(state: TavernState): string {
  const id = Object.keys(state.world.regulars)[0]
  if (!id) throw new Error('test setup expects at least one regular')
  return id
}
function firstFactionId(state: TavernState): string {
  const id = Object.keys(state.world.factions)[0]
  if (!id) throw new Error('test setup expects at least one faction')
  return id
}
function firstCustomerGroupId(state: TavernState): string {
  const id = Object.keys(state.customerGroups)[0]
  if (!id) throw new Error('test setup expects at least one customer group')
  return id
}

function withSupplierCast(
  state: TavernState,
  supplierId: string,
  cast: SupplierCastAttributes | undefined,
): TavernState {
  const existing = state.world.suppliers[supplierId]!
  const next = cast === undefined
    ? (() => {
        const { castAttributes: _strip, ...rest } = existing
        void _strip
        return rest
      })()
    : { ...existing, castAttributes: cast }
  return {
    ...state,
    world: {
      ...state.world,
      suppliers: { ...state.world.suppliers, [supplierId]: next },
    },
  }
}

function withFactionCast(
  state: TavernState,
  factionId: string,
  cast: FactionCastAttributes | undefined,
): TavernState {
  const existing = state.world.factions[factionId]!
  const next = cast === undefined
    ? (() => {
        const { castAttributes: _strip, ...rest } = existing
        void _strip
        return rest
      })()
    : { ...existing, castAttributes: cast }
  return {
    ...state,
    world: {
      ...state.world,
      factions: { ...state.world.factions, [factionId]: next },
    },
  }
}

function withGroupCast(
  state: TavernState,
  groupId: string,
  cast: CustomerGroupCastAttributes | undefined,
): TavernState {
  const existing = state.customerGroups[groupId]!
  const next = cast === undefined
    ? (() => {
        const { castAttributes: _strip, ...rest } = existing
        void _strip
        return rest
      })()
    : { ...existing, castAttributes: cast }
  return {
    ...state,
    customerGroups: { ...state.customerGroups, [groupId]: next },
  }
}

function withRegularCast(
  state: TavernState,
  regularId: string,
  cast: CastAttributes | undefined,
): TavernState {
  const existing = state.world.regulars[regularId]!
  const next = cast === undefined
    ? (() => {
        const { castAttributes: _strip, ...rest } = existing
        void _strip
        return rest
      })()
    : { ...existing, castAttributes: cast }
  return {
    ...state,
    world: {
      ...state.world,
      regulars: { ...state.world.regulars, [regularId]: next },
    },
  }
}

function supplierRef(id: string): EntityRef {
  return { kind: 'supplier', id }
}
function regularRef(id: string): EntityRef {
  return { kind: 'regular', id }
}
function factionRef(id: string): EntityRef {
  return { kind: 'faction', id }
}
function customerGroupRef(id: string): EntityRef {
  return { kind: 'customer_group', id }
}
function tavernIdentityRef(id: string): EntityRef {
  return { kind: 'tavern_identity', id }
}
function rumourRef(id: string): EntityRef {
  return { kind: 'rumour', id }
}

function rumourSeed(
  primaryActor: EntityRef | undefined,
  id = 'rumour-seed',
  overrides: { domain?: string[]; severity?: number } = {},
): IssueSeed {
  const domain = overrides.domain ?? [
    'rumours',
    'reputation',
    'social',
    'rumour.partial',
    `rumour.target.${primaryActor?.kind ?? 'tavern_identity'}`,
  ]
  return makeSeed({
    id,
    family: 'rumour_crisis' as IssueSeedFamilyId,
    type: 'rumour',
    timing: 'closing',
    severity: overrides.severity ?? 50,
    domain,
    toneHints: ['rumour', 'reputation'],
    ...(primaryActor ? { primaryActor } : {}),
    responseSlots: [
      {
        id: `${id}-deny`,
        labelHint: 'Deny the rumour',
        allowedVerbs: ['rebrand'],
        shape: 'reputation_play',
        targetOptions: primaryActor ? [primaryActor] : [],
        expectedEffects: ['shift attribution', 'risk credibility'],
      },
      {
        id: `${id}-confess`,
        labelHint: 'Confess partial truth',
        allowedVerbs: ['confess'],
        shape: 'relationship_sacrifice',
        targetOptions: primaryActor ? [primaryActor] : [],
        expectedEffects: ['lower distrust', 'admit fault'],
      },
    ],
    consequenceProfiles: [
      {
        id: `${id}-deny-profile`,
        responseSlotId: `${id}-deny`,
        immediateEffects: [
          {
            kind: 'pressure',
            target: 'pressure:rumour_pressure',
            amount: -10,
            readable: 'public denial blunts rumour',
            tags: ['pressure'],
          },
          {
            kind: 'state_change',
            target: 'reputation.respectable',
            amount: -6,
            readable: 'credibility takes a hit',
            tags: ['reputation'],
          },
        ],
        delayedEffects: [],
        memories: [],
        futureHooks: [],
        impactScore: 5,
      },
      {
        id: `${id}-confess-profile`,
        responseSlotId: `${id}-confess`,
        immediateEffects: [
          {
            kind: 'pressure',
            target: 'pressure:rumour_pressure',
            amount: -15,
            readable: 'honesty disarms the rumour',
            tags: ['pressure'],
          },
          {
            kind: 'state_change',
            target: 'reputation.respectable',
            amount: 8,
            readable: 'audience respects candour',
            tags: ['reputation'],
          },
        ],
        delayedEffects: [],
        memories: [],
        futureHooks: [],
        impactScore: 5,
      },
    ],
    textIngredients: {
      subject: 'a spreading rumour',
      sensoryDetails: ['whispered word', 'turned heads'],
      recentContext: ['accuracy: partial'],
      stakesReadable: ['rumour may spread', 'reputation may rot'],
    },
  })
}

const ESTABLISHING_TEXTS = new Set(
  rumourCrisisEstablishingLinePool.snippets.map((s) => s.text),
)
const REACTION_TEXTS = new Set(
  rumourCrisisReactionLinePool.snippets.map((s) => s.text),
)

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length
}

describe('rumourCrisisCard — appliesTo', () => {
  const state = createInitialTavernState()

  it('is registered in REQUIRED_CARDS', () => {
    expect(REQUIRED_CARDS).toContain(rumourCrisisCard)
  })

  it('matches a supplier-target seed when the supplier carries castAttributes', () => {
    const supplierId = firstSupplierId(state)
    const seed = rumourSeed(supplierRef(supplierId))
    const chosen = pickCardForSeed(seed, state, REQUIRED_CARDS)
    expect(chosen?.id).toBe(rumourCrisisCard.id)
  })

  it('matches a regular-target seed when the regular carries castAttributes', () => {
    const regularId = firstRegularId(state)
    const seed = rumourSeed(regularRef(regularId), 'rumour-regular')
    const chosen = pickCardForSeed(seed, state, REQUIRED_CARDS)
    expect(chosen?.id).toBe(rumourCrisisCard.id)
  })

  it('matches a faction-target seed when the faction carries castAttributes', () => {
    const factionId = firstFactionId(state)
    const seed = rumourSeed(factionRef(factionId), 'rumour-faction')
    const chosen = pickCardForSeed(seed, state, REQUIRED_CARDS)
    expect(chosen?.id).toBe(rumourCrisisCard.id)
  })

  it('matches a customer-group-target seed when the group carries castAttributes', () => {
    const groupId = firstCustomerGroupId(state)
    const seed = rumourSeed(customerGroupRef(groupId), 'rumour-group')
    const chosen = pickCardForSeed(seed, state, REQUIRED_CARDS)
    expect(chosen?.id).toBe(rumourCrisisCard.id)
  })

  it('declines a tavern_identity seed (no primaryActor / no castAttributes path)', () => {
    const seed = rumourSeed(undefined, 'rumour-tavern-identity')
    const chosen = pickCardForSeed(seed, state, REQUIRED_CARDS)
    expect(chosen?.id).not.toBe(rumourCrisisCard.id)
    expect(chosen?.id).toBe(fallbackCard.id)
  })

  it('declines a rumour-subject seed (rumour kind has no castAttributes)', () => {
    const seed = rumourSeed(rumourRef('ale_quality_rumour'), 'rumour-rumour-subject')
    const chosen = pickCardForSeed(seed, state, REQUIRED_CARDS)
    expect(chosen?.id).not.toBe(rumourCrisisCard.id)
    expect(chosen?.id).toBe(fallbackCard.id)
  })

  it('declines a supplier-target seed whose supplier has no castAttributes', () => {
    const supplierId = firstSupplierId(state)
    const castless = withSupplierCast(state, supplierId, undefined)
    const seed = rumourSeed(supplierRef(supplierId), 'rumour-supplier-castless')
    const chosen = pickCardForSeed(seed, castless, REQUIRED_CARDS)
    expect(chosen?.id).not.toBe(rumourCrisisCard.id)
    expect(chosen?.id).toBe(fallbackCard.id)
  })

  it('declines a faction-target seed whose faction has no castAttributes', () => {
    const factionId = firstFactionId(state)
    const castless = withFactionCast(state, factionId, undefined)
    const seed = rumourSeed(factionRef(factionId), 'rumour-faction-castless')
    const chosen = pickCardForSeed(seed, castless, REQUIRED_CARDS)
    expect(chosen?.id).not.toBe(rumourCrisisCard.id)
    expect(chosen?.id).toBe(fallbackCard.id)
  })

  it('declines a group-target seed whose group has no castAttributes', () => {
    const groupId = firstCustomerGroupId(state)
    const castless = withGroupCast(state, groupId, undefined)
    const seed = rumourSeed(customerGroupRef(groupId), 'rumour-group-castless')
    const chosen = pickCardForSeed(seed, castless, REQUIRED_CARDS)
    expect(chosen?.id).not.toBe(rumourCrisisCard.id)
    expect(chosen?.id).toBe(fallbackCard.id)
  })

  it('declines a regular-target seed whose regular has no castAttributes', () => {
    const regularId = firstRegularId(state)
    const castless = withRegularCast(state, regularId, undefined)
    const seed = rumourSeed(regularRef(regularId), 'rumour-regular-castless')
    const chosen = pickCardForSeed(seed, castless, REQUIRED_CARDS)
    expect(chosen?.id).not.toBe(rumourCrisisCard.id)
    expect(chosen?.id).toBe(fallbackCard.id)
  })
})

describe('rumourCrisisCard — render output', () => {
  it('body[0] is the sim-backed establishing line; body[1] is the voiced reaction', () => {
    const state = createInitialTavernState()
    const supplierId = firstSupplierId(state)
    const seed = rumourSeed(supplierRef(supplierId))
    const view = rumourCrisisCard.render(seed, state)
    expect(view.body[0]).toBeDefined()
    expect(view.body[1]).toBeDefined()
    expect(ESTABLISHING_TEXTS.has(view.body[0]!)).toBe(true)
    expect(REACTION_TEXTS.has(view.body[1]!)).toBe(true)
    expect(wordCount(view.body[0]!)).toBeLessThanOrEqual(14)
    expect(wordCount(view.body[1]!)).toBeLessThanOrEqual(12)
  })

  it('body never surfaces raw textIngredients fragments', () => {
    const state = createInitialTavernState()
    const supplierId = firstSupplierId(state)
    const seed = rumourSeed(supplierRef(supplierId))
    const view = rumourCrisisCard.render(seed, state)
    for (const line of view.body) {
      expect(line).not.toBe('whispered word')
      expect(line).not.toBe('turned heads')
      expect(line).not.toBe('accuracy: partial')
    }
  })

  it('title centres on the supplier display and never truncates with "…"', () => {
    const state = createInitialTavernState()
    const supplierId = firstSupplierId(state)
    const seed = rumourSeed(supplierRef(supplierId))
    const view = rumourCrisisCard.render(seed, state)
    const display = state.world.suppliers[supplierId]!.name?.display
      ?? state.world.suppliers[supplierId]!.label
    expect(view.title.toLowerCase()).toContain(display.split(' ')[0]!.toLowerCase())
    expect(view.title).not.toContain('…')
    expect(view.title).not.toContain('...')
  })

  it('preserves choice mechanical truth (verb, target, effects)', () => {
    const state = createInitialTavernState()
    const supplierId = firstSupplierId(state)
    const seed = rumourSeed(supplierRef(supplierId))
    const view = rumourCrisisCard.render(seed, state)
    expect(view.choices.length).toBe(seed.responseSlots.length)
    for (const [i, choice] of view.choices.entries()) {
      const slot = seed.responseSlots[i]!
      expect(choice.verb).toBe(slot.allowedVerbs[0])
    }
  })

  it('is deterministic — same seed + state ⇒ identical CardView', () => {
    const state = createInitialTavernState()
    const supplierId = firstSupplierId(state)
    const seed = rumourSeed(supplierRef(supplierId), 'rumour-deterministic')
    const a = rumourCrisisCard.render(seed, state)
    const b = rumourCrisisCard.render(seed, state)
    expect(a.title).toBe(b.title)
    expect(a.body).toEqual(b.body)
    expect(a.choices).toEqual(b.choices)
  })

  it('does not mutate state', () => {
    const state = createInitialTavernState()
    const supplierId = firstSupplierId(state)
    const seed = rumourSeed(supplierRef(supplierId))
    const before = JSON.stringify(state)
    rumourCrisisCard.render(seed, state)
    expect(JSON.stringify(state)).toBe(before)
  })
})

describe('rumourCrisisCard — pools shape', () => {
  it('reaction_line pool is actor-aware (voice axes drive variants)', () => {
    const hasVoiceCondition = rumourCrisisReactionLinePool.snippets.some((s) =>
      s.conditions.some(
        (c) => c.kind === 'voiceAxis' || c.kind === 'verbalTic',
      ),
    )
    expect(hasVoiceCondition).toBe(true)
  })

  it('establishing_line gates on Phase-13 accuracy and target-kind tags', () => {
    const reachesAccuracyFalse = rumourCrisisEstablishingLinePool.snippets.some((s) =>
      s.conditions.some((c) => c.kind === 'hasTag' && c.tag === 'rumour.false'),
    )
    const reachesTargetSupplier = rumourCrisisEstablishingLinePool.snippets.some(
      (s) =>
        s.conditions.some(
          (c) => c.kind === 'hasTag' && c.tag === 'rumour.target.supplier',
        ),
    )
    expect(reachesAccuracyFalse).toBe(true)
    expect(reachesTargetSupplier).toBe(true)
  })
})
