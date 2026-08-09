// Phase 35 §35.2 — Local arc type definitions.
//
// Local arcs are longer-running seasonal or community concerns (mushroom
// blights, festivals, mining booms, inspection campaigns) that start,
// progress through stages, apply modest mechanical effects, and resolve
// over many days or weeks. They live alongside the existing month
// modifiers from Phase 15; arcs do not replace those.
//
// This file defines the structural shapes only. Concrete arc definitions
// live in `localArcRegistry.ts`; per-tavern arc instances live on
// `state.world.localEvents` (the Phase 25 container, extended with
// optional arc-specific fields).

import type { EntityRef } from '../../state/TavernState'

/**
 * Canonical arc archetypes from Phase 35 §35.2. A registry entry's
 * `type` slot picks one of these; multiple definitions may share a
 * single archetype (e.g. two distinct festival arcs).
 */
export type LocalArcType =
  | 'festival_approaching'
  | 'supplier_dispute'
  | 'faction_tension'
  | 'inspection_campaign'
  | 'winter_shortage'
  | 'road_danger'
  | 'religious_pilgrimage'
  | 'mining_boom'
  | 'mushroom_blight'
  | 'rival_tavern_expansion'

/**
 * Arc lifecycle stages (Phase 35 §35.2). An arc starts at `seeded`,
 * climbs through `rising → active → climax`, and ends at either
 * `resolved` (ran its course) or `failed` (cooldown gate kept it
 * inactive). Reports treat `resolved` and `failed` as terminal.
 */
export type LocalArcStage =
  | 'seeded'
  | 'rising'
  | 'active'
  | 'climax'
  | 'resolved'
  | 'failed'

/**
 * Phase 35 §35.2 — start-condition shape. Conditions are evaluated as a
 * conjunction (all must pass) when an arc is being considered. Empty
 * `startConditions` arrays mean "no gating beyond the cap/cooldown".
 *
 * `random_weight` is a tie-breaker rather than a gate: when multiple
 * candidates qualify, the seasonal_events RNG stream picks one
 * deterministically using the supplied weights.
 */
export type LocalArcCondition =
  | { kind: 'calendar_tag'; id: string }
  | { kind: 'month_modifier'; id: string }
  | { kind: 'pressure_above'; id: string; threshold: number }
  | { kind: 'reputation_axis_above'; id: string; threshold: number }
  | { kind: 'supplier_relationship_below'; id: string; threshold: number }
  | { kind: 'faction_tension_above'; id: string; threshold: number }
  | { kind: 'random_weight'; weight: number }

/**
 * Phase 35 §35.2 — progression rule shape. The monthly tick consults
 * each rule whose `fromStage` matches the arc's current stage; the
 * first matching rule advances the arc to `toStage`. Rules without
 * gating conditions advance automatically after `afterDays`.
 */
export type LocalArcProgressRule = {
  fromStage: LocalArcStage
  toStage: LocalArcStage
  afterDays?: number
  pressureAbove?: { pressureId: string; value: number }
  memoryTagPresent?: string
  weight?: number
}

/**
 * Phase 35 §35.7 — arc effect shape. Effects are applied when the arc
 * enters or holds an active stage (rising/active/climax). Each effect
 * targets one downstream system:
 *
 *   - `pressure_delta`: nudges a registered pressure each month.
 *   - `market_condition`: activates a Phase 29 market-condition id.
 *   - `customer_group_modifier`: adds a flag tag to a customer group.
 *   - `supplier_modifier`: adds a flag tag to a supplier.
 *   - `calendar_tag`: adds the tag to the active-arc tag bundle so
 *     downstream systems can branch on it.
 *   - `issue_seed_tag`: feeds Phase 39's expanded issue seed selection.
 *   - `reputation_signal`: nudges a reputation axis modestly.
 */
