import type { VentureBlueprint } from './ventureCatalog'
import type { AmbitionDefinition, VentureOption } from './ambitionTypes'
import { getEconomyModuleState } from '../economy/state'

const work = (coin: number, label = 'Put in the work'): VentureOption => ({ id: 'invest', label, coin, minutes: 60 })
const definitions: Record<string, { label: string; plan: AmbitionDefinition }> = {
  venture_common_room: {
    label: 'A room worth gathering in',
    plan: {
      summary: 'Fit out the common room, then establish it as a place worth returning to.', unlockDay: 7,
      outcome: 'gathering_place', outcomeLabel: 'An established gathering place',
      benefit: 'The fitted tables provide real seating capacity. A working gathering place draws one extra expected visitor per group.',
      stages: [
        { id: 'prepare', label: 'Plan the room', description: 'Set aside time and supplies for the new room.', work: 2, requirements: [], options: [{ ...work(12), material: { id: 'ingredients', quantity: 3 } }] },
        { id: 'prove', label: 'Put the room to use', description: 'Install Better Tables through Areas, and keep the house trading while the room finds its crowd.', work: 3, requirements: [{ kind: 'upgrade', areaId: 'main_room', upgradeId: 'better_tables', label: 'Better Tables in the main room' }, { kind: 'trading' }], options: [work(8, 'Host the room')] },
      ],
    },
  },
  venture_supplier_compact: {
    label: 'A standing supplier compact',
    plan: {
      summary: 'Build a trading history with one supplier, then choose fair terms or a cheaper exclusive arrangement.', unlockDay: 10, participant: 'supplier',
      outcome: 'supplier_compact', outcomeLabel: 'A standing supplier compact',
      benefit: 'Mutual terms: 5% off this supplier. Exclusive terms: 12% off this supplier, but 12% more from every other supplier. The price floor still applies.',
      stages: [
        { id: 'prepare', label: 'Negotiate the compact', description: 'Meet the named supplier and put the terms in writing.', work: 2, requirements: [{ kind: 'relationship', minimum: 35 }], options: [work(10)] },
        { id: 'prove', label: 'Prove the trading relationship', description: 'Receive three orders from this supplier and keep their relationship at 50 or better. Your final choice sets the terms.', work: 2, requirements: [{ kind: 'deliveries', count: 3 }, { kind: 'relationship', minimum: 50 }], options: [work(10, 'Agree mutual terms'), { id: 'exclusive', label: 'Sign exclusive terms', coin: 0, minutes: 60, outcome: 'supplier_exclusive' }] },
      ],
    },
  },
  venture_faction_charter: {
    label: 'A charter from the quarter',
    plan: {
      summary: 'Earn a faction’s approval through your dealings, then make the tavern a recognised meeting place.', unlockDay: 14, participant: 'faction',
      outcome: 'quarter_charter', outcomeLabel: 'A charter from the quarter',
      benefit: 'The charter draws two extra expected visitors from the faction’s own customer groups while its relationship remains at least 40.',
      stages: [
        { id: 'prepare', label: 'Hear their terms', description: 'Commit time and hospitality to the faction you chose.', work: 2, requirements: [{ kind: 'relationship', minimum: 35 }], options: [work(12)] },
        { id: 'prove', label: 'Earn their signatures', description: 'Host faction nights and answer their requests until their relationship reaches 60.', work: 3, requirements: [{ kind: 'relationship', minimum: 60 }, { kind: 'trading' }], options: [work(10)] },
      ],
    },
  },
  venture_crew_kitchen: {
    label: 'The cook’s own kitchen',
    plan: {
      summary: 'Back a named cook’s initiative with equipment, ingredients, and room to do the job.', unlockDay: 7, participant: 'staff',
      outcome: 'crew_kitchen', outcomeLabel: 'A kitchen run with pride',
      benefit: 'The supported cook gains a permanent kitchen-mentor trait that improves food quality only while they are working.',
      stages: [
        { id: 'prepare', label: 'Back the cook', description: 'A rested cook needs supplies and owner support.', work: 2, requirements: [{ kind: 'staff_ready' }], options: [{ ...work(10), material: { id: 'ingredients', quantity: 5 } }] },
        { id: 'prove', label: 'Let the kitchen prove itself', description: 'Install a Large Stew Pot and give the cook three supported working days.', work: 3, requirements: [{ kind: 'upgrade', areaId: 'kitchen', upgradeId: 'large_stew_pot', label: 'Large Stew Pot in the kitchen' }, { kind: 'staff_ready' }, { kind: 'trading' }], options: [work(8, 'Work alongside the cook')] },
      ],
    },
  },
  venture_shared_table: {
    label: 'A place at the table',
    plan: {
      summary: 'Make one culture welcome through sustained accommodation, then host the table together.', unlockDay: 18, participant: 'culture',
      outcome: 'shared_table', outcomeLabel: 'A lasting place at the table',
      benefit: 'Two extra expected visitors from the welcomed culture while its comfort remains at least 40. The name records who was welcomed.',
      stages: [
        { id: 'prepare', label: 'Learn the table’s customs', description: 'Prepare food and spend time learning how this crowd wants to be received.', work: 2, requirements: [], options: [{ ...work(10), material: { id: 'ingredients', quantity: 5 } }] },
        { id: 'prove', label: 'Keep the welcome', description: 'Serve and accommodate this culture until comfort is at least 60; host three working days.', work: 3, requirements: [{ kind: 'culture_comfort', minimum: 60 }, { kind: 'trading' }], options: [work(12, 'Host the shared table')] },
      ],
    },
  },
  venture_second_start: {
    label: 'A second start',
    plan: {
      summary: 'After financial trouble, rebuild a trading house with a reserve and a clean operating account.', unlockDay: 7,
      applies: state => getEconomyModuleState(state).financial.status !== 'stable' || getEconomyModuleState(state).dailyHistory.some(day => day.statusAfter !== 'stable'),
      outcome: 'second_start', outcomeLabel: 'A house that came back',
      benefit: 'A completed recovery earns a 2% discount on supplier orders. It does not erase debt, fines, rent, or the need to keep trading.',
      stages: [
        { id: 'prepare', label: 'Draw up the recovery', description: 'Set aside owner time while using the economy’s restructuring and reopening actions.', work: 2, requirements: [], options: [work(0, 'Rework the plan')] },
        { id: 'prove', label: 'Rebuild the reserve', description: 'Trade with at least 100 coin, no operating arrears and no restructuring balance for three invested days.', work: 3, requirements: [{ kind: 'solvent' }, { kind: 'trading' }], options: [work(0, 'Keep the recovery on course')] },
      ],
    },
  },
}

export const AMBITION_BLUEPRINTS: Record<string, VentureBlueprint> = Object.fromEntries(
  Object.entries(definitions).map(([id, { label, plan }]) => [id, {
    id, label, ambition: plan,
    createEntry: (day: number) => ({ id, kind: 'venture' as const, label, stage: plan.stages[0]!.id, progress: 0, status: 'active' as const, tags: ['ambition'], createdAtDay: day, updatedAtDay: day }),
    // The domain checks real-world requirements; the shared kernel remains structural.
    definition: { id, milestones: [] },
    openingApplies: state => state.calendar.totalDaysElapsed >= plan.unlockDay && (!plan.applies || plan.applies(state)),
    opening: { establishingLine: plan.summary, problemNoun: label.toLowerCase(), sensoryDetails: [], stakesReadable: plan.benefit, pursueHint: 'Take up this ambition', declineHint: 'Leave this for another time' },
  }]),
)
