// Phase 117 / ISSUE-078 — JSON-pointer → human string for diff display.
//
// The engine's `pushNumericChange` constructs the `readable` field as
// `${path} ${before} → ${after} (${direction}${delta})`, e.g.
// `stock.ale.quantity 80 → 0 (-80)`. That string is unhelpful in the
// player-facing report. `humanizePath` parses the path through a small
// pattern table and produces a label like "Ale stock"; `humanizeDiff`
// composes the label with the existing numeric values and typographic
// minus, producing "Ale stock: 80 → 0 (−80)".
//
// Engine output is unchanged — `readable` stays byte-identical so
// server-side tests and log forwarding continue to see the raw form.
// The projection layer adds `humanReadable` alongside, and the Svelte
// template renders the humanized field.

import { idLabel, humanizeId, type IdCategory } from './idLabel'
import type { ReportDiffLine } from '../types'

const MINUS = '−' // U+2212 MINUS SIGN, not a hyphen-minus

/**
 * Convert a JSON-pointer-style diff path into a player-facing label.
 *
 * Examples:
 *   "coin"                              → "Coin"
 *   "reputation.tasty"                  → "Tasty reputation"
 *   "stock.ale.quantity"                → "Ale stock"
 *   "stock.ale.quality"                 → "Ale quality"
 *   "stock.ale.spoilage"                → "Ale spoilage"
 *   "pressures.staff_loyalty_risk.value" → "Staff Loyalty Risk"
 *   "areas.main_room.cleanliness"       → "Main Room cleanliness"
 *   (unknown)                           → humanizeId(last segment)
 */
export function humanizePath(path: string): string {
  if (!path) return ''
  if (path === 'coin') return 'Coin'

  const segments = path.split('.')

  if (segments.length === 2 && segments[0] === 'reputation') {
    return `${idLabel('reputation', segments[1]!)} reputation`
  }

  if (segments.length === 3 && segments[0] === 'stock') {
    const id = segments[1]!
    const field = segments[2]!
    const name = idLabel('stock', id)
    if (field === 'quantity') return `${name} stock`
    if (field === 'quality') return `${name} quality`
    if (field === 'spoilage') return `${name} spoilage`
    return `${name} ${field}`
  }

  if (segments.length === 3 && segments[0] === 'pressures' && segments[2] === 'value') {
    return idLabel('pressure', segments[1]!)
  }

  if (segments.length === 3 && segments[0] === 'areas') {
    const name = idLabel('area', segments[1]!)
    const field = idLabel('areaField', segments[2]!)
    return `${name} ${field}`
  }

  if (path.startsWith('staff.')) {
    return humanizeId(segments[segments.length - 1] ?? path)
  }

  // Fallback: humanize the last segment. Avoids leaking dots.
  return humanizeId(segments[segments.length - 1] ?? path)
}

/**
 * Drilldown sheet title for a diff path. Distinct from `humanizePath`
 * for paths where the title benefits from a category prefix (the row
 * in the daily report already groups context, but the drilldown sheet
 * is standalone).
 */
export function humanizeDiffTitle(path: string): string {
  return humanizePath(path)
}

/**
 * Format a numeric delta with a typographic minus sign and explicit
 * direction prefix: `+12`, `−12`, `0`.
 */
function formatDelta(delta: number): string {
  if (!Number.isFinite(delta) || delta === 0) return '0'
  if (delta > 0) return `+${delta}`
  return `${MINUS}${Math.abs(delta)}`
}

function formatValue(value: unknown): string {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return String(value)
    // Keep one decimal place if the engine emitted one.
    return Number.isInteger(value) ? String(value) : value.toFixed(1)
  }
  if (typeof value === 'string') return value
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (value === null || value === undefined) return '—'
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

/**
 * Build the player-facing diff line. Composes the humanized path
 * label with before/after/delta:
 *
 *   "Ale stock: 80 → 0 (−80)"
 *   "Staff Loyalty Risk: 0 → 75 (+75)"
 *   "Coin: 100 → 523 (+423)"
 *
 * For non-numeric diffs (rare in the current sim), falls back to a
 * `label: before → after` shape with no parenthesised delta.
 */
export function humanizeDiff(d: ReportDiffLine): string {
  const label = humanizePath(d.path)
  const before = formatValue(d.before)
  const after = formatValue(d.after)
  if (Number.isFinite(d.delta) && d.delta !== 0) {
    return `${label}: ${before} → ${after} (${formatDelta(d.delta)})`
  }
  return `${label}: ${before} → ${after}`
}

/**
 * Re-export `idLabel` for sites that import a single labels surface.
 */
export type { IdCategory }
