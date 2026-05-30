# Phase 171 — Complete Surface arc, Phase 4 (Suppliers, Stock & Debt matrix fill)

**ISSUE-139.** Movement II, first content cluster. Depends on ISSUE-138
(the Phase-3 cell-coverage read + `unreachableCells` allowlist) and
ISSUE-104 / ISSUE-117 (the supplier / stock / debt templates and their
Legible-Surface-Phase-4 matrix authoring).

## What the Phase-3 read says this cluster's matrices are

The cluster owns three families. The matrix of a family is the cartesian
product of band states over its **banded `signal` salience reads**
(`matrixMetersForFamily` → `enumerateMatrixCells`, capped at
`MAX_MATRIX_METERS = 3`):

| Family | Banded signal reads | Matrix cells |
|---|---|---|
| `supplier_relationship` | `supplier.reliability`, `supplier.relationship` | **9** (3×3) |
| `stock_shortage` | none (narrator-voiced; subject is a stock item) | **0** |
| `debt_rent` | none (narrator-voiced; landlord is a `systemRef`) | **0** |

The two narrator-voiced families enumerate to **zero matrix cells by
design** — exactly the rule Phase 3 baked in: "Narrator-voiced families
with no banded signal on the subject … enumerate to zero cells … their
establishing line keys off pressure / memory / severity, which aren't
band-enumerable." Their establishing coverage is over **binary salient
facts** (severity floor, rising family pressures, choice memories, the
calendar `rent_due_soon` window, the multi-period repeat), already
authored exhaustively in Phase 149 and exercised render-level in
`phase149.exhaustiveMatrix.test.ts`. There is no band cube to "fill" for
them, and adding a band signal to make one would be a Phase-3 salience-
table change that contradicts the audited narrator-voiced classification —
out of scope here.

So the cluster's machine-checkable matrix is **the supplier 9-cell**,
which the arc already flags as "strong already."

## Supplier 9-cell — covered today

The Phase-149 establishing pool authors the readable diagonal **and** the
extremes; every cell resolves:

| Cell (reliability × relationship) | Covering snippet |
|---|---|
| low × low | `est_low_rel_low_rship` (combo) |
| low × mid | `est_low_reliability` (single meter) |
| low × high | `est_low_rel_high_rship` (combo) |
| mid × low | `est_low_relationship` (single meter) |
| **mid × mid** | `est_fallback` — the documented unremarkable centre |
| mid × high | `est_high_relationship` (single meter) |
| high × low | `est_high_rel_low_rship` (combo) |
| high × mid | `est_high_reliability` (single meter) |
| high × high | `est_high_rel_high_rship` (combo) |

The four corners are hand-authored combos; the four edges are covered by
the single-meter snippets (which fire on the one non-mid meter regardless
of the other meter's band); the centre is the fallback. This matches the
legibility gate's "meaningful read" filter (a mid-band signal read is
extremity 1, the intentional default — only low/high are extremity-2
"meaningful" reads that demand a covering snippet).

## Reachability — no allowlist entries

`generateSupplierRelationship` (`expandedSeedGenerators.ts:1127`) fires
when `supplier_distrust + market_instability ≥ PRESSURE_THRESHOLD`, then
picks the supplier ranked highest by `blame + memory + reliabilityDeficit
− recencyPenalty`. The score **biases toward** low-reliability suppliers
but does not floor them: a high-reliability supplier carrying blame /
distrust memory can still be the pick, and `relationship` is not in the
score at all. So every reliability × relationship band combination is
reachable. No cell is picker-blocked → `UNREACHABLE_CELLS` stays empty for
this cluster (the arc's rule: allowlist only proven-unreachable cells).

## The work

This is the first application of the Phase-3 cell-coverage read to
content, so the deliverable is **making "filled" a machine fact for the
cluster**, not authoring new prose (the prose already exists):

1. **New coverage test** `tests/cards/compose/phase171.matrixCoverage.test.ts`
   — derives the supplier cells from `enumerateMatrixCells`
   (not a hard-coded "9"), and for each cell:
   - builds a clean state with the starter supplier pinned to the cell's
     band-representative reliability / relationship values;
   - resolves the salient reads, filtering mid-band signal reads exactly
     as the legibility gate does;
   - asserts that, for a cell with ≥1 meaningful (low/high) signal read,
     the establishing slot fires a snippet whose `scoreCandidateSalience`
     index is finite (a covering snippet, not the bare fallback), and for
     the all-mid centre cell the fallback is what fires;
   - treats an `unreachableCells` entry as satisfying the cell (none here).
   Also asserts `stock_shortage` / `debt_rent` enumerate to **0** cells and
   that their narrator-voiced establishing pools open on a salient binary
   fact (severity floor / rising pressure), `validateUnreachableCells()`
   is clean, and the cluster has no allowlist entries.
2. **Confirm the existing gate + harness coverage stays green** — the
   cluster's three templates are already in `FULL_GATE_SITUATIONS`
   (Phase 168 nine-gate walk), `LEGIBILITY_SITUATIONS`, and the
   faithfulness walk; no harness edits needed.
3. **No new snippets, no picker widening, no allowlist entries** — the
   matrix is already authored-and-reachable to the cell. Recorded as such.

## Done when

`enumerateMatrixCells('supplier_relationship')` reports 9 cells and the
new test proves each resolves to a covering snippet or the documented
mid-centre fallback; the two narrator-voiced families report 0 cells with
their salient-fact coverage proven; `UNREACHABLE_CELLS` has no cluster
entry and validates clean; the nine-gate walk + cross-sim harnesses stay
green; `npm test` and `npm run typecheck` green.

## Do not do

No new band signals for stock / debt (that is a Phase-3 salience change,
and it contradicts the audited narrator-voiced classification). No
allowlist entries for reachable cells. No changes to what the choices do.
No coverage *gate* — that is Phase 12 / ISSUE-147; this phase ships the
per-cluster coverage *proof* the gate will later generalise.
