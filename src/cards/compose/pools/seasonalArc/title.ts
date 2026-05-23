// Phase 140 / ISSUE-109 — Voiced Surface arc, Phase 14 (Periodic & Narrative Beats).
//
// Title pool for the seasonal_arc compositional template. The template
// renders the title as `${arcLabel ?? themeLabel ?? 'Seasonal event'}:
// ${snippet}` — the actual arc / theme label anchors the period being
// voiced (the rivalTavern title pattern). Snippets are short
// contextualisers gated on the five themes (already present in
// `seed.toneHints` and read by `hasTag` via `collectSeedTags`), the
// climax type, the anticipation tone, and the two arc pressures. All
// snippets ≤ 6 words. Voice-bounds gate forbids trailing "…" and
// immediate duplicate token.

import type { SnippetPool } from '../../types'

export const titlePool: SnippetPool = {
  slotId: 'title',
  snippets: [
    {
      id: 'title_fallback',
      text: 'a shape settles on the calendar',
      conditions: [],
    },
    {
      id: 'title_climax',
      text: 'the arc breaks today',
      conditions: [
        { kind: 'seedType', anyOf: ['arc_milestone'] },
      ],
    },
    {
      id: 'title_escalation_rising',
      text: 'pressure climbs against the calendar',
      conditions: [
        { kind: 'pressureRising', pressureId: 'arc_escalation' },
      ],
    },
    {
      id: 'title_festival',
      text: 'flags rise for the festival',
      conditions: [
        { kind: 'hasTag', tag: 'festival_approaching' },
      ],
    },
    {
      id: 'title_blight',
      text: 'the blight bites at supply',
      conditions: [
        { kind: 'hasTag', tag: 'mushroom_blight' },
      ],
    },
    {
      id: 'title_payday',
      text: 'miner payday lands soon',
      conditions: [
        { kind: 'hasTag', tag: 'miner_payday_boom' },
      ],
    },
    {
      id: 'title_inspection',
      text: 'an inspection sweep nears',
      conditions: [
        { kind: 'hasTag', tag: 'inspection_campaign' },
      ],
    },
    {
      id: 'title_rival_expansion',
      text: 'a rival house spreads',
      conditions: [
        { kind: 'hasTag', tag: 'rival_tavern_expansion' },
      ],
    },
  ],
}
