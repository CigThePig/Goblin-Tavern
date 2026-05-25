// Phase 95 — Templates under the voice composer.
//
// Per-template tests: word-budget compliance, deterministic re-render,
// and tone landing. These are additive — `tests/cards/templates.test.ts`
// continues to pin the legacy behaviour (apply-to / choice / non-mutation).

import { describe, expect, it } from 'vitest'

import {
  foodSafetyCrisisCard,
  customerComplaintCard,
  regularComplaintCard,
  supplierReliabilityCard,
  stockShortageCard,
  debtRentCard,
  maintenanceCard,
  areaAtmosphereCard,
  staffBurnoutCard,
  factionRequestCard,
  cultureConflictCard,
  reputationShiftCard,
  rumourCrisisCard,
  rivalTavernCard,
  monthlyReviewCard,
  seasonalArcCard,
  fallbackCard,
} from '../../src/cards/index'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import type { CardDefinition, CardView } from '../../src/cards/types'

import { makeSeed } from './cardFactories'

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length
}

function assertBudget(view: CardView): void {
  expect(view.title.length).toBeGreaterThan(0)
  expect(wordCount(view.title.replace('…', ''))).toBeLessThanOrEqual(6)
  for (const line of view.body) {
    expect(wordCount(line.replace('…', ''))).toBeLessThanOrEqual(12)
  }
  expect(view.body.length).toBeLessThanOrEqual(3)
}

// Phase 135 / ISSUE-104 — compositional templates whose title prefixes
// an actor display name (`${display}: ${snippet}`) cannot honour the
// 6-word title cap of the legacy `assertBudget` because the display
// name lifts the count. The composed `title` SLOT itself is still
// capped at 6 words (gated by the voice-bounds gate); this helper
// checks only the body budgets + non-empty title.
function assertBodyBudgetOnly(view: CardView): void {
  expect(view.title.length).toBeGreaterThan(0)
  expect(view.title).not.toContain('…')
  expect(view.title).not.toContain('...')
  for (const line of view.body) {
    expect(wordCount(line.replace('…', ''))).toBeLessThanOrEqual(14)
  }
  expect(view.body.length).toBeLessThanOrEqual(3)
}

function assertDeterministic(
  card: CardDefinition,
  seedBlueprint: Parameters<typeof makeSeed>[0],
): void {
  const seed = makeSeed(seedBlueprint)
  const state = createInitialTavernState()
  const a = card.render(seed, state)
  const b = card.render(seed, state)
  expect(a.title).toBe(b.title)
  expect(a.body).toEqual(b.body)
}

// ---------- Per-template budget + determinism ----------

describe('foodSafetyCrisisCard voice', () => {
  // Phase 138 / ISSUE-107 — Voiced Surface arc, Phase 12 (Crises &
  // Safety). Rewrites in place the legacy block that asserted
  // pickSeverityAdjective fragments landed in the rendered title /
  // body. The compositional template is actor-voiced via the cook's
  // castAttributes; voice comes from the snippet pools, not the
  // retired voice composer.
  it('honours the budget', () => {
    const state = createInitialTavernState()
    const seed = makeSeed({
      family: 'food_safety',
      type: 'crisis',
      timing: 'morning_prep',
      severity: 80,
      primaryActor: { kind: 'staff', id: 'cook' },
      location: { kind: 'area', id: 'kitchen' },
    })
    const view = foodSafetyCrisisCard.render(seed, state)
    assertBudget(view)
  })

  it('is deterministic per seed id', () => {
    const state = createInitialTavernState()
    const seed = makeSeed({
      id: 'food-safety-voice-A',
      family: 'food_safety',
      type: 'crisis',
      timing: 'morning_prep',
      severity: 80,
      primaryActor: { kind: 'staff', id: 'cook' },
      location: { kind: 'area', id: 'kitchen' },
    })
    const a = foodSafetyCrisisCard.render(seed, state)
    const b = foodSafetyCrisisCard.render(seed, state)
    expect(a.title).toBe(b.title)
    expect(a.body).toEqual(b.body)
  })

  it('emits no legacy pickSeverityAdjective glue in the title', () => {
    const state = createInitialTavernState()
    const seed = makeSeed({
      id: 'food-safety-voice-B',
      family: 'food_safety',
      type: 'crisis',
      timing: 'morning_prep',
      severity: 80,
      primaryActor: { kind: 'staff', id: 'cook' },
      location: { kind: 'area', id: 'kitchen' },
      textIngredients: {
        subject: 'the kitchen',
        sensoryDetails: ['greasy floor'],
      },
    })
    const view = foodSafetyCrisisCard.render(seed, state)
    // Phase 5 frame discipline — no trailing "…" / "..." and no
    // duplicated subject pattern like "Acrid the kitchen: the kitchen".
    expect(view.title.endsWith('…')).toBe(false)
    expect(view.title.endsWith('...')).toBe(false)
    expect(view.title).not.toMatch(/(the kitchen): \1/i)
  })
})

