// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/svelte'

import CardRenderer from '../../web/src/lib/cards/CardRenderer.svelte'
import type { CardView } from '../../src/cards/types'

const baseCard: CardView = {
  title: 'A card',
  body: ['Something happens.'],
  stakes: [],
  choices: [
    {
      slotId: 'slot-1',
      label: 'Act',
      verb: 'clean',
      shape: 'safe_costly',
      previewEffects: [],
    },
  ],
}

describe('CardRenderer card context', () => {
  afterEach(() => cleanup())

  it('renders why-now and cause context when present', () => {
    render(CardRenderer, {
      props: {
        card: {
          ...baseCard,
          context: {
            whyNow: [
              {
                readable: 'Stock shortage is rising.',
                kind: 'why_now',
                source: 'pressure_snapshot',
              },
            ],
            causes: [
              {
                readable: 'yesterday’s rush emptied the pantry',
                kind: 'cause',
                source: 'seed_cause',
              },
            ],
            history: [],
            future: [],
          },
        },
      },
    })

    expect(screen.getByLabelText('Card context')).toBeInTheDocument()
    expect(screen.getByText('Why now')).toBeInTheDocument()
    expect(screen.getByText('Because')).toBeInTheDocument()
    expect(screen.getByText('Stock shortage is rising.')).toBeInTheDocument()
    expect(screen.getByText('yesterday’s rush emptied the pantry')).toBeInTheDocument()
  })

  it('renders no context section when context is absent', () => {
    render(CardRenderer, { props: { card: baseCard } })

    expect(screen.queryByLabelText('Card context')).not.toBeInTheDocument()
  })
})
