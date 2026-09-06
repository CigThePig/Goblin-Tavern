import { MAX_RUMOUR_AUDIENCES } from '../rumours/rumourState'
import type { SimContext } from '../../core/context'
import type { DailyServiceResult } from '../service/types'
import { identityEvidence, MAX_EARNED_NICKNAMES, NICKNAME_PUBLIC_DAYS, NICKNAME_WITNESSES, NICKNAME_WORDING } from './evidence'

/** At most three producer-owned rumours, using stable ids and real witnesses. */
export function updateEarnedNicknames(ctx: SimContext, service: DailyServiceResult | undefined): void {
  const day = ctx.state.calendar.totalDaysElapsed
  const evidence = Object.values(identityEvidence(ctx.state).evidence)
  const rumours = Object.values(ctx.state.world.socialRumours).filter(r => r.tags.includes('earned_nickname'))
  const eligible = evidence.filter(e => e.kind === 'knownFor' && e.lastSupportedDay === day && e.publicDays >= NICKNAME_PUBLIC_DAYS && e.witnesses >= NICKNAME_WITNESSES && e.strength >= 4 && NICKNAME_WORDING[e.label])
    .sort((a,b) => b.publicDays - a.publicDays || b.witnesses - a.witnesses || a.label.localeCompare(b.label)).slice(0, MAX_EARNED_NICKNAMES)
  for (const rumour of rumours) {
    const basis = rumour.tags.find(t => t.startsWith('identity:'))?.slice(9)
    if (!basis || eligible.some(e => e.label === basis)) continue
    const record = evidence.find(e => e.label === basis)
    if (!record || record.strength <= 1 || record.publicDays === 0) ctx.removeSocialRumour(rumour.id, {
      source: 'tavernIdentity.nickname_lost', readable: `${rumour.label} is no longer a name the house lives up to.`, tags: ['tavern_identity', 'nickname', 'lost'],
    })
  }
  const witnesses = Object.entries(service?.trafficByGroup ?? {}).filter(([id, count]) => count > 0 && ctx.state.customerGroups[id]).sort((a,b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  const source = witnesses[0]?.[0]
  if (!source || witnesses.reduce((sum, [, n]) => sum + n, 0) < 5) return
  for (const record of eligible) {
    const id = `earned_nickname_${record.label.replace(/[^a-z0-9]+/g, '_')}`
    const current = ctx.state.world.socialRumours[id]
    const label = NICKNAME_WORDING[record.label]!
    const meta = { source: 'tavernIdentity.nickname', readable: `${ctx.state.customerGroups[source]!.label} call the house “${label}”: ${record.publicDays} public days of ${record.label}.`, tags: ['tavern_identity', 'nickname', 'earned', `identity:${record.label}`] }
    if (current) {
      // Keep rumour provenance, but renew belief in the group who saw it today.
      const audiences = (current.audiences ?? []).map(a => a.id === source && a.kind === 'customer_group' ? { ...a, belief: Math.min(90, a.belief + 15), heardOnDay: day } : a)
      if (!audiences.some(a => a.id === source && a.kind === 'customer_group')) audiences.push({ id: source, kind: 'customer_group', belief: 65, heardOnDay: day })
      ctx.modifySocialRumour(id, { strength: Math.min(90, current.strength + 12), credibility: Math.min(95, (current.credibility ?? 65) + 5), lastSpreadDay: day, audiences: audiences.slice(0, MAX_RUMOUR_AUDIENCES) }, meta)
    } else {
      const owned = Object.values(ctx.state.world.socialRumours).filter(r => r.tags.includes('earned_nickname'))
      if (owned.length >= MAX_EARNED_NICKNAMES) {
        const weakest = owned.filter(r => !eligible.some(e => NICKNAME_WORDING[e.label] === r.label)).sort((a,b) => a.strength - b.strength || a.id.localeCompare(b.id))[0]
        if (!weakest) continue
        ctx.removeSocialRumour(weakest.id, { ...meta, readable: `The name “${weakest.label}” is being displaced by “${label}”.` })
      }
      ctx.addSocialRumour({ id, label, originalLabel: label, strength: 55, accuracy: 'true', sourceEntityId: source, originRef: { kind: 'customer_group', id: source }, subject: { kind: 'system', id: 'tavern' }, firstHeardDay: day, lastSpreadDay: day, credibility: 75, reach: 'public', audiences: [{ kind: 'customer_group', id: source, belief: 70, heardOnDay: day }], tags: ['nickname', 'earned_nickname', `identity:${record.label}`] }, meta)
    }
  }
}
