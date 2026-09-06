import type { TavernState } from '../../state/TavernState'
import type { ConsequenceProfile } from '../issues/issueSeedTypes'
import { startableVentures, ventureWorkQuote } from './ambitionQueries'

/** Cards and owner actions share the same commitment rules. Check the whole
 * profile before spending anything, since an earlier owner action may have
 * completed, paused, or already worked on the venture selected this morning. */
export function ventureResponseBlocker(state: TavernState, profile: ConsequenceProfile): string | undefined {
  for (const effect of profile.immediateEffects) {
    if (effect.kind !== 'state_change' || !effect.target.startsWith('ventures.')) continue
    const [, id, field] = effect.target.split('.')
    if (!id) continue
    if (field === 'spawn' && !startableVentures(state).some(v => v.ventureId === id)) {
      return 'That opening has already been committed or is no longer available.'
    }
    if (field === 'progress' && (effect.amount ?? 0) > 0) {
      const quote = ventureWorkQuote(state, `${id}:invest`)
      if (quote.blocked) return quote.blocked
    }
  }
  return undefined
}
