// Phase 203 / gameplay audit Wave 4 — the store/surface half of the wave.
//
// Plan: docs/plans/phase-203-audit-wave-4-action-reachability.md.
//
//   P5-PLAY-001  after-Service planning says "today", queues tomorrow
//   P7-EXP-006   the planner handoff discards the problem's target
//   P3-BHV-001   the inline policy toggle never reaches the queue
//   P3-BHV-002   a fully specified commission is refused by the queue
//   P6-COMP-005  the owner-time selection gate
//
// The sim-side halves are in
// tests/sim/phase203.wave4.actionReachability.test.ts.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { gameStore } from '../../web/src/lib/sim/gameStore.svelte'
import {
  setStorageForTesting,
  type StorageLike,
} from '../../web/src/lib/sim/persistence'
import { suggestActions } from '../../web/src/lib/sim/suggestActions'
import { planActionCtaForPath } from '../../web/src/lib/sim/planActionCta'
import {
  committedOwnerTimeCost,
  gateChoicesByTime,
} from '../../web/src/lib/cards/affordability'
import { sanitizePicks } from '../../web/src/lib/sim/actionBuilder'
import { actionRegistry } from '../../src/sim/registries/actionRegistry'
import { COMMISSION_EXPEDITION_ACTION_ID } from '../../src/sim/modules/expeditions/commissionExpedition'
import {
  DAY_MINUTES,
  TIME_COST_SHORT,
} from '../../src/sim/modules/ownerActions/stateHelpers'
import { buildDailyReport } from '../../src/reports/dailyReportProjection'
import type { DailyReportData } from '../../src/reports/types'
import type { IssueSeed } from '../../src/sim/modules/issues/issueSeedTypes'
import type { CardView } from '../../web/src/lib/cards/types'

const SEED = 'phase203-wave4-web'

function memoryStorage(): StorageLike {
  const map = new Map<string, string>()
  return {
    getItem: (k) => (map.has(k) ? map.get(k)! : null),
    setItem: (k, v) => {
      map.set(k, v)
    },
    removeItem: (k) => {
      map.delete(k)
    },
  }
}

beforeEach(() => {
  setStorageForTesting(memoryStorage())
  gameStore.reset(SEED)
})

afterEach(() => {
  setStorageForTesting(undefined)
})

// ── P5-PLAY-001 — the planner names the day it plans ────────────────

describe('P5-PLAY-001 — the queue says which day it runs on', () => {
  it('plans today before Segment B and tomorrow after it', () => {
    // Between days ('C'): the next thing to run is tomorrow's Segment B.
    expect(gameStore.segment).toBe('C')
    expect(gameStore.planningHorizon).toBe('tomorrow')

    gameStore.beginDay()
    expect(gameStore.segment).toBe('A')
    // Morning and plan beats: Segment B is still ahead, so picks are today's.
    expect(gameStore.planningHorizon).toBe('today')
    gameStore.setBeat('plan')
    expect(gameStore.planningHorizon).toBe('today')

    gameStore.runService()
    // The audit's exact moment: Service and Closing showed "6h left today"
    // while the queue was already spending tomorrow.
    gameStore.setBeat('service')
    expect(gameStore.planningHorizon).toBe('tomorrow')
    gameStore.setBeat('closing')
    expect(gameStore.planningHorizon).toBe('tomorrow')

    gameStore.endDay()
    expect(gameStore.planningHorizon).toBe('tomorrow')
  })

  it('is a fact about the queue, so it survives a reload', () => {
    gameStore.beginDay()
    gameStore.runService()
    gameStore.setBeat('closing')
    expect(gameStore.planningHorizon).toBe('tomorrow')

    const save = gameStore.serializeForSave()
    gameStore.reset(SEED)
    expect(gameStore.planningHorizon).toBe('tomorrow') // fresh 'C'
    gameStore.hydrateFromSave(save as never)
    expect(gameStore.segment).toBe('B')
    expect(gameStore.planningHorizon).toBe('tomorrow')
  })

  it('carries a pick queued after Service into the next day, once', () => {
    gameStore.beginDay()
    gameStore.runService()
    gameStore.setBeat('closing')

    const queued = gameStore.tryAddPick({
      actionId: 'buy_mugs',
      label: 'Buy Mugs',
      category: 'immediate',
      targetType: 'stock',
      targetId: 'mugs',
      targetLabel: 'Mugs',
      timeCost: 30,
    })
    expect(queued.ok).toBe(true)

    gameStore.endDay()
    // Not applied on the day that just closed.
    const closedSlice = gameStore.state.modules['ownerActions'] as {
      applied?: { actionId: string }[]
    }
    expect(
      (closedSlice.applied ?? []).some((a) => a.actionId === 'buy_mugs'),
    ).toBe(false)
    expect(gameStore.picks.length).toBe(1)

    gameStore.beginDay()
    gameStore.runService()
    const nextSlice = gameStore.state.modules['ownerActions'] as {
      applied?: { actionId: string }[]
    }
    expect(
      (nextSlice.applied ?? []).filter((a) => a.actionId === 'buy_mugs').length,
    ).toBe(1)
    // Consumed, not carried again.
    expect(gameStore.picks.length).toBe(0)
  })
})

