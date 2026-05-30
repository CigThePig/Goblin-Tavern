# Phase 170 / ISSUE-138 — Salience Completeness & the Reachability Allowlist

**Arc:** Complete Surface (`docs/plans/complete-surface-arc.md`), Movement I, Phase 3.
**Depends on:** ISSUE-136 (Gate-Wiring Contract, phase 168), ISSUE-137 (drinkOrder Parity, phase 169) — both `done`.
**Status:** in progress.

## Goal

Arm Movement II. Two jobs, no content authoring:

1. **Close the one tableless seed family.** `policy_backlash` is the only
   `IssueSeedFamilyId` with an active generator
   (`generatePolicyBacklash`, `expandedSeedGenerators.ts:4495`, registered via
   `EXPANDED_SEED_GENERATORS` → `ALL_SEED_GENERATORS`) and **no**
   `SALIENCE_TABLES` entry. It routes to `fallbackCard` today, but the first
   dedicated template for it would open on a bare mood line. Add the entry and a
   **derived** test that fails if *any* family with an active generator lacks a
   salience table — so the omission can't recur.

2. **Ship the two data structures Movement II authors against:**
   - a pure, enumerable **matrix-cell read** over `SALIENCE_TABLES` +
     `BAND_THRESHOLDS` — turning "is this matrix complete?" into a machine
     question; and
   - an **`unreachableCells` allowlist** scaffold (`Record<family, Cell[]>` with
     per-cell reasons) — turning "we chose not to author this cell because the
     sim can't reach it" into inspectable data, not a silent hole.

This phase ships **reads + scaffold only**. No establishing snippets, no
coverage gate (that is Phase 12 / ISSUE-147), no condition-DSL changes.

## The work

### 1. `policy_backlash` salience table + derived completeness test

`policy_backlash` is **narrator-voiced**: its `primaryActor` is a policy ref
(`{ kind: 'other', id: 'policy:<id>' }`) with no `castAttributes` and no banded
signal. So the table follows the Phase-149 / Phase-155 / Phase-156
narrator-voiced shape — `severity ≥ 70` crisis floor first (no categorical
*what-is-this-about* signal exists), then the two family pressures the generator
embeds (`policy_backlash` primary, `faction_anger` secondary;
`expandedSeedGenerators.ts:4858`), then the choice-affecting memory tags the
response profiles emit (`warning` from the seed memory + keep path; `grudge`
from the punish path; `reversal` from the repeal path; `policy` broad), then the
multi-period `repeat` as the deepest rung. No new `SalienceRead` kinds — all six
already-shipped kinds suffice.

Add `tests/cards/compose/phase170.salienceCompleteness.test.ts`:
- derives the family set from `ALL_SEED_GENERATORS` (the single source of truth
  for "active generator"), and asserts `SALIENCE_TABLES[family]` is defined for
  every one — fails naming any missing family. After this phase all 20 are
  covered.
- asserts `resolveSalientReads` resolves the new `policy_backlash` table at
  render (a high-severity seed surfaces the `severity ≥ 70` read), proving the
  table is wired, not just present.

### 2. Pure, enumerable matrix-cell read

New file `src/cards/compose/matrixCells.ts`:
- `MAX_MATRIX_METERS = 3` — a 3-meter cube (27 cells) is the documented
  establishing-matrix ceiling; families with more banded `signal` reads are
  capped at their three most salient (earliest in the salience table).
- `matrixMetersForFamily(family): MatrixMeter[]` — the `signal` reads of the
  family's salience table (in table order), capped at `MAX_MATRIX_METERS`. Each
  carries `{ signal, role }`. Asserts (via `BAND_THRESHOLDS` membership) that
  every meter signal is a real banded signal.
- `enumerateMatrixCells(family): MatrixCell[]` — the cartesian product of
  `ALL_BAND_IDS` (low/mid/high) over the meters: `3^n` decision-distinct cells
  (`n ≤ 3`). Each `MatrixCell` carries `{ meters, bands, key }` with a stable
  `key` of the form `"signalA=low|signalB=high"`. Narrator-voiced families
  (zero `signal` reads) enumerate to zero cells — their establishing line keys
  off pressures / memories / severity, which are not band-enumerable, and the
  Phase-12 coverage gate treats them accordingly.

