export type DayType =
  | 'supplier_day'
  | 'quiet_day'
  | 'market_day'
  | 'local_night'
  | 'payday'
  | 'brawl_night'
  | 'maintenance_day'

// Phase 23 §"Required Calendar Type Additions" — four seasons, deterministic
// from month: Months 1-3 mudwake, 4-6 highsun, 7-9 redleaf, 10-12 deepfrost.
export type SeasonId =
  | 'mudwake'
  | 'highsun'
  | 'redleaf'
  | 'deepfrost'

// Phase 23 §"Required Calendar Type Additions" — unified tag list that
// callers can query without knowing whether a tag came from the day type,
// the season, or a calendar-window rule. `DayType` values are included so
// existing callers that branch on day type can be migrated to tag checks.
export type CalendarTag =
  | DayType
  | 'season_mudwake'
  | 'season_highsun'
  | 'season_redleaf'
  | 'season_deepfrost'
  | 'miner_payday'
  | 'inspection_window'
  | 'rent_due_soon'
  | 'festival_window'
  | 'mushroom_festival'
  | 'winter_shortage_risk'
  | 'road_danger_risk'
  | 'merchant_traffic'
  | 'local_crowd'

export type CalendarState = {
  day: number
  week: number
  month: number
  year: number
  totalDaysElapsed: number
  dayOfWeek: number
  dayType: DayType
  season: SeasonId
  tags: CalendarTag[]
}
