import type { SimContext } from '../../core/context'
import type { ReportSection } from '../../core/reports'

import {
  PROMOTION_INTERACTION_THRESHOLD,
  getNpcModuleState,
  openProposals,
  promotedNpcs,
} from './npcState'
import { listNpcIntents } from './npcActors'

// Expansion Phase 8 §8.3 — the notable-NPC report.
//
// Leads with who is about and what they have announced, because those are
// the two things the player can act on today. Promotion is stated with its
// reason, so "why is this person suddenly making moves at me" is answered on
// the page rather than being something to infer.

const SOURCE = 'npcs'

export function buildNpcReport(ctx: SimContext): ReportSection | null {
  const npcs = ctx.state.world.notableNpcs
  if (Object.keys(npcs).length === 0) return null

  const slice = getNpcModuleState(ctx.state)
  const promoted = promotedNpcs(ctx.state)
  const intents = listNpcIntents(ctx.state)
  const proposals = openProposals(ctx.state)
  const today = ctx.state.calendar.totalDaysElapsed
  const lines: string[] = []
  const label = (npcId: string): string => npcs[npcId]?.name.display ?? npcId

  if (slice.movesToday.length > 0) {
    lines.push('Today:')
    for (const move of [...slice.movesToday].sort((a, b) =>
      a.npcId.localeCompare(b.npcId),
    )) {
      lines.push(`  ${move.readable}`)
    }
    lines.push('')
  }

  if (intents.length > 0) {
    lines.push('Announced:')
    for (const intent of intents) lines.push(`  ${intent.readable}`)
    lines.push('')
  }

  if (proposals.length > 0) {
    lines.push('On the table:')
    for (const proposal of proposals) {
      lines.push(
        `  ${label(proposal.npcId)}: ${proposal.readable} — answer by day ${proposal.dueOnDay} (${proposal.dueOnDay - today} days)`,
      )
    }
    lines.push('')
  }

  if (promoted.length > 0) {
    lines.push('People who matter right now:')
    for (const record of promoted) {
      lines.push(
        `  ${label(record.npcId)}: importance ${record.importance}, ${record.interactionCount} dealings — ${record.promotionReason ?? 'known to the house'}`,
      )
    }
    lines.push('')
  }

  if (slice.aboutToday.length > 0) {
    lines.push(`About today: ${slice.aboutToday.map(label).join(', ')}`)
  }

  if (lines.length === 0) {
    lines.push('Nobody of note has had anything to do with the house.')
  }

  return {
    id: 'notable_npcs',
    source: SOURCE,
    title: 'PEOPLE OF NOTE',
    lines,
    data: {
      knownCount: Object.keys(slice.records).length,
      promotedIds: promoted.map((record) => record.npcId),
      announcedIntents: intents.map((intent) => intent.npcId),
      openProposalIds: proposals.map((proposal) => proposal.id),
      aboutToday: [...slice.aboutToday],
      promotionInteractionThreshold: PROMOTION_INTERACTION_THRESHOLD,
    },
  }
}
