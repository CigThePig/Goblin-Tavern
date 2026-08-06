import type { SimContext } from '../../core/context'
import type { TavernState } from '../../state/TavernState'
import {
  ensureRequiredFactionsRegistered,
  factionRegistry,
} from '../../content/factions/factionRegistry'
import {
  activeArcsByTypeOrTag,
  hasCalendarTag,
  ownerPolicies,
  ownerProjects,
} from '../pressures/calculators/expandedHelpers'

import { noteStanding } from './standing'
import { amountOwedToMembers } from './factionActors'

// Expansion Phase 8 §8.1 — what the factions NOTICED today.
//
// Phase 30 and Phase 52 wired six triggers that read live signals and moved
// a relationship meter by one point each. The signals were well chosen —
// violence for the watch, debt for the guild, festival engagement for the
// shrine, waste for the haulers — and they survive this phase unchanged.
// What changes is what they produce: an entry in the faction's standing
// ledger, dated and readable and decaying, instead of an anonymous ±1.
//
// The meter still moves; `summariseStanding` moves it. The difference is
// that it now moves for a reason you can name, which is what makes
// `appeal_to_faction` possible at all — you cannot argue with a threshold.

const VIOLENCE_THRESHOLD = 60
const DEBT_THRESHOLD = 60
const MINERS_SAT_THRESHOLD = 60
const MAINTENANCE_THRESHOLD = 60
const MAINTENANCE_RELIEF_THRESHOLD = 40

/** Only factions that exist in the world can notice anything. */
function present(state: TavernState, id: string): boolean {
  return state.world.factions[id] !== undefined
}

