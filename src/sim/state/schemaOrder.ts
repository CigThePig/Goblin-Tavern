import type { z } from 'zod'

// Expansion Phase 7 §5.10 — key order is part of the reload contract.
//
// A save is rehydrated by parsing it with its Zod schema, and Zod emits keys
// in the SCHEMA's declaration order. A record built in memory keeps its own
// insertion order instead — and `{ ...record, newKey: value }` appends a key
// that was previously absent rather than putting it where the schema does.
//
// Ordinarily that difference is invisible. It stops being invisible in the
// diff layer, which stringifies a whole module slice into a change entry's
// `readable`: two objects with the same contents in different key orders
// produce different strings, so a resumed day's report stops matching an
// uninterrupted one. That is the §5.10 failure the R11 durable-progress gate
// exists to catch, and chasing it construction site by construction site is
// how it comes back.
//
// Normalising THROUGH THE SCHEMA is what makes the agreement structural: the
// in-memory record now takes exactly the shape a reloaded one takes, because
// it is produced by the same parse. A schema that gains a field in the middle
// stays correct with no second list to remember to update.
//
// Cost is one parse per record write. These are per-day domain writes (a
// tenancy, a loan, an inspection case), not per-patron loops.
export function inSchemaOrder<T>(schema: z.ZodType<unknown>, value: T): T {
  const parsed = schema.safeParse(value)
  // A record that does not satisfy its own schema is a bug for the module's
  // validator to report with a path and a code, not for this helper to throw
  // on: dropping the write here would lose state and turn a reportable
  // inconsistency into a silent one.
  return parsed.success ? (parsed.data as T) : value
}
