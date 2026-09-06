import type { CustomerGroupState, TavernState } from '../../state/TavernState'
import { ventureRecord } from './ambitionState'
import { representedGroups } from '../factions/standing'

/** Rules consumed by the owning domains. No copied prices or traffic on state. */
export function ventureSupplierFactor(state: TavernState, supplierId: string): { multiplier: number; notes: string[] } {
  let multiplier = 1
  const notes: string[] = []
  const partner = ventureRecord(state, 'venture_supplier_compact').participantId
  if (state.transformations.supplier_exclusive?.active && partner) {
    multiplier *= partner === supplierId ? 0.88 : 1.12
    notes.push(partner === supplierId ? 'Exclusive supplier compact: 12% discount.' : 'Exclusive compact with another supplier: 12% surcharge.')
  } else if (state.transformations.supplier_compact?.active && partner === supplierId) {
    multiplier *= 0.95
    notes.push('Mutual supplier compact: 5% discount.')
  }
  if (state.transformations.second_start?.active) {
    multiplier *= 0.98
    notes.push('Proven recovery: 2% discount.')
  }
  return { multiplier, notes }
}
export function ventureTrafficBonus(state: TavernState, group: CustomerGroupState): { amount: number; notes: string[] } {
  let amount = 0
  const notes: string[] = []
  if (state.transformations.gathering_place?.active && state.areas.main_room?.upgrades.better_tables?.status === 'installed') {
    amount += 1; notes.push('The established gathering place drew visitors (+1).')
  }
  const faction = ventureRecord(state, 'venture_faction_charter').participantId
  if (state.transformations.quarter_charter?.active && faction && (state.world.factions[faction]?.relationship ?? 0) >= 40 && representedGroups(state, faction).some(g => g.id === group.id)) {
    amount += 2; notes.push('The quarter charter brought its members (+2).')
  }
  const culture = ventureRecord(state, 'venture_shared_table').participantId
  if (state.transformations.shared_table?.active && culture === group.cultureId && (state.world.cultures[culture]?.comfort ?? 0) >= 40) {
    amount += 2; notes.push('The shared table is still welcoming this culture (+2).')
  }
  return { amount, notes }
}
