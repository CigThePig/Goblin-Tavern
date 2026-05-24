// Phase 141 / ISSUE-110 — Voiced Surface arc, Phase 15 (Reports Prose).
//
// Tests for the Missed Opportunities section composer. The readable
// line is composed as `${actionPhrase} ${connector} ${pressureLabel}.`;
// the connector is the voiced piece, the rest is structured. Secondary
// is composed as `${pressureLabel} ${verb} ${signed} to ${value}.`

import { describe, expect, it } from 'vitest'

import {
  actionCategoryTag,
  buildActionPhrase,
  buildDiffActionPhrase,
  composeDiffReadableVoiced,
  composeIgnoredReadableVoiced,
  composePressureReadableVoiced,
  composePressureSecondaryVoiced,
  diffKindNoun,
  ignoredSeverityTag,
  trendMagnitudeTag,
} from '../../../src/reports/compose/sections'
import { createInitialTavernState } from '../../../src/sim/state/defaults'

const STATE = createInitialTavernState()

describe('actionCategoryTag', () => {
  it('maps known owner actions to their category tags', () => {
    expect(actionCategoryTag('clean_area')).toBe('clean_action')
    expect(actionCategoryTag('repair_area')).toBe('repair_action')
    expect(actionCategoryTag('patch_roof')).toBe('patch_action')
    expect(actionCategoryTag('fumigate_cellar')).toBe('fumigate_action')
    expect(actionCategoryTag('restock_item')).toBe('restock_action')
    expect(actionCategoryTag('pay_staff_bonus')).toBe('bonus_action')
    expect(actionCategoryTag('adjust_prices')).toBe('price_action')
  })

  it('falls back to generic_action for unknown ids', () => {
    expect(actionCategoryTag('nonexistent')).toBe('generic_action')
  })
})

describe('trendMagnitudeTag', () => {
  it('classifies small / mid / large by absolute delta', () => {
    expect(trendMagnitudeTag(0)).toBe('trend_small')
    expect(trendMagnitudeTag(3)).toBe('trend_small')
    expect(trendMagnitudeTag(-3)).toBe('trend_small')
    expect(trendMagnitudeTag(4)).toBe('trend_mid')
    expect(trendMagnitudeTag(8)).toBe('trend_mid')
    expect(trendMagnitudeTag(-8)).toBe('trend_mid')
    expect(trendMagnitudeTag(9)).toBe('trend_large')
    expect(trendMagnitudeTag(20)).toBe('trend_large')
  })
})

describe('buildActionPhrase', () => {
  it('emits the action-and-target half only (no connector, no pressure)', () => {
    expect(buildActionPhrase('clean_area', 'Clean an area', 'kitchen')).toBe(
      'Cleaning kitchen',
    )
    expect(buildActionPhrase('clean_area', 'Clean an area', undefined)).toBe(
      'Cleaning an area',
    )
    expect(buildActionPhrase('repair_area', 'Repair', 'main room')).toBe(
      'Repairing main room',
    )
    expect(buildActionPhrase('patch_roof', 'Patch the roof', undefined)).toBe(
      'Patching the roof',
    )
    expect(
      buildActionPhrase('pay_staff_bonus', 'Bonus', 'Bran'),
    ).toBe('A bonus for Bran')
  })

  it('falls back to the registered actionLabel for unknown ids', () => {
    expect(buildActionPhrase('mystery_action', 'Do the thing', undefined)).toBe(
      'Do the thing',
    )
  })
})

describe('composePressureReadableVoiced', () => {
  it('composes a sim-coherent readable for a clean action', () => {
    const line = composePressureReadableVoiced({
      state: STATE,
      closedDay: 3,
      actionId: 'clean_area',
      actionLabel: 'Clean an area',
      targetLabel: 'kitchen',
      pressureLabel: 'Food safety',
      pressureDelta: 5,
    })
    expect(line).toContain('Cleaning kitchen')
    expect(line).toMatch(/would have (eased|curbed)/)
    expect(line).toContain('food safety')
    expect(line.endsWith('.')).toBe(true)
  })

  it('composes a readable for repair with target', () => {
    const line = composePressureReadableVoiced({
      state: STATE,
      closedDay: 4,
      actionId: 'repair_area',
      actionLabel: 'Repair an area',
      targetLabel: 'main room',
      pressureLabel: 'Customer complaint',
      pressureDelta: 3,
    })
    expect(line).toMatch(/Repairing main room (would have (slowed|firmed|eased)) customer complaint\./)
  })

  it('falls back gracefully for unknown action category', () => {
    const line = composePressureReadableVoiced({
      state: STATE,
      closedDay: 5,
      actionId: 'no_such_action',
      actionLabel: 'Do the thing',
      targetLabel: undefined,
      pressureLabel: 'Some pressure',
      pressureDelta: 1,
    })
    expect(line).toContain('Do the thing')
    expect(line).toContain('would have eased')
    expect(line).toContain('some pressure')
  })

  it('is deterministic per (closedDay, actionId, target)', () => {
    const args = {
      state: STATE,
      closedDay: 7,
      actionId: 'clean_area',
      actionLabel: 'Clean',
      targetLabel: 'kitchen',
      pressureLabel: 'Food safety',
      pressureDelta: 5,
    }
    expect(composePressureReadableVoiced(args)).toBe(
      composePressureReadableVoiced(args),
    )
  })
})

