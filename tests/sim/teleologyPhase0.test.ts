import { describe, expect, it } from "vitest";

import type { EffectPreview } from "../../src/sim/core/effect";
import { createCloneApplier } from "../../src/sim/modules/responses/cloneApplier";
import { createInitialTavernState } from "../../src/sim/state/defaults";
import { ensureTeleologySlices } from "../../src/sim/state/migrations";
import { safeValidateState } from "../../src/sim/state/validation";

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

  it("guards authored teleology effects against pressure target ids", () => {
    const teleologyEffects: EffectPreview[] = [
      {
        kind: "state_change",
        target: "ventures.license.progress",
        amount: 1,
        readable: "Advance venture progress",
        tags: ["teleology"],
      },
      {
        kind: "state_change",
        target: "arcs.brewer.progress",
        amount: 1,
        readable: "Advance arc progress",
        tags: ["teleology"],
      },
      {
        kind: "state_change",
        target: "transformations.licensed.active",
        amount: 1,
        readable: "Activate a transformation",
        tags: ["teleology"],
      },
    ];

    expect(
      teleologyEffects.every(
        (effect) =>
          effect.kind === "state_change" &&
          !effect.target.startsWith("pressure:") &&
          !effect.target.startsWith("pressures."),
      ),
    ).toBe(true);
  });
});
