// Phase 146 / ISSUE-114 — Legible Surface arc, Phase 1.
//
// Signal salience read. The framework's specificity gradient
// (`assemble.ts:specificityOf`) answers "which snippet is most
// SPECIFIC" — it does not answer "which fact is most DECISION-
// RELEVANT". A supplier card is *about* reliability × relationship,
// so when both bands resolve the establishing line should state the
// pair, not whichever single condition happens to out-specify the
// other.
//
// This file adds the data and pure helpers that let the assembler
// (a) tie-break top-specificity matches by salience, and (b) pick a
// second snippet for the multi-fact establishing slot. Layered OVER
// the gradient — slots that don't opt in (`saliencePolicy === undefined`)
// behave exactly as before.
//
// Two structural rules carried over from the framework (§2.3):
//   1. SalienceReads are DATA, not closures. Inspectable by future
//      gates (Phase 16's legibility gate), enumerable, sampleable.
//   2. The reads stay flat — one entry per (signal | pressure |
//      memory | repeat) — so the same `resolveActorRef` resolution
//      already used by `signalEquals` carries this surface too. No
//      new resolver path.

import type {
  IssueSeed,
  IssueSeedFamilyId,
} from '../../sim/modules/issues/issueSeedTypes'
import type { TavernState } from '../../sim/state/TavernState'
import {
  pressureIsRising,
  querySignal,
  repeatCountByTag,
  type BandId,
  type SignalId,
} from '../../sim/signals'
import { __internal as conditionInternal } from './conditions'
import type { Snippet, SnippetCondition } from './types'

const { resolveActorRef, collectSeedTags } = conditionInternal

/**
 * One read a situation can make against the sim. Mirrors the shape of
 * the existing state-lookup snippet conditions (`signalEquals`,
 * `pressureRising`, `memoryPresent`, `repeatCount`, `hasTag`,
 * `severityAtLeast`) so a snippet's conditions map 1-to-1 onto reads by
 * structural equality.
 *
 * Phase 149 / ISSUE-117 — Legible Surface arc, Phase 4. Added `hasTag`
 * and `severity` so narrator-voiced cluster members (stock_shortage,
 * debt_rent) can declare their top-salient facts as data. The legacy
 * four kinds covered every Movement-V (Phase 1) test case, but the first
 * Movement-VI cluster surfaced two facts that *are* the salient ones —
 * the `rent_due_soon` calendar tag, and the `severityAtLeast 70`
 * crisis-threshold — yet had no salience-table representation.
 */
export type SalienceRead =
  | { kind: 'signal'; role: string; signal: SignalId }
  | { kind: 'pressure'; pressureId: string }
  | { kind: 'memory'; tag: string }
  | { kind: 'repeat'; subjectTag: string; atLeast: number }
  | { kind: 'hasTag'; tag: string }
  | { kind: 'severity'; atLeast: number }

export type SeedFamilySalience = {
  /** Ordered most-salient first. Earlier index = more decision-relevant. */
  reads: readonly SalienceRead[]
}

/**
 * Phase 1 seeds only `supplier_relationship` as scaffolding so the
 * headline test has a real table to bite. The remaining eight cluster
 * tables land in Movement VI's per-cluster phases (4–11), each adding
 * its family's salience here without changing the runtime.
 *
 * Families without an entry resolve to an empty salience read; slots
 * opting in still pick deterministically — they just fall back to the
 * pure specificity + FNV ordering, which is identical to today.
 */
export const SALIENCE_TABLES: Partial<
  Record<IssueSeedFamilyId, SeedFamilySalience>
