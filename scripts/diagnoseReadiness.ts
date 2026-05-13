import {
  buildReadinessReport,
  buildExpandedReadinessReport,
  runCardlessSim,
  runStrategyMatrix,
  buildStrategyComparison,
  buildRepetitionAudit,
  buildSeedCoverageReport,
  buildCardCapacityReport,
  buildNamedEntityRepetitionAudit,
  buildExpandedPressureQualityReport,
  buildArcAndCalendarUseReport,
  buildSocialConsequenceQualityReport,
  summarizeRun,
} from '../src/sim/testing'

const P20_SEED = 'phase-20-test-seed'
const P40_SEED = 'phase-40-expanded-readiness-test'

console.log('### Phase 20 details ###\n')
const r20 = buildReadinessReport({ seed: P20_SEED, days: 14 })
for (const sec of r20.sections) {
  console.log(`-- ${sec.id} score=${sec.score} threshold=${sec.threshold} passed=${sec.passed}`)
  for (const n of sec.notes ?? []) console.log(`     • ${n}`)
}

console.log('\n--- Phase 20 deep dives ---\n')
const single20 = runCardlessSim({ seed: P20_SEED, days: 14 })
const sum20 = summarizeRun(single20)
console.log('seed totals:', {
  generated: sum20.totalSeedsGenerated,
  rejected: sum20.totalSeedsRejected,
})

const rep20 = buildRepetitionAudit(single20)
console.log('repetition:', {
  totalSeeds: rep20.totalSeeds,
  overusedActors: rep20.overusedActors.slice(0, 8),
  overusedLocations: rep20.overusedLocations.slice(0, 8),
  cooldownPressure: rep20.cooldownPressure,
})

const cov20 = buildSeedCoverageReport(single20)
const weak = Object.entries(cov20.familyCounts ?? {})
  .filter(([, v]) => (v as number) < 2)
  .map(([k]) => k)
console.log('weak/missing families (<2 seeds in 14d):', weak)

const cap20 = buildCardCapacityReport(single20)
console.log('capacity:', {
  families: cap20.distinctSeedFamilies,
  templates: cap20.distinctSeedTemplates,
  actors: cap20.distinctActorIds.length,
  locations: cap20.distinctLocationIds.length,
  shapes: cap20.distinctResponseShapes.length,
  hooks: cap20.distinctFutureHookIds.length,
})

const matrix20 = runStrategyMatrix({
  seed: P20_SEED,
  days: 14,
  botIds: ['auto_clean_focused', 'auto_profit_focused', 'auto_merchant_focused', 'auto_miner_focused'],
})
const cmp = buildStrategyComparison(matrix20)
console.log('strategy compare:', {
  identities: cmp.distinctIdentityKeys,
  customerGroups: cmp.distinctDominantCustomerGroups,
  coinSpread: cmp.endingCoinSpread,
})

console.log('\n\n### Phase 40 details ###\n')
const r40 = buildExpandedReadinessReport({ seed: P40_SEED, days: 28 })
for (const sec of r40.sections) {
  console.log(`-- ${sec.id} score=${sec.score} threshold=${sec.threshold} passed=${sec.passed}`)
  for (const n of sec.notes ?? []) console.log(`     • ${n}`)
}

console.log('\n--- Phase 40 deep dives ---\n')
const single40 = runCardlessSim({ seed: P40_SEED, days: 28 })

const press = buildExpandedPressureQualityReport(single40)
console.log('expanded pressures:', {
  moved: press.expandedPressuresMoved,
  highSeverity: press.expandedPressuresHighSeverity,
  withNamedCauses: press.pressuresWithNamedCauses,
  webs: press.pressureWebsActivated,
  score: press.score,
})

const rep40 = buildNamedEntityRepetitionAudit(single40)
console.log('named entity repetition:', {
  totalUses: rep40.totalNamedEntityUses,
  overusedEntities: rep40.overusedEntities,
  overusedFamilies: rep40.overusedFamilies,
  duplicateNames: rep40.duplicateNames,
  sameActorConsecutive: rep40.sameActorConsecutiveSeeds,
  score: rep40.score,
})

const arc = buildArcAndCalendarUseReport(single40)
console.log('arc/calendar:', {
  activeArcs: arc.activeArcsSeen,
  arcSeeds: arc.arcSeedsProduced,
  calendarTags: arc.calendarTagsUsedBySeeds,
  marketConditions: arc.marketConditionsUsedBySeeds,
  festivalMoved: arc.festivalReadinessMoved,
  score: arc.score,
})

const social = buildSocialConsequenceQualityReport(single40)
console.log('social consequence:', social)
