import { describe, expect, it } from 'vitest'

import { formatEffectPreview } from '../../src/cards/compose/formatEffectPreview'
import { composeChoicesFromSeed } from '../../src/cards/cardHelpers'
import { guardCardViewWording } from '../../src/cards/compose/fairnessWording'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import { makeSeed, ZERO_STAMP } from './cardFactories'
import type { CardView } from '../../src/cards/types'
import type { MemoryState } from '../../src/sim/state/TavernState'

const emptyPool = { slotId: 'empty', snippets: [] }

describe('numeric card effect preview formatting', () => {
  it('formats exact numeric amount, direction, and entity label when known', () => {
    const state = createInitialTavernState()
    const cookName = state.staff.cook!.name.display

    expect(
      formatEffectPreview(
        {
          kind: 'state_change',
          target: 'coin',
          amount: -10,
          readable: 'Bonus paid',
          tags: ['coin'],
        },
        state,
      ),
    ).toBe('Coin -10')
    expect(
      formatEffectPreview(
        {
          kind: 'state_change',
          target: 'stock.ale.quantity',
          amount: 40,
          readable: 'Ale restocked',
          tags: ['stock'],
        },
        state,
      ),
    ).toBe('Ale Quantity +40')
    expect(
      formatEffectPreview(
        {
          kind: 'state_change',
          target: 'staff.cook.morale',
          amount: 5,
          readable: 'Morale lifts',
          tags: ['staff'],
        },
        state,
      ),
    ).toBe(`${cookName} Morale +5`)
  })

  it('falls back to existing flavour when exact amount is unavailable', () => {
    expect(
      formatEffectPreview({
        kind: 'future_hook',
        target: 'memory:warning',
        readable: 'Reputation risk',
        tags: ['risk'],
      }),
    ).toBe('Reputation risk')
  })

  it('adds numeric mechanical previews without replacing flavour previews', () => {
    const state = createInitialTavernState()
    const seed = makeSeed({
      responseSlots: [
        {
          id: 'bonus-slot',
          labelHint: 'Pay a bonus',
          allowedVerbs: ['pay'],
          shape: 'safe_costly',
          targetOptions: [{ kind: 'staff', id: 'cook' }],
          expectedEffects: ['coin -10', 'morale +5'],
        },
      ],
      consequenceProfiles: [
        {
          id: 'bonus-profile',
          responseSlotId: 'bonus-slot',
          immediateEffects: [
            {
              kind: 'state_change',
              target: 'coin',
              amount: -10,
              readable: 'Bonus paid',
              tags: ['coin'],
            },
            {
              kind: 'state_change',
              target: 'staff.cook.morale',
              amount: 5,
              readable: 'Morale lifts',
              tags: ['staff'],
            },
          ],
          delayedEffects: [],
          memories: [],
          futureHooks: [],
          impactScore: 10,
        },
      ],
    })

    const [choice] = composeChoicesFromSeed(seed, state, {
      labelPool: emptyPool,
      previewPool: emptyPool,
    })

    expect(choice!.previewEffects).toEqual(['Bonus paid', 'Morale lifts'])
    expect(choice!.mechanicalEffects).toEqual([
      'Coin -10',
      `${state.staff.cook!.name.display} Morale +5`,
    ])
  })
})

describe('fairness wording guard', () => {
  const card: CardView = {
    title: 'Cellar neglect again',
    body: ['The neglect from before is still hanging in the air.'],
    stakes: [{ readable: 'No one dealt with it', direction: 'risk' }],
    choices: [
      {
        slotId: 'slot',
        label: 'Answer the unanswered warning',
        verb: 'clean',
        shape: 'safe_costly',
        previewEffects: ['flavour remains'],
      },
    ],
  }

  it('rewrites inherited-condition wording so it does not imply blame', () => {
    const state = createInitialTavernState()
    const seed = makeSeed({ family: 'area_atmosphere', type: 'maintenance_problem' })

    const guarded = guardCardViewWording(card, seed, state)
    const allText = [
      guarded.title,
      ...guarded.body,
      ...guarded.stakes.map((s) => s.readable),
      ...guarded.choices.map((c) => c.label),
    ].join(' ')

    expect(allText).not.toMatch(/neglect|again|still|unanswered|no one dealt/i)
    expect(guarded.body[0]).toContain('already in rough shape')
  })

  it('keeps repeated/neglect wording when memory supports it', () => {
    const base = createInitialTavernState()
    const memory: MemoryState = {
      id: 'prior-neglect',
      type: 'pattern',
      label: 'Prior neglect',
      strength: 1,
      ageDays: 1,
      createdAt: ZERO_STAMP,
      actors: [],
      locations: [],
      relatedSystems: [],
      tags: ['neglected'],
    }
    const state = { ...base, memories: [memory] }
    const seed = makeSeed({ family: 'area_atmosphere', type: 'maintenance_problem' })

    expect(guardCardViewWording(card, seed, state).body[0]).toBe(card.body[0])
  })
})
