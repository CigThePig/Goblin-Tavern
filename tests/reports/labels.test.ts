// Phase 117 / ISSUE-078 — Tests for the id → label translation
// utility (`idLabel`) and the JSON-pointer → human string utility
// (`humanizePath` / `humanizeDiff`).
//
// These two modules are the foundation of the clarity pass: every
// player-facing surface routes through them, so the test asserts
// that real ids from the canonical registries resolve to non-id
// strings, that unknown ids fall back to humanized form (never the
// raw id), and that diff paths never leak underscores, dots, or the
// engine's internal "value"/"quantity" suffixes after humanization.

import { describe, expect, it } from 'vitest'

import {
  humanizeId,
  idLabel,
} from '../../src/reports/labels/idLabel'
import {
  humanizeDiff,
  humanizePath,
} from '../../src/reports/labels/humanizePath'
import type { ReportDiffLine } from '../../src/reports/types'

describe('humanizeId', () => {
  it('snake_case → sentence case', () => {
    expect(humanizeId('staff_loyalty_risk')).toBe('Staff loyalty risk')
    expect(humanizeId('cultural_tension')).toBe('Cultural tension')
  })

  it('camelCase → sentence case', () => {
    expect(humanizeId('goblinAuthentic')).toBe('Goblin authentic')
  })

  it('lifts known acronyms', () => {
    expect(humanizeId('npc_count')).toBe('NPC count')
  })

  it('handles empty input', () => {
    expect(humanizeId('')).toBe('')
  })
})

describe('idLabel', () => {
  it('resolves stock ids from the registry', () => {
    expect(idLabel('stock', 'ale')).toBe('Ale')
    expect(idLabel('stock', 'mushrooms')).toBe('Mushrooms')
    expect(idLabel('stock', 'firewood')).toBe('Firewood')
  })

  it('resolves pressure ids from the registry', () => {
    expect(idLabel('pressure', 'staff_loyalty_risk')).toBe('Staff Loyalty Risk')
    expect(idLabel('pressure', 'cultural_tension')).toBe('Cultural Tension')
  })

  it('resolves area ids from the registry', () => {
    expect(idLabel('area', 'main_room')).toBe('Main Room')
    expect(idLabel('area', 'kitchen')).toBe('Kitchen')
  })

  it('resolves reputation axes', () => {
    expect(idLabel('reputation', 'tasty')).toBe('Tasty')
    expect(idLabel('reputation', 'culinary_renown')).toBe('Culinary renown')
  })

  it('resolves enum-shaped values via the static table', () => {
    expect(idLabel('projectStatus', 'in_progress')).toBe('In progress')
    expect(idLabel('socialOutcome', 'improved')).toBe('Improved')
    expect(idLabel('expeditionOutcome', 'runner_lost')).toBe('Runner lost')
    expect(idLabel('dayType', 'quiet_day')).toBe('Quiet Day')
    expect(idLabel('logFacet', 'owner_action')).toBe('Owner action')
  })

  it('resolves policy ids', () => {
    expect(idLabel('policy', 'allow_tabs_for_regulars')).toBe(
      'Allow Tabs for Regulars',
    )
    expect(idLabel('policy', 'cheap_payday_specials')).toBe(
      'Cheap Payday Specials',
    )
  })

  it('resolves staff role ids', () => {
    expect(idLabel('staffRole', 'cook')).toBe('Cook')
    expect(idLabel('staffRole', 'kitchen_hand')).toBe('Kitchen Hand')
  })

  it('falls back to humanizeId for unknown ids in any category', () => {
    expect(idLabel('stock', 'fictitious_thing')).toBe('Fictitious thing')
    expect(idLabel('pressure', 'totally_made_up')).toBe('Totally made up')
    expect(idLabel('projectStatus', 'made_up_status')).toBe('Made up status')
  })

  it('returns empty string for empty input', () => {
    expect(idLabel('stock', '')).toBe('')
  })

  it('never returns the raw snake_case id for registry hits', () => {
    expect(idLabel('stock', 'ale')).not.toContain('_')
  })
})

describe('humanizePath', () => {
  it('coin', () => {
    expect(humanizePath('coin')).toBe('Coin')
  })

  it('reputation axes', () => {
    expect(humanizePath('reputation.tasty')).toBe('Tasty reputation')
    expect(humanizePath('reputation.culinary_renown')).toBe(
      'Culinary renown reputation',
    )
  })

  it('stock paths', () => {
    expect(humanizePath('stock.ale.quantity')).toBe('Ale stock')
    expect(humanizePath('stock.ale.quality')).toBe('Ale quality')
    expect(humanizePath('stock.ale.spoilage')).toBe('Ale spoilage')
  })

  it('pressure paths', () => {
    expect(humanizePath('pressures.staff_loyalty_risk.value')).toBe(
      'Staff Loyalty Risk',
    )
    expect(humanizePath('pressures.cultural_tension.value')).toBe(
      'Cultural Tension',
    )
  })

  it('area meter paths', () => {
    expect(humanizePath('areas.main_room.cleanliness')).toBe(
      'Main Room cleanliness',
    )
  })

  it('falls back to humanized last segment for unrecognised paths', () => {
    expect(humanizePath('weird.deeply.nested.path')).toBe('Path')
  })

  it('never leaks JSON-pointer characters for canonical paths', () => {
    const paths = [
      'coin',
      'reputation.tasty',
      'stock.ale.quantity',
      'stock.mushrooms.spoilage',
      'pressures.staff_loyalty_risk.value',
      'pressures.cultural_tension.value',
      'areas.main_room.cleanliness',
    ]
    for (const p of paths) {
      const out = humanizePath(p)
      expect(out, `path: ${p}`).not.toContain('.')
      expect(out, `path: ${p}`).not.toContain('_')
      expect(out, `path: ${p}`).not.toContain('value')
    }
  })
})

describe('humanizeDiff', () => {
  function mkDiff(overrides: Partial<ReportDiffLine>): ReportDiffLine {
    return {
      path: 'coin',
      readable: '',
      humanReadable: '',
      direction: 'gain',
      delta: 0,
      before: 0,
      after: 0,
      tags: [],
      ...overrides,
    }
  }

  it('positive delta uses plus sign', () => {
    expect(
      humanizeDiff(
        mkDiff({ path: 'coin', before: 100, after: 423, delta: 323 }),
      ),
    ).toBe('Coin: 100 → 423 (+323)')
  })

  it('negative delta uses typographic minus', () => {
    expect(
      humanizeDiff(
        mkDiff({
          path: 'stock.ale.quantity',
          before: 80,
          after: 0,
          delta: -80,
        }),
      ),
    ).toBe('Ale stock: 80 → 0 (−80)')
  })

  it('pressure paths render with the registry label', () => {
    expect(
      humanizeDiff(
        mkDiff({
          path: 'pressures.staff_loyalty_risk.value',
          before: 0,
          after: 75,
          delta: 75,
        }),
      ),
    ).toBe('Staff Loyalty Risk: 0 → 75 (+75)')
  })

  it('zero delta drops the parenthesised direction', () => {
    expect(
      humanizeDiff(
        mkDiff({
          path: 'stock.ale.quality',
          before: 60,
          after: 60,
          delta: 0,
        }),
      ),
    ).toBe('Ale quality: 60 → 60')
  })
})
