// Phase 95 — Templates under the voice composer.
//
// Per-template tests: word-budget compliance, deterministic re-render,
// and tone landing. These are additive — `tests/cards/templates.test.ts`
// continues to pin the legacy behaviour (apply-to / choice / non-mutation).

import { describe, expect, it } from 'vitest'

import {
  foodSafetyCrisisCard,
  customerComplaintCard,
  supplierOfferCard,
  maintenanceWarningCard,
  staffRequestCard,
  factionRequestCard,
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

describe('customerComplaintCard voice', () => {
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

describe('supplierOfferCard voice', () => {
  it('honours the budget', () => {
    const seed = makeSeed({
      family: 'supplier_relationship',
      type: 'supplier_offer',
      timing: 'morning_prep',
    })
    const view = supplierOfferCard.render(seed, createInitialTavernState())
    assertBudget(view)
  })

  it('is deterministic per seed id', () => {
    assertDeterministic(supplierOfferCard, {
      family: 'supplier_relationship',
      type: 'supplier_offer',
      timing: 'morning_prep',
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

describe('staffRequestCard voice', () => {
  it('honours the budget', () => {
    const state = createInitialTavernState()
    const staffId = Object.keys(state.staff)[0]!
    const seed = makeSeed({
      family: 'staff_burnout',
      type: 'staff_request',
      timing: 'closing',
      primaryActor: { kind: 'staff', id: staffId },
    })
    const view = staffRequestCard.render(seed, state)
    assertBudget(view)
  })

  it('is deterministic per seed id', () => {
    const state = createInitialTavernState()
    const staffId = Object.keys(state.staff)[0]!
    const seed = makeSeed({
      id: 'staff-voice-A',
      family: 'staff_burnout',
      type: 'staff_request',
      timing: 'closing',
      primaryActor: { kind: 'staff', id: staffId },
    })
    const a = staffRequestCard.render(seed, state)
    const b = staffRequestCard.render(seed, state)
    expect(a.title).toBe(b.title)
    expect(a.body).toEqual(b.body)
  })
})

describe('factionRequestCard voice', () => {
  it('honours the budget', () => {
    const state = createInitialTavernState()
    const factionId = Object.keys(state.world.factions)[0]
    const seed = makeSeed({
      family: 'faction_request',
      type: 'relationship_test',
      timing: 'morning_prep',
      ...(factionId ? { primaryActor: { kind: 'faction', id: factionId } } : {}),
    })
    const view = factionRequestCard.render(seed, state)
    assertBudget(view)
  })

  it('is deterministic per seed id', () => {
    assertDeterministic(factionRequestCard, {
      family: 'faction_request',
      type: 'relationship_test',
      timing: 'morning_prep',
    })
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