export type LocalArcEffect =
  | { kind: 'pressure_delta'; id: string; amount: number; tags?: string[] }
  | { kind: 'market_condition'; id: string; tags?: string[] }
  | { kind: 'customer_group_modifier'; id: string; tags?: string[] }
  | { kind: 'supplier_modifier'; id: string; tags?: string[] }
  | { kind: 'calendar_tag'; id: string; tags?: string[] }
  | { kind: 'issue_seed_tag'; id: string; tags?: string[] }
  | { kind: 'reputation_signal'; id: string; amount: number; tags?: string[] }

/**
 * Phase 35 §35.4 — registry definition. `minDurationDays` and
 * `maxDurationDays` bound the entire lifecycle, not individual stages.
 * `possibleIssueSeedTags` is consumed by Phase 39's expanded issue
 * seed work; Phase 35 only stores the strings on the arc instance.
 */
export type LocalArcDefinition = {
  id: string
  type: LocalArcType
  label: string
  tags: string[]
  minDurationDays: number
  maxDurationDays: number
  startConditions: LocalArcCondition[]
  progressRules: LocalArcProgressRule[]
  effects: LocalArcEffect[]
  possibleIssueSeedTags: string[]
  /**
   * Expansion Phase 9 §9.2 — the goal, the owner, the stages, the moves on
   * both sides, and what the world keeps afterwards. See the block at the
   * foot of this file.
   *
   * OPTIONAL on purpose. A definition without it runs on the age spine
   * above, exactly as it did in Phase 35, which is what lets an old save or
   * a hand-built fixture keep working. Every definition the game ships
   * carries one.
   */
  progression?: LocalArcProgression
}

/**
 * Phase 35 §35.3 — per-tavern arc instance. Stored under
 * `state.world.localEvents` so the Phase 25 container keeps owning the
 * world's longer-running event records. The shape extends — does not
 * fork — the Phase 25 `LocalEventWorldState`: `type`, `stage`,
 * `lastUpdatedDay`, `ageDays`, `relatedRefs`, `activeEffects`, and
 * `history` are added optionally so legacy local-event records (with
 * no arc semantics) still validate.
 *
 * Resolved or failed arcs stay on the record so cooldown checks can
 * see them; the monthly tick gates re-entry on `lastUpdatedDay` plus
 * the cooldown constant.
 */
export type LocalArcHistoryEntry = {
  day: number
  stage: LocalArcStage
  note: string
}

export type LocalArcInstance = {
  id: string
  definitionId: string
  type: LocalArcType
  label: string
  stage: LocalArcStage
  startedAtDay: number
  lastUpdatedDay: number
  ageDays: number
  intensity: number
  relatedRefs: EntityRef[]
  tags: string[]
  activeEffects: string[]
  history: LocalArcHistoryEntry[]
}

/**
 * Phase 35 §35.10 — caps used by the monthly arc engine. Exposed so
 * tests can read the same numbers the engine does.
 */
export const MAX_ACTIVE_LOCAL_ARCS = 3
export const ARC_REPEAT_COOLDOWN_DAYS = 56

/**
 * Active stages are the ones whose effects apply each month. `seeded`
 * has no mechanical effect yet (it merely reserves the slot); the
 * terminal stages stop applying effects.
 */
export const ACTIVE_ARC_STAGES: readonly LocalArcStage[] = [
  'rising',
  'active',
  'climax',
]

export function isActiveArcStage(stage: LocalArcStage): boolean {
  return ACTIVE_ARC_STAGES.includes(stage)
}

export function isTerminalArcStage(stage: LocalArcStage): boolean {
  return stage === 'resolved' || stage === 'failed'
}