// ── P3-BHV-001 — the inline policy control queues ───────────────────

describe('P3-BHV-001 — a policy pick carries its policy', () => {
  it('queues with a target and rejects without one', () => {
    gameStore.beginDay()
    // The inline control's payload before this wave: no `targetId`.
    const bare = gameStore.tryAddPick({
      actionId: 'enable_allow_tabs_for_regulars',
      label: 'Enable Allow Tabs for Regulars',
      category: 'policy',
      targetType: 'policy',
      timeCost: 30,
    })
    expect(bare.ok).toBe(false)
    expect(bare.ok === false && bare.reason).toBe('no target')

    // The payload the fixed control builds.
    const targeted = gameStore.tryAddPick({
      actionId: 'enable_allow_tabs_for_regulars',
      label: 'Enable Allow Tabs for Regulars',
      category: 'policy',
      targetType: 'policy',
      targetId: 'allow_tabs_for_regulars',
      targetLabel: 'Allow Tabs for Regulars',
      timeCost: 30,
    })
    expect(targeted.ok).toBe(true)
    expect(
      gameStore.isQueued(
        'enable_allow_tabs_for_regulars',
        'allow_tabs_for_regulars',
      ),
    ).toBe(true)

    // …and it reaches Segment B.
    gameStore.runService()
    const slice = gameStore.state.modules['ownerActions'] as {
      policies?: Record<string, { enabled?: boolean }>
    }
    expect(slice.policies?.['allow_tabs_for_regulars']?.enabled).toBe(true)
  })

  it('keeps two policy rows independent in the queue', () => {
    gameStore.beginDay()
    gameStore.tryAddPick({
      actionId: 'enable_ban_weapons_inside',
      label: 'Enable Ban Weapons Inside',
      category: 'policy',
      targetType: 'policy',
      targetId: 'ban_weapons_inside',
      targetLabel: 'Ban Weapons Inside',
      timeCost: 30,
    })
    gameStore.tryAddPick({
      actionId: 'enable_water_ale_quietly',
      label: 'Enable Water Ale Quietly',
      category: 'policy',
      targetType: 'policy',
      targetId: 'water_ale_quietly',
      targetLabel: 'Water Ale Quietly',
      timeCost: 30,
    })
    gameStore.removePicksFor('enable_ban_weapons_inside', 'ban_weapons_inside')
    expect(gameStore.isQueued('enable_ban_weapons_inside', 'ban_weapons_inside')).toBe(
      false,
    )
    expect(gameStore.isQueued('enable_water_ale_quietly', 'water_ale_quietly')).toBe(
      true,
    )
  })
})

// ── P3-BHV-002 — the commission queues and routes ───────────────────

