import type { SimContext } from '../../core/context'
import type { SocialRumourState } from '../../state/TavernState'
import { clampPercent } from '../../state/normalize'

import {
  MAX_RUMOUR_AUDIENCES,
  MAX_RUMOUR_HOPS,
  MAX_SPREADS_PER_DAY,
  MAX_SPREAD_HISTORY,
  MAX_SPREAD_PER_RUMOUR_PER_DAY,
  audiencesOf,
  bumpRumourTotal,
  getRumourModuleState,
  hasHeard,
  liveRumours,
  writeRumourSlice,
  type RumourSpreadEntry,
} from './rumourState'
import {
  audiencesFor,
  channelIsSpent,
  isDamaging,
  listChannels,
  willingToShare,
  type RumourChannel,
} from './channels'

// Expansion Phase 8 §8.4 — the spread itself.
//
// SOURCE → CHANNEL → AUDIENCE → BELIEF, once a day, bounded at every step.
// The bounds are not performance guards; they are what makes the network
// readable. Without them a single juicy rumour reaches everybody in the
// world within three days and the whole layer collapses back into a global
// meter, which is what §8.4 exists to replace.
//
// DISTORTION IS PER-HOP AND ONE-WAY. Every retelling drifts a little, and
// the drift never comes back — which is what makes "name the source" worth
// doing (it re-anchors the story) and what makes a long chain of tellings
// produce something the tavern genuinely never did.
//
// ANTI-RECURSION, three separate protections because they fail differently:
//
//   1. An audience that has already heard a rumour is never a candidate
//      again — so A→B→A cannot happen, and the audience list is a set.
//   2. `hops` is capped: after `MAX_RUMOUR_HOPS` retellings a rumour stops
//      travelling however loud it is. It can still be believed; it just
//      stops finding new ears.
//   3. Spreads are budgeted per rumour per day AND globally per day, so a
//      world full of talk cannot produce a combinatorial cascade.

const SOURCE = 'rumours.propagation'

/**
 * Stories one channel may carry in a day.
 *
 * One was too tight: almost every rumour is adopted by the same fallback
 * carrier, so a single limit there throttled the entire world to one spread
 * every few days and the network never exercised. Two lets a busy mouth
 * carry a couple of things without becoming a broadcast tower.
 */
const MAX_RUMOURS_PER_CHANNEL_PER_DAY = 2

/**
 * How much of a rumour an audience takes as true when they hear it.
 *
 * Credibility is the rumour's; authority is the teller's; distortion works
 * against both, because a story that has changed in the telling is one the
 * hearer has more reason to doubt. Accuracy matters too — a true thing is
 * easier to believe because bits of it keep turning out to be so — which is
 * the first time `accuracy` has been read by anything but a pressure meter.
 */
export function beliefOnHearing(
  rumour: SocialRumourState,
  channel: RumourChannel,
): number {
  const credibility = rumour.credibility ?? 50
  const distortion = rumour.distortion ?? 0
  const accuracyBonus =
    rumour.accuracy === 'true' ? 15 : rumour.accuracy === 'partial' ? 5 : rumour.accuracy === 'false' ? -10 : 0
  const raw =
    credibility * (0.5 + channel.authority * 0.5) - distortion * 0.35 + accuracyBonus
  return clampPercent(Math.round(raw))
}

/** What a retelling does to the story. */
function distortionOnHop(rumour: SocialRumourState, channel: RumourChannel): number {
  const current = rumour.distortion ?? 0
  const added = Math.round(channel.distortionRate * (100 - current) * 0.35)
  return Math.max(0, Math.min(40, added))
}

/**
 * Reword a rumour that has drifted far enough to be a different story.
 *
 * Only at the thresholds, so the label is stable between them — a rumour
 * whose text changed every hop would be unreadable, and the point is that
 * the player can see it has become something else.
 */
function distortedLabel(rumour: SocialRumourState, distortion: number): string {
  const original = rumour.originalLabel ?? rumour.label
  if (distortion >= 70) return `${original} — or so people are saying now, much embroidered`
  if (distortion >= 40) return `${original} — the version going round has grown in the telling`
  return rumour.label
}

/**
 * One day of talk.
 *
 * Deterministic: channels and rumours are walked in id order and every
 * budget is a count, so the same world always produces the same spread. No
 * RNG — who repeats what is a consequence of what they want (`willingToShare`)
 * rather than of a roll.
 */