> = {
  venture: {
    reads: [
      { kind: 'hasTag', tag: 'teleology' },
      { kind: 'hasTag', tag: 'paperwork' },
      { kind: 'memory', tag: 'venture' },
    ],
  },

  supplier_relationship: {
    reads: [
      { kind: 'signal', role: 'primaryActor', signal: 'supplier.reliability' },
      { kind: 'signal', role: 'primaryActor', signal: 'supplier.relationship' },
      { kind: 'pressure', pressureId: 'supplier_distrust' },
      { kind: 'pressure', pressureId: 'market_instability' },
      { kind: 'repeat', subjectTag: 'supplier', atLeast: 3 },
      { kind: 'memory', tag: 'supplier' },
    ],
  },

  // Phase 149 / ISSUE-117 — Legible Surface arc, Phase 4 (Suppliers,
  // Stock & Debt cluster). Narrator-voiced — neither family carries a
  // primaryActor with castAttributes (stock subject is a stock item;
  // landlord is a `systemRef` per audit pass 1 §5.3), so reads here are
  // pressure / memory / hasTag / severity / repeat only. Order: highest-
  // extremity facts first (the crisis-threshold severity flag or the
  // calendar window dominate decision-relevance), then family pressures,
  // then choice-affecting memories, then the multi-period repeat as the
  // deepest rung.
  stock_shortage: {
    reads: [
      { kind: 'severity', atLeast: 70 },
      { kind: 'pressure', pressureId: 'stock_shortage' },
      { kind: 'hasTag', tag: 'high_demand' },
      { kind: 'pressure', pressureId: 'reputation_drift' },
      { kind: 'memory', tag: 'deception' },
      { kind: 'memory', tag: 'price' },
      { kind: 'memory', tag: 'ignored' },
      { kind: 'memory', tag: 'stock' },
      { kind: 'repeat', subjectTag: 'stock', atLeast: 3 },
    ],
  },
  debt_rent: {
    reads: [
      { kind: 'severity', atLeast: 70 },
      { kind: 'hasTag', tag: 'rent_due_soon' },
      { kind: 'pressure', pressureId: 'debt' },
      { kind: 'pressure', pressureId: 'landlord' },
      { kind: 'memory', tag: 'risk' },
      { kind: 'memory', tag: 'rent' },
      { kind: 'memory', tag: 'landlord' },
      { kind: 'memory', tag: 'debt' },
      { kind: 'repeat', subjectTag: 'debt', atLeast: 3 },
    ],
  },

  // Phase 150 / ISSUE-118 — Legible Surface arc, Phase 5 (Staff &
  // Personnel cluster). Both staff families are actor-voiced — the
  // template `custom` predicate insists primaryActor is a staff member
  // with populated castAttributes — so reads lead with the two banded
  // staff signals (stress, fatigue: extremity 2 at low/high). The
  // family-primary pressure comes next, then the secondary pressure,
  // then choice-affecting memories ordered to mirror each family's
  // generator (`staff_burnout` reads bonus/workload/risk memories;
  // `staff_identity` reads identity/warning memories), then the staff
  // repeat-count as the deepest rung. No new SalienceRead kinds — every
  // read uses the six already shipped (Phase 1 + Phase 4).
  staff_identity: {
    reads: [
      { kind: 'signal', role: 'primaryActor', signal: 'staff.stress' },
      { kind: 'signal', role: 'primaryActor', signal: 'staff.fatigue' },
      { kind: 'pressure', pressureId: 'staff_loyalty_risk' },
      { kind: 'pressure', pressureId: 'staff_burnout' },
      { kind: 'memory', tag: 'identity' },
      { kind: 'memory', tag: 'warning' },
      { kind: 'repeat', subjectTag: 'staff', atLeast: 3 },
    ],
  },
  staff_burnout: {
    reads: [
      { kind: 'signal', role: 'primaryActor', signal: 'staff.stress' },
      { kind: 'signal', role: 'primaryActor', signal: 'staff.fatigue' },
      { kind: 'pressure', pressureId: 'staff_burnout' },
      { kind: 'pressure', pressureId: 'staff_loyalty_risk' },
      { kind: 'memory', tag: 'bonus' },
      { kind: 'memory', tag: 'workload' },
      { kind: 'memory', tag: 'risk' },
      { kind: 'repeat', subjectTag: 'staff', atLeast: 3 },
    ],
  },

  // Phase 151 / ISSUE-119 — Legible Surface arc, Phase 6 (Regulars &
  // Complaints cluster). Both families are actor-voiced (the templates'
  // `custom` predicate insists primaryActor carries castAttributes).
  // Reads lead with the two band signals each family turns on
  // (irritation × loyalty for the named regular; satisfaction × loyalty
  // for the cohort), then the family-primary pressure, then secondary
  // pressures, then choice-affecting memories, then the per-family
  // multi-period repeat-count as the deepest rung. No new SalienceRead
  // kinds — every read uses the six already shipped (Phase 1 + Phase 4).
  //
  // `regular_customer` serves both drinkOrderCard (relationship_test)
  // and regularComplaintCard (complaint) — salience is per-family, not
  // per-template; drinkOrder has no establishing slot opted into the
  // multi-fact policy, so its scoring is effectively a no-op for that
  // template. customer_complaint's generator references five pressures
  // across response profiles; the table lists the top three
  // (reputation_drift, regular_customer_loss, staff_loyalty_risk).
  // rumour_pressure and cultural_tension stay reachable as snippet
  // conditions but aren't broadly salient to a cohort complaint's
  // headline.
  regular_customer: {
    reads: [
      { kind: 'signal', role: 'primaryActor', signal: 'regular.irritation' },
      { kind: 'signal', role: 'primaryActor', signal: 'regular.loyalty' },
      { kind: 'pressure', pressureId: 'regular_customer_loss' },
      { kind: 'memory', tag: 'grudge' },
      { kind: 'memory', tag: 'ignored_complaint' },
      { kind: 'memory', tag: 'warning' },
      { kind: 'memory', tag: 'customer' },
      { kind: 'repeat', subjectTag: 'regular', atLeast: 3 },
    ],
  },
  customer_complaint: {
    reads: [
      { kind: 'signal', role: 'primaryActor', signal: 'customer_group.satisfaction' },
      { kind: 'signal', role: 'primaryActor', signal: 'customer_group.loyalty' },
      { kind: 'pressure', pressureId: 'reputation_drift' },
      { kind: 'pressure', pressureId: 'regular_customer_loss' },
      { kind: 'pressure', pressureId: 'staff_loyalty_risk' },
      { kind: 'memory', tag: 'complaint' },
      { kind: 'memory', tag: 'customer' },
      { kind: 'repeat', subjectTag: 'customer', atLeast: 3 },
    ],
  },

  // Phase 152 / ISSUE-120 — Legible Surface arc, Phase 7 (Factions &
  // Culture cluster). Two new entries. factionRequest is actor-voiced
  // (faction has castAttributes via Phase 128); cultureConflict is
  // narrator-voiced (cultures are population concepts, no individual
  // cast). The two band signals for each family lead the read order
  // (extremity 2 at low/high). For `faction_request` the generator
  // embeds only `faction_anger` and `cultural_tension` as pressures
  // (Phase 136 record) — both listed, primary first. For
  // `culture_conflict` the generator embeds only `cultural_tension`;
  // the four memory tags listed match the generator's emission ranking
  // (mediate / honour / ignore / neglected paths). The `hasTag` reads
  // for festival / ritual stay secondary to memories because the
  // cultural calendar context modulates flavor rather than driving the
  // headline. Both families' banded meters were added in Phase 136 /
  // ISSUE-105 (no Movement-V loopback required).
  //
  // `culture_conflict` is the arc's first 3-meter situation; the
  // establishing pool authors spec-3 cube corners for tension=high ×
  // comfort × familiarity to express the readable cube alongside the
  // 2-meter spec-2 supports. The salience read resolves all three
  // meters independently — slot selection layers over the gradient.
  faction_request: {
    reads: [
      { kind: 'signal', role: 'primaryActor', signal: 'faction.relationship' },
      { kind: 'signal', role: 'primaryActor', signal: 'faction.influence' },
      { kind: 'pressure', pressureId: 'faction_anger' },
      { kind: 'pressure', pressureId: 'cultural_tension' },
      { kind: 'memory', tag: 'grudge' },
      { kind: 'memory', tag: 'refusal' },
      { kind: 'memory', tag: 'gratitude' },
      { kind: 'memory', tag: 'faction' },
      { kind: 'repeat', subjectTag: 'faction', atLeast: 3 },
    ],
  },
  culture_conflict: {
    reads: [
      { kind: 'signal', role: 'primaryActor', signal: 'culture.tension' },
      { kind: 'signal', role: 'primaryActor', signal: 'culture.comfort' },
      { kind: 'signal', role: 'primaryActor', signal: 'culture.familiarity' },
      { kind: 'pressure', pressureId: 'cultural_tension' },
      { kind: 'memory', tag: 'ignored' },
      { kind: 'memory', tag: 'neglected' },
      { kind: 'memory', tag: 'honour' },
      { kind: 'memory', tag: 'mediation' },
      { kind: 'memory', tag: 'culture' },
      { kind: 'hasTag', tag: 'festival' },
      { kind: 'hasTag', tag: 'ritual' },
      { kind: 'repeat', subjectTag: 'culture', atLeast: 3 },
    ],
  },

  // Phase 153 / ISSUE-121 — Legible Surface arc, Phase 8 (Premises &
  // Atmosphere cluster). Both families are NARRATOR-voiced — areas
  // have no `castAttributes` (rooms are not characters) — so pool
  // snippets carry no `voiceAxis` / `verbalTic` conditions. The Phase-
  // 137 `resolveActorRef` extension lets snippets read the area
  // through the `'location'` role for signal lookups. Each template
  // authors a 3-meter cube on its own picker projection:
  //
  //   - `maintenance` picker scores `damage + (60 − condition)`. Lead
  //     read is `area.damage` (strictly dominant: higher = higher
  //     score, no inversion), then `area.condition` (second picker
  //     meter, inverted), then `area.cleanliness` as the cube-face
  //     third meter.
  //   - `area_atmosphere` picker scores `(100 − cleanliness) + damage`
  //     (must score ≥ 60). Lead read is `area.cleanliness` (strictly
  //     dominant), then `area.damage`, then `area.condition` as the
  //     cube-face third.
  //
  // Both families share one pressure (`maintenance`) which follows the
  // three signals. Memory ordering mirrors each generator's prior-
  // choice tag emissions. Two `hasTag` reads on maintenance
  // (`inspection_relevant`, `fire_risk`) and three on area_atmosphere
  // (`reputation`, `inspection_negative`, `merchant_sensitive`) gate
  // top-rung escalation snippets in the existing pools — included so
  // the salience read stays enumerable for the Phase-16 legibility
  // gate. `severity` is NOT a salience read for these families: the
  // pickers don't threshold on severity (severity is downstream of the
  // meters), matching Phase 152's choice for faction / culture. The
  // repeat read is the deepest rung for each (multi-period pattern).
  maintenance: {
    reads: [
      { kind: 'signal', role: 'location', signal: 'area.damage' },
      { kind: 'signal', role: 'location', signal: 'area.condition' },
      { kind: 'signal', role: 'location', signal: 'area.cleanliness' },
      { kind: 'pressure', pressureId: 'maintenance' },
      { kind: 'memory', tag: 'warning' },
      { kind: 'memory', tag: 'ignored' },
      { kind: 'memory', tag: 'patch' },
      { kind: 'memory', tag: 'maintenance' },
      { kind: 'hasTag', tag: 'inspection_relevant' },
      { kind: 'hasTag', tag: 'fire_risk' },
      { kind: 'repeat', subjectTag: 'maintenance', atLeast: 3 },
    ],
  },
  area_atmosphere: {
    reads: [
      { kind: 'signal', role: 'location', signal: 'area.cleanliness' },
      { kind: 'signal', role: 'location', signal: 'area.damage' },
      { kind: 'signal', role: 'location', signal: 'area.condition' },
      { kind: 'pressure', pressureId: 'maintenance' },
      { kind: 'memory', tag: 'atmosphere' },
      { kind: 'memory', tag: 'neglected' },
      { kind: 'memory', tag: 'cleaning' },
      { kind: 'memory', tag: 'repair' },
      { kind: 'hasTag', tag: 'reputation' },
      { kind: 'hasTag', tag: 'inspection_negative' },
      { kind: 'hasTag', tag: 'merchant_sensitive' },
      { kind: 'repeat', subjectTag: 'atmosphere', atLeast: 3 },
    ],
  },

  // Phase 154 / ISSUE-122 — Legible Surface arc, Phase 9 (Crises &
  // Safety cluster). Three new entries, all actor-voiced (the pool
  // reaction/manner snippets carry `voiceAxis` / `verbalTic`
  // conditions; the establishing pool stays narrator/sim-backed). Each
  // family authors a 3-meter cube on its own picker projection:
  //
  //   - `food_safety` picker scores four food vectors (kitchen,
  //     mushrooms, stew, cook); the cube fixes
  //     `area.cleanliness=low` on the kitchen and spans
  //     `staff.stress × staff.fatigue` 2×2 on the cook actor. Lead
  //     read is `area.cleanliness` on `'location'` (the strictly
  //     dominant picker-driver for the kitchen vector: `100 −
  //     cleanliness`). Next two reads are the cook's banded meters on
  //     `'primaryActor'` — stress / fatigue are the cook's voicing
  //     surface even though the picker uses cook loyalty (which is
  //     not a banded signal in `numeric.ts`). `area.damage` follows
  //     as the secondary kitchen meter. `food_safety` pressure leads
  //     the pressure rung; `inspection` is the secondary pressure
  //     (the `serve_anyway` profile raises it). Four memories match
  //     the food_safety response profiles' emitted tags (`warning` /
  //     `kitchen` / `stock` / `deception`). The `hasTag
  //     inspection_relevant` read gates the food_safety/inspection
  //     bridge snippet. `severity` deliberately omitted — pickers
  //     don't threshold on severity (downstream of meters), matching
  //     Phase 152 / 153.
  //
  //   - `violence` picker scores customer groups by `patronage +
  //     rowdiness`; the cube fixes `customer_group.rowdiness=high`
  //     and spans `customer_group.satisfaction × area.damage` 2×2
  //     (social + structural). Lead is `rowdiness` on
  //     `'primaryActor'` (strictly dominant picker-driver); then
  //     `satisfaction` (the social dimension a player reads alongside
  //     rowdiness); then `area.damage` on `'location'`;
  //     `customer_group.loyalty` follows because a low-loyalty rowdy
  //     group is a different problem from a high-loyalty rowdy group
  //     (the ban response profile bites differently). `violence`
  //     pressure follows. Four memories match the violence response
  //     profiles (`warning` / `brawl` / `security` / `ban`).
  //     `severity` deliberately omitted (same rationale).
  //
  //   - `inspection` picker selects a primary faction by
  //     authority-bonus minus recency; the cube fixes
  //     `faction.relationship=low` and spans `faction.influence ×
  //     area.cleanliness` 2×2 (authority + venue-state). Lead is
  //     `faction.relationship` on `'primaryActor'` (the standing
  //     that makes the inspection bite). Then `faction.influence`
  //     (high-authority sour inspector = worst case top rung). Then
  //     `area.cleanliness` and `area.condition` on `'location'` (the
  //     venue meters the inspector is actually scoring). `inspection`
  //     pressure follows. Three memories match inspection profiles
  //     (`warning` / `bribed_inspector` / `inspection_prep_recently`).
  //     The `hasTag inspection_relevant` read gates the
  //     inspection-bridge snippet. `severity` deliberately omitted.
  //
  // Pre-existing asymmetry inherited from Phase 138: the inspection
  // template's `custom` predicate accepts `notable_npc` primaryActors
  // too. When primaryActor is an NPC (not a faction), the
  // `faction.relationship` / `faction.influence` reads on
  // `'primaryActor'` don't resolve — the salience read silently
  // returns those facts as missing, and spec-1 / spec-2 single-
  // condition snippets handle the establishing line. Documented here
  // so a future reader doesn't read this as a bug.
  food_safety: {
    reads: [
      { kind: 'signal', role: 'location', signal: 'area.cleanliness' },
      { kind: 'signal', role: 'primaryActor', signal: 'staff.stress' },
      { kind: 'signal', role: 'primaryActor', signal: 'staff.fatigue' },
      { kind: 'signal', role: 'location', signal: 'area.damage' },
      { kind: 'pressure', pressureId: 'food_safety' },
      { kind: 'pressure', pressureId: 'inspection' },
      { kind: 'memory', tag: 'warning' },
      { kind: 'memory', tag: 'kitchen' },
      { kind: 'memory', tag: 'stock' },
      { kind: 'memory', tag: 'deception' },
      { kind: 'hasTag', tag: 'inspection_relevant' },
      { kind: 'repeat', subjectTag: 'food_safety', atLeast: 3 },
    ],
  },
  violence: {
    reads: [
      { kind: 'signal', role: 'primaryActor', signal: 'customer_group.rowdiness' },
      { kind: 'signal', role: 'primaryActor', signal: 'customer_group.satisfaction' },
      { kind: 'signal', role: 'location', signal: 'area.damage' },
      { kind: 'signal', role: 'primaryActor', signal: 'customer_group.loyalty' },
      { kind: 'pressure', pressureId: 'violence' },
      { kind: 'memory', tag: 'warning' },
      { kind: 'memory', tag: 'brawl' },
      { kind: 'memory', tag: 'security' },
      { kind: 'memory', tag: 'ban' },
      { kind: 'repeat', subjectTag: 'violence', atLeast: 3 },
    ],
  },
  inspection: {
    reads: [
      { kind: 'signal', role: 'primaryActor', signal: 'faction.relationship' },
      { kind: 'signal', role: 'primaryActor', signal: 'faction.influence' },
      { kind: 'signal', role: 'location', signal: 'area.cleanliness' },
      { kind: 'signal', role: 'location', signal: 'area.condition' },
      { kind: 'pressure', pressureId: 'inspection' },
      { kind: 'memory', tag: 'warning' },
      { kind: 'memory', tag: 'bribed_inspector' },
      { kind: 'memory', tag: 'inspection_prep_recently' },
      { kind: 'hasTag', tag: 'inspection_relevant' },
      { kind: 'repeat', subjectTag: 'inspection', atLeast: 3 },
    ],
  },

  // Phase 155 / ISSUE-123 — Legible Surface arc, Phase 10 (Reputation,
  // Rumour & Rivals cluster). Three new entries on a cluster with **no
  // band signals on its primary subject** — reputation axes, rumour
  // accuracy, rumour target kind, and rival type are categorical enums
  // per Phase 13 / ISSUE-108's tag-enrichment decision ("enum /
  // categorical facts don't band naturally and `hasTag` reads them
  // directly without new SignalIds"). So lead reads are `hasTag` (the
  // categorical *what-is-this-about* fact) followed by `pressureRising`
  // (the family pressure climbing), family memories ordered to mirror
  // each generator's emit, severity, and the multi-period repeat as
  // the deepest rung. Matches the narrator-voiced shape Phase 149 used
  // for stock_shortage / debt_rent.
  //
  //   - `reputation_shift` reads list all ten axis tags (the picker at
  //     `issueSeedGenerators.ts:3308` ranks by `|axisValue - 50|`,
  //     emits any axis given enough deviation). Order: the five highest-
  //     trafficked axes first (cozy / tasty / dangerous / reliable /
  //     respectable — the ones playtest commonly surfaces), then the
  //     other five (culinary_renown / filthy / strange / cheap /
  //     goblinAuthentic). Only one axis tag resolves per seed, so the
  //     order matters only for enumerability — the salience-table
  //     coverage tests assert each axis can be the lead read. Memory
  //     order mirrors the generator's emission (`identity` from the
  //     embrace path at `issueSeedGenerators.ts:3403`, `customer` from
  //     the advertise path).
  //
  //   - `rumour_crisis` leads with accuracy because it shapes the
  //     decision space (a *true* rumour can't be denied honestly; a
  //     *false* one can). Target-kind reads come next so the card
  //     states *who* the tale has landed on. Memory order mirrors the
  //     generator's emission of `denial` / `honesty` / `bribe` /
  //     `deception` tags
  //     (`expandedSeedGenerators.ts:5074`, `5723`, `5333`).
  //
  //   - `rival_tavern` leads with `rival.arc` vs `rival.system` — a
  //     named-arc rival reads as a different problem from an anonymous
  //     price-undercutter. `regular_customer_loss` follows the family
  //     pressure as a cross-pressure crossover (mirrors Phase 154's
  //     `inspection` listing alongside `food_safety`) because the
  //     rival's secondary mechanical effect bleeds regulars. Memory
  //     order mirrors the generator's profile emissions (`price` /
  //     `event` / `deception` / `ignored` paths).
  //
  // `severity ≥ 70` is included on all three — the crisis-threshold
  // floor matching Phase 149's stock_shortage / debt_rent precedent for
  // narrator-voiced families.
  reputation_shift: {
    reads: [
      { kind: 'hasTag', tag: 'reputation.cozy' },
      { kind: 'hasTag', tag: 'reputation.tasty' },
      { kind: 'hasTag', tag: 'reputation.dangerous' },
      { kind: 'hasTag', tag: 'reputation.reliable' },
      { kind: 'hasTag', tag: 'reputation.respectable' },
      { kind: 'hasTag', tag: 'reputation.culinary_renown' },
      { kind: 'hasTag', tag: 'reputation.filthy' },
      { kind: 'hasTag', tag: 'reputation.strange' },
      { kind: 'hasTag', tag: 'reputation.cheap' },
      { kind: 'hasTag', tag: 'reputation.goblinAuthentic' },
      { kind: 'pressure', pressureId: 'reputation_drift' },
      { kind: 'memory', tag: 'identity' },
      { kind: 'memory', tag: 'customer' },
      { kind: 'severity', atLeast: 70 },
      { kind: 'repeat', subjectTag: 'reputation', atLeast: 3 },
    ],
  },
  rumour_crisis: {
    reads: [
      { kind: 'hasTag', tag: 'rumour.true' },
      { kind: 'hasTag', tag: 'rumour.partial' },
      { kind: 'hasTag', tag: 'rumour.false' },
      { kind: 'hasTag', tag: 'rumour.unknown' },
      { kind: 'hasTag', tag: 'rumour.target.supplier' },
      { kind: 'hasTag', tag: 'rumour.target.regular' },
      { kind: 'hasTag', tag: 'rumour.target.faction' },
      { kind: 'hasTag', tag: 'rumour.target.staff' },
      { kind: 'hasTag', tag: 'rumour.target.customer_group' },
      { kind: 'hasTag', tag: 'rumour.target.notable_npc' },
      { kind: 'pressure', pressureId: 'rumour_pressure' },
      { kind: 'memory', tag: 'denial' },
      { kind: 'memory', tag: 'honesty' },
      { kind: 'memory', tag: 'bribe' },
      { kind: 'memory', tag: 'deception' },
      { kind: 'severity', atLeast: 70 },
      { kind: 'repeat', subjectTag: 'rumour', atLeast: 3 },
    ],
  },
  rival_tavern: {
    reads: [
      { kind: 'hasTag', tag: 'rival.arc' },
      { kind: 'hasTag', tag: 'rival.system' },
      { kind: 'pressure', pressureId: 'rival_tavern_pressure' },
      { kind: 'pressure', pressureId: 'regular_customer_loss' },
      { kind: 'memory', tag: 'price' },
      { kind: 'memory', tag: 'event' },
      { kind: 'memory', tag: 'deception' },
      { kind: 'memory', tag: 'ignored' },
      { kind: 'severity', atLeast: 70 },
      { kind: 'repeat', subjectTag: 'rival', atLeast: 3 },
    ],
  },

  // Phase 156 / ISSUE-124 — Legible Surface arc, Phase 11 (Periodic &
  // Narrative cluster, final Movement VI phase). Two new entries, both
  // narrator-voiced: `monthly_review`'s primaryActor is a `month` ref
  // (periods are not characters, audit pass 1 §5.3); `seasonal_arc`'s
  // primaryActor is a `local_event` ref (Path A) or `undefined` (Path B
  // anticipation) — neither carries castAttributes. Neither family has
  // band signals on its primary subject (months and arc events aren't
  // banded), so reads are pressure / memory / hasTag / severity / repeat
  // only. No Movement-V loopback — every read uses the six already-
  // shipped `SalienceRead` kinds.
  //
  //   - `monthly_review` has no categorical *what-is-this-about* tag the
  //     way `reputation_shift` does (`monthly` / `summary` / `economy`
  //     are shared surface tags). Severity ≥ 70 leads (matches Phase 149
  //     stock_shortage / debt_rent precedent for narrator-voiced
  //     families without a categorical tag). Family pressure `landlord`
  //     follows, then the secondary pressures the seed's
  //     `recentCauseEntries` and consequence-profile delayed effects
  //     actually touch (`debt`, `reputation_drift`,
  //     `rival_tavern_pressure`, `staff_burnout`, `customer_complaint`).
  //     Memories ordered to mirror the four consequence profiles'
  //     emitted tags: `rent_paid_${monthKey}` → `rent`,
  //     `cellar_invested_${monthKey}` → `cellar`,
  //     `reserves_held_${monthKey}` → `reserves`,
  //     `rival_settled_${monthKey}` → `rival`. `landlord` memory caps
  //     the memory rung. `repeatCount monthly ≥ 3` is the deepest rung
  //     (multi-month pattern).
  //
  //   - `seasonal_arc` leads with the theme `hasTag` reads (one of five
  //     mushroom_blight / miner_payday_boom / inspection_campaign /
  //     rival_tavern_expansion / festival_approaching — flowed through
  //     `seed.toneHints[2]`). Theme is the categorical *what-is-this-
  //     about* fact — mirrors Phase 155's rumour-accuracy / rival-type
  //     precedent: enum/categorical facts can't band naturally and
  //     `hasTag` reads them directly without new SignalIds. Only one
  //     theme resolves per seed; order matters for enumerability. Family
  //     pressures `arc_escalation` (primary) and `festival_readiness`
  //     (secondary) follow. Memory tags `arc` / `festival` are the most
  //     consistent across `buildSeasonalArcContent`'s emitted profile
  //     memories. `severity ≥ 70` then `repeat arc ≥ 3` close as the
  //     deepest rungs. The `repeat` read may not always resolve in
  //     production (the family doesn't currently emit `arc` as a
  //     `recencyKey`), but listing it preserves enumerability for the
  //     Phase-16 legibility gate — matches Phase 152's precedent of
  //     listing memory tags that don't always fire.
  monthly_review: {
    reads: [
      { kind: 'severity', atLeast: 70 },
      { kind: 'pressure', pressureId: 'landlord' },
      { kind: 'pressure', pressureId: 'debt' },
      { kind: 'pressure', pressureId: 'reputation_drift' },
      { kind: 'pressure', pressureId: 'rival_tavern_pressure' },
      { kind: 'pressure', pressureId: 'staff_burnout' },
      { kind: 'pressure', pressureId: 'customer_complaint' },
      { kind: 'memory', tag: 'rent' },
      { kind: 'memory', tag: 'cellar' },
      { kind: 'memory', tag: 'reserves' },
      { kind: 'memory', tag: 'rival' },
      { kind: 'memory', tag: 'landlord' },
      { kind: 'repeat', subjectTag: 'monthly', atLeast: 3 },
    ],
  },
  seasonal_arc: {
    reads: [
      { kind: 'hasTag', tag: 'mushroom_blight' },
      { kind: 'hasTag', tag: 'miner_payday_boom' },
      { kind: 'hasTag', tag: 'inspection_campaign' },
      { kind: 'hasTag', tag: 'rival_tavern_expansion' },
      { kind: 'hasTag', tag: 'festival_approaching' },
      { kind: 'pressure', pressureId: 'arc_escalation' },
      { kind: 'pressure', pressureId: 'festival_readiness' },
      { kind: 'memory', tag: 'arc' },
      { kind: 'memory', tag: 'festival' },
      { kind: 'severity', atLeast: 70 },
      { kind: 'repeat', subjectTag: 'arc', atLeast: 3 },
    ],
  },

  // Phase 170 / ISSUE-138 — Complete Surface arc, Phase 3 (Salience
  // Completeness). The one tableless family with an active generator
  // (`generatePolicyBacklash`, expandedSeedGenerators.ts:4495). It routes
  // to `fallbackCard` today, so this entry has no live template — but the
  // arc's coverage contract requires every active-generator family to
  // declare its salient reads, so the first dedicated policy_backlash card
  // opens on a fact rather than a bare mood line, and so the derived
  // completeness test has no hole to skip over.
  //
  // Narrator-voiced: `primaryActor` is a policy ref
  // (`{ kind: 'other', id: 'policy:<id>' }`) — no castAttributes, no banded
  // signal on the subject. So reads are pressure / memory / severity /
  // repeat only, in the Phase-149 / Phase-155 / Phase-156 narrator shape:
  // the `severity >= 70` crisis floor leads (the generator sets
  // `severity = max(35, backlash.severity)`, so a deep backlash crosses the
  // threshold and there is no categorical what-is-this-about tag the way
  // reputation_shift has). The two family pressures the generator embeds
  // follow (`policy_backlash` primary, `faction_anger` secondary;
  // expandedSeedGenerators.ts:4858). Memory order mirrors the response
  // profiles' emitted tags: `warning` (the seed-created memory + the held
  // / explain context), `grudge` (the punish path,
  // expandedSeedGenerators.ts:4819), `reversal` (the repeal path,
  // expandedSeedGenerators.ts:4722), `policy` (broad). The
  // `repeat policy >= 3` read is the deepest rung; like seasonal_arc's
  // `repeat arc` it may not always resolve in production but listing it
  // preserves enumerability for the Phase-12 coverage gate. No new
  // SalienceRead kinds — every read uses the six already shipped.
  policy_backlash: {
    reads: [
      { kind: 'severity', atLeast: 70 },
      { kind: 'pressure', pressureId: 'policy_backlash' },
      { kind: 'pressure', pressureId: 'faction_anger' },
      { kind: 'memory', tag: 'warning' },
      { kind: 'memory', tag: 'grudge' },
      { kind: 'memory', tag: 'reversal' },
      { kind: 'memory', tag: 'policy' },
      { kind: 'repeat', subjectTag: 'policy', atLeast: 3 },
    ],
  },
}

