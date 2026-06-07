import { describe, expect, it } from 'vitest'

import { picksToInputs, type PickedAction } from '../../web/src/lib/sim/actionBuilder'

describe('picksToInputs amount preservation', () => {
  it('preserves amount while forwarding target and options', () => {
    const picks: PickedAction[] = [
      {
        pickId: 'pick-amount',
        actionId: 'restock_item',
        label: 'Restock Item',
        category: 'immediate',
        targetType: 'stock',
        targetId: 'ale',
        targetLabel: 'Ale',
        amount: 40,
        timeCost: 60,
        options: { supplierId: 'old_keg_brewers' },
      },
    ]

    expect(picksToInputs(picks)).toEqual([
      {
        actionId: 'restock_item',
        targetId: 'ale',
        amount: 40,
        options: { supplierId: 'old_keg_brewers' },
      },
    ])
  })
})
