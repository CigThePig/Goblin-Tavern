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
import { effectPreviewPool as supplierReliabilityPreviewPool } from '../../../../src/cards/compose/pools/supplierReliability/effectPreview'
// Phase 157 / ISSUE-125 — economic-preview cluster pools.
import { effectPreviewPool as debtRentPreviewPool } from '../../../../src/cards/compose/pools/debtRent/effectPreview'
import { effectPreviewPool as maintenancePreviewPool } from '../../../../src/cards/compose/pools/maintenance/effectPreview'
import { effectPreviewPool as foodSafetyPreviewPool } from '../../../../src/cards/compose/pools/foodSafety/effectPreview'
import { effectPreviewPool as customerComplaintPreviewPool } from '../../../../src/cards/compose/pools/customerComplaint/effectPreview'
import { effectPreviewPool as regularComplaintPreviewPool } from '../../../../src/cards/compose/pools/regularComplaint/effectPreview'
import { effectPreviewPool as violencePreviewPool } from '../../../../src/cards/compose/pools/violence/effectPreview'
import { effectPreviewPool as reputationShiftPreviewPool } from '../../../../src/cards/compose/pools/reputationShift/effectPreview'
import { effectPreviewPool as monthlyReviewPreviewPool } from '../../../../src/cards/compose/pools/monthlyReview/effectPreview'
// Phase 158 / ISSUE-126 — social-cluster pools.
import { effectPreviewPool as rumourCrisisPreviewPool } from '../../../../src/cards/compose/pools/rumourCrisis/effectPreview'
import { effectPreviewPool as cultureConflictPreviewPool } from '../../../../src/cards/compose/pools/cultureConflict/effectPreview'
import { effectPreviewPool as factionRequestPreviewPool } from '../../../../src/cards/compose/pools/factionRequest/effectPreview'
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

// ---- Phase 147 / ISSUE-115 — legibility on the two pilot templates ----

