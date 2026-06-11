// Phase 98 — Named save snapshots, on top of the existing autosave.
//
// Two storage slots:
//   `goblin-tavern:saves:v1`       — the index (array of SnapshotMeta)
//   `goblin-tavern:saves:v1:{id}`  — per-snapshot payload (PersistedSession)
//
// Splitting the index from the blobs means listing snapshots in the
// More > Saves screen doesn't deserialize every save. A snapshot's
// payload is the same `PersistedSession` shape the autosave uses, so
// `loadSnapshot(id)` returns a `ValidationOutcome` identical to what
// `loadSession()` produces — the hydrate path doesn't care which slot
// fed it.
//
// Storage budget guard: localStorage caps vary by browser (typically
// 5 MB). We measure used bytes before each write and refuse if the
// projected total would exceed 4 MB, surfacing a "delete an older
// snapshot first" message in the UI rather than catching a
// QuotaExceededError mid-write.

import {
  validatePersistedSession,
  type PersistedSession,
  type ValidationOutcome,
  type StorageLike,
} from './persistence'

export const SNAPSHOT_INDEX_KEY = 'goblin-tavern:saves:v1'
export const SNAPSHOT_PAYLOAD_PREFIX = 'goblin-tavern:saves:v1:'
export const SNAPSHOT_INDEX_VERSION = 1 as const

/** Default ceiling, ~4 MB — well under the typical 5 MB browser cap. */
export const SNAPSHOT_BUDGET_BYTES = 4 * 1024 * 1024
/** Warning threshold, ~3 MB. */
export const SNAPSHOT_WARN_BYTES = 3 * 1024 * 1024

export const MAX_NAMED_SNAPSHOTS = 5

export type SnapshotMeta = {
  id: string
  name: string
  createdAt: string
  day: number
  seedString: string
  note?: string
  /** Size of the persisted payload in bytes, for UI display. */
  bytes: number
}

export type Snapshot = SnapshotMeta & { session: PersistedSession }

export type SnapshotIndex = {
  version: typeof SNAPSHOT_INDEX_VERSION
  entries: SnapshotMeta[]
}

export type CreateSnapshotResult =
  | { ok: true; snapshot: SnapshotMeta }
  | { ok: false; reason: 'storage_budget' | 'storage_failed' | 'limit_reached' }

// ──────────────────────────────────────────────────────────────────
// Storage adapter — mirrors persistence.ts. We do NOT share its
// `activeStorage` slot because tests for snapshots want their own
// in-memory fixture independent of autosave fixtures.

let memoryFallback: Map<string, string> | undefined
let activeStorage: StorageLike | undefined

function defaultStorage(): StorageLike {
  if (typeof globalThis !== 'undefined') {
    const candidate = (globalThis as { localStorage?: StorageLike }).localStorage
    if (candidate) return candidate
  }
  if (!memoryFallback) memoryFallback = new Map<string, string>()
  const fallback = memoryFallback
  return {
    getItem: (k) => (fallback.has(k) ? fallback.get(k)! : null),
    setItem: (k, v) => fallback.set(k, v),
    removeItem: (k) => fallback.delete(k),
  }
}

/** Test seam — pass a fresh storage adapter between cases. */
export function setStorageForTesting(s: StorageLike | undefined): void {
  activeStorage = s
}

function getStorage(): StorageLike {
  return activeStorage ?? defaultStorage()
}

// ──────────────────────────────────────────────────────────────────
// ID generation. Snapshot ids are UI-side only — they never enter
// sim state. `crypto.randomUUID()` is fine here; the fallback is for
// older environments that don't expose the API.

let idCounter = 0

function makeSnapshotId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto
  if (c && typeof c.randomUUID === 'function') {
    return `snap_${c.randomUUID()}`
  }
  idCounter += 1
  return `snap_${Date.now()}_${idCounter}`
}

// ──────────────────────────────────────────────────────────────────
// Storage budget

/**
 * Sum the byte length of every key/value pair currently in the
 * configured storage. Used by the budget guard.
 *
 * Works against either a real `Storage` (which exposes `key(i)` and
 * `.length`) or our in-memory fallback (which doesn't). We probe the
 * adapter via duck typing and fall back to the in-memory map when
 * needed.
 */
