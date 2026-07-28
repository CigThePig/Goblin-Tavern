import type { SimContext } from '../../core/context'
import type { TavernState } from '../../state/TavernState'

// Phase 64 / ISSUE-024 — Shared picker-rotation primitive.
//
// Extracted from `expandedSeedGenerators.ts` so the core seed
// generators (food_safety, stock_shortage, maintenance) can rotate
// across their candidate vectors without re-implementing the same
// recency tracking. Originally introduced in Phase 40 audit pass 1
// to stop the same slow-moving entity (worst-loyalty staff, dirtiest
// area, lowest-relationship faction) from winning the per-family
// argmax every day.

export const RECENCY_WINDOW_DAYS = 5
export const RECENCY_PENALTY = 25

export function recencyPenalty(
  state: TavernState,
  family: string,
  entityKey: string,
  today: number,
): number {
  const slice = state.modules.issueSeeds as
    | { recentPicks?: Record<string, Record<string, number>> }
    | undefined
  const familyPicks = slice?.recentPicks?.[family] ?? {}
  const lastDay = familyPicks[entityKey]
  if (lastDay === undefined) return 0
  if (today - lastDay >= RECENCY_WINDOW_DAYS) return 0
  return RECENCY_PENALTY
}

/**
 * Phase 206 / audit Wave 7 — a rotation turn only counts when the player
 * actually SAW the seed.
 *
 * Generators call `recordPick` while generating, but Wave 6's family
 * cooldown and full-day hand budget can rest or withhold the generated
 * seed afterwards. The pick was still recorded, so an invisible day
 * consumed the entity's rotation turn: on the Phase 56 violence route,
 * the ledger rotated ogres → adventurers → miners exactly as designed
 * while every seed the player actually saw was the ogres one — the
 * non-ogres turns were all spent on rested days. This reconciles a
 * family's picks against what surfaced: an entry recorded TODAY whose
 * entity did not surface in that family today is dropped, so the entity
 * keeps its turn for the next visible day.
 *
 * Note the same at-generation `recordPick` pattern exists in other
 * rotating families (food_safety, stock_shortage, maintenance,
 * staff_identity, …) whose key formats are family-private; the queue's
 * Wave 7 section records that as follow-up. Violence is reconciled now
 * because its rotation is a shipped finding gate (ISSUE-016).
 */
export function reconcilePicksWithSurfaced(
  recentPicks: Record<string, Record<string, number>> | undefined,
  family: string,
  surfacedEntityKeys: ReadonlySet<string>,
  today: number,
): Record<string, Record<string, number>> | undefined {
  const familyPicks = recentPicks?.[family]
  if (!recentPicks || !familyPicks) return recentPicks
  const kept: Record<string, number> = {}
  let changed = false
  for (const [entityKey, day] of Object.entries(familyPicks)) {
    if (day === today && !surfacedEntityKeys.has(entityKey)) {
      changed = true
      continue
    }
    kept[entityKey] = day
  }
  if (!changed) return recentPicks
  return { ...recentPicks, [family]: kept }
}

export function recordPick(
  ctx: SimContext,
  family: string,
  entityKey: string,
): void {
  const today = ctx.state.calendar.totalDaysElapsed
  ctx.modifyModuleState(
    'issueSeeds',
    (current) => {
      const slice = (current ?? {}) as {
        recentPicks?: Record<string, Record<string, number>>
      } & Record<string, unknown>
      const recent = { ...(slice.recentPicks ?? {}) }
      recent[family] = { ...(recent[family] ?? {}), [entityKey]: today }
      return { ...slice, recentPicks: recent } as never
    },
    { source: 'seedRotation.recordPick' },
  )
}
