export type DayType =
  | 'supplier_day'
  | 'quiet_day'
  | 'market_day'
  | 'local_night'
  | 'payday'
  | 'brawl_night'
  | 'maintenance_day'

export type CalendarState = {
  day: number
  week: number
  month: number
  year: number
  totalDaysElapsed: number
  dayOfWeek: number
  dayType: DayType
}
