// Phase 199 / audit Wave 0 (P2-RT-001) — the save-boundary serializer.
//
// The store's fields are Svelte `$state`, i.e. deep proxies in the
// browser. `structuredClone` rejects a Proxy outright (`DataCloneError`),
// which is what made every autosave, snapshot and export throw before this
// existed. `$state.snapshot` would fix the browser, but it is a rune —
// identity under the SSR compile the test runner uses — so it cannot be
// asserted on. This module is plain TypeScript and behaves the same in
// the browser, in jsdom and in node, which makes the guarantee testable.
//
// `toPlainSaveData` reproduces `JSON.stringify` semantics exactly, because
// what leaves here is about to be stringified into localStorage:
//
//   - `toJSON()` is honoured (Date → ISO string);
//   - object keys whose value is `undefined` or a function are dropped;
//   - `undefined`, functions and symbols inside arrays become `null`;
//   - everything else is rebuilt as a fresh, plain, unproxied value.
//
// Anything that cannot survive that round trip — `Map`, `Set`, a class
// instance, `BigInt`, `Symbol`, a non-finite number, a cycle — throws a
// `SaveSerializationError` naming the path instead of silently persisting
// `{}` where state used to be. `TavernState` is required to be plain JSON
// (architectural rule 2); this is where that rule is enforced, at the one
// boundary where breaking it costs the player their run.

/** Thrown when a value cannot survive the save's JSON round trip. */
export class SaveSerializationError extends Error {
  readonly path: string

  constructor(path: string, detail: string) {
    super(`cannot serialize save data at ${path || '<root>'}: ${detail}`)
    this.name = 'SaveSerializationError'
    this.path = path
  }
}

type Seen = Set<unknown>

/**
 * Deep, proxy-safe, JSON-faithful clone. The returned value shares no
 * reference with the input and contains only plain objects, arrays and
 * primitives, so `structuredClone`, `postMessage` and `JSON.stringify` all
 * accept it.
 */
export function toPlainSaveData<T>(value: T): T {
  return clone(value, '', new Set()) as T
}

function clone(value: unknown, path: string, seen: Seen): unknown {
  const unwrapped = applyToJson(value, path)

  if (unwrapped === null) return null
  const t = typeof unwrapped
  if (t === 'string' || t === 'boolean') return unwrapped
  if (t === 'number') {
    if (!Number.isFinite(unwrapped as number)) {
      // JSON.stringify would quietly write `null` here, turning a broken
      // number into a plausible-looking absent value on reload.
      throw new SaveSerializationError(path, `non-finite number (${String(unwrapped)})`)
    }
    return unwrapped
  }
  if (t === 'undefined') return undefined
  if (t === 'bigint') throw new SaveSerializationError(path, 'bigint')
  if (t === 'symbol') throw new SaveSerializationError(path, 'symbol')
  if (t === 'function') return undefined
  if (t !== 'object') throw new SaveSerializationError(path, `unsupported type ${t}`)

  if (seen.has(unwrapped)) {
    throw new SaveSerializationError(path, 'circular reference')
  }
  seen.add(unwrapped)
  try {
    if (Array.isArray(unwrapped)) {
      const out: unknown[] = new Array(unwrapped.length)
      for (let i = 0; i < unwrapped.length; i++) {
        const item = clone(unwrapped[i], `${path}[${i}]`, seen)
        // Matches JSON.stringify: an array slot that cannot be represented
        // becomes null rather than shifting every later index.
        out[i] = item === undefined ? null : item
      }
      return out
    }

    // Narrowing through the `t` alias above leaves TS with `{} | undefined`;
    // every non-object branch has already returned or thrown.
    const obj = unwrapped as object
    if (!isPlainObject(obj)) {
      throw new SaveSerializationError(path, describeExotic(obj))
    }

    const out: Record<string, unknown> = {}
    for (const key of Object.keys(unwrapped as Record<string, unknown>)) {
      const item = clone(
        (unwrapped as Record<string, unknown>)[key],
        path ? `${path}.${key}` : key,
        seen,
      )
      if (item !== undefined) out[key] = item
    }
    return out
  } finally {
    seen.delete(unwrapped)
  }
}

/**
 * Honour a `toJSON()` hook the way `JSON.stringify` does, so a `Date`
 * serializes to its ISO string rather than tripping the exotic-object
 * check below. Reading the property goes through any proxy, as intended.
 */
function applyToJson(value: unknown, path: string): unknown {
  if (value === null || typeof value !== 'object') return value
  const toJSON = (value as { toJSON?: unknown }).toJSON
  if (typeof toJSON !== 'function') return value
  try {
    return (toJSON as (key?: string) => unknown).call(value)
  } catch (err) {
    throw new SaveSerializationError(
      path,
      `toJSON() threw: ${err instanceof Error ? err.message : String(err)}`,
    )
  }
}

/**
 * True for an object literal or a proxy over one. Svelte's `$state` proxy
 * reports the target's prototype through `getPrototypeOf`, so a proxied
 * literal passes; a class instance, `Map`, `Set` or `Date` does not.
 */
function isPlainObject(value: object): boolean {
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

function describeExotic(value: object): string {
  const tag = Object.prototype.toString.call(value).slice(8, -1)
  if (tag === 'Map' || tag === 'Set') {
    return `${tag} — save data must be plain JSON (convert it at the boundary)`
  }
  const name = value.constructor?.name
  return name && name !== 'Object'
    ? `${name} instance — save data must be plain JSON`
    : `${tag} — save data must be plain JSON`
}
