// Phase 118.4 / ISSUE-079 — Information-density tuning checks.
//
// The clarity pass made each row legible; this phase makes each row
// scannable. The contract these tests enforce:
//
//   - StaffPanel rows show ONE meter (morale). Stress + fatigue moved
//     to StaffDetailSheet.
//   - StockPanel rows show NO meters inline. Quality + freshness +
//     spoilage moved to StockDetailSheet.
//   - AreasPanel rows show ONE meter (worst-of-four) and a problem
//     COUNT badge — not a list of problem ids.
//   - RecipesPanel rows collapse `prep N` and `served N times` into a
//     single dim meta line.
//
// These are template-shape contracts, not pixel layouts. We check
// presence/absence of specific label text via Testing Library.

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/svelte'

import StaffPanel from '../../../web/src/lib/components/tavern/StaffPanel.svelte'
import StockPanel from '../../../web/src/lib/components/tavern/StockPanel.svelte'
import AreasPanel from '../../../web/src/lib/components/tavern/AreasPanel.svelte'
import RecipesPanel from '../../../web/src/lib/components/tavern/RecipesPanel.svelte'

import type {
  AreaPanelData,
  RecipePanelData,
  StaffPanelData,
  StockPanelData,
} from '../../../src/reports/tavernOverviewProjection'

afterEach(() => cleanup())

const baseSupplyPipeline = {
  activeExpeditions: [],
  hireableAdventurers: [],
  recentCompletions: [],
  canCommission: { eligible: false, reason: 'no adventurers' as const },
}

describe('Phase 118.4 — information-density tuning', () => {
  it('StaffPanel row shows only the morale meter (stress/fatigue moved to detail sheet)', () => {
    const data: StaffPanelData = {
      rows: [
        {
          id: 's1',
          name: 'Garlic',
          role: 'cook',
          roleLabel: 'Cook',
          skill: 60,
          morale: 70,
          stress: 30,
          fatigue: 40,
          loyalty: 50,
          wage: 12,
          paidThisWeek: true,
          allowedPriorities: [],
          personalityTags: [],
          unavailable: false,
          activeFlags: [],
          applicableActions: [],
        },
      ],
      unpaidCount: 0,
    }
    render(StaffPanel, { props: { data } })
    expect(screen.getByText(/morale/i)).toBeTruthy()
    // Stress / fatigue meters should be gone from the panel row.
    // (They remain in the detail sheet, which doesn't render here
    // because we haven't tapped the row.)
    expect(screen.queryByText(/^stress$/i)).toBeNull()
    expect(screen.queryByText(/^fatigue$/i)).toBeNull()
  })

  it('StockPanel row shows no quality/freshness meters inline', () => {
    const data: StockPanelData = {
      inventory: {
        rows: [
          {
            id: 'ale',
            label: 'Ale',
            quantity: 50,
            quality: 80,
            spoilage: 0,
            freshness: 90,
            rarity: 'common',
            basePrice: 5,
            salePrice: 5,
            tags: [],
            isLow: false,
            isSpoiling: false,
            isUpkeepConsumed: false,
            applicableActions: [],
          },
        ],
        lowStockCount: 0,
        spoilingCount: 0,
      },
      supplyPipeline: baseSupplyPipeline,
    }
    render(StockPanel, { props: { data } })
    // The row should not render quality/freshness meter labels.
    expect(screen.queryByText(/^quality$/i)).toBeNull()
    expect(screen.queryByText(/^freshness$/i)).toBeNull()
    // But the row itself still appears.
    expect(screen.getByText(/^Ale$/)).toBeTruthy()
    expect(screen.getByText(/×50/)).toBeTruthy()
  })

  it('AreasPanel row shows a problem-count badge instead of listing problem ids', () => {
    const data: AreaPanelData = {
      rows: [
        {
          id: 'main_room',
          label: 'Main Room',
          condition: 60,
          cleanliness: 40, // dirty = 60 — worst meter
          mess: 30,
          damage: 20,
          smell: 10,
          risk: 5,
          worstMeterKey: 'cleanliness',
          worstMeterValue: 60,
          conditionAdjectiveKey: 'dirty',
          conditionAdjective: 'grimy',
          traits: [],
          atmosphere: [],
          upgrades: [],
          activeProblems: ['food_safety_breach', 'pest_sighting'],
          recentMemoryCount: 0,
          applicableActions: [],
        },
      ],
    }
    render(AreasPanel, { props: { data } })
    // The badge should show the count, not the individual problem ids.
    expect(screen.getByText(/⚠ 2/)).toBeTruthy()
    expect(screen.queryByText(/food safety breach/i)).toBeNull()
    expect(screen.queryByText(/pest sighting/i)).toBeNull()
    // Worst meter (dirty=60) should be the only meter rendered.
    expect(screen.getByText(/^dirty$/i)).toBeTruthy()
    expect(screen.queryByText(/^damage$/i)).toBeNull()
    expect(screen.queryByText(/^smell$/i)).toBeNull()
    expect(screen.queryByText(/^risk$/i)).toBeNull()
  })

  it('AreasPanel row hides the problem-count badge when there are no active problems', () => {
    const data: AreaPanelData = {
      rows: [
        {
          id: 'main_room',
          label: 'Main Room',
          condition: 90,
          cleanliness: 90,
          mess: 5,
          damage: 5,
          smell: 5,
          risk: 5,
          worstMeterKey: 'cleanliness',
          worstMeterValue: 10,
          conditionAdjectiveKey: 'clean',
          conditionAdjective: 'inviting',
          traits: [],
          atmosphere: [],
          upgrades: [],
          activeProblems: [],
          recentMemoryCount: 0,
          applicableActions: [],
        },
      ],
    }
    render(AreasPanel, { props: { data } })
    expect(screen.queryByText(/⚠/)).toBeNull()
  })

  it('RecipesPanel row combines prep + served into one meta line', () => {
    const data: RecipePanelData = {
      onMenu: [
        {
          id: 'stew',
          label: 'Stew',
          onMenu: true,
          tags: [],
          inputs: [
            { ingredientId: 'meat', ingredientLabel: 'Meat', quantity: 1, available: 5 },
          ],
          prepDifficulty: 2,
          demandTier: 'common',
          culturalTags: [],
          timesServed: 5,
          daysSinceLastServed: 1,
          blocked: false,
          applicableActions: [],
        },
      ],
      available: [],
    }
    render(RecipesPanel, { props: { data } })
    expect(screen.getByText(/prep 2 · served 5 times/i)).toBeTruthy()
  })

  it('RecipesPanel row omits the served portion when timesServed is zero', () => {
    const data: RecipePanelData = {
      onMenu: [
        {
          id: 'stew',
          label: 'Stew',
          onMenu: true,
          tags: [],
          inputs: [
            { ingredientId: 'meat', ingredientLabel: 'Meat', quantity: 1, available: 5 },
          ],
          prepDifficulty: 2,
          demandTier: 'common',
          culturalTags: [],
          timesServed: 0,
          daysSinceLastServed: 0,
          blocked: false,
          applicableActions: [],
        },
      ],
      available: [],
    }
    render(RecipesPanel, { props: { data } })
    expect(screen.getByText(/prep 2/i)).toBeTruthy()
    expect(screen.queryByText(/served/i)).toBeNull()
  })
})
