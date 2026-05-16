# Phase 85 — Populate `content/text/descriptors.ts` (ISSUE-045)

See `docs/ISSUE_TRACKER.md` ISSUE-045 for full evidence and impact.

## Context

Phase 22 reserved `src/sim/content/text/descriptors.ts` as an empty
placeholder. Phase 39 / expanded issue-seed generators shipped without
ever filling it, so issue-seed prose-adjacent labels were hardcoded
inline in each generator. Per the Phase 21 contract — "no card prose,
produce text ingredients only" — the right shape is the shared pool;
the wrong shape is per-generator string literals.

## Implementation

`src/sim/content/text/descriptors.ts` — populated with three pools
plus a small helper API:

- `SEVERITY_ADJECTIVES` (low/medium/high tiers, 5 entries each).
- `AREA_STATE_ADJECTIVES` (`dirty`, `damaged`, `clean`, `smelly`,
  `risky`, 5 entries each).
- `FACTION_RELATION_NOUNS` (`cooperation`, `tension`, `rivalry`,
  `truce`, `feud`, 3-4 entries each).
- `severityTier(severity)` — maps numeric 0-100 → coarse tier
  (matches the `severityFromPressures` band thresholds).
- `pickSeverityAdjective(severity, key)`,
  `pickAreaStateAdjective(condition, key)`,
  `pickFactionRelationNoun(relation, key)` — deterministic FNV-1a
  hash over the seed key, so the same seed-id always returns the
  same fragment on re-view without dragging the simulation RNG into
  the text layer.

`src/sim/modules/issues/issueSeedGenerators.ts` —
`generateViolence` now consumes the pool: `problemNoun` weaves a
severity adjective + a `risky` area-state adjective; `sensoryDetails`
includes a `damaged` adjective; `toneHints` carries the severity
adjective as a tag-fragment. The inline literals stay as a fallback
shape (`shouting voices`, `merchants may flee`) because those name
specific concrete events, not generic descriptors.

## Verification

`tests/sim/phase85.descriptorPool.test.ts` (new, 10 tests):
- each pool is non-empty and covers the canonical keys;
- `severityTier` maps numeric severity correctly;
- pick helpers return fragments from the right tier/condition/
  relation pool;
- helpers are deterministic per-key (same key → same fragment);
- the FNV hash spreads at least 2 fragments across 20 keys;
- violence seed `textIngredients` includes a pool fragment when
  the generator fires.

Adjacent suites still green: `phase22.expansionStructure` (17),
`phase56.violence` (6). Typecheck clean.

## Files

- `src/sim/content/text/descriptors.ts`
- `src/sim/modules/issues/issueSeedGenerators.ts` (violence
  refactor)
- `tests/sim/phase84.supplierPricingDelivery.test.ts` (typecheck
  fixup for the unrelated `sampleStock` helper)
- `tests/sim/phase85.descriptorPool.test.ts` (new)
- `docs/ISSUE_TRACKER.md`
