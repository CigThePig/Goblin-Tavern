// Phase 144 / ISSUE-113 — Voiced Surface arc, Phase 18.
//
// Live-suite regression tests for the previewVariety gate against the
// real screenshot-defect templates. Each test renders a multi-choice
// multi-effect card with a realistic actor and asserts that the
// rendered preview lines vary across the card — the direct mirror of
// the user-visible defect.
//
// Mira's staff_identity card (12 choices × 2 previews = 24 lines) is
// the smoking gun for the gate; before Phase 18 every line resolved to
// "the kitchen keeps its quiet drumbeat". After Phase 18 those lines
// spread across the new base-rung snippets via the FNV tie-break on
// `effect_preview::${slotId}::${idx}`.

import { describe, expect, it } from 'vitest'

import {
  checkPreviewVariety,
  type PreviewVarietyChoice,
  type PreviewVarietySample,
} from '../../../../src/cards/compose/gates'
import { staffAsideEffectPreviewPool } from '../../../../src/cards/compose/pools/staffAside'
import { staffBurnoutEffectPreviewPool } from '../../../../src/cards/compose/pools/staffBurnout'
import { effectPreviewPool as areaAtmospherePreviewPool } from '../../../../src/cards/compose/pools/areaAtmosphere/effectPreview'
import { effectPreviewPool as seasonalArcPreviewPool } from '../../../../src/cards/compose/pools/seasonalArc/effectPreview'
import { effectPreviewPool as inspectionPreviewPool } from '../../../../src/cards/compose/pools/inspection/effectPreview'
import { effectPreviewPool as stockShortagePreviewPool } from '../../../../src/cards/compose/pools/stockShortage/effectPreview'
import { createInitialTavernState } from '../../../../src/sim/state/defaults'
import type { CastAttributes } from '../../../../src/sim/content/cast'
import type {
  IssueSeed,
  ResponseSlot,
} from '../../../../src/sim/modules/issues/issueSeedTypes'
import type { EffectPreview } from '../../../../src/sim/core/effect'
import type {
  EntityRef,
  TavernState,
} from '../../../../src/sim/state/TavernState'
import type { SnippetPool } from '../../../../src/cards/compose/types'
import { makeSeed } from '../../cardFactories'
import { effect } from '../../../../src/sim/modules/issues/generatorHelpers'

// ---- helpers ----

function firstStaffId(state: TavernState): string {
  const id = Object.keys(state.staff)[0]
  if (!id) throw new Error('test setup expects a starter staff member')
  return id
}

function staffRef(id: string): EntityRef {
  return { kind: 'staff', id }
}

function withStaffCast(
  state: TavernState,
  staffId: string,
  cast: CastAttributes,
): TavernState {
  return {
    ...state,
    staff: {
      ...state.staff,
      [staffId]: { ...state.staff[staffId]!, castAttributes: cast },
    },
  }
}

const MIRA_LIKE: CastAttributes = {
  specialty: 'meat_dishes',
  blindspot: 'pastry',
  affinities: [],
  voice: {
    // Florid-warm-formal — the rough Mira archetype that mapped every
    // state_change preview to "the kitchen keeps its quiet drumbeat" in
    // the screenshot.
    axes: { terseness: 0, warmth: 2, formality: 2, floridity: 2 },
  },
}

const NEUTRAL_CAST: CastAttributes = {
  specialty: 'gossip',
  blindspot: 'war_story',
  affinities: [],
  voice: {
    axes: { terseness: 1, warmth: 1, formality: 1, floridity: 1 },
  },
}

// Phase 145 / ISSUE-113 — go through `effect()` so the new targetKind /
// direction / magnitudeBand metadata lands on each preview. Without
// this the shared narrator base never matches in the live tests.
function makeStateChangeEffect(target: string, amount: number): EffectPreview {
  return effect('state_change', target, amount, target, ['staff'])
}

function makePressureEffect(target: string, amount: number): EffectPreview {
  return effect('pressure', `pressure:${target}`, amount, `${target} ${amount}`, [])
}

function slot(id: string, label: string): ResponseSlot {
  return {
    id,
    labelHint: label,
    allowedVerbs: ['appease'],
    shape: 'safe_costly',
    targetOptions: [],
    expectedEffects: [],
  }
}

