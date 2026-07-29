// Expansion arc / Phase 0 (ISSUE-170, repo phase 207) — the implementation
// ledger's parser, validator, and repository scanners.
//
// `docs/plans/GOBLIN_TAVERN_SIMULATION_EXPANSION_WORK_PLAN.md` § "Phase 0"
// asks for ONE machine-readable ledger in the repository, with any
// generator or validator under `scripts/`. This file is that validator.
// Later phases update `docs/plans/expansion/ledger.csv` in place — they do
// not grow private copies, and they do not write per-phase prose.
//
// The ledger is a CSV so it stays diffable, greppable, and machine-checked.
// Its columns are exactly the plan's required minimum plus a tracker-issue
// column:
//
//   requirement_id     stable ID; never renumbered once published
//   phase              owning plan phase, 0–13
//   issue              the tracker issue that owns that phase (ISSUE-170…183)
//   origin             the promise or weakness the row exists to close
//   state_owner        which slice owns the persistent state, or `none` today
//   producer           what writes it, or `none` today
//   player_capability  the discoverable player action, or `none` today
//   autonomous_trigger what makes it happen without the player, or `none`
//   consumers          what reads it downstream, or `none`
//   ui_surfaces        report/UI surfaces that show it, or `none`
//   tests              the tests that hold it, or `none`
//   migration          n/a | required | done
//   status             open | in-progress | done
//   notes              free text; the only column allowed to be prose
//
// Every non-notes cell is either a concrete symbol/path list (separated by
// `; `) or the literal `none`. `none` is the load-bearing value: it is how
// the ledger records that a promise currently has no owner, which is the
// whole point of building it before the expansion starts.
//
// Usage:
//   npm run ledger:check        validate the ledger + coverage scans
//   npx tsx scripts/expansion-ledger.ts --hooks   print the hook inventory

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const REPO_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
export const LEDGER_PATH = join(REPO_ROOT, 'docs/plans/expansion/ledger.csv')

export const LEDGER_COLUMNS = [
  'requirement_id',
  'phase',
  'issue',
  'origin',
  'state_owner',
  'producer',
  'player_capability',
  'autonomous_trigger',
  'consumers',
  'ui_surfaces',
  'tests',
  'migration',
  'status',
  'notes',
] as const

export type LedgerColumn = (typeof LEDGER_COLUMNS)[number]
export type LedgerRow = Record<LedgerColumn, string>

export const MIGRATION_VALUES = ['n/a', 'required', 'done'] as const
export const STATUS_VALUES = ['open', 'in-progress', 'done'] as const

/** Plan phase → the tracker issue that owns it (plan §6). */
export const PHASE_TO_ISSUE: ReadonlyArray<string> = [
  'ISSUE-170',
  'ISSUE-171',
  'ISSUE-172',
  'ISSUE-173',
  'ISSUE-174',
  'ISSUE-175',
  'ISSUE-176',
  'ISSUE-177',
  'ISSUE-178',
  'ISSUE-179',
  'ISSUE-180',
  'ISSUE-181',
  'ISSUE-182',
  'ISSUE-183',
]

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