// Phase 134 / ISSUE-103 — Voiced Surface arc, Phase 8 (Regulars & Complaints).
// Replaces the legacy `customerComplaintCard voice` block; the legacy
// template covered two seed families through one entry, the new
// compositional split has one block per template.
describe('customerComplaintCard voice (cohort case)', () => {
  it('honours the budget', () => {
    const seed = makeSeed({
      family: 'customer_complaint',
      type: 'complaint',
      timing: 'during_service',
    })
    const view = customerComplaintCard.render(seed, createInitialTavernState())
    assertBudget(view)
  })

  it('is deterministic per seed id', () => {
    assertDeterministic(customerComplaintCard, {
      family: 'customer_complaint',
      type: 'complaint',
      timing: 'during_service',
    })
  })
})

describe('regularComplaintCard voice (named-regular case)', () => {
  it('honours the budget', () => {
    const seed = makeSeed({
      family: 'regular_customer',
      type: 'complaint',
      timing: 'during_service',
    })
    const view = regularComplaintCard.render(seed, createInitialTavernState())
    assertBudget(view)
  })

  it('is deterministic per seed id', () => {
    assertDeterministic(regularComplaintCard, {
      family: 'regular_customer',
      type: 'complaint',
      timing: 'during_service',
    })
  })
})

// Phase 135 / ISSUE-104 — Voiced Surface arc, Phase 9. The legacy
// supplierOfferCard voice block is replaced by three new blocks: the
// supplierReliability (actor-voiced) plus the two narrator-voiced
// templates stockShortage and debtRent. The shared assertion is that
// the body never surfaces raw mechanical readouts (the symptom this
// migration is killing — `"reliability 45"`, `"low stock"`,
// `"debt 30"`).
describe('supplierReliabilityCard voice', () => {
  it('honours the body budget (composed display prefix lifts title past the legacy 6-word cap)', () => {
    const state = createInitialTavernState()
    const supplierId = Object.keys(state.world.suppliers)[0]!
    const seed = makeSeed({
      family: 'supplier_relationship',
      type: 'supplier_offer',
      timing: 'morning_prep',
      primaryActor: { kind: 'supplier', id: supplierId },
    })
    const view = supplierReliabilityCard.render(seed, state)
    assertBodyBudgetOnly(view)
  })

  it('body never contains a raw reliability readout', () => {
    const state = createInitialTavernState()
    const supplierId = Object.keys(state.world.suppliers)[0]!
    const seed = makeSeed({
      family: 'supplier_relationship',
      type: 'supplier_offer',
      timing: 'morning_prep',
      primaryActor: { kind: 'supplier', id: supplierId },
    })
    const view = supplierReliabilityCard.render(seed, state)
    for (const line of view.body) {
      expect(line).not.toMatch(/reliability \d+/i)
    }
  })

  it('is deterministic per seed id', () => {
    const state = createInitialTavernState()
    const supplierId = Object.keys(state.world.suppliers)[0]!
    assertDeterministic(supplierReliabilityCard, {
      family: 'supplier_relationship',
      type: 'supplier_offer',
      timing: 'morning_prep',
      primaryActor: { kind: 'supplier', id: supplierId },
    })
    void state
  })
})