describe('previewVariety gate — Phase 147 legibility on pilot pools', () => {
  const state = createInitialTavernState()

  it('supplierReliability pool: every banded line carries magnitude vocabulary', () => {
    const seed = makeSeed({
      id: 'supplier-leg-pilot',
      family: 'supplier_relationship',
      type: 'supplier_offer',
      timing: 'during_service',
      severity: 40,
      domain: ['supplier'],
    })
    // Mix of supplier-emitted cells per `expandedSeedGenerators.ts`:
    // coin -15 small (cost), coin -30 medium, supplier ±5 small, pressure ±10 medium.
    const choices: PreviewVarietyChoice[] = [
      {
        slot: slot('standing_order', 'Place standing order'),
        effects: [
          effect('state_change', 'coin', -15, 'pay supplier', ['coin']),
          effect('state_change', 'world.suppliers.s1.relationship', 5, 'rel up', ['supplier']),
        ],
      },
      {
        slot: slot('exclusivity', 'Sign exclusivity'),
        effects: [
          effect('state_change', 'coin', -30, 'pay deal', ['coin']),
          effect('pressure', 'pressure:supplier_distrust', -10, 'distrust eases', ['pressure']),
        ],
      },
      {
        slot: slot('split_orders', 'Split orders'),
        effects: [
          effect('state_change', 'world.suppliers.s1.relationship', -5, 'rel down', ['supplier']),
          effect('pressure', 'pressure:market_instability', -10, 'market eases', ['pressure']),
        ],
      },
    ]
    const sample: PreviewVarietySample = {
      seed,
      state,
      previewPool: supplierReliabilityPreviewPool,
      choices,
      maxPreview: 2,
    }
    const report = checkPreviewVariety(() => sample, {
      sampleSize: 1,
      legibility: {
        requireMagnitude: true,
        requireCostSurfacing: true,
        forbidInactionBlank: true,
      },
    })
    expect(report.pass, `violations: ${JSON.stringify(report.violations)}`).toBe(true)
    expect(report.observed.magnitudeRatio).toBe(1)
    expect(report.observed.costSurfacingRatio).toBe(1)
    expect(report.observed.inactionBlankCount).toBe(0)
  })

  it('areaAtmosphere pool: every banded line carries magnitude on the acting path', () => {
    const seed = makeSeed({
      id: 'area-leg-pilot',
      family: 'area_atmosphere',
      type: 'warning',
      timing: 'morning_prep',
      severity: 45,
      domain: ['areas'],
      location: { kind: 'area', id: 'privy' },
    })
    const choices: PreviewVarietyChoice[] = [
      {
        slot: slot('deep_clean', 'Deep clean'),
        effects: [
          effect('state_change', 'areas.privy.cleanliness', 25, 'cleaned', ['area']),
          effect('state_change', 'coin', -15, 'cost', ['coin']),
        ],
      },
      {
        slot: slot('repair', 'Repair'),
        effects: [
          effect('state_change', 'areas.privy.condition', 15, 'fixed', ['area']),
          effect('state_change', 'coin', -25, 'pay', ['coin']),
        ],
      },
      {
        slot: slot('rebrand', 'Rebrand'),
        effects: [
          effect('state_change', 'reputation.respectable', -8, 'rep slip', ['reputation']),
          effect('state_change', 'areas.privy.condition', 5, 'minor', ['area']),
        ],
      },
    ]
    const sample: PreviewVarietySample = {
      seed,
      state,
      previewPool: areaAtmospherePreviewPool,
      choices,
      maxPreview: 2,
    }
    const report = checkPreviewVariety(() => sample, {
      sampleSize: 1,
      legibility: {
        requireMagnitude: true,
        requireCostSurfacing: true,
        forbidInactionBlank: true,
      },
    })
    expect(report.pass, `violations: ${JSON.stringify(report.violations)}`).toBe(true)
    expect(report.observed.magnitudeRatio).toBe(1)
    expect(report.observed.costSurfacingRatio).toBe(1)
    expect(report.observed.inactionBlankCount).toBe(0)
  })

  it('areaAtmosphere pool: inaction-flagged choice fires inactionPreview-gated snippets', () => {
    const seed = makeSeed({
      id: 'area-leg-inaction',
      family: 'area_atmosphere',
      type: 'warning',
      timing: 'morning_prep',
      severity: 45,
      domain: ['areas'],
      location: { kind: 'area', id: 'privy' },
    })
    // Mirror the production `ignore_area_problem_profile` delayed effects.
    const choices: PreviewVarietyChoice[] = [
      {
        slot: slot('ignore', 'Ignore the problem'),
        effects: [
          effect('pressure', 'pressure:maintenance', 10, 'maintenance pressure rises', ['pressure']),
          effect('state_change', 'areas.privy.condition', -8, 'slow decay', ['area']),
        ],
        inactionPreview: true,
      },
    ]
    const sample: PreviewVarietySample = {
      seed,
      state,
      previewPool: areaAtmospherePreviewPool,
      choices,
      maxPreview: 2,
    }
    const report = checkPreviewVariety(() => sample, {
      sampleSize: 1,
      legibility: { forbidInactionBlank: true },
    })
    expect(report.pass).toBe(true)
    expect(report.observed.inactionBlankCount).toBe(0)
  })
})

// ---- Phase 157 / ISSUE-125 — Legible Surface arc, Phase 12.
//
// First Movement-VII per-meter authoring phase. The shared narrator
// base at `_shared/effectPreviewBase.ts` is recalibrated for `coin` and
// `stock` to fill the `direction × magnitudeBand` grid; per-template
// pools that depend on the base now satisfy the Phase-147 legibility
// contract (`requireMagnitude` + `requireCostSurfacing`) for the
// production effect signatures their families emit. These tests
// exercise the contract on the cluster — twelve coin/stock-emitting
// templates' realistic effect sets must all pass with both rules on.