/** RFC4180-shaped parse: quoted fields may contain commas, newlines, and
 *  doubled quotes. Blank lines are skipped. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  let i = 0
  const push = (): void => {
    row.push(field)
    field = ''
  }
  const endRow = (): void => {
    push()
    if (row.length > 1 || row[0] !== '') rows.push(row)
    row = []
  }
  while (i < text.length) {
    const ch = text[i]!
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        quoted = false
        i += 1
        continue
      }
      field += ch
      i += 1
      continue
    }
    if (ch === '"') {
      quoted = true
      i += 1
      continue
    }
    if (ch === ',') {
      push()
      i += 1
      continue
    }
    if (ch === '\r') {
      i += 1
      continue
    }
    if (ch === '\n') {
      endRow()
      i += 1
      continue
    }
    field += ch
    i += 1
  }
  if (field !== '' || row.length > 0) endRow()
  return rows
}

export function parseLedgerCsv(text: string): LedgerRow[] {
  const rows = parseCsv(text)
  if (rows.length === 0) throw new Error('ledger.csv is empty')
  const header = rows[0]!
  const expected = [...LEDGER_COLUMNS]
  if (header.length !== expected.length || header.some((h, i) => h !== expected[i])) {
    throw new Error(
      `ledger.csv header mismatch.\n  expected: ${expected.join(',')}\n  actual:   ${header.join(',')}`,
    )
  }
  return rows.slice(1).map((cells, index) => {
    if (cells.length !== expected.length) {
      throw new Error(
        `ledger.csv row ${index + 2} has ${cells.length} cells, expected ${expected.length}`,
      )
    }
    const row = {} as LedgerRow
    expected.forEach((col, i) => {
      row[col] = cells[i]!
    })
    return row
  })
}

export function readLedger(path: string = LEDGER_PATH): LedgerRow[] {
  return parseLedgerCsv(readFileSync(path, 'utf8'))
}

// ---------------------------------------------------------------------------
// Ledger validation
// ---------------------------------------------------------------------------

const REQUIREMENT_ID_RE = /^(OBL|DEP|HOOK)-[A-Za-z0-9_*]+$/

/** Repo paths a ledger cell names, so `--check` can prove they still exist.
 *  Only concrete files are matched — a bare directory like `src/sim/modules/staff`
 *  is prose in this ledger, and glob-ish citations are ignored. */
export function citedPaths(cell: string): string[] {
  const matches = cell.match(
    /\b(?:src|web|tests|scripts|docs|baselines|specs)\/[A-Za-z0-9_\-./]*\.[A-Za-z0-9]+/g,
  )
  if (!matches) return []
  return [...new Set(matches.filter((p) => !p.includes('*')))]
}

/** Structural problems with the ledger itself. Empty array = valid. */
export function validateLedger(rows: ReadonlyArray<LedgerRow>): string[] {
  const problems: string[] = []
  const seen = new Set<string>()

  if (rows.length === 0) problems.push('ledger has no rows')

  for (const row of rows) {
    const id = row.requirement_id
    const where = `row ${id || '(blank id)'}`

    if (!REQUIREMENT_ID_RE.test(id)) {
      problems.push(`${where}: requirement_id must match ${REQUIREMENT_ID_RE}`)
    }
    if (seen.has(id)) problems.push(`${where}: duplicate requirement_id`)
    seen.add(id)

    const phase = Number(row.phase)
    if (!Number.isInteger(phase) || phase < 0 || phase > 13) {
      problems.push(`${where}: phase must be an integer 0–13, got '${row.phase}'`)
    } else if (row.issue !== PHASE_TO_ISSUE[phase]) {
      problems.push(
        `${where}: phase ${phase} belongs to ${PHASE_TO_ISSUE[phase]}, ledger says '${row.issue}'`,
      )
    }

    if (!(MIGRATION_VALUES as ReadonlyArray<string>).includes(row.migration)) {
      problems.push(
        `${where}: migration must be one of ${MIGRATION_VALUES.join('|')}, got '${row.migration}'`,
      )
    }
    if (!(STATUS_VALUES as ReadonlyArray<string>).includes(row.status)) {
      problems.push(
        `${where}: status must be one of ${STATUS_VALUES.join('|')}, got '${row.status}'`,
      )
    }

    for (const col of LEDGER_COLUMNS) {
      if (col === 'notes') continue
      if (row[col].trim() === '') problems.push(`${where}: column '${col}' is blank`)
    }

    // A ledger that names a file which no longer exists is worse than one
    // that names nothing: it reads as a covered requirement. Every repo
    // path a row cites must resolve.
    for (const col of LEDGER_COLUMNS) {
      for (const cited of citedPaths(row[col])) {
        if (!existsSync(join(REPO_ROOT, cited))) {
          problems.push(`${where}: column '${col}' cites missing path '${cited}'`)
        }
      }
    }

    // Phase 0 is the only phase that may be `done` while the arc runs: it
    // produces the ledger and the probes, not behavior. Anything else
    // claiming `done` must name the tests that hold it.
    if (row.status === 'done' && row.tests === 'none') {
      problems.push(`${where}: status 'done' but tests is 'none'`)
    }
  }

  return problems
}

