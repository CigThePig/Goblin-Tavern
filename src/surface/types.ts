import type { EntityRef } from '../sim/state/TavernState'

export type SurfaceFactKind =
  | 'trigger'
  | 'cause'
  | 'pressure'
  | 'memory'
  | 'consequence'
  | 'trend'
  | 'player_action'
  | 'missed_opportunity'
  | 'relationship_shift'
  | 'state_change'

export type SurfaceEvidenceSource =
  | 'issue_seed'
  | 'seed_cause'
  | 'pressure_snapshot'
  | 'state_diff'
  | 'memory'
  | 'resolved_intent'
  | 'owner_action'
  | 'stake'
  | 'future_hook'
  | 'report_projection'

export type SurfaceEvidenceRef = {
  source: SurfaceEvidenceSource
  id?: string
  path?: string
  readable?: string
}

export type SurfaceFact = {
  id: string
  kind: SurfaceFactKind
  readable: string
  evidence: SurfaceEvidenceRef[]
  salience: number
  toneTags: string[]
  subject?: EntityRef
  target?: string
}

export type { EntityRef }
