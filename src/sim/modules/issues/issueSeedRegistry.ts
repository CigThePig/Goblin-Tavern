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
  // The timing(s) the produced seeds carry. This is the seed's *render*
  // timing — it drives card-template matching (`appliesTo.timings`) and
  // which day-beat surfaces the seed. By default it also selects the
  // generation pass (a `morning_prep` generator runs in the `startDay`
  // pass, etc.).
  timing: IssueSeedTiming[]
  // Phase 186 / Day-Clock Cluster 4 — generation-pass override, decoupled
  // from the seed's render `timing`. When present, the generator runs in
  // the pass(es) keyed by these timings instead of by `timing`. This lets
  // a choice-bearing periodic seed (`debt_rent`, `monthly_review`) be
  // *produced* in the morning pass — so the player can act on it at the
  // morning pause (contract §3.5) — while the seed it emits still carries
  // its `end_month` card timing. Defaults to `timing` when omitted.
  generateWith?: IssueSeedTiming[]
  generate(ctx: SimContext): IssueSeed[]
}

export const issueSeedGeneratorRegistry = new Registry<IssueSeedGenerator>()
