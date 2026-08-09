import type { ActorState } from '../../contracts/actors/index'

// Expansion Phase 9 §9.1 — the rival tavern stops being a summary.
//
// WHAT WAS THERE. `modules.monthly.rivalTavern` held three numbers —
// `pressure`, `appeal`, `strategy` — and `resolveRivalTavern` moved the
// first two once a month by reading six thresholds off the house's own
// state. `strategy` was never written by anything at all. That is a weather
// system, not a competitor: it had no position it had chosen, nobody
// working for it, nothing it wanted, and no way for the player to do
// anything about it except improve their own numbers.
//
// WHAT THIS IS. One record per rival house, carrying the things §9.1 says a
// rival must be able to do something about: a market position it picked, a
// capability it can invest in, a purse it spends, the customer groups it is
// actively courting, the factions backing it, the setbacks it is currently
// digging out of, and an `ActorState` so its moves go through the same
// deterministic decide → announce → act procedure as a faction's.
//
// `appeal` is deliberately NOT a field. It is derived per customer group in
// `appeal.ts` from what the rival has actually done, compared against what
// the house has actually done, because a stored appeal meter is the exact
// thing §9.1 asks to replace.

/** What kind of house the rival has decided to be. */
export type RivalMarketPosition =
  | 'unknown'
  | 'cheap'
  | 'clean'
  | 'rowdy'
  | 'fancy'

/** What the rival's kitchen and cellar lead with. */
export type RivalMenuFocus = 'rounds' | 'food' | 'spectacle' | 'comfort'

/**
 * The four things the rival can invest in, 0..100.
 *
 * `priceLevel` is the odd one out: 50 is the going rate, low undercuts the
 * house and high asks for more in exchange for something. It is a POSITION
 * rather than a quality, so more is not better.
 */
export type RivalCapability = {
  staffing: number
  quality: number
  priceLevel: number
  reach: number
}

export type RivalSetbackKind =
  | 'staff_poached'
  | 'supply_failure'
  | 'rumour_exposed'
  | 'watch_trouble'
  | 'backing_withdrawn'

/**
 * Something that went wrong for the rival, and that it has to spend a move
 * getting out of. §9.1's "recover from its own setbacks" is this record plus
 * the `recover_setback` action — without a record there is nothing to
 * recover FROM, and the requirement collapses into a number going back up.
 */
export type RivalSetback = {
  id: string
  kind: RivalSetbackKind
  /** 1..100. How much of the rival's capability it is currently costing. */
  severity: number
  openedOnDay: number
  /** Set when the rival has dug itself out. Kept briefly for the report. */
  recoveredOnDay?: number
  readable: string
}

/** How hard the rival is working one customer group. */
export type RivalCourting = {
  groupId: string
  /** 0..100. Decays daily; a courted group has to be re-courted. */
  effort: number
  startedOnDay: number
  lastPushedDay: number
  /**
   * True when the campaign came from `exploit_weakness` rather than
   * ordinary courting — a targeted run at a group the house has actually
   * failed, which lands harder and is remembered as such.
   */
  poaching: boolean
  reason: string
}

export type RivalRecord = {
  id: string
  /** Generated once at creation from a named stream, then reused (rule 8). */
  name: string
  actor: ActorState
  position: RivalMarketPosition
  positionSinceDay: number
  menuFocus: RivalMenuFocus
  capability: RivalCapability
  /** Coin the rival has to spend on its own moves. Earned from its trade. */
  purse: number
  courting: Record<string, RivalCourting>
  /** Factions currently backing it, mirrored from their own stances. */
  backingFactionIds: string[]
  setbacks: RivalSetback[]
  /** Set while a settlement pact holds. Blocks every hostile move. */
  truceUntilDay?: number
  /** Day the house last scouted it. Drives how much the report may say. */
  scoutedOnDay?: number
}

export type RivalMoveEntry = {
  onDay: number
  rivalId: string
  actionId: string
  goalId: string
  targetId?: string
  result: 'succeeded' | 'failed' | 'partial'
  readable: string
}

export type RivalTotals = {
  movesMade: number
  positionsChosen: number
  staffRecruited: number
  priceShifts: number
  groupsCourted: number
  backingsSought: number
  rumoursSpread: number
  rumoursAnswered: number
  weaknessesExploited: number
  setbacksOpened: number
  setbacksRecovered: number
  trucesAgreed: number
  trucesBroken: number
}

export type RivalModuleState = {
  rivals: Record<string, RivalRecord>
  moveHistory: RivalMoveEntry[]
  movesToday: RivalMoveEntry[]
  totals: RivalTotals
}