/**
 * Phase 204 / audit Wave 5 (`P4-SEAM-005`) — is this arc IN PLAY, as the
 * player would judge it?
 *
 * Distinct from `isActiveArcStage`, which answers a mechanical question:
 * does this arc count against `MAX_ACTIVE_LOCAL_ARCS` and block another
 * of its definition from seeding. `seeded` deliberately does not, and
 * that must not change.
 *
 * The two player-facing surfaces wanted this question and each guessed a
 * different answer: the Local Arcs report section used the mechanical
 * predicate and reported a just-created arc as `(none)`, while the
 * monthly overview inlined "not resolved and not failed" and listed it.
 */
export function isPresentedArcStage(stage: LocalArcStage): boolean {
  return !isTerminalArcStage(stage)
}

// ---------------------------------------------------------------------------
// Expansion Phase 9 §9.2 — arcs that PROGRESS rather than merely age
// ---------------------------------------------------------------------------
//
// WHAT WAS BROKEN. Everything above this line describes an arc that ages.
// `progressRules` are keyed on `afterDays`, the engine ticks once a month,
// and the whole lifecycle is `seeded → rising → active → climax → resolved`
// on a fixed clock. Nothing about the world could hurry it, slow it, win it
// or lose it: the mushroom blight resolved on day 84 whether the cellar was
// spotless or crawling, and the player's only relationship with it was
// reading about it.
//
// §9.2 asks for eleven things an arc must support, and the honest summary of
// what was missing is that an arc had no GOAL and no OWNER. Without a goal
// there is nothing to succeed or fail at, so "success, compromise, failure
// and aftermath" cannot exist; without an owner there is nobody to make an
// opposing move, so a player intervention has nothing to push against.
//
// So the additions below are all in service of those two. Everything is
// OPTIONAL, and a definition carrying none of it still runs on the legacy
// age spine — which is what lets an old save, or a fixture built by hand
// against the Phase 35 shape, keep working while the shipped catalog moves
// over wholesale.

/**
 * The materially different arc shapes §9.2 requires the catalog to cover.
 *
 * This is a coverage contract, not a behaviour switch: nothing in the engine
 * branches on it. It exists so "the catalog collectively tests eight
 * different shapes" is a checkable property of the registry rather than a
 * claim in a comment.
 */
export type ArcShape =
  /** Starts from live tavern state going wrong, and worsens while it stays wrong. */
  | 'state_driven_crisis'
  /** Two factions at odds, with the house standing between them. */
  | 'faction_conflict'
  /** A market or a supply chain stops behaving. */
  | 'market_disruption'
  /** A culture's occasion, with its own customs to meet or fumble. */
  | 'cultural_event'
  /** The other house making a play. */
  | 'rival_move'
  /** The watch running a campaign rather than a single visit. */
  | 'regulatory_event'
  /** Digging out of something that already went wrong. */
  | 'recovery'
  /** Ends by changing an area, an actor or a rule for good. */
  | 'transformation'

/**
 * Who is driving this arc.
 *
 * `id` is optional because most arcs should attach to whoever is actually
 * involved at the time rather than to a name baked into the definition — a
 * turf dispute belongs to the two factions currently at odds, not to the
 * same two every time. `pick` says how to choose; the engine resolves it
 * once, at seed time, and the resulting `EntityRef` is stored on the run so
 * every later read gets the same actor (architecture rule 8).
 */
export type ArcOwnerSpec = {
  kind: 'faction' | 'supplier' | 'culture' | 'customer_group' | 'system'
  /** A specific actor. Omit to resolve with `pick`. */
  id?: string
  /**
   * How to choose when `id` is absent:
   *   `worst_relationship` — the one that thinks least of the house
   *   `most_influential`   — the one best able to make trouble
   *   `largest`            — the biggest constituency
   *   `fixed`              — requires `id`
   */
  pick?: 'worst_relationship' | 'most_influential' | 'largest' | 'fixed'
}

/**
 * What has to be true for an arc to move on.
 *
 * This is the §9.2 requirement — "event- and state-driven stages" — in one
 * type. A stage that advances on `days_in_stage` alone is the old
 * behaviour, and stays available because some things genuinely just take
 * time; everything else reads live state, so cleaning the cellar actually
 * shortens the blight.
 */
