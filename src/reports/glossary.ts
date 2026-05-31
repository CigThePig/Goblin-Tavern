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
    label: 'Owner Time',
    category: 'mechanic',
    oneLine: 'The minutes in your owner workday; you spend them on owner actions.',
    longer: 'Each owner action costs a span of time — a quiet word is cheap, re-flagging the cellar eats most of the day. How you spend the day is its most important constraint.',
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
  // ---- Phase 92 — Tavern screen terms ----
  {
    id: 'area_trait',
    label: 'Area Trait',
    category: 'mechanic',
    oneLine: 'Persistent identity of an area (cozy, drafty, sticky-floored). Modifies how customers react.',
    longer: 'Traits are set by upgrades, projects, and long-running pressures; downstream modules read them when scoring customer comfort, inspection risk, and atmosphere.',
  },
  {
    id: 'area_upgrade',
    label: 'Area Upgrade',
    category: 'mechanic',
    oneLine: 'Buildable improvement to an area. Costs coin and time to install; can be damaged or disabled.',
    longer: 'Each upgrade declares a coin cost, optional build days, and the traits / atmosphere tags it adds or removes once installed. Many are gated to specific areas.',
  },
  {
    id: 'atmosphere',
    label: 'Atmosphere',
    category: 'mechanic',
    oneLine: 'Tonal tags an area gives off (warm, smoky, lived-in). Read by customers, not directly set by the player.',
    longer: 'Atmosphere emerges from traits, upgrades, and recent activity. Different customer groups prefer different combinations.',
  },
  {
    id: 'freshness',
    label: 'Freshness',
    category: 'mechanic',
    oneLine: 'Inverse of spoilage. 100 = pristine, 0 = inedible.',
    longer: 'Freshness drops as stock ages in storage. Cold cellars and herb gardens slow the drop; warm areas accelerate it.',
  },
  {
    id: 'spoilage',
    label: 'Spoilage',
    category: 'mechanic',
    oneLine: 'How decayed a stock item is. Rises with age; high spoilage hurts service quality and food-safety pressure.',
    longer: 'Service code refuses to use ingredients above the safety threshold; serving anything spoiling-but-not-yet-discarded risks complaint seeds and inspection suspicion.',
  },
  {
    id: 'recipe',
    label: 'Recipe',
    category: 'mechanic',
    oneLine: 'A dish customers can order. Consumes ingredients on serve; gated by cook skill and culinary renown.',
    longer: 'Recipes are defined statically (inputs, prep difficulty, demand tier) but the player chooses which to keep on the menu via the recipes panel.',
  },
  {
    id: 'on_menu',
    label: 'On Menu',
    category: 'mechanic',
    oneLine: 'Whether a recipe is currently offered to customers. Player-controlled, costs no owner time.',
    longer: 'Recipes off the menu still consume freshness in storage. Toggling does not retroactively undo a service that already happened.',
  },
  {
    id: 'prep_difficulty',
    label: 'Prep Difficulty',
    category: 'mechanic',
    oneLine: 'Cook skill threshold for clean preparation. Higher means more failed dishes from underskilled cooks.',
    longer: 'A cook whose skill is well below prep difficulty produces lower-quality output, occasional waste, and rarely a customer complaint. Tier-up cooks raise the ceiling.',
  },
  {
    id: 'demand_tier',
    label: 'Demand Tier',
    category: 'mechanic',
    oneLine: 'Which culinary-renown tier a recipe attracts customers from.',
    longer: 'Common dishes draw any culinary tier; rare and legendary dishes draw only customers who already respect your renown. Building renown unlocks the demand.',
  },
  {
    id: 'expedition',
    label: 'Expedition',
    category: 'mechanic',
    oneLine: 'A multi-day adventurer-led run to fetch rare ingredients. Costs upfront; outcome varies.',
    longer: 'Cost = adventurer wage × days. The expedition runs in the background; when it resolves, the runner returns with some, all, or none of what they promised — depending on reliability, experience, and luck.',
  },
  {
    id: 'adventurer',
    label: 'Adventurer',
    category: 'mechanic',
    oneLine: 'Hireable runner who commissions expeditions. Carries experience, reliability, and relationship meters.',
    longer: 'Each adventurer has a wage base and an optional specialty (uncommon, rare, legendary). Specialty biases what they bring back; reliability biases whether they bring it back at all.',
  },
  {
    id: 'runner_reliability',
    label: 'Runner Reliability',
    category: 'mechanic',
    oneLine: 'How likely an adventurer is to return with what they promised. Low reliability → partial or failed expeditions.',
    longer: 'Reliability shifts with completed jobs (success raises it, failures and lost runs lower it). A long-trusted adventurer becomes a known quantity.',
  },
  {
    id: 'project',
    label: 'Project',
    category: 'mechanic',
    oneLine: 'A multi-day construction or social effort the owner commits to. Progresses each day until it pays out.',
    longer: 'Projects appear under Plan the Day → Projects. Each banks progress toward a target; on completion they apply durable effects (a new area, a social outcome, a renown bump).',
  },
  {
    id: 'project_progress',
    label: 'Project Progress',
    category: 'mechanic',
    oneLine: 'How close a long-running owner project is to completion. Ticks daily; funding speeds it up.',
    longer: 'Projects auto-progress by 1 per day. Fund Active Project consumes coin and a little owner time to add extra progress. Cancel returns nothing.',
  },
  {
    id: 'policy',
    label: 'Policy',
    category: 'mechanic',
    oneLine: 'A standing rule the player toggles on or off. Effects last until disabled.',
    longer: 'Policies are sticky: enabling cheap_payday_specials affects every payday until you disable it. Some policies conflict — enabling one auto-disables its opposite.',
  },
  {
    id: 'social_action',
    label: 'Social Action',
    category: 'mechanic',
    oneLine: 'A relationship-move owner action (apologize, comfort, negotiate, warn). Affects loyalty, trust, and relationship meters.',
    longer: 'Social actions create durable records in state — weekly community routines and future issue seeds read them to react to the player\'s relational style.',
  },
  // Phase 93 — World screen vocabulary.
  {
    id: 'regular',
    label: 'Regular',
    category: 'mechanic',
    oneLine: 'A named recurring customer the sim remembers across days.',
    longer: 'Regulars emerge when customer groups visit repeatedly. Each has loyalty and irritation meters, a favourite stock item, a first-seen day, and a roster of memories tied to incidents they witnessed.',
  },
  {
    id: 'supplier',
    label: 'Supplier',
    category: 'mechanic',
    oneLine: 'An external trader the tavern buys ingredients from.',
    longer: 'Suppliers carry reliability, relationship, debt tolerance and a price bias. Strong relationships unlock supplier_offer seeds and better terms; ruined ones cut you off from a category of stock.',
  },
  {
    id: 'faction',
    label: 'Faction',
    category: 'mechanic',
    oneLine: 'An organised in-world group with cohesive interests — guilds, gangs, councils.',
    longer: 'Factions hold four meters about the tavern: relationship, influence, trust, and fear. They drive faction_request and relationship_test seeds, and their influence shapes which customer groups feel safe inside.',
  },
  {
    id: 'culture',
    label: 'Culture',
    category: 'mechanic',
    oneLine: 'A broad people-group with shared naming, foods, and calendar.',
    longer: 'Cultures hold familiarity (how well they know you), comfort (how welcome they feel), and tension (how much friction they carry with other cultures present). They gate which names regulars and NPCs receive and which stock tags they prefer or dislike.',
  },
  {
    id: 'notable_npc',
    label: 'Notable NPC',
    category: 'mechanic',
    oneLine: 'A named, persistent figure — inspector, landlord, faction leader — distinct from customer groups.',
    longer: 'NPCs are referenced by ids and carry their identity across days. Cards reference NPCs through `EntityRef`; never inline their names.',
  },
  {
    id: 'irritation',
    label: 'Irritation',
    category: 'mechanic',
    oneLine: 'Short-term annoyance a regular accumulates from bad service.',
    longer: 'Distinct from loyalty: loyalty is slow-moving, irritation is reactive. High irritation triggers complaint seeds and can drop a regular off the visit roster faster than loyalty erodes.',
  },
  {
    id: 'reliability',
    label: 'Reliability',
    category: 'mechanic',
    oneLine: 'How dependable a supplier or adventurer is — likelihood of delivering on a promise.',
    longer: 'Rises with successful deliveries / completed runs; falls with failures and broken commitments. Low reliability turns even a generous offer into a coin-flip.',
  },
  {
    id: 'relationship',
    label: 'Relationship',
    category: 'mechanic',
    oneLine: 'How warm an entity feels toward the tavern, 0–100.',
    longer: 'Suppliers, factions, regulars, and adventurers each carry their own relationship meter. High relationship unlocks better offers, deeper trust, and lower friction on social actions.',
  },
  {
    id: 'influence',
    label: 'Influence',
    category: 'mechanic',
    oneLine: 'How much power a faction wields in the local network.',
    longer: 'High influence factions move customer groups, suppliers, and rumours when they shift. Reputation with high-influence factions matters more than with peripheral ones.',
  },
  {
    id: 'trust_fear',
    label: 'Trust & Fear',
    category: 'mechanic',
    oneLine: 'The two halves of how a faction reads the tavern: trust = relied-on, fear = avoided.',
    longer: 'Trust eases negotiation and credit. Fear suppresses overt conflict but breeds rumours and resentment over time. A faction can hold both at once — feared and trusted is the classic protection-racket reading.',
  },
  {
    id: 'familiarity_comfort_tension',
    label: 'Familiarity · Comfort · Tension',
    category: 'mechanic',
    oneLine: 'The three meters a culture tracks about the tavern.',
    longer: 'Familiarity rises with exposure (visits, named members). Comfort rises with culturally-aligned stock and rituals. Tension rises when multiple cultures share space without accommodation — the seed of cultural_tension and culture_conflict.',
  },
  {
    id: 'accuracy',
    label: 'Accuracy',
    category: 'mechanic',
    oneLine: 'Whether a rumour or attribution matches what actually happened.',
    longer: 'Four levels: true · partial · false · unknown. False or partial rumours and attributions are not bugs — the sim deliberately tracks the gap between what happened and what people believe happened.',
  },
  {
    id: 'tavern_identity',
    label: 'Tavern Identity',
    category: 'mechanic',
    oneLine: 'The persistent signature of your tavern: founding day, what it is known for, the rules of the house.',
    longer: 'Identity is not a class label — there is no "Filthy But Beloved" badge. The signature is a small set of facts the simulation collects as the player plays: founding day, atmosphere tags, house rules, and the cluster of regulars and reputations it attracts.',
  },
  // Phase 95 — Voice & Identity Pass.
  {
    id: 'voice',
    label: 'Voice',
    category: 'mechanic',
    oneLine: 'Small style choices a card makes when composing its text.',
    longer: 'Cards never invent facts. Voice picks among ways to phrase the same facts based on the seed\'s tone hints, deterministically per seed id — same card, same wording, every render.',
  },
  {
    id: 'atmosphere',
    label: 'Atmosphere',
    category: 'mechanic',
    oneLine: 'Short tags describing what the tavern feels like right now.',
    longer: 'Computed each day from area conditions and the cultures who feel at home. "Grimy floors" lands when half your areas are dirty; "miner-leaning" lands when miners are familiar and comfortable.',
  },
  {
    id: 'known_for',
    label: 'Known For',
    category: 'mechanic',
    oneLine: 'Reputation axes strong enough to define what people say about the place.',
    longer: 'Any axis at or above 50 contributes. Cap of 3, sorted by axis value. The strip shows up to three — "cheap drinks", "tasty plates", and so on.',
  },
  {
    id: 'house_rules',
    label: 'House Rules',
    category: 'mechanic',
    oneLine: 'The standing policies currently in force at your tavern.',
    longer: 'Every enabled policy contributes a rule fragment. The list is sticky and stable as long as the policies stay on; toggling a policy updates the list on the next endDay.',
  },
  {
    id: 'attribution_hint',
    label: 'Voices',
    category: 'mechanic',
    oneLine: 'Aggregated public beliefs about the tavern — who respects, blames, or distrusts you.',
    longer: 'Surfaces public, sturdy attributions: high-strength, high-publicness beliefs grouped by perceiver kind. Tagged "perhaps wrongly" when the attribution is false or partial. A small window onto identity-as-perception.',
  },
  {
    id: 'nickname',
    label: 'Nickname',
    category: 'mechanic',
    oneLine: 'A name people in the area call your tavern — emerges from sustained, public rumours.',
    longer: 'Nicknames live in `state.world.socialRumours` tagged "nickname". The strip surfaces up to two by strength; only rumours whose accuracy is not "false" appear.',
  },
  // Phase 97 — Missed-opportunity affordance on the daily report.
  {
    id: 'missed_opportunity',
    label: 'Missed Opportunity',
    category: 'mechanic',
    oneLine: 'A moment where an earlier action would have prevented or eased today\'s problem.',
    longer: 'Each daily report can include up to three of these. They aren\'t blame — the sim shows the path you didn\'t take so you learn the action surface without a tutorial. Tap the small dismiss button if a hint isn\'t useful for today.',
  },
  // Phase 96 — Session continuity.
  {
    id: 'autosave',
    label: 'Autosave',
    category: 'mechanic',
    oneLine: 'Your run saves automatically — close the app and your tavern picks up exactly where you left off.',
    longer: 'The save is local to this browser; it covers your sim state, queued owner actions, sticky staff priorities, and the exact beat you were on. There is no manual save button. Start over from the title screen if you want to reset.',
  },
  {
    id: 'quick_day',
    label: 'Quick Day',
    category: 'mechanic',
    oneLine: 'A single-tap shortcut on quiet days — when nothing on fire needs your attention.',
    longer: 'Available when the sim produced zero cards for today across all five timing slots. Quick Day submits any actions you already queued and your sticky staff priorities, then jumps straight to the daily report.',
  },
  {
    id: 'welcome_back',
    label: 'Welcome Back',
    category: 'mechanic',
    oneLine: 'A small pill that surfaces when you return after a few hours away.',
    longer: 'Real-world clock only — the tavern does not run while the app is closed. The pill auto-dismisses after the first beat advance or 30 seconds, whichever comes first.',
  },
  // Phase 98 — Anchors referenced by the More > Help section so the
  // help row buttons resolve to real glossary entries rather than
  // invented copy.
  {
    id: 'settings',
    label: 'Settings',
    category: 'mechanic',
    oneLine: 'Display, comfort, and tutorial toggles, separate from your save.',
    longer: 'Lives under the More tab. Preferences are stored in their own browser slot and survive Start Over — losing a slider position to a corrupted save would be a bad UX, so they never share storage.',
  },
  {
    id: 'save_slots',
    label: 'Save Slots',
    category: 'mechanic',
    oneLine: 'Named snapshots in addition to the always-on autosave.',
    longer: 'Up to five named snapshots live alongside the rolling autosave. Loading a snapshot replaces the current run after a confirm; export downloads a JSON file you can keep elsewhere or share.',
  },
  {
    id: 'font_scale',
    label: 'Font Scale',
    category: 'mechanic',
    oneLine: 'A comfort knob for body text size. Three steps, sticky across sessions.',
    longer: 'Adjusts the root font-size so the body text in cards, reports, and panels scales. Header type and tags stay fixed for layout stability.',
  },
  // Phase 118 — Terms surfaced by the clarity pass that previously
  // lacked glossary entries.
  {
    id: 'upkeep',
    label: 'Upkeep',
    category: 'mechanic',
    oneLine: 'Items the tavern consumes daily to keep running — firewood, mugs, raw ingredients.',
    longer: 'Upkeep recipes never appear on the customer menu. They draw down stock automatically every day; "used for upkeep" pills explain falling quantities you didn\'t serve.',
  },
  {
    id: 'queued_action',
    label: 'Queued Action',
    category: 'mechanic',
    oneLine: 'A pick from Plan the Day that costs owner time but applies tomorrow morning.',
    longer: 'Action chips are queued during planning, not applied immediately. Tap one to cancel before ending the day. They run in order at the start of the next sim day.',
  },
  {
    id: 'action_points',
    label: 'Owner Time',
    category: 'mechanic',
    oneLine: 'The minutes in your owner workday, spent on owner actions.',
    longer: 'Every owner action costs a span of time; cheap chores leave room for more, big jobs eat the day. Time not spent does not carry over to tomorrow.',
  },
  {
    id: 'shortage',
    label: 'Shortage',
    category: 'mechanic',
    oneLine: 'Stock that has dropped low enough to start hurting service.',
    longer: 'A shortage triggers stock_shortage pressure. Recipes with shortage ingredients are blocked from being served. Watch the Stock panel for "low" pills.',
  },
  {
    id: 'outcome_success',
    label: 'Success',
    category: 'mechanic',
    oneLine: 'An expedition outcome — the runner returned with what was sought.',
  },
  {
    id: 'outcome_partial_success',
    label: 'Partial Success',
    category: 'mechanic',
    oneLine: 'An expedition outcome — partial haul, some risk realised.',
  },
  {
    id: 'outcome_failure',
    label: 'Failure',
    category: 'mechanic',
    oneLine: 'An expedition outcome — the runner came back empty-handed.',
  },
  {
    id: 'outcome_runner_lost',
    label: 'Runner Lost',
    category: 'mechanic',
    oneLine: 'An expedition outcome — the runner did not return. They are gone from the hireable roster.',
  },
  {
    id: 'dayType_quiet_day',
    label: 'Quiet Day',
    category: 'mechanic',
    oneLine: 'A day with no calendar pressure — low traffic, gentle pacing.',
  },
  {
    id: 'dayType_supplier_day',
    label: 'Supplier Day',
    category: 'mechanic',
    oneLine: 'A day when deliveries arrive and supplier offers are most likely.',
  },
  {
    id: 'dayType_payday',
    label: 'Payday',
    category: 'mechanic',
    oneLine: 'A weekly day when staff wages and patron purses run heavy.',
  },
  {
    id: 'dayType_market_day',
    label: 'Market Day',
    category: 'mechanic',
    oneLine: 'A weekly day when traffic spikes and rare ingredients appear in passing trade.',
  },
  {
    id: 'dayType_festival_eve',
    label: 'Festival Eve',
    category: 'mechanic',
    oneLine: 'The night before a festival — anticipation, prep, premium prices.',
  },
  {
    id: 'dayType_festival_day',
    label: 'Festival Day',
    category: 'mechanic',
    oneLine: 'A festival itself — busiest traffic, biggest risks, biggest rewards.',
  },
  {
    id: 'dayType_rent_day',
    label: 'Rent Day',
    category: 'mechanic',
    oneLine: 'A monthly day when the landlord collects.',
  },
  {
    id: 'dayType_inspection_day',
    label: 'Inspection Day',
    category: 'mechanic',
    oneLine: 'A day when an inspector visits — food safety, cleanliness, and house rules all under scrutiny.',
  },
]

