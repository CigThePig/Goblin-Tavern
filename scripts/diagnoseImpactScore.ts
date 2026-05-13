import { runCardlessSim } from '../src/sim/testing'

const SEED = 'phase-20-test-seed'
const single = runCardlessSim({ seed: SEED, days: 14 })

type Profile = {
  id: string
  responseSlotId: string
  immediateEffects: Array<{ kind: string; amount?: number; target: string }>
  delayedEffects: Array<{ kind: string; amount?: number; target: string }>
  memories: Array<unknown>
  futureHooks: Array<unknown>
  impactScore: number
}

type Seed = {
  id: string
  family: string
  consequenceProfiles: Profile[]
  primaryActor?: { kind: string; id: string }
}

let totalProfiles = 0
let totalScore = 0
const byFamily: Record<string, { count: number; sum: number; profiles: Profile[] }> = {}
const allScores: number[] = []
const buckets = { zero: 0, lt10: 0, lt20: 0, lt30: 0, lt50: 0, lt75: 0, ge75: 0 }

for (const day of single.days) {
  const slice = day.result.state.modules.issueSeeds as
    | { seedsToday?: Seed[] }
    | undefined
  for (const seed of slice?.seedsToday ?? []) {
    for (const profile of seed.consequenceProfiles) {
      totalProfiles += 1
      totalScore += profile.impactScore
      allScores.push(profile.impactScore)

      const fam = byFamily[seed.family] ?? { count: 0, sum: 0, profiles: [] }
      fam.count += 1
      fam.sum += profile.impactScore
      if (fam.profiles.length < 3) fam.profiles.push(profile)
      byFamily[seed.family] = fam

      const s = profile.impactScore
      if (s === 0) buckets.zero += 1
      else if (s < 10) buckets.lt10 += 1
      else if (s < 20) buckets.lt20 += 1
      else if (s < 30) buckets.lt30 += 1
      else if (s < 50) buckets.lt50 += 1
      else if (s < 75) buckets.lt75 += 1
      else buckets.ge75 += 1
    }
  }
}

console.log(`Total profiles: ${totalProfiles}`)
console.log(`Average score: ${totalScore / totalProfiles}`)
console.log(`Min: ${Math.min(...allScores)}, Max: ${Math.max(...allScores)}`)
console.log(`Bucket distribution:`, buckets)

console.log(`\n--- Per-family averages ---`)
for (const [family, data] of Object.entries(byFamily).sort((a, b) =>
  a[1].sum / a[1].count - b[1].sum / b[1].count,
)) {
  console.log(
    `  ${family}: count=${data.count} avg=${(data.sum / data.count).toFixed(1)}`,
  )
}

console.log(`\n--- Sample low-score profiles per family (first 3 each) ---`)
for (const [family, data] of Object.entries(byFamily)) {
  console.log(`\n[${family}] (avg ${(data.sum / data.count).toFixed(1)})`)
  for (const p of data.profiles) {
    const ie = p.immediateEffects.map(
      (e) => `${e.kind}=${e.amount ?? 'undef'}`,
    )
    const de = p.delayedEffects.map(
      (e) => `${e.kind}=${e.amount ?? 'undef'}`,
    )
    console.log(
      `  - ${p.id} score=${p.impactScore}  imm=[${ie.join(',')}] del=[${de.join(',')}] mem=${p.memories.length} fh=${p.futureHooks.length}`,
    )
  }
}

// Now compute what the score WOULD be using each individual contributor.
console.log(`\n--- Component breakdown (totals across all profiles) ---`)
let totalImmAmount = 0
let totalDelAmount = 0
let totalMemories = 0
let totalFHooks = 0
let zeroAmountEffects = 0
let nonZeroAmountEffects = 0
let undefAmountEffects = 0
let immCount = 0
let delCount = 0
for (const day of single.days) {
  const slice = day.result.state.modules.issueSeeds as { seedsToday?: Seed[] } | undefined
  for (const seed of slice?.seedsToday ?? []) {
    for (const profile of seed.consequenceProfiles) {
      for (const e of profile.immediateEffects) {
        immCount += 1
        if (e.amount === 0) zeroAmountEffects += 1
        else if (e.amount === undefined) undefAmountEffects += 1
        else nonZeroAmountEffects += 1
        totalImmAmount += Math.abs(e.amount ?? 5)
      }
      for (const e of profile.delayedEffects) {
        delCount += 1
        totalDelAmount += Math.abs(e.amount ?? 5)
      }
      totalMemories += profile.memories.length
      totalFHooks += profile.futureHooks.length
    }
  }
}
console.log({
  immCount,
  delCount,
  zeroAmountEffects,
  nonZeroAmountEffects,
  undefAmountEffects,
  totalImmAmount,
  totalDelAmount,
  totalMemories,
  totalFHooks,
  perProfileMemories: (totalMemories / totalProfiles).toFixed(2),
  perProfileFHooks: (totalFHooks / totalProfiles).toFixed(2),
  perProfileImm: (immCount / totalProfiles).toFixed(2),
  perProfileDel: (delCount / totalProfiles).toFixed(2),
})