describe('stockShortageCard voice', () => {
  it('honours the budget', () => {
    const seed = makeSeed({
      family: 'stock_shortage',
      type: 'warning',
      timing: 'morning_prep',
      domain: ['stock'],
    })
    const view = stockShortageCard.render(seed, createInitialTavernState())
    assertBudget(view)
  })

  it('body never contains a raw stock readout', () => {
    const seed = makeSeed({
      family: 'stock_shortage',
      type: 'warning',
      timing: 'morning_prep',
      domain: ['stock'],
    })
    const view = stockShortageCard.render(seed, createInitialTavernState())
    for (const line of view.body) {
      expect(line).not.toMatch(/quantity \d+/)
      expect(line.toLowerCase()).not.toBe('low stock')
    }
  })

  it('is deterministic per seed id', () => {
    assertDeterministic(stockShortageCard, {
      family: 'stock_shortage',
      type: 'warning',
      timing: 'morning_prep',
      domain: ['stock'],
    })
  })
})

describe('debtRentCard voice', () => {
  it('honours the budget', () => {
    const seed = makeSeed({
      family: 'debt_rent',
      type: 'debt_pressure',
      timing: 'end_month',
      domain: ['economy', 'monthly', 'landlord'],
    })
    const view = debtRentCard.render(seed, createInitialTavernState())
    assertBudget(view)
  })

  it('body never contains a raw debt or landlord readout', () => {
    const seed = makeSeed({
      family: 'debt_rent',
      type: 'debt_pressure',
      timing: 'end_month',
      domain: ['economy', 'monthly', 'landlord'],
    })
    const view = debtRentCard.render(seed, createInitialTavernState())
    for (const line of view.body) {
      expect(line).not.toMatch(/debt \d+/i)
      expect(line).not.toMatch(/landlord \d+/i)
    }
  })

  it('is deterministic per seed id', () => {
    assertDeterministic(debtRentCard, {
      family: 'debt_rent',
      type: 'debt_pressure',
      timing: 'end_month',
      domain: ['economy', 'monthly', 'landlord'],
    })
  })
})

describe('maintenanceCard voice', () => {
  // Phase 137 / ISSUE-106 — Voiced Surface arc, Phase 11. Replaces the
  // legacy `maintenanceWarningCard voice` block. The compositional
  // template's body lines pass through the snippet layer rather than
  // hand-glued textIngredients; the title carries the area label as
  // its `${area.label}: ${snippet}` prefix, so the legacy 6-word
  // assertBudget cap doesn't apply.
  it('body and title pass through the compositional pools — no raw mechanical readouts', () => {
    const seed = makeSeed({
      family: 'maintenance',
      type: 'maintenance_problem',
      timing: 'morning_prep',
      location: { kind: 'area', id: 'main_room' },
    })
    const view = maintenanceCard.render(seed, createInitialTavernState())
    assertBodyBudgetOnly(view)
    for (const line of view.body) {
      expect(line).not.toMatch(/damage \d+/)
      expect(line).not.toMatch(/condition \d+/)
    }
    expect(view.title).not.toMatch(/^(Dirty|Damaged|Smelly|Risky)\s/)
  })

  it('is deterministic per seed id', () => {
    assertDeterministic(maintenanceCard, {
      family: 'maintenance',
      type: 'maintenance_problem',
      timing: 'morning_prep',
      location: { kind: 'area', id: 'main_room' },
    })
  })
})

describe('areaAtmosphereCard voice', () => {
  // Phase 137 / ISSUE-106 — Voiced Surface arc, Phase 11. First
  // dedicated voice block for area_atmosphere.
  it('body and title pass through the compositional pools — no raw mechanical readouts', () => {
    const seed = makeSeed({
      family: 'area_atmosphere',
      type: 'warning',
      timing: 'morning_prep',
      location: { kind: 'area', id: 'main_room' },
      affectedActors: [{ kind: 'area', id: 'main_room' }],
    })
    const view = areaAtmosphereCard.render(seed, createInitialTavernState())
    assertBodyBudgetOnly(view)
    for (const line of view.body) {
      expect(line).not.toMatch(/cleanliness \d+/)
      expect(line).not.toMatch(/damage \d+/)
    }
  })

  it('is deterministic per seed id', () => {
    assertDeterministic(areaAtmosphereCard, {
      family: 'area_atmosphere',
      type: 'warning',
      timing: 'morning_prep',
      location: { kind: 'area', id: 'main_room' },
      affectedActors: [{ kind: 'area', id: 'main_room' }],
    })
  })
})

