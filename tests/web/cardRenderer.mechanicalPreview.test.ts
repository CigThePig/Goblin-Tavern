// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/svelte'

import CardRenderer from '../../web/src/lib/cards/CardRenderer.svelte'
import type { CardView } from '../../src/cards/types'

describe('CardRenderer mechanical effect previews', () => {
  afterEach(() => cleanup())

  it('renders numeric mechanical previews alongside flavour previews', () => {
    const card: CardView = {
      title: 'A choice',
      body: ['The goblin watches.'],
      stakes: [],
      choices: [
        {
          slotId: 'bonus',
          label: 'Pay staff bonus',
          verb: 'pay',
          shape: 'safe_costly',
          previewEffects: ['A warm purse changes the room.'],
          mechanicalEffects: ['Coin -10', 'Morale +5', 'Stress -3'],
        },
      ],
    }

    render(CardRenderer, { props: { card } })

    expect(screen.getByText('A warm purse changes the room.')).toBeInTheDocument()
    expect(screen.getByLabelText('Mechanical effects')).toBeInTheDocument()
    expect(screen.getByText('Coin -10')).toBeInTheDocument()
    expect(screen.getByText('Morale +5')).toBeInTheDocument()
    expect(screen.getByText('Stress -3')).toBeInTheDocument()
  })
})