// ---------------------------------------------------------------------------
// Future-hook scan
// ---------------------------------------------------------------------------
//
// The plan's Phase 0 required tests include "a scan proving that all
// player-facing future hooks are represented in the ledger, even before
// they are fixed." A future hook reaches the player through two source
// shapes, both of which this scan reads:
//
//   declared  a `futureHooks: [{ id: '…' }]` entry — on an `IssueSeed`
//             (the card's own warning) or on a `ConsequenceProfile`
//             (what a chosen response promises)
//   effect    `effect('future_hook', '<id>', …)` inside an effect list
//
// Both shapes end in the same place: `responsesModule` enqueues them onto
// `state.modules.responses.pending`, so the two are one obligation surface
// and the ledger does not split them.
//
// Static extraction (rather than running the sim) is deliberate: a
// generator that only fires on a rare state must still be represented in
// the ledger, and a seeded playtest cannot prove it reached every one.
//
// `runtime` is false for sites under `src/sim/testing/` — the expansion
// fixtures used by the module-expansion gate. They are scanned and
// ledgered anyway rather than filtered out, so the scan cannot quietly
// lose a hook by moving it into a fixture; the ledger row records what
// they actually are.

export type FutureHookShape = 'declared' | 'effect'

export type FutureHookSite = {
  id: string
  shape: FutureHookShape
  file: string
  line: number
  runtime: boolean
}

function listTypeScriptFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) listTypeScriptFiles(full, out)
    else if (entry.name.endsWith('.ts')) out.push(full)
  }
  return out
}

/** Blank out `//` and block comments, preserving every byte offset and
 *  newline so line numbers and slice indices stay valid. Comments are
 *  stripped before any bracket matching because prose apostrophes
 *  ("`inspectorActor`'s own chain") otherwise read as an unterminated
 *  string literal and swallow the rest of the file. */
export function blankComments(source: string): string {
  const out = source.split('')
  let i = 0
  let quote: string | undefined
  while (i < source.length) {
    const ch = source[i]!
    if (quote) {
      if (ch === '\\') i += 2
      else {
        if (ch === quote) quote = undefined
        i += 1
      }
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch
      i += 1
      continue
    }
    if (ch === '/' && source[i + 1] === '/') {
      while (i < source.length && source[i] !== '\n') {
        out[i] = ' '
        i += 1
      }
      continue
    }
    if (ch === '/' && source[i + 1] === '*') {
      const end = source.indexOf('*/', i + 2)
      const stop = end === -1 ? source.length : end + 2
      for (; i < stop; i += 1) if (source[i] !== '\n') out[i] = ' '
      continue
    }
    i += 1
  }
  return out.join('')
}

/** Return the source slice of the bracketed array that starts at or after
 *  `from`, or undefined when the next non-space token is not `[`. */
function readArrayLiteral(source: string, from: number): string | undefined {
  let i = from
  while (i < source.length && /\s/.test(source[i]!)) i += 1
  if (source[i] !== '[') return undefined
  const start = i
  let depth = 0
  let quote: string | undefined
  for (; i < source.length; i += 1) {
    const ch = source[i]!
    if (quote) {
      if (ch === '\\') i += 1
      else if (ch === quote) quote = undefined
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch
      continue
    }
    if (ch === '[') depth += 1
    else if (ch === ']') {
      depth -= 1
      if (depth === 0) return source.slice(start, i + 1)
    }
  }
  return undefined
}

/**
 * Collapse an emitted hook id to its ledger key.
 *
 * Many hooks are per-entity: `` `staff_quit_risk_${worst.id}` `` produces
 * one hook per employee. The obligation is the FAMILY, not each instance,
 * so an interpolated segment becomes `*` and the family gets one ledger
 * row (`HOOK-staff_quit_risk_*`). Returns undefined for anything that is
 * not a plain id after that collapse — a fully computed id would be a
 * finding in its own right, and none exist today.
 */
export function normalizeHookId(raw: string): string | undefined {
  const collapsed = raw.replace(/\$\{[^}]*\}/g, '*')
  if (!/^[A-Za-z0-9_*]+$/.test(collapsed)) return undefined
  // `a_*_*` and `a_*` name the same family; collapse runs of wildcards.
  return collapsed.replace(/\*+/g, '*')
}

