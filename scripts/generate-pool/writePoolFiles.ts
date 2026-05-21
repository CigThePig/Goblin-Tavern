// Phase 125 / ISSUE-094 — Living Cast arc, Phase E.
//
// The only side-effecting module in the pipeline. Writes one .ts file
// per accepted slot under `src/cards/compose/pools/<templateId>/`.
// Everything else in the pipeline is pure; this is where the
// "deterministic file emit" boundary becomes an actual write.

import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export type WritePoolFile = {
  /** Bare filename, e.g. `orderLine.ts`. The emitter chooses the
   *  basename so the writer just places the file. */
  basename: string
  contents: string
}

export type WritePoolFilesOptions = {
  /** Repo-relative root where pools live. Defaults to
   *  `src/cards/compose/pools`. */
  poolsRoot?: string
  templateId: string
  files: readonly WritePoolFile[]
  /** Repo-root absolute path. Resolved with `process.cwd()` when
   *  omitted. */
  cwd?: string
}

export async function writePoolFiles(
  opts: WritePoolFilesOptions,
): Promise<string[]> {
  const root = opts.cwd ?? process.cwd()
  const poolsRoot = opts.poolsRoot ?? 'src/cards/compose/pools'
  const targetDir = join(root, poolsRoot, opts.templateId)
  await mkdir(targetDir, { recursive: true })
  const written: string[] = []
  for (const file of opts.files) {
    const target = join(targetDir, file.basename)
    await writeFile(target, file.contents, 'utf8')
    written.push(target)
  }
  return written
}
