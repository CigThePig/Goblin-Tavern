export type SimulationPhase =
  | 'init'
  | 'startDay'
  | 'beforeForecast'
  | 'forecastTraffic'
  | 'beforeOwnerActions'
  | 'ownerActions'
  | 'afterOwnerActions'
  | 'beforeService'
  | 'service'
  | 'afterService'
  | 'endDay'
  | 'endWeek'
  | 'endMonth'
  | 'generatePressures'
  | 'generateIssueSeeds'
  | 'generateReports'
  | 'validate'

export const SIMULATION_PHASES: readonly SimulationPhase[] = [
  'init',
  'startDay',
  'beforeForecast',
  'forecastTraffic',
  'beforeOwnerActions',
  'ownerActions',
  'afterOwnerActions',
  'beforeService',
  'service',
  'afterService',
  'endDay',
  'endWeek',
  'endMonth',
  'generatePressures',
  'generateIssueSeeds',
  'generateReports',
  'validate',
] as const
