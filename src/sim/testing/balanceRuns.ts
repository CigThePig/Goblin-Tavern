import type { TavernState } from '../state/TavernState'
import { runCardlessSim, type CardlessRunResult } from './simRunner'
import {
  PHASE_20_POLICY_BOTS,
  getPolicyBot,
  type PolicyBot,
  type PolicyBotId,
} from './policyBots'

// Phase 20 §20.11 — Strategy comparison runs (and adjacent balance
// harness). Spin every required policy bot through a fixed run length
// and let `summarizeRun` / coverage / contradiction layers compare the
// outcomes.
//
// The point is not balance perfection. The point is *distinct outcomes*:
// the clean-focused world should not look like the profit-focused one,
// and a strategy-comparison report should make those differences
// legible.

export type StrategyRunSpec = {
  botId: PolicyBotId
  days: number
  seed?: string
}

export function runStrategy(
  spec: StrategyRunSpec,
  initialState?: TavernState,
): { bot: PolicyBot; run: CardlessRunResult } {
  const bot = getPolicyBot(spec.botId)
  const seed = spec.seed ?? `phase20-strategy-${spec.botId}`
  const run = runCardlessSim({
    seed,
    days: spec.days,
    ...(initialState !== undefined ? { initialState } : {}),
    chooseInput(state) {
      return {
        ownerActions: [...bot.chooseActions(state)],
        ...(bot.chooseStaffPriorities
          ? { staffPriorities: bot.chooseStaffPriorities(state) }
          : {}),
      }
    },
  })
  return { bot, run }
}

export type StrategyComparisonRun = {
  botId: PolicyBotId
  run: CardlessRunResult
}

/** Run every active strategy policy bot (Phase 20 §20.3). The
 *  no-op `manual_debug` mode is excluded so the matrix only contains
 *  bots that actually try a strategy. */
export function runStrategyMatrix(
  days: number,
  initialState?: TavernState,
): StrategyComparisonRun[] {
  const bots = PHASE_20_POLICY_BOTS.filter((b) => b.id !== 'manual_debug')
  return bots.map((bot) => {
    const result = runStrategy({ botId: bot.id, days }, initialState)
    return { botId: bot.id, run: result.run }
  })
}
