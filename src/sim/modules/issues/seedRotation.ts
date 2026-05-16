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
