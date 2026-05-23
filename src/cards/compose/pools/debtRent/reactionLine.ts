// Phase 135 / ISSUE-104 — Voiced Surface arc, Phase 9 (Suppliers, Stock & Debt).
//
// Flavor reaction line for the debt_rent compositional template.
// Narrator-voiced — owner-at-the-ledger third-person register. No
// first-person address, no character voice. Gated on `hasTag` against
// the seed's domain ∪ toneHints ∪ stake tags (`rent_due_soon` /
// `landlord` / `debt` / `monthly` / `pressure`), `severityAtLeast`, and
// prior-choice memories.

import type { SnippetPool } from '../../types'

export const reactionLinePool: SnippetPool = {
  slotId: 'reaction_line',
  snippets: [
    {
      id: 'rxn_fallback',
      text: 'The month asks what the till can spare this time.',
      conditions: [],
    },

    {
      id: 'rxn_rent_due_soon',
      text: 'There are only days left to find the rent.',
      conditions: [
        { kind: 'hasTag', tag: 'rent_due_soon' },
      ],
    },
    {
      id: 'rxn_high_severity',
      text: 'The numbers will not soften on their own from here.',
      conditions: [
        { kind: 'severityAtLeast', value: 70 },
      ],
    },

    {
      id: 'rxn_rent_memory',
      text: 'Last month went out clean; this month leans harder.',
      conditions: [
        { kind: 'memoryPresent', tag: 'rent' },
      ],
    },
    {
      id: 'rxn_landlord_memory',
      text: 'The landlord will be back at the door soon enough.',
      conditions: [
        { kind: 'memoryPresent', tag: 'landlord' },
      ],
    },
    {
      id: 'rxn_debt_memory',
      text: 'The earlier loan only deepened what was already short.',
      conditions: [
        { kind: 'memoryPresent', tag: 'debt' },
      ],
    },
    {
      id: 'rxn_risk_memory',
      text: 'The eviction warning waits in the drawer for a worse week.',
      conditions: [
        { kind: 'memoryPresent', tag: 'risk' },
      ],
    },

    {
      id: 'rxn_delay_memory',
      text: 'A second delay would weigh heavier than the first.',
      conditions: [
        { kind: 'memoryPresent', tag: 'delay' },
      ],
    },
    {
      id: 'rxn_debt_rising',
      text: 'The debt has been climbing all month; today will not still it.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'debt' },
      ],
    },

    {
      id: 'rxn_severity_rent_due',
      text: 'The shortfall is sharp and the window is closing fast.',
      conditions: [
        { kind: 'severityAtLeast', value: 70 },
        { kind: 'hasTag', tag: 'rent_due_soon' },
      ],
    },
    {
      id: 'rxn_landlord_rising',
      text: "The landlord's mood has not improved since the last note.",
      conditions: [
        { kind: 'pressureRising', pressureId: 'landlord' },
      ],
    },
    {
      id: 'rxn_debt_repeat',
      text: 'This is the third month asking the same hard question.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'debt' },
        { kind: 'repeatCount', subjectTag: 'debt', atLeast: 3 },
      ],
    },
  ],
}