describe('staffBurnoutCard voice', () => {
  // Phase 133 / ISSUE-102 — Voiced Surface arc, Phase 7. Replaces the
  // staffRequestCard voice block. Timing changed from `closing` (legacy
  // declaration that never matched a real seed) to `morning_prep` (the
  // generator's actual output).
  it('honours the budget', () => {
    const state = createInitialTavernState()
    const staffId = Object.keys(state.staff)[0]!
    const seed = makeSeed({
      family: 'staff_burnout',
      type: 'staff_request',
      timing: 'morning_prep',
      primaryActor: { kind: 'staff', id: staffId },
    })
    const view = staffBurnoutCard.render(seed, state)
    assertBudget(view)
  })

  it('is deterministic per seed id', () => {
    const state = createInitialTavernState()
    const staffId = Object.keys(state.staff)[0]!
    const seed = makeSeed({
      id: 'staff-voice-A',
      family: 'staff_burnout',
      type: 'staff_request',
      timing: 'morning_prep',
      primaryActor: { kind: 'staff', id: staffId },
    })
    const a = staffBurnoutCard.render(seed, state)
    const b = staffBurnoutCard.render(seed, state)
    expect(a.title).toBe(b.title)
    expect(a.body).toEqual(b.body)
  })
})

// Phase 136 / ISSUE-105 — Voiced Surface arc, Phase 10 (Factions & Culture).
// Replaces the legacy factionRequestCard voice block. Timing changed
// from `morning_prep` (legacy fiction that never matched a real seed)
// to `during_service` (the generator's actual output). Type changed
// from `relationship_test` (dead legacy admission) to `social_conflict`
// (the only type the generator emits).
describe('factionRequestCard voice', () => {
  it('honours the budget', () => {
    const state = createInitialTavernState()
    const factionId = Object.keys(state.world.factions)[0]
    const seed = makeSeed({
      family: 'faction_request',
      type: 'social_conflict',
      timing: 'during_service',
      ...(factionId ? { primaryActor: { kind: 'faction', id: factionId } } : {}),
    })
    const view = factionRequestCard.render(seed, state)
    assertBodyBudgetOnly(view)
  })

  it('is deterministic per seed id', () => {
    const state = createInitialTavernState()
    const factionId = Object.keys(state.world.factions)[0]
    const seed = makeSeed({
      id: 'faction-voice-A',
      family: 'faction_request',
      type: 'social_conflict',
      timing: 'during_service',
      ...(factionId ? { primaryActor: { kind: 'faction', id: factionId } } : {}),
    })
    const a = factionRequestCard.render(seed, state)
    const b = factionRequestCard.render(seed, state)
    expect(a.title).toBe(b.title)
    expect(a.body).toEqual(b.body)
  })

  it('never surfaces a raw reliability / relationship / cultural-friction stat readout', () => {
    const state = createInitialTavernState()
    const factionId = Object.keys(state.world.factions)[0]!
    const seed = makeSeed({
      family: 'faction_request',
      type: 'social_conflict',
      timing: 'during_service',
      primaryActor: { kind: 'faction', id: factionId },
    })
    const view = factionRequestCard.render(seed, state)
    for (const line of [view.title, ...view.body]) {
      expect(line).not.toMatch(/relationship \d+/i)
      expect(line).not.toMatch(/influence \d+/i)
      expect(line).not.toMatch(/faction anger \d+/i)
      expect(line).not.toBe('cultural friction')
    }
  })
})

