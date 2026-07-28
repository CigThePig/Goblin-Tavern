#!/usr/bin/env tsx
import { fork } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { TavernState } from '../src/sim/state/TavernState'
import type { DifficultyId } from '../src/sim/state/difficulty'
import type { IssueSeed } from '../src/sim/modules/issues/issueSeedTypes'
import {
  measureBalanceScenario,
  type BalanceRunMetrics,
} from '../src/sim/testing/balanceHarness'
import {
  ALL_BALANCE_VARIANT_IDS,
  ALL_DIFFICULTIES,
  BALANCE_STRATEGY_BOT_IDS,
  BALANCE_VARIANTS,
  aggregateBalanceCells,
  analyzeBalanceSlice,
  checkDifficultyMonotonicity,
  compareVariants,
  OUTCOME_METRICS,
  type BalanceMetricKey,
  type BalanceVariantId,
} from '../src/sim/testing/balanceMatrix'
import { getPolicyBot, type PolicyBotId } from '../src/sim/testing/policyBots'
import { pickCard } from '../src/cards/registry'

// Phase 206 / gameplay-audit Wave 7 — the balance matrix driver.
//
// Wave 7 (Phase 8 §7) has to compare eight strategies × three difficulties
// × five action/response variants, and Phase 7 §5.2 says a single seed
// cannot support a balance claim — so the real sweep is several hundred
// 28-day runs. One 28-day segmented run costs ~6–7s, which puts the full
// sweep near 40 minutes serially. That is the reason this is a script with
// worker sharding rather than a test: a balance pass the operator will not
// wait for does not get run.
//
// Usage:
//
//   npm run balance:matrix -- --estimate --difficulties=all --variants=all
//   npm run balance:matrix -- --variants=all --concurrency=4 --format=md
//   npm run balance:matrix -- --format=json --out=/tmp/balance.json
//   npm run balance:matrix -- --baseline=docs/audits/.../balance-baseline.json
//
// `--render` prices decision load with the real card layer (`pickCard`)
// instead of the sim's `renderedChoiceCost` upper bound. The bound is
// always ≥ the render, so the default over-reports slightly; use
// `--render` whenever a number is going to be compared against the
// `DC-06` ceiling, and never mix the two in one comparison.

const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPT = `${HERE}/balance-matrix.ts`

/** Default shared seeds. Fixed and named so every Wave 7 run is
 *  reproducible and comparable; `phase7-integrated-shared` is the audit's
 *  own seed, kept first so old evidence stays directly comparable. */
const DEFAULT_SEEDS = [
  'phase7-integrated-shared',
  'wave7-balance-b',
  'wave7-balance-c',
]

const SECONDS_PER_CELL = 6.7

// ----------------------------------------------------------------------
// Options
// ----------------------------------------------------------------------

type Options = {
  days: number
  seeds: string[]
  difficulties: DifficultyId[]
  variants: BalanceVariantId[]
  bots: PolicyBotId[]
  concurrency: number
  render: boolean
  format: 'md' | 'json'
  out: string | undefined
  baseline: string | undefined
  compact: boolean
  estimate: boolean
  workerShard: number | undefined
  workerTotal: number | undefined
}

function flag(argv: string[], name: string): string | undefined {
  const prefix = `--${name}=`
  const hit = argv.find((arg) => arg.startsWith(prefix))
  if (hit) return hit.slice(prefix.length)
  return argv.includes(`--${name}`) ? '' : undefined
}

function list<T extends string>(
  raw: string | undefined,
  all: ReadonlyArray<T>,
  label: string,
): T[] {
  if (raw === undefined || raw === '') return []
  if (raw === 'all') return [...all]
  const parts = raw.split(',').map((part) => part.trim()).filter(Boolean)
  for (const part of parts) {
    if (!all.includes(part as T)) {
      throw new Error(
        `Unknown ${label}: "${part}". Known: ${all.join(', ')} (or "all").`,
      )
    }
  }
  return parts as T[]
}

