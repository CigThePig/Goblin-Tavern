// Phase 27 §27.4 — Culture module type surface.
//
// The Phase 27 slice was `Record<string, never>` — the culture layer had
// nowhere to keep anything, which is why nothing about a culture could
// change in response to what actually happened to it. Expansion Phase 8
// §8.2 fills it.
//
// The organising idea is EVIDENCE. Before this phase the culture module
// emitted three memories a day off proxies: a food taboo if disliked-tagged
// stock sat anywhere in the cellar, a seating conflict if two groups with a
// hostile relationship both had patronage, a misunderstanding if a calendar
// tag matched. None of the three needed anybody to have eaten, sat, or been
// slighted. What lives here is the record of what a culture was ACTUALLY
// served, where it ACTUALLY sat, and what the house actually did on the day
// that mattered to it.

/** One thing that happened to a culture, dated and readable. */
export type CultureEvidenceKind =
  /** A dish they like was actually put in front of them. */
  | 'delight'
  /** A dish they do not eat was actually put in front of them. */
  | 'taboo'
  /** They sat somewhere that suits them. */
  | 'good_seat'
  /** They sat somewhere that does not, or sat crowded. */
  | 'bad_seat'
  /** They shared a room with a culture they rub against. */
  | 'seating_friction'
  /** They were served properly. */
  | 'well_served'
  /** They waited and left. */
  | 'turned_away'
  /** Their observance was kept. */
  | 'observance_honoured'
  /** Their observance was ignored. */
  | 'observance_ignored'
  /** The house made it right. */
  | 'amends'

export type CultureEvidenceEntry = {
  id: string
  cultureId: string
  onDay: number
  kind: CultureEvidenceKind
  /** 1..40, decays with age. Positive kinds count up, negative kinds count down. */
  weight: number
  readable: string
  /** The recipe, area or other culture this is about, when it is about one. */
  subjectId?: string
  tags: string[]
}

/** §8.2 accommodation history — what the house has actually done for them. */
export type CultureAccommodationEntry = {
  onDay: number
  /** `honoured_observance` | `made_amends` | `ignored_observance` | `served_taboo` */
  kind: string
  readable: string
  /** True when the house accommodated them; false when it did the opposite. */
  accommodated: boolean
}

/**
 * A misunderstanding that is live until it is put right.
 *
 * §8.2 asks for "misunderstanding and reconciliation", which needs the
 * misunderstanding to be a THING with a life rather than a memory that
 * decays: it has a cause you can name, a way to fix it, and an expiry if
 * nobody does. Reconciling one is what `make_amends_to_culture` buys.
 */
export type CultureMisunderstanding = {
  id: string
  cultureId: string
  openedOnDay: number
  expiresOnDay: number
  /** What caused it, in the culture's own terms. */
  reason: string
  /** What would put it right, named so the player can discover it. */
  remedy: string
  /** Evidence kind that opened it. */
  cause: CultureEvidenceKind
  status: 'live' | 'reconciled' | 'faded'
  closedOnDay?: number
}

/** Friction between two cultures, earned by actually sharing a room. */
export type CultureFrictionState = {
  /** `${a}|${b}` with the two ids sorted, so the pair has one key. */
  id: string
  cultureA: string
  cultureB: string
  /** 0..100. Rises when they share a room badly, falls when they do not. */
  level: number
  /** Days they have actually been seated together. */
  sharedDays: number
  lastSharedOnDay: number
  /** The area it keeps happening in, when there is one. */
  areaId?: string
}

/** A culture's live observance of something on the calendar. */
export type CultureObservance = {
  cultureId: string
  tag: string
  startedOnDay: number
  /** Set once the day resolves: did the house keep it? */
  honoured?: boolean
}

export type CultureStanding = {
  cultureId: string
  /** Bounded, decaying evidence. The thing every meter is derived from. */
  evidence: CultureEvidenceEntry[]
  /** -100..100, derived from `evidence` each day. */
  net: number
  /** §8.2 accommodation history. Bounded. */
  accommodations: CultureAccommodationEntry[]
  /**
   * What they have actually been served, by recipe.
   *
   * This is the record that makes §8.2's "food taboo and delight must depend
   * on what was actually served or offered" checkable: a count of servings
   * that reached this culture's tables, not a scan of the cellar.
   */
  dishExperience: Record<string, { served: number; delight: number; taboo: number }>
  /** Where they have actually sat. */
  areaExperience: Record<string, { seated: number; good: number; bad: number }>
  /** §8.2 preference shift — tags they have come to like or avoid here. */
  learnedPreferences: string[]
  learnedDislikes: string[]
  lastUpdatedOnDay: number
}

export type CultureTotals = {
  dishesServed: number
  taboosServed: number
  delightsServed: number
  seatingFrictionDays: number
  observancesHonoured: number
  observancesIgnored: number
  misunderstandingsOpened: number
  misunderstandingsReconciled: number
  misunderstandingsFaded: number
  amendsMade: number
  preferenceShifts: number
  recommendationsMade: number
}

export type CultureModuleState = {
  standing: Record<string, CultureStanding>
  /** Live and recently-closed misunderstandings, keyed by id. Pruned. */
  misunderstandings: Record<string, CultureMisunderstanding>
  /** Culture-to-culture friction, keyed by the sorted pair. */
  friction: Record<string, CultureFrictionState>
  /** Observances running today. Rebuilt each day. */
  observances: CultureObservance[]
  /** What the cultures noticed today. Rebuilt each day; read by the report. */
  evidenceToday: CultureEvidenceEntry[]
  totals: CultureTotals
}