export function estimateStorageBytes(): number {
  const storage = getStorage()

  // Real localStorage path: walk `key(i)` + `getItem`.
  // localStorage stores strings as UTF-16, so bytes = code-units × 2.
  type RealStorage = StorageLike & { length?: number; key?: (i: number) => string | null }
  const realStorage = storage as RealStorage
  if (typeof realStorage.length === 'number' && typeof realStorage.key === 'function') {
    let total = 0
    const len = realStorage.length
    for (let i = 0; i < len; i += 1) {
      const k = realStorage.key(i)
      if (k === null) continue
      const v = realStorage.getItem(k) ?? ''
      total += k.length + v.length
    }
    return total * 2
  }

  // In-memory fallback path.
  if (memoryFallback) {
    let total = 0
    for (const [k, v] of memoryFallback.entries()) {
      total += k.length + v.length
    }
    return total * 2
  }

  return 0
}

export function wouldExceedBudget(
  extraBytes: number,
  limit: number = SNAPSHOT_BUDGET_BYTES,
): boolean {
  return estimateStorageBytes() + extraBytes > limit
}

// ──────────────────────────────────────────────────────────────────
// Index I/O

function readIndex(): SnapshotIndex {
  const raw = getStorage().getItem(SNAPSHOT_INDEX_KEY)
  if (raw === null || raw === '') {
    return { version: SNAPSHOT_INDEX_VERSION, entries: [] }
  }
  try {
    const parsed = JSON.parse(raw) as Partial<SnapshotIndex>
    if (parsed.version !== SNAPSHOT_INDEX_VERSION || !Array.isArray(parsed.entries)) {
      return { version: SNAPSHOT_INDEX_VERSION, entries: [] }
    }
    const entries = parsed.entries.filter((e): e is SnapshotMeta => {
      return (
        typeof e === 'object' &&
        e !== null &&
        typeof (e as SnapshotMeta).id === 'string' &&
        typeof (e as SnapshotMeta).name === 'string' &&
        typeof (e as SnapshotMeta).createdAt === 'string' &&
        typeof (e as SnapshotMeta).day === 'number' &&
        typeof (e as SnapshotMeta).seedString === 'string'
      )
    })
    return { version: SNAPSHOT_INDEX_VERSION, entries }
  } catch {
    return { version: SNAPSHOT_INDEX_VERSION, entries: [] }
  }
}

function writeIndex(index: SnapshotIndex): boolean {
  try {
    getStorage().setItem(SNAPSHOT_INDEX_KEY, JSON.stringify(index))
    return true
  } catch {
    return false
  }
}

function payloadKey(id: string): string {
  return `${SNAPSHOT_PAYLOAD_PREFIX}${id}`
}

// ──────────────────────────────────────────────────────────────────
// Public API

export function listSnapshots(): SnapshotMeta[] {
  return readIndex().entries.slice().sort((a, b) => {
    if (a.createdAt === b.createdAt) return 0
    return a.createdAt < b.createdAt ? 1 : -1
  })
}

/**
 * Phase 89 / ISSUE-049 — Walk every storage key matching
 * `SNAPSHOT_PAYLOAD_PREFIX` and surface any payload whose id is missing
 * from the index. The reconstructed metadata uses the payload's own
 * data (totalDaysElapsed, simSeed) so the More → Saves screen can
 * surface a Recovered slot the player can load or delete.
 *
 * If the underlying storage adapter does not expose `length`/`key`
 * (in-memory fallback in tests), we still scan the in-memory map.
 */
export function findOrphanSnapshots(): SnapshotMeta[] {
  const indexed = new Set(readIndex().entries.map((e) => e.id))
  const storage = getStorage()
  type RealStorage = StorageLike & {
    length?: number
    key?: (i: number) => string | null
  }
  const real = storage as RealStorage

  const keys: string[] = []
  if (typeof real.length === 'number' && typeof real.key === 'function') {
    const len = real.length
    for (let i = 0; i < len; i += 1) {
      const k = real.key(i)
      if (k !== null) keys.push(k)
    }
  } else if (memoryFallback) {
    for (const k of memoryFallback.keys()) keys.push(k)
  }

  const orphans: SnapshotMeta[] = []
  for (const key of keys) {
    if (!key.startsWith(SNAPSHOT_PAYLOAD_PREFIX)) continue
    const id = key.slice(SNAPSHOT_PAYLOAD_PREFIX.length)
    if (id === '' || indexed.has(id)) continue
    const raw = storage.getItem(key)
    if (raw === null || raw === '') continue
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      continue
    }
    if (typeof parsed !== 'object' || parsed === null) continue
    const session = parsed as Partial<PersistedSession>
    const day = session.state?.calendar?.totalDaysElapsed ?? 0
    const seedString = session.simSeed ?? 'unknown'
    const createdAt =
      typeof session.savedAt === 'string'
        ? session.savedAt
        : new Date(0).toISOString()
    orphans.push({
      id,
      name: 'Recovered',
      createdAt,
      day,
      seedString,
      bytes: raw.length,
    })
  }
  return orphans
}

