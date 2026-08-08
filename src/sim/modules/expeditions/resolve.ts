import type { SimContext } from '../../core/context'
import { stockRegistry } from '../../registries/stockRegistry'
import type {
  Expedition,
  ExpeditionOutcome,
  ExpeditionRecord,
  ExpeditionReturnedIngredient,
  ExpeditionTargetTier,
  HireableAdventurer,
  SocialRumourState,
} from '../../state/TavernState'
import { recordPressureAdjustment } from '../pressures/pressureModule'
import { applyRenownDrift } from '../service/renown'
import { addCoin, spendCoin } from '../stock/ledger'

import { journeyStream, routeFor, discoveriesFrom, tierForRun } from './journey'
import {
  bumpExpeditionTotal,
  noteDiscovery,
  writeExpeditionRun,
  type ExpeditionRun,
} from './runState'
import { resolveExpedition } from './state'

// Expansion Phase 9 §9.3 — what the house actually gets, and what it pays.
//
// The haul is no longer one roll standing in for a whole trip. It is a
// consequence of the journey that happened: WHERE they went (the route's
// yields and haul bonus), WHETHER THEY GOT THERE (a party recalled on the
// second day brings back nothing worth counting), and WHAT THEY DECIDED
// (staying to work a rich seam is worth half again; coming out of the dark
// is not).
//
// And they get paid on the terms they were hired on, which is the other half
// of §9.3's "contract and compensation terms". A flat fee is owed whatever
// came back. A share is owed only against a haul. A hazard bonus is cheap
// until the going was bad. `settled` on the terms is what stops a reload
// paying anybody twice.

const SOURCE = 'expeditions.resolve'

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)))
}

function pickIngredient(
  rng: { pick: <T>(items: T[]) => T },
  tier: ExpeditionTargetTier,
): string | null {
  const candidates: string[] = []
  for (const def of stockRegistry.all()) {
    if (def.defaultState.rarity === tier) candidates.push(def.id)
  }
  if (candidates.length === 0) return null
  return rng.pick(candidates.sort())
}

/**
 * The outcome, read off the journey rather than rolled for it.
 *
 * This is the §9.3 headline in one function: a trip's result is what
 * happened to it. Reaching the site and coming home with a full party is a
 * success; coming home early on somebody's orders is a recall, not a
 * failure; and a party that never made it is lost.
 */
export function outcomeFor(run: ExpeditionRun): ExpeditionOutcome {
  if (run.terminal === 'lost') return 'runner_lost'
  if (run.terminal === 'recalled') return 'recalled'
  if (run.terminal === 'retreated') return 'retreated'
  // A party that never got there brought nothing back — but only call it a
  // failure if nobody decided to turn them round. Somebody making a call is
  // its own outcome, which is why §9.3 lists retreat and recall apart from
  // failure.
  if (run.reachedSiteOnDay === undefined) {
    if (run.recalledOnDay !== undefined) return 'recalled'
    if (run.retreatedOnDay !== undefined) return 'retreated'
    return 'failure'
  }
  // They got there and found nothing. That is the honest meaning of
  // `failure` once the journey decides everything else: not that the road
  // beat them, but that the day they spent searching came up empty — which
  // is the term the party's own experience and specialty govern.
  if (run.foundAtSite === false) return 'failure'
  // A party that got there, worked, and walked home in one piece succeeded.
  // One that got there in a bad way brought back less than it went for.
  if (run.injuredRunnerIds.length >= run.partyRunnerIds.length) return 'partial'
  if (run.hazard >= 60 || run.hungryDays > 0) return 'partial'
  return 'success'
}

/** Did they get far enough to have anything to bring back? */
export function reachedTheSite(run: ExpeditionRun): boolean {
  return run.reachedSiteOnDay !== undefined
}

export function buildHaul(
  expedition: Expedition,
  run: ExpeditionRun,
  outcome: ExpeditionOutcome,
  atSite: boolean,
): ExpeditionReturnedIngredient[] {
  if (outcome === 'runner_lost') return []
  // Nothing was found, so there is nothing to carry home.
  if (outcome === 'failure') return []
  if (!atSite && outcome !== 'success' && outcome !== 'partial') return []
  const route = routeFor(run.routeId)
  if (!route) return []
  const rng = journeyStream(expedition.seed, expedition.id, 'haul', run.events.length)
  const tier = tierForRun(expedition, run)
  const ingredientId =
    expedition.mode === 'targeted' && expedition.targetIngredientId
      ? expedition.targetIngredientId
      : pickIngredient(rng, tier)
  if (!ingredientId || !stockRegistry.has(ingredientId)) return []

  const bonus = route.haulBonus * run.haulBonus
  let quantity: number
  let quality: number
  if (outcome === 'success') {
    quantity = Math.max(1, Math.round(rng.int(3, 5) * bonus))
    quality = clamp(rng.int(60, 90) + (run.morale - 50) / 5, 5, 100)
  } else if (outcome === 'partial') {
    quantity = Math.max(1, Math.round(rng.int(1, 2) * bonus))
    quality = clamp(rng.int(40, 65) + (run.morale - 50) / 5, 5, 100)
  } else {
    // Recalled or retreated FROM THE SITE — they had something in hand.
    if (!atSite) return []
    quantity = Math.max(1, Math.round(rng.int(1, 2) * bonus))
    quality = clamp(rng.int(35, 55), 5, 100)
  }
  return [{ ingredientId, quantity, quality }]
}