describe('composePressureSecondaryVoiced', () => {
  it('composes the structured secondary line with a voiced verb', () => {
    const line = composePressureSecondaryVoiced({
      state: STATE,
      closedDay: 3,
      actionId: 'clean_area',
      targetId: 'kitchen',
      pressureLabel: 'Food safety',
      pressureDelta: 5,
      pressureValue: 67,
    })
    expect(line).toContain('Food safety')
    expect(line).toMatch(/(rose|climbed|ticked up|crept up|surged|spiked)/)
    expect(line).toContain('+5 to 67.')
  })

  it('signs a negative delta correctly', () => {
    const line = composePressureSecondaryVoiced({
      state: STATE,
      closedDay: 4,
      actionId: 'clean_area',
      targetId: undefined,
      pressureLabel: 'Stress',
      pressureDelta: -2,
      pressureValue: 30,
    })
    expect(line).toContain('-2 to 30.')
  })

  it('routes large deltas to the surged/spiked rung', () => {
    // Vary closedDay across realistic stable target ids — production
    // uses fixed labels like 'kitchen' / 'cellar', not parameterised
    // strings. With a large-delta tag, only the two trend_large
    // condition-gated snippets are reachable (specificity 1 wins over
    // the 2 unconditional rung-0 voicings); FNV tie-break across days
    // produces both.
    const verbs = new Set<string>()
    const realisticTargets = ['kitchen', 'cellar', 'main room', 'privy']
    for (let i = 1; i <= 30; i++) {
      const line = composePressureSecondaryVoiced({
        state: STATE,
        closedDay: i,
        actionId: 'clean_area',
        targetId: realisticTargets[i % realisticTargets.length]!,
        pressureLabel: 'X',
        pressureDelta: 15,
        pressureValue: 80,
      })
      const m = line.match(/^X (.+) \+15 to 80\.$/)
      if (m) verbs.add(m[1]!)
    }
    const allowed = new Set(['surged', 'spiked'])
    for (const v of verbs) {
      expect(allowed.has(v)).toBe(true)
    }
    expect(verbs.size).toBeGreaterThanOrEqual(2)
  })

  it('is deterministic per (closedDay, actionId, targetId)', () => {
    const args = {
      state: STATE,
      closedDay: 7,
      actionId: 'clean_area',
      targetId: 'kitchen',
      pressureLabel: 'Food safety',
      pressureDelta: 5,
      pressureValue: 67,
    }
    expect(composePressureSecondaryVoiced(args)).toBe(
      composePressureSecondaryVoiced(args),
    )
  })
})

describe('diffKindNoun', () => {
  it('maps reputation paths to "slide"', () => {
    expect(diffKindNoun('reputation.cozy')).toBe('slide')
  })

  it('maps stock paths to "shortfall"', () => {
    expect(diffKindNoun('stock.ale.quantity')).toBe('shortfall')
  })

  it('maps other paths (areas etc.) to "loss"', () => {
    expect(diffKindNoun('areas.kitchen.condition')).toBe('loss')
    expect(diffKindNoun('something.else')).toBe('loss')
  })
})

describe('ignoredSeverityTag', () => {
  it('classifies low / mid / high', () => {
    expect(ignoredSeverityTag(0)).toBe('ignored_low')
    expect(ignoredSeverityTag(30)).toBe('ignored_low')
    expect(ignoredSeverityTag(31)).toBe('ignored_mid')
    expect(ignoredSeverityTag(70)).toBe('ignored_mid')
    expect(ignoredSeverityTag(71)).toBe('ignored_high')
    expect(ignoredSeverityTag(100)).toBe('ignored_high')
  })
})