/**
 * A read from the table after evaluation against `(seed, state)`. Reads
 * that don't resolve (signal missing, pressure not rising, memory
 * absent, repeat below threshold) are filtered out at resolution; the
 * returned array preserves salience-table order.
 *
 * `extremity` is the secondary tie-break used inside the assembler: a
 * `low` / `high` band fact is "more extreme" (2) than a `mid` band fact
 * (1); pressures / memories / repeats are binary (1).
 */
export type ResolvedRead = {
  read: SalienceRead
  /** For signal reads only. Other kinds carry only fact-of-presence. */
  band?: BandId
  extremity: number
}

/** Read a single salience entry against state. Returns null when the
 *  read doesn't resolve — the resolver filters these out. */
function evaluateRead(
  read: SalienceRead,
  seed: IssueSeed,
  state: TavernState,
): ResolvedRead | null {
  switch (read.kind) {
    case 'signal': {
      const ref = resolveActorRef(read.role, seed)
      if (!ref) return null
      const result = querySignal(state, read.signal, ref)
      if ('missing' in result) return null
      const extremity = result.band === 'mid' ? 1 : 2
      return { read, band: result.band, extremity }
    }
    case 'pressure': {
      if (!pressureIsRising(state, read.pressureId)) return null
      return { read, extremity: 1 }
    }
    case 'memory': {
      const present = state.memories.some((m) => m.tags.includes(read.tag))
      if (!present) return null
      return { read, extremity: 1 }
    }
    case 'repeat': {
      const count = repeatCountByTag(state, read.subjectTag)
      if (count < read.atLeast) return null
      return { read, extremity: 1 }
    }
    case 'hasTag': {
      // Phase 149 / ISSUE-117 — same source as the `hasTag` snippet
      // condition (domain ∪ toneHints ∪ stake tags). Calendar tags that
      // are flowed onto the seed via `toneHints` resolve here.
      if (!collectSeedTags(seed).has(read.tag)) return null
      return { read, extremity: 1 }
    }
    case 'severity': {
      // Phase 149 / ISSUE-117 — extremity 2 at-or-above the crisis-
      // threshold convention (`>= 70`, matching the `severityAtLeast 70`
      // cells across all twenty Movement-II templates), 1 below it. The
      // `read.atLeast` defines what counts as "severity worth opening
      // on" for this family; the extremity ladder mirrors the band
      // extremity used by `signal` reads.
      if (seed.severity < read.atLeast) return null
      const extremity = seed.severity >= 70 ? 2 : 1
      return { read, extremity }
    }
  }
}

