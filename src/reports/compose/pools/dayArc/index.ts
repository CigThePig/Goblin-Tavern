// Phase 186 / Day-Clock Cluster 6 — Report-as-unfolding.
//
// Snippet pool for the daily report's day-arc movement connectives.
// Connector-only: the structural facts (owner actions, service figures,
// resolved intents) are rendered by the projection; this pool only adds
// a short narrator lead-in per movement.

import type { SnippetPool } from '../../../../cards/compose/types'
import { dayArcLineSnippets } from './line'

export const dayArcLinePool: SnippetPool = {
  slotId: 'line',
  snippets: dayArcLineSnippets,
}
