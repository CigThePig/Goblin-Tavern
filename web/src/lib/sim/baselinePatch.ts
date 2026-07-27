// Phase 199 / audit Wave 0 — persisting the start-of-day baseline cheaply.
//
// The store holds `dayBaseline`, the `TavernState` as it stood before
// Segment A. The engine needs it to bracket the daily report's full-day
// diff start-of-day → end-of-day across the three per-segment runtimes
// (GATE B, day-clock contract §4.2). Lose it to a mid-day reload and the
// resumed day's report shows a partial diff.
//
// Persisting it as a second `TavernState` is what the 2026-06-11 audit §1
// removed: `state` alone measures 194 KB on day 1, 1 005 KB on day 14 and
// 1 691 KB on day 28, so a second copy crossed the ~5 MB origin quota from
// about day 22. But the two states are nearly identical mid-day — they
// differ mostly by appends to `attribution.attributions`, `causes` and
// `history` — so what the envelope stores is the *difference*, against the
// `state` it already carries:
//
//   day 28, segment B:  baseline 1 585 KB  →  patch 218 KB
//
// The encoding is deliberately dull. Per node, one of:
//
//   undefined      identical — reuse the current subtree as-is
//   { v }          take the baseline value verbatim
//   { o, k? }      plain object: per-key patches, `{ d: true }` to delete,
//                  `k` the baseline's key order when it differs
//   { a, i? }      array: baseline length `a`, plus per-index patches `i`
//
// `k` exists because key order is observable downstream: the day-diff
// walks state in key order, so a baseline rebuilt with the current
// state's ordering would produce the same changes in a different sequence
// and a resumed day's report would list them in a different order than an
// uninterrupted one. It is only emitted where the order actually differs.
//
// Per-index array patches are what make it small: `attributions` grows by
// appends *and* edits a handful of earlier entries, so a prefix/truncate
// encoding would fall back to verbatim (935 KB) where this one emits a
// length and a few entries.
//
// The codec assumes both sides are plain JSON, which `TavernState` is
// required to be (architectural rule 2). It never mutates its inputs and
// `applyBaselinePatch` returns fresh plain data.
//
// Equality is JSON equality — the form the patch is stored in. The one
// visible consequence is `-0`, which the encoder treats as equal to `0`
// and so does not carry. That is not a loss: `JSON.stringify` collapses
// `-0` to `0` for the envelope's `state` too, so the reconstructed
// baseline and the state it is diffed against agree either way.

import type { TavernState } from '../../../../src/sim/state/TavernState'

export type BaselinePatch =
  | { v: unknown }
  | { o: Record<string, BaselinePatch | { d: true }>; k?: string[] }
  | { a: number; i?: Record<string, BaselinePatch> }

/**
 * Encode `baseline` as a patch against `current`. Returns `undefined` when
 * the two are already equal — the caller then stores nothing and
 * reconstruction reuses `current`.
 */
export function encodeBaselinePatch(
  current: unknown,
  baseline: unknown,
): BaselinePatch | undefined {
  return encode(current, baseline)
}

/**
 * Rebuild the baseline from `current` plus `patch`. Returns a fresh plain
 * value; `current` is left untouched.
 */
export function applyBaselinePatch(
  current: TavernState,
  patch: BaselinePatch | undefined,
): TavernState {
  return apply(current, patch) as TavernState
}

/**
 * Shape guard for a patch read back out of storage. A save is
 * player-supplied data by the time it returns (export/import), so the
 * patch is validated before it is applied rather than trusted.
 */
export function isBaselinePatch(value: unknown): value is BaselinePatch {
  if (!isPlainObject(value)) return false
  const keys = Object.keys(value)
  if (keys.length === 1 && keys[0] === 'v') return true
  if (keys.includes('o') && keys.every((k) => k === 'o' || k === 'k')) {
    const o = (value as { o: unknown }).o
    if (!isPlainObject(o)) return false
    const k = (value as { k?: unknown }).k
    if (
      k !== undefined &&
      (!Array.isArray(k) || !k.every((entry) => typeof entry === 'string'))
    ) {
      return false
    }
    return Object.values(o).every(
      (entry) => isDeleteMarker(entry) || isBaselinePatch(entry),
    )
  }
  if (keys.includes('a') && keys.every((k) => k === 'a' || k === 'i')) {
    const a = (value as { a: unknown }).a
    if (typeof a !== 'number' || !Number.isSafeInteger(a) || a < 0) return false
    const i = (value as { i?: unknown }).i
    if (i === undefined) return true
    if (!isPlainObject(i)) return false
    return Object.entries(i).every(
      ([key, entry]) => isIndexKey(key, a) && isBaselinePatch(entry),
    )
  }
  return false
}