/** Resolve a seed's family salience table against state. Returns an
 *  ordered (most-salient-first) array of facts that actually hold; empty
 *  when the family has no table or none of its reads resolve. Pure. */
export function resolveSalientReads(
  seed: IssueSeed,
  state: TavernState,
): ResolvedRead[] {
  const family = seed.family as IssueSeedFamilyId
  const table = SALIENCE_TABLES[family]
  if (!table) return []
  const out: ResolvedRead[] = []
  for (const read of table.reads) {
    const resolved = evaluateRead(read, seed, state)
    if (resolved) out.push(resolved)
  }
  return out
}

/** Does this snippet condition correspond to this read? Structural
 *  equality on the discriminating fields of the matched kinds. */
function conditionMatchesRead(
  condition: SnippetCondition,
  read: ResolvedRead,
): boolean {
  switch (read.read.kind) {
    case 'signal':
      return (
        condition.kind === 'signalEquals' &&
        condition.role === read.read.role &&
        condition.signal === read.read.signal
      )
    case 'pressure':
      return (
        condition.kind === 'pressureRising' &&
        condition.pressureId === read.read.pressureId
      )
    case 'memory':
      return condition.kind === 'memoryPresent' && condition.tag === read.read.tag
    case 'repeat':
      return (
        condition.kind === 'repeatCount' &&
        condition.subjectTag === read.read.subjectTag
      )
    case 'hasTag':
      // Phase 149 / ISSUE-117 — exact tag match.
      return condition.kind === 'hasTag' && condition.tag === read.read.tag
    case 'severity':
      // Phase 149 / ISSUE-117 — a snippet covers the read when its own
      // threshold is at least as tight as the read's. A snippet gated on
      // `severityAtLeast 70` covers the `severity >= 70` read; a snippet
      // gated on `severityAtLeast 85` covers it more sharply (still
      // matches); a snippet gated on `severityAtLeast 50` is looser than
      // the read and does NOT cover it (the snippet would fire for cases
      // the read considers below the salient threshold).
      return (
        condition.kind === 'severityAtLeast' &&
        condition.value >= read.read.atLeast
      )
  }
}

