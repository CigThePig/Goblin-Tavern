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
  maintenanceWarningCard,
  staffBurnoutCard,
  factionRequestCard,
  cultureConflictCard,
  reputationShiftWeeklyCard,
  monthlyReviewCard,
  fallbackCard,
} from '../../src/cards/index'
import { TONE_POOLS } from '../../src/cards/voice/index'
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
  it('honours the budget', () => {
    const seed = makeSeed({
      family: 'food_safety',
      type: 'crisis',
      timing: 'during_service',
      severity: 80,
    })
    const view = foodSafetyCrisisCard.render(seed, createInitialTavernState())
    assertBudget(view)
  })

  it('is deterministic per seed id', () => {
    assertDeterministic(foodSafetyCrisisCard, {
      family: 'food_safety',
      type: 'crisis',
      timing: 'during_service',
      severity: 80,
    })
  })

  it('lands an urgent or visceral fragment somewhere in the view', () => {
    const seed = makeSeed({
      id: 'food-safety-voice-1',
      family: 'food_safety',
      type: 'crisis',
      timing: 'during_service',
      severity: 80,
    })
    const view = foodSafetyCrisisCard.render(seed, createInitialTavernState())
    const text = [view.title, ...view.body].join(' ').toLowerCase()
    const urgent = TONE_POOLS['urgent']!
    const visceral = TONE_POOLS['visceral']!
    const fragments = [
      ...urgent.prefixAdjectives,
      ...urgent.bodyConnectors,
      ...visceral.prefixAdjectives,
      ...visceral.bodyConnectors,
    ].map((s) => s.toLowerCase())
    const found = fragments.some((f) => text.includes(f))
    expect(found).toBe(true)
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

describe('maintenanceWarningCard voice', () => {
  it('honours the budget', () => {
    const seed = makeSeed({
      family: 'maintenance',
      type: 'warning',
      timing: 'morning_prep',
      location: { kind: 'area', id: 'main_room' },
    })
    const view = maintenanceWarningCard.render(seed, createInitialTavernState())
    assertBudget(view)
  })

  it('is deterministic per seed id', () => {
    assertDeterministic(maintenanceWarningCard, {
      family: 'maintenance',
      type: 'warning',
      timing: 'morning_prep',
      location: { kind: 'area', id: 'main_room' },
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
    const seed = makeSeed({
      family: 'culture_conflict',
      type: 'social_conflict',
      timing: 'during_service',
      ...(cultureId ? { primaryActor: { kind: 'culture', id: cultureId } } : {}),
    })
    const view = cultureConflictCard.render(seed, state)
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

describe('reputationShiftWeeklyCard voice', () => {
  it('honours the budget', () => {
    const seed = makeSeed({
      family: 'reputation_shift',
      type: 'reputation_shift',
      timing: 'end_week',
    })
    const view = reputationShiftWeeklyCard.render(seed, createInitialTavernState())
    assertBudget(view)
  })

  it('is deterministic per seed id', () => {
    assertDeterministic(reputationShiftWeeklyCard, {
      family: 'reputation_shift',
      type: 'reputation_shift',
      timing: 'end_week',
    })
  })
})

describe('monthlyReviewCard voice', () => {
  it('honours the budget', () => {
    const seed = makeSeed({
      family: 'monthly_review',
      type: 'monthly_review',
      timing: 'end_month',
    })
    const view = monthlyReviewCard.render(seed, createInitialTavernState())
    assertBudget(view)
  })

  it('is deterministic per seed id', () => {
    assertDeterministic(monthlyReviewCard, {
      family: 'monthly_review',
      type: 'monthly_review',
      timing: 'end_month',
    })
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