// ──────────────────────────────────────────────────────────────────

function encode(current: unknown, baseline: unknown): BaselinePatch | undefined {
  if (sameJson(current, baseline)) return undefined

  if (Array.isArray(current) && Array.isArray(baseline)) {
    const items: Record<string, BaselinePatch> = {}
    const shared = Math.min(current.length, baseline.length)
    for (let idx = 0; idx < shared; idx++) {
      const sub = encode(current[idx], baseline[idx])
      if (sub !== undefined) items[String(idx)] = sub
    }
    // Indices the baseline has and `current` does not: nothing to diff
    // against, so carry the value.
    for (let idx = current.length; idx < baseline.length; idx++) {
      items[String(idx)] = { v: baseline[idx] }
    }
    const hasItems = Object.keys(items).length > 0
    return hasItems ? { a: baseline.length, i: items } : { a: baseline.length }
  }

  if (isPlainObject(current) && isPlainObject(baseline)) {
    const out: Record<string, BaselinePatch | { d: true }> = {}
    let changed = false
    for (const key of Object.keys(current)) {
      if (key in baseline) continue
      // Present now, absent at start of day → drop it on reconstruction.
      out[key] = { d: true }
      changed = true
    }
    for (const key of Object.keys(baseline)) {
      const sub = encode((current as Record<string, unknown>)[key], baseline[key])
      if (sub === undefined) continue
      out[key] = sub
      changed = true
    }
    const baselineKeys = Object.keys(baseline)
    const needsOrder = !sameOrder(reconstructedKeys(current, out), baselineKeys)
    if (!changed && !needsOrder) return undefined
    return needsOrder ? { o: out, k: baselineKeys } : { o: out }
  }

  return { v: baseline }
}

function apply(current: unknown, patch: BaselinePatch | undefined): unknown {
  if (patch === undefined) return clonePlain(current)
  if ('v' in patch) return clonePlain(patch.v)

  if ('a' in patch) {
    const source = Array.isArray(current) ? current : []
    const out: unknown[] = new Array(patch.a)
    for (let idx = 0; idx < patch.a; idx++) {
      const sub = patch.i?.[String(idx)]
      out[idx] = sub === undefined ? clonePlain(source[idx]) : apply(source[idx], sub)
    }
    return out
  }

  const source = isPlainObject(current) ? current : {}
  const out: Record<string, unknown> = {}
  const order = patch.k ?? reconstructedKeys(source, patch.o)
  for (const key of order) {
    const sub = patch.o[key]
    if (isDeleteMarker(sub)) continue
    out[key] =
      sub === undefined ? clonePlain(source[key]) : apply(source[key], sub)
  }
  return out
}

/**
 * The key order `apply` would produce without an explicit `k`: the
 * current object's keys minus deletions, then any key the patch adds, in
 * the patch's own order.
 */
function reconstructedKeys(
  current: Record<string, unknown>,
  entries: Record<string, BaselinePatch | { d: true }>,
): string[] {
  const out: string[] = []
  for (const key of Object.keys(current)) {
    if (isDeleteMarker(entries[key])) continue
    out.push(key)
  }
  for (const key of Object.keys(entries)) {
    if (isDeleteMarker(entries[key])) continue
    if (key in current) continue
    out.push(key)
  }
  return out
}

function sameOrder(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  return a.every((key, idx) => key === b[idx])
}

function clonePlain(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(clonePlain)
  const out: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    out[key] = clonePlain(item)
  }
  return out
}

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isDeleteMarker(value: unknown): value is { d: true } {
  return isPlainObject(value) && value['d'] === true && Object.keys(value).length === 1
}

function isIndexKey(key: string, length: number): boolean {
  const idx = Number(key)
  return Number.isSafeInteger(idx) && idx >= 0 && idx < length
}
