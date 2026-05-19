// Phase 119+120 / ISSUE-058+059 — Shared discriminated-union slot for
// projections wrapped in error-isolation try/catch. The shape originated
// in `ReportsScreen.svelte` (Phase 97 / ISSUE-057); extracting it here
// lets every wrapped derived across the web layer share one type and
// one helper instead of redefining the same pattern at each call site.

export type ProjectionSlot<T> =
  | { ok: 'success'; data: T }
  | { ok: 'empty' }
  | { ok: 'error'; error: string }

export function safeProject<T>(fn: () => T): ProjectionSlot<T> {
  try {
    return { ok: 'success', data: fn() }
  } catch (err) {
    return {
      ok: 'error',
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
