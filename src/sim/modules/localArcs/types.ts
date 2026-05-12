import type { LocalArcEffect, LocalArcStage } from '../../content/events/localArcTypes'

// Phase 35 §35.3 — Local arcs module state shape.
//
// Arc instances themselves live on `state.world.localEvents` (the
// Phase 25 container, extended additively in Phase 35). The module
// slice tracks engine bookkeeping:
//
//   - `lastMonthlyTickDay` so the monthly hook is idempotent if the
//     same finalized month is re-entered (it should not be, but the
//     guard mirrors `monthlyModule.monthFinalized`).
//   - `activeArcIds` lets reports and other modules walk active arcs
//     without re-scanning `state.world.localEvents` and filtering by
//     stage.
//   - `activeArcTags` / `activeIssueSeedTags` / `activeMarketConditionIds`
//     hold tags accumulated from every active arc's effect list, ready
//     for downstream consumption (issue seeds in Phase 39, market
//     pricing in Phase 29, etc.). These are derived data, refreshed
//     each tick.
//   - `cooldowns` maps a definition id to the day after which an arc
//     of that definition may seed again. Stored so that resolved arc
//     records (which stay on `state.world.localEvents`) don't need to
//     re-derive the cooldown threshold on every read.

export const LOCAL_ARCS_MODULE_ID = 'localArcs'

export type LocalArcsAppliedEffectRecord = {
  arcId: string
  day: number
  effect: LocalArcEffect
  appliedAtStage: LocalArcStage
}

export type LocalArcsModuleState = {
  lastMonthlyTickDay: number
  activeArcIds: string[]
  activeArcTags: string[]
  activeIssueSeedTags: string[]
  activeMarketConditionIds: string[]
  cooldowns: Record<string, number>
  /**
   * Trace of effects applied during the most recent monthly tick — used
   * by reports and tests. Bounded to one tick's worth of records so the
   * slice never grows without bound.
   */
  recentlyAppliedEffects: LocalArcsAppliedEffectRecord[]
  /**
   * Calendar tags observed at least once since the last monthly seeding
   * pass. The daily `localEventUpdate` hook unions today's
   * `state.calendar.tags` into this list; the `endMonth` hook reads it
   * to evaluate `calendar_tag` start conditions and then clears it.
   * Without this history, arcs gated on tags that never appear on day
   * 28 (e.g. `miner_payday`, `festival_window`) would be unreachable
   * via the monthly seeding pass.
   */
  monthlyCalendarTagsSeen: string[]
}
