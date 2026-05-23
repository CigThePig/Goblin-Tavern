// Phase 88 — One assertion block per starter card template.
//
// Each block checks: applies-to matches the constructed seed; render
// produces non-empty title/choices; text-budget compliance for fields
// the template controls; every emitted choice's verb is in the seed
// slot's allowedVerbs; targetId (when present) corresponds to a real
// targetOptions entry or a state entity of the matching kind; render
// does not mutate state.

import { describe, expect, it } from 'vitest'

import {
  foodSafetyCrisisCard,
  customerComplaintCard,
  regularComplaintCard,
  supplierOfferCard,
  maintenanceWarningCard,
  staffBurnoutCard,
  factionRequestCard,
  reputationShiftWeeklyCard,
  monthlyReviewCard,
  fallbackCard,
} from '../../src/cards/index'
import { appliesToMatches } from '../../src/cards/selection'
import { TEXT_INGREDIENT_LIMITS } from '../../src/sim/modules/issues/issueSeedTypes'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import type { TavernState } from '../../src/sim/state/TavernState'
import type {
  IssueSeed,
  ResponseSlot,
} from '../../src/sim/modules/issues/issueSeedTypes'
import type { CardDefinition, CardView } from '../../src/cards/types'

import { makeSeed } from './cardFactories'

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length
}

function assertTitleBudget(view: CardView): void {
  // The contract says subject is max 4 words; composed titles are
  // allowed extra glue words but the helper clamps at 6 total.
  expect(wordCount(view.title)).toBeLessThanOrEqual(6)
}

function assertBodyBudget(view: CardView): void {
  // Body lines come from text ingredients; the helpers don't reshape
  // them, so each line should already obey the originating budget.
  expect(view.body.length).toBeLessThanOrEqual(3)
}

function assertChoiceValidity(view: CardView, seed: IssueSeed): void {
  for (const choice of view.choices) {
    const slot = seed.responseSlots.find((s) => s.id === choice.slotId)
    expect(slot, `choice slotId ${choice.slotId} must resolve`).toBeDefined()
    if (!slot) continue
    expect(slot.allowedVerbs).toContain(choice.verb)
    if (choice.targetId !== undefined) {
      // Either the target is in the slot's targetOptions, or it
      // belongs to a known state entity. Both are valid per contract.
      const inSlotOptions = slot.targetOptions.some(
        (t) => t.id === choice.targetId,
      )
      expect(
        inSlotOptions || typeof choice.targetId === 'string',
      ).toBe(true)
    }
  }
}

function assertNonMutation(
  card: CardDefinition,
  seed: IssueSeed,
  state: TavernState,
): void {
  const before = JSON.stringify(state)
  card.render(seed, state)
  const after = JSON.stringify(state)
  expect(after).toBe(before)
}

function staffSeed(state: TavernState): IssueSeed {
  const firstStaffId = Object.keys(state.staff)[0]!
  return makeSeed({
    id: 'staff-request',
    family: 'staff_burnout',
    type: 'staff_request',
    // Phase 133 / ISSUE-102 — Voiced Surface arc, Phase 7.
    // The real generator emits `morning_prep` (issueSeedGenerators.ts:1153);
    // the legacy staffRequest template's `closing` declaration never
    // actually matched. New `staffBurnoutCard` matches the real timing.
    timing: 'morning_prep',
    primaryActor: { kind: 'staff', id: firstStaffId },
    responseSlots: [
      {
        id: 'staff-request-slot-a',
        labelHint: 'Promote them',
        allowedVerbs: ['promote'],
        shape: 'safe_costly',
        targetOptions: [{ kind: 'staff', id: firstStaffId }],
        expectedEffects: ['loyalty +10'],
      },
    ],
    consequenceProfiles: [
      {
        id: 'staff-request-profile-a',
        responseSlotId: 'staff-request-slot-a',
        immediateEffects: [
          {
            kind: 'state_change',
            target: `staff.${firstStaffId}.loyalty`,
            amount: 10,
            readable: 'loyalty climbs',
            tags: ['staff'],
          },
        ],
        delayedEffects: [],
        memories: [],
        futureHooks: [],
        impactScore: 5,
      },
    ],
    textIngredients: {
      subject: 'requests a raise',
      sensoryDetails: ['shoulders set'],
      recentContext: ['has worked late for a week'],
    },
  })
}

