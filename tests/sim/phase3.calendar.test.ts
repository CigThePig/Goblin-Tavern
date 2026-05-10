import { describe, it, expect } from 'vitest'
import {
  advanceCalendar,
  calendarModule,
  createInitialCalendar,
  getCalendarLabel,
  getDayType,
  isEndOfMonth,
  isEndOfWeek,
} from '../../src/sim/modules/calendar/index'
import type { CalendarState, DayType } from '../../src/sim/modules/calendar/types'

function advanceN(calendar: CalendarState, n: number): CalendarState {
  let current = calendar
  for (let i = 0; i < n; i += 1) {
    current = advanceCalendar(current)
  }
  return current
}

describe('Phase 3 — Calendar', () => {
  it('initial calendar starts at Day 1, Week 1, Month 1, Year 1', () => {
    const cal = createInitialCalendar()
    expect(cal.day).toBe(1)
    expect(cal.week).toBe(1)
    expect(cal.month).toBe(1)
    expect(cal.year).toBe(1)
    expect(cal.totalDaysElapsed).toBe(0)
    expect(cal.dayOfWeek).toBe(1)
    expect(cal.dayType).toBe<DayType>('supplier_day')
  })

  it('day types map correctly for all seven days', () => {
    const expected: DayType[] = [
      'supplier_day',
      'quiet_day',
      'market_day',
      'local_night',
      'payday',
      'brawl_night',
      'maintenance_day',
    ]
    for (let i = 1; i <= 7; i += 1) {
      expect(getDayType(i)).toBe(expected[i - 1])
    }
  })

  it('advancing from Day 1 goes to Day 2', () => {
    const cal = createInitialCalendar()
    const next = advanceCalendar(cal)
    expect(next.day).toBe(2)
    expect(next.dayOfWeek).toBe(2)
    expect(next.week).toBe(1)
    expect(next.month).toBe(1)
    expect(next.year).toBe(1)
    expect(next.totalDaysElapsed).toBe(1)
    expect(next.dayType).toBe<DayType>('quiet_day')
  })

  it('advancing Day 7 moves to Week 2, Day 8, dayOfWeek 1', () => {
    const cal = advanceN(createInitialCalendar(), 6)
    expect(cal.day).toBe(7)
    expect(cal.dayOfWeek).toBe(7)
    expect(cal.week).toBe(1)

    const next = advanceCalendar(cal)
    expect(next.day).toBe(8)
    expect(next.week).toBe(2)
    expect(next.dayOfWeek).toBe(1)
    expect(next.month).toBe(1)
    expect(next.dayType).toBe<DayType>('supplier_day')
  })

  it('advancing Day 28 moves to Month 2, Day 1, Week 1', () => {
    const cal = advanceN(createInitialCalendar(), 27)
    expect(cal.day).toBe(28)
    expect(cal.week).toBe(4)
    expect(cal.month).toBe(1)
    expect(cal.dayOfWeek).toBe(7)

    const next = advanceCalendar(cal)
    expect(next.day).toBe(1)
    expect(next.week).toBe(1)
    expect(next.month).toBe(2)
    expect(next.year).toBe(1)
    expect(next.dayOfWeek).toBe(1)
    expect(next.dayType).toBe<DayType>('supplier_day')
  })

  it('isEndOfWeek returns true on dayOfWeek 7', () => {
    const start = createInitialCalendar()
    expect(isEndOfWeek(start)).toBe(false)

    const dayOfWeek7 = advanceN(start, 6)
    expect(dayOfWeek7.dayOfWeek).toBe(7)
    expect(isEndOfWeek(dayOfWeek7)).toBe(true)

    const dayOfWeek1Again = advanceCalendar(dayOfWeek7)
    expect(isEndOfWeek(dayOfWeek1Again)).toBe(false)
  })

  it('isEndOfMonth returns true on day 28', () => {
    const start = createInitialCalendar()
    expect(isEndOfMonth(start)).toBe(false)

    const day28 = advanceN(start, 27)
    expect(day28.day).toBe(28)
    expect(isEndOfMonth(day28)).toBe(true)

    const day1NextMonth = advanceCalendar(day28)
    expect(isEndOfMonth(day1NextMonth)).toBe(false)
  })

  it('advancing 28 days reaches Month 2, Day 1', () => {
    const cal = advanceN(createInitialCalendar(), 28)
    expect(cal.day).toBe(1)
    expect(cal.month).toBe(2)
    expect(cal.year).toBe(1)
    expect(cal.week).toBe(1)
    expect(cal.totalDaysElapsed).toBe(28)
  })

  it('advancing 336 days reaches Year 2, Month 1, Day 1', () => {
    const cal = advanceN(createInitialCalendar(), 336)
    expect(cal.day).toBe(1)
    expect(cal.month).toBe(1)
    expect(cal.year).toBe(2)
    expect(cal.week).toBe(1)
    expect(cal.dayOfWeek).toBe(1)
    expect(cal.totalDaysElapsed).toBe(336)
    expect(cal.dayType).toBe<DayType>('supplier_day')
  })

  it('calendar output is deterministic and contains no randomness', () => {
    const runA: CalendarState[] = []
    const runB: CalendarState[] = []
    let a = createInitialCalendar()
    let b = createInitialCalendar()
    for (let i = 0; i < 100; i += 1) {
      runA.push(a)
      runB.push(b)
      a = advanceCalendar(a)
      b = advanceCalendar(b)
    }
    expect(runA).toEqual(runB)
  })

  it('advanceCalendar does not mutate its input', () => {
    const cal = createInitialCalendar()
    const snapshot = JSON.parse(JSON.stringify(cal))
    advanceCalendar(cal)
    expect(cal).toEqual(snapshot)
  })

  it('getCalendarLabel returns a debug-friendly string', () => {
    const cal = advanceN(createInitialCalendar(), 8)
    expect(cal.day).toBe(9)
    expect(cal.week).toBe(2)
    expect(cal.dayType).toBe<DayType>('quiet_day')
    expect(getCalendarLabel(cal)).toBe('Year 1, Month 1, Week 2, Day 9 — Quiet Day')
  })

  it('getDayType rejects values outside 1-7', () => {
    expect(() => getDayType(0)).toThrow()
    expect(() => getDayType(8)).toThrow()
    expect(() => getDayType(1.5)).toThrow()
  })

  it('exports a calendar module placeholder', () => {
    expect(calendarModule.id).toBe('calendar')
    expect(calendarModule.version).toBe('0.1.0')
  })
})