/**
 * Settle up.
 *
 * Returns what was actually paid, so the caller can report it. Nothing is
 * paid when the terms are already settled — the guard that makes this safe
 * to reach twice across a reload.
 */
export function settleTerms(
  ctx: SimContext,
  run: ExpeditionRun,
  outcome: ExpeditionOutcome,
  haulValue: number,
): number {
  if (run.terms.settled) return 0
  let owed = 0
  if (run.terms.kind === 'flat_fee') {
    // Owed whatever came back — that is what a flat fee IS.
    owed = run.terms.agreedCoin
  } else if (run.terms.kind === 'share_of_haul') {
    // Nothing to share means nothing owed. Cheap when it goes badly, and
    // that is the bet the runner took by accepting it.
    owed = Math.round((haulValue * run.terms.sharePercent) / 100)
  } else {
    // Hazard bonus: a small base, plus what the going actually cost them.
    owed =
      run.terms.agreedCoin +
      Math.round((run.hazard / 100) * run.terms.agreedCoin) +
      run.injuredRunnerIds.length * 15
  }
  // A party that never came back is not paid, but the road costs they ran up
  // in the house's name still landed.
  if (outcome === 'runner_lost') owed = 0

  const total = Math.max(0, owed + Math.round(run.roadCosts))
  const affordable = Math.min(total, Math.max(0, ctx.state.coin))
  const unpaid = Math.max(0, total - affordable)
  if (affordable > 0) {
    spendCoin(ctx, affordable, {
      category: 'other',
      source: `${SOURCE}.settle`,
      sourceType: 'system',
      target: 'coin',
      targetType: 'coin',
      amount: -affordable,
      readable: `Settled up for expedition ${run.expeditionId} (${run.terms.kind.replace(/_/g, ' ')}).`,
      tags: ['expedition', 'settlement', run.terms.kind],
      relatedSystems: ['expeditions'],
    })
  }
  writeExpeditionRun(
    ctx,
    run.expeditionId,
    (current) => ({
      ...current,
      terms: {
        ...current.terms,
        settled: true,
        settledCoin: affordable,
        unpaidCoin: unpaid,
      },
    }),
    'settled',
  )

  // WHAT THE TILL COULD NOT COVER DOES NOT EVAPORATE. `settled` marks the
  // reckoning as done so a reload cannot pay twice; it never meant the debt
  // was forgiven. Runners who came back and were not paid remember it — in
  // their own relationship, which is the field the commission form prices
  // and the roster reads — and the shortfall goes through the pressure
  // layer's adjustment channel so it hangs over the house rather than
  // vanishing. Without this a player could dodge an expensive share-of-haul
  // by spending the till down the day before the party walked in.
  if (unpaid > 0) {
    for (const memberId of run.partyRunnerIds) {
      const member = ctx.state.world.hireableAdventurers[memberId]
      if (!member) continue
      ctx.modifyHireableAdventurer(
        memberId,
        {
          relationship: Math.max(0, member.relationship - Math.min(25, unpaid)),
        },
        {
          source: `${SOURCE}.unpaid`,
          sourceType: 'system',
          readable: `${member.name.display} came back and was not paid in full.`,
          tags: ['expedition', 'unpaid', run.expeditionId, memberId],
          relatedActors: [{ kind: 'other', id: memberId }],
          relatedSystems: ['expeditions', 'adventurers'],
        },
      )
    }
    recordPressureAdjustment(
      ctx,
      'debt',
      Math.min(15, Math.round(unpaid / 3)),
      `${SOURCE}.unpaid`,
    )
    ctx.addCause({
      source: `${SOURCE}.unpaid`,
      sourceType: 'system',
      target: run.expeditionId,
      targetType: 'global',
      amount: unpaid,
      direction: 'increase',
      weight: 8,
      readable: `${unpaid} coin of what the party was owed went unpaid.`,
      tags: ['expedition', 'settlement', 'unpaid'],
      relatedSystems: ['expeditions', 'economy'],
    })
  }
  return affordable
}

/** Roughly what a haul is worth, for a share-of-haul settlement. */
export function haulValue(haul: ExpeditionReturnedIngredient[]): number {
  let value = 0
  for (const entry of haul) {
    if (!stockRegistry.has(entry.ingredientId)) continue
    const def = stockRegistry.get(entry.ingredientId)
    value += (def.defaultState.salePrice ?? 4) * entry.quantity
  }
  return Math.round(value)
}

