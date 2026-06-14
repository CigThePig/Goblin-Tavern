import { describe, expect, it } from "vitest";

import type { EffectPreview } from "../../src/sim/core/effect";
import { simulateDay } from "../../src/sim/core/engine";
import { FULL_PIPELINE } from "../../src/sim/canonicalPipeline";
import { createCloneApplier } from "../../src/sim/modules/responses/cloneApplier";
import { LIQUOR_LICENSE_VENTURE_ID } from "../../src/sim/modules/ventures";
import type {
  ConsequenceProfile,
  IssueSeed,
} from "../../src/sim/modules/issues/issueSeedTypes";
import { createInitialTavernState } from "../../src/sim/state/defaults";
import { ensureTeleologySlices } from "../../src/sim/state/migrations";
import { safeValidateState } from "../../src/sim/state/validation";

function targetsPressure(target: string): boolean {
  return target.startsWith("pressure:") || target.startsWith("pressures.");
}

describe("teleology phase 0 foundations", () => {
  it("seeds empty teleology collections and schema-validates them", () => {
    const state = createInitialTavernState();

    expect(state.ventures).toEqual({});
    expect(state.arcs).toEqual({});
    expect(state.transformations).toEqual({});
    expect(safeValidateState(state).success).toBe(true);
  });

  it("round-trips the empty collections through JSON serialization", () => {
    const state = createInitialTavernState();
    const roundTripped = JSON.parse(JSON.stringify(state));

    expect(safeValidateState(roundTripped).success).toBe(true);
    expect(roundTripped.ventures).toEqual({});
    expect(roundTripped.arcs).toEqual({});
    expect(roundTripped.transformations).toEqual({});
  });

  it("migrates missing teleology collections idempotently", () => {
    const legacy = createInitialTavernState() as Partial<
      ReturnType<typeof createInitialTavernState>
    >;
    delete legacy.ventures;
    delete legacy.arcs;
    delete legacy.transformations;

    const migrated = ensureTeleologySlices(legacy);
    const rerun = ensureTeleologySlices(migrated);

    expect(migrated.ventures).toEqual({});
    expect(migrated.arcs).toEqual({});
    expect(migrated.transformations).toEqual({});
    expect(rerun).toBe(migrated);
  });

  it("applies response state changes to teleology slices without pressure targets", () => {
    const state = createInitialTavernState();
    state.ventures.license = {
      id: "license",
      kind: "venture",
      label: "Acquire a liquor licence",
      stage: "petition",
      progress: 0,
      status: "active",
      tags: [],
      createdAtDay: 0,
      updatedAtDay: 0,
    };

    const effect: EffectPreview = {
      kind: "state_change",
      target: "ventures.license.progress",
      amount: 2,
      readable: "Owner time advances the licence petition",
      tags: ["teleology", "venture"],
    };
    expect(effect.target.startsWith("pressure:")).toBe(false);
    expect(effect.target.startsWith("pressures.")).toBe(false);

    const applier = createCloneApplier(state);
    const result = applier.applyImmediateEffect(effect, {
      seedId: "seed",
      intentId: "intent",
      profileId: "profile",
      responseSlotId: "slot",
      verb: "invest",
      enqueuedDay: 0,
    });

    expect(result.applied).toBe(true);
    expect(state.ventures.license.progress).toBe(2);
  });

  it("guards real authored teleology effects against pressure target ids", () => {
    // Scan the *actually authored* consequence-profile effects that the
    // teleology generators emit (not a hand-written inline array), so the
    // guard catches a real regression. Constraint 3 / 4: teleology effects
    // must target the venture/arc/identity/transformation collections,
    // never a pressure id, or the pressure-polarity classifiers would see
    // a teleology effect.
    const result = simulateDay(
      createInitialTavernState(),
      {
        seed: "teleology-pressure-guard",
        devOptions: { spawnVenture: LIQUOR_LICENSE_VENTURE_ID },
      },
      FULL_PIPELINE,
    );
    const seeds = (
      result.state.modules.issueSeeds as { seedsToday: IssueSeed[] }
    ).seedsToday;

    const teleologyEffects: EffectPreview[] = seeds
      .flatMap((seed) => seed.consequenceProfiles as ConsequenceProfile[])
      .flatMap((profile) => [
        ...profile.immediateEffects,
        ...profile.delayedEffects,
      ])
      .filter((effect) => effect.tags.includes("teleology"));

    // The venture seed must actually exist, or this guard is vacuous.
    expect(teleologyEffects.length).toBeGreaterThan(0);
    const offenders = teleologyEffects.filter((effect) =>
      targetsPressure(effect.target),
    );
    expect(offenders).toEqual([]);

    // And no teleology-tagged cause emitted this day landed on a pressure.
    const teleologyCauses = result.state.causes.filter((c) =>
      c.tags.includes("teleology"),
    );
    expect(teleologyCauses.every((c) => !targetsPressure(c.target))).toBe(true);
  });
});