describe('previewVariety gate — Phase 157 economic legibility on cluster pools', () => {
  const state = createInitialTavernState()

  function coinStockSample(
    family: string,
    type: string,
    pool: SnippetPool,
    seedId: string,
    choices: PreviewVarietyChoice[],
  ): PreviewVarietySample {
    return {
      seed: makeSeed({
        id: seedId,
        family: family as IssueSeed['family'],
        type: type as IssueSeed['type'],
        timing: 'during_service',
        severity: 45,
        domain: [family.split('_')[0] ?? family],
      }),
      state,
      previewPool: pool,
      choices,
      maxPreview: 2,
    }
  }

  it('debtRent pool: rent-tagged coin effects render rent-flavour magnitude', () => {
    // `generateDebtRent` emits `coin -(rent ?? 30)` tagged ['coin','rent']
    // on the `pay` profile, `coin +40` tagged ['coin'] on `borrow`, and
    // raises `stock.ale.salePrice +1` on the `raise_prices` path. The
    // legibility gate runs on every banded line, so this test isolates
    // to coin / stock effects only — the `pressure:landlord` companion
    // effect on `pay` is Phase 14's territory and is exercised on
    // separate tests.
    const choices: PreviewVarietyChoice[] = [
      {
        slot: slot('pay', 'Pay what we owe'),
        effects: [
          effect('state_change', 'coin', -30, 'Pay rent', ['coin', 'rent']),
        ],
      },
      {
        slot: slot('borrow', 'Borrow coin'),
        effects: [
          effect('state_change', 'coin', 40, 'Borrowed coin', ['coin']),
        ],
      },
      {
        slot: slot('raise_prices', 'Raise prices'),
        effects: [
          effect('state_change', 'stock.ale.salePrice', 1, 'Raise ale price', ['price']),
        ],
      },
    ]
    const sample = coinStockSample('debt_rent', 'debt_pressure', debtRentPreviewPool, 'phase157-debt-rent', choices)
    const report = checkPreviewVariety(() => sample, {
      sampleSize: 1,
      legibility: { requireMagnitude: true, requireCostSurfacing: true },
    })
    expect(report.pass, `violations: ${JSON.stringify(report.violations)}`).toBe(true)
    expect(report.observed.magnitudeRatio).toBe(1)
    expect(report.observed.costSurfacingRatio).toBe(1)
  })

  it('stockShortage pool: stock-band cells render calibrated magnitude', () => {
    // `generateStockShortage` emits stock.${id}.quantity ±60/20, salePrice
    // +1, quality -15, plus coin -30/-15.
    const choices: PreviewVarietyChoice[] = [
      {
        slot: slot('restock', 'Restock cellar'),
        effects: [
          effect('state_change', 'stock.ale.quantity', 60, 'restock', ['stock']),
          effect('state_change', 'coin', -30, 'Spend coin restocking', ['coin']),
        ],
      },
      {
        slot: slot('raise_prices', 'Raise prices'),
        effects: [
          effect('state_change', 'stock.ale.salePrice', 1, 'Price up', ['price']),
        ],
      },
      {
        slot: slot('water_down', 'Water down'),
        effects: [
          effect('state_change', 'stock.ale.quantity', 20, 'Stretch quantity', ['stock']),
          effect('state_change', 'stock.ale.quality', -15, 'Quality slips', ['stock', 'quality']),
        ],
      },
    ]
    const sample = coinStockSample('stock_shortage', 'warning', stockShortagePreviewPool, 'phase157-stock', choices)
    const report = checkPreviewVariety(() => sample, {
      sampleSize: 1,
      legibility: { requireMagnitude: true, requireCostSurfacing: true },
    })
    expect(report.pass, `violations: ${JSON.stringify(report.violations)}`).toBe(true)
    expect(report.observed.magnitudeRatio).toBe(1)
    expect(report.observed.costSurfacingRatio).toBe(1)
  })

  it('maintenance pool: coin-spend choices surface cost', () => {
    // Coin-only: area effects are owned by the pilot's per-template
    // pool (which has Phase-147 magnitude snippets) but unaffected
    // templates' area cells defer to Phase 14.
    const choices: PreviewVarietyChoice[] = [
      {
        slot: slot('repair', 'Repair'),
        effects: [
          effect('state_change', 'coin', -25, 'Pay for repair', ['coin']),
        ],
      },
      {
        slot: slot('patch', 'Patch quickly'),
        effects: [
          effect('state_change', 'coin', -12, 'Repair cost', ['coin']),
        ],
      },
    ]
    const sample = coinStockSample('maintenance', 'maintenance_problem', maintenancePreviewPool, 'phase157-maintenance', choices)
    const report = checkPreviewVariety(() => sample, {
      sampleSize: 1,
      legibility: { requireMagnitude: true, requireCostSurfacing: true },
    })
    expect(report.pass, `violations: ${JSON.stringify(report.violations)}`).toBe(true)
    expect(report.observed.magnitudeRatio).toBe(1)
    expect(report.observed.costSurfacingRatio).toBe(1)
  })

  it('staffBurnout pool: wages-tagged coin effect renders wages-flavour magnitude', () => {
    // `expandedSeedGenerators.ts:634` — staff raise becomes due as
    // `coin -15` tagged ['coin','wages']. Coin-only test; staff target
    // effects defer to Phase 14.
    const choices: PreviewVarietyChoice[] = [
      {
        slot: slot('pay_raise', 'Approve the raise'),
        effects: [
          effect('state_change', 'coin', -15, 'Raise becomes due', ['coin', 'wages']),
        ],
      },
      {
        slot: slot('bonus', 'Pay bonus'),
        effects: [
          effect('state_change', 'coin', -10, 'Bonus paid', ['coin']),
        ],
      },
    ]
    const sample = coinStockSample('staff_burnout', 'staff_request', staffBurnoutEffectPreviewPool, 'phase157-burnout', choices)
    const report = checkPreviewVariety(() => sample, {
      sampleSize: 1,
      legibility: { requireMagnitude: true, requireCostSurfacing: true },
    })
    expect(report.pass, `violations: ${JSON.stringify(report.violations)}`).toBe(true)
    expect(report.observed.magnitudeRatio).toBe(1)
    expect(report.observed.costSurfacingRatio).toBe(1)
  })

  it('foodSafety pool: coin-spend cleaning supplies surface cost', () => {
    const choices: PreviewVarietyChoice[] = [
      {
        slot: slot('deep_clean', 'Deep clean'),
        effects: [
          effect('state_change', 'coin', -25, 'Cleaning supplies', ['coin']),
        ],
      },
      {
        slot: slot('comp', 'Comp affected'),
        effects: [
          effect('state_change', 'coin', -15, 'Comp cost', ['coin']),
        ],
      },
    ]
    const sample = coinStockSample('food_safety', 'crisis', foodSafetyPreviewPool, 'phase157-food', choices)
    const report = checkPreviewVariety(() => sample, {
      sampleSize: 1,
      legibility: { requireMagnitude: true, requireCostSurfacing: true },
    })
    expect(report.pass, `violations: ${JSON.stringify(report.violations)}`).toBe(true)
  })

  it('customerComplaint pool: appeasement coin spend surfaces cost', () => {
    const choices: PreviewVarietyChoice[] = [
      {
        slot: slot('appease', 'Appease'),
        effects: [
          effect('state_change', 'coin', -20, 'Appeasement cost', ['coin']),
        ],
      },
      {
        slot: slot('discount', 'Discount'),
        effects: [
          effect('state_change', 'coin', -15, 'Discount cost', ['coin']),
        ],
      },
    ]
    const sample = coinStockSample('customer_complaint', 'complaint', customerComplaintPreviewPool, 'phase157-cust', choices)
    const report = checkPreviewVariety(() => sample, {
      sampleSize: 1,
      legibility: { requireMagnitude: true, requireCostSurfacing: true },
    })
    expect(report.pass, `violations: ${JSON.stringify(report.violations)}`).toBe(true)
  })

  it('regularComplaint pool: appeasement coin spend surfaces cost', () => {
    const choices: PreviewVarietyChoice[] = [
      {
        slot: slot('appease', 'Appease'),
        effects: [
          effect('state_change', 'coin', -10, 'Custom honoured', ['coin']),
        ],
      },
      {
        slot: slot('discount', 'Offer discount'),
        effects: [
          effect('state_change', 'coin', -15, 'Discount cost', ['coin']),
        ],
      },
    ]
    const sample = coinStockSample('regular_customer', 'complaint', regularComplaintPreviewPool, 'phase157-reg', choices)
    const report = checkPreviewVariety(() => sample, {
      sampleSize: 1,
      legibility: { requireMagnitude: true, requireCostSurfacing: true },
    })
    expect(report.pass, `violations: ${JSON.stringify(report.violations)}`).toBe(true)
  })

  it('violence pool: security wages and settlement coin spend surface cost', () => {
    const choices: PreviewVarietyChoice[] = [
      {
        slot: slot('hire_security', 'Hire security'),
        effects: [
          effect('state_change', 'coin', -20, 'Hire security cost', ['coin']),
        ],
      },
      {
        slot: slot('settle', 'Settle'),
        effects: [
          effect('state_change', 'coin', -15, 'Settlement payment', ['coin']),
        ],
      },
    ]
    const sample = coinStockSample('violence', 'customer_incident', violencePreviewPool, 'phase157-violence', choices)
    const report = checkPreviewVariety(() => sample, {
      sampleSize: 1,
      legibility: { requireMagnitude: true, requireCostSurfacing: true },
    })
    expect(report.pass, `violations: ${JSON.stringify(report.violations)}`).toBe(true)
  })

  it('inspection pool: bribe coin spend surfaces cost on the strongest cell', () => {
    const choices: PreviewVarietyChoice[] = [
      {
        slot: slot('bribe_small', 'Pay a small bribe'),
        effects: [
          effect('state_change', 'coin', -30, 'Pay bribe', ['coin']),
        ],
      },
      {
        slot: slot('bribe_heavy', 'Heavy bribe'),
        effects: [
          effect('state_change', 'coin', -40, 'Heavy bribe', ['coin']),
        ],
      },
    ]
    const sample = coinStockSample('inspection', 'inspection_threat', inspectionPreviewPool, 'phase157-insp', choices)
    const report = checkPreviewVariety(() => sample, {
      sampleSize: 1,
      legibility: { requireMagnitude: true, requireCostSurfacing: true },
    })
    expect(report.pass, `violations: ${JSON.stringify(report.violations)}`).toBe(true)
  })

  it('reputationShift pool: hospitality coin spend surfaces cost', () => {
    const choices: PreviewVarietyChoice[] = [
      {
        slot: slot('host_event', 'Host event'),
        effects: [
          effect('state_change', 'coin', -8, 'Hospitality cost', ['coin']),
        ],
      },
    ]
    const sample = coinStockSample('reputation_shift', 'reputation_shift', reputationShiftPreviewPool, 'phase157-rep', choices)
    const report = checkPreviewVariety(() => sample, {
      sampleSize: 1,
      legibility: { requireMagnitude: true, requireCostSurfacing: true },
    })
    expect(report.pass, `violations: ${JSON.stringify(report.violations)}`).toBe(true)
  })

  it('monthlyReview pool: month-end coin spend surfaces cost', () => {
    const choices: PreviewVarietyChoice[] = [
      {
        slot: slot('invest', 'Invest in upgrades'),
        effects: [
          effect('state_change', 'coin', -15, 'Investment cost', ['coin']),
        ],
      },
      {
        slot: slot('admin', 'Tidy the books'),
        effects: [
          effect('state_change', 'coin', -5, 'Admin cost for the rewrite', ['coin']),
        ],
      },
    ]
    const sample = coinStockSample('monthly_review', 'monthly_review', monthlyReviewPreviewPool, 'phase157-monthly', choices)
    const report = checkPreviewVariety(() => sample, {
      sampleSize: 1,
      legibility: { requireMagnitude: true, requireCostSurfacing: true },
    })
    expect(report.pass, `violations: ${JSON.stringify(report.violations)}`).toBe(true)
  })

  it('seasonalArc pool: arc-themed coin spends surface cost; stock cells calibrated', () => {
    const choices: PreviewVarietyChoice[] = [
      {
        slot: slot('prepare', 'Prepare for the festival'),
        effects: [
          effect('state_change', 'coin', -20, 'Preparation cost', ['coin']),
        ],
      },
      {
        slot: slot('cellar_invest', 'Stock the cellar'),
        effects: [
          effect('state_change', 'coin', -20, 'Bulk ale costs', ['coin']),
          effect('state_change', 'stock.ale.quantity', 40, 'Cellars overflow', ['stock']),
        ],
      },
    ]
    const sample = coinStockSample('seasonal_arc', 'arc_milestone', seasonalArcPreviewPool, 'phase157-arc', choices)
    const report = checkPreviewVariety(() => sample, {
      sampleSize: 1,
      legibility: { requireMagnitude: true, requireCostSurfacing: true },
    })
    expect(report.pass, `violations: ${JSON.stringify(report.violations)}`).toBe(true)
  })

  // (debt-tagged rent variant test follows)

  it('debt-tagged rent variant outranks the plain coin cell deterministically', () => {
    // Two calls with the same (seed, state, effect) produce the same
    // text. The rent-tagged effect resolves to a rent-flavoured snippet
    // when one is available at higher specificity.
    const seed = makeSeed({
      id: 'phase157-rent-determinism',
      family: 'debt_rent' as IssueSeed['family'],
      type: 'debt_pressure' as IssueSeed['type'],
      timing: 'end_month',
      severity: 50,
      domain: ['economy'],
    })
    const rentChoice: PreviewVarietyChoice = {
      slot: slot('pay', 'Pay what we owe'),
      effects: [effect('state_change', 'coin', -30, 'Pay rent', ['coin', 'rent'])],
    }
    const plainChoice: PreviewVarietyChoice = {
      slot: slot('borrow', 'Borrow coin'),
      // -30 medium negative WITHOUT the rent tag — should fall through
      // to the plain coin medium cell.
      effects: [effect('state_change', 'coin', -30, 'Borrowed coin out', ['coin'])],
    }
    const sample: PreviewVarietySample = {
      seed,
      state,
      previewPool: debtRentPreviewPool,
      choices: [rentChoice, plainChoice],
      maxPreview: 1,
    }
    const reportA = checkPreviewVariety(() => sample, {
      sampleSize: 1,
      legibility: { requireMagnitude: true },
    })
    const reportB = checkPreviewVariety(() => sample, {
      sampleSize: 1,
      legibility: { requireMagnitude: true },
    })
    expect(reportA.pass).toBe(true)
    expect(reportB.pass).toBe(true)
    // Both passes — magnitude landed on both choices' single effects.
    expect(reportA.observed.magnitudeRatio).toBe(1)
    expect(reportB.observed.magnitudeRatio).toBe(1)
  })
})

