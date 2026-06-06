import type { CardContextView } from './types'
import type { IssueSeed } from '../sim/modules/issues/issueSeedTypes'
import type { TavernState } from '../sim/state/TavernState'
import {
  cardContextFromSurfaceFacts,
  projectSurfaceFactsForSeed,
} from '../surface'

export function buildCardContext(
  seed: IssueSeed,
  state: TavernState,
): CardContextView {
  return cardContextFromSurfaceFacts(projectSurfaceFactsForSeed(seed, state))
}

export { cardContextFromSurfaceFacts, projectSurfaceFactsForSeed }