/**
 * Phase 89 / ISSUE-049 — Adopt orphan payloads back into the index so
 * the More → Saves screen can manage them like any other snapshot.
 * Returns the number of slots recovered. Refuses to push the index
 * past `MAX_NAMED_SNAPSHOTS`; remaining orphans stay accessible via
 * `findOrphanSnapshots()` until the player frees a slot.
 */
export function recoverOrphanSnapshots(): number {
  const orphans = findOrphanSnapshots()
  if (orphans.length === 0) return 0
  const index = readIndex()
  const room = Math.max(0, MAX_NAMED_SNAPSHOTS - index.entries.length)
  if (room === 0) return 0
  const adopted = orphans.slice(0, room)
  const nextIndex: SnapshotIndex = {
    version: SNAPSHOT_INDEX_VERSION,
    entries: [...adopted, ...index.entries],
  }
  if (!writeIndex(nextIndex)) return 0
  return adopted.length
}

export function createSnapshot(
  name: string,
  session: PersistedSession,
  note?: string,
): CreateSnapshotResult {
  const trimmedName = name.trim() || `Day ${session.state.calendar.totalDaysElapsed}`
  const index = readIndex()
  if (index.entries.length >= MAX_NAMED_SNAPSHOTS) {
    return { ok: false, reason: 'limit_reached' }
  }

  const payload = JSON.stringify(session)
  const id = makeSnapshotId()
  const key = payloadKey(id)
  const projected = key.length + payload.length

  if (wouldExceedBudget(projected)) {
    return { ok: false, reason: 'storage_budget' }
  }

  const meta: SnapshotMeta = {
    id,
    name: trimmedName,
    createdAt: new Date().toISOString(),
    day: session.state.calendar.totalDaysElapsed,
    seedString: session.simSeed,
    bytes: payload.length,
    ...(note && note.trim() ? { note: note.trim() } : {}),
  }

  try {
    getStorage().setItem(key, payload)
  } catch {
    return { ok: false, reason: 'storage_failed' }
  }
  const nextIndex: SnapshotIndex = {
    version: SNAPSHOT_INDEX_VERSION,
    entries: [meta, ...index.entries],
  }
  if (!writeIndex(nextIndex)) {
    // Index write failed — roll back the payload to keep slots tidy.
    try {
      getStorage().removeItem(key)
    } catch {
      // best-effort cleanup
    }
    return { ok: false, reason: 'storage_failed' }
  }

  return { ok: true, snapshot: meta }
}

export function loadSnapshot(id: string): ValidationOutcome {
  const raw = getStorage().getItem(payloadKey(id))
  if (raw === null || raw === '') {
    return { kind: 'invalid', reason: 'snapshot not found' }
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (err) {
    return {
      kind: 'invalid',
      reason: `malformed snapshot JSON: ${err instanceof Error ? err.message : 'unknown'}`,
    }
  }
  return validatePersistedSession(parsed)
}

export function deleteSnapshot(id: string): boolean {
  const index = readIndex()
  const next = index.entries.filter((e) => e.id !== id)
  if (next.length === index.entries.length) return false
  try {
    getStorage().removeItem(payloadKey(id))
  } catch {
    // ignore — still update the index
  }
  return writeIndex({ version: SNAPSHOT_INDEX_VERSION, entries: next })
}

export function renameSnapshot(id: string, name: string): boolean {
  const trimmed = name.trim()
  if (!trimmed) return false
  const index = readIndex()
  let changed = false
  const next = index.entries.map((e) => {
    if (e.id !== id) return e
    changed = true
    return { ...e, name: trimmed }
  })
  if (!changed) return false
  return writeIndex({ version: SNAPSHOT_INDEX_VERSION, entries: next })
}

export function getSnapshotMeta(id: string): SnapshotMeta | undefined {
  return readIndex().entries.find((e) => e.id === id)
}
