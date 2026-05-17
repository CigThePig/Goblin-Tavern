// Phase 89 — Tiny global store the Glossary sheet binds against.
//
// Avoids prop-drilling the open/anchorTerm state through every screen
// that wants to surface a term chip. The Glossary component is mounted
// once near the app root and listens to this store; any TermLabel can
// call `openGlossary(termId)` from anywhere.

class GlossaryStore {
  open = $state(false)
  anchorTerm: string | undefined = $state(undefined)

  show(anchor?: string): void {
    this.anchorTerm = anchor
    this.open = true
  }

  close(): void {
    this.open = false
  }
}

export const glossaryStore = new GlossaryStore()
