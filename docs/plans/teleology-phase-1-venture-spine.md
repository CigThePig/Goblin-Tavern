# Teleology Phase 1 Venture Spine — Review Notes

Phase 1 proves the teleology machine on one hardcoded venture (*Acquire a
liquor licence*): the generalized lifecycle kernel, an investment-reading
trigger, causality-on-advancement, a venture issue-seed generator + compose
card, and a ratchet (transformation tag) that survives save/load.

## Post-merge review fixes (applied)

A review of the Phase 0/1 PRs surfaced correctness and architecture gaps that
the original tests did not exercise. These are now fixed:

1. **Diff coverage for the teleology slices.** `createStateDiff`
   (`src/sim/core/diff.ts`) now walks `ventures`, `arcs`, and
   `transformations` via `diffTeleologyEntries` / `diffTransformations`.
   Before this, an invested venture (or any lifecycle transition) produced an
   empty top-level diff, so daily reports, missed-opportunity projections, and
   cause-coverage consumers never observed the advancement. `progress` is the
   meter; `stage`/`status` are scalar lifecycle flips; entry spawn/removal is a
   keyset change. Timestamps are skipped (they move every advancement).
2. **Aggregate fallback cause on lifecycle transitions.** `modifyVenture` /
   `modifyArc` (`src/sim/core/engine.ts`) now mirror the world mutators: when
   `emitDiffPathCausesForRecord` emits zero per-field causes (a `stage`/`status`
   transition moves only non-numeric fields) they emit an aggregate cause. The
   engine-path `recordSynthesizedCause` is a no-op, so without this a lifecycle
   transition could land with no `CauseEntry`.
3. **Kernel de-hardcoding (plan §1: "structure and lifecycle only").**
   - Completion is now milestone-data-driven: outcomes/fallbacks carry an
     optional `terminal` flag (`kernel/types.ts`), modules translate it into a
     `LifecycleTriggerResult.status`, and the kernel applies `result.status`
     instead of the previous hardcoded `if (toStage === 'licensed')`.
   - The kernel no longer branches on `entry.kind`. The calling module injects
     the write path (`EntryMutator`) into `advanceLifecycleEntry`, so
     `ctx.modifyVenture` / `ctx.modifyArc` selection lives in the sibling
     module, not the kernel.
4. **Real pressure-target guard test.** The Phase 0 guard now scans the
   *actually authored* consequence-profile effects emitted by the teleology
   generators (and the teleology causes emitted on a simulated day) for pressure
   target ids, instead of asserting against a hand-written inline array.

## Known deferrals (acceptable for Phase 1, revisit in later phases)

These are intentionally left for the phases that introduce more ventures/arcs;
they are recorded here so they are not rediscovered as surprises.

- **#5 — The `expedited` milestone branch is dead on the real path.**
  `liquorLicenseDefinition` (`src/sim/modules/ventures/liquorLicense.ts`) has an
  outcome gated on a `tag_present: 'expedited'` condition, but nothing in
  Phase 1 ever writes the `expedited` tag, so the integration/heavy path only
  ever hits `fallback`. The branch-resolution machinery is exercised by a unit
  test that injects the tag directly, but not end-to-end. When a real second
  venture (or an opening that can expedite) lands in Phase 2+, add an authored
  path that sets the tag so the branch is exercised through the sim, or drop the
  dead outcome.

- **#6 — The venture card resolves a hardcoded id rather than the seed.**
  `src/cards/templates/venture.ts` imports `LIQUOR_LICENSE_VENTURE_ID` and reads
  `state.ventures[LIQUOR_LICENSE_VENTURE_ID]` / `progress/2` directly, instead of
  resolving the venture from the seed's `venture:${id}` target. Fine for the
  single hardcoded venture, but it will not generalize. When Phase 2+ introduces
  more than one venture, resolve the entry from the seed's primary-actor target
  (`venture:<id>`) and read the requirement count from the venture's current
  milestone rather than the literal `2`.
