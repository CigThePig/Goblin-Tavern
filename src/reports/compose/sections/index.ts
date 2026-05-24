// Phase 141 / ISSUE-110 — Voiced Surface arc, Phase 15 (Reports Prose).
//
// Section composer index. Each section exports a typed input shape, a
// `compose…` function for the projection layer to call, and a
// `ReportSection` shape for the gate adapter to wrap.

export {
  composeDailyHeaderLine,
  dailyHeaderSection,
  dailyHeaderSlots,
  type DailyHeaderInput,
} from './dailyHeader'

export {
  composeDailyQuietLine,
  dailyQuietSection,
  dailyQuietSlots,
  type DailyQuietInput,
} from './dailyQuiet'

export {
  actionCategoryTag,
  buildActionPhrase,
  buildDiffActionPhrase,
  composeDiffReadableVoiced,
  composeIgnoredReadableVoiced,
  composePressureReadableVoiced,
  composePressureSecondaryVoiced,
  diffKindNoun,
  ignoredSeverityTag,
  missedOpportunityDiffSection,
  missedOpportunityDiffSlots,
  missedOpportunityIgnoredSection,
  missedOpportunityIgnoredSlots,
  missedOpportunityReadableSection,
  missedOpportunityReadableSlots,
  missedOpportunitySecondarySection,
  missedOpportunitySecondarySlots,
  trendMagnitudeTag,
  type DiffCounterfactualReadableInput,
  type IgnoredSeedReadableInput,
  type PressureRemedyReadableInput,
  type PressureRemedySecondaryInput,
} from './missedOpportunity'

export {
  pickYesterdayCoinVerb,
  pickYesterdayPressureVerb,
  pickYesterdayReputationVerb,
  yesterdayDigestCoinSection,
  yesterdayDigestCoinSlots,
  yesterdayDigestSecondarySection,
  yesterdayDigestSecondarySlots,
  type YesterdayCoinInput,
  type YesterdayPressureInput,
  type YesterdayReputationInput,
} from './yesterdayDigest'

export {
  composeDriverLine,
  composeServiceLine,
  composeTrafficLine,
  serviceCoinTag,
  serviceLogDriverSection,
  serviceLogDriverSlots,
  serviceLogServiceSection,
  serviceLogServiceSlots,
  serviceLogTrafficSection,
  serviceLogTrafficSlots,
  trafficVolumeTag,
  type DriverLineInput,
  type ServiceLineInput,
  type TrafficLineInput,
} from './serviceLog'
