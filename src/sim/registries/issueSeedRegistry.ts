import { Registry } from './Registry'

export type IssueSeedFamilyDefinition = {
  id: string
  label: string
  tags: string[]
}

// Legacy Phase 2 compatibility seam for issue-seed family metadata. Active
// seed generation uses `src/sim/modules/issues/issueSeedRegistry.ts` and the
// canonical issue seed module; this empty registry is retained for structure
// tests and older docs that assert the generic registry shape exists.
export const issueSeedRegistry = new Registry<IssueSeedFamilyDefinition>()