function staffSeed(state: TavernState, id: string): IssueSeed {
  return makeSeed({
    id,
    family: 'staff_identity',
    type: 'relationship_test',
    timing: 'morning_prep',
    severity: 45,
    domain: ['staff'],
    primaryActor: staffRef(firstStaffId(state)),
  })
}

// ---- the screenshot fixture: Mira's 12-choice card ----

describe('previewVariety gate — Mira screenshot regression', () => {
  it('staffAside renders varied previews across Mira-like 12-choice card', () => {
    const baseState = createInitialTavernState()
    const staffId = firstStaffId(baseState)
    const state = withStaffCast(baseState, staffId, MIRA_LIKE)
    const seed = staffSeed(state, 'mira-screenshot-regression')

    // Mira's screenshot card had 12 response slots. Reproduce that shape
    // — each with 2 state_change effects (the dominant kind on staff
    // cards and the one that collapsed pre-Phase-18).
    const choices: PreviewVarietyChoice[] = Array.from({ length: 12 }, (_, i) => ({
      slot: slot(`mira-slot-${i}`, `Choice ${i}`),
      effects: [
        makeStateChangeEffect(`staff.${staffId}.loyalty`, i % 2 === 0 ? 4 : -2),
        makeStateChangeEffect(`staff.${staffId}.stress`, i % 2 === 0 ? -3 : 4),
      ],
    }))

    const sample: PreviewVarietySample = {
      seed,
      state,
      previewPool: staffAsideEffectPreviewPool,
      choices,
      maxPreview: 2,
    }
    const report = checkPreviewVariety(() => sample, { sampleSize: 1 })
    expect(report.pass).toBe(true)
    expect(report.violations).toEqual([])
    // Sanity bound: at least 3 distinct snippets across the 24 lines.
    // Before Phase 18 this was 1 across the whole card.
    expect(report.observed.maxIdenticalRun).toBeLessThanOrEqual(2)
  })

  it('staffBurnout renders varied previews across a 4-choice card', () => {
    const baseState = createInitialTavernState()
    const staffId = firstStaffId(baseState)
    const state = withStaffCast(baseState, staffId, MIRA_LIKE)
    const seed = staffSeed(state, 'burnout-regression')

    const choices: PreviewVarietyChoice[] = [
      {
        slot: slot('pay_bonus', 'Pay bonus'),
        effects: [
          makeStateChangeEffect(`staff.${staffId}.morale`, 15),
          makeStateChangeEffect('coin', -15),
        ],
      },
      {
        slot: slot('reduce_workload', 'Reduce workload'),
        effects: [
          makeStateChangeEffect(`staff.${staffId}.fatigue`, -15),
          makeStateChangeEffect(`staff.${staffId}.stress`, -10),
        ],
      },
      {
        slot: slot('push_through', 'Push through'),
        effects: [makePressureEffect('staff_burnout', 8)],
      },
      {
        slot: slot('reassign', 'Reassign'),
        effects: [
          makeStateChangeEffect(`staff.${staffId}.stress`, -8),
          makeStateChangeEffect(`staff.other.fatigue`, 6),
        ],
      },
    ]

    const sample: PreviewVarietySample = {
      seed,
      state,
      previewPool: staffBurnoutEffectPreviewPool,
      choices,
      maxPreview: 2,
    }
    const report = checkPreviewVariety(() => sample, { sampleSize: 1 })
    expect(report.pass).toBe(true)
    expect(report.observed.maxIdenticalRun).toBeLessThanOrEqual(2)
  })
})

// ---- narrator-voiced templates (areaAtmosphere, seasonalArc, inspection, stockShortage) ----

function narratorRender(
  pool: SnippetPool,
  effects: readonly EffectPreview[][],
  state: TavernState,
  seedId: string,
): PreviewVarietySample {
  return {
    seed: makeSeed({
      id: seedId,
      family: 'area_atmosphere',
      type: 'warning',
      timing: 'morning_prep',
      severity: 50,
      domain: ['area'],
    }),
    state,
    previewPool: pool,
    choices: effects.map((effs, i) => ({
      slot: slot(`narr-slot-${i}`, `Choice ${i}`),
      effects: effs,
    })),
    maxPreview: 2,
  }
}