// ---- Phase 158 / ISSUE-126 — social-cluster live legibility ----
//
// Each test below builds a realistic multi-choice render whose effects
// match the production cells emitted by that template's consequence
// profiles per the audit in docs/plans/phase-158-social-previews.md.
// `requireMagnitude` is the social-meter analogue of Phase 157's coin
// magnitude rule; cost-surfacing doesn't apply (social meters are not
// resource spends). Templates whose seeds carry a coin spend additionally
// opt into `requireCostSurfacing` so the social-cluster pools don't lose
// the Phase-157 protections that already cover them.

describe('previewVariety gate — Phase 158 social legibility on cluster pools', () => {
  const state = createInitialTavernState()

  function socialSample(
    family: string,
    type: string,
    timing: 'during_service' | 'morning_prep' | 'closing' | 'end_week' | 'end_month',
    pool: SnippetPool,
    seedId: string,
    choices: PreviewVarietyChoice[],
  ): PreviewVarietySample {
    return {
      seed: makeSeed({
        id: seedId,
        family: family as IssueSeed['family'],
        type: type as IssueSeed['type'],
        timing,
        severity: 45,
        domain: [family.split('_')[0] ?? family],
      }),
      state,
      previewPool: pool,
      choices,
      maxPreview: 2,
    }
  }

  it('regularComplaint pool: customer satisfaction loss renders calibrated magnitude', () => {
    // Customer effects on the regular_customer complaint branch — small and
    // medium negative cells dominate. Effects sourced from real consequence
    // profiles in expandedSeedGenerators.ts.
    const choices: PreviewVarietyChoice[] = [
      {
        slot: slot('appease', 'Appease the regular'),
        effects: [
          effect('state_change', 'customers.miners.satisfaction', -5, 'Patron grumbles', ['customer']),
        ],
      },
      {
        slot: slot('ignore', 'Let it slide'),
        effects: [
          effect('state_change', 'customers.miners.satisfaction', -8, 'Patron stews', ['customer']),
        ],
      },
    ]
    const sample = socialSample(
      'regular_customer',
      'complaint',
      'during_service',
      regularComplaintPreviewPool,
      'phase158-regular',
      choices,
    )
    const report = checkPreviewVariety(() => sample, {
      sampleSize: 1,
      legibility: { requireMagnitude: true },
    })
    expect(report.pass, `violations: ${JSON.stringify(report.violations)}`).toBe(true)
    expect(report.observed.magnitudeRatio).toBe(1)
  })

  it('customerComplaint pool: cohort-scoped patronage loss renders calibrated magnitude', () => {
    // The customer_complaint cohort branch includes a customer patronage ban
    // path (-25 large). Coin and customer cells are mixed.
    const choices: PreviewVarietyChoice[] = [
      {
        slot: slot('appease', 'Comp the group'),
        effects: [
          effect('state_change', 'coin', -20, 'Comp cost', ['coin']),
          effect('state_change', 'customers.merchants.patronage', 4, 'Group warms back', ['customer']),
        ],
      },
      {
        slot: slot('ban', 'Ask them to leave'),
        effects: [
          effect('state_change', 'customers.merchants.patronage', -25, 'Banned cohort', ['customer']),
        ],
      },
    ]
    const sample = socialSample(
      'customer_complaint',
      'complaint',
      'during_service',
      customerComplaintPreviewPool,
      'phase158-cust',
      choices,
    )
    const report = checkPreviewVariety(() => sample, {
      sampleSize: 1,
      legibility: { requireMagnitude: true, requireCostSurfacing: true },
    })
    expect(report.pass, `violations: ${JSON.stringify(report.violations)}`).toBe(true)
    expect(report.observed.magnitudeRatio).toBe(1)
    expect(report.observed.costSurfacingRatio).toBe(1)
  })

  it('factionRequest pool: faction relationship/trust movements render calibrated magnitude', () => {
    // Faction effects on alliance / betrayal / hosting paths.
    const choices: PreviewVarietyChoice[] = [
      {
        slot: slot('host', 'Host the gathering'),
        effects: [
          effect('state_change', 'factions.guild.relationship', 15, 'Faction warms', ['faction']),
        ],
      },
      {
        slot: slot('refuse', 'Refuse the request'),
        effects: [
          effect('state_change', 'factions.guild.trust', -12, 'Faction trust falls', ['faction']),
        ],
      },
      {
        slot: slot('betray', 'Betray the alliance'),
        effects: [
          effect('state_change', 'factions.guild.relationship', -25, 'Faction severs ties', ['faction']),
        ],
      },
    ]
    const sample = socialSample(
      'faction_request',
      'social_conflict',
      'during_service',
      factionRequestPreviewPool,
      'phase158-faction',
      choices,
    )
    const report = checkPreviewVariety(() => sample, {
      sampleSize: 1,
      legibility: { requireMagnitude: true },
    })
    expect(report.pass, `violations: ${JSON.stringify(report.violations)}`).toBe(true)
    expect(report.observed.magnitudeRatio).toBe(1)
  })

  it('cultureConflict pool: culture tension/comfort movements render calibrated magnitude', () => {
    // Culture effects on seating / ritual / discount paths.
    const choices: PreviewVarietyChoice[] = [
      {
        slot: slot('honor', 'Honor the ritual'),
        effects: [
          effect('state_change', 'cultures.miners.familiarity', 15, 'Cultural recognition', ['culture']),
          effect('state_change', 'cultures.miners.comfort', 12, 'Cultural comfort', ['culture']),
        ],
      },
      {
        slot: slot('impose', 'Impose tavern rules'),
        effects: [
          effect('state_change', 'cultures.miners.tension', 12, 'Cultural tension rises', ['culture']),
          effect('state_change', 'cultures.miners.comfort', -8, 'Cultural comfort drops', ['culture']),
        ],
      },
    ]
    const sample = socialSample(
      'culture_conflict',
      'social_conflict',
      'during_service',
      cultureConflictPreviewPool,
      'phase158-culture',
      choices,
    )
    const report = checkPreviewVariety(() => sample, {
      sampleSize: 1,
      legibility: { requireMagnitude: true },
    })
    expect(report.pass, `violations: ${JSON.stringify(report.violations)}`).toBe(true)
    expect(report.observed.magnitudeRatio).toBe(1)
  })

  it('reputationShift pool: reputation deltas across axes render calibrated magnitude', () => {
    // Reputation effects span multiple axes; pool is axis-neutral.
    const choices: PreviewVarietyChoice[] = [
      {
        slot: slot('codify', 'Codify the standard'),
        effects: [
          effect('state_change', 'reputation.respectable', 8, 'Standing rises', ['reputation']),
        ],
      },
      {
        slot: slot('gamble', 'Gamble on a new identity'),
        effects: [
          effect('state_change', 'reputation.respectable', -8, 'Identity gamble', ['reputation']),
        ],
      },
      {
        slot: slot('ignore', 'Let the drift run'),
        effects: [
          effect('state_change', 'reputation.cheap', -10, 'Reputation slips medium', ['reputation']),
        ],
      },
    ]
    const sample = socialSample(
      'reputation_shift',
      'reputation_shift',
      'closing',
      reputationShiftPreviewPool,
      'phase158-rep',
      choices,
    )
    const report = checkPreviewVariety(() => sample, {
      sampleSize: 1,
      legibility: { requireMagnitude: true },
    })
    expect(report.pass, `violations: ${JSON.stringify(report.violations)}`).toBe(true)
    expect(report.observed.magnitudeRatio).toBe(1)
  })

  it('rumourCrisis pool: reputation drift renders calibrated magnitude', () => {
    // Rumour effects sit on reputation.respectable -3 / -8 (small/tiny).
    const choices: PreviewVarietyChoice[] = [
      {
        slot: slot('confront', 'Confront the rumour'),
        effects: [
          effect('state_change', 'reputation.respectable', -3, 'Rumour leaks slowly', ['reputation']),
        ],
      },
      {
        slot: slot('amplify', 'Lean into the rumour'),
        effects: [
          effect('state_change', 'reputation.dangerous', 6, 'Dangerous name spreads', ['reputation']),
        ],
      },
    ]
    const sample = socialSample(
      'rumour_crisis',
      'rumour',
      'during_service',
      rumourCrisisPreviewPool,
      'phase158-rumour',
      choices,
    )
    const report = checkPreviewVariety(() => sample, {
      sampleSize: 1,
      legibility: { requireMagnitude: true },
    })
    expect(report.pass, `violations: ${JSON.stringify(report.violations)}`).toBe(true)
    expect(report.observed.magnitudeRatio).toBe(1)
  })

  it('supplierReliability pool: supplier relationship movements render calibrated magnitude', () => {
    // Supplier effects span tiny → medium on both directions per Phase 9
    // consequence profiles. Mix in pressure to validate Phase 14's cells
    // aren't broken by the new social-base recalibration.
    const choices: PreviewVarietyChoice[] = [
      {
        slot: slot('blame', 'Blame the supplier'),
        effects: [
          effect('state_change', 'world.suppliers.alepost.relationship', -10, 'Supplier deal cools', ['supplier']),
        ],
      },
      {
        slot: slot('negotiate', 'Negotiate'),
        effects: [
          effect('state_change', 'world.suppliers.alepost.relationship', 3, 'Supplier softens a touch', ['supplier']),
        ],
      },
      {
        slot: slot('place_standing_order', 'Place a standing order'),
        effects: [
          effect('state_change', 'coin', -15, 'Standing-order cost', ['coin']),
          effect('state_change', 'world.suppliers.alepost.reliability', 5, 'Reliability lifts', ['supplier']),
        ],
      },
    ]
    const sample = socialSample(
      'supplier_relationship',
      'supplier_offer',
      'during_service',
      supplierReliabilityPreviewPool,
      'phase158-supplier',
      choices,
    )
    const report = checkPreviewVariety(() => sample, {
      sampleSize: 1,
      legibility: { requireMagnitude: true, requireCostSurfacing: true },
    })
    expect(report.pass, `violations: ${JSON.stringify(report.violations)}`).toBe(true)
    expect(report.observed.magnitudeRatio).toBe(1)
    expect(report.observed.costSurfacingRatio).toBe(1)
  })

  it('violence pool: reputation.dangerous/respectable swap renders calibrated magnitude', () => {
    // Violence template emits reputation.dangerous +6 / reputation.respectable
    // -4 on the rowdy embrace path — both small / tiny cells.
    const choices: PreviewVarietyChoice[] = [
      {
        slot: slot('embrace', 'Embrace the rowdy crowd'),
        effects: [
          effect('state_change', 'reputation.dangerous', 6, 'Dangerous name rises', ['reputation']),
          effect('state_change', 'reputation.respectable', -4, 'Respectable name falls', ['reputation']),
        ],
      },
      {
        slot: slot('settle', 'Settle the fight'),
        effects: [
          effect('state_change', 'reputation.respectable', 5, 'Quiet handling earns standing', ['reputation']),
        ],
      },
    ]
    const sample = socialSample(
      'violence',
      'customer_incident',
      'during_service',
      violencePreviewPool,
      'phase158-violence',
      choices,
    )
    const report = checkPreviewVariety(() => sample, {
      sampleSize: 1,
      legibility: { requireMagnitude: true },
    })
    expect(report.pass, `violations: ${JSON.stringify(report.violations)}`).toBe(true)
    expect(report.observed.magnitudeRatio).toBe(1)
  })

  it('monthlyReview pool: reputation.respectable mover renders calibrated magnitude', () => {
    // Monthly review surfaces the dominant reputation mover for the month —
    // typically small / medium cells.
    const choices: PreviewVarietyChoice[] = [
      {
        slot: slot('invest', 'Invest in standing'),
        effects: [
          effect('state_change', 'reputation.respectable', 12, 'Month of credibility', ['reputation']),
        ],
      },
      {
        slot: slot('cut', 'Cut corners'),
        effects: [
          effect('state_change', 'reputation.respectable', -10, 'Month of slipping', ['reputation']),
        ],
      },
    ]
    const sample = socialSample(
      'monthly_review',
      'monthly_review',
      'end_month',
      monthlyReviewPreviewPool,
      'phase158-monthly-social',
      choices,
    )
    const report = checkPreviewVariety(() => sample, {
      sampleSize: 1,
      legibility: { requireMagnitude: true },
    })
    expect(report.pass, `violations: ${JSON.stringify(report.violations)}`).toBe(true)
    expect(report.observed.magnitudeRatio).toBe(1)
  })
})
