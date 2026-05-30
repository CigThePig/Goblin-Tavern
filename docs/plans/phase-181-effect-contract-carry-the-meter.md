# Phase 181 — Choice-Preview Legibility arc, Phase 1: The Effect Contract — carry the meter

**ISSUE-149.** First phase of the [Choice-Preview Legibility arc](choice-preview-legibility-arc.md). Reads the arc doc's Phase-1 section (self-contained; every claim grounded in a repo path). Additive contract change only — **no prose, no selection-policy, no cap changes** (those are Phases 3 and 2).

---

## Context — the defect this phase roots out

There is exactly one choice-preview pipeline: every card template feeds `composeChoicesFromSeed` (`src/cards/cardHelpers.ts`). Each effect is rendered from only its coarse triple `(targetKind, direction, magnitudeBand)`. `targetKind` (`classifyTargetKind`, `src/sim/modules/issues/generatorHelpers.ts`) is one of sixteen buckets — `staff` covers loyalty **and** morale **and** stress **and** fatigue; `pressure` covers every pressure id; `reputation` covers every axis. The distinguishing **leaf** of the target string (`loyalty`, `respectable`, `staff_loyalty_risk`) was discarded the moment `effect()` classified the kind. Two consequences:

1. The preview pools could not name *which* meter moved, so they reached for metaphor ("a marked rise in trust" — `trust` is not a meter).
2. The within-choice de-dup key `${targetKind}|${direction}|${magnitudeBand}` collapsed two **distinct** meters in the same band (loyalty +10 and stress −8, both `staff|positive|medium`) into one cell, so the second silently reused the first's rendered line — a duplicate the player saw.

This phase makes the meter leaf travel on the effect so downstream code can name it and tell two meters apart. It does **not** change any prose or which effects are shown.

---

## Scope delivered

### Contract — `src/sim/core/effect.ts`

- Added two optional fields to `EffectPreview`:
  - `meterId?: string` — the distinguishing leaf of `target`.
  - `meterLabel?: string` — a player-facing name, set only when a sensible one exists.
- Optional, mirroring the existing `targetKind`/`direction`/`magnitudeBand` discipline, so older serialized seeds stay valid.

### Population — `src/sim/modules/issues/generatorHelpers.ts`

- `classifyMeterId(target)` — peels the leaf after the final `.` or `:` (`staff.server.loyalty` → `loyalty`; `pressure:staff_loyalty_risk` → `staff_loyalty_risk`; `coin` → `coin`).
- `resolveMeterLabel(targetKind, target, meterId)` — single label source, **reuse not reinvent**:
  - `pressure` meters → `pressureRegistry` label (humanised fallback for unregistered ids).
  - Known meter leaves (staff `loyalty`/`morale`/`stress`/`fatigue`, reputation axes, `coin`) → a colocated enumerable `METER_LABELS` `Record<string,string>`.
  - Any other **dotted** state-change leaf (`satisfaction`, `cleanliness`, `tension`) → a local lowercase humanise.
  - Colon-prefixed non-pressure targets (entity-id leaves on cause effects, `staff:cook_1`) and `global`/`tavern` markers → `undefined`.
  - **No import of `src/reports/`** — the sim must not depend backwards on the report layer, and the card layer that reads `meterLabel` must stay report-free. `METER_LABELS` mirrors `REPUTATION_LABELS` from `idLabel.ts` (lower-cased for mid-sentence prose) rather than importing it.
- `effect()` now populates `meterId` always and `meterLabel` when defined.

### Condition — `src/cards/compose/types.ts` + `conditions.ts`

- New `SnippetCondition` variant `{ kind: 'effectMeter'; anyOf: readonly string[] }`, beside the sibling `effect*` arms.
- Evaluator reads `ctx.currentEffect?.meterId`; returns `false` when there is no current effect or the leaf is missing (legacy seeds) — same graceful degradation as the sibling arms.

### De-dup key — `src/cards/cardHelpers.ts`

- Extracted the within-choice cell key into an exported, testable `previewCellKey(effect)`.
- Key is now `${targetKind}|${meterId}|${direction}|${magnitudeBand}` — distinct meters get distinct keys (no false collapse); two effects on the **same** meter still share a cell (intended reuse). Returns `undefined` for un-bandable (cause/zero) effects, which never collapse.
- **Phase-1 neutrality guard.** `pickSnippet` tie-breaks on the effect index, so simply un-collapsing two distinct meters in one coarse cell would draw two *different* coarse lines and drain the small candidate pool — starving later choices into cross-choice duplicates the pre-existing `faithfulness` gate (`duplicate_preview_line`) flags. The arc anticipates this ("the duplicate text may persist until Phase 3"). So the de-dup keeps a second, coarse `(targetKind|direction|magnitudeBand)` map: a new meter that shares a coarse cell with an already-rendered line **reuses that line** — the duplicate text persists within the choice (gates permit same-choice repeats) and the cross-choice candidate budget is untouched, leaving rendered output identical to pre-phase. Phase 3 swaps the coarse reuse for meter-specific composition once meter-named snippets exist.

### Tests

- `tests/sim/phase181.effectMeter.test.ts` — `classifyMeterId` leaf extraction, `resolveMeterLabel` (pressure registry / known leaves / humanised fallback / unlabelled entity ids), and `effect()` emitting `meterId`/`meterLabel` (including the loyalty-vs-stress pair that shares targetKind/direction/band but differs only by meter).
- `tests/cards/compose/phase181.effectMeter.test.ts` — the `effectMeter` condition (match / multi / mismatch / no-context / legacy-seed) and `previewCellKey` (distinct keys for two meters in the same coarse cell; same key for same-meter effects; `undefined` for cause effects).

---

## Acceptance Criteria

- `EffectPreview` carries optional `meterId` + `meterLabel`, populated by `effect()` on every emission.
- An `effectMeter` snippet condition exists and evaluates against `currentEffect.meterId`.
- The within-choice de-dup key includes the meter; two distinct meters no longer share a cell (proven by the `previewCellKey` distinctness test).
- No preview prose changed; no `maxPreview` / `selectPreviewEffects` changed.
- `npm test` and `npm run typecheck` green.

## Do Not Do

- No preview prose changes (Phase 3 / ISSUE-151).
- No `maxPreview` or `selectPreviewEffects` changes (Phase 2 / ISSUE-150).
- No `src/reports/` import from `src/sim/` or `src/cards/`.
- `meterId`/`meterLabel` stay optional — old serialized seeds must remain valid.
