// Phase 118 / ISSUE-079 — Empty-state copy assertions for the
// tavern, world, and recipes panels. Each test mounts the panel
// directly with a hand-crafted data fixture (the panels are pure
// presentational components with a `data` prop), so we don't need
// the full gameStore wiring.
//
// What we're guaranteeing: when a roster or section is empty, the
// player sees a short, actionable line — not nothing, not a thin
// "no items" tag.

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/svelte'

import StaffPanel from '../../../web/src/lib/components/tavern/StaffPanel.svelte'
import StockPanel from '../../../web/src/lib/components/tavern/StockPanel.svelte'
import RecipesPanel from '../../../web/src/lib/components/tavern/RecipesPanel.svelte'
import SuppliersPanel from '../../../web/src/lib/components/world/SuppliersPanel.svelte'

import type {
  StaffPanelData,
  StockPanelData,
  RecipePanelData,
} from '../../../src/reports/tavernOverviewProjection'
import type { SuppliersPanelData } from '../../../src/reports/worldOverviewProjection'

afterEach(() => cleanup())

describe('Phase 118 — empty-state copywriting', () => {
  it('StaffPanel: shows hire-from-world hint when no staff', () => {
    const data: StaffPanelData = { rows: [], unpaidCount: 0 }
    render(StaffPanel, { props: { data } })
    expect(
      screen.getByText(/You have no staff\. Hire from the World → Hireable list\./i),
    ).toBeTruthy()
  })

  it('SuppliersPanel: shows reputation-builds-roster hint when empty', () => {
    const data: SuppliersPanelData = { count: 0, rows: [] }
    render(SuppliersPanel, { props: { data } })
    expect(
      screen.getByText(/You haven't met any suppliers yet\./i),
    ).toBeTruthy()
    expect(
      screen.getByText(/They arrive as your reputation grows\./i),
    ).toBeTruthy()
  })

  it('RecipesPanel: extends on-menu empty copy with starter suggestions', () => {
    const data: RecipePanelData = { onMenu: [], available: [] }
    render(RecipesPanel, { props: { data } })
    expect(
      screen.getByText(/No recipes on the menu/i),
    ).toBeTruthy()
    expect(
      screen.getByText(/Stew, Ale, and Mushrooms are good starters\./i),
    ).toBeTruthy()
  })

  it('StockPanel: shows "no shortages" line when inventory is healthy', () => {
    const data: StockPanelData = {
      inventory: {
        rows: [
          {
            id: 'ale',
            label: 'Ale',
            quantity: 50,
            quality: 80,
            spoilage: 0,
            freshness: 100,
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
      supplyPipeline: {
        activeExpeditions: [],
        hireableAdventurers: [],
        recentCompletions: [],
        canCommission: { eligible: false, reason: 'no adventurers available' },
      },
    }
    render(StockPanel, { props: { data } })
    expect(
      screen.getByText(/No shortages — supply is keeping up with demand\./i),
    ).toBeTruthy()
  })

  it('StockPanel: suppresses the "no shortages" line when something is low', () => {
    const data: StockPanelData = {
      inventory: {
        rows: [
          {
            id: 'ale',
            label: 'Ale',
            quantity: 2,
            quality: 80,
            spoilage: 0,
            freshness: 100,
            rarity: 'common',
            basePrice: 5,
            salePrice: 5,
            tags: [],
            isLow: true,
            isSpoiling: false,
            isUpkeepConsumed: false,
            applicableActions: [],
          },
        ],
        lowStockCount: 1,
        spoilingCount: 0,
      },
      supplyPipeline: {
        activeExpeditions: [],
        hireableAdventurers: [],
        recentCompletions: [],
        canCommission: { eligible: false, reason: 'no adventurers available' },
      },
    }
    render(StockPanel, { props: { data } })
    expect(screen.queryByText(/No shortages/i)).toBeNull()
    expect(screen.getByText(/1 low/i)).toBeTruthy()
  })
})