function parseOptions(argv: string[]): Options {
  const seedsRaw = flag(argv, 'seeds')
  const difficulties = list(
    flag(argv, 'difficulties') ?? 'standard',
    ALL_DIFFICULTIES,
    'difficulty',
  )
  const variants = list(
    flag(argv, 'variants') ?? 'full',
    ALL_BALANCE_VARIANT_IDS,
    'variant',
  )
  const bots = list(
    flag(argv, 'bots') ?? 'all',
    BALANCE_STRATEGY_BOT_IDS,
    'bot',
  )
  const format = flag(argv, 'format') ?? 'md'
  if (format !== 'md' && format !== 'json') {
    throw new Error(`--format must be "md" or "json", got "${format}".`)
  }
  const workerShard = flag(argv, 'worker-shard')
  const workerTotal = flag(argv, 'worker-total')

  return {
    days: Number(flag(argv, 'days') ?? 28),
    seeds:
      seedsRaw && seedsRaw !== ''
        ? seedsRaw.split(',').map((seed) => seed.trim()).filter(Boolean)
        : DEFAULT_SEEDS,
    difficulties,
    variants,
    bots,
    concurrency: Math.max(1, Number(flag(argv, 'concurrency') ?? 1)),
    render: flag(argv, 'render') !== undefined,
    format,
    out: flag(argv, 'out') || undefined,
    baseline: flag(argv, 'baseline') || undefined,
    compact: flag(argv, 'compact') !== undefined,
    estimate: flag(argv, 'estimate') !== undefined,
    workerShard: workerShard === undefined ? undefined : Number(workerShard),
    workerTotal: workerTotal === undefined ? undefined : Number(workerTotal),
  }
}

// ----------------------------------------------------------------------
// Cells
// ----------------------------------------------------------------------

type Cell = {
  botId: PolicyBotId
  difficulty: DifficultyId
  variant: BalanceVariantId
  seed: string
}

/** Deterministic, nested bot → difficulty → variant → seed, so two runs
 *  of the same spec emit rows in the same order and a baseline diff is a
 *  real diff rather than a reordering. */
function buildCells(options: Options): Cell[] {
  const cells: Cell[] = []
  for (const botId of options.bots) {
    for (const difficulty of options.difficulties) {
      for (const variant of options.variants) {
        for (const seed of options.seeds) {
          cells.push({ botId, difficulty, variant, seed })
        }
      }
    }
  }
  return cells
}

/** Price a card the way the player sees it: the composed card's own
 *  choices plus the generic Ignore `CardRenderer` appends when none of
 *  them carries the `ignore` verb. Mirrors the Wave 6 ceiling gate. */
function renderedChoices(seed: IssueSeed, state: TavernState): number {
  const card = pickCard(seed, state)
  const modelsIgnore = card.choices.some((choice) => choice.verb === 'ignore')
  return card.choices.length + (modelsIgnore ? 0 : 1)
}

/**
 * A variant that pulls neither of the bot's levers produces the same run
 * whichever bot is named: `chooseActions`, `chooseStaffPriorities` and
 * `chooseResponse` are all unreachable. `no_action` is that variant, and
 * running it once per strategy would burn eight identical 28-day runs per
 * difficulty × seed — a fifth of the full sweep spent re-deriving one
 * answer. Simulate it once and relabel the copies.
 */
function isBotIndependent(variant: BalanceVariantId): boolean {
  const config = BALANCE_VARIANTS[variant]
  return config.ownerActions === 'none' && config.responses === 'none'
}