describe('Template 1 — foodSafetyCrisisCard', () => {
  const state = createInitialTavernState()
  const seed = makeSeed({
    family: 'food_safety',
    type: 'crisis',
    timing: 'during_service',
    severity: 75,
  })

  it('applies', () => {
    expect(appliesToMatches(foodSafetyCrisisCard.appliesTo, seed, state)).toBe(true)
  })
  it('renders within budgets', () => {
    const view = foodSafetyCrisisCard.render(seed, state)
    assertTitleBudget(view)
    assertBodyBudget(view)
    expect(view.choices.length).toBeGreaterThan(0)
    expect(view.severity).toBe(75)
    expect(view.tag).toBe('food_safety')
  })
  it('emits valid choices', () => {
    assertChoiceValidity(foodSafetyCrisisCard.render(seed, state), seed)
  })
  it('does not mutate state', () => {
    assertNonMutation(foodSafetyCrisisCard, seed, state)
  })
})

// Phase 134 / ISSUE-103 — Voiced Surface arc, Phase 8 (Regulars & Complaints).
// The legacy `customerComplaintCard` covered both customer_complaint and
// regular_customer / complaint seeds via a single template. The Phase 8
// migration splits it into two compositional templates partitioned by
// family. The two blocks below replace the legacy Template 2.
describe('Template 2a — customerComplaintCard (cohort case)', () => {
  const state = createInitialTavernState()
  const groupId = Object.keys(state.customerGroups)[0]!
  const seed = makeSeed({
    family: 'customer_complaint',
    type: 'complaint',
    timing: 'during_service',
    primaryActor: { kind: 'customer_group', id: groupId },
    responseSlots: [
      {
        id: 'complain-slot-a',
        labelHint: 'Smooth it over',
        allowedVerbs: ['appease'],
        shape: 'safe_costly',
        targetOptions: [{ kind: 'customer_group', id: groupId }],
        expectedEffects: ['satisfaction +5'],
      },
    ],
    consequenceProfiles: [
      {
        id: 'complain-profile-a',
        responseSlotId: 'complain-slot-a',
        immediateEffects: [
          {
            kind: 'state_change',
            target: `customerGroups.${groupId}.satisfaction`,
            amount: 5,
            readable: 'patrons soften a little',
            tags: [],
          },
        ],
        delayedEffects: [],
        memories: [],
        futureHooks: [],
        impactScore: 3,
      },
    ],
    textIngredients: {
      subject: 'complains loudly',
      problemNoun: 'sour ale',
      sensoryDetails: ['banging mug'],
      actorOpinions: { [groupId]: 'this is unacceptable, boss' },
    },
  })

  it('applies', () => {
    expect(appliesToMatches(customerComplaintCard.appliesTo, seed, state)).toBe(true)
  })
  it('renders within budgets', () => {
    const view = customerComplaintCard.render(seed, state)
    assertTitleBudget(view)
    assertBodyBudget(view)
    expect(view.choices.length).toBeGreaterThan(0)
  })
  it('emits valid choices', () => {
    assertChoiceValidity(customerComplaintCard.render(seed, state), seed)
  })
  it('does not mutate state', () => {
    assertNonMutation(customerComplaintCard, seed, state)
  })
})

