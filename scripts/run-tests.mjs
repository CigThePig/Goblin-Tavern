#!/usr/bin/env node
// Phase 74 / ISSUE-034 — `npm test` wrapper that fails the run when a
// vitest worker drops mid-suite or when the collected-vs-run test count
// disagrees. Vitest 1.6 reports both states in its summary but still
// exits 0, which lets ~58 tests silently disappear from CI signal.
//
// Why a wrapper instead of a vitest plugin: the failure modes we need
// to catch (worker exit, unhandled rejection in pool host, collected
// tests not executed) span the parent process and the worker pool. The
// wrapper sees both — vitest exit code and stdout/stderr summary —
// and a single Node script is easier to audit than a custom reporter.

import { spawn } from 'node:child_process'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

// Pull `--tier=<fast|heavy|all>` out of the args and pass it to vitest via the
// TEST_TIER env var (vitest.config.ts reads it). Doing the env injection here —
// rather than `TEST_TIER=… vitest` in package.json — keeps the npm scripts
// cross-platform (no shell-specific env syntax). Everything else forwards to
// vitest unchanged, so `npm test -- tests/sim/foo.test.ts` still works.
const rawArgs = process.argv.slice(2)
let tier = process.env.TEST_TIER
const vitestArgs = []
for (const arg of rawArgs) {
  const match = /^--tier=(.+)$/.exec(arg)
  if (match) tier = match[1]
  else vitestArgs.push(arg)
}

const childEnv = { ...process.env }
if (tier) childEnv.TEST_TIER = tier

const args = [fileURLToPath(new URL('../node_modules/vitest/vitest.mjs', import.meta.url)), 'run', ...vitestArgs]

// Inherit stdio for live output, but also capture so we can post-parse
// the summary. Use a tee via pipe + write-through.
const child = spawn(process.execPath, args, {
  stdio: ['inherit', 'pipe', 'pipe'],
  env: childEnv,
})

let stdoutBuf = ''
let stderrBuf = ''

child.stdout.on('data', (chunk) => {
  const str = chunk.toString('utf8')
  process.stdout.write(str)
  stdoutBuf += str
})
child.stderr.on('data', (chunk) => {
  const str = chunk.toString('utf8')
  process.stderr.write(str)
  stderrBuf += str
})

child.on('close', (code) => {
  const combined = stdoutBuf + stderrBuf
  const failures = []

  if (code !== 0) {
    failures.push(`vitest exited with code ${code}`)
  }

  // "Test Files  X passed (Y)" — X must equal Y.
  const testFilesMatch = combined.match(
    /Test Files\s+(?:(\d+)\s+failed\s+\|\s+)?(\d+)\s+passed\s+\((\d+)\)/,
  )
  if (testFilesMatch) {
    const passed = Number(testFilesMatch[2]) + Number(testFilesMatch[1] ?? 0)
    const collected = Number(testFilesMatch[3])
    if (passed !== collected) {
      failures.push(
        `test files: collected ${collected} but only ${passed} ran (gap = ${collected - passed})`,
      )
    }
  }

  // "Tests  X passed (Y)" — same shape.
  const testsMatch = combined.match(
    /\bTests\s+(?:(\d+)\s+failed\s+\|\s+)?(\d+)\s+passed\s+\((\d+)\)/,
  )
  if (testsMatch) {
    const passed = Number(testsMatch[2]) + Number(testsMatch[1] ?? 0)
    const collected = Number(testsMatch[3])
    if (passed !== collected) {
      failures.push(
        `tests: collected ${collected} but only ${passed} ran (gap = ${collected - passed})`,
      )
    }
  }

  // A process that exits without a summary has not demonstrated a passing
  // suite. In particular, never silently accept a dropped launcher process.
  if (!testFilesMatch || !testsMatch) failures.push('vitest did not report a complete test summary')

  // Unhandled errors / worker crashes — vitest reports these but exits 0.
  if (/Vitest caught \d+ unhandled error/i.test(combined)) {
    failures.push('vitest reported one or more unhandled errors during the run')
  }
  if (/Worker exited unexpectedly/i.test(combined)) {
    failures.push('a vitest worker exited unexpectedly mid-run')
  }

  if (failures.length > 0) {
    process.stderr.write('\n')
    process.stderr.write('npm test: failing the run for the following reasons:\n')
    for (const reason of failures) process.stderr.write(`  - ${reason}\n`)
    process.exit(1)
  }

  process.exit(code ?? 0)
})

child.on('error', (err) => {
  process.stderr.write(`failed to launch vitest: ${err.message}\n`)
  process.exit(1)
})
