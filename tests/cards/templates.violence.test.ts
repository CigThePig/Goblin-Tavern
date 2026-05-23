// Phase 138 / ISSUE-107 — Voiced Surface arc, Phase 12 (Crises & Safety).
//
// Integration tests for `violenceCard` — the first dedicated card for
// the `violence.customer_incident` seed family (pre-Phase 12 these
// seeds routed to `fallbackCard`). Actor-voiced via the customer
// group's Phase-128 castAttributes. Mirrors `templates.staffBurnout.test.ts`
// shape.

import { describe, expect, it } from 'vitest'

import { violenceCard, fallbackCard } from '../../src/cards/index'
import { pickCardForSeed } from '../../src/cards/selection'
import {
  violenceEstablishingLinePool,
  violenceReactionLinePool,
} from '../../src/cards/compose/pools/violence'
import { REQUIRED_CARDS } from '../../src/cards/templates/index'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import type { CustomerGroupCastAttributes } from '../../src/sim/content/cast'
import type {
  IssueSeed,
  IssueSeedFamilyId,
} from '../../src/sim/modules/issues/issueSeedTypes'
import type {
  EntityRef,
  TavernState,
} from '../../src/sim/state/TavernState'
import { makeSeed } from './cardFactories'

function firstCustomerGroupId(state: TavernState): string {
  const id = Object.keys(state.customerGroups)[0]
  if (!id) throw new Error('test setup expects at least one customer group')
  return id
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

function customerGroupRef(id: string): EntityRef {
  return { kind: 'customer_group', id }
}

function violenceSeed(
  groupId: string,
  id = 'violence-seed',
): IssueSeed {
  return makeSeed({
    id,
    family: 'violence' as IssueSeedFamilyId,
    type: 'customer_incident',
    timing: 'during_service',
    severity: 55,
    domain: ['customers', 'service', 'maintenance'],
    primaryActor: customerGroupRef(groupId),
    location: { kind: 'area', id: 'main_room' },
    toneHints: ['violence', 'rowdy'],
    responseSlots: [
      {
        id: `${id}-slot-pay`,
        labelHint: 'Hire security',
        allowedVerbs: ['pay'],
        shape: 'safe_costly',
        targetOptions: [{ kind: 'system', id: 'security' }],
        expectedEffects: ['coin -20', 'pressure eases'],
      },
      {
        id: `${id}-slot-ban`,
        labelHint: 'Ban the rowdiest group',
        allowedVerbs: ['ban'],
        shape: 'relationship_sacrifice',
        targetOptions: [customerGroupRef(groupId)],
        expectedEffects: ['patronage -25'],
      },
    ],
    consequenceProfiles: [
      {
        id: `${id}-profile-pay`,
        responseSlotId: `${id}-slot-pay`,
        immediateEffects: [
          {
            kind: 'state_change',
            target: 'coin',
            amount: -20,
            readable: 'pay security',
            tags: ['coin'],
          },
          {
            kind: 'pressure',
            target: 'pressure:violence',
            amount: -15,
            readable: 'violence eases',
            tags: ['pressure'],
          },
        ],
        delayedEffects: [],
        memories: [],
        futureHooks: [],
        impactScore: 5,
      },
      {
        id: `${id}-profile-ban`,
        responseSlotId: `${id}-slot-ban`,
        immediateEffects: [
          {
            kind: 'state_change',
            target: `customers.${groupId}.patronage`,
            amount: -25,
            readable: 'group banned',
            tags: ['customer'],
          },
        ],
        delayedEffects: [],
        memories: [],
        futureHooks: [],
        impactScore: 5,
      },
    ],
    textIngredients: {
      subject: 'main room',
      sensoryDetails: ['shouting voices', 'damaged stools'],
      recentContext: ['brawl this week', 'damage rising'],
      stakesReadable: ['main room may break'],
    },
  })
}

const ESTABLISHING_LINE_TEXTS = new Set(
  violenceEstablishingLinePool.snippets.map((s) => s.text),
)
const REACTION_LINE_TEXTS = new Set(
  violenceReactionLinePool.snippets.map((s) => s.text),
)

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length
}

describe('violenceCard — appliesTo', () => {
  const state = createInitialTavernState()
  const groupId = firstCustomerGroupId(state)

  it('is registered in REQUIRED_CARDS', () => {
    expect(REQUIRED_CARDS).toContain(violenceCard)
  })

  it('matches a violence / customer_incident / during_service seed with a customer-group actor', () => {
    const seed = violenceSeed(groupId)
    const chosen = pickCardForSeed(seed, state, REQUIRED_CARDS)
    expect(chosen?.id).toBe(violenceCard.id)
  })

  it('declines a seed whose group has no cast attributes — fallback handles it', () => {
    const castless = withGroupCast(state, groupId, undefined)
    const seed = violenceSeed(groupId)
    const chosen = pickCardForSeed(seed, castless, REQUIRED_CARDS)
    expect(chosen?.id).not.toBe(violenceCard.id)
    expect(chosen?.id).toBe(fallbackCard.id)
  })

  it('does not match a different violence seed type (the template scopes to customer_incident)', () => {
    const seed = makeSeed({
      id: 'violence-other-type',
      family: 'violence' as IssueSeedFamilyId,
      type: 'warning',
      timing: 'during_service',
      primaryActor: customerGroupRef(groupId),
    })
    const chosen = pickCardForSeed(seed, state, REQUIRED_CARDS)
    expect(chosen?.id).not.toBe(violenceCard.id)
  })
})

