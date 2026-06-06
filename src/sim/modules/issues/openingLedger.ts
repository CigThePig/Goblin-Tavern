import type { TavernState } from '../../state/TavernState'

export type OpeningLedgerEntry = {
  id: string
  system: 'staff' | 'stock' | 'areas' | 'suppliers' | 'factions' | 'cultures'
  severity: 'info' | 'watch' | 'risk'
  readable: string
  tags: string[]
}

// Phase 188 — pure selector for inherited opening conditions. This is not a
// card surface and intentionally uses neutral wording: it explains the tavern
// the player inherited without assigning blame.
export function selectOpeningLedgerEntries(state: TavernState): OpeningLedgerEntry[] {
  const entries: OpeningLedgerEntry[] = []

  const staff = Object.values(state.staff)
  if (staff.length > 0) {
    const avgLoyalty = Math.round(
      staff.reduce((sum, member) => sum + member.loyalty, 0) / staff.length,
    )
    if (avgLoyalty <= 55) {
      entries.push({
        id: 'staff_unproven_trust',
        system: 'staff',
        severity: 'watch',
        readable: `Staff trust is unproven (average loyalty ${avgLoyalty}).`,
        tags: ['staff', 'inherited', 'loyalty'],
      })
    }
  }

  const ale = state.stock.ale
  if (ale && ale.quantity <= 90) {
    entries.push({
      id: 'ale_thin_runway',
      system: 'stock',
      severity: 'watch',
      readable: `Ale stock is thin for expected demand (${Math.round(ale.quantity)} on hand).`,
      tags: ['stock', 'ale', 'inherited'],
    })
  }

  const cellar = state.areas.cellar
  if (cellar && (cellar.cleanliness <= 35 || cellar.traits.includes('pest_prone'))) {
    entries.push({
      id: 'cellar_dirty_pest_prone',
      system: 'areas',
      severity: 'risk',
      readable: 'The cellar starts dirty and pest-prone.',
      tags: ['area', 'cellar', 'pests', 'inherited'],
    })
  }

  const privy = state.areas.privy
  if (privy && privy.smell >= 65) {
    entries.push({
      id: 'privy_future_inspection_risk',
      system: 'areas',
      severity: 'risk',
      readable: 'The privy smells bad enough to become a future inspection risk.',
      tags: ['area', 'privy', 'inspection', 'inherited'],
    })
  }

  const suppliers = Object.values(state.world.suppliers)
  if (suppliers.some((supplier) => supplier.relationship <= 45 || supplier.reliability <= 50)) {
    entries.push({
      id: 'supplier_contacts_untested',
      system: 'suppliers',
      severity: 'watch',
      readable: 'Supplier relationships are cold or untested.',
      tags: ['supplier', 'inherited', 'relationship'],
    })
  }

  const factions = Object.values(state.world.factions)
  if (factions.some((faction) => faction.relationship <= 45 || faction.trust <= 45)) {
    entries.push({
      id: 'factions_cautious',
      system: 'factions',
      severity: 'watch',
      readable: 'Faction relationships are cautious.',
      tags: ['faction', 'inherited', 'relationship'],
    })
  }

  const cultures = Object.values(state.world.cultures)
  if (cultures.some((culture) => culture.tension >= 40 || culture.familiarity <= 35)) {
    entries.push({
      id: 'cultural_expectations_unknown',
      system: 'cultures',
      severity: 'watch',
      readable: 'Cultural expectations are not yet fully known.',
      tags: ['culture', 'inherited', 'expectations'],
    })
  }

  return entries
}
