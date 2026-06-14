# Teleology Phase 0 Foundations Notes

Phase 0 adds empty top-level teleology collections (`ventures`, `arcs`, and
`transformations`) and keeps them out of the entropy/pressure model.

## Pressure-polarity fence

Teleology progress is a lifecycle meter or stage, never a pressure. The
entropy-coupled pressure sites to keep fenced off are:

- `src/sim/modules/issues/generatorHelpers.ts`: pressure-backed seed helpers
  treat pressure movement as risk-oriented context.
- `src/cards/compose/previewSelect.ts`: `isRiskEffect`,
  `isDelayedRiskEffect`, and `isDelayedBenefitEffect` classify pressure effects
  for preview wording.
- `src/cards/compose/assemble.ts`: `readValence` maps effect kind/target into
  player-facing valence.

Teleology response effects should therefore use `state_change` targets under
`ventures.*`, `arcs.*`, `transformations.*`, or identity paths, and tests assert
that authored teleology effects do not target `pressure:` or `pressures.*` ids.