export type ArcAdvanceCondition =
  | { kind: 'days_in_stage'; days: number }
  | { kind: 'goal_progress_at_least'; value: number }
  /**
   * How far AHEAD the house is: goal progress minus opposition.
   *
   * The condition a winning branch should be gated on, and the reason it
   * exists: a branch keyed on goal progress alone lets any player who does
   * enough work win outright no matter how hard the owner pushed, which
   * makes opposition a pacing knob rather than an opponent. Gating the win
   * on the margin puts the two meters on the same footing — and it is the
   * same comparison `computeOutcome` makes, so a stage that opens a winning
   * branch and the outcome that branch leads to agree by construction.
   */
  | { kind: 'margin_at_least'; value: number }
  | { kind: 'goal_progress_below'; value: number }
  | { kind: 'opposition_at_least'; value: number }
  | { kind: 'pressure_above'; id: string; threshold: number }
  | { kind: 'pressure_below'; id: string; threshold: number }
  | { kind: 'reputation_above'; id: string; threshold: number }
  | { kind: 'reputation_below'; id: string; threshold: number }
  | { kind: 'area_cleanliness_below'; id: string; threshold: number }
  | { kind: 'coin_below'; value: number }
  | { kind: 'intervention_taken'; id: string }
  | { kind: 'owner_relationship_below'; threshold: number }

/**
 * One stage of an arc, and the ways out of it.
 *
 * `advanceWhen` is a conjunction. `branches` are checked in declared order
 * BEFORE `next`, so a stage can fork on live state — which is what makes
 * "multiple stage transitions" more than a longer straight line.
 *
 * `timeoutDays` is the §9.2 timeout: a stage nobody resolves does not sit
 * there forever, it falls through to `onTimeout`. That is usually the
 * failure branch, and saying so in the definition is what makes an arc's
 * deadline a fact the player can be warned about.
 */
export type ArcStageDefinition = {
  id: string
  readable: string
  /** Shown to the player as what is at stake right now. */
  stakes?: string
  /** Legacy stage this maps to, for the report and the cap arithmetic. */
  legacyStage: LocalArcStage
  /** All must hold before `next` (or a branch) is taken. */
  advanceWhen: ArcAdvanceCondition[]
  /** Checked in order, before `next`. First whose conditions all hold wins. */
  branches?: Array<{ when: ArcAdvanceCondition[]; toStage: string; readable: string }>
  /** Where the stage goes when `advanceWhen` holds and no branch matched. */
  next?: string
  /** Days after entering this stage before `onTimeout` fires. */
  timeoutDays?: number
  onTimeout?: string
  /**
   * Effects applied ONCE, on the day the arc enters this stage.
   *
   * Once rather than daily, and that is the whole of the decision: the
   * definition-level `effects` are the arc's ambient weight and are applied
   * on the monthly beat, so a per-day stage effect would sit on top of them
   * thirty times over and drown every other input to the same pressure. A
   * one-off shove as the situation escalates is what a stage change
   * actually is.
   */
  effects?: LocalArcEffect[]
  /** Terminal stages end the arc with this outcome. */
  outcome?: ArcOutcomeKind
}

export type ArcOutcomeKind = 'success' | 'compromise' | 'failure'

/**
 * Something the player can do about an arc.
 *
 * Declared per definition rather than as a generic verb set, because "shore
 * up the cellar" and "stand with the miners" are not the same move wearing
 * different words — they cost different things, they are available at
 * different points, and they move the arc by different amounts.
 */
