// Phase 98 — Save export / import.
//
// Export: serialize the current `PersistedSession` to a JSON blob and
// trigger a download. The default file name encodes the in-game day
// number and the current calendar date so the file is self-labelling.
//
// Import: parse a user-provided JSON string through the same
// validator the autosave path uses (`validatePersistedSession`). The
// parsed session is returned but NOT applied — the caller (the
// More > Saves screen) gates the replace step behind an explicit
// confirm because import is destructive of any unsaved progress.
//
// DOM access is funneled through `globalThis` lookups so this file
// compiles cleanly under the main (non-DOM) tsconfig used by
// `npm run typecheck`; the actual browser-side calls happen via
// `tsconfig.web.json` and `svelte-check`.

import {
  validatePersistedSession,
  type PersistedSession,
  type ValidationOutcome,
} from './persistence'

export type ParseImportedResult =
  | { ok: true; session: PersistedSession; outcome: ValidationOutcome }
  | { ok: false; reason: string }

type DomDocument = {
  body: { appendChild(n: unknown): void }
  createElement(tag: string): {
    href: string
    download: string
    click(): void
    remove(): void
  }
}
type DomBlobCtor = new (parts: unknown[], opts?: { type?: string }) => unknown
type DomURL = {
  createObjectURL(b: unknown): string
  revokeObjectURL(u: string): void
}

function getDom(): {
  document: DomDocument | undefined
  Blob: DomBlobCtor | undefined
  URL: DomURL | undefined
} {
  const g = globalThis as {
    document?: DomDocument
    Blob?: DomBlobCtor
    URL?: DomURL
  }
  return { document: g.document, Blob: g.Blob, URL: g.URL }
}

/**
 * Trigger a browser download for the given session. No-op in
 * environments without `document` (test / SSR); callers should guard
 * accordingly.
 *
 * Filename format: `goblin-tavern-day-${day}-${YYYYMMDD}.json`.
 */
export function exportSessionToFile(session: PersistedSession): void {
  const dom = getDom()
  if (!dom.document || !dom.Blob || !dom.URL) return
  const payload = JSON.stringify(session, null, 2)
  const blob = new dom.Blob([payload], { type: 'application/json' })
  const url = dom.URL.createObjectURL(blob)
  const a = dom.document.createElement('a')
  a.href = url
  a.download = makeExportFilename(session)
  dom.document.body.appendChild(a)
  a.click()
  a.remove()
  // Free the object URL on the next tick. Calling revoke immediately
  // is fine in modern browsers but some older WebKit builds race the
  // download click — a short timeout is the safe form.
  const revoke: DomURL['revokeObjectURL'] = dom.URL.revokeObjectURL.bind(dom.URL)
  ;(globalThis as { setTimeout?: (cb: () => void, ms: number) => unknown }).setTimeout?.(
    () => revoke(url),
    1_000,
  )
}

/**
 * Build the filename used by `exportSessionToFile`. Exported for
 * testing — the function is pure and date-deterministic given a
 * `now` argument.
 */
export function makeExportFilename(
  session: PersistedSession,
  now: Date = new Date(),
): string {
  const day = session.state.calendar.totalDaysElapsed
  const y = now.getFullYear().toString().padStart(4, '0')
  const m = (now.getMonth() + 1).toString().padStart(2, '0')
  const d = now.getDate().toString().padStart(2, '0')
  return `goblin-tavern-day-${day}-${y}${m}${d}.json`
}

/**
 * Parse a JSON string into a validated `PersistedSession`. Returns
 * `{ ok: true, session }` on success or `{ ok: false, reason }` on
 * any parse / validation failure. The validator runs the same
 * migration + zod pipeline used by `loadSession`, so an exported
 * pre-Phase-98 save still imports cleanly.
 */
export function parseImportedSession(text: string): ParseImportedResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (err) {
    return {
      ok: false,
      reason: `Couldn't read that file as JSON: ${err instanceof Error ? err.message : 'unknown error'}`,
    }
  }

  const outcome = validatePersistedSession(parsed)
  if (outcome.kind === 'loaded') {
    return { ok: true, session: outcome.save, outcome }
  }
  if (outcome.kind === 'incompatible') {
    return {
      ok: false,
      reason: `Save version v${outcome.saveVersion} is not supported by this build.`,
    }
  }
  return { ok: false, reason: outcome.reason }
}

/**
 * Read the contents of a `File` as text. Wrapped here so the
 * MoreScreen can call a single helper without dealing with FileReader
 * semantics. Resolves to `string`; rejects with an Error on any
 * read failure.
 */
type DomFileReader = {
  readonly result: string | ArrayBuffer | null
  readonly error: unknown
  onload: ((this: DomFileReader) => unknown) | null
  onerror: ((this: DomFileReader) => unknown) | null
  readAsText(file: unknown): void
}
type FileReaderCtor = new () => DomFileReader

export function readFileAsText(file: unknown): Promise<string> {
  const FileReaderImpl = (globalThis as { FileReader?: FileReaderCtor }).FileReader
  if (!FileReaderImpl) {
    return Promise.reject(new Error('FileReader is not available.'))
  }
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReaderImpl()
    reader.onload = function () {
      const result = this.result
      if (typeof result === 'string') {
        resolve(result)
      } else {
        reject(new Error('File did not read as text.'))
      }
    }
    reader.onerror = function () {
      const err = this.error
      reject(err instanceof Error ? err : new Error('File read failed.'))
    }
    reader.readAsText(file)
  })
}
