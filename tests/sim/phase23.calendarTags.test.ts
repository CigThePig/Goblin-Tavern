import { describe, it, expect } from 'vitest'
import {
  advanceCalendar,
  createInitialCalendar,
  getCalendarTags,
  getSeason,
  hasCalendarTag,
} from '../../src/sim/modules/calendar/index'
import type {
  CalendarState,
  CalendarTag,
  SeasonId,
} from '../../src/sim/modules/calendar/types'
import { safeValidateState } from '../../src/sim/state/validation'
import { createInitialTavernState } from '../../src/sim/state/defaults'

function advanceN(calendar: CalendarState, n: number): CalendarState {
  let current = calendar
  for (let i = 0; i < n; i += 1) {
    current = advanceCalendar(current)
  }
  return current
}

function advanceToMonth(target: number): CalendarState {
  return advanceN(createInitialCalendar(), (target - 1) * 28)
}

function advanceToMonthWeek(month: number, week: number): CalendarState {
  return advanceN(createInitialCalendar(), (month - 1) * 28 + (week - 1) * 7)
}

describe('Phase 23 — Calendar Tags', () => {
  it('1. initial calendar has season === "mudwake"', () => {
    const cal = createInitialCalendar()
    expect(cal.season).toBe<SeasonId>('mudwake')
  })

  it('2. initial calendar tags include supplier_day and season_mudwake', () => {
    const cal = createInitialCalendar()
    expect(cal.tags).toContain<CalendarTag>('supplier_day')
    expect(cal.tags).toContain<CalendarTag>('season_mudwake')
  })

  it('3. month 4 resolves to highsun', () => {
    expect(getSeason(1)).toBe<SeasonId>('mudwake')
    expect(getSeason(3)).toBe<SeasonId>('mudwake')
    expect(getSeason(4)).toBe<SeasonId>('highsun')
    expect(getSeason(6)).toBe<SeasonId>('highsun')
    expect(getSeason(7)).toBe<SeasonId>('redleaf')
    expect(getSeason(9)).toBe<SeasonId>('redleaf')
    expect(getSeason(10)).toBe<SeasonId>('deepfrost')
    expect(getSeason(12)).toBe<SeasonId>('deepfrost')

    const cal = advanceToMonth(4)
    expect(cal.month).toBe(4)
    expect(cal.season).toBe<SeasonId>('highsun')
    expect(cal.tags).toContain<CalendarTag>('season_highsun')
  })

  it('4. month 2 week 4 includes mushroom_festival and festival_window', () => {
    // Audit fixes pass 1 §1.6 — the festival window moved from month 7
    // week 2 into the 3-month gate run window so cardless evaluation
    // exercises festival prep at least once per run.
    const cal = advanceToMonthWeek(2, 4)
    expect(cal.month).toBe(2)
    expect(cal.week).toBe(4)
    expect(cal.tags).toContain<CalendarTag>('mushroom_festival')
    expect(cal.tags).toContain<CalendarTag>('festival_window')

    // Outside the festival window the tags drop off.
    const offFestival = advanceToMonthWeek(2, 3)
    expect(offFestival.tags).not.toContain<CalendarTag>('mushroom_festival')
    expect(offFestival.tags).not.toContain<CalendarTag>('festival_window')
  })

  it('5. deepfrost months include winter_shortage_risk and road_danger_risk', () => {
    for (const month of [10, 11, 12]) {
      const cal = advanceToMonth(month)
      expect(cal.season).toBe<SeasonId>('deepfrost')
      expect(cal.tags).toContain<CalendarTag>('winter_shortage_risk')
      expect(cal.tags).toContain<CalendarTag>('road_danger_risk')
    }
    const highsun = advanceToMonth(5)
    expect(highsun.tags).not.toContain<CalendarTag>('winter_shortage_risk')
    expect(highsun.tags).not.toContain<CalendarTag>('road_danger_risk')
  })

  it('6. calendar advancement recomputes tags after month changes', () => {
    const lastDayMonth3 = advanceN(createInitialCalendar(), 27 + 28 + 28)
    expect(lastDayMonth3.month).toBe(3)
    expect(lastDayMonth3.day).toBe(28)
    expect(lastDayMonth3.season).toBe<SeasonId>('mudwake')
    expect(lastDayMonth3.tags).toContain<CalendarTag>('season_mudwake')

    const firstDayMonth4 = advanceCalendar(lastDayMonth3)
    expect(firstDayMonth4.month).toBe(4)
    expect(firstDayMonth4.day).toBe(1)
    expect(firstDayMonth4.season).toBe<SeasonId>('highsun')
    expect(firstDayMonth4.tags).toContain<CalendarTag>('season_highsun')
    expect(firstDayMonth4.tags).not.toContain<CalendarTag>('season_mudwake')
  })

  it('7. hasCalendarTag returns true and false correctly', () => {
    const cal = createInitialCalendar()
    expect(hasCalendarTag(cal, 'season_mudwake')).toBe(true)
    expect(hasCalendarTag(cal, 'supplier_day')).toBe(true)
    expect(hasCalendarTag(cal, 'season_highsun')).toBe(false)
    expect(hasCalendarTag(cal, 'mushroom_festival')).toBe(false)
  })

  it('8. calendar tag generation is deterministic across identical dates', () => {
    const a = createInitialCalendar()
    const b = createInitialCalendar()
    expect(a.tags).toEqual(b.tags)

    const aLater = advanceN(a, 120)
    const bLater = advanceN(b, 120)
    expect(aLater.tags).toEqual(bLater.tags)
    expect(aLater).toEqual(bLater)
  })

  it('inspection_window covers week 4 of every month', () => {
    for (let month = 1; month <= 12; month += 1) {
      const week4 = advanceToMonthWeek(month, 4)
      expect(week4.week).toBe(4)
      expect(week4.tags).toContain<CalendarTag>('inspection_window')

      const week1 = advanceToMonthWeek(month, 1)
      expect(week1.tags).not.toContain<CalendarTag>('inspection_window')
    }
  })

  it('rent_due_soon covers days 22-28 of every month', () => {
    const month1 = createInitialCalendar()
    const day21 = advanceN(month1, 20)
    expect(day21.day).toBe(21)
    expect(day21.tags).not.toContain<CalendarTag>('rent_due_soon')

    const day22 = advanceCalendar(day21)
    expect(day22.day).toBe(22)
    expect(day22.tags).toContain<CalendarTag>('rent_due_soon')

    const day28 = advanceN(day22, 6)
    expect(day28.day).toBe(28)
    expect(day28.tags).toContain<CalendarTag>('rent_due_soon')

    const day1NextMonth = advanceCalendar(day28)
    expect(day1NextMonth.day).toBe(1)
    expect(day1NextMonth.tags).not.toContain<CalendarTag>('rent_due_soon')
  })

  it('miner_payday and local_crowd come from day types', () => {
    const cal = createInitialCalendar()
    const payday = advanceN(cal, 4)
    expect(payday.dayType).toBe('payday')
    expect(payday.tags).toContain<CalendarTag>('miner_payday')

    const localNight = advanceN(cal, 3)
    expect(localNight.dayType).toBe('local_night')
    expect(localNight.tags).toContain<CalendarTag>('local_crowd')
  })

  it('merchant_traffic applies on market days and throughout highsun', () => {
    const marketDay = advanceN(createInitialCalendar(), 2)
    expect(marketDay.dayType).toBe('market_day')
    expect(marketDay.tags).toContain<CalendarTag>('merchant_traffic')

    const highsunQuietDay = advanceN(createInitialCalendar(), (4 - 1) * 28 + 1)
    expect(highsunQuietDay.season).toBe<SeasonId>('highsun')
    expect(highsunQuietDay.dayType).not.toBe('market_day')
    expect(highsunQuietDay.tags).toContain<CalendarTag>('merchant_traffic')
  })

  it('getCalendarTags is a pure function of its input', () => {
    const cal = advanceToMonthWeek(7, 2)
    const before = JSON.parse(JSON.stringify(cal)) as CalendarState
    const { tags: _ignored, ...withoutTags } = cal
    const tagsA = getCalendarTags(withoutTags)
    const tagsB = getCalendarTags(withoutTags)
    expect(tagsA).toEqual(tagsB)
    expect(cal).toEqual(before)
  })

  it('advanceCalendar does not mutate its input after Phase 23', () => {
    const cal = createInitialCalendar()
    const snapshot = JSON.parse(JSON.stringify(cal))
    advanceCalendar(cal)
    expect(cal).toEqual(snapshot)
  })

  it('safeValidateState accepts the new calendar fields', () => {
    const state = createInitialTavernState()
    const result = safeValidateState(state)
    expect(result.success).toBe(true)
  })

  it('safeValidateState rejects calendars missing season or tags', () => {
    const state = createInitialTavernState()
    const { season: _season, ...calendarWithoutSeason } = state.calendar
    const bad = { ...state, calendar: calendarWithoutSeason }
    const result = safeValidateState(bad)
    expect(result.success).toBe(false)

    const { tags: _tags, ...calendarWithoutTags } = state.calendar
    const bad2 = { ...state, calendar: calendarWithoutTags }
    const result2 = safeValidateState(bad2)
    expect(result2.success).toBe(false)
  })
})
