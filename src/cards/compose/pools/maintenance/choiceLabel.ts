// Phase 137 / ISSUE-106 — Voiced Surface arc, Phase 11 (Premises & Atmosphere).
//
// Voiced labels for the maintenance template's response choices.
// Narrator-voiced — gated on `responseVerb` / `responseShape` /
// `severityAtLeast` / `hasTag`, never on actor voice (no actor resolves
// for this template). The synthetic slot is optional so an unmatched
// seed falls back to the sim's verbatim `slot.labelHint`.
//
// The maintenance allowedVerbs surface at `issueSeedGenerators.ts:692-725`
// — repair / repair (long-term) / patch (short-term) / ignore / delay
// (close_area). Verbs are limited but the shape differentiates repair
// (long_term_investment) from patch (short_term_patch).

import type { SnippetPool } from '../../types'

export const choiceLabelPool: SnippetPool = {
  slotId: 'choice_label',
  snippets: [
    {
      id: 'label_repair_long',
      text: 'Repair it properly',
      conditions: [
        { kind: 'responseVerb', anyOf: ['repair'] },
        { kind: 'responseShape', anyOf: ['long_term_investment'] },
      ],
    },
    {
      // Phase 165 / ISSUE-133 — Faithful Surface arc, Phase 3. Gated on the
      // `long_term_investment` shape so the urgent line only fires for the
      // full `repair` slot — without it the `patch` slot (verb `repair`,
      // shape `short_term_patch`) also matched at high severity and both
      // rendered "Fix it before it falls".
      id: 'label_repair_severity',
      text: 'Fix it before it falls',
      conditions: [
        { kind: 'responseVerb', anyOf: ['repair'] },
        { kind: 'responseShape', anyOf: ['long_term_investment'] },
        { kind: 'severityAtLeast', value: 70 },
      ],
    },
    {
      id: 'label_patch_short',
      text: 'Patch it for now',
      conditions: [
        { kind: 'responseVerb', anyOf: ['repair'] },
        { kind: 'responseShape', anyOf: ['short_term_patch'] },
      ],
    },
    {
      id: 'label_ignore_default',
      text: 'Leave it as is',
      conditions: [
        { kind: 'responseVerb', anyOf: ['ignore'] },
      ],
    },
    {
      id: 'label_delay_close',
      text: 'Close the room off',
      conditions: [
        { kind: 'responseVerb', anyOf: ['delay'] },
      ],
    },
    {
      id: 'label_repair_default',
      text: 'See to the repair',
      conditions: [
        { kind: 'responseVerb', anyOf: ['repair'] },
      ],
    },
  ],
}
