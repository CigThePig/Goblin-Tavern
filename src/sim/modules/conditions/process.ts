import type { SimContext } from '../../core/context'
import { conditionFor } from '../../content/conditions/conditionDefinitions'

import {
  getConditionsModuleState,
  liveScars,
  writeActiveCondition,
  type ActiveCondition,
} from './conditionState'

// Expansion Phase 9 §9.4 — what a condition DOES, day by day.
//
// The daily effects are still small, and that is on purpose: §9.4's
// complaint was never that the numbers were low, it was that a small daily
// nudge was ALL there was. The difference now is that alongside the nudge
// the condition builds a burden, and the burden is the thing with
// consequences. A rainy fortnight worked through costs a few points of roof
// condition; a rainy fortnight ignored costs the roof.
//
// PREPARATION IS A RATE, NOT A SHIELD. Preparedness slows how fast the
// burden builds; it never stops the condition happening. Sandbags do not
// stop rain. That keeps a prepared house in the same story as an unprepared
// one, rather than opting out of it.

const SOURCE = 'conditions.process'

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

/** How much of the condition actually lands, after preparation. */
export function exposure(entry: ActiveCondition): number {
  // The divisor is the dial that decides whether a forecast is worth acting
  // on. At 150 a full preparation took 40% off the run, which came to less
  // burden per coin than a single go at working it down once it had started
  // — so being told a week early was worth LESS than not being told, and the
  // whole forecast half of §9.4 was a caption. At 100 one preparation beats
  // one countering on every condition in the catalogue, which is the
  // relationship the two moves are supposed to have.
  return Math.max(0.3, 1 - entry.preparedness / 100)
}

/**
 * Apply one day of one condition.
 *
 * Each branch writes into the domain that OWNS the thing it changes — areas
 * through `modifyArea`, staff through `modifyStaff`, stock through
 * `modifyStock` — so the condition never becomes a second owner of anybody
 * else's numbers. What belongs to this module is the burden.
 */
export function applyConditionDay(ctx: SimContext, entry: ActiveCondition): void {
  const definition = conditionFor(entry.conditionId)
  if (!definition) return
  const scale = exposure(entry)
  const bite = (base: number) => Math.max(0, Math.round(base * scale))

  switch (entry.conditionId) {
    case 'rainy_month': {
      const roof = ctx.state.areas['roof']
      if (roof && roof.condition > 0) {
        ctx.modifyArea(
          roof.id,
          { condition: clampPercent(roof.condition - bite(1)) },
          { source: `${SOURCE}.rainy_month`, reason: 'rain_on_the_roof' },
        )
      }
      const cellar = ctx.state.areas['cellar']
      if (cellar) {
        ctx.modifyArea(
          cellar.id,
          { smell: clampPercent(cellar.smell + bite(1)) },
          { source: `${SOURCE}.rainy_month`, reason: 'damp_coming_up' },
        )
      }
      break
    }
    case 'festival_month': {
      const mainRoom = ctx.state.areas['main_room']
      if (mainRoom) {
        ctx.modifyArea(
          mainRoom.id,
          { mess: clampPercent(mainRoom.mess + bite(2)) },
          { source: `${SOURCE}.festival_month`, reason: 'festival_crowds' },
        )
      }
      for (const staff of Object.values(ctx.state.staff)) {
        ctx.modifyStaff(
          staff.id,
          { stress: clampPercent(staff.stress + bite(1)) },
          { source: `${SOURCE}.festival_month`, reason: 'festival_shifts' },
        )
      }
      break
    }
    case 'tax_month':
      // Nothing physical happens. The assessment mounts, which is the
      // burden, and it comes due when the assessor closes the books.
      break
    case 'mold_bloom': {
      const cellar = ctx.state.areas['cellar']
      if (cellar) {
        ctx.modifyArea(
          cellar.id,
          {
            smell: clampPercent(cellar.smell + bite(1)),
            risk: clampPercent(cellar.risk + bite(1)),
          },
          { source: `${SOURCE}.mold_bloom`, reason: 'spores_spreading' },
        )
      }
      for (const item of Object.values(ctx.state.stock)) {
        if (item.storageAreaId !== 'cellar' || item.quantity <= 0) continue
        ctx.modifyStock(
          item.id,
          { spoilage: clampPercent(item.spoilage + bite(1)) },
          { source: `${SOURCE}.mold_bloom`, reason: 'spores_in_the_stores' },
        )
      }
      break
    }
    case 'quiet_roads': {
      // The one condition whose daily face is kind: nobody is coming, so
      // the staff get their breath back. The cost is the trade that is not
      // happening, which is the burden rather than the day.
      for (const staff of Object.values(ctx.state.staff)) {
        if (staff.stress <= 0) continue
        ctx.modifyStaff(
          staff.id,
          { stress: clampPercent(staff.stress - 1) },
          { source: `${SOURCE}.quiet_roads`, reason: 'quiet_shifts' },
        )
      }
      break
    }
    case 'adventurer_season': {
      const mainRoom = ctx.state.areas['main_room']
      if (mainRoom) {
        ctx.modifyArea(
          mainRoom.id,
          { damage: clampPercent(mainRoom.damage + bite(1)) },
          { source: `${SOURCE}.adventurer_season`, reason: 'boots_on_the_tables' },
        )
      }
      break
    }
    default:
      break
  }
}

