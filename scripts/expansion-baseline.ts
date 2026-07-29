// Expansion arc / Phase 0 (ISSUE-170, repo phase 207) — baseline probe I/O.
//
// The probes themselves live in `src/sim/testing/expansionBaseline.ts` (pure,
// headless, no fs). This script is the only thing that reads and writes
// `docs/plans/expansion/baseline-probes.json`.
//
//   npm run baseline:probes            re-run every route and diff against the file
//   npm run baseline:probes -- --write re-freeze the file (do this deliberately)
//
// `--write` is how a later phase records an intended behavior change: rerun,
// commit the JSON diff alongside the code, and the diff is the evidence of
// what moved. Never run it to make a red test go green.

import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  buildBaselineProbeFile,
  type BaselineProbeFile,
} from '../src/sim/testing/expansionBaseline'

export const REPO_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
export const BASELINE_PROBE_PATH = join(REPO_ROOT, 'docs/plans/expansion/baseline-probes.json')

export function readBaselineProbeFile(path: string = BASELINE_PROBE_PATH): BaselineProbeFile {
  return JSON.parse(readFileSync(path, 'utf8')) as BaselineProbeFile
}

export function serializeBaselineProbeFile(file: BaselineProbeFile): string {
  return `${JSON.stringify(file, null, 2)}\n`
}

function main(argv: string[]): number {
  const built = buildBaselineProbeFile()

  if (argv.includes('--write')) {
    writeFileSync(BASELINE_PROBE_PATH, serializeBaselineProbeFile(built), 'utf8')
    process.stdout.write(
      `wrote ${Object.keys(built.snapshots).length} baseline probes to ${BASELINE_PROBE_PATH}\n`,
    )
    return 0
  }

  let frozen: BaselineProbeFile
  try {
    frozen = readBaselineProbeFile()
  } catch (err) {
    process.stderr.write(
      `baseline probes: cannot read ${BASELINE_PROBE_PATH} (${(err as Error).message}).\n` +
        `Run with --write to create it.\n`,
    )
    return 1
  }

  const drifted: string[] = []
  if (frozen.version !== built.version) {
    process.stderr.write(
      `baseline probes: file version ${frozen.version} != code version ${built.version}; re-write the file.\n`,
    )
    return 1
  }
  for (const routeId of Object.keys(built.snapshots)) {
    const a = JSON.stringify(frozen.snapshots[routeId])
    const b = JSON.stringify(built.snapshots[routeId])
    if (a !== b) drifted.push(routeId)
  }
  for (const routeId of Object.keys(frozen.snapshots)) {
    if (!built.snapshots[routeId]) drifted.push(`${routeId} (frozen but no longer a route)`)
  }

  process.stdout.write(
    `baseline probes: ${Object.keys(built.snapshots).length} routes, ${drifted.length} drifted\n`,
  )
  if (drifted.length > 0) {
    for (const routeId of drifted) process.stderr.write(`  ! ${routeId}\n`)
    process.stderr.write(
      'If the change is intended, re-run with --write and commit the JSON diff with the code.\n',
    )
    return 1
  }
  return 0
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (invokedDirectly) process.exit(main(process.argv.slice(2)))