export type ArcInterventionDefinition = {
  id: string
  label: string
  /** What taking it does, in the arc's own terms. */
  readable: string
  coinCost?: number
  /** Minutes from the owner's day. Defaults to a standard chore. */
  minuteCost?: number
  /** Stock the intervention consumes, if any. */
  stockCost?: { id: string; quantity: number }
  /** Stages this is available in. Empty means every non-terminal stage. */
  availableInStages?: string[]
  /** How far it moves the arc toward its goal. */
  goalProgress: number
  /** How much it takes out of the owner's push. Negative provokes them. */
  oppositionDelta?: number
  /** Days before the same intervention may be taken again. */
  cooldownDays?: number
  /** Times it may be taken across the arc's whole life. */
  maxUses?: number
  /** A future hook this intervention stakes, resolved by the arc domain. */
  stakesHook?: string
}

/**
 * A move the arc's OWNER makes on its own cadence.
 *
 * §9.2's "opposing moves". Without these an arc is a slope the player walks
 * down at their own pace; with them it is a contest, and an intervention
 * skipped is ground actually lost rather than merely not gained.
 */
export type ArcOpposingMove = {
  id: string
  readable: string
  /** Days between attempts. */
  everyDays: number
  /** How much opposition it adds. */
  opposition: number
  /** Stages it is made in. Empty means every non-terminal stage. */
  inStages?: string[]
  /**
   * What the owner does in its own domain, beyond pushing the arc:
   *   `press_grievance`  — a faction records how this is going
   *   `harden_terms`     — a supplier gets less generous
   *   `talk`             — the owner puts a word about
   *   `none`             — the push is the whole move
   */
  domainMove?: 'press_grievance' | 'harden_terms' | 'talk' | 'none'
}

/**
 * A change that outlives the arc.
 *
 * §9.2 asks for "permanent or long-lived changes", and the distinction that
 * matters is between a pressure nudge that decays by itself and a fact about
 * the world that does not. Each kind below is applied by the domain that
 * owns the thing being changed — which for the two identity kinds means
 * recorded as durable evidence the identity module reads, because that
 * module recomputes `knownFor` and `houseRules` from scratch every morning
 * and a direct write would be erased overnight.
 *
 * There is deliberately no `reputation_floor` kind. A reputation axis is
 * re-derived from live evidence, so nothing this domain could write would
 * stay put, and a "permanent" change that quietly decays is precisely the
 * broken promise this phase exists to stop making.
 */
export type ArcPermanentChange =
  | { kind: 'area_trait'; areaId: string; trait: string; readable: string }
  | { kind: 'customer_group_patronage'; groupId: string; delta: number; readable: string }
  | { kind: 'identity_known_for'; label: string; readable: string }
  | { kind: 'house_rule'; label: string; readable: string }
  | { kind: 'supplier_terms'; supplierId?: string; multiplier: number; days: number; readable: string }

export type ArcOutcomeSpec = {
  readable: string
  /** One-off effects applied as the arc closes. */
  effects?: LocalArcEffect[]
  /** What the world keeps afterwards. */
  permanentChange?: ArcPermanentChange
  /** Days before this definition may seed again. Overrides the default. */
  cooldownDays?: number
  /** A memory the world keeps of how this went. */
  memoryId?: string
}

/**
 * The §9.2 half of a definition. Entirely optional — a definition without
 * `stages` runs on the legacy age spine above.
 */
export type LocalArcProgression = {
  shape: ArcShape
  /** What the HOUSE is trying to achieve. Stated, so it can be failed. */
  goal: string
  owner: ArcOwnerSpec
  /** Ordered; the first is the entry stage. */
  stages: ArcStageDefinition[]
  interventions: ArcInterventionDefinition[]
  opposingMoves: ArcOpposingMove[]
  outcomes: Record<ArcOutcomeKind, ArcOutcomeSpec>
  /** Can this arc come round again at all? */
  recurrence: 'recurring' | 'once_per_run'
}

/** Caps for the §9.2 run records (§5.11). */
export const MAX_ARC_RUN_HISTORY = 24
export const MAX_ARC_RUNS_KEPT = 12
export const CLOSED_ARC_RUN_RETENTION_DAYS = 90
