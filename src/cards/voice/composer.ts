// Phase 95 — Card voice composer.
//
// Pure helpers that take title parts / body lines plus a tone hint
// array and return composed strings. Determinism via FNV-1a hash of a
// caller-supplied key (typically the seed id) — same inputs always
// produce the same output, so re-rendering a card never changes its
// text (cards-contract §5 rule 10).
//
// Composition rules:
//   - Word-budget enforced: titles clamp to 6 words, body lines to 12
//     words. The existing `clampWords` in `../cardHelpers.ts` is the
//     authority; this file re-uses the same shape.
//   - No facts invented. The composer never inserts named actors,
//     numbers, locations, or any fragment that isn't either drawn
//     from the input ingredient set or from a tone pool. Tone pool
//     fragments are flavour adjectives / connectors only.
//   - Tone pools that don't match any provided tone contribute
//     nothing. The composer degrades gracefully to the legacy
//     `formatTitle` / `buildBody` shape when no tones are given.

import { TONE_POOLS, EMPTY_STATE_POOLS } from './tonePools'
import { fnvIndex } from '../../sim/utils/fnv'

const MAX_TITLE_WORDS = 6
const MAX_BODY_LINES = 3
const MAX_BODY_WORDS_PER_LINE = 12

export type ComposeOpts = {
  /** Tones in priority order. Earlier entries are tried first. */
  toneHints?: ReadonlyArray<string>
  /** Stable key (seed id, etc.) for deterministic picks. */
  key: string
}

// Phase 123 / ISSUE-092: the FNV-1a helper moved to
// `src/sim/utils/fnv.ts` so the compose slice and this composer share
// one implementation. The `__internal.fnvIndex` re-export at the bottom
// of this file preserves the existing test surface.

// ---------- Word ops ----------

function clampWords(s: string, max: number): string {
  const words = s.trim().split(/\s+/).filter(Boolean)
  if (words.length <= max) return words.join(' ')
  return words.slice(0, max).join(' ') + '…'
}

function joinWords(parts: ReadonlyArray<string | undefined>): string {
  return parts.filter((p): p is string => Boolean(p && p.trim().length > 0))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// ---------- Pool picking ----------

/**
 * Pick a deterministic fragment from the first matching tone pool.
 * Returns `undefined` when no tone matches a known pool, when the
 * matching pool is empty for `kind`, or when `tones` is empty.
 *
 * `kind` selects which slot within the `TonePool` to read.
 */
export function pickFromPool(
  kind: 'prefixAdjectives' | 'bodyConnectors' | 'closingFlavour',
  tones: ReadonlyArray<string> | undefined,
  key: string,
): string | undefined {
  if (!tones || tones.length === 0) return undefined
  for (const tone of tones) {
    const pool = TONE_POOLS[tone]
    if (!pool) continue
    const slot = pool[kind]
    if (!slot || slot.length === 0) continue
    // Different sub-keys per slot so a single tone produces variation
    // across title vs body. Same input still ⇒ same output.
    return slot[fnvIndex(`${key}::${kind}::${tone}`, slot.length)]!
  }
  return undefined
}

// ---------- Title ----------

/**
 * Compose a card title from raw parts plus optional tone-driven
 * prefix. Honours the 6-word title cap and falls back to the legacy
 * join behaviour when no tone matches a pool.
 */
export function composeTitle(
  parts: ReadonlyArray<string | undefined>,
  opts: ComposeOpts,
): string {
  const base = joinWords(parts)
  if (!base) return ''
  const prefix = pickFromPool('prefixAdjectives', opts.toneHints, opts.key)
  if (!prefix) return clampWords(base, MAX_TITLE_WORDS)
  // Avoid stuttering: if the base already starts with the prefix word
  // (case-insensitive), skip the prefix.
  const firstBaseWord = base.split(/\s+/, 1)[0] ?? ''
  if (
    prefix.toLowerCase() === firstBaseWord.toLowerCase() ||
    base.toLowerCase().startsWith(prefix.toLowerCase() + ' ')
  ) {
    return clampWords(base, MAX_TITLE_WORDS)
  }
  return clampWords(`${prefix} ${base}`, MAX_TITLE_WORDS)
}

// ---------- Body ----------

/**
 * Compose card body lines from raw line candidates. The first non-
 * empty line gets an optional tone-driven connector prefix; remaining
 * lines pass through unchanged. Honours the 3-line cap and 12-word
 * per-line cap. Falls back to the legacy `buildBody` shape when no
 * tone matches a pool.
 */
export function composeBody(
  lines: ReadonlyArray<string | undefined>,
  opts: ComposeOpts,
): string[] {
  const cleaned: string[] = []
  for (const line of lines) {
    if (!line) continue
    const trimmed = line.trim()
    if (!trimmed) continue
    cleaned.push(trimmed)
    if (cleaned.length >= MAX_BODY_LINES) break
  }
  if (cleaned.length === 0) return []

  const connector = pickFromPool('bodyConnectors', opts.toneHints, opts.key)
  const first = cleaned[0]!
  if (connector) {
    // Insert the connector at the start of the first line, comma-
    // separated. Cap to 12 words after the merge.
    const merged = `${connector}, ${first}`
    cleaned[0] = clampWords(merged, MAX_BODY_WORDS_PER_LINE)
  } else {
    cleaned[0] = clampWords(first, MAX_BODY_WORDS_PER_LINE)
  }
  for (let i = 1; i < cleaned.length; i += 1) {
    cleaned[i] = clampWords(cleaned[i]!, MAX_BODY_WORDS_PER_LINE)
  }
  return cleaned
}

// ---------- Empty state ----------

/**
 * Compose an empty-state line for the day-screen beats and report
 * empty states. Deterministic per `key`. Returns the bare placeholder
 * for the kind when the pool is empty (defensive — should never
 * happen with the shipped pools).
 */
export function composeEmpty(
  kind: 'morning' | 'service' | 'closing' | 'header' | 'quiet',
  key: string,
): string {
  const pool = EMPTY_STATE_POOLS[kind]
  if (!pool || pool.length === 0) return ''
  return pool[fnvIndex(`${key}::empty::${kind}`, pool.length)]!
}

// Re-exports for tests / introspection.
export const __internal = { fnvIndex, clampWords }
