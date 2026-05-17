// Phase 89 — Static glossary for in-fiction & mechanical terms.
//
// Game-loop §9.4 floats first-encounter popups; Phase 89 ships the
// simpler tap-to-define version. The glossary is opt-in: the player
// taps a chip or the "?" affordance and sees a one-liner plus an
// optional longer paragraph. Definitions are short, plain, and avoid
// in-fiction prose.

import type { GlossaryCategory, GlossaryTerm } from './types'

const PRESSURE_TERMS: GlossaryTerm[] = [
  // Core 10.
  {
    id: 'food_safety',
    label: 'Food Safety',
    category: 'pressure',
    oneLine: 'How likely your food is to make someone sick.',
    longer: 'Driven by area cleanliness, stock freshness, and recent food incidents. High values draw inspections and lose tasty customers.',
  },
  {
    id: 'inspection',
    label: 'Inspection',
    category: 'pressure',
    oneLine: 'How close an external inspector is to showing up.',
    longer: 'Rises with sustained food-safety and violence pressures and falls slowly when the tavern stays quiet. A landed inspection cards into a high-severity decision.',
  },
  {
    id: 'staff_burnout',
    label: 'Staff Burnout',
    category: 'pressure',
    oneLine: 'How worn down your staff collectively are.',
    longer: 'Aggregates per-staff stress and missed days off. High burnout produces staff_request seeds and increases quit risk.',
  },
  {
    id: 'pests',
    label: 'Pests',
    category: 'pressure',
    oneLine: 'How infested the premises are.',
    longer: 'Rises with poor cellar/kitchen cleanliness and unfumigated areas. Feeds food_safety and customer satisfaction loss.',
  },
  {
    id: 'debt',
    label: 'Debt',
    category: 'pressure',
    oneLine: 'How exposed you are on borrowed coin.',
    longer: 'Built from unpaid wages, unpaid suppliers, and outstanding loans. Compounds into landlord pressure near rent week.',
  },
  {
    id: 'maintenance',
    label: 'Maintenance',
    category: 'pressure',
    oneLine: 'How much repair work is overdue.',
    longer: 'Accumulates with area damage and skipped repairs. Past a threshold, areas start producing maintenance warning cards.',
  },
  {
    id: 'violence',
    label: 'Violence',
    category: 'pressure',
    oneLine: 'How likely a fight is.',
    longer: 'Rises with brawl-night crowds, weapon-friendly policy, and recent incidents. Feeds inspection and reputation_drift.',
  },
  {
    id: 'reputation_drift',
    label: 'Reputation Drift',
    category: 'pressure',
    oneLine: 'How fast your tavern\'s identity is changing.',
    longer: 'Tracks how quickly the reputation axes are moving from their multi-week average. Surfaces reputation_shift seeds when sustained.',
  },
  {
    id: 'stock_shortage',
    label: 'Stock Shortage',
    category: 'pressure',
    oneLine: 'How close you are to running out of something.',
    longer: 'Driven by current stock levels against expected purchases. Triggers shortage incidents during service when ignored.',
  },
  {
    id: 'landlord',
    label: 'Landlord',
    category: 'pressure',
    oneLine: 'How patient the landlord is with you.',
    longer: 'Falls quickly when rent is late, slowly when paid on time. Hitting zero produces eviction warnings.',
  },
  // Expanded 11.
  {
    id: 'supplier_distrust',
    label: 'Supplier Distrust',
    category: 'pressure',
    oneLine: 'How wary suppliers are of trading with you.',
  },
  {
    id: 'regular_customer_loss',
    label: 'Regular Customer Loss',
    category: 'pressure',
    oneLine: 'How likely a named regular is to stop visiting.',
  },
  {
    id: 'staff_loyalty_risk',
    label: 'Staff Loyalty Risk',
    category: 'pressure',
    oneLine: 'How likely a staff member is to look for other work.',
  },
  {
    id: 'faction_anger',
    label: 'Faction Anger',
    category: 'pressure',
    oneLine: 'How hostile any one faction is towards the tavern.',
  },
  {
    id: 'cultural_tension',
    label: 'Cultural Tension',
    category: 'pressure',
    oneLine: 'How close cross-culture friction is to a flashpoint.',
  },
  {
    id: 'rival_tavern_pressure',
    label: 'Rival Tavern Pressure',
    category: 'pressure',
    oneLine: 'How much a competitor is pulling traffic from you.',
  },
  {
    id: 'festival_readiness',
    label: 'Festival Readiness',
    category: 'pressure',
    oneLine: 'How prepared you are for the upcoming seasonal event.',
  },
  {
    id: 'market_instability',
    label: 'Market Instability',
    category: 'pressure',
    oneLine: 'How volatile supplier prices are this week.',
  },
  {
    id: 'rumour_pressure',
    label: 'Rumour Pressure',
    category: 'pressure',
    oneLine: 'How damaging the active rumours about you are.',
  },
  {
    id: 'policy_backlash',
    label: 'Policy Backlash',
    category: 'pressure',
    oneLine: 'How much resistance your standing policies are generating.',
  },
  {
    id: 'arc_escalation',
    label: 'Arc Escalation',
    category: 'pressure',
    oneLine: 'How close a running local arc is to its next stage.',
  },
]

