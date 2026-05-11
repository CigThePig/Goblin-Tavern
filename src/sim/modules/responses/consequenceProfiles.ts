// Phase 19 §19.9 — Consequence profile helpers.
//
// The canonical `ConsequenceProfile` type lives in the issues module
// (since generators emit them). This file re-exports the helpers and
// scoring utilities for code that wants to construct profiles outside
// of a generator (e.g. tests, future card layers).

export type { ConsequenceProfile } from '../issues/issueSeedTypes'
export { makeProfile, effect } from '../issues/generatorHelpers'
export { scoreProfile, scoreEffects } from '../issues/impactScoring'