function lineOf(source: string, index: number): number {
  let line = 1
  for (let i = 0; i < index && i < source.length; i += 1) {
    if (source[i] === '\n') line += 1
  }
  return line
}

/** Every player-facing future-hook emission site under `src/`. */
export function scanFutureHookSites(root: string = REPO_ROOT): FutureHookSite[] {
  const sites: FutureHookSite[] = []
  const files = [
    ...listTypeScriptFiles(join(root, 'src/sim')),
    ...listTypeScriptFiles(join(root, 'src/cards')),
  ]

  for (const file of files) {
    const rel = relative(root, file)
    // The responses module is the CONSUMER of hooks (it drains them) and
    // the types file only declares the shape — neither emits an id.
    if (rel.startsWith('src/sim/modules/responses/')) continue
    const runtime = !rel.startsWith('src/sim/testing/')
    const source = blankComments(readFileSync(file, 'utf8'))

    // `futureHooks: [ { id: '…' }, … ]` — both the seed-level list and the
    // per-consequence-profile list use this key, so the shape is decided
    // by whether the array sits inside a `consequenceProfiles` literal.
    const keyRe = /futureHooks\s*:/g
    let match: RegExpExecArray | null
    while ((match = keyRe.exec(source)) !== null) {
      // A ternary (`cond ? [ … ] : []`) puts the populated branch first.
      const afterKey = match.index + match[0].length
      const question = source.indexOf('?', afterKey)
      const nextBracket = source.indexOf('[', afterKey)
      const from =
        question !== -1 && nextBracket !== -1 && question < nextBracket
          ? question + 1
          : afterKey
      const literal = readArrayLiteral(source, from)
      if (!literal) continue
      const idRe = /\bid:\s*(['`])((?:\\.|(?!\1)[\s\S])*)\1/g
      let idMatch: RegExpExecArray | null
      while ((idMatch = idRe.exec(literal)) !== null) {
        const id = normalizeHookId(idMatch[2]!)
        if (!id) continue
        sites.push({
          id,
          shape: 'declared',
          file: rel,
          line: lineOf(source, match.index),
          runtime,
        })
      }
    }

    // `effect('future_hook', '<id>', …)`
    const effectRe = /effect\(\s*'future_hook'\s*,\s*(['`])((?:\\.|(?!\1)[\s\S])*)\1/g
    while ((match = effectRe.exec(source)) !== null) {
      const id = normalizeHookId(match[2]!)
      if (!id) continue
      sites.push({
        id,
        shape: 'effect',
        file: rel,
        line: lineOf(source, match.index),
        runtime,
      })
    }
  }

  sites.sort((a, b) =>
    a.id === b.id
      ? a.file === b.file
        ? a.line - b.line
        : a.file.localeCompare(b.file)
      : a.id.localeCompare(b.id),
  )
  return sites
}

/** Distinct hook ids, in stable order. */
export function futureHookIds(sites: ReadonlyArray<FutureHookSite>): string[] {
  return [...new Set(sites.map((s) => s.id))].sort()
}

/** Hook ids the source emits but the ledger does not carry. */
export function uncoveredFutureHooks(
  rows: ReadonlyArray<LedgerRow>,
  sites: ReadonlyArray<FutureHookSite>,
): string[] {
  const ledgered = new Set(
    rows
      .filter((r) => r.requirement_id.startsWith('HOOK-'))
      .map((r) => r.requirement_id.slice('HOOK-'.length)),
  )
  return futureHookIds(sites).filter((id) => !ledgered.has(id))
}

/** Ledger HOOK- rows with no emission site left in the source. */
export function staleFutureHookRows(
  rows: ReadonlyArray<LedgerRow>,
  sites: ReadonlyArray<FutureHookSite>,
): string[] {
  const emitted = new Set(futureHookIds(sites))
  return rows
    .filter((r) => r.requirement_id.startsWith('HOOK-'))
    .map((r) => r.requirement_id.slice('HOOK-'.length))
    .filter((id) => !emitted.has(id))
    .sort()
}

// ---------------------------------------------------------------------------
// Hook row generation
// ---------------------------------------------------------------------------
//
// 100-odd hook families is more than is worth hand-typing, and hand-typing
// is exactly how a ledger drifts from the source it describes. `--sync-hooks`
// regenerates the HOOK- block from the scan: existing rows keep every
// hand-edited column, new hooks arrive with the defaults below, and hooks
// that no longer exist in `src/` are dropped. OBL-/DEP- rows are never
// touched by the sync — they are the hand-authored part of the ledger.

/** Ordered id→owning-phase rules; first match wins. The owning phase is
 *  where the hook's *authoritative outcome* must land. Every hook is also
 *  typed and given a registered owner in Phase 1 (plan §1.1) regardless of
 *  which domain phase ends up resolving it. */
export const HOOK_PHASE_RULES: ReadonlyArray<{ match: RegExp; phase: number }> = [
  // workforce
  {
    match:
      /^staff_|^wage_|^raise_|^coverage_gap_|^cross_staff_|^training_|^authority_test_|^apology_expectation_/,
    phase: 3,
  },
  // areas, construction, upkeep
  { match: /^area_|^cellar_capacity_|^rebrand_locks_in_|^cleanliness_streak_|^failed_patch|_too_dark$/, phase: 2 },
  // suppliers and procurement
  {
    match: /^supplier_|^standing_order_|^dual_supplier_|^exclusivity_risk_|^new_supplier_|^cheap_supply_glut_/,
    phase: 6,
  },
  // loans, tenancy, regulation — checked before the rumour rule so
  // inspection gossip stays with the inspection lifecycle that owns it
  { match: /inspect|^town_watch|^loan_due|^eviction_|^landlord_|^cleaning_routine_streak$/, phase: 7 },
  // rivals, local arcs, month-scale events — before the rumour rule so a
  // rival's rumour move belongs to the rival actor, not the rumour network
  { match: /^rival_|^price_war_|^quality_arms_race_|^arc_|^payday_|^festival_|^blight_brand_lock_/, phase: 9 },
  // the social world: rumours, factions, cultures
  { match: /rumour|rumor|^faction_|^culture_|^shrine_|_boycott_possible$/, phase: 8 },
  // service flow, customers, regulars
  {
    match: /^regular_|^brawl_|^banned_group_|^security_routine_|^merchant_flight_|^food_poisoning_/,
    phase: 4,
  },
  // identity and recognition
  { match: /^identity_|^audience_|_resilient$|_rep_locked$/, phase: 10 },
  // economy, pricing, policies
  { match: /^price_|^policy_|^house_rule_|^reserves_intact_/, phase: 5 },
]

/** Phase 11 is the backstop: the plan's final shared closure of OBL-02. */
export const HOOK_DEFAULT_PHASE = 11

export function classifyHookPhase(id: string): number {
  for (const rule of HOOK_PHASE_RULES) if (rule.match.test(id)) return rule.phase
  return HOOK_DEFAULT_PHASE
}

const HOOK_CONSUMER_TODAY =
  'src/sim/modules/responses/responsesModule.ts applyPendingEntry — memory draft (memory_future_hook) or zero-weight cause (future_hook); no domain mutation'

const HOOK_NOTE =
  'OBL-02. Typed, owned, and given an exact-once resolver in Phase 1 (plan §1.1); the authoritative outcome lands in the owning phase. Phase column is the initial assignment — correct it in place if the domain moves.'

function hookOrigin(id: string, sites: ReadonlyArray<FutureHookSite>): string {
  const shapes = [...new Set(sites.map((s) => s.shape))].sort().join('+')
  const files = [...new Set(sites.map((s) => s.file))].sort()
  const scope = sites.some((s) => s.runtime) ? '' : ' (test-expansion fixture, not shipped content)'
  return `future hook '${id}' promised as ${shapes} in ${files.join('; ')}${scope}`
}

export function buildHookRow(
  id: string,
  sites: ReadonlyArray<FutureHookSite>,
  existing?: LedgerRow,
): LedgerRow {
  const phase = existing ? Number(existing.phase) : classifyHookPhase(id)
  const producer = [...new Set(sites.map((s) => s.file))].sort().join('; ')
  return {
    requirement_id: `HOOK-${id}`,
    phase: String(phase),
    issue: PHASE_TO_ISSUE[phase] ?? PHASE_TO_ISSUE[HOOK_DEFAULT_PHASE]!,
    // origin and producer are regenerated so they cannot drift from src/.
    origin: hookOrigin(id, sites),
    state_owner: existing?.state_owner ?? 'none',
    producer,
    player_capability: existing?.player_capability ?? 'none',
    autonomous_trigger: existing?.autonomous_trigger ?? 'none',
    consumers: existing?.consumers ?? HOOK_CONSUMER_TODAY,
    ui_surfaces: existing?.ui_surfaces ?? 'src/reports/pendingConsequenceProjection.ts (drainedToday)',
    tests: existing?.tests ?? 'none',
    migration: existing?.migration ?? 'required',
    status: existing?.status ?? 'open',
    notes: existing?.notes ?? HOOK_NOTE,
  }
}

export function syncHookRows(
  rows: ReadonlyArray<LedgerRow>,
  sites: ReadonlyArray<FutureHookSite>,
): { rows: LedgerRow[]; added: string[]; removed: string[] } {
  const authored = rows.filter((r) => !r.requirement_id.startsWith('HOOK-'))
  const existing = new Map(
    rows
      .filter((r) => r.requirement_id.startsWith('HOOK-'))
      .map((r) => [r.requirement_id.slice('HOOK-'.length), r]),
  )
  const ids = futureHookIds(sites)
  const hookRows = ids.map((id) =>
    buildHookRow(
      id,
      sites.filter((s) => s.id === id),
      existing.get(id),
    ),
  )
  return {
    rows: [...authored, ...hookRows],
    added: ids.filter((id) => !existing.has(id)),
    removed: [...existing.keys()].filter((id) => !ids.includes(id)).sort(),
  }
}

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

export function serializeLedger(rows: ReadonlyArray<LedgerRow>): string {
  const lines = [LEDGER_COLUMNS.join(',')]
  for (const row of rows) lines.push(LEDGER_COLUMNS.map((c) => csvCell(row[c])).join(','))
  return `${lines.join('\n')}\n`
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function main(argv: string[]): number {
  const sites = scanFutureHookSites()

  if (argv.includes('--hooks')) {
    for (const id of futureHookIds(sites)) {
      const where = sites.filter((s) => s.id === id)
      const shapes = [...new Set(where.map((s) => s.shape))].sort().join('+')
      const scope = where.some((s) => s.runtime) ? 'runtime' : 'fixture'
      process.stdout.write(
        `${id}\t${shapes}\t${scope}\t${where.length} site(s)\t${where[0]!.file}:${where[0]!.line}\n`,
      )
    }
    return 0
  }

  if (argv.includes('--sync-hooks')) {
    const synced = syncHookRows(readLedger(), sites)
    writeFileSync(LEDGER_PATH, serializeLedger(synced.rows), 'utf8')
    process.stdout.write(
      `synced ${synced.rows.length} rows: +${synced.added.length} hook(s), -${synced.removed.length}\n`,
    )
    for (const id of synced.added) process.stdout.write(`  + HOOK-${id}\n`)
    for (const id of synced.removed) process.stdout.write(`  - HOOK-${id}\n`)
    return 0
  }

  const rows = readLedger()
  const problems = [
    ...validateLedger(rows),
    ...uncoveredFutureHooks(rows, sites).map(
      (id) => `future hook '${id}' is emitted in src/ but has no HOOK-${id} ledger row`,
    ),
    ...staleFutureHookRows(rows, sites).map(
      (id) => `ledger row HOOK-${id} has no emission site left in src/`,
    ),
  ]

  const byStatus = new Map<string, number>()
  for (const row of rows) byStatus.set(row.status, (byStatus.get(row.status) ?? 0) + 1)

  process.stdout.write(
    `expansion ledger: ${rows.length} rows (` +
      [...byStatus.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k} ${v}`)
        .join(', ') +
      `), ${futureHookIds(sites).length} future hooks across ${sites.length} sites\n`,
  )

  if (problems.length > 0) {
    process.stderr.write('\nledger check FAILED:\n')
    for (const p of problems) process.stderr.write(`  - ${p}\n`)
    return 1
  }
  process.stdout.write('ledger check OK\n')
  return 0
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (invokedDirectly) process.exit(main(process.argv.slice(2)))