export function observeFactionTreatment(ctx: SimContext): void {
  ensureRequiredFactionsRegistered()
  const state = ctx.state
  const violence = state.pressures['violence']?.value ?? 0
  const debt = state.pressures['debt']?.value ?? 0
  const stockShortage = state.pressures['stock_shortage']?.value ?? 0
  const maintenance = state.pressures['maintenance']?.value ?? 0
  const pests = state.pressures['pests']?.value ?? 0

  if (violence >= VIOLENCE_THRESHOLD && present(state, 'town_watch')) {
    noteStanding(ctx, {
      factionId: 'town_watch',
      id: 'violence_high',
      kind: 'grievance',
      weight: Math.min(20, Math.round(violence / 6)),
      readable: `The watch have heard about the trouble in here (violence ${Math.round(violence)}).`,
      tags: ['violence', 'order'],
    })
  }

  if (debt >= DEBT_THRESHOLD && present(state, 'brewers_guild')) {
    noteStanding(ctx, {
      factionId: 'brewers_guild',
      id: 'debt_high',
      kind: 'grievance',
      weight: Math.min(20, Math.round(debt / 6)),
      readable: `The guild know the house is carrying debt (debt ${Math.round(debt)}).`,
      tags: ['debt'],
    })
  }

  if (stockShortage >= DEBT_THRESHOLD && present(state, 'market_caravan_circle')) {
    noteStanding(ctx, {
      factionId: 'market_caravan_circle',
      id: 'supplier_strain',
      kind: 'grievance',
      weight: Math.min(16, Math.round(stockShortage / 8)),
      readable: 'The caravans say the house never has what it needs in.',
      tags: ['supplier_strain'],
    })
  }

  // Miners' Union rises when miners are happy, especially on payday.
  const miners = state.customerGroups['miners']
  if (
    miners &&
    present(state, 'miners_union') &&
    miners.satisfaction >= MINERS_SAT_THRESHOLD &&
    ctx.getDayType() === 'payday'
  ) {
    noteStanding(ctx, {
      factionId: 'miners_union',
      id: 'miners_payday_satisfied',
      kind: 'favour',
      weight: 10,
      readable: `The crews were looked after on payday (satisfaction ${miners.satisfaction}).`,
      tags: ['payday', 'miners'],
    })
  }

  // The shrine watches what the house does with a festival window.
  const festivalActive =
    hasCalendarTag(state, 'festival_window') ||
    hasCalendarTag(state, 'mushroom_festival')
  if (festivalActive && present(state, 'local_shrine')) {
    const festivalArcs = activeArcsByTypeOrTag(state, {
      types: ['festival'],
      tags: ['festival'],
    })
    let engaged = festivalArcs.length > 0
    if (!engaged) {
      for (const project of Object.values(ownerProjects(state))) {
        if (
          project.status === 'active' &&
          (project.tags.includes('festival') || project.tags.includes('festival_prep'))
        ) {
          engaged = true
          break
        }
      }
    }
    if (engaged) {
      noteStanding(ctx, {
        factionId: 'local_shrine',
        id: 'festival_engagement',
        kind: 'favour',
        weight: 8,
        readable: 'The house kept the festival with them.',
        tags: ['festival', 'ritual'],
      })
    } else {
      noteStanding(ctx, {
        factionId: 'local_shrine',
        id: 'festival_disregard',
        kind: 'grievance',
        weight: 8,
        readable: 'The house ignored the festival.',
        tags: ['festival', 'ritual'],
      })
    }
  }

  // The haulers read the state of the yard.
  if (present(state, 'scrap_collectors')) {
    if (maintenance >= MAINTENANCE_THRESHOLD || pests >= MAINTENANCE_THRESHOLD) {
      noteStanding(ctx, {
        factionId: 'scrap_collectors',
        id: 'waste_buildup',
        kind: 'grievance',
        weight: Math.min(16, Math.round(Math.max(maintenance, pests) / 8)),
        readable: 'The haulers say the waste is piling up.',
        tags: ['maintenance', 'pests'],
      })
    } else if (
      maintenance < MAINTENANCE_RELIEF_THRESHOLD &&
      (ctx.hasMemory('area_cleaned_recently') ||
        ctx.hasMemory('cellar_fumigated_recently'))
    ) {
      noteStanding(ctx, {
        factionId: 'scrap_collectors',
        id: 'recent_cleanup_credit',
        kind: 'favour',
        weight: 8,
        readable: 'The haulers noticed the place was cleaned up.',
        tags: ['maintenance', 'cleanliness'],
      })
    }
  }

  // Money actually owed to a faction's own suppliers is the sharpest
  // grievance there is, because it is a fact rather than a reading.
  for (const def of factionRegistry.all()) {
    if (!present(state, def.id)) continue
    const owed = amountOwedToMembers(state, def.id)
    if (owed <= 0) continue
    noteStanding(ctx, {
      factionId: def.id,
      id: 'members_unpaid',
      kind: 'grievance',
      weight: Math.min(30, 8 + Math.round(owed / 10)),
      readable: `${def.label} say the house is ${owed} coin behind with their people.`,
      tags: ['debt', 'invoice'],
    })
  }

  // Policies the faction has an opinion about. A house rule is a standing
  // statement of whose side you are on, so it reads as treatment.
  const policies = ownerPolicies(state)
  for (const def of factionRegistry.all()) {
    if (!present(state, def.id)) continue
    for (const [policyId, policy] of Object.entries(policies)) {
      if (!policy.enabled) continue
      if (def.likedPolicies.includes(policyId)) {
        noteStanding(ctx, {
          factionId: def.id,
          id: `policy_liked_${policyId}`,
          kind: 'favour',
          weight: 5,
          readable: `${def.label} approve of the house rule '${policy.label}'.`,
          tags: ['policy', policyId],
        })
      } else if (def.dislikedPolicies.includes(policyId)) {
        noteStanding(ctx, {
          factionId: def.id,
          id: `policy_disliked_${policyId}`,
          kind: 'grievance',
          weight: 6,
          readable: `${def.label} object to the house rule '${policy.label}'.`,
          tags: ['policy', policyId],
        })
      }
    }
  }
}