const REPUTATION_TERMS: GlossaryTerm[] = [
  {
    id: 'cheap',
    label: 'Cheap',
    category: 'reputation',
    oneLine: 'How affordable your tavern is perceived to be.',
  },
  {
    id: 'tasty',
    label: 'Tasty',
    category: 'reputation',
    oneLine: 'How good the food is, by reputation.',
  },
  {
    id: 'filthy',
    label: 'Filthy',
    category: 'reputation',
    oneLine: 'How dirty your premises are perceived to be.',
  },
  {
    id: 'dangerous',
    label: 'Dangerous',
    category: 'reputation',
    oneLine: 'How risky a visit to the tavern feels.',
  },
  {
    id: 'cozy',
    label: 'Cozy',
    category: 'reputation',
    oneLine: 'How welcoming and warm the place feels.',
  },
  {
    id: 'strange',
    label: 'Strange',
    category: 'reputation',
    oneLine: 'How unconventional the offering is.',
  },
  {
    id: 'reliable',
    label: 'Reliable',
    category: 'reputation',
    oneLine: 'How dependable the tavern is for service and quality.',
  },
  {
    id: 'goblinAuthentic',
    label: 'Goblin-Authentic',
    category: 'reputation',
    oneLine: 'How much the place reads as a real goblin tavern.',
  },
  {
    id: 'respectable',
    label: 'Respectable',
    category: 'reputation',
    oneLine: 'How approving the more proper customer groups are.',
  },
  {
    id: 'culinary_renown',
    label: 'Culinary Renown',
    category: 'reputation',
    oneLine: 'Fame for sourcing rare ingredients and executing rare dishes.',
  },
]