/**
 * A day's worth of burden.
 *
 * Exploiting a condition does not stop the burden — a festival you are
 * making money out of still wears the staff out. It banks a gain alongside
 * it, so the choice between working a condition down and working it for
 * profit is a real one rather than a strictly better option.
 */
export function accrueBurden(ctx: SimContext, entry: ActiveCondition): void {
  const definition = conditionFor(entry.conditionId)
  if (!definition) return
  const added = Math.max(0, definition.burdenPerDay * exposure(entry))
  writeActiveCondition(
    ctx,
    entry.conditionId,
    (current) => {
      const burden = Math.min(100, current.burden + added)
      return {
        ...current,
        burden,
        peakBurden: Math.max(current.peakBurden, burden),
        daysActive: current.daysActive + 1,
        exploitGain: current.exploited
          ? current.exploitGain + Math.round(added / 2)
          : current.exploitGain,
      }
    },
    'burden',
  )
}

/**
 * What a condition has already left behind, still acting.
 *
 * §9.4's "accumulated consequences" outlive the condition, and a scar is
 * how: a small continuing drag on whatever the condition wrecked, decaying
 * over its lifetime. The genuinely permanent part is not here — it is the
 * damage on the roof and the spoilage in the cellar that the aftermath
 * already wrote into the domains that own them, and which stays until the
 * house repairs it. The scar is the tail, and it is bounded because an
 * unbounded one would outgrow any cap the slice could declare.
 */
export function applyScarDrag(ctx: SimContext): void {
  const today = ctx.state.calendar.totalDaysElapsed
  for (const scar of liveScars(ctx.state)) {
    // Every fourth day, so a scar reads as a lingering problem rather than
    // a second condition running underneath the first.
    if ((today + scar.createdOnDay) % 4 !== 0) continue
    const remaining = Math.max(0, scar.expiresOnDay - today)
    const strength = Math.max(1, Math.round((scar.severity * remaining) / 120))
    switch (scar.conditionId) {
      case 'rainy_month': {
        const roof = ctx.state.areas['roof']
        if (roof) {
          ctx.modifyArea(
            roof.id,
            { damage: clampPercent(roof.damage + strength) },
            { source: `${SOURCE}.scar`, reason: 'soft_timbers' },
          )
        }
        break
      }
      case 'adventurer_season': {
        const mainRoom = ctx.state.areas['main_room']
        if (mainRoom) {
          ctx.modifyArea(
            mainRoom.id,
            { damage: clampPercent(mainRoom.damage + strength) },
            { source: `${SOURCE}.scar`, reason: 'nothing_sits_straight' },
          )
        }
        break
      }
      case 'mold_bloom': {
        const cellar = ctx.state.areas['cellar']
        if (cellar) {
          ctx.modifyArea(
            cellar.id,
            { smell: clampPercent(cellar.smell + strength) },
            { source: `${SOURCE}.scar`, reason: 'it_never_quite_went' },
          )
        }
        break
      }
      case 'quiet_roads': {
        for (const group of Object.values(ctx.state.customerGroups)) {
          if (group.patronage <= 0) continue
          ctx.modifyCustomerGroup(
            group.id,
            { loyalty: clampPercent(group.loyalty - strength) },
            { source: `${SOURCE}.scar`, reason: 'out_of_the_habit' },
          )
        }
        break
      }
      case 'festival_month': {
        for (const staff of Object.values(ctx.state.staff)) {
          ctx.modifyStaff(
            staff.id,
            { stress: clampPercent(staff.stress + strength) },
            { source: `${SOURCE}.scar`, reason: 'never_caught_up' },
          )
        }
        break
      }
      case 'tax_month': {
        // An unpaid assessment is remembered by the people who assess. This
        // switch had no `tax_month` case at all, so the scar the aftermath
        // creates sat in the report under "Still being felt" for sixty days
        // changing nothing — an advertised lingering consequence that was
        // inert while still occupying the scar cap. What it costs is
        // standing with the landlord, who is the party the levy runs
        // through and who already has a pressure ladder that reads it.
        const monthly = ctx.state.modules['monthly'] as
          | { landlord?: { pressure?: number } }
          | undefined
        const current = monthly?.landlord?.pressure
        if (typeof current === 'number') {
          ctx.modifyModuleState<Record<string, unknown>>(
            'monthly',
            (slice) => {
              const base = (slice ?? {}) as Record<string, unknown>
              const landlord = (base['landlord'] ?? {}) as Record<string, unknown>
              return {
                ...base,
                landlord: {
                  ...landlord,
                  pressure: clampPercent(current + strength),
                },
              }
            },
            { source: `${SOURCE}.scar`, reason: 'the_assessment_is_remembered' },
          )
        }
        break
      }
      default:
        break
    }
  }
}

/** Conditions whose last day has passed. */
export function expiredConditions(ctx: SimContext): ActiveCondition[] {
  const today = ctx.state.calendar.totalDaysElapsed
  return getConditionsModuleState(ctx.state).active.filter(
    (entry) => today >= entry.endsOnDay,
  )
}