describe('previewVariety gate — narrator templates (screenshot mirrors)', () => {
  const state = createInitialTavernState()
  // Realistic narrator-card effect set: ~3 choices × 2 state_change/coin
  // effects each. The pre-Phase-18 pools collapsed all six to "The
  // room would steady its footing" / "Coin would leave the till...".
  const NARRATOR_EFFECTS: readonly EffectPreview[][] = [
    [
      { kind: 'state_change', target: 'area.cleanliness', amount: 25, readable: 'cleaner', tags: ['area'] },
      { kind: 'state_change', target: 'coin', amount: -15, readable: 'coin out', tags: ['coin'] },
    ],
    [
      { kind: 'state_change', target: 'area.condition', amount: 15, readable: 'condition up', tags: ['area'] },
      { kind: 'state_change', target: 'coin', amount: -25, readable: 'coin out big', tags: ['coin'] },
    ],
    [
      { kind: 'state_change', target: 'area.condition', amount: 10, readable: 'condition mild', tags: ['area'] },
      { kind: 'state_change', target: 'reputation.cozy', amount: -5, readable: 'rep cozy down', tags: ['reputation'] },
    ],
  ]

  it('areaAtmosphere renders varied previews', () => {
    const sample = narratorRender(areaAtmospherePreviewPool, NARRATOR_EFFECTS, state, 'aa-regression')
    const report = checkPreviewVariety(() => sample, { sampleSize: 1 })
    expect(report.pass).toBe(true)
  })

  it('seasonalArc renders varied previews', () => {
    const SEASONAL_EFFECTS: readonly EffectPreview[][] = [
      [
        { kind: 'state_change', target: 'coin', amount: -25, readable: 'buy supply', tags: ['coin'] },
        { kind: 'pressure', target: 'pressure:arc_escalation', amount: -8, readable: 'arc down', tags: ['pressure'] },
      ],
      [
        { kind: 'pressure', target: 'pressure:arc_escalation', amount: -4, readable: 'arc small down', tags: ['pressure'] },
        { kind: 'pressure', target: 'pressure:reputation_drift', amount: -3, readable: 'drift down', tags: ['pressure'] },
      ],
      [
        { kind: 'state_change', target: 'reputation.dangerous', amount: 4, readable: 'rep up', tags: ['reputation'] },
        { kind: 'pressure', target: 'pressure:arc_escalation', amount: -6, readable: 'arc med down', tags: ['pressure'] },
      ],
    ]
    const sample = narratorRender(seasonalArcPreviewPool, SEASONAL_EFFECTS, state, 'sa-regression')
    const report = checkPreviewVariety(() => sample, { sampleSize: 1 })
    expect(report.pass).toBe(true)
  })

  it('inspection renders varied previews', () => {
    const INSPECTION_EFFECTS: readonly EffectPreview[][] = [
      [
        { kind: 'state_change', target: 'areas.main.cleanliness', amount: 12, readable: 'clean main', tags: ['area'] },
        { kind: 'state_change', target: 'areas.kitchen.cleanliness', amount: 15, readable: 'clean kitchen', tags: ['area'] },
      ],
      [
        { kind: 'state_change', target: 'coin', amount: -30, readable: 'bribe coin', tags: ['coin'] },
        { kind: 'pressure', target: 'pressure:inspection', amount: -10, readable: 'pressure down', tags: ['pressure'] },
      ],
      [
        { kind: 'pressure', target: 'pressure:inspection', amount: -6, readable: 'hide pressure', tags: ['pressure'] },
        { kind: 'pressure', target: 'pressure:inspection', amount: -6, readable: 'hide pressure again', tags: ['pressure'] },
      ],
    ]
    const sample = narratorRender(inspectionPreviewPool, INSPECTION_EFFECTS, state, 'insp-regression')
    const report = checkPreviewVariety(() => sample, { sampleSize: 1 })
    expect(report.pass).toBe(true)
  })

  it('stockShortage renders varied previews', () => {
    const STOCK_EFFECTS: readonly EffectPreview[][] = [
      [
        { kind: 'state_change', target: 'stock.ale.qty', amount: 20, readable: 'restock ale', tags: ['stock'] },
        { kind: 'state_change', target: 'coin', amount: -25, readable: 'coin spend', tags: ['coin'] },
      ],
      [
        { kind: 'state_change', target: 'stock.ale.price', amount: 3, readable: 'price up', tags: ['stock'] },
        { kind: 'state_change', target: 'customers.miners.satisfaction', amount: -4, readable: 'sat down', tags: ['customer'] },
      ],
      [
        { kind: 'state_change', target: 'stock.ale.qty', amount: 5, readable: 'small restock', tags: ['stock'] },
        { kind: 'state_change', target: 'stock.ale.quality', amount: -3, readable: 'quality down', tags: ['quality'] },
      ],
    ]
    const sample = narratorRender(stockShortagePreviewPool, STOCK_EFFECTS, state, 'stock-regression')
    const report = checkPreviewVariety(() => sample, { sampleSize: 1 })
    expect(report.pass).toBe(true)
  })
})

