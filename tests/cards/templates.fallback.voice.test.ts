// Phase 142 / ISSUE-111 — Voiced Surface arc, Phase 16 (Ambient Surface).
//
// Voice tests for the rewritten compositional fallback card. Pins:
//   - title comes from the severity-gated narrator-voiced pool
//   - body lines pass through `textIngredients` verbatim (no tone
//     connectors prepended by the retired Phase-95 composer)
//   - title never carries a legacy `pickSeverityAdjective` prefix
//     ("Acrid" / "Sour" / "Mounting" / etc.) from the retired
//     `voice/composer.ts` path
//   - determinism: same seed in, same view out

import { describe, expect, it } from 'vitest'

import { fallbackCard } from '../../src/cards/index'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import { makeSeed } from './cardFactories'

const STATE = createInitialTavernState()

const LEGACY_PREFIX_ADJECTIVES = [
  'Acrid',
  'Sour',
  'Pungent',
  'Rank',
  'Mounting',
  'Tightening',
  'Tensed',
  'Cracked',
  'Splintering',
  'Sagging',
  'Plain',
  'Routine',
  'Workaday',
]

function titleStartsWithLegacyPrefix(title: string): boolean {
  for (const adj of LEGACY_PREFIX_ADJECTIVES) {
    if (title.startsWith(`${adj} `)) return true
  }
  return false
}

describe('fallbackCard — voice (Phase 16)', () => {
  it('low severity picks the low-severity rung when subject is set', () => {
    const seed = makeSeed({ id: 'fb-low', severity: 25 })
    const view = fallbackCard.render(seed, STATE)
    expect(view.title.toLowerCase()).toContain('loose thread')
  })

  it('mid severity picks a mid-or-higher rung', () => {
    const seed = makeSeed({ id: 'fb-mid', severity: 55 })
    const view = fallbackCard.render(seed, STATE)
    // Either the mid snippet or the high snippet may win FNV tie-break.
    expect(
      view.title.toLowerCase().includes('matter to weigh') ||
        view.title.toLowerCase().includes('hard knot rises'),
    ).toBe(true)
  })

  it('high severity reaches the high-severity rung', () => {
    // Pick an id whose FNV hash routes to the high snippet over the
    // mid one. We sweep a few ids; the first one to surface the
    // high-severity wording proves the rung is reachable.
    const seenHigh = new Array(8).fill(0).map((_, i) => {
      const seed = makeSeed({ id: `fb-high-${i}`, severity: 90 })
      return fallbackCard.render(seed, STATE).title.toLowerCase()
    })
    expect(seenHigh.some((t) => t.includes('hard knot rises'))).toBe(true)
  })

  it('title never carries a legacy tone-pool prefix adjective', () => {
    // The retired Phase-95 composer prepended e.g. "Acrid spoiled stew"
    // via `pickSeverityAdjective`. The new template emits the snippet +
    // ": " + subject, so it can never start with one of those adjectives.
    for (let i = 0; i < 20; i++) {
      const seed = makeSeed({ id: `fb-leak-${i}`, severity: 30 + (i % 70) })
      const view = fallbackCard.render(seed, STATE)
      expect(titleStartsWithLegacyPrefix(view.title)).toBe(false)
    }
  })

  it('body lines pass through textIngredients verbatim', () => {
    const seed = makeSeed({
      id: 'fb-body',
      textIngredients: {
        subject: 'something rises',
        sensoryDetails: ['the air shifts'],
        recentContext: ['noticed at midday'],
        pressureContext: ['something climbing fast'],
      },
    })
    const view = fallbackCard.render(seed, STATE)
    // The body should literally include the textIngredients strings,
    // not a tone-connector-merged variant like "right now, the air shifts".
    expect(view.body[0]).toBe('the air shifts')
    expect(view.body[1]).toBe('noticed at midday')
    expect(view.body[2]).toBe('something climbing fast')
  })

  it('falls back to stakesReadable when pressureContext is empty', () => {
    const seed = makeSeed({
      id: 'fb-stake-fallback',
      textIngredients: {
        pressureContext: [],
        stakesReadable: ['patrons will gossip'],
      },
    })
    const view = fallbackCard.render(seed, STATE)
    expect(view.body[2]).toBe('patrons will gossip')
  })

  it('renders deterministically for the same seed', () => {
    const seed = makeSeed({ id: 'fb-det', severity: 75 })
    const a = fallbackCard.render(seed, STATE)
    const b = fallbackCard.render(seed, STATE)
    expect(a.title).toBe(b.title)
    expect(a.body).toEqual(b.body)
  })

  it('honours family name when subject is blank', () => {
    const seed = makeSeed({
      id: 'fb-fam',
      family: 'rival_tavern',
      textIngredients: { subject: '' },
    })
    const view = fallbackCard.render(seed, STATE)
    expect(view.title.toLowerCase()).toContain('rival_tavern')
  })

  it('drops body lines whose textIngredient entries are missing', () => {
    const seed = makeSeed({
      id: 'fb-empty-body',
      textIngredients: {
        sensoryDetails: [],
        recentContext: [],
        pressureContext: [],
        stakesReadable: [],
      },
    })
    const view = fallbackCard.render(seed, STATE)
    expect(view.body).toEqual([])
    // Title still renders — the fallback's always-renders guarantee.
    expect(view.title.length).toBeGreaterThan(0)
  })
})