// Phase 94 — Tavern Log vocabulary. One term per `HistoryCategory` plus
// a top-level entry for the screen itself. Surfaced via `<TermLabel>` on
// the Log screen's category chip toolbar.
const LOG_TERMS: GlossaryTerm[] = [
  {
    id: 'tavern_log',
    label: 'Tavern Log',
    category: 'log',
    oneLine: 'A chronological record of everything that has happened in your tavern.',
    longer: 'The log is the backward-looking partner to the pressures dashboard. Where pressures show what is building, the log shows what has already occurred — pruned to the last 500 entries or 90 days, whichever covers more.',
  },
  {
    id: 'history_owner_action',
    label: 'Owner Action',
    category: 'log',
    oneLine: 'An action you took, queued, funded, or had auto-applied.',
    longer: 'Includes immediate actions, project funding and progress, policy toggles, and social actions. Every block of owner time you spend leaves an owner-action entry.',
  },
  {
    id: 'history_service',
    label: 'Service',
    category: 'log',
    oneLine: 'Something that happened during the service period — traffic, incidents, satisfaction shifts.',
  },
  {
    id: 'history_weekly',
    label: 'Weekly',
    category: 'log',
    oneLine: 'A weekly resolution event — wages paid or unpaid, supplier invoices, community routines.',
  },
  {
    id: 'history_monthly',
    label: 'Monthly',
    category: 'log',
    oneLine: 'A monthly resolution event — rent, landlord opinion, inspection windows, rival recalibration.',
  },
  {
    id: 'history_state_change',
    label: 'State Change',
    category: 'log',
    oneLine: 'A significant tracked change to tavern state — a meter crossing a threshold, an upgrade landing.',
    longer: 'Distinct from owner actions: a state change records what happened as a consequence, not what was decided.',
  },
  {
    id: 'history_memory',
    label: 'Memory',
    category: 'log',
    oneLine: 'A persistent fact the world began to remember about you.',
    longer: 'Memories age over time. The history entry records when one was minted; the memory itself lives on in state.memories until it expires or is resolved.',
  },
  {
    id: 'history_pressure',
    label: 'Pressure',
    category: 'log',
    oneLine: 'A noteworthy pressure shift — crossing a band, peaking, or being relieved.',
    longer: 'Not every pressure tick lands here — only crossings the simulation flagged as worth remembering. Day-to-day pressure values live in the pressures dashboard.',
  },
  {
    id: 'history_system',
    label: 'System',
    category: 'log',
    oneLine: 'A book-keeping event from the simulation itself — migration notes, pruning, debug probes.',
  },
]

export const GLOSSARY_TERMS: GlossaryTerm[] = [
  ...PRESSURE_TERMS,
  ...REPUTATION_TERMS,
  ...MECHANIC_TERMS,
  ...LOG_TERMS,
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
    log: LOG_TERMS,
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
  log: 'Tavern Log',
}