const MECHANIC_TERMS: GlossaryTerm[] = [
  {
    id: 'cause',
    label: 'Cause',
    category: 'mechanic',
    oneLine: 'A recorded reason something changed.',
    longer: 'Every significant state change leaves a cause entry. Tap any diff or pressure to see the causes that drove it.',
  },
  {
    id: 'memory',
    label: 'Memory',
    category: 'mechanic',
    oneLine: 'A persistent fact the world remembers about you.',
    longer: 'Memories age over time. Some are timed (fade after N days), some are grudges (decay slowly), some are patterns (recur until resolved).',
  },
  {
    id: 'future_hook',
    label: 'Future Hook',
    category: 'mechanic',
    oneLine: 'A promised consequence that will surface later.',
    longer: 'When the sim decides "this matters later," it stores a future hook. The report\'s "what might happen" surfaces hooks created today.',
  },
  {
    id: 'attribution',
    label: 'Attribution',
    category: 'mechanic',
    oneLine: 'What an in-world entity thinks happened.',
    longer: 'Different from causes: a cause is what really happened; an attribution is what someone believes about it. Attributions can be true, partial, or false.',
  },
  {
    id: 'severity',
    label: 'Severity',
    category: 'mechanic',
    oneLine: 'How serious a pressure or seed is, 0–100.',
  },
  {
    id: 'urgency',
    label: 'Urgency',
    category: 'mechanic',
    oneLine: 'How soon a pressure or seed needs attention.',
  },
  {
    id: 'novelty',
    label: 'Novelty',
    category: 'mechanic',
    oneLine: 'How fresh a seed is — whether the player has seen this before.',
  },
  {
    id: 'cardWorthiness',
    label: 'Card Worthiness',
    category: 'mechanic',
    oneLine: 'How card-shaped a seed is — the ranking signal for the day.',
    longer: 'Combines severity, urgency, and novelty. The day\'s cards are sorted by this; the highest rank to the top.',
  },
  {
    id: 'pressure',
    label: 'Pressure',
    category: 'mechanic',
    oneLine: 'A 0–100 force pushing the tavern towards a bad outcome.',
    longer: 'There are 21 pressures, grouped into core, social, market, and arc. High pressures produce cards; low pressures stay background.',
  },
  {
    id: 'rumour',
    label: 'Rumour',
    category: 'mechanic',
    oneLine: 'A claim spreading through the local network.',
    longer: 'Rumours carry strength, accuracy (true/partial/false), and reach. They feed rumour_pressure and produce rumour seeds.',
  },
  {
    id: 'identity',
    label: 'Identity',
    category: 'mechanic',
    oneLine: 'The persistent name, kind, and traits of a person or place.',
    longer: 'Generated once and stored. Cards display identities; they never re-derive them.',
  },
  {
    id: 'action_point',
    label: 'Action Point',
    category: 'mechanic',
    oneLine: 'A unit of owner attention; you have 3 per day.',
    longer: 'Owner actions cost 1–3 points. The cap is the day\'s most important constraint.',
  },
  // Phase 90 — terms surfaced by the Weekly overview screen.
  {
    id: 'patronage',
    label: 'Patronage',
    category: 'mechanic',
    oneLine: 'How likely a customer group is to come back this week.',
    longer: 'Patronage rises when a group leaves satisfied and falls when they get bad service or hit shortages. Drives next week\'s traffic.',
  },
  {
    id: 'loyalty',
    label: 'Loyalty',
    category: 'mechanic',
    oneLine: 'How firmly a group or person sticks with you through bad weeks.',
    longer: 'Slow-moving. High loyalty cushions a bad service day; low loyalty turns a single incident into a defection.',
  },
  {
    id: 'morale',
    label: 'Morale',
    category: 'mechanic',
    oneLine: 'A staff member\'s mood. Affects skill checks and the chance of mistakes.',
    longer: 'Recovered by bonuses, comfort actions, and quiet days. Drained by stress, conflict, and skipped pay.',
  },
  {
    id: 'stress',
    label: 'Stress',
    category: 'mechanic',
    oneLine: 'How frazzled a staff member is right now.',
    longer: 'Rises with traffic spikes, incidents, and overlong shifts. High stress lowers skill output and can flip a staff member to unavailable.',
  },
  {
    id: 'fatigue',
    label: 'Fatigue',
    category: 'mechanic',
    oneLine: 'Accumulated tiredness across multiple days.',
    longer: 'Slower to recover than stress. Sustained high fatigue leads to burnout and resignation seeds.',
  },
  {
    id: 'wages',
    label: 'Wages',
    category: 'mechanic',
    oneLine: 'Weekly pay owed to staff. Resolved at the end of each week.',
    longer: 'Paid in full when coin is sufficient; otherwise the unpaid list takes a loyalty hit and may trigger a staff_request seed.',
  },
  {
    id: 'weekly_signals',
    label: 'Weekly Signals',
    category: 'mechanic',
    oneLine: 'How the week shifted your reputation: cheap, filthy, dangerous, tasty, reliable.',
    longer: 'Signals roll up the week\'s service moments. They feed reputation changes and the monthly review.',
  },
  {
    id: 'maintenance_backlog',
    label: 'Maintenance Backlog',
    category: 'mechanic',
    oneLine: 'Areas with conditions bad enough to surface at week\'s end.',
    longer: 'Severity is rated 0–10. Ignoring the backlog grows the maintenance pressure and risks inspection findings.',
  },
  {
    id: 'supplier_invoice',
    label: 'Supplier Invoice',
    category: 'mechanic',
    oneLine: 'A bill from a supplier; due in a future week.',
    longer: 'Invoices arrive when restocking on credit. Unpaid invoices erode supplier relationships and unlock supplier_distrust.',
  },
  {
    id: 'weekly_net',
    label: 'Weekly Net',
    category: 'mechanic',
    oneLine: 'Sales minus expenses for the week.',
    longer: 'Includes wages and any rent due in the week. Negative net eats into your coin and signals trouble paying next month\'s rent.',
  },
  // Phase 91 — terms surfaced by the Monthly overview screen.
  {
    id: 'rent',
    label: 'Rent',
    category: 'mechanic',
    oneLine: 'Monthly fee owed to the landlord. Resolved on day 28.',
    longer: 'Paid in full when coin is sufficient; otherwise it joins your arrears and missed-payment tally, raising landlord pressure for next month.',
  },
  {
    id: 'inspection_suspicion',
    label: 'Inspection Suspicion',
    category: 'mechanic',
    oneLine: 'How close an external inspector is to a surprise visit.',
    longer: 'Rises with food safety, violence, and visible decay. Past 70 the inspector issues a warning; chronic warnings lead to an on-site inspection.',
  },
  {
    id: 'reputation_tier',
    label: 'Reputation Tier',
    category: 'mechanic',
    oneLine: 'How established each reputation axis is, on five bands: absent · faint · known · strong · defining.',
    longer: 'Tier bands are 0–19 absent, 20–39 faint, 40–59 known, 60–79 strong, 80+ defining. Crossing a tier is a meaningful identity shift.',
  },
  {
    id: 'upgrade_readiness',
    label: 'Upgrade Readiness',
    category: 'mechanic',
    oneLine: 'Building upgrades the sim notices you could benefit from this month.',
    longer: 'Read-only — not a purchase queue. Relevance scores reflect how strongly this month\'s state suggests the upgrade would pay off.',
  },
  {
    id: 'month_modifier',
    label: 'Month Modifier',
    category: 'mechanic',
    oneLine: 'A monthly flavor effect that shapes daily nudges and occasional surprises.',
    longer: 'Picked deterministically per (seed, year, month): rainy_month, festival_month, tax_month, mold_bloom, quiet_roads, or adventurer_season. Each carries small daily effects and sometimes a month-end twist.',
  },
  {
    id: 'rival_tavern',
    label: 'Rival Tavern',
    category: 'mechanic',
    oneLine: 'A competitor whose strategy and appeal pull customers away.',
    longer: 'Tracked as a single aggregated pressure plus an appeal meter. The rival\'s strategy (cheap, fancy, rowdy, clean) shapes which of your reputation axes they undercut.',
  },
  {
    id: 'monthly_net',
    label: 'Monthly Net',
    category: 'mechanic',
    oneLine: 'Sales minus expenses across the whole month.',
    longer: 'Includes rent, wages, repairs, and waste. Negative monthly net erodes coin reserves and feeds debt pressure.',
  },
]