/**
 * What the world makes of it.
 *
 * §9.3's "effects on stock, world actors, rumours, and future
 * opportunities". Stock and the runners are handled by the module; this is
 * the other two. A legendary haul or a lost party is talked about — through
 * the rumour layer, so §8.4 decides who hears it and whether they believe
 * it — and a trip that came back from somewhere new leaves the house knowing
 * a way it did not know before.
 */
export function applyWorldEffects(
  ctx: SimContext,
  run: ExpeditionRun,
  outcome: ExpeditionOutcome,
  haul: ExpeditionReturnedIngredient[],
  atSite: boolean,
): string[] {
  const route = routeFor(run.routeId)
  const today = ctx.state.calendar.totalDaysElapsed
  const notes: string[] = []
  if (!route) return notes

  // Talk.
  const worthTalkingAbout =
    outcome === 'runner_lost' ||
    (outcome === 'success' && route.yields.includes('legendary'))
  if (worthTalkingAbout) {
    const rumourId = `expedition_word_${run.expeditionId}`
    if (!ctx.state.world.socialRumours[rumourId]) {
      const rumour: SocialRumourState = {
        id: rumourId,
        label:
          outcome === 'runner_lost'
            ? `A party this house sent to ${route.label} did not come back.`
            : `This house brought something out of ${route.label}.`,
        strength: outcome === 'runner_lost' ? 45 : 40,
        // It happened. There is nothing partial about it.
        accuracy: 'true',
        firstHeardDay: today,
        lastSpreadDay: today,
        tags: ['expedition', outcome === 'runner_lost' ? 'loss' : 'renown', route.id],
        reach: 'public',
        involvedRefs: [{ kind: 'other', id: run.expeditionId }],
      }
      ctx.addSocialRumour(rumour, {
        source: `${SOURCE}.word`,
        sourceType: 'system',
        target: rumourId,
        targetType: 'rumour',
        amount: rumour.strength,
        readable: rumour.label,
        tags: ['expedition', 'rumour'],
        relatedSystems: ['expeditions', 'rumours'],
      })
      notes.push(rumour.label)
    }
  }

  // Future opportunities.
  for (const discovery of discoveriesFrom(run, route, atSite)) {
    if (noteDiscovery(ctx, discovery)) {
      writeExpeditionRun(
        ctx,
        run.expeditionId,
        (current) => ({
          ...current,
          discoveries: [...new Set([...current.discoveries, discovery])],
        }),
        'discovery',
      )
      notes.push(`They came back knowing ${discovery.replace(/_/g, ' ')}.`)
    }
  }

  void haul
  return notes
}

/** Renown, on the same terms as before but read off the route. */
export function applyRenown(
  ctx: SimContext,
  run: ExpeditionRun,
  leader: HireableAdventurer | undefined,
  outcome: ExpeditionOutcome,
): void {
  const route = routeFor(run.routeId)
  if (!route) return
  if (outcome === 'success') {
    const boost = route.yields.includes('legendary')
      ? 7
      : route.yields.includes('rare')
        ? 4
        : 2
    applyRenownDrift(ctx, boost, {
      source: `${SOURCE}.renown`,
      readable: `A party came back from ${route.label} with something worth having.`,
      tags: ['renown', 'expedition_success', route.id, run.expeditionId],
      relatedActors: leader ? [{ kind: 'other', id: leader.id }] : [],
      relatedSystems: ['expeditions'],
    })
    return
  }
  if (outcome === 'runner_lost' && (leader?.relationship ?? 0) > 60) {
    applyRenownDrift(ctx, -4, {
      source: `${SOURCE}.renown`,
      readable: `Losing ${leader?.name.display ?? 'the party'} cast a long shadow.`,
      tags: ['renown', 'runner_lost', run.expeditionId],
      relatedActors: leader ? [{ kind: 'other', id: leader.id }] : [],
      relatedSystems: ['expeditions'],
    })
  }
}

/** The house pays nothing to a party it never sees again, but says so. */
export function closeRecord(
  ctx: SimContext,
  expedition: Expedition,
  run: ExpeditionRun,
  outcome: ExpeditionOutcome,
  haul: ExpeditionReturnedIngredient[],
): void {
  const today = ctx.state.calendar.totalDaysElapsed
  const record: ExpeditionRecord = {
    id: expedition.id,
    runnerId: expedition.runnerId,
    mode: expedition.mode,
    targetTier: expedition.targetTier,
    targetIngredientId: expedition.targetIngredientId,
    daysTotal: expedition.daysTotal,
    costPaid: expedition.costPaid,
    startedDay: expedition.startedDay,
    resolvedDay: today,
    outcome,
    returnedIngredients: haul,
  }
  resolveExpedition(ctx, expedition.id, record)
  bumpExpeditionTotal(
    ctx,
    outcome === 'runner_lost'
      ? 'partiesLost'
      : outcome === 'recalled'
        ? 'recalled'
        : outcome === 'retreated'
          ? 'retreated'
          : 'returned',
  )
  void addCoin
}
