// Phase 141 / ISSUE-110 — Voiced Surface arc, Phase 15 (Reports Prose).
//
// Verb for the Missed Opportunities `diff_counterfactual` readable
// line. Composed as
//   `${actionPhrase} would have ${verb} the ${subjectNoun} ${kindNoun}.`
// The action phrase, subject noun, and kind noun are sim-derived;
// only the verb is voiced.
//
// Routing via seed.domain (action category): clean_action /
// repair_action / patch_action / fumigate_action / restock_action /
// bonus_action / generic_action. Unlike the pressure_remedy connector
// pool, the diff verbs are single words because the surrounding "would
// have ... the" frame is fixed.
//
// Body cap 1 word — single verbs only.

import type { SnippetPool } from '../../../../cards/compose/types'

export const diffConnectorPool: SnippetPool = {
  slotId: 'diff_connector',
  snippets: [
    { id: 'dconn_fallback', text: 'softened', conditions: [] },
    {
      id: 'dconn_clean_eased',
      text: 'eased',
      conditions: [{ kind: 'hasTag', tag: 'clean_action' }],
    },
    {
      id: 'dconn_clean_lightened',
      text: 'lightened',
      conditions: [{ kind: 'hasTag', tag: 'clean_action' }],
    },
    {
      id: 'dconn_repair_slowed',
      text: 'slowed',
      conditions: [{ kind: 'hasTag', tag: 'repair_action' }],
    },
    {
      id: 'dconn_patch_steadied',
      text: 'steadied',
      conditions: [{ kind: 'hasTag', tag: 'patch_action' }],
    },
    {
      id: 'dconn_fumigate_curbed',
      text: 'curbed',
      conditions: [{ kind: 'hasTag', tag: 'fumigate_action' }],
    },
    {
      id: 'dconn_restock_prevented',
      text: 'prevented',
      conditions: [{ kind: 'hasTag', tag: 'restock_action' }],
    },
    {
      id: 'dconn_bonus_buoyed',
      text: 'buoyed',
      conditions: [{ kind: 'hasTag', tag: 'bonus_action' }],
    },
  ],
}