export const GLOSSARY_TERMS: GlossaryTerm[] = [
  ...PRESSURE_TERMS,
  ...REPUTATION_TERMS,
  ...MECHANIC_TERMS,
]

const TERMS_BY_ID = new Map(GLOSSARY_TERMS.map((t) => [t.id, t]))

export function getTerm(id: string): GlossaryTerm | undefined {
  return TERMS_BY_ID.get(id)
}

export function termsByCategory(): Record<GlossaryCategory, GlossaryTerm[]> {
  return {
    pressure: PRESSURE_TERMS,
    reputation: REPUTATION_TERMS,
    mechanic: MECHANIC_TERMS,
  }
}

export function searchTerms(query: string): GlossaryTerm[] {
  const q = query.trim().toLowerCase()
  if (q.length === 0) return GLOSSARY_TERMS
  return GLOSSARY_TERMS.filter((t) => {
    if (t.id.toLowerCase().includes(q)) return true
    if (t.label.toLowerCase().includes(q)) return true
    if (t.oneLine.toLowerCase().includes(q)) return true
    return false
  })
}

export const GLOSSARY_CATEGORY_LABELS: Record<GlossaryCategory, string> = {
  pressure: 'Pressures',
  reputation: 'Reputation',
  mechanic: 'Mechanics',
}