describe('buildDiffActionPhrase', () => {
  it('emits the "earlier" framing for clean / restock with target', () => {
    expect(buildDiffActionPhrase('clean_area', 'Clean', 'kitchen')).toBe(
      'Cleaning kitchen earlier',
    )
    expect(buildDiffActionPhrase('clean_area', 'Clean', undefined)).toBe(
      'An earlier clean',
    )
    expect(buildDiffActionPhrase('restock_item', 'Restock', 'ale')).toBe(
      'Restocking ale',
    )
    expect(buildDiffActionPhrase('restock_item', 'Restock', undefined)).toBe(
      'An earlier restock',
    )
  })

  it('falls back to the registered actionLabel for unknown ids', () => {
    expect(buildDiffActionPhrase('mystery', 'Do thing', undefined)).toBe(
      'Do thing',
    )
  })
})

describe('composeDiffReadableVoiced', () => {
  it('composes a reputation slide readable for a clean action', () => {
    const line = composeDiffReadableVoiced({
      state: STATE,
      closedDay: 3,
      actionId: 'clean_area',
      actionLabel: 'Clean',
      targetLabel: 'kitchen',
      subjectNoun: 'cozy',
      diffPath: 'reputation.cozy',
    })
    expect(line).toContain('Cleaning kitchen earlier')
    expect(line).toMatch(/would have (softened|eased|lightened)/)
    expect(line).toContain('the cozy slide.')
  })

  it('composes a stock shortfall readable for a restock', () => {
    const line = composeDiffReadableVoiced({
      state: STATE,
      closedDay: 3,
      actionId: 'restock_item',
      actionLabel: 'Restock',
      targetLabel: 'ale',
      subjectNoun: 'ale quantity',
      diffPath: 'stock.ale.quantity',
    })
    expect(line).toContain('Restocking ale')
    expect(line).toMatch(/would have (softened|prevented)/)
    expect(line).toContain('the ale quantity shortfall.')
  })

  it('composes a generic loss readable for areas', () => {
    const line = composeDiffReadableVoiced({
      state: STATE,
      closedDay: 3,
      actionId: 'repair_area',
      actionLabel: 'Repair',
      targetLabel: 'main room',
      subjectNoun: 'condition',
      diffPath: 'areas.main_room.condition',
    })
    expect(line).toContain('Repairing main room')
    expect(line).toMatch(/would have (softened|slowed)/)
    expect(line).toContain('the condition loss.')
  })

  it('is deterministic per (closedDay, actionId, diffPath)', () => {
    const args = {
      state: STATE,
      closedDay: 7,
      actionId: 'clean_area',
      actionLabel: 'Clean',
      targetLabel: 'kitchen',
      subjectNoun: 'cozy',
      diffPath: 'reputation.cozy',
    }
    expect(composeDiffReadableVoiced(args)).toBe(
      composeDiffReadableVoiced(args),
    )
  })
})

describe('composeIgnoredReadableVoiced', () => {
  it('composes a low-severity readable with a soft verb', () => {
    const line = composeIgnoredReadableVoiced({
      state: STATE,
      closedDay: 3,
      slotLabel: 'Clean the kitchen',
      subject: 'spoiled stew',
      seedId: 'seed-1',
      severity: 20,
    })
    expect(line).toMatch(/^Clean the kitchen would have (settled|eased) the spoiled stew incident\.$/)
  })

  it('composes a mid-severity readable with a neutral verb', () => {
    const line = composeIgnoredReadableVoiced({
      state: STATE,
      closedDay: 3,
      slotLabel: 'Discard the stew',
      subject: 'food safety',
      seedId: 'seed-2',
      severity: 50,
    })
    expect(line).toMatch(/^Discard the stew would have (closed|resolved|ended) the food safety incident\.$/)
  })

  it('composes a high-severity readable with a strong verb', () => {
    const line = composeIgnoredReadableVoiced({
      state: STATE,
      closedDay: 3,
      slotLabel: 'Pay the inspector',
      subject: 'inspection',
      seedId: 'seed-3',
      severity: 85,
    })
    expect(line).toMatch(/^Pay the inspector would have (averted|headed off) the inspection incident\.$/)
  })

  it('re-capitalizes the slot label when it starts lowercase', () => {
    const line = composeIgnoredReadableVoiced({
      state: STATE,
      closedDay: 3,
      slotLabel: 'clean the kitchen',
      subject: 'x',
      seedId: 'seed-x',
      severity: 50,
    })
    expect(line.startsWith('Clean the kitchen')).toBe(true)
  })

  it('is deterministic per (closedDay, seedId)', () => {
    const args = {
      state: STATE,
      closedDay: 7,
      slotLabel: 'Discard the stew',
      subject: 'food safety',
      seedId: 'seed-2',
      severity: 50,
    }
    expect(composeIgnoredReadableVoiced(args)).toBe(
      composeIgnoredReadableVoiced(args),
    )
  })
})
