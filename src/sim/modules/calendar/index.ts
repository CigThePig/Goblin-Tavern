import type { SimulationModule } from '../../core/module'
import type { CalendarState, DayType } from './types'

const DAYS_PER_WEEK = 7
const WEEKS_PER_MONTH = 4
const DAYS_PER_MONTH = DAYS_PER_WEEK * WEEKS_PER_MONTH
const MONTHS_PER_YEAR = 12

const DAY_TYPE_BY_DAY_OF_WEEK: readonly DayType[] = [
  'supplier_day',
  'quiet_day',
  'market_day',
  'local_night',
  'payday',
  'brawl_night',
  'maintenance_day',
]

export function getDayType(dayOfWeek: number): DayType {
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 1 || dayOfWeek > DAYS_PER_WEEK) {
    throw new Error(`Invalid dayOfWeek: ${dayOfWeek}`)
  }
  const dayType = DAY_TYPE_BY_DAY_OF_WEEK[dayOfWeek - 1]
  if (!dayType) {
    throw new Error(`Invalid dayOfWeek: ${dayOfWeek}`)
  }
  return dayType
}

export function createInitialCalendar(): CalendarState {
  return {
    day: 1,
    week: 1,
    month: 1,
    year: 1,
    totalDaysElapsed: 0,
    dayOfWeek: 1,
    dayType: getDayType(1),
  }
}

export function advanceCalendar(calendar: CalendarState): CalendarState {
  let day = calendar.day + 1
  let month = calendar.month
  let year = calendar.year

  if (day > DAYS_PER_MONTH) {
    day = 1
    month += 1
    if (month > MONTHS_PER_YEAR) {
      month = 1
      year += 1
    }
  }

  const dayOfWeek = (calendar.dayOfWeek % DAYS_PER_WEEK) + 1
  const week = Math.floor((day - 1) / DAYS_PER_WEEK) + 1

  return {
    day,
    week,
    month,
    year,
    totalDaysElapsed: calendar.totalDaysElapsed + 1,
    dayOfWeek,
    dayType: getDayType(dayOfWeek),
  }
}

export function isEndOfWeek(calendar: CalendarState): boolean {
  return calendar.dayOfWeek === DAYS_PER_WEEK
}

export function isEndOfMonth(calendar: CalendarState): boolean {
  return calendar.day === DAYS_PER_MONTH
}

export function getCalendarLabel(calendar: CalendarState): string {
  return `Year ${calendar.year}, Month ${calendar.month}, Week ${calendar.week}, Day ${calendar.day} — ${formatDayType(calendar.dayType)}`
}

function formatDayType(dayType: DayType): string {
  return dayType
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export const calendarModule: SimulationModule = {
  id: 'calendar',
  version: '0.1.0',
}

export type { CalendarState, DayType } from './types'