export type SalienceScore = {
  /** Lowest salience-table index this snippet covers (0 = most salient).
   *  `Infinity` when no condition matches any resolved read. */
  index: number
  /** Highest extremity among matching reads. 0 when no match. */
  extremity: number
  /** Which resolved-read indices this snippet covers. Used by the
   *  multi-fact slot to find an "orthogonal" secondary. */
  coveredReadIndices: readonly number[]
}

/**
 * Score one candidate snippet against the resolved salience reads.
 * Lower `index` wins; higher `extremity` breaks index ties.
 *
 * Exported through `__internal` for Phase-16 gate use and tests.
 */
export function scoreCandidateSalience(
  snippet: Snippet,
  resolved: readonly ResolvedRead[],
): SalienceScore {
  let bestIndex = Infinity
  let bestExtremity = 0
  const covered: number[] = []
  for (let i = 0; i < resolved.length; i++) {
    const r = resolved[i]!
    const hit = snippet.conditions.some((c) => conditionMatchesRead(c, r))
    if (!hit) continue
    covered.push(i)
    if (i < bestIndex) {
      bestIndex = i
      bestExtremity = r.extremity
    } else if (i === bestIndex && r.extremity > bestExtremity) {
      bestExtremity = r.extremity
    }
  }
  return { index: bestIndex, extremity: bestExtremity, coveredReadIndices: covered }
}

export const __internal = {
  evaluateRead,
  conditionMatchesRead,
}
