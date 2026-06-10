// Dev/test-only write guard for query helpers.
//
// SimContext query helpers (`getCulture`, `getRegular`, `getMemory`, …)
// return references into the live `runtime.current` state. A module that
// mutated such a reference in place — `ctx.getCulture(id).comfort -= 5` —
// would change state outside the sanctioned `ctx.modify*` path with no
// cause record and no error. No current caller does this, but the contract
// is otherwise unguarded across the modules.
//
// `freezeInDev` hardens that contract under tests: in a dev/test process it
// shallow-freezes the returned record (and, for arrays, the array plus each
// element one level deep) so an accidental write throws loudly under Vitest.
// In a production build it is a no-op with zero cost — freezing only adds a
// throw-on-write guard, never changes a value, so simulation output and
// determinism are identical with or without it.

// Computed once at module load. Guards `typeof process` so the web/Vite
// build (where `process` may be undefined) safely treats it as production.
const IS_DEV_OR_TEST: boolean =
  typeof process !== 'undefined' &&
  (process.env?.NODE_ENV === 'test' || process.env?.NODE_ENV === 'development')

export function freezeInDev<T>(value: T): T {
  if (!IS_DEV_OR_TEST || value === null || typeof value !== 'object') {
    return value
  }
  if (Array.isArray(value)) {
    for (const element of value) {
      if (element !== null && typeof element === 'object') {
        Object.freeze(element)
      }
    }
  }
  Object.freeze(value)
  return value
}