function runCells(
  cells: ReadonlyArray<Cell>,
  options: Options,
  onProgress?: (done: number, total: number) => void,
): BalanceRunMetrics[] {
  const rows: BalanceRunMetrics[] = []
  const shared = new Map<string, BalanceRunMetrics>()

  cells.forEach((cell, index) => {
    const variant = BALANCE_VARIANTS[cell.variant]
    const sharedKey = `${cell.difficulty}|${cell.variant}|${cell.seed}`
    const reusable = isBotIndependent(cell.variant)
      ? shared.get(sharedKey)
      : undefined

    const row =
      reusable !== undefined
        ? {
            ...reusable,
            cellId: reusable.cellId.replace(reusable.botId, cell.botId),
            botId: cell.botId,
            botLabel: getPolicyBot(cell.botId).label,
          }
        : measureBalanceScenario({
            botId: cell.botId,
            difficulty: cell.difficulty,
            seed: cell.seed,
            days: options.days,
            ownerActions: variant.ownerActions,
            responses: variant.responses,
            ...(options.render
              ? { measureRenderedChoices: renderedChoices }
              : {}),
          })

    if (reusable === undefined && isBotIndependent(cell.variant)) {
      shared.set(sharedKey, row)
    }
    rows.push(row)
    onProgress?.(index + 1, cells.length)
  })
  return rows
}

// ----------------------------------------------------------------------
// Sharded execution
// ----------------------------------------------------------------------

/**
 * Split cells across workers by *simulation group*, not by index.
 *
 * Bot-independent cells share one simulation (see `runCells`), so a
 * round-robin split would scatter the eight copies of a `no_action` cell
 * across eight workers and every one of them would re-simulate it. Cells
 * that share a simulation therefore land in the same shard.
 */
function shardKeyOf(cell: Cell): string {
  return isBotIndependent(cell.variant)
    ? `shared|${cell.difficulty}|${cell.variant}|${cell.seed}`
    : `${cell.botId}|${cell.difficulty}|${cell.variant}|${cell.seed}`
}

function shardOf(
  cells: ReadonlyArray<Cell>,
  shard: number,
  total: number,
): Cell[] {
  const keys = [...new Set(cells.map(shardKeyOf))]
  const shardByKey = new Map(
    keys.map((key, index) => [key, index % total] as const),
  )
  return cells.filter((cell) => shardByKey.get(shardKeyOf(cell)) === shard)
}

function childArgs(options: Options, shard: number, total: number): string[] {
  return [
    `--days=${options.days}`,
    `--seeds=${options.seeds.join(',')}`,
    `--difficulties=${options.difficulties.join(',')}`,
    `--variants=${options.variants.join(',')}`,
    `--bots=${options.bots.join(',')}`,
    ...(options.render ? ['--render'] : []),
    `--worker-shard=${shard}`,
    `--worker-total=${total}`,
  ]
}

async function runSharded(
  cells: Cell[],
  options: Options,
): Promise<BalanceRunMetrics[]> {
  const shards = Math.min(options.concurrency, cells.length)
  process.stderr.write(
    `Running ${cells.length} cells across ${shards} worker(s)…\n`,
  )

  const results = await Promise.all(
    Array.from({ length: shards }, (_unused, shard) =>
      new Promise<BalanceRunMetrics[]>((resolve, reject) => {
        const child = fork(SCRIPT, childArgs(options, shard, shards), {
          execArgv: ['--import', 'tsx'],
          stdio: ['ignore', 'pipe', 'inherit', 'ipc'],
        })
        let buffer = ''
        child.stdout?.on('data', (chunk: Buffer) => {
          buffer += chunk.toString()
        })
        child.on('error', reject)
        child.on('exit', (code) => {
          if (code !== 0) {
            reject(new Error(`worker ${shard} exited with code ${code}`))
            return
          }
          try {
            resolve(JSON.parse(buffer) as BalanceRunMetrics[])
          } catch (error) {
            reject(
              new Error(
                `worker ${shard} produced unparseable output: ${String(error)}`,
              ),
            )
          }
        })
      }),
    ),
  )

  // Re-order into canonical cell order so sharding never changes output.
  const byCellId = new Map<string, BalanceRunMetrics>()
  for (const row of results.flat()) byCellId.set(row.cellId, row)
  const ordered: BalanceRunMetrics[] = []
  for (const cell of cells) {
    const variant = BALANCE_VARIANTS[cell.variant]
    const id = [
      cell.botId,
      cell.difficulty,
      `act-${variant.ownerActions}`,
      `res-${variant.responses}`,
      cell.seed,
    ].join('/')
    const row = byCellId.get(id)
    if (row) ordered.push(row)
  }
  return ordered
}

