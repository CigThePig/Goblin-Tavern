// Phase 135 / ISSUE-104 — Voiced Surface arc, Phase 9 (Suppliers, Stock & Debt).
//
// Flavor reaction line for the stock_shortage compositional template.
// Narrator-voiced — no first-person address, no character voice. Varies
// on `hasTag` against the seed's domain ∪ toneHints ∪ stake tags
// (`payday` / `brawl_night` / `market_day` / `local_night` / `urgent` /
// `high_demand` / `stock`), `pressureRising`, `severityAtLeast`, and
// prior-choice memories.

import type { SnippetPool } from '../../types'

export const reactionLinePool: SnippetPool = {
  slotId: 'reaction_line',
  snippets: [
    {
      id: 'rxn_fallback',
      text: 'The morning asks what the cellar can spare today.',
      conditions: [],
    },

    {
      id: 'rxn_high_demand',
      text: 'The room will be loud by midday; the kegs will not last.',
      conditions: [
        { kind: 'hasTag', tag: 'high_demand' },
      ],
    },
    {
      id: 'rxn_payday',
      text: 'Coins are loose tonight; thirst will outrun the supply.',
      conditions: [
        { kind: 'hasTag', tag: 'payday' },
      ],
    },
    {
      id: 'rxn_brawl_night',
      text: 'The brawl night crowd will drink whatever the cellar pours.',
      conditions: [
        { kind: 'hasTag', tag: 'brawl_night' },
      ],
    },
    {
      id: 'rxn_market_day',
      text: 'Market day brings strangers; their first round had better land.',
      conditions: [
        { kind: 'hasTag', tag: 'market_day' },
      ],
    },

    {
      id: 'rxn_high_severity',
      text: 'There is no soft answer left; the choice has to be made.',
      conditions: [
        { kind: 'severityAtLeast', value: 70 },
      ],
    },
    {
      id: 'rxn_urgent',
      text: 'This will not keep until tomorrow; the morning needs an answer.',
      conditions: [
        { kind: 'hasTag', tag: 'urgent' },
      ],
    },

    {
      id: 'rxn_watered_memory',
      text: 'You stretched the last batch; the next stretch will be noticed.',
      conditions: [
        { kind: 'memoryPresent', tag: 'deception' },
      ],
    },
    {
      id: 'rxn_ignored_memory',
      text: 'Looking away the last time only made the gap wider.',
      conditions: [
        { kind: 'memoryPresent', tag: 'ignored' },
      ],
    },
    {
      id: 'rxn_price_memory',
      text: 'A price hike sits fresh on the slate; another would be brittle.',
      conditions: [
        { kind: 'memoryPresent', tag: 'price' },
      ],
    },

    {
      id: 'rxn_shortage_urgent',
      text: 'The shelves are thinning fast and the room is already loud.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'stock_shortage' },
        { kind: 'hasTag', tag: 'high_demand' },
      ],
    },
    {
      id: 'rxn_severity_repeat',
      text: 'This is the third time the cellar has put the same question.',
      conditions: [
        { kind: 'severityAtLeast', value: 70 },
        { kind: 'repeatCount', subjectTag: 'stock', atLeast: 3 },
      ],
    },
  ],
}
