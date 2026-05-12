import type { SimulationModule } from '../../core/module'
import type {
  CalendarState,
  CalendarTag,
  DayType,
  SeasonId,
} from './types'

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

// Phase 23 §"Required Calendar Helpers" — months 1-3 mudwake, 4-6 highsun,
// 7-9 redleaf, 10-12 deepfrost. Pure, deterministic, no RNG.
export function getSeason(month: number): SeasonId {
  if (!Number.isInteger(month) || month < 1 || month > MONTHS_PER_YEAR) {
    throw new Error(`Invalid month: ${month}`)
  }
  if (month <= 3) return 'mudwake'
  if (month <= 6) return 'highsun'
  if (month <= 9) return 'redleaf'
  return 'deepfrost'
}

// Phase 23 §"Required Calendar Helpers" — derives the unified tag list from
// the rest of the calendar fields. Pure and deterministic; never consumes
// RNG. The output is order-stable and deduplicated.
export function getCalendarTags(
  calendar: Omit<CalendarState, 'tags'>,
): CalendarTag[] {
  const tags: CalendarTag[] = []
  const add = (tag: CalendarTag) => {
    if (!tags.includes(tag)) tags.push(tag)
  }

  add(calendar.dayType)
  add(`season_${calendar.season}` as CalendarTag)

  if (calendar.dayType === 'payday') add('miner_payday')
  if (calendar.dayType === 'local_night') add('local_crowd')

  if (calendar.week === 4) add('inspection_window')
  if (calendar.day >= 22 && calendar.day <= 28) add('rent_due_soon')

  // Audit fixes pass 1 §1.6 — the gate evaluation runs only 3 months,
  // starting at month 1 week 1. Holding the festival at month 7 means
  // the festival prep loop, festival_readiness pressure, and
  // festival_approaching arc never fire during cardless gate runs. Move
  // the festival to month 2 week 4 so it lands inside the gate window
  // alongside (but harmlessly co-occurring with) `rent_due_soon`.
  if (calendar.month === 2 && calendar.week === 4) {
    add('mushroom_festival')
    add('festival_window')
  }

  if (calendar.season === 'deepfrost') add('winter_shortage_risk')
  if (calendar.season === 'mudwake' || calendar.season === 'deepfrost') {
    add('road_danger_risk')
  }

  if (calendar.dayType === 'market_day' || calendar.season === 'highsun') {
    add('merchant_traffic')
  }

  return tags
}

export function hasCalendarTag(
  calendar: CalendarState,
  tag: CalendarTag,
): boolean {
  return calendar.tags.includes(tag)
}

export function createInitialCalendar(): CalendarState {
  const base = {
    day: 1,
    week: 1,
    month: 1,
    year: 1,
    totalDaysElapsed: 0,
    dayOfWeek: 1,
    dayType: getDayType(1),
    season: getSeason(1),
  }
  return {
    ...base,
    tags: getCalendarTags(base),
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
  const season = getSeason(month)
  const base = {
    day,
    week,
    month,
    year,
    totalDaysElapsed: calendar.totalDaysElapsed + 1,
    dayOfWeek,
    dayType: getDayType(dayOfWeek),
    season,
  }

  return {
    ...base,
    tags: getCalendarTags(base),
  }
}

export function isEndOfWeek(calendar: CalendarState): boolean {
  return calendar.dayOfWeek === DAYS_PER_WEEK
}

export function isEndOfMonth(calendar: CalendarState): boolean {
  return calendar.day === DAYS_PER_MONTH
}

// Phase 23 §"Report Integration" — keep the existing human-readable date,
// append the season as a short label so reports stay readable without
// dumping the full tag list. Full tags are available via `calendar.tags`
// for debug helpers.
export function getCalendarLabel(calendar: CalendarState): string {
  return `Year ${calendar.year}, Month ${calendar.month}, Week ${calendar.week}, Day ${calendar.day} — ${formatDayType(calendar.dayType)}, ${formatSeason(calendar.season)}`
}

function formatDayType(dayType: DayType): string {
  return dayType
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function formatSeason(season: SeasonId): string {
  return season.charAt(0).toUpperCase() + season.slice(1)
}

export const calendarModule: SimulationModule = {
  id: 'calendar',
  version: '0.1.0',
}

export type {
  CalendarState,
  CalendarTag,
  DayType,
  SeasonId,
} from './types'
