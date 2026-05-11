import type { CalendarStamp, EntityRef } from '../../state/TavernState'

// Phase 18 §"Feedback Loop Shape" — supporting types.
//
// A feedback loop is a hand-authored detector that watches for a known
// compounding pattern (e.g. "low cleanliness → merchant loss → lower
// revenue → fewer repairs → still lower cleanliness"). The detector
// returns evidence — short readable fragments tied to mechanical state
// — when the loop is active.

export type FeedbackLoopSpeed = 'slow' | 'medium' | 'fast'

export type FeedbackEvidence = {
  id: string
  readable: string
  weight: number
  tags: string[]
}

export type FeedbackLoopSnapshot = {
  id: string
  label: string
  active: boolean
  strength: number
  speed: FeedbackLoopSpeed
  risk: number
  nodes: string[]
  evidence: FeedbackEvidence[]
  readable: string
  tags: string[]
  relatedActors: EntityRef[]
  relatedLocations: EntityRef[]
  relatedSystems: string[]
  lastDetected: CalendarStamp
}

export type FeedbackLoopDetectorResult = {
  active: boolean
  /** 0–100, how strongly the loop is firing today. */
  strength: number
  /** 0–100 risk that this loop spirals into a crisis if unattended. */
  risk: number
  speed: FeedbackLoopSpeed
  /** Mechanical evidence (short readable fragments + weight). */
  evidence: FeedbackEvidence[]
  /** Ordered list of node ids (state systems) participating in the loop. */
  nodes: string[]
  relatedActors?: EntityRef[]
  relatedLocations?: EntityRef[]
  relatedSystems?: string[]
  tags?: string[]
  /** One-line summary of the pattern in plain prose. */
  readable: string
}