// ----------------------------------------------------------------------
// Rendering
// ----------------------------------------------------------------------

function table(headers: string[], rows: string[][]): string {
  const head = `| ${headers.join(' | ')} |`
  const rule = `|${headers.map(() => '---').join('|')}|`
  const body = rows.map((row) => `| ${row.join(' | ')} |`).join('\n')
  return [head, rule, body].join('\n')
}

function num(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

function renderMarkdown(
  rows: BalanceRunMetrics[],
  options: Options,
): string {
  const cells = aggregateBalanceCells(rows)
  const out: string[] = []

  out.push('# Balance matrix')
  out.push('')
  out.push(
    `${rows.length} cells · ${options.days} days · seeds: ${options.seeds.join(', ')}`,
  )
  out.push(
    `Decision load priced by: **${options.render ? 'real card render' : "the sim's renderedChoiceCost upper bound"}**`,
  )
  out.push('')

  const broken = cells.filter((cell) => !cell.trustworthy)
  out.push('## Trust')
  out.push('')
  if (broken.length === 0) {
    out.push(
      'Every cell validated and held the Phase 8 §8.2 invariants on every day.',
    )
  } else {
    out.push(
      `**${broken.length} cell(s) failed an invariant and are excluded from every ranking below.**`,
    )
    out.push('')
    out.push(
      table(
        ['Bot', 'Difficulty', 'Variant', 'Reason'],
        broken.map((cell) => [
          cell.botId,
          cell.difficulty,
          cell.variant,
          cell.untrustworthyReason ?? '—',
        ]),
      ),
    )
  }
  out.push('')

  // Per difficulty × variant: the outcome table plus the analysis.
  for (const difficulty of options.difficulties) {
    for (const variant of options.variants) {
      const slice = cells.filter(
        (cell) => cell.difficulty === difficulty && cell.variant === variant,
      )
      if (slice.length === 0) continue
      out.push(`## ${difficulty} · ${BALANCE_VARIANTS[variant].label}`)
      out.push('')
      out.push(
        table(
          [
            'Strategy',
            'Coin',
            'Min coin',
            'Patrons',
            'Satisf.',
            'Clean',
            'Damage',
            'Morale',
            'Days@100',
            'Cards/day',
            'Choices/day',
            'Streak',
            'Identity',
          ],
          slice.map((cell) => [
            cell.botId,
            `${num(cell.metrics.finalCoin.median)} ±${num(cell.metrics.finalCoin.spread)}`,
            num(cell.metrics.minCoin.median),
            num(cell.metrics.totalPatrons.median),
            num(cell.metrics.meanSatisfaction.median),
            num(cell.metrics.meanCleanliness.median),
            num(cell.metrics.meanDamage.median),
            num(cell.metrics.meanMorale.median),
            num(cell.metrics.pressureDaysAtCeiling.median),
            num(cell.metrics.meanCardsPerDay.median),
            num(cell.metrics.meanChoicesPerDay.median),
            num(cell.metrics.longestFamilyStreak.median),
            cell.identityKeys.join(' / '),
          ]),
        ),
      )
      out.push('')

      const analysis = analyzeBalanceSlice(cells, difficulty, variant)
      out.push('**Leadership** (seed median; a strategy leading on every')
      out.push('outcome axis would be a balance failure under any objective):')
      out.push('')
      out.push(
        table(
          ['Strategy', 'Leads on', 'Trails on'],
          analysis.leadership.map((row) => [
            row.botId,
            row.leadsOn.join(', ') || '—',
            row.trailsOn.join(', ') || '—',
          ]),
        ),
      )
      out.push('')
      if (analysis.allStrategiesTied) {
        out.push(
          '- **Every strategy produced an identical outcome.** Expected for `no_action` (the bot controls no lever that variant pulls); a balance failure anywhere else.',
        )
      } else {
        out.push(
          `- Dominant strategy: **${analysis.dominantStrategy ?? 'none'}**`,
        )
        out.push(
          `- Strategies leading on nothing: ${analysis.deadStrategies.join(', ') || 'none'}`,
        )
      }
      out.push(
        `- Distinct identities: ${analysis.distinctIdentityKeys.join(', ') || '—'}`,
      )
      out.push(
        `- Distinct dominant customer groups: ${analysis.distinctDominantCustomerGroups.join(', ') || '—'}`,
      )
      if (analysis.noisyMetrics.length > 0) {
        out.push(
          `- **Seed noise exceeds the strategy gap on: ${analysis.noisyMetrics.join(', ')}** — do not rank on these without more seeds.`,
        )
      }
      out.push('')
    }
  }

  // Agency: does acting beat not acting?
  if (options.variants.includes('no_action')) {
    out.push('## Agency — does acting beat not acting?')
    out.push('')
    out.push(
      'Baseline is `no_action`. `DC-04` (the failure contract) cannot be',
    )
    out.push('written until this table has an answer.')
    out.push('')
    for (const variant of options.variants) {
      if (variant === 'no_action') continue
      const comparisons = compareVariants(cells, 'no_action', variant)
      if (comparisons.length === 0) continue
      const byMetric = new Map<BalanceMetricKey, { better: number; total: number }>()
      for (const row of comparisons) {
        const bucket = byMetric.get(row.metric) ?? { better: 0, total: 0 }
        bucket.total += 1
        if (row.improved) bucket.better += 1
        byMetric.set(row.metric, bucket)
      }
      out.push(`### ${BALANCE_VARIANTS[variant].label} vs no action`)
      out.push('')
      out.push(
        table(
          ['Metric', 'Strategies improved', 'Of'],
          OUTCOME_METRICS.map((metric) => {
            const bucket = byMetric.get(metric)
            return [metric, String(bucket?.better ?? 0), String(bucket?.total ?? 0)]
          }),
        ),
      )
      out.push('')
    }
  }

  // Difficulty ordering.
  if (options.difficulties.length === 3) {
    const orderings = checkDifficultyMonotonicity(cells)
    const inverted = orderings.filter((row) => !row.monotonic)
    out.push('## Difficulty ordering')
    out.push('')
    out.push(
      `${orderings.length - inverted.length} of ${orderings.length} bot × variant × metric orderings run easy → standard → hard in the expected direction.`,
    )
    if (inverted.length > 0) {
      out.push('')
      out.push('Inversions:')
      out.push('')
      out.push(
        table(
          ['Bot', 'Variant', 'Metric', 'Easy', 'Standard', 'Hard'],
          inverted
            .slice(0, 40)
            .map((row) => [
              row.botId,
              row.variant,
              row.metric,
              num(row.easy),
              num(row.standard),
              num(row.hard),
            ]),
        ),
      )
    }
    out.push('')
  }

  return out.join('\n')
}

// ----------------------------------------------------------------------
// Baseline diff
// ----------------------------------------------------------------------

type BaselineFile = {
  generatedAt?: string
  rows: BalanceRunMetrics[]
}

const DIFF_METRICS: ReadonlyArray<BalanceMetricKey> = [
  'finalCoin',
  'minCoin',
  'totalPatrons',
  'meanSatisfaction',
  'meanCleanliness',
  'meanDamage',
  'meanMorale',
  'pressureDaysAtCeiling',
  'meanCardsPerDay',
  'meanChoicesPerDay',
  'totalResponsesResolved',
]

function renderBaselineDiff(
  rows: BalanceRunMetrics[],
  baselinePath: string,
): string {
  const baseline = JSON.parse(
    readFileSync(baselinePath, 'utf8'),
  ) as BaselineFile
  const byCell = new Map(baseline.rows.map((row) => [row.cellId, row]))

  const changed: string[][] = []
  let missing = 0
  for (const row of rows) {
    const before = byCell.get(row.cellId)
    if (!before) {
      missing += 1
      continue
    }
    for (const metric of DIFF_METRICS) {
      const from = before[metric] as number
      const to = row[metric] as number
      if (from !== to) {
        changed.push([
          row.cellId,
          metric,
          num(from),
          num(to),
          num(to - from),
        ])
      }
    }
  }

  const out: string[] = []
  out.push('## Baseline diff')
  out.push('')
  out.push(`Baseline: \`${baselinePath}\`${baseline.generatedAt ? ` (generated ${baseline.generatedAt})` : ''}`)
  out.push('')
  if (missing > 0) {
    out.push(`${missing} cell(s) in this run have no baseline row.`)
    out.push('')
  }
  if (changed.length === 0) {
    out.push('No tracked metric moved.')
  } else {
    out.push(`${changed.length} metric(s) moved:`)
    out.push('')
    out.push(table(['Cell', 'Metric', 'Before', 'After', 'Δ'], changed))
  }
  return out.join('\n')
}

// ----------------------------------------------------------------------
// Main
// ----------------------------------------------------------------------

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2))
  const cells = buildCells(options)

  // Worker mode: run this shard's cells and emit rows as JSON.
  if (options.workerShard !== undefined && options.workerTotal !== undefined) {
    const shard = options.workerShard
    const total = options.workerTotal
    process.stdout.write(
      JSON.stringify(runCells(shardOf(cells, shard, total), options)),
    )
    return
  }

  if (options.estimate) {
    const simulations = new Set(cells.map(shardKeyOf)).size
    const seconds = simulations * SECONDS_PER_CELL
    const perWorker = seconds / options.concurrency
    process.stdout.write(
      [
        `cells:        ${cells.length}`,
        `  bots        ${options.bots.length}`,
        `  difficulty  ${options.difficulties.length}`,
        `  variants    ${options.variants.length}`,
        `  seeds       ${options.seeds.length}`,
        `simulations:  ${simulations} (bot-independent variants run once)`,
        `days/run:     ${options.days}`,
        `serial:       ~${Math.round(seconds / 60)} min`,
        `at -c ${options.concurrency}:  ~${Math.round(perWorker / 60)} min`,
        '',
      ].join('\n'),
    )
    return
  }

  const started = Date.now()
  const rows =
    options.concurrency > 1
      ? await runSharded(cells, options)
      : runCells(cells, options, (done, total) => {
          process.stderr.write(`\r${done}/${total} cells`)
        })
  process.stderr.write(
    `\ndone in ${Math.round((Date.now() - started) / 1000)}s\n`,
  )

  let output: string
  if (options.format === 'json') {
    const payload = { generatedAt: new Date().toISOString(), rows }
    // Committed baselines are machine-read and diffed by this script, not
    // by eye, so `--compact` keeps them to a third of the pretty-printed
    // size in the repository.
    output = options.compact
      ? JSON.stringify(payload)
      : JSON.stringify(payload, null, 2)
  } else {
    output = renderMarkdown(rows, options)
    if (options.baseline) {
      output += `\n\n${renderBaselineDiff(rows, options.baseline)}\n`
    }
  }

  if (options.out) {
    mkdirSync(dirname(options.out), { recursive: true })
    writeFileSync(options.out, output.endsWith('\n') ? output : `${output}\n`)
    process.stderr.write(`wrote ${options.out}\n`)
  } else {
    process.stdout.write(`${output}\n`)
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`)
  process.exitCode = 1
})