describe('P3-BHV-002 — a completed commission reaches the queue', () => {
  it('accepts the sheet payload and rejects an unfilled one', () => {
    gameStore.beginDay()
    const runnerId = Object.values(gameStore.state.world.hireableAdventurers)
      .find((a) => a.currentExpeditionId === null && !a.activeFlags.includes('injured'))!
      .id

    // Before the wave this failed with "requires a runner targetId" even
    // though the runner is right there in the payload: `tryAddPick` asked
    // the definition-shaped question about a global-typed action.
    const ok = gameStore.tryAddPick({
      actionId: COMMISSION_EXPEDITION_ACTION_ID,
      label: 'Commission Expedition',
      category: 'immediate',
      targetType: 'global',
      targetId: runnerId,
      targetLabel: 'A Runner',
      timeCost: actionRegistry.get(COMMISSION_EXPEDITION_ACTION_ID).timeCost,
      options: { mode: 'open', daysTotal: 2, targetTier: 'uncommon' },
    })
    expect(ok.ok).toBe(true)

    const bad = gameStore.tryAddPick({
      actionId: COMMISSION_EXPEDITION_ACTION_ID,
      label: 'Commission Expedition',
      category: 'immediate',
      targetType: 'global',
      timeCost: actionRegistry.get(COMMISSION_EXPEDITION_ACTION_ID).timeCost,
    })
    expect(bad.ok).toBe(false)
  })

  it('routes a composer request to the panel that hosts the form', () => {
    gameStore.requestComposer('expedition')
    expect(gameStore.route).toBe('tavern')
    expect(gameStore.tavernSubview).toBe('stock')
    // Consume-once, and only by the panel that owns it.
    expect(gameStore.consumeComposerRequest('something-else')).toBe(false)
    expect(gameStore.consumeComposerRequest('expedition')).toBe(true)
    expect(gameStore.consumeComposerRequest('expedition')).toBe(false)
  })
})

// ── P7-EXP-006 — the contextual target survives the handoff ─────────

describe('P7-EXP-006 — a suggestion and a CTA keep their target', () => {
  /** Yesterday's report shaped as two stock losses. */
  function reportWithLosses(items: string[]): DailyReportData {
    const base = {
      groupedDiffs: {
        stock: items.map((id) => ({
          path: `stock.${id}.quantity`,
          direction: 'loss' as const,
          delta: -4,
        })),
      },
    }
    return base as unknown as DailyReportData
  }

  it('names the lost item on the suggestion', () => {
    const suggestions = suggestActions(
      gameStore.state,
      [],
      reportWithLosses(['ale']),
    )
    const restock = suggestions.find((s) => s.action.id === 'restock_item')
    expect(restock).toBeDefined()
    // The audit's failure: the item was in the prose and nowhere else, so
    // tapping the row opened all twenty stock targets.
    expect(restock!.targetId).toBe('ale')
    expect(restock!.targetLabel).toBe(gameStore.state.stock['ale']!.label)
  })

  it('offers one suggestion per shortage, not one per action', () => {
    const suggestions = suggestActions(
      gameStore.state,
      [],
      reportWithLosses(['ale', 'stew']),
    )
    const restocks = suggestions.filter((s) => s.action.id === 'restock_item')
    expect(restocks.map((s) => s.targetId).sort()).toEqual(['ale', 'stew'])
  })

  it('drops only the shortage the player already queued', () => {
    const suggestions = suggestActions(
      gameStore.state,
      [{ actionId: 'restock_item', targetId: 'ale' }],
      reportWithLosses(['ale', 'stew']),
    )
    const restocks = suggestions.filter((s) => s.action.id === 'restock_item')
    expect(restocks.map((s) => s.targetId)).toEqual(['stew'])
  })

  it('maps a stock drilldown path to the restock action on that item', () => {
    const cta = planActionCtaForPath('stock.ale.quantity', gameStore.state)
    expect(cta).toBeDefined()
    expect(cta!.preferredTargetId).toBe('ale')
    expect(cta!.preferredTargetLabel).toBe(gameStore.state.stock['ale']!.label)
    // An item that does not exist gets no CTA rather than a dead one.
    expect(
      planActionCtaForPath('stock.not_a_real_item.quantity', gameStore.state),
    ).toBeUndefined()
  })

  it('carries the preferred target and reason through the picker request', () => {
    gameStore.requestActionPicker({
      tab: 'immediate',
      preferredTargetId: 'ale',
      preferredTargetLabel: 'Ale',
      reason: 'Ale quantity',
    })
    const req = gameStore.consumeActionPickerRequest()
    expect(req?.preferredTargetId).toBe('ale')
    expect(req?.preferredTargetLabel).toBe('Ale')
    expect(req?.reason).toBe('Ale quantity')
    expect(gameStore.consumeActionPickerRequest()).toBeUndefined()
  })

  it('keeps the originating reason on the queued pick across a reload', () => {
    gameStore.beginDay()
    const queued = gameStore.tryAddPick({
      actionId: 'restock_item',
      label: 'Restock Item',
      category: 'immediate',
      targetType: 'stock',
      targetId: 'ale',
      targetLabel: 'Ale',
      timeCost: 60,
      contextReason: 'lost ale yesterday',
    })
    expect(queued.ok).toBe(true)
    expect(gameStore.picks[0]?.contextReason).toBe('lost ale yesterday')

    // The sanitiser is the reload boundary — the reason must not be
    // stripped there, or the chip loses its provenance on refresh.
    const { picks } = sanitizePicks(
      JSON.parse(JSON.stringify(gameStore.picks)),
      gameStore.state,
    )
    expect(picks[0]?.contextReason).toBe('lost ale yesterday')

    // …and the target it names is the one that actually runs.
    gameStore.runService()
    const slice = gameStore.state.modules['ownerActions'] as {
      applied?: { actionId: string; targetId?: string }[]
    }
    const applied = (slice.applied ?? []).find(
      (a) => a.actionId === 'restock_item',
    )
    expect(applied?.targetId).toBe('ale')
  })

  it('names the same item in the closed day report', () => {
    gameStore.beginDay()
    gameStore.tryAddPick({
      actionId: 'restock_item',
      label: 'Restock Item',
      category: 'immediate',
      targetType: 'stock',
      targetId: 'ale',
      targetLabel: 'Ale',
      timeCost: 60,
      contextReason: 'lost ale yesterday',
    })
    gameStore.runService()
    const result = gameStore.endDay()
    expect(result).toBeDefined()
    const report = buildDailyReport(
      result!,
      gameStore.closedDayState ?? gameStore.state,
      {
        ...(gameStore.previousCalendar
          ? { previousCalendar: gameStore.previousCalendar }
          : {}),
        dismissedMissedOpportunityIds: gameStore.dismissedMissedOpportunityIds,
      },
    )
    const text = JSON.stringify(report)
    expect(text).toContain(gameStore.state.stock['ale']!.label)
  })
})

