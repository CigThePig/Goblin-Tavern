// Phase 7 §7.3 / §7.4 — Reports and logs.
//
// Modules append `ReportSection`s during the `generateReports` phase (or via
// `ctx.addReportSection` from any hook); the engine collects them into
// `SimResult.reports`. `SimLog` is a lightweight diagnostic stream that
// modules can use during development; later phases (Phase 17 cause tracking,
// Phase 18 pressure tracking) will layer richer data on top of these
// structures.

export type ReportSection = {
  /** Stable identifier for the section (e.g. 'areas', 'stock'). */
  id: string
  /** The module that produced the section. */
  source: string
  /** Human-readable section title. */
  title: string
  /** Body lines, ready for joining with newlines. */
  lines: string[]
  /** Optional structured payload for downstream consumers. */
  data?: Record<string, unknown>
}

export type SimLogLevel = 'debug' | 'info' | 'warn' | 'error'

export type SimLog = {
  /** The module or engine subsystem that produced the log. */
  source: string
  /** Severity. Defaults to `'info'` when modules pass a bare string. */
  level: SimLogLevel
  /** Human-readable message. */
  message: string
  /** Optional structured payload. */
  data?: Record<string, unknown>
}
