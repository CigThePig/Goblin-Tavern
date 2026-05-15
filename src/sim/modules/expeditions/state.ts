import type { SimContext } from '../../core/context'
import type {
  Expedition,
  ExpeditionRecord,
  ExpeditionsState,
} from '../../state/TavernState'

// Phase 70 / ISSUE-030 §5.3, §6.3 — Expedition state helpers.
//
// `state.expeditions` is a top-level slice. All writes go through
// `ctx.modifyExpeditions` so the engine's runtime ref updates
// correctly and a high-level cause is emitted for each lifecycle
// event (commissioned, resolved). Per-field diff causes are
// intentionally not emitted — expeditions are not record-keyed.

export const COMPLETED_LOG_CAP = 50

export function addExpedition(ctx: SimContext, expedition: Expedition): void {
  ctx.modifyExpeditions(
    (slice) => ({ ...slice, active: [...slice.active, expedition] }),
    {
      source: 'expedition.lifecycle',
      sourceType: 'system',
      direction: 'increase',
      readable: `Expedition ${expedition.id} commissioned.`,
      tags: ['expedition', 'commission', expedition.id],
      relatedActors: [{ kind: 'other', id: expedition.runnerId }],
      relatedSystems: ['expeditions'],
    },
  )
}

export function updateActiveExpedition(
  ctx: SimContext,
  expeditionId: string,
  patch: Partial<Expedition>,
): void {
  ctx.modifyExpeditions(
    (slice) => ({
      ...slice,
      active: slice.active.map((e) =>
        e.id === expeditionId ? { ...e, ...patch } : e,
      ),
    }),
    {
      source: 'expedition.lifecycle',
      sourceType: 'system',
      readable: `Expedition ${expeditionId} progressed.`,
      tags: ['expedition', 'tick', expeditionId],
      relatedActors: [],
      relatedSystems: ['expeditions'],
    },
  )
}

export function resolveExpedition(
  ctx: SimContext,
  expeditionId: string,
  record: ExpeditionRecord,
): void {
  ctx.modifyExpeditions(
    (slice): ExpeditionsState => {
      const filtered = slice.active.filter((e) => e.id !== expeditionId)
      const completed = [...slice.completed, record]
      const capped = completed.slice(-COMPLETED_LOG_CAP)
      return { active: filtered, completed: capped }
    },
    {
      source: 'expedition.lifecycle',
      sourceType: 'system',
      readable: `Expedition ${expeditionId} resolved as ${record.outcome}.`,
      tags: ['expedition', 'resolved', record.outcome, expeditionId],
      relatedActors: [{ kind: 'other', id: record.runnerId }],
      relatedSystems: ['expeditions'],
    },
  )
}
