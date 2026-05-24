// Phase 123 / ISSUE-092 — Living Cast arc, Phase C.
//
// Shared FNV-1a string-hash helper. Used wherever the codebase needs a
// deterministic pick from a small pool keyed by a stable string (typically
// a seed id) — descriptor pools and the compose slice's snippet
// tie-break. Same key + same modulo always returns the same index, so
// re-views of the same seed produce stable text.

export function fnvIndex(key: string, modulo: number): number {
  if (modulo <= 0) return 0
  let hash = 0x811c9dc5
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash % modulo
}