Pure, deterministic, no closures. Exported through
`src/cards/compose/index.ts`.

### 3. `unreachableCells` allowlist scaffold

New file `src/cards/compose/unreachableCells.ts`:
- `type UnreachableCell = { cellKey: string; reason: string }` (`cellKey`
  matches `MatrixCell.key`).
- `UNREACHABLE_CELLS: Partial<Record<IssueSeedFamilyId, readonly UnreachableCell[]>>`.
- `isCellAllowlisted(family, cellKey): boolean`.

**Seeded empty, deliberately.** The arc's "Do not do" is explicit: *"Don't put
unreachable cells in the allowlist on a guess — if a cell's reachability is
uncertain, Movement II resolves it by instrumenting the picker, not by
pre-allowlisting it."* The motivating audit (Appendix A) named the gaps only in
aggregate ("~8 of 27 cube cells"), not as specific verified picker-blocked cells
— so there are no audit-verified cells to seed. The doc's `rowdiness = low`
example is given as the *format of a reason*, and inspection of the violence
picker (selects groups tagged `rowdy` / `dangerous` / `incident_prone`, scored
by `patronage + rowdiness`) shows a `dangerous`-tagged low-rowdiness group *is*
selectable — so that illustrative cell is **not** actually unreachable and must
not be seeded. Each Movement-II cluster phase (4–11) populates its family's
entries after instrumenting the picker. The file ships the type, the helper, a
fully-worked **commented** example of the format, and a validation invariant so
every future addition is machine-checked.

Add to the phase-170 test:
- matrix-cell read: cell counts per family (supplier → 9, culture → 27 capped at
  3 meters, inspection → 27 from its top-3 signals not 81, narrator families →
  0), `key` format, determinism (two calls equal), and `MAX_MATRIX_METERS` cap.
- allowlist: `UNREACHABLE_CELLS` is empty today; `isCellAllowlisted` returns
  false everywhere; **invariant** — every allowlist entry (none now, but the
  guard stands for Movement II) references a real enumerable cell of its family
  (its `cellKey` is in that family's `enumerateMatrixCells` key set). This is the
  guard that makes a typo'd or non-existent allowlisted cell fail the suite.

## Read first

- `src/cards/compose/salience.ts` (`SALIENCE_TABLES`, `resolveSalientReads`,
  `SalienceRead`).
- `src/sim/signals/bands.ts` (`BAND_THRESHOLDS`, `bandOf`), `signals/types.ts`
  (`SignalId`, `ALL_BAND_IDS`), `signals/index.ts`.
- `src/sim/modules/issues/issueSeedTypes.ts` (`IssueSeedFamilyId`).
- `src/sim/modules/issues/issueSeedRegistry.ts` +
  `issueSeedGenerators.ts` (`ALL_SEED_GENERATORS`) — the active-generator set.
- `expandedSeedGenerators.ts:4495` (`generatePolicyBacklash` — the picker,
  pressures, memory tags).
- `docs/plans/legible-surface-arc.md` Appendix A (the matrix-cell definition).

## Done when

- Every seed family with an active generator (`ALL_SEED_GENERATORS`) has a
  `SALIENCE_TABLES` entry, asserted by a derived test.
- A pure `enumerateMatrixCells` reads `SALIENCE_TABLES` + `BAND_THRESHOLDS` and
  enumerates the decision-distinct cells of a family's matrix, capped at 3
  meters.
- An `unreachableCells` allowlist scaffold exists (empty, validated, documented)
  with `isCellAllowlisted` + the real-cell invariant.
- No content authored; no gate added; conditions DSL untouched.
- `npm test` + `npm run typecheck` green. CLAUDE.md + ISSUE_TRACKER updated.

## Do not do

- Don't author establishing snippets (Movement II).
- Don't add OR/NOT/nesting to conditions, or new `SalienceRead` kinds.
- Don't put unreachable cells in the allowlist on a guess.
