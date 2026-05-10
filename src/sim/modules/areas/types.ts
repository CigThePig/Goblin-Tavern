// Phase 8 §8.4 — Derived area condition helpers' return type.
//
// `AreaQualityBand` classifies an area into one of five readable bands so
// later modules (reports, customer satisfaction, issue seeds) do not need
// to re-implement threshold logic. The bands intentionally read top-down
// from "excellent" so callers can compare via switch/case without
// numeric tricks.

export type AreaQualityBand =
  | 'excellent'
  | 'good'
  | 'rough'
  | 'bad'
  | 'critical'

export type { AreaDefinition } from '../../registries/areaRegistry'