// ── P6-COMP-005 — the owner-time gate at selection ──────────────────

describe('P6-COMP-005 — a choice the day has no hours for is disabled', () => {
  /** A seed whose one slot costs an hour of owner time. */
  function timedSeed(): IssueSeed {
    return {
      id: 'seed-owner-time',
      consequenceProfiles: [
        {
          id: 'invest',
          responseSlotId: 'invest',
          immediateEffects: [
            {
              kind: 'state_change',
              target: 'global.owner_time',
              amount: -TIME_COST_SHORT,
              readable: 'An hour goes into it',
              tags: ['time'],
            },
          ],
          delayedEffects: [],
          memories: [],
          futureHooks: [],
        },
      ],
    } as unknown as IssueSeed
  }

  const view = (): CardView =>
    ({ choices: [{ slotId: 'invest', label: 'Spend the hour' }] }) as CardView

  it('leaves the choice alone when the day has room', () => {
    const gated = gateChoicesByTime(view(), timedSeed(), {
      queuedMinutes: 0,
      committed: 0,
    })
    expect(gated.choices[0]?.disabledReason).toBeUndefined()
  })

  it('disables it, with the amount, when the queue has taken the day', () => {
    const gated = gateChoicesByTime(view(), timedSeed(), {
      queuedMinutes: DAY_MINUTES - 30,
      committed: 0,
    })
    // The audit's complaint was that the choice showed no time amount at
    // all; the refusal names both what it needs and what is left.
    expect(gated.choices[0]?.disabledReason).toContain('1h')
    expect(gated.choices[0]?.disabledReason).toContain('30m')
  })

  it('counts the day\'s other committed choices against the same budget', () => {
    const seed = timedSeed()
    const committed = committedOwnerTimeCost(
      [seed],
      { [seed.id]: { kind: 'choice', slotId: 'invest' } as never },
    )
    expect(committed).toBe(TIME_COST_SHORT)
    // Excluding the card's own pending choice, so re-opening a decision
    // does not disable the option the player already picked.
    expect(
      committedOwnerTimeCost(
        [seed],
        { [seed.id]: { kind: 'choice', slotId: 'invest' } as never },
        seed.id,
      ),
    ).toBe(0)
  })
})