// ---- bonus: prove the gate catches a deliberately bad pool against
// the same render shape (defence-in-depth on the gate itself) ----

describe('previewVariety gate — neutral-cast variants stay varied', () => {
  it('staffAside with a NEUTRAL actor cast still renders varied previews', () => {
    const baseState = createInitialTavernState()
    const staffId = firstStaffId(baseState)
    const state = withStaffCast(baseState, staffId, NEUTRAL_CAST)
    const seed = staffSeed(state, 'neutral-regression')

    const choices: PreviewVarietyChoice[] = Array.from({ length: 6 }, (_, i) => ({
      slot: slot(`neutral-slot-${i}`, `Choice ${i}`),
      effects: [
        makeStateChangeEffect(`staff.${staffId}.morale`, 4),
        makeStateChangeEffect(`staff.${staffId}.fatigue`, -3),
      ],
    }))

    const sample: PreviewVarietySample = {
      seed,
      state,
      previewPool: staffAsideEffectPreviewPool,
      choices,
      maxPreview: 2,
    }
    const report = checkPreviewVariety(() => sample, { sampleSize: 1 })
    expect(report.pass).toBe(true)
  })
})

// ---- Phase 145 / ISSUE-113 (iteration 2) — specificity assertions ----
//
// The Phase-144 variety repair stops snippets from collapsing to a
// single line per card, but a card can still render fully varied AND
// fully generic ("the rota notes it quietly" + "the prep tilts under
// it" + "the count moves a touch"). The specificity rule on the same
// gate asserts that ≥70% of rendered lines mention something
// discriminating about the meter that moved.

