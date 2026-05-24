// Phase 141 / ISSUE-110 — Voiced Surface arc, Phase 15 (Reports Prose).
//
// Connector phrase for the Missed Opportunities `readable` line.
// Composed as `${actionPhrase}${target ? ' ' + targetClause : ''}
// ${connector} ${pressureLabel}.` at the projection layer; this pool
// supplies the connector only — the action label and pressure label
// stay as structured sim labels.
//
// Each snippet has unique text (dedupe gate enforcement within slot).
// Most action categories carry one or two distinct verb voicings;
// the fallback covers everything else.
//
// Body cap 4 words.

import type { SnippetPool } from '../../../../cards/compose/types'

export const connectorPool: SnippetPool = {
  slotId: 'connector',
  snippets: [
    {
      id: 'conn_fallback',
      text: 'would have eased',
      conditions: [],
    },
    {
      id: 'conn_clean_curbed',
      text: 'would have curbed',
      conditions: [{ kind: 'hasTag', tag: 'clean_action' }],
    },
    {
      id: 'conn_clean_lightened',
      text: 'would have lightened',
      conditions: [{ kind: 'hasTag', tag: 'clean_action' }],
    },
    {
      id: 'conn_repair_slowed',
      text: 'would have slowed',
      conditions: [{ kind: 'hasTag', tag: 'repair_action' }],
    },
    {
      id: 'conn_repair_firmed',
      text: 'would have firmed',
      conditions: [{ kind: 'hasTag', tag: 'repair_action' }],
    },
    {
      id: 'conn_patch_steadied',
      text: 'would have steadied',
      conditions: [{ kind: 'hasTag', tag: 'patch_action' }],
    },
    {
      id: 'conn_fumigate_thinned',
      text: 'would have thinned',
      conditions: [{ kind: 'hasTag', tag: 'fumigate_action' }],
    },
    {
      id: 'conn_restock_softened',
      text: 'would have softened',
      conditions: [{ kind: 'hasTag', tag: 'restock_action' }],
    },
    {
      id: 'conn_restock_replenished',
      text: 'would have replenished',
      conditions: [{ kind: 'hasTag', tag: 'restock_action' }],
    },
    {
      id: 'conn_bonus_buoyed',
      text: 'would have buoyed',
      conditions: [{ kind: 'hasTag', tag: 'bonus_action' }],
    },
    {
      id: 'conn_price_blunted',
      text: 'would have blunted',
      conditions: [{ kind: 'hasTag', tag: 'price_action' }],
    },
  ],
}