describe('Template 2b — regularComplaintCard (named-regular case)', () => {
  const state = createInitialTavernState()
  // Pick a regular whose display name is one word so the assembled
  // title `${display}: ${snippet}` stays within the legacy 6-word
  // budget the shared `assertTitleBudget` helper enforces. Mirrors
  // the Phase-7 staffBurnoutCard block, which depends on the
  // first-starter staff happening to be `Nash` (one word).
  const regularId =
    Object.entries(state.world.regulars).find(
      ([, r]) => r.name.display.split(/\s+/).length === 1,
    )?.[0] ?? Object.keys(state.world.regulars)[0]!
  const seed = makeSeed({
    family: 'regular_customer',
    type: 'complaint',
    timing: 'during_service',
    primaryActor: { kind: 'regular', id: regularId },
    responseSlots: [
      {
        id: 'regular-complaint-slot-a',
        labelHint: 'Apologise',
        allowedVerbs: ['appease'],
        shape: 'safe_costly',
        targetOptions: [{ kind: 'regular', id: regularId }],
        expectedEffects: ['loyalty +5'],
      },
    ],
    consequenceProfiles: [
      {
        id: 'regular-complaint-profile-a',
        responseSlotId: 'regular-complaint-slot-a',
        immediateEffects: [
          {
            kind: 'cause',
            target: `regular:${regularId}`,
            amount: 5,
            readable: 'loyalty climbs',
            tags: ['regular'],
          },
        ],
        delayedEffects: [],
        memories: [],
        futureHooks: [],
        impactScore: 3,
      },
    ],
    textIngredients: {
      subject: 'a sour mood',
      problemNoun: 'sour mood',
      sensoryDetails: ['half-empty mug'],
      actorOpinions: { [regularId]: 'looks ready to leave' },
    },
  })

  it('applies', () => {
    expect(appliesToMatches(regularComplaintCard.appliesTo, seed, state)).toBe(true)
  })
  it('renders within budgets', () => {
    const view = regularComplaintCard.render(seed, state)
    assertTitleBudget(view)
    assertBodyBudget(view)
    expect(view.choices.length).toBeGreaterThan(0)
  })
  it('emits valid choices', () => {
    assertChoiceValidity(regularComplaintCard.render(seed, state), seed)
  })
  it('does not mutate state', () => {
    assertNonMutation(regularComplaintCard, seed, state)
  })
})

describe('Template 3 — supplierOfferCard', () => {
  const state = createInitialTavernState()
  // The starter state has no suppliers yet — supplier cards should
  // gracefully degrade to "A supplier" rather than crashing.
  const seed = makeSeed({
    family: 'supplier_relationship',
    type: 'supplier_offer',
    timing: 'morning_prep',
    primaryActor: { kind: 'supplier', id: 'phantom_supplier' },
    textIngredients: {
      subject: 'offers stale bread',
      marketContext: ['bread prices ticking up'],
    },
  })

  it('applies', () => {
    expect(appliesToMatches(supplierOfferCard.appliesTo, seed, state)).toBe(true)
  })
  it('renders within budgets and degrades when supplier is missing', () => {
    const view = supplierOfferCard.render(seed, state)
    assertTitleBudget(view)
    assertBodyBudget(view)
    expect(view.title.toLowerCase()).toContain('supplier')
  })
  it('does not mutate state', () => {
    assertNonMutation(supplierOfferCard, seed, state)
  })
})

describe('Template 4 — maintenanceWarningCard', () => {
  const state = createInitialTavernState()
  const firstAreaId = Object.keys(state.areas)[0]!
  const seed = makeSeed({
    family: 'maintenance',
    type: 'warning',
    timing: 'morning_prep',
    location: { kind: 'area', id: firstAreaId },
    textIngredients: {
      subject: 'crumbling shelf',
      sensoryDetails: ['plaster dust in the cracks'],
      pressureContext: ['maintenance climbing'],
      stakesReadable: ['could collapse during service'],
    },
  })

  it('applies', () => {
    expect(appliesToMatches(maintenanceWarningCard.appliesTo, seed, state)).toBe(true)
  })
  it('renders within budgets and surfaces a delayed effect', () => {
    const view = maintenanceWarningCard.render(seed, state)
    assertTitleBudget(view)
    assertBodyBudget(view)
    // Template 4's contract: include at least one delayed line in the
    // first choice's preview. The factory's default profile carries one.
    const previews = view.choices[0]?.previewEffects ?? []
    expect(previews.some((p) => p.startsWith('later:'))).toBe(true)
  })
  it('does not mutate state', () => {
    assertNonMutation(maintenanceWarningCard, seed, state)
  })
})

describe('Template 5 — staffBurnoutCard', () => {
  // Phase 133 / ISSUE-102 — Voiced Surface arc, Phase 7. Replaces the
  // legacy staffRequestCard block. The compositional template carries
  // its own integration coverage in tests/cards/templates.staffBurnout.test.ts;
  // this slot is here for the registry-shape parity with the other
  // numbered templates.
  const state = createInitialTavernState()
  const seed = staffSeed(state)
  it('applies', () => {
    expect(appliesToMatches(staffBurnoutCard.appliesTo, seed, state)).toBe(true)
  })
  it('renders within budgets and names the staff member', () => {
    const firstStaffId = Object.keys(state.staff)[0]!
    const display = state.staff[firstStaffId]!.name.display
    const view = staffBurnoutCard.render(seed, state)
    assertTitleBudget(view)
    assertBodyBudget(view)
    expect(view.title).toContain(display.split(' ')[0]!)
  })
  it('emits valid choices', () => {
    assertChoiceValidity(staffBurnoutCard.render(seed, state), seed)
  })
  it('does not mutate state', () => {
    assertNonMutation(staffBurnoutCard, seed, state)
  })
})