describe('previewVariety gate — Phase 145 specificity on real pools', () => {
  it('staffAside surfaces meter-specific lines on a Mira-like 6-choice card', () => {
    const baseState = createInitialTavernState()
    const staffId = firstStaffId(baseState)
    const state = withStaffCast(baseState, staffId, MIRA_LIKE)
    const seed = staffSeed(state, 'mira-specificity-regression')

    const choices: PreviewVarietyChoice[] = [
      {
        slot: slot('pay_bonus', 'Pay bonus'),
        effects: [
          makeStateChangeEffect(`staff.${staffId}.morale`, 10),
          makeStateChangeEffect('coin', -15),
        ],
      },
      {
        slot: slot('reduce_workload', 'Reduce workload'),
        effects: [
          makeStateChangeEffect(`staff.${staffId}.fatigue`, -10),
          makePressureEffect('staff_burnout', -8),
        ],
      },
      {
        slot: slot('push_through', 'Push through'),
        effects: [
          makePressureEffect('staff_burnout', 8),
          makeStateChangeEffect(`staff.${staffId}.stress`, 6),
        ],
      },
    ]
    const sample: PreviewVarietySample = {
      seed,
      state,
      previewPool: staffAsideEffectPreviewPool,
      choices,
      maxPreview: 2,
    }
    const report = checkPreviewVariety(() => sample, {
      sampleSize: 1,
      specificity: { minSpecificityRatio: 0.7 },
    })
    expect(report.pass).toBe(true)
    // Specificity is observed and tracked when the rule runs.
    expect(report.observed.specificityRatio ?? 0).toBeGreaterThanOrEqual(0.7)
  })

  it('areaAtmosphere surfaces meter-specific lines on a multi-choice card', () => {
    const baseState = createInitialTavernState()
    const seed = makeSeed({
      id: 'area-atm-specificity',
      family: 'area_atmosphere',
      type: 'warning',
      timing: 'during_service',
      severity: 35,
      domain: ['areas'],
      location: { kind: 'area', id: 'privy' },
    })
    const choices: PreviewVarietyChoice[] = [
      {
        slot: slot('deep_clean', 'Deep clean'),
        effects: [
          makeStateChangeEffect('areas.privy.cleanliness', 25),
          makeStateChangeEffect('coin', -10),
        ],
      },
      {
        slot: slot('quick_mop', 'Quick mop'),
        effects: [
          makeStateChangeEffect('areas.privy.cleanliness', 10),
          makeStateChangeEffect('coin', -3),
        ],
      },
      {
        slot: slot('ignore_it', 'Let it slide'),
        effects: [
          makePressureEffect('reputation_drift', 4),
          makeStateChangeEffect('areas.privy.cleanliness', -5),
        ],
      },
    ]
    const sample: PreviewVarietySample = {
      seed,
      state: baseState,
      previewPool: areaAtmospherePreviewPool,
      choices,
      maxPreview: 2,
    }
    const report = checkPreviewVariety(() => sample, {
      sampleSize: 1,
      specificity: { minSpecificityRatio: 0.7 },
    })
    expect(report.pass).toBe(true)
    expect(report.observed.specificityRatio ?? 0).toBeGreaterThanOrEqual(0.7)
  })

  it('stockShortage, seasonalArc, and inspection all clear specificity on representative cards', () => {
    const baseState = createInitialTavernState()
    const stockSeed = makeSeed({
      id: 'stock-shortage-spec',
      family: 'stock_shortage',
      type: 'warning',
      timing: 'morning_prep',
      severity: 40,
      domain: ['stock'],
    })
    const arcSeed = makeSeed({
      id: 'arc-spec',
      family: 'seasonal_arc',
      type: 'arc_milestone',
      timing: 'morning_prep',
      severity: 30,
      domain: ['arc'],
    })
    const inspectionSeed = makeSeed({
      id: 'inspection-spec',
      family: 'inspection',
      type: 'inspection_threat',
      timing: 'morning_prep',
      severity: 50,
      domain: ['inspection'],
    })
    const baseChoices: PreviewVarietyChoice[] = [
      {
        slot: slot('option_a', 'Option A'),
        effects: [
          makeStateChangeEffect('stock.ale.quantity', 60),
          makeStateChangeEffect('coin', -30),
        ],
      },
      {
        slot: slot('option_b', 'Option B'),
        effects: [
          makeStateChangeEffect('stock.ale.salePrice', 1),
          makePressureEffect('reputation_drift', 3),
        ],
      },
      {
        slot: slot('option_c', 'Option C'),
        effects: [
          makePressureEffect('stock_shortage', 5),
          makeStateChangeEffect('coin', -10),
        ],
      },
    ]
    for (const [name, pool, seed] of [
      ['stockShortage', stockShortagePreviewPool, stockSeed],
      ['seasonalArc', seasonalArcPreviewPool, arcSeed],
      ['inspection', inspectionPreviewPool, inspectionSeed],
    ] as const) {
      const sample: PreviewVarietySample = {
        seed,
        state: baseState,
        previewPool: pool,
        choices: baseChoices,
        maxPreview: 2,
      }
      const report = checkPreviewVariety(() => sample, {
        sampleSize: 1,
        specificity: { minSpecificityRatio: 0.7 },
      })
      // Annotate failures with the pool name so the failure message is
      // useful when one of the three regresses independently.
      expect(report.pass, `${name} failed specificity`).toBe(true)
      expect(
        report.observed.specificityRatio ?? 0,
        `${name} specificityRatio`,
      ).toBeGreaterThanOrEqual(0.7)
    }
  })
})