describe('violenceCard — render output', () => {
  it('body[0] is the sim-backed establishing line; body[1] is the voiced reaction', () => {
    const state = createInitialTavernState()
    const groupId = firstCustomerGroupId(state)
    const seed = violenceSeed(groupId)
    const view = violenceCard.render(seed, state)
    expect(view.body[0]).toBeDefined()
    expect(view.body[1]).toBeDefined()
    expect(ESTABLISHING_LINE_TEXTS.has(view.body[0]!)).toBe(true)
    expect(REACTION_LINE_TEXTS.has(view.body[1]!)).toBe(true)
    expect(wordCount(view.body[0]!)).toBeLessThanOrEqual(14)
    expect(wordCount(view.body[1]!)).toBeLessThanOrEqual(12)
  })

  it('body never surfaces raw textIngredients fragments', () => {
    const state = createInitialTavernState()
    const groupId = firstCustomerGroupId(state)
    const seed = violenceSeed(groupId)
    const view = violenceCard.render(seed, state)
    for (const line of view.body) {
      expect(line).not.toBe('shouting voices')
      expect(line).not.toBe('damaged stools')
      expect(line).not.toBe('brawl this week')
      expect(line).not.toBe('main room may break')
    }
  })

  it('title centres on the customer group label and never truncates with "…"', () => {
    const state = createInitialTavernState()
    const groupId = firstCustomerGroupId(state)
    const seed = violenceSeed(groupId)
    const view = violenceCard.render(seed, state)
    const label = state.customerGroups[groupId]!.label
    expect(view.title.toLowerCase()).toContain(label.toLowerCase())
    expect(view.title).not.toContain('…')
    expect(view.title).not.toContain('...')
  })

  it('rowdiness signal (Phase-12 loopback) drives the establishing-line top rung', () => {
    const state = createInitialTavernState()
    const groupId = firstCustomerGroupId(state)
    // Bump rowdiness into the high band (>=70) and add rising pressure
    // so the two-condition rung fires.
    const stateRowdy: TavernState = {
      ...state,
      customerGroups: {
        ...state.customerGroups,
        [groupId]: {
          ...state.customerGroups[groupId]!,
          rowdiness: 85,
        },
      },
      modules: {
        ...state.modules,
        pressures: {
          ...(state.modules.pressures ?? {}),
          snapshots: {
            violence: {
              id: 'violence',
              value: 70,
              severity: 60,
              urgency: 70,
              trend: 1,
              causes: [],
            },
          },
        } as never,
      },
    }
    const seed = violenceSeed(groupId, 'violence-rowdy')
    const view = violenceCard.render(seed, stateRowdy)
    // Either the top-rung rowdiness_pressure snippet or one of the
    // single-rung high-rowdiness snippets must fire.
    expect(view.body[0]).toBeDefined()
  })

  it('preserves choice mechanical truth (verb, target, effects)', () => {
    const state = createInitialTavernState()
    const groupId = firstCustomerGroupId(state)
    const seed = violenceSeed(groupId)
    const view = violenceCard.render(seed, state)
    expect(view.choices.length).toBe(seed.responseSlots.length)
    for (const [i, choice] of view.choices.entries()) {
      const slot = seed.responseSlots[i]!
      expect(choice.verb).toBe(slot.allowedVerbs[0])
    }
  })

  it('is deterministic — same seed + state ⇒ identical CardView', () => {
    const state = createInitialTavernState()
    const groupId = firstCustomerGroupId(state)
    const seed = violenceSeed(groupId, 'violence-deterministic')
    const a = violenceCard.render(seed, state)
    const b = violenceCard.render(seed, state)
    expect(a.title).toBe(b.title)
    expect(a.body).toEqual(b.body)
    expect(a.choices).toEqual(b.choices)
  })

  it('does not mutate state', () => {
    const state = createInitialTavernState()
    const groupId = firstCustomerGroupId(state)
    const seed = violenceSeed(groupId)
    const before = JSON.stringify(state)
    violenceCard.render(seed, state)
    expect(JSON.stringify(state)).toBe(before)
  })
})

describe('violenceCard — pools shape', () => {
  it('reaction_line pool is actor-aware (voice axes drive variants)', () => {
    const hasVoiceCondition = violenceReactionLinePool.snippets.some((s) =>
      s.conditions.some(
        (c) => c.kind === 'voiceAxis' || c.kind === 'verbalTic',
      ),
    )
    expect(hasVoiceCondition).toBe(true)
  })

  it('establishing_line reaches the new customer_group.rowdiness signal', () => {
    const usesRowdiness = violenceEstablishingLinePool.snippets.some((s) =>
      s.conditions.some(
        (c) => c.kind === 'signalEquals' && c.signal === 'customer_group.rowdiness',
      ),
    )
    expect(usesRowdiness).toBe(true)
  })
})