describe('cultureConflictCard voice', () => {
  it('honours the budget', () => {
    const state = createInitialTavernState()
    const cultureId = Object.keys(state.world.cultures)[0]
    // Phase 152 / ISSUE-120: the Phase-7 multi-fact salience policy
    // on `establishing_line` joins two snippets when more than one
    // culture meter resolves to a non-mid band; the joined line uses
    // the slot's `multiFactBudget` (default wordBudget * 2 = 28) rather
    // than the per-snippet 14-word budget. Starter culture defaults
    // (tension=20, comfort=70, familiarity=80) resolve two high-band
    // signals and trigger the join. Pin all three meters to mid so
    // this body-budget test exercises the per-snippet baseline, not
    // the joined output (which is exercised by phase152's matrix tests).
    const meterPinned = cultureId
      ? {
          ...state,
          world: {
            ...state.world,
            cultures: {
              ...state.world.cultures,
              [cultureId]: {
                ...state.world.cultures[cultureId]!,
                tension: 50,
                comfort: 50,
                familiarity: 50,
              },
            },
          },
        }
      : state
    const seed = makeSeed({
      family: 'culture_conflict',
      type: 'social_conflict',
      timing: 'during_service',
      ...(cultureId ? { primaryActor: { kind: 'culture', id: cultureId } } : {}),
    })
    const view = cultureConflictCard.render(seed, meterPinned)
    assertBodyBudgetOnly(view)
  })

  it('is deterministic per seed id', () => {
    const state = createInitialTavernState()
    const cultureId = Object.keys(state.world.cultures)[0]
    const seed = makeSeed({
      id: 'culture-voice-A',
      family: 'culture_conflict',
      type: 'social_conflict',
      timing: 'during_service',
      ...(cultureId ? { primaryActor: { kind: 'culture', id: cultureId } } : {}),
    })
    const a = cultureConflictCard.render(seed, state)
    const b = cultureConflictCard.render(seed, state)
    expect(a.title).toBe(b.title)
    expect(a.body).toEqual(b.body)
  })

  it('never surfaces a raw tension stat readout', () => {
    const state = createInitialTavernState()
    const cultureId = Object.keys(state.world.cultures)[0]!
    const seed = makeSeed({
      family: 'culture_conflict',
      type: 'social_conflict',
      timing: 'during_service',
      primaryActor: { kind: 'culture', id: cultureId },
    })
    const view = cultureConflictCard.render(seed, state)
    for (const line of [view.title, ...view.body]) {
      expect(line).not.toMatch(/tension \d+/i)
      expect(line).not.toMatch(/comfort \d+/i)
      expect(line).not.toMatch(/familiarity \d+/i)
      expect(line).not.toBe('cultural friction')
    }
  })
})

// Phase 139 / ISSUE-108 — Voiced Surface arc, Phase 13. The legacy
// `reputationShiftWeeklyCard voice` block split into three blocks (one
// per new compositional template). Each block uses the body-budget-only
// helper because the title-prefix lifts the count above the legacy
// 6-word total budget; the composed title slot itself is still capped
// at 6 words by the voice-bounds gate.

describe('reputationShiftCard voice', () => {
  it('honours the body budget and never clamps the title with "…"', () => {
    const seed = makeSeed({
      family: 'reputation_shift',
      type: 'reputation_shift',
      timing: 'closing',
      domain: ['reputation', 'customers', 'reputation.cozy'],
    })
    const view = reputationShiftCard.render(seed, createInitialTavernState())
    assertBodyBudgetOnly(view)
  })

  it('is deterministic per seed id', () => {
    assertDeterministic(reputationShiftCard, {
      id: 'reputation-shift-voice-A',
      family: 'reputation_shift',
      type: 'reputation_shift',
      timing: 'closing',
      domain: ['reputation', 'customers', 'reputation.cozy'],
    })
  })
})

describe('rumourCrisisCard voice', () => {
  it('honours the body budget and never clamps the title with "…"', () => {
    const state = createInitialTavernState()
    const supplierId = Object.keys(state.world.suppliers)[0]!
    const seed = makeSeed({
      family: 'rumour_crisis',
      type: 'rumour',
      timing: 'closing',
      domain: ['rumours', 'reputation', 'social', 'rumour.false', 'rumour.target.supplier'],
      primaryActor: { kind: 'supplier', id: supplierId },
    })
    const view = rumourCrisisCard.render(seed, state)
    assertBodyBudgetOnly(view)
  })

  it('is deterministic per seed id', () => {
    const state = createInitialTavernState()
    const supplierId = Object.keys(state.world.suppliers)[0]!
    const seed = makeSeed({
      id: 'rumour-crisis-voice-A',
      family: 'rumour_crisis',
      type: 'rumour',
      timing: 'closing',
      domain: ['rumours', 'reputation', 'social', 'rumour.false', 'rumour.target.supplier'],
      primaryActor: { kind: 'supplier', id: supplierId },
    })
    const a = rumourCrisisCard.render(seed, state)
    const b = rumourCrisisCard.render(seed, state)
    expect(a.title).toBe(b.title)
    expect(a.body).toEqual(b.body)
  })
})