export function propagateRumours(ctx: SimContext): void {
  const today = ctx.state.calendar.totalDaysElapsed
  const rumours = liveRumours(ctx.state).filter((rumour) =>
    canStillTravel(rumour, today),
  )
  if (rumours.length === 0) return

  const channels = listChannels(ctx.state)
  if (channels.length === 0) return

  const spreads: RumourSpreadEntry[] = []
  const channelUse = new Map<string, number>()
  let globalBudget = MAX_SPREADS_PER_DAY

  for (const rumour of rumours) {
    if (globalBudget <= 0) break
    let perRumour = MAX_SPREAD_PER_RUMOUR_PER_DAY

    for (const channel of channels) {
      if (globalBudget <= 0 || perRumour <= 0) break
      // A channel can only repeat what it has heard — or what it started.
      if (!hasHeard(rumour, channel.id) && rumour.originRef?.id !== channel.id) continue
      if (channelIsSpent(ctx.state, channel.id)) continue
      if ((channelUse.get(channel.id) ?? 0) >= MAX_RUMOURS_PER_CHANNEL_PER_DAY) continue
      if (!willingToShare(ctx.state, channel, rumour)) continue

      const targets = audiencesFor(ctx.state, channel, rumour)
      if (targets.length === 0) continue

      for (const target of targets) {
        if (globalBudget <= 0 || perRumour <= 0) break
        const live = ctx.state.world.socialRumours[rumour.id]
        if (!live) break
        if (audiencesOf(live).length >= MAX_RUMOUR_AUDIENCES) break
        if (hasHeard(live, target.id)) continue

        const added = distortionOnHop(live, channel)
        const nextDistortion = Math.min(100, (live.distortion ?? 0) + added)
        const belief = beliefOnHearing(live, channel)
        const nextAudiences = [
          ...audiencesOf(live),
          {
            id: target.id,
            kind: target.kind,
            belief,
            heardOnDay: today,
            fromId: channel.id,
          },
        ]
        const nextLabel = distortedLabel(live, nextDistortion)
        const readable =
          `${describeChannel(channel.label, channel.kind)} passed it to ` +
          `${describeChannel(target.label, target.kind)}: "${nextLabel}" (they credit it ${belief}).`

        ctx.modifySocialRumour(
          rumour.id,
          {
            audiences: nextAudiences,
            distortion: nextDistortion,
            label: nextLabel,
            hops: (live.hops ?? 0) + 1,
            lastSpreadDay: today,
            // Talk that is being repeated gets louder; the daily fade is
            // what takes it back down when nobody does.
            strength: clampPercent(live.strength + 4),
          },
          {
            source: `${SOURCE}.spread`,
            sourceType: 'rumour',
            target: rumour.id,
            targetType: 'rumour',
            amount: 1,
            readable,
            tags: ['rumour', 'spread', rumour.id, channel.id, target.id],
            relatedActors: [{ kind: 'rumour', id: rumour.id }],
            relatedSystems: ['rumours'],
          },
        )

        spreads.push({
          onDay: today,
          rumourId: rumour.id,
          fromId: channel.id,
          toId: target.id,
          toKind: target.kind,
          belief,
          distortionAdded: added,
          readable,
        })
        if (added > 0) bumpRumourTotal(ctx, 'distorted')
        bumpRumourTotal(ctx, 'spreads')
        globalBudget -= 1
        perRumour -= 1
        channelUse.set(channel.id, (channelUse.get(channel.id) ?? 0) + 1)
      }
    }
  }

  if (spreads.length === 0) return

  writeRumourSlice(
    ctx,
    (current) => {
      const channelRecords = { ...current.channels }
      for (const [channelId, used] of channelUse) {
        const existing = channelRecords[channelId]
        channelRecords[channelId] = {
          id: channelId,
          lastSharedOnDay: today,
          sharesThisWeek: (existing?.sharesThisWeek ?? 0) + used,
        }
      }
      return {
        ...current,
        channels: channelRecords,
        spreadToday: [...current.spreadToday, ...spreads],
        spreadHistory: [...current.spreadHistory, ...spreads].slice(
          -MAX_SPREAD_HISTORY,
        ),
      }
    },
    'spread',
  )
}

/**
 * Name a carrier unambiguously.
 *
 * A customer group and its culture can share a display label — `local_goblins`
 * and `goblin_local` are both "Local Goblins" — so a group-to-culture hop
 * read as somebody passing a story to themselves. The kind disambiguates it.
 */
function describeChannel(label: string, kind: string): string {
  switch (kind) {
    case 'culture':
      return `the ${label} (as a people)`
    case 'customer_group':
      return `the ${label} who drink here`
    default:
      return label
  }
}

/**
 * Days of silence after which a rumour is finished travelling.
 *
 * Without this a story nobody has mentioned in three months could be picked
 * up and passed on as if it were fresh — and, worse, every pass would
 * refresh `lastSpreadDay`, so the monthly stale prune could never fire and
 * the map would only ever be bounded by fade-out. Talk that has gone quiet
 * for a fortnight is over; if the same subject matters again, the weekly
 * pass mints a new rumour about it.
 */
export const RUMOUR_SILENCE_LIMIT_DAYS = 14

/** Has this rumour run out of road? */
export function canStillTravel(
  rumour: SocialRumourState,
  today?: number,
): boolean {
  if ((rumour.hops ?? 0) >= MAX_RUMOUR_HOPS) return false
  if (audiencesOf(rumour).length >= MAX_RUMOUR_AUDIENCES) return false
  if (rumour.correctedOnDay !== undefined) return false
  if (
    today !== undefined &&
    today - rumour.lastSpreadDay > RUMOUR_SILENCE_LIMIT_DAYS
  ) {
    return false
  }
  return true
}

/** Reset each channel's weekly allowance. Called on the first day of the week. */
export function resetChannelBudgets(ctx: SimContext): void {
  const slice = getRumourModuleState(ctx.state)
  if (Object.keys(slice.channels).length === 0) return
  writeRumourSlice(
    ctx,
    (current) => ({
      ...current,
      channels: Object.fromEntries(
        Object.entries(current.channels).map(([id, record]) => [
          id,
          { ...record, sharesThisWeek: 0 },
        ]),
      ),
    }),
    'channel_reset',
  )
}

export { isDamaging }
