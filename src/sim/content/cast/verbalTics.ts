// Phase 121 / ISSUE-090 — Living Cast Phase A.
//
// Verbal tics are a small registry of stylistic flourishes — each
// character either has one or doesn't (low probability by default). The
// id is stored on `VoiceProfile.verbalTic`; the snippet layer (Phase C+)
// will eventually condition snippets on tic id. Phase A only fills the
// dictionary.

import { Registry } from '../../registries/Registry'

export type VerbalTicDefinition = {
  id: string
  label: string
  /** Authoring guideline — how a snippet writer should land this tic.
   *  NOT player-visible text. */
  hint: string
}

export const verbalTicRegistry = new Registry<VerbalTicDefinition>()

const REQUIRED_VERBAL_TICS: VerbalTicDefinition[] = [
  {
    id: 'trails_off',
    label: 'Trails off',
    hint: 'Sentence frequently breaks mid-clause with ellipsis or a vague "…you know."',
  },
  {
    id: 'interrupts_self',
    label: 'Interrupts self',
    hint: 'Self-corrects or reverses course mid-sentence ("— no, wait —").',
  },
  {
    id: 'understates',
    label: 'Understates',
    hint: 'Routinely downgrades stakes ("a bit of trouble" for a disaster).',
  },
  {
    id: 'repeats_for_emphasis',
    label: 'Repeats for emphasis',
    hint: 'Doubles a key word ("bad — really bad").',
  },
  {
    id: 'qualifies_everything',
    label: 'Qualifies everything',
    hint: 'Leans on hedges ("more or less," "I think," "if you ask me").',
  },
  {
    id: 'italicises_stakes',
    label: 'Italicises stakes',
    hint: 'Lands one stress word with weight ("that one mattered").',
  },
  {
    id: 'quotes_someone_else',
    label: 'Quotes someone else',
    hint: 'Frequently routes opinion through "my mother used to say…" or similar.',
  },
]

let registered = false

export function ensureRequiredVerbalTicsRegistered(): void {
  if (registered) return
  for (const def of REQUIRED_VERBAL_TICS) {
    if (!verbalTicRegistry.has(def.id)) {
      verbalTicRegistry.register(def)
    }
  }
  registered = true
}