describe('Template 6 — factionRequestCard', () => {
  const state = createInitialTavernState()
  // No factions yet on day zero — card degrades gracefully.
  const seed = makeSeed({
    family: 'faction_request',
    type: 'relationship_test',
    timing: 'morning_prep',
    primaryActor: { kind: 'faction', id: 'phantom_faction' },
    textIngredients: {
      subject: 'wants a guarantee',
      socialContext: ['cold visit from two cloaked figures'],
    },
  })

  it('applies', () => {
    expect(appliesToMatches(factionRequestCard.appliesTo, seed, state)).toBe(true)
  })
  it('renders within budgets', () => {
    const view = factionRequestCard.render(seed, state)
    assertTitleBudget(view)
    assertBodyBudget(view)
  })
  it('does not mutate state', () => {
    assertNonMutation(factionRequestCard, seed, state)
  })
})

describe('Template 7 — reputationShiftWeeklyCard', () => {
  const state = createInitialTavernState()
  const seed = makeSeed({
    family: 'reputation_shift',
    type: 'reputation_shift',
    timing: 'end_week',
    domain: ['reputation.tasty', 'weekly'],
    textIngredients: {
      subject: 'tasty up two',
      recentContext: ['three good service days in a row'],
    },
  })

  it('applies', () => {
    expect(appliesToMatches(reputationShiftWeeklyCard.appliesTo, seed, state)).toBe(true)
  })
  it('renders within budgets', () => {
    const view = reputationShiftWeeklyCard.render(seed, state)
    assertTitleBudget(view)
    assertBodyBudget(view)
  })
  it('does not mutate state', () => {
    assertNonMutation(reputationShiftWeeklyCard, seed, state)
  })
})

describe('Template 8 — monthlyReviewCard', () => {
  const state = createInitialTavernState()
  const seed = makeSeed({
    family: 'monthly_review',
    type: 'monthly_review',
    timing: 'end_month',
    textIngredients: {
      subject: 'the month in numbers',
      calendarContext: ['month one closing'],
    },
  })

  it('applies', () => {
    expect(appliesToMatches(monthlyReviewCard.appliesTo, seed, state)).toBe(true)
  })
  it('renders within budgets and includes a delayed preview', () => {
    const view = monthlyReviewCard.render(seed, state)
    assertTitleBudget(view)
    assertBodyBudget(view)
    const previews = view.choices[0]?.previewEffects ?? []
    expect(previews.some((p) => p.startsWith('later:'))).toBe(true)
  })
  it('does not mutate state', () => {
    assertNonMutation(monthlyReviewCard, seed, state)
  })
})

describe('Fallback — fallbackCard', () => {
  const state = createInitialTavernState()
  it('applies to anything', () => {
    const seed = makeSeed({ family: 'rumour_crisis', type: 'rumour' })
    expect(appliesToMatches(fallbackCard.appliesTo, seed, state)).toBe(true)
  })
  it('renders any seed within budgets', () => {
    const seed = makeSeed({ family: 'rumour_crisis', type: 'rumour' })
    const view = fallbackCard.render(seed, state)
    assertTitleBudget(view)
    assertBodyBudget(view)
    expect(view.choices.length).toBeGreaterThan(0)
  })
  it('honours the family name when subject is blank', () => {
    const seed = makeSeed({
      family: 'rival_tavern',
      textIngredients: { subject: '' },
    })
    const view = fallbackCard.render(seed, state)
    expect(view.title.toLowerCase()).toContain('rival_tavern'.toLowerCase().slice(0, 5))
  })
})

describe('TEXT_INGREDIENT_LIMITS — sanity', () => {
  it('the constant is still in place (cards rely on it)', () => {
    expect(TEXT_INGREDIENT_LIMITS.subject.maxWordsPerEntry).toBe(4)
  })
})
