import { Registry } from '../../registries/Registry'
import type { SimContext } from '../../core/context'
import type {
  IssueSeed,
  IssueSeedFamilyId,
  IssueSeedTiming,
} from './issueSeedTypes'

// Phase 19 §19.1 — Issue seed generator registry.
//
// Each generator is a pure function of `SimContext` that produces zero
// or more seeds. The module collects seeds from every registered
// generator each day, validates them, and ranks the survivors.

export type IssueSeedGenerator = {
  id: string
  family: IssueSeedFamilyId | string
  domain: string[]
  timing: IssueSeedTiming[]
  generate(ctx: SimContext): IssueSeed[]
}

export const issueSeedGeneratorRegistry = new Registry<IssueSeedGenerator>()