describe('rivalTavernCard voice', () => {
  it('honours the body budget and never clamps the title with "…"', () => {
    const seed = makeSeed({
      family: 'rival_tavern',
      type: 'social_conflict',
      timing: 'closing',
      domain: ['rival', 'market', 'customers', 'rival.system'],
      primaryActor: { kind: 'system', id: 'rival_tavern' },
    })
    const view = rivalTavernCard.render(seed, createInitialTavernState())
    assertBodyBudgetOnly(view)
  })

  it('is deterministic per seed id', () => {
    assertDeterministic(rivalTavernCard, {
      id: 'rival-tavern-voice-A',
      family: 'rival_tavern',
      type: 'social_conflict',
      timing: 'closing',
      domain: ['rival', 'market', 'customers', 'rival.system'],
      primaryActor: { kind: 'system', id: 'rival_tavern' },
    })
  })
})

// Phase 140 / ISSUE-109 — Voiced Surface arc, Phase 14 (Periodic &
// Narrative Beats). Rewrites in place the legacy block that asserted
// `composeBody` glue + raw `${label} ${value}` pressure dumps landed in
// the rendered body. The compositional template is narrator-voiced —
// no actor with castAttributes resolves for a month ref — so variety
// comes from the snippet pools' state-perturbation gating, not from
// the retired voice composer.
describe('monthlyReviewCard voice', () => {
  it('honours the body budget and never clamps the title with "…"', () => {
    const seed = makeSeed({
      family: 'monthly_review',
      type: 'monthly_review',
      timing: 'end_month',
    })
    const view = monthlyReviewCard.render(seed, createInitialTavernState())
    assertBodyBudgetOnly(view)
  })

  it('is deterministic per seed id', () => {
    assertDeterministic(monthlyReviewCard, {
      id: 'monthly-review-voice-A',
      family: 'monthly_review',
      type: 'monthly_review',
      timing: 'end_month',
    })
  })

  it('emits no raw "label value (trend)" mechanical pressure readouts in body', () => {
    const seed = makeSeed({
      id: 'monthly-review-voice-B',
      family: 'monthly_review',
      type: 'monthly_review',
      timing: 'end_month',
    })
    const view = monthlyReviewCard.render(seed, createInitialTavernState())
    for (const line of view.body) {
      expect(line).not.toMatch(/debt \d+/i)
      expect(line).not.toMatch(/landlord \d+/i)
      expect(line).not.toMatch(/\(\+\d+\)/)
      expect(line).not.toMatch(/\(-\d+\)/)
    }
  })
})

describe('seasonalArcCard voice', () => {
  it('honours the body budget and never clamps the title with "…"', () => {
    const seed = makeSeed({
      family: 'seasonal_arc',
      type: 'festival_preparation',
      timing: 'morning_prep',
      domain: ['arcs', 'calendar'],
      toneHints: ['arc', 'calendar', 'festival_approaching'],
    })
    const view = seasonalArcCard.render(seed, createInitialTavernState())
    assertBodyBudgetOnly(view)
  })

  it('is deterministic per seed id', () => {
    assertDeterministic(seasonalArcCard, {
      id: 'seasonal-arc-voice-A',
      family: 'seasonal_arc',
      type: 'festival_preparation',
      timing: 'morning_prep',
      domain: ['arcs', 'calendar'],
      toneHints: ['arc', 'calendar', 'festival_approaching'],
    })
  })

  it('emits no legacy adjective-glue prefix and no fragment-dump body', () => {
    const seed = makeSeed({
      id: 'seasonal-arc-voice-B',
      family: 'seasonal_arc',
      type: 'arc_milestone',
      timing: 'morning_prep',
      domain: ['arcs', 'calendar'],
      toneHints: ['arc', 'calendar', 'mushroom_blight'],
      textIngredients: {
        subject: 'the blight',
        sensoryDetails: ['flags rising', 'crowds gathering'],
      },
    })
    const view = seasonalArcCard.render(seed, createInitialTavernState())
    // The theme label anchors the title; the raw textIngredients fragments
    // ("flags rising") must not appear in any body line.
    expect(view.title.startsWith('Mushroom blight:')).toBe(true)
    expect(view.title).not.toContain('…')
    for (const line of view.body) {
      expect(line).not.toBe('flags rising')
      expect(line).not.toBe('crowds gathering')
    }
  })
})

describe('fallbackCard voice', () => {
  it('honours the budget', () => {
    const seed = makeSeed({})
    const view = fallbackCard.render(seed, createInitialTavernState())
    assertBudget(view)
  })

  it('is deterministic per seed id', () => {
    assertDeterministic(fallbackCard, {})
  })
})
